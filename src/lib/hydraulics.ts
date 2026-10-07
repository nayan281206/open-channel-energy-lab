/**
 * Hydraulics + shared geometry. The SAME section()/wallProfile()/wetPolyline()
 * functions feed the equations, the graph, the SVG cross-section and the 3D model.
 */

export type ChannelShape = "rectangular" | "triangular" | "trapezoidal" | "circular";
export const SHAPES: ChannelShape[] = ["rectangular", "triangular", "trapezoidal", "circular"];

export interface ChannelParameters {
  Q: number;
  g: number;
  y: number;
  B: number; // bottom width (rectangular, trapezoidal)
  m: number; // side slope H:1V (triangular, trapezoidal)
  D: number; // diameter (circular)
}

export type FlowRegime = "SUBCRITICAL" | "CRITICAL" | "SUPERCRITICAL";

export interface CriticalSolution {
  criticalDepth: number;
  iterations: number;
  residual: number;
  converged: boolean;
}

export interface HydraulicResult {
  area: number;
  topWidth: number;
  hydraulicDepth: number;
  velocity: number;
  specificEnergy: number;
  froude: number;
  flowRegime: FlowRegime;
  criticalDepth: number;
  criticalArea: number;
  criticalVelocity: number;
  criticalEnergy: number;
  criticalFroude: number;
  solver: CriticalSolution;
  ok: boolean;
}

export interface CurvePoint {
  y: number;
  E: number;
  A: number;
  V: number;
  Fr: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Flow area A(y) and top width T(y) for each geometry. */
export function section(shape: ChannelShape, p: ChannelParameters, y: number): { A: number; T: number } {
  const yy = Math.max(y, 0);
  switch (shape) {
    case "rectangular":
      return { A: p.B * yy, T: p.B };
    case "triangular":
      return { A: p.m * yy * yy, T: 2 * p.m * yy };
    case "trapezoidal":
      return { A: (p.B + p.m * yy) * yy, T: p.B + 2 * p.m * yy };
    case "circular": {
      const r = p.D / 2;
      const yc = Math.min(yy, p.D);
      const theta = 2 * Math.acos(clamp((r - yc) / r, -1, 1));
      return {
        A: (r * r * (theta - Math.sin(theta))) / 2,
        T: 2 * Math.sqrt(Math.max(2 * r * yc - yc * yc, 0)),
      };
    }
  }
}

export function froudeNumber(Q: number, g: number, A: number, T: number): number {
  if (A <= 0 || g <= 0) return NaN;
  return Q / A / Math.sqrt((g * A) / Math.max(T, 1e-9));
}

export function specificEnergy(shape: ChannelShape, p: ChannelParameters, y: number): number {
  const { A } = section(shape, p, y);
  return A > 0 ? y + (p.Q * p.Q) / (2 * p.g * A * A) : Infinity;
}

/** Bisection on f(y) = Q²T/(gA³) − 1 (monotonically decreasing in y). */
export function solveCriticalDepth(
  shape: ChannelShape,
  p: ChannelParameters,
  opts: { tol?: number; maxIter?: number } = {}
): CriticalSolution {
  const tol = opts.tol ?? 1e-8;
  const maxIter = opts.maxIter ?? 200;
  const f = (y: number) => {
    const s = section(shape, p, y);
    if (s.A <= 0) return Infinity;
    return (p.Q * p.Q * Math.max(s.T, 1e-12)) / (p.g * s.A ** 3) - 1;
  };
  const fail: CriticalSolution = { criticalDepth: NaN, iterations: 0, residual: NaN, converged: false };
  if (![p.Q, p.g, p.B, p.m, p.D].every(Number.isFinite) || p.Q <= 0 || p.g <= 0) return fail;

  let lo = 1e-9;
  let hi = shape === "circular" ? p.D * (1 - 1e-9) : 1;
  if (shape !== "circular") {
    let n = 0;
    while (f(hi) > 0 && n++ < 200) hi *= 2; // expand until sign change
  }
  if (!(f(lo) > 0) || !(f(hi) < 0)) return fail;

  let it = 0;
  let mid = 0.5 * (lo + hi);
  let fm = f(mid);
  while (it < maxIter) {
    it++;
    mid = 0.5 * (lo + hi);
    fm = f(mid);
    if (Math.abs(fm) < tol || hi - lo < 1e-14) break;
    if (fm > 0) lo = mid;
    else hi = mid;
  }
  return { criticalDepth: mid, iterations: it, residual: fm, converged: Math.abs(fm) < Math.max(tol * 100, 1e-6) };
}

export function computeHydraulics(shape: ChannelShape, p: ChannelParameters, tol = 1e-8): HydraulicResult {
  const s = section(shape, p, p.y);
  const T = Math.max(s.T, 1e-9);
  const V = p.Q / s.A;
  const Dh = s.A / T;
  const Fr = froudeNumber(p.Q, p.g, s.A, s.T);
  const E = p.y + (V * V) / (2 * p.g);
  const sol = solveCriticalDepth(shape, p, { tol });
  let Ac = NaN, Vc = NaN, Ec = NaN, Frc = NaN;
  if (sol.converged) {
    const cs = section(shape, p, sol.criticalDepth);
    Ac = cs.A;
    Vc = p.Q / Ac;
    Ec = sol.criticalDepth + (Vc * Vc) / (2 * p.g);
    Frc = froudeNumber(p.Q, p.g, cs.A, cs.T);
  }
  const regime: FlowRegime = Math.abs(Fr - 1) < 0.02 ? "CRITICAL" : Fr < 1 ? "SUBCRITICAL" : "SUPERCRITICAL";
  return {
    area: s.A, topWidth: s.T, hydraulicDepth: Dh, velocity: V, specificEnergy: E, froude: Fr,
    flowRegime: regime, criticalDepth: sol.criticalDepth, criticalArea: Ac, criticalVelocity: Vc,
    criticalEnergy: Ec, criticalFroude: Frc, solver: sol,
    ok: sol.converged && [s.A, V, E, Fr].every(Number.isFinite),
  };
}

/** Friendly validation message for one parameter (null = valid). */
export function fieldError(key: keyof ChannelParameters, v: number, p: ChannelParameters, shape: ChannelShape): string | null {
  if (!Number.isFinite(v)) return "Enter a valid number.";
  if (v <= 0) {
    const names: Record<keyof ChannelParameters, string> = {
      Q: "Discharge", g: "Gravity", y: "Flow depth", B: "Bottom width", m: "Side slope", D: "Diameter",
    };
    return `${names[key]} must be greater than zero.`;
  }
  if (v > 1e6) return "Value is too large.";
  if (key === "y" && shape === "circular" && v > p.D) return "Flow depth cannot exceed the circular channel diameter.";
  return null;
}

/** Specific-energy curve E(y) = y + Q²/(2gA²) using the real A(y). */
export function curveRange(shape: ChannelShape, p: ChannelParameters, yc: number, override: number): number {
  if (shape === "circular") return p.D * 0.999;
  if (override > 0) return Math.max(override, p.y * 1.05);
  const base = Number.isFinite(yc) ? 2.5 * yc : 2;
  return Math.max(base, 1.3 * p.y, 0.5);
}

export function energyCurve(shape: ChannelShape, p: ChannelParameters, ymax: number, n: number): CurvePoint[] {
  const out: CurvePoint[] = [];
  const y0 = ymax * 0.02;
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((ymax - y0) * i) / n;
    const s = section(shape, p, y);
    if (s.A <= 0) continue;
    const V = p.Q / s.A;
    out.push({ y, E: y + (V * V) / (2 * p.g), A: s.A, V, Fr: froudeNumber(p.Q, p.g, s.A, s.T) });
  }
  return out;
}

