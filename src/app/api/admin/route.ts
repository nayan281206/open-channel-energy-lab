import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminIdentity, createAdminDatabase } from '@/lib/admin-server';
import { adminPage } from '@/lib/admin';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
export async function GET(request: NextRequest) {
  const identity = await adminIdentity();
  if (!identity.userId) return reply({ error: 'Sign in first.' }, 401);
  if (!identity.allowed) return reply({ error: 'Admin access required.' }, 403);
  try {
    const db = createAdminDatabase();
    const page = adminPage(request.nextUrl.searchParams.get('page'));
    const view = request.nextUrl.searchParams.get('view') ?? 'users';
    if (view === 'runs') {
      const userId = request.nextUrl.searchParams.get('userId');
      let query = db.from('simulation_runs').select('*', { count: 'exact' });
      if (userId) query = query.eq('user_id', userId);
      const { data, count, error } = await query.order('created_at', { ascending: false }).order('id').range((page - 1) * 25, page * 25 - 1);
      if (error) throw error;
      return reply({ runs: data, total: count, page, pageSize: 25 });
    }
    if (view !== 'users') return reply({ error: 'Unknown view.' }, 400);
    const clerk = await clerkClient();
    const search = request.nextUrl.searchParams.get('search')?.trim().slice(0, 200);
    const users = await clerk.users.getUserList({ limit: 25, offset: (page - 1) * 25, orderBy: '-created_at', ...(search ? { query: search } : {}) });
    const ids = users.data.map(u => u.id);
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    const [profiles, runs, recentRuns, totalUsers] = await Promise.all([
      ids.length ? db.from('user_profiles').select('*,simulation_runs(count)').in('clerk_user_id', ids) : Promise.resolve({ data: [], error: null }),
      db.from('simulation_runs').select('id', { head: true, count: 'exact' }),
      db.from('simulation_runs').select('id', { head: true, count: 'exact' }).gte('created_at', week),
      search ? clerk.users.getCount() : Promise.resolve(users.totalCount),
    ]);
    if (profiles.error || runs.error || recentRuns.error) throw new Error('Database query failed.');
    return reply({
      users: users.data.map(u => ({
        id: u.id, name: u.fullName ?? u.username, username: u.username,
        email: u.primaryEmailAddress?.emailAddress ?? null,
        emails: u.emailAddresses.map(e => ({ email: e.emailAddress, verified: e.verification?.status === 'verified' })),
        phones: u.phoneNumbers.map(p => ({ number: p.phoneNumber, verified: p.verification?.status === 'verified' })),
        joined: u.createdAt, lastSignIn: u.lastSignInAt, lastActive: u.lastActiveAt,
        banned: u.banned, locked: u.locked, twoFactorEnabled: u.twoFactorEnabled,
        providers: u.externalAccounts.map(a => a.provider),
        profile: profiles.data?.find(p => p.clerk_user_id === u.id) ?? null,
      })),
      total: users.totalCount, page, pageSize: 25,
      stats: { users: totalUsers, runs: runs.count ?? 0, recentRuns: recentRuns.count ?? 0 },
      refreshedAt: new Date().toISOString(),
    });
  } catch {
    return reply({ error: 'Could not load admin data. Check the server Clerk key, Supabase secret key and database schema.' }, 503);
  }
}
