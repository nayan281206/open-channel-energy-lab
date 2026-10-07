"use client";

import { useMemo } from "react";
import {
  CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChannelParameters, ChannelShape, CurvePoint, HydraulicResult, curveRange, energyCurve } from "@/lib/hydraulics";

function Tip({ active, payload }: { active?: boolean; payload?: { payload: CurvePoint }[] }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-sky-500/30 bg-slate-900/95 px-3 py-2 text-xs leading-5">
      <div>Depth y = {d.y.toFixed(3)} m</div>
      <div>Specific energy E = {d.E.toFixed(3)} m</div>
      <div>Area A = {d.A.toFixed(3)} m²</div>
      <div>Velocity V = {d.V.toFixed(3)} m/s</div>
      <div>Froude Fr = {d.Fr.toFixed(3)}</div>
    </div>
  );
}

export default function EnergyChart(props: {
  shape: ChannelShape; p: ChannelParameters; r: HydraulicResult; n: number; ymaxOverride: number;
}) {
  const { shape, p, r, n, ymaxOverride } = props;
  const ymax = curveRange(shape, p, r.criticalDepth, ymaxOverride);
  const data = useMemo(() => energyCurve(shape, p, ymax, n), [shape, p.Q, p.g, p.B, p.m, p.D, ymax, n]); // eslint-disable-line react-hooks/exhaustive-deps
  const yMax = Math.max(ymax * 1.6, (Number.isFinite(r.criticalEnergy) ? r.criticalEnergy : 1) * 2);
  const hasC = Number.isFinite(r.criticalDepth) && Number.isFinite(r.criticalEnergy);

  return (
    <div className="h-[340px] w-full" role="img" aria-label="Specific energy curve E versus depth y">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="rgba(120,160,210,0.12)" />
          <XAxis dataKey="y" type="number" domain={[0, ymax]} tickFormatter={(v: number) => v.toFixed(1)}
            stroke="#7f95b0" label={{ value: "Flow depth y [m]", position: "insideBottom", offset: -14, fill: "#9db2cc", fontSize: 12 }} />
          <YAxis type="number" domain={[0, yMax]} allowDataOverflow tickFormatter={(v: number) => v.toFixed(1)}
            stroke="#7f95b0" label={{ value: "E [m]", angle: -90, position: "insideLeft", fill: "#9db2cc", fontSize: 12 }} />
          <Tooltip content={<Tip />} />
          <Line dataKey="y" name="E = y" stroke="#64748b" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          <Line dataKey="E" name="E(y)" stroke="#38bdf8" strokeWidth={2.5} dot={false}
            isAnimationActive animationDuration={450} />
          {hasC && <ReferenceLine x={r.criticalDepth} stroke="#fbbf24" strokeDasharray="5 4"
            label={{ value: "yc", fill: "#fbbf24", fontSize: 11, position: "top" }} />}
          {hasC && <ReferenceLine y={r.criticalEnergy} stroke="#fbbf24" strokeDasharray="5 4"
            label={{ value: "Ec", fill: "#fbbf24", fontSize: 11, position: "right" }} />}
          {hasC && <ReferenceDot x={r.criticalDepth} y={r.criticalEnergy} r={6} fill="#fbbf24" stroke="#000" />}
          {Number.isFinite(r.specificEnergy) && (
            <ReferenceDot x={p.y} y={r.specificEnergy} r={7} fill="#22d3ee" stroke="#fff" strokeWidth={2}
              label={{ value: "current", fill: "#22d3ee", fontSize: 11, position: "bottom" }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}