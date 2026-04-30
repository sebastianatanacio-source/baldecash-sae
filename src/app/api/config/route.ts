import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { loadConfig, saveConfig } from '@/lib/storage/config';
import type { ComisionConfig } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session.rol) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  const cfg = await loadConfig();
  return NextResponse.json({ config: cfg });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (session.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo el rol admin puede modificar la configuración.' }, { status: 403 });
  }

  let body: { config?: ComisionConfig };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body inválido.' }, { status: 400 }); }

  const cfg = body.config;
  if (!cfg || typeof cfg.baseSol !== 'number' || !Array.isArray(cfg.pilar1) || !Array.isArray(cfg.pilar2)) {
    return NextResponse.json({ error: 'Configuración con formato inválido.' }, { status: 400 });
  }
  if (cfg.baseSol < 0 || cfg.baseSol > 50000) {
    return NextResponse.json({ error: 'La base mensual debe estar entre 0 y 50,000.' }, { status: 400 });
  }
  if (cfg.pilar1.some(t => t.min < 0 || t.mul < 0)) {
    return NextResponse.json({ error: 'Tramos del Pilar 1 con valores no válidos.' }, { status: 400 });
  }
  if (cfg.pilar2.some(t => t.min < 0 || t.bono < 0)) {
    return NextResponse.json({ error: 'Tramos del Pilar 2 con valores no válidos.' }, { status: 400 });
  }

  await saveConfig(cfg);
  return NextResponse.json({ ok: true, config: cfg });
}
