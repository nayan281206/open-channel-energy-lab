"use client";

import dynamic from "next/dynamic";
import { UserButton } from "@clerk/nextjs";
import RunHistory from "./RunHistory";
import { useCallback, useEffect, useMemo, useState } from "react";
import CrossSection from "./CrossSection";
import EnergyChart from "./EnergyChart";
import { PRESETS } from "@/data/presets";
import {
  ChannelParameters, ChannelShape, HydraulicResult, SHAPES, computeHydraulics, fieldError,
} from "@/lib/hydraulics";

const Channel3D = dynamic(() => import("./Channel3D"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading 3D simulation…</div>,
});

interface SimState extends ChannelParameters {
  shape: ChannelShape;
  res: number; // graph resolution
  ymaxGraph: number; // 0 = auto
  tol: number;
}

const DEFAULT: SimState = { shape: "rectangular", Q: 5, g: 9.81, y: 1, B: 2, m: 1.5, D: 2, res: 240, ymaxGraph: 0, tol: 1e-8 };

const f3 = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "—");
const REGIME_STYLE = {
  SUBCRITICAL: { c: "#38bdf8", t: "SUBCRITICAL FLOW" },
  CRITICAL: { c: "#fbbf24", t: "CRITICAL FLOW" },
  SUPERCRITICAL: { c: "#f87171", t: "SUPERCRITICAL FLOW" },
} as const;

function ShapeIcon({ shape }: { shape: ChannelShape }) {
  const c = { fill: "none", stroke: "currentColor", strokeWidth: 2 };
  return (
    <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden>
      {shape === "rectangular" && <polyline points="6,3 6,22 28,22 28,3" {...c} />}
      {shape === "triangular" && <polyline points="3,3 17,22 31,3" {...c} />}
      {shape === "trapezoidal" && <polyline points="3,3 10,22 24,22 31,3" {...c} />}
      {shape === "circular" && <circle cx="17" cy="13" r="10" {...c} />}
    </svg>
  );
}

