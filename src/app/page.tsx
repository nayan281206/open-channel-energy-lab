import { auth } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import Simulator from '@/components/Simulator';
export default async function Page() {
  const { userId } = await auth.protect();
  return <Simulator isAdmin={isAdminUser(userId)} />;
}
