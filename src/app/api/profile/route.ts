import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { syncProfile } from '@/lib/profile-server';
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({error:'Sign in first.'},{status:401});
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({error:'Invalid request origin.'},{status:403});
  try { await syncProfile(userId); return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}}); }
  catch { return NextResponse.json({error:'Could not sync your profile. Check the database setup.'},{status:503}); }
}