function Field(props: {
  id: string; label: string; unit: string; tip: string; value: number;
  check: (v: number) => string | null; onCommit: (v: number) => void;
}) {
  const { id, label, unit, tip, value, check, onCommit } = props;
  const [draft, setDraft] = useState(String(+value.toFixed(4)));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (parseFloat(draft) !== value) { setDraft(String(+value.toFixed(4))); setErr(null); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const change = (s: string) => {
    setDraft(s);
    const v = parseFloat(s);
    const e = Number.isFinite(v) ? check(v) : "Enter a valid number.";
    setErr(e);
    if (!e) onCommit(v);
  };
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1 flex items-center justify-between text-xs text-slate-300" title={tip}>
        <span>{label} <span className="cursor-help text-slate-500" aria-hidden>ⓘ</span></span>
        <span className="text-slate-500">{unit}</span>
      </label>
      <input id={id} type="number" inputMode="decimal" step="any" value={draft} title={tip}
        aria-invalid={!!err} aria-describedby={err ? `${id}-err` : undefined}
        onChange={(e) => change(e.target.value)}
        className={`w-full rounded-md border bg-slate-900/70 px-2 py-1.5 text-sm tabular-nums ${err ? "border-red-500" : "border-slate-600/60"}`} />
      {err && <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-red-400">{err}</p>}
    </div>
  );
}

function Stat({ label, value, unit, tip, accent }: { label: string; value: string; unit?: string; tip: string; accent?: string }) {
  return (
    <div className="rounded-md border border-slate-600/30 bg-slate-900/50 p-2" title={tip}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-base font-semibold tabular-nums" style={{ color: accent ?? "#e2ecf7" }}>
        {value} <span className="text-xs font-normal text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function calcLines(shape: ChannelShape, p: ChannelParameters, r: HydraulicResult): string[] {
  const d = (n: number, k = 4) => (Number.isFinite(n) ? n.toFixed(k) : "—");
  const L: string[] = [];
  const geo: Record<ChannelShape, string> = {
    rectangular: `B = ${d(p.B)} m`, triangular: `m = ${d(p.m)} (H:1V)`,
    trapezoidal: `B = ${d(p.B)} m, m = ${d(p.m)} (H:1V)`, circular: `D = ${d(p.D)} m`,
  };
  L.push(`Given: Q = ${d(p.Q)} m³/s, g = ${d(p.g)} m/s², y = ${d(p.y)} m, ${geo[shape]}`, "");
  if (shape === "rectangular") {
    L.push(`A = B·y = ${d(p.B)} × ${d(p.y)} = ${d(r.area)} m²`, `T = B = ${d(p.B)} m`);
  } else if (shape === "triangular") {
    L.push(`A = m·y² = ${d(p.m)} × ${d(p.y)}² = ${d(r.area)} m²`, `T = 2·m·y = ${d(r.topWidth)} m`);
  } else if (shape === "trapezoidal") {
    L.push(`A = (B + m·y)·y = (${d(p.B)} + ${d(p.m)}×${d(p.y)}) × ${d(p.y)} = ${d(r.area)} m²`, `T = B + 2·m·y = ${d(r.topWidth)} m`);
  } else {
    const rr = p.D / 2;
    const th = 2 * Math.acos(Math.min(1, Math.max(-1, (rr - p.y) / rr)));
    L.push(`r = D/2 = ${d(rr)} m`, `θ = 2·acos((r − y)/r) = ${d(th)} rad`,
      `A = r²/2·(θ − sin θ) = ${d(r.area)} m²`, `T = 2·√(2ry − y²) = ${d(r.topWidth)} m`);
  }
  L.push(`D_h = A/T = ${d(r.hydraulicDepth)} m`, `V = Q/A = ${d(p.Q)} / ${d(r.area)} = ${d(r.velocity)} m/s`,
    `E = y + V²/(2g) = ${d(p.y)} + ${d(r.velocity)}²/(2×${d(p.g)}) = ${d(r.specificEnergy)} m`,
    `Fr = V/√(g·A/T) = ${d(r.froude)} → ${r.flowRegime}`, "", "Critical condition: Q²·T/(g·A³) = 1");
  if (shape === "rectangular") {
    L.push(`T = B, A = B·yc  →  yc = (Q²/(g·B²))^(1/3) = (${d(p.Q)}²/(${d(p.g)}×${d(p.B)}²))^(1/3) = ${d(Math.cbrt((p.Q * p.Q) / (p.g * p.B * p.B)))} m  (closed-form check)`);
  } else if (shape === "triangular") {
    L.push(`yc = (2Q²/(g·m²))^(1/5) = (2×${d(p.Q)}²/(${d(p.g)}×${d(p.m)}²))^(1/5) = ${d(Math.pow((2 * p.Q * p.Q) / (p.g * p.m * p.m), 0.2))} m  (closed-form check)`);
  } else {
    L.push("No closed form — solved numerically for f(y) = Q²T/(gA³) − 1 = 0 by bisection.");
  }
  L.push(`Bisection result: yc = ${d(r.criticalDepth)} m (${r.solver.iterations} iterations, residual = ${r.solver.residual.toExponential(2)})`,
    `Ac = A(yc) = ${d(r.criticalArea)} m²`, `Vc = Q/Ac = ${d(r.criticalVelocity)} m/s`,
    `Ec = yc + Vc²/(2g) = ${d(r.criticalEnergy)} m`, `Frc = ${d(r.criticalFroude)}`);
  return L;
}

export default function Simulator() {
  const [s, setS] = useState<SimState>(DEFAULT);
  const [mode, setMode] = useState<"3d" | "section">("3d");
  const [showDims, setShowDims] = useState(true);
  const [explain, setExplain] = useState(true);
  const [showCalc, setShowCalc] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);

  const set = useCallback(<K extends keyof SimState>(k: K, v: SimState[K]) => {
    setS((prev) => {
      const n = { ...prev, [k]: v } as SimState;
      if ((k === "D" || k === "shape") && n.shape === "circular" && n.y > n.D) n.y = n.D; // keep circular depth valid
      return n;
    });
  }, []);

  const p: ChannelParameters = useMemo(() => ({ Q: s.Q, g: s.g, y: s.y, B: s.B, m: s.m, D: s.D }), [s.Q, s.g, s.y, s.B, s.m, s.D]);
  const r = useMemo(() => computeHydraulics(s.shape, p, s.tol), [s.shape, p, s.tol]);
  const rs = REGIME_STYLE[r.flowRegime];
  const chk = (k: keyof ChannelParameters) => (v: number) => fieldError(k, v, p, s.shape);
  const sliderMax = s.shape === "circular" ? s.D : Math.max(3, Math.ceil(3 * (Number.isFinite(r.criticalDepth) ? r.criticalDepth : 1)));

  const lines = useMemo(() => calcLines(s.shape, p, r), [s.shape, p, r]);

  const exportCSV = () => {
    const rows: [string, number, string][] = [
      ["y", p.y, "m"], ["A", r.area, "m2"], ["T", r.topWidth, "m"], ["Dh", r.hydraulicDepth, "m"], ["V", r.velocity, "m/s"],
      ["E", r.specificEnergy, "m"], ["Fr", r.froude, "-"], ["yc", r.criticalDepth, "m"], ["Ac", r.criticalArea, "m2"],
      ["Vc", r.criticalVelocity, "m/s"], ["Ec", r.criticalEnergy, "m"],
    ];
    const csv = "quantity,value,unit\n" + rows.map((x) => x.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `specific-energy-${s.shape}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copyResults = () => navigator.clipboard?.writeText(lines.join("\n"));

  const edu = [
    "Specific energy is the energy per unit weight measured relative to the channel bottom: E = y + V²/(2g).",
    "Critical depth corresponds to minimum specific energy for a given discharge.",
    "The Froude number compares inertial effects with gravity effects: Fr = V/√(gA/T).",
    "Fr < 1 indicates subcritical (tranquil) flow; Fr > 1 indicates supercritical (rapid) flow.",
  ];

  return (
    <div className="mx-auto max-w-[1600px] p-3 sm:p-4">
      <header className="panel mb-3 flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold tracking-wide">OPEN CHANNEL FLOW</h1>
          <p className="text-xs text-slate-400">Specific Energy Simulator</p>
        </div>
        <div className="flex items-center gap-3">
          <UserButton />
          <span className="text-xs text-emerald-400">● SIMULATION ACTIVE</span>
          <button className="btn" onClick={() => setS(DEFAULT)}>Reset</button>
          <button className="btn" onClick={() => setAdvOpen((v) => !v)}>Settings</button>
          <button className="btn" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen}>Help</button>
        </div>
      </header>

      <RunHistory shape={s.shape} parameters={p} tolerance={s.tol} valid={r.ok} onRestore={(shape, parameters) => setS(prev => ({ ...prev, shape, ...parameters }))} />

      {helpOpen && (
        <section className="panel mb-3 grid gap-3 p-4 text-sm text-slate-300 md:grid-cols-2" aria-label="Help">
          <p><b>Specific energy</b> — energy per unit weight relative to the channel bed, E = y + V²/2g.</p>
          <p><b>Critical depth</b> — the depth where E is minimum for a given Q; there Q²T/(gA³) = 1.</p>
          <p><b>Critical flow</b> — Fr = 1: flow speed equals the speed of a small surface wave.</p>
          <p><b>Froude number</b> — Fr = V/√(gA/T). Subcritical (Fr&lt;1): deep, slow, waves travel upstream. Supercritical (Fr&gt;1): shallow, fast, waves are swept downstream.</p>
        </section>
      )}

      <main className="grid gap-3 lg:grid-cols-[290px_minmax(0,1fr)_290px]">
        {/* CONTROLS */}
        <section className="panel p-4" aria-label="Controls">
          <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate-400">CHANNEL SHAPE</h2>
          <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Channel shape">
            {SHAPES.map((sh) => (
              <button key={sh} role="radio" aria-checked={s.shape === sh} onClick={() => set("shape", sh)}
                className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] tracking-wider transition-colors duration-200 ${
                  s.shape === sh ? "border-cyan-400 bg-cyan-500/15 text-cyan-300" : "border-slate-600/40 text-slate-400 hover:bg-slate-700/30"}`}>
                <ShapeIcon shape={sh} />
                {sh.toUpperCase()}
              </button>
            ))}
          </div>

          <Field id="Q" label="Discharge Q" unit="m³/s" tip="Discharge: volumetric flow rate through the channel." value={s.Q} check={chk("Q")} onCommit={(v) => set("Q", v)} />
          <Field id="g" label="Gravity g" unit="m/s²" tip="Acceleration due to gravity." value={s.g} check={chk("g")} onCommit={(v) => set("g", v)} />
          {(s.shape === "rectangular" || s.shape === "trapezoidal") && (
            <Field id="B" label="Bottom width B" unit="m" tip="Bottom width of the channel." value={s.B} check={chk("B")} onCommit={(v) => set("B", v)} />
          )}
          {(s.shape === "triangular" || s.shape === "trapezoidal") && (
            <Field id="m" label="Side slope m" unit="H:1V" tip="Horizontal run per unit vertical rise of the side walls." value={s.m} check={chk("m")} onCommit={(v) => set("m", v)} />
          )}
          {s.shape === "circular" && (
            <Field id="D" label="Diameter D" unit="m" tip="Internal diameter of the circular channel." value={s.D} check={chk("D")} onCommit={(v) => set("D", v)} />
          )}

          <div className="rounded-md border border-cyan-500/30 bg-slate-900/50 p-3">
            <div className="mb-1 text-xs tracking-widest text-slate-400">FLOW DEPTH</div>
            <div className="mb-1 text-2xl font-semibold tabular-nums text-cyan-300">{p.y.toFixed(2)} m</div>
            <input type="range" aria-label="Flow depth slider" min={0.01} max={sliderMax} step={0.01}
              value={Math.min(p.y, sliderMax)} onChange={(e) => set("y", parseFloat(e.target.value))}
              className="mb-2 w-full accent-cyan-400" />
            <Field id="y" label="Exact depth y" unit="m" tip="Current flow depth." value={s.y} check={chk("y")} onCommit={(v) => set("y", v)} />
          </div>

          <h2 className="mb-2 mt-4 text-xs font-semibold tracking-widest text-slate-400">PRESETS</h2>
          <div className="flex flex-col gap-1.5">
            {PRESETS.map((pr) => (
              <button key={pr.name} className="btn text-left" title={`Validation reference: yc≈${pr.expected.yc} m, Ec≈${pr.expected.Ec} m`}
                onClick={() => setS((prev) => ({ ...prev, shape: pr.shape, ...pr.params }))}>
                {pr.name}
              </button>
            ))}
          </div>

          <details className="mt-4 text-xs" open={advOpen} onToggle={(e) => setAdvOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer tracking-widest text-slate-400">ADVANCED</summary>
            <div className="mt-2 space-y-2">
              <label className="block">Graph resolution ({s.res})
                <input type="range" min={60} max={600} step={20} value={s.res} onChange={(e) => set("res", +e.target.value)} className="w-full" />
              </label>
              {s.shape !== "circular" && (
                <label className="block">Graph max depth (m, 0 = auto)
                  <input type="number" min={0} step="0.1" value={s.ymaxGraph} onChange={(e) => set("ymaxGraph", Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full rounded border border-slate-600/60 bg-slate-900/70 px-2 py-1" />
                </label>
              )}
              <label className="block">Solver tolerance
                <select value={s.tol} onChange={(e) => set("tol", +e.target.value)} className="w-full rounded border border-slate-600/60 bg-slate-900 px-2 py-1">
                  <option value={1e-6}>1e-6</option><option value={1e-8}>1e-8</option><option value={1e-10}>1e-10</option>
                </select>
              </label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} /> Show dimensions</label>
              <p className="text-slate-400">Solver iterations: {r.solver.iterations}<br />Residual: {Number.isFinite(r.solver.residual) ? r.solver.residual.toExponential(2) : "—"}</p>
            </div>
          </details>
        </section>

        {/* 3D / CROSS SECTION */}
        <section className="panel flex min-h-[440px] flex-col overflow-hidden lg:min-h-[620px]" aria-label="Simulation view">
          <div className="flex items-center justify-between border-b border-slate-600/30 px-3 py-2">
            <div className="flex gap-1.5" role="tablist">
              <button role="tab" aria-selected={mode === "3d"} className={`btn ${mode === "3d" ? "!border-cyan-400 text-cyan-300" : ""}`} onClick={() => setMode("3d")}>3D VIEW</button>
              <button role="tab" aria-selected={mode === "section"} className={`btn ${mode === "section" ? "!border-cyan-400 text-cyan-300" : ""}`} onClick={() => setMode("section")}>CROSS SECTION</button>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              <input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} /> SHOW DIMENSIONS
            </label>
          </div>
          <div className="relative min-h-[380px] flex-1">
            {mode === "3d" ? <Channel3D shape={s.shape} p={p} r={r} showDims={showDims} /> : (
              <div className="absolute inset-0 p-2"><CrossSection shape={s.shape} p={p} r={r} /></div>
            )}
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-slate-950/70 px-3 py-1.5 text-center"
              style={{ borderColor: rs.c, color: rs.c }}>
              <div className="text-sm font-semibold tracking-wider">{rs.t}</div>
              <div className="text-xs">Fr = {f3(r.froude)}</div>
            </div>
          </div>
        </section>

        {/* RESULTS */}
        <section className="panel p-4" aria-label="Results">
          {!r.ok && (
            <p role="alert" className="mb-3 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              Critical depth could not be determined for the current parameters.
            </p>
          )}
          <div className="mb-3 rounded-md border-2 p-3 text-center" style={{ borderColor: rs.c, background: `${rs.c}18` }}>
            <div className="text-sm font-bold tracking-widest" style={{ color: rs.c }}>{rs.t}</div>
            <div className="text-lg tabular-nums">Fr = {f3(r.froude)}</div>
          </div>
          <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate-400">CURRENT FLOW</h2>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label="Depth y" value={f3(p.y)} unit="m" tip="Current flow depth." />
            <Stat label="Area A" value={f3(r.area)} unit="m²" tip="Cross-sectional area occupied by water." />
            <Stat label="Top width T" value={f3(r.topWidth)} unit="m" tip="Top width of the water surface." />
            <Stat label="Hyd. depth A/T" value={f3(r.hydraulicDepth)} unit="m" tip="Hydraulic depth, area divided by top width." />
            <Stat label="Velocity V" value={f3(r.velocity)} unit="m/s" tip="Mean flow velocity." />
            <Stat label="Energy E" value={f3(r.specificEnergy)} unit="m" tip="Specific energy measured relative to the channel bottom." />
          </div>
          <h2 className="mb-2 text-xs font-semibold tracking-widest text-amber-300/80">CRITICAL FLOW</h2>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Stat label="Critical depth yc" value={f3(r.criticalDepth)} unit="m" accent="#fbbf24" tip="Critical depth corresponding to minimum specific energy." />
            <Stat label="Critical area Ac" value={f3(r.criticalArea)} unit="m²" tip="Flow area at critical depth." />
            <Stat label="Critical vel. Vc" value={f3(r.criticalVelocity)} unit="m/s" tip="Velocity at critical depth." />
            <Stat label="Critical energy Ec" value={f3(r.criticalEnergy)} unit="m" accent="#fbbf24" tip="Minimum specific energy for the given discharge and channel geometry." />
            <Stat label="Critical Fr" value={f3(r.criticalFroude)} tip="Froude number at critical depth (should be 1)." />
          </div>
          <div className="flex gap-2">
            <button className="btn flex-1" onClick={exportCSV}>Download CSV</button>
            <button className="btn flex-1" onClick={copyResults}>Copy Results</button>
          </div>
          {explain && (
            <ul className="mt-4 space-y-2 text-xs leading-5 text-slate-400">
              {edu.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={explain} onChange={(e) => setExplain(e.target.checked)} /> EXPLAIN PHYSICS
          </label>
        </section>
      </main>

      <section className="panel mt-3 p-4" aria-label="Specific energy graph">
        <h2 className="mb-1 text-xs font-semibold tracking-widest text-slate-400">SPECIFIC ENERGY DIAGRAM — E = y + Q²/(2gA²)</h2>
        <EnergyChart shape={s.shape} p={p} r={r} n={s.res} ymaxOverride={s.ymaxGraph} />
      </section>

      <section className="panel mt-3 p-4" aria-label="Calculations">
        <button className="btn" aria-expanded={showCalc} onClick={() => setShowCalc((v) => !v)}>
          {showCalc ? "HIDE CALCULATIONS" : "SHOW CALCULATIONS"}
        </button>
        {showCalc && (
          <div className="calculation-text mt-3 overflow-x-auto rounded-md bg-white p-4 text-base leading-8 text-black"
            aria-label="Step-by-step hydraulic calculations">
            {lines.map((line, index) => (
              line ? <div key={`${index}-${line}`}>{line}</div> : <div key={`blank-${index}`} className="h-3" aria-hidden />
            ))}
          </div>
        )}
      </section>
    </div>
  );
      }
