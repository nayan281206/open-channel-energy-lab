'use client';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
type User = { id: string; name: string | null; username: string | null; email: string | null; emails: { email: string; verified: boolean }[]; phones: { number: string; verified: boolean }[]; joined: number; lastSignIn: number | null; lastActive: number | null; banned: boolean; locked: boolean; twoFactorEnabled: boolean; providers: string[]; profile: { created_at: string; updated_at: string; simulation_runs: { count: number }[] } | null };
type Run = { id: string; user_id: string; created_at: string; channel_shape: string; parameters: Record<string, number>; froude: number; critical_depth: number; specific_energy: number; flow_regime: string; solver_tolerance: number; results: Record<string, unknown>; request_id: string };
const date = (value: string | number | null | undefined) => value ? new Date(value).toLocaleString() : 'Not recorded';
export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]), [runs, setRuns] = useState<Run[]>([]);
  const [stats, setStats] = useState({ users: 0, runs: 0, recentRuns: 0 });
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [runPage, setRunPage] = useState(1), [runTotal, setRunTotal] = useState(0);
  const [selected, setSelected] = useState<User | null>(null), [search, setSearch] = useState(''), [query, setQuery] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [runError, setRunError] = useState(''), [runBusy, setRunBusy] = useState(false), [refreshed, setRefreshed] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/admin?page=${page}&search=${encodeURIComponent(query)}`, { cache: 'no-store', signal });
      const d = await r.json(); if (!r.ok) throw Error(d.error);
      setUsers(d.users); setStats(d.stats); setTotal(d.total); setRefreshed(d.refreshedAt);
    } catch (e) { if (!signal?.aborted) { setUsers([]); setError(e instanceof Error ? e.message : 'Could not load users.'); } }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [page, query]);
  const loadRuns = useCallback(async (signal?: AbortSignal) => {
    setRunBusy(true); setRunError('');
    try {
      const r = await fetch(`/api/admin?view=runs&page=${runPage}${selected ? `&userId=${encodeURIComponent(selected.id)}` : ''}`, { cache: 'no-store', signal });
      const d = await r.json(); if (!r.ok) throw Error(d.error); setRuns(d.runs); setRunTotal(d.total);
    } catch (e) { if (!signal?.aborted) { setRuns([]); setRunError(e instanceof Error ? e.message : 'Could not load runs.'); } }
    finally { if (!signal?.aborted) setRunBusy(false); }
  }, [runPage, selected]);
  useEffect(() => { const c = new AbortController(); void load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => { const c = new AbortController(); void loadRuns(c.signal); return () => c.abort(); }, [loadRuns]);
  return <main className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-8">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[.25em] text-cyan-400">Open Channel Energy Lab / Admin</p><h1 className="mt-2 text-3xl font-semibold">Users & usage</h1><p className="mt-2 text-sm text-slate-400">Account directory and saved simulation activity. Read-only, owner access.</p></div><div className="flex items-center gap-3"><Link href="/" className="btn">Simulator</Link><button className="btn" disabled={busy || runBusy} onClick={() => { void load(); void loadRuns(); }}>Refresh</button><UserButton /></div></header>
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Usage totals">{[['Registered users', stats.users], ['Saved runs', stats.runs], ['Runs in last 7 days', stats.recentRuns]].map(([label, value]) => <div key={label} className="panel min-w-0 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-semibold text-cyan-300">{busy ? '...' : value}</p></div>)}</section>
    {error && <p role="alert" className="rounded border border-red-800 p-4 text-red-300">{error}</p>}
    <section className="panel overflow-hidden p-5" aria-label="User directory"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">User directory <span className="text-sm font-normal text-slate-400">({total})</span></h2><form className="flex gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search); }}><label className="sr-only" htmlFor="user-search">Search users</label><input id="user-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email or username" className="w-56 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm" /><button className="btn">Search</button></form></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr>{['User', 'Joined', 'Last active (Clerk)', 'Saved runs', 'Status', ''].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{users.map(u => <tr key={u.id} className="border-t border-slate-800"><td className="p-3"><p className="font-medium">{u.name || 'Unnamed user'}</p><p className="text-xs text-slate-400">{u.email || 'No primary email'}</p></td><td className="p-3 text-xs">{date(u.joined)}</td><td className="p-3 text-xs">{date(u.lastActive)}</td><td className="p-3 text-cyan-300">{u.profile?.simulation_runs?.[0]?.count ?? 0}</td><td className="p-3 text-xs">{u.banned ? 'Banned' : u.locked ? 'Locked' : 'Active account'}</td><td className="p-3"><button className="btn" onClick={() => { setSelected(u); setRunPage(1); }}>View details</button></td></tr>)}</tbody></table></div>
    {!busy && users.length === 0 && !error && <p className="py-6 text-sm text-slate-400">No users match this search.</p>}
    <Pager page={page} total={total} busy={busy} setPage={setPage} />
    </section>
    {selected && <section className="panel min-w-0 p-5" aria-label="Selected user"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">{selected.name || selected.email || 'User details'}</h2><p className="mt-1 break-all font-mono text-xs text-slate-400">{selected.id}</p></div><button className="btn" onClick={() => { setSelected(null); setRunPage(1); }}>Show all runs</button></div><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{Object.entries({
      'Email addresses': selected.emails.map(e => `${e.email} (${e.verified ? 'verified' : 'unverified'})`).join(', ') || 'None',
      'Phone numbers': selected.phones.map(p => `${p.number} (${p.verified ? 'verified' : 'unverified'})`).join(', ') || 'None',
      'Username': selected.username || 'None', 'Joined': date(selected.joined), 'Last sign-in': date(selected.lastSignIn), 'Last active (Clerk)': date(selected.lastActive),
      'Notebook last synced': date(selected.profile?.updated_at), 'Connected providers': selected.providers.join(', ') || 'None', 'Two-factor auth': selected.twoFactorEnabled ? 'Enabled' : 'Disabled',
    }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl></section>}
    <section className="panel min-w-0 p-5" aria-label="Saved simulation runs"><h2 className="text-lg font-semibold">{selected ? 'Selected user\'s saved runs' : 'All saved runs'} <span className="text-sm font-normal text-slate-400">({runTotal})</span></h2><p className="mt-1 text-xs text-slate-400">Newest first, 25 per page. Expand a run for every stored input and result. Times use your browser timezone.</p>
    {runError && <p role="alert" className="my-4 text-red-300">{runError}</p>}{runBusy ? <p role="status" className="py-5">Loading runs...</p> : <div className="mt-4 space-y-3">{runs.map(r => <details key={r.id} className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/40 p-4"><summary className="cursor-pointer text-sm"><span className="font-medium capitalize text-cyan-300">{r.channel_shape}</span><span className="ml-3 text-xs text-slate-400">{date(r.created_at)}</span><span className="ml-3">Q {r.parameters.Q} m³/s · y {r.parameters.y} m · Fr {r.froude.toFixed(3)} · {r.flow_regime}</span></summary><p className="mt-4 break-all text-xs text-slate-400">User: {r.user_id} | Run: {r.id}</p><div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2 [&>div]:min-w-0"><div><h3 className="mb-2 text-sm font-medium">Inputs & summary</h3><pre className="max-w-full overflow-x-auto rounded bg-black/30 p-3 text-xs">{JSON.stringify({ parameters: r.parameters, solver_tolerance: r.solver_tolerance, froude: r.froude, critical_depth_m: r.critical_depth, specific_energy_m: r.specific_energy, flow_regime: r.flow_regime, request_id: r.request_id }, null, 2)}</pre></div><div><h3 className="mb-2 text-sm font-medium">Complete computed results</h3><pre className="max-h-96 max-w-full overflow-auto rounded bg-black/30 p-3 text-xs">{JSON.stringify(r.results, null, 2)}</pre></div></div></details>)}{!runs.length && !runError && <p className="py-5 text-sm text-slate-400">No saved runs yet.</p>}</div>}<Pager page={runPage} total={runTotal} busy={runBusy} setPage={setRunPage} />
    </section><footer className="text-xs leading-6 text-slate-500">Updated: {date(refreshed)}. Usage means explicit Save run actions, not slider edits, page views or time spent. Clerk activity may lag. Credentials, tokens and private metadata are never returned. Refresh is manual.</footer>
  </main>;
}
function Pager({ page, total, busy, setPage }: { page: number; total: number; busy: boolean; setPage: (value: number) => void }) {
  return <div className="mt-4 flex items-center justify-end gap-3 text-xs"><button className="btn disabled:opacity-40" disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><button className="btn disabled:opacity-40" disabled={busy || page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div>;
}
