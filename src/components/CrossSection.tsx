"use client";

import { ChannelParameters, ChannelShape, HydraulicResult, displayHeight, wallProfile, wetPolyline } from "@/lib/hydraulics";

/** 2D cross-section built from the same wallProfile()/wetPolyline() used by the 3D model. */
export default function CrossSection({ shape, p, r }: { shape: ChannelShape; p: ChannelParameters; r: HydraulicResult }) {
  const H = displayHeight(shape, p, r.criticalDepth);
  const pts = wallProfile(shape, p, H);
  let maxX = 0;
  for (let i = 0; i < pts.length; i += 2) maxX = Math.max(maxX, Math.abs(pts[i]));
  const yw = Math.min(p.y, H);
  const wet = wetPolyline(pts, yw);
  const pad = Math.max(maxX, H) * 0.3;
  const fs = Math.max(maxX * 2, H) * 0.045;
  const Z = (z: number) => H - z;
  const toStr = (a: ArrayLike<number>) => {
    const s: string[] = [];
    for (let i = 0; i < a.length; i += 2) s.push(`${a[i].toFixed(4)},${Z(a[i + 1]).toFixed(4)}`);
    return s.join(" ");
  };
  const xl = wet.length >= 2 ? wet[0] : 0;
  const xr = wet.length >= 2 ? wet[wet.length - 2] : 0;
  const dimX = maxX + pad * 0.45;
  const ycOk = Number.isFinite(r.criticalDepth) && r.criticalDepth <= H;

  return (
    <svg className="h-full w-full" viewBox={`${-maxX - pad} ${-pad} ${2 * maxX + 2 * pad} ${H + 2 * pad}`}
      role="img" aria-label={`Cross-section of ${shape} channel`}>
      <polygon points={toStr(wet)} fill="rgba(56,140,220,0.55)" />
      <polyline points={toStr(pts)} fill="none" stroke="#9db8d6" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      <line x1={xl} x2={xr} y1={Z(yw)} y2={Z(yw)} stroke="#7dd3fc" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {ycOk && (
        <g>
          <line x1={-maxX} x2={maxX} y1={Z(r.criticalDepth)} y2={Z(r.criticalDepth)} stroke="#fbbf24"
            strokeDasharray="6 4" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          <text x={-maxX} y={Z(r.criticalDepth) - fs * 0.3} fill="#fbbf24" fontSize={fs}>yc = {r.criticalDepth.toFixed(3)} m</text>
        </g>
      )}
      {/* depth dimension */}
      <line x1={dimX} x2={dimX} y1={Z(0)} y2={Z(yw)} stroke="#22d3ee" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <line x1={dimX - fs * 0.4} x2={dimX + fs * 0.4} y1={Z(0)} y2={Z(0)} stroke="#22d3ee" vectorEffect="non-scaling-stroke" />
      <line x1={dimX - fs * 0.4} x2={dimX + fs * 0.4} y1={Z(yw)} y2={Z(yw)} stroke="#22d3ee" vectorEffect="non-scaling-stroke" />
      <text x={dimX + fs * 0.6} y={Z(yw / 2)} fill="#22d3ee" fontSize={fs}>y = {p.y.toFixed(3)} m</text>
      {/* top width */}
      <line x1={xl} x2={xr} y1={Z(yw) - fs} y2={Z(yw) - fs} stroke="#cbd5e1" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={(xl + xr) / 2} y={Z(yw) - fs * 1.4} fill="#cbd5e1" fontSize={fs} textAnchor="middle">
        T = {r.topWidth.toFixed(3)} m
      </text>
      {/* bottom label */}
      <text x={0} y={Z(0) + fs * 2} fill="#9db2cc" fontSize={fs} textAnchor="middle">
        {shape === "rectangular" && `B = ${p.B.toFixed(3)} m`}
        {shape === "triangular" && `m = ${p.m.toFixed(3)} (H:1V)`}
        {shape === "trapezoidal" && `B = ${p.B.toFixed(3)} m,  m = ${p.m.toFixed(3)} (H:1V)`}
        {shape === "circular" && `D = ${p.D.toFixed(3)} m`}
      </text>
    </svg>
  );
}