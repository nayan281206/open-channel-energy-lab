import type { ChannelShape, ChannelParameters } from "@/lib/hydraulics";

export interface Preset {
  name: string;
  shape: ChannelShape;
  params: Partial<ChannelParameters>;
  expected: { yc: number; Ec: number };
}

// Expected values are VALIDATION references only; the simulator always computes its own results.
export const PRESETS: Preset[] = [
  { name: "Rectangular — Example 2.5", shape: "rectangular", params: { Q: 5, g: 9.81, B: 2, y: 1 }, expected: { yc: 0.86, Ec: 1.29 } },
  { name: "Triangular — Example 2.5", shape: "triangular", params: { Q: 5, g: 9.81, m: 0.5, y: 1 }, expected: { yc: 1.828, Ec: 2.284 } },
  { name: "Trapezoidal — Example 2.5", shape: "trapezoidal", params: { Q: 5, g: 9.81, B: 2, m: 1.5, y: 1 }, expected: { yc: 0.714, Ec: 0.979 } },
  { name: "Circular — Example 2.5", shape: "circular", params: { Q: 5, g: 9.81, D: 2, y: 1 }, expected: { yc: 1.074, Ec: 1.505 } },
];