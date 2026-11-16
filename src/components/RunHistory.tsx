'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChannelParameters, ChannelShape } from '@/lib/hydraulics';
import type { SavedRun } from '@/lib/runs';
export default function RunHistory({ shape, parameters, tolerance, valid, onRestore }: {
  shape: ChannelShape; parameters: ChannelParameters; tolerance: number; valid: boolean;
  onRestore: (shape: ChannelShape, parameters: ChannelParameters) => void;
}) {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const lock = useRef(false);
  const pending = useRef<{ signature: string; id: string } | undefined>(undefined);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const profile = await fetch('/api/profile', { method: 'POST', signal });
      if (!profile.ok) { const result = await profile.json(); throw new Error(result.error ?? 'Could not sync your profile.'); }
      const response = await fetch('/api/runs', { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not load runs.');
      setRuns(data.runs); setError('');
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Could not load runs.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const snapshot = { shape, parameters, tolerance };
    const signature = JSON.stringify(snapshot);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...snapshot, request_id: pending.current.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not save run.');
      setRuns(previous => [data.run, ...previous.filter(run => run.id !== data.run.id)].slice(0, 20));
      pending.current = undefined; setMessage('Run saved to your account.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save run.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="panel mb-3 p-4" aria-label="Your saved simulations">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-semibold">Your lab notebook</h2><p className="text-xs text-slate-400">Save a snapshot of the current inputs and results. Your history is private to your account.</p></div>
      <div className="flex gap-2"><button className="btn disabled:opacity-50" disabled={busy || !valid} onClick={save}>{busy ? 'Saving...' : 'Save run'}</button><button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide history' : 'My history'}</button></div>
    </div>
    {message && <p role="status" className="mt-2 text-xs text-emerald-300">{message}</p>}
    {error && <div role="alert" className="mt-2 text-xs text-red-300">{error} <button className="underline" onClick={() => load()}>Reload history</button></div>}
    {open && <div className="mt-3 overflow-x-auto">{loading ? <p>Loading your runs...</p> : runs.length === 0 ? <p className="text-sm text-slate-400">No saved runs yet. Set up a simulation and choose Save run.</p> : <table className="w-full text-left text-xs"><caption className="mb-2 text-left text-slate-400">Your latest 20 saved runs</caption><thead><tr>{['Saved', 'Shape', 'Q (m³/s)', 'Depth (m)', 'Fr', 'yc (m)', 'E (m)', ''].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{runs.map(run => <tr className="border-t border-slate-700" key={run.id}><td className="p-2">{new Date(run.created_at).toLocaleString()}</td><td className="p-2 capitalize">{run.channel_shape}</td><td className="p-2">{run.parameters.Q}</td><td className="p-2">{run.parameters.y}</td><td className="p-2">{run.froude.toFixed(3)}</td><td className="p-2">{run.critical_depth.toFixed(3)}</td><td className="p-2">{run.specific_energy.toFixed(3)}</td><td className="p-2"><button className="btn" onClick={() => onRestore(run.channel_shape as ChannelShape, run.parameters)}>Restore inputs</button></td></tr>)}</tbody></table>}</div>}
  </section>;
}
