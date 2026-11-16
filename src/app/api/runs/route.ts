import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { syncProfile } from '@/lib/profile-server';
import { prepareRun } from '@/lib/runs';
export const dynamic = 'force-dynamic';
const fields = 'id,created_at,channel_shape,parameters,froude,critical_depth,specific_energy';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  const { userId } = await auth();
  if (!userId) return reply({ error: 'Sign in to view your runs.' }, 401);
  try {
    const db = createServerSupabase();
    const { data, error } = await db.from('simulation_runs').select(fields).eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    if (error) return reply({ error: 'Could not load runs. Check the database setup.' }, 503);
    return reply({ runs: data });
  } catch { return reply({ error: 'Database is not configured.' }, 503); }
}
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return reply({ error: 'Sign in to save a run.' }, 401);
  if (request.headers.get('origin') !== request.nextUrl.origin) return reply({ error: 'Invalid request origin.' }, 403);
  const raw = await request.text();
  if (raw.length > 8192) return reply({ error: 'Request is too large.' }, 413);
  let run;
  try { run = prepareRun(JSON.parse(raw)); }
  catch { return reply({ error: 'Invalid simulation parameters or non-convergent result.' }, 400); }
  try {
    const db = createServerSupabase();
    await syncProfile(userId);
    const { results: r } = run;
    const { data, error } = await db.from('simulation_runs').upsert({
      user_id: userId, request_id: run.request_id, channel_shape: run.shape,
      parameters: run.parameters, solver_tolerance: run.tolerance,
      froude: r.froude, critical_depth: r.criticalDepth, specific_energy: r.specificEnergy,
      flow_regime: r.flowRegime, results: r,
    }, { onConflict: 'user_id,request_id', ignoreDuplicates: true }).select(fields).maybeSingle();
    if (error) return reply({ error: 'Could not save this run. Please retry.' }, 503);
    if (!data) {
      const { data: existing, error: readError } = await db.from('simulation_runs').select(fields).eq('user_id', userId).eq('request_id', run.request_id).single();
      if (readError) return reply({ error: 'Could not confirm the saved run.' }, 503);
      return reply({ run: existing });
    }
    return reply({ run: data }, 201);
  } catch { return reply({ error: 'Could not save this run. Check the service configuration.' }, 503); }
}
