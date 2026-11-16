import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminUser } from './admin';
/** Call on every request BEFORE constructing a privileged client or reading data. */
export async function adminIdentity() {
  const { userId } = await auth();
  return { userId, allowed: isAdminUser(userId) };
}
export function createAdminDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Admin database is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
