import { auth } from '@clerk/nextjs/server';
import Simulator from '@/components/Simulator';
export default async function Page() {
  await auth.protect();
  return <Simulator />;
}
