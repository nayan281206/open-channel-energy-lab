# Open Channel Flow — Specific Energy Simulator

An interactive hydraulics laboratory for students. Change discharge, gravity, depth and channel geometry and watch the
specific-energy curve, the results, the 2D cross-section and the 3D channel/water update from a single source of truth.

## Install & run

For login, database and owner admin setup, follow [LOCAL_SETUP.md](LOCAL_SETUP.md) first. Environment credentials are required on this branch.


```bash
npm install
npm run dev     # http://localhost:3000
```

## Supported channels

| Shape | A(y) | T(y) |
|---|---|---|
| Rectangular | B·y | B |
| Triangular (m H:1V) | m·y² | 2·m·y |
| Trapezoidal | (B + m·y)·y | B + 2·m·y |
| Circular (D) | r²/2·(θ − sin θ), θ = 2·acos((r−y)/r) | 2·√(2ry − y²) |

## Equations

- Velocity: V = Q/A
- Specific energy: E = y + V²/(2g) = y + Q²/(2gA²), with the real A(y) of each geometry
- Hydraulic depth: D_h = A/T
- Froude number: Fr = V / √(g·A/T); Fr < 1 subcritical, Fr ≈ 1 (±0.02) critical, Fr > 1 supercritical
- Critical flow: Q²T/(gA³) = 1

## Critical-depth calculation

`solveCriticalDepth()` in `src/lib/hydraulics.ts` is geometry-agnostic. It solves f(y) = Q²T/(gA³) − 1 by bisection:
it brackets the root (doubling the upper bound for open shapes, using (0, D) for circular), bisects until |f| < tolerance
(default 1e-8) and returns `criticalDepth, iterations, residual, converged`. Nothing (yc, Ec, V, Fr, A) is hard-coded;
closed-form formulas for rectangular/triangular channels appear only as a cross-check in the calculation panel.
Circular depth is limited to 0 < y ≤ D; at exactly y = D the top width is floored at a tiny value so Fr stays finite.

## 3D visualization

- Every shape is described as one wall profile of 64 vertices (`wallProfile`). Switching shape interpolates those vertices
  exponentially (~0.8 s), so walls rotate, the bottom narrows to a point, or the section rounds into a circle.
- Water is the part of the (morphing) wall polyline below the water level (`wetPolyline`), extruded along the channel,
  with a rippled surface and downstream particles. The same two functions draw the SVG cross-section.
- Particle and ripple speed are visual only; hydraulic values come from `computeHydraulics()` which runs only when parameters change.
- A dashed amber line marks critical depth yc; the camera has Reset/Top/Side/Perspective/Cross-Section views.

## Validation targets (Q = 5 m³/s, g = 9.81 m/s²)

Rectangular B = 2 → yc ≈ 0.860, Ec ≈ 1.290 · Triangular m = 0.5 → 1.828, 2.284 ·
Trapezoidal B = 2, m = 1.5 → 0.714, 0.979 · Circular D = 2 → 1.074, 1.505. Load them from the Presets list.

## Structure

```
src/app            layout, page, global styles
src/components     Simulator (state, controls, results, calculations), Channel3D, CrossSection, EnergyChart
src/data           presets
src/lib            hydraulics.ts (geometry, energy, Froude, solver, shared profile geometry)
```