/* ---------------- shared cross-section geometry (SVG + 3D) ---------------- */

export const PROFILE_K = 64;

/** Display height of the channel walls (circular: D). Snaps to 0.5 m steps for stability. */
export function displayHeight(shape: ChannelShape, p: ChannelParameters, yc: number): number {
  if (shape === "circular") return p.D;
  const ref = Math.max(p.y, Number.isFinite(yc) ? yc : 0);
  return Math.max(1.5, Math.ceil(1.6 * ref * 2) / 2);
}

/**
 * Wall profile as K points (x,z flattened) running left rim → bottom → right rim.
 * Every shape has exactly K vertices so shapes can be morphed by interpolation.
 * Corners of polygonal shapes are kept exact (points allocated per segment).
 */
export function wallProfile(shape: ChannelShape, p: ChannelParameters, H: number): Float32Array {
  const K = PROFILE_K;
  const out = new Float32Array(K * 2);
  if (shape === "circular") {
    const r = p.D / 2;
    for (let i = 0; i < K; i++) {
      const t = (2 * Math.PI * i) / (K - 1); // t=0 top, π bottom, 2π top
      out[2 * i] = -r * Math.sin(t);
      out[2 * i + 1] = r + r * Math.cos(t);
    }
    return out;
  }
  let poly: [number, number][];
  if (shape === "rectangular") poly = [[-p.B / 2, H], [-p.B / 2, 0], [p.B / 2, 0], [p.B / 2, H]];
  else if (shape === "triangular") poly = [[-p.m * H, H], [0, 0], [p.m * H, H]];
  else poly = [[-(p.B / 2 + p.m * H), H], [-p.B / 2, 0], [p.B / 2, 0], [p.B / 2 + p.m * H, H]];

  const lens: number[] = [];
  for (let i = 0; i < poly.length - 1; i++) lens.push(Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  const counts = lens.map((l) => Math.max(1, Math.round(((K - 1) * l) / total)));
  let diff = K - 1 - counts.reduce((a, b) => a + b, 0);
  const longest = lens.indexOf(Math.max(...lens));
  counts[longest] += diff; // absorb rounding error in the longest segment
  diff = 0;
  let idx = 0;
  for (let s = 0; s < poly.length - 1; s++) {
    for (let j = 0; j < counts[s]; j++) {
      const t = j / counts[s];
      out[2 * idx] = poly[s][0] + (poly[s + 1][0] - poly[s][0]) * t;
      out[2 * idx + 1] = poly[s][1] + (poly[s + 1][1] - poly[s][1]) * t;
      idx++;
    }
  }
  const last = poly[poly.length - 1];
  out[2 * (K - 1)] = last[0];
  out[2 * (K - 1) + 1] = last[1];
  return out;
}

/** Part of the wall polyline below water level y (flat [x0,z0,x1,z1,...], ordered along the wall). */
export function wetPolyline(pts: ArrayLike<number>, y: number): number[] {
  const n = pts.length / 2;
  const out: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const ax = pts[2 * i], az = pts[2 * i + 1], bx = pts[2 * i + 2], bz = pts[2 * i + 3];
    const ia = az <= y, ib = bz <= y;
    if (ia) out.push(ax, az);
    if (ia !== ib) {
      const t = (y - az) / (bz - az);
      out.push(ax + (bx - ax) * t, y);
    }
  }
  if (pts[2 * n - 1] <= y) out.push(pts[2 * n - 2], pts[2 * n - 1]);
  return out;
}