import { z } from 'zod';
import { computeHydraulics, fieldError, SHAPES } from './hydraulics';
const positive = z.number().finite().positive().max(1e6);
export const runInput = z.object({
  request_id: z.string().uuid(),
  shape: z.enum([SHAPES[0], ...SHAPES.slice(1)] as ['rectangular', 'triangular', 'trapezoidal', 'circular']),
  parameters: z.object({ Q: positive, g: positive, y: positive, B: positive, m: positive, D: positive }).strict(),
  tolerance: z.union([z.literal(1e-6), z.literal(1e-8), z.literal(1e-10)]).default(1e-8),
}).strict();
export function prepareRun(input: unknown) {
  const value = runInput.parse(input);
  for (const key of ['Q', 'g', 'y', 'B', 'm', 'D'] as const) {
    const error = fieldError(key, value.parameters[key], value.parameters, value.shape);
    if (error) throw new Error(error);
  }
  const results = computeHydraulics(value.shape, value.parameters, value.tolerance);
  if (!results.ok || !Object.values(results).filter(v => typeof v === 'number').every(Number.isFinite)) {
    throw new Error('These parameters do not produce a valid converged result.');
  }
  return { ...value, results };
}
export interface SavedRun {
  id: string; created_at: string; channel_shape: string;
  parameters: { Q: number; g: number; y: number; B: number; m: number; D: number };
  froude: number; critical_depth: number; specific_energy: number;
}
