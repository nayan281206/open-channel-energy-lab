import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import AdminDashboard from '@/components/AdminDashboard';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const { userId } = await auth.protect();
  if (!isAdminUser(userId)) return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Admin access required</h1><p className="my-4 text-slate-400">This account cannot view user or usage data.</p><Link className="btn" href="/">Back to simulator</Link></main>;
  return <AdminDashboard />;
}
