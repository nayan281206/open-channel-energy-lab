import 'server-only';
import { currentUser } from '@clerk/nextjs/server';
import { createServerSupabase } from './supabase-server';
/** Refresh from Clerk, never from untrusted browser identity fields. */
export async function syncProfile(userId: string) {
  const user = await currentUser();
  if (!user || user.id !== userId) throw new Error('Not signed in.');
  const db = createServerSupabase();
  const { error } = await db.from('user_profiles').upsert({
    clerk_user_id: userId, email: user.primaryEmailAddress?.emailAddress ?? null,
    name: user.fullName ?? user.username ?? null, updated_at: new Date().toISOString(),
  }, { onConflict: 'clerk_user_id' });
  if (error) throw new Error('Could not save profile.');
}
