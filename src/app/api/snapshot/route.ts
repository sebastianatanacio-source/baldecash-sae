import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { loadSnapshot } from '@/lib/storage/snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.rol) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const snap = await loadSnapshot();
  if (!snap) {
    return NextResponse.json({ snapshot: null, message: 'Aún no se ha cargado información. Pide al admin que suba los archivos.' });
  }
  return NextResponse.json({ snapshot: snap });
}
