import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { saveSnapshot } from '@/lib/storage/snapshot';
import type { DataSnapshot } from '@/lib/domain/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/upload
 *
 * El cliente (panel admin) parsea el CSV de Blip y el XLSX de Admin
 * directamente en el browser y envía aquí el snapshot resultante en JSON
 * (≈ 13 KB en lugar de 25 MB). Esto evita el límite de 4.5 MB por request
 * que Vercel Hobby aplica a las API routes.
 *
 * Esta ruta solo:
 *   1. Valida que el usuario sea admin
 *   2. Hace una validación mínima del shape del snapshot
 *   3. Lo persiste vía Vercel Blob (o filesystem en local)
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (session.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo el rol admin puede publicar snapshots.' }, { status: 403 });
  }

  let body: { snapshot?: DataSnapshot };
  try { body = await req.json(); }
  catch {
    return NextResponse.json({ error: 'Body inválido — se esperaba JSON con { snapshot }.' }, { status: 400 });
  }

  const snap = body.snapshot;
  if (!snap || snap.version !== 1 || !snap.meta || !snap.agentes) {
    return NextResponse.json({ error: 'Snapshot con formato inválido.' }, { status: 400 });
  }
  if (!Array.isArray(snap.meta.meses) || snap.meta.meses.length === 0) {
    return NextResponse.json({ error: 'Snapshot sin meses procesados.' }, { status: 400 });
  }

  // Sello del autor del lado server (para que no pueda falsearlo el cliente)
  snap.meta.generadoPor = session.display ?? session.rol;
  snap.meta.generadoEn = new Date().toISOString();

  try {
    await saveSnapshot(snap);
    return NextResponse.json({
      ok: true,
      meta: snap.meta,
    });
  } catch (err: any) {
    console.error('[upload] error guardando snapshot:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Error al guardar el snapshot.' },
      { status: 500 },
    );
  }
}
