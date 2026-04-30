// Carga compartida para todas las sub-rutas de /agente/[slug].
// Maneja sesión, validación de rol, y carga de snapshot+config.

import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { puedeVerAgente } from '@/lib/auth/users';
import { loadSnapshot } from '@/lib/storage/snapshot';
import { loadConfig } from '@/lib/storage/config';
import { AGENTES } from '@/lib/domain/agentes';
import type { AgenteSlug, ComisionConfig, DataSnapshot } from '@/lib/domain/types';

const VALIDOS: AgenteSlug[] = ['fernanda', 'stefania', 'julio', 'luz'];

export type AgenteLoaderResult =
  | { ok: true; snapshot: DataSnapshot; config: ComisionConfig; slug: AgenteSlug }
  | { ok: false; reason: 'no-data' | 'no-agent-data'; slug: AgenteSlug; rolPuedeCargar: boolean };

export async function loadAgenteContext(slugRaw: string): Promise<AgenteLoaderResult> {
  const session = await getSession();
  if (!session.rol) redirect('/login');
  if (!VALIDOS.includes(slugRaw as AgenteSlug)) notFound();
  const slug = slugRaw as AgenteSlug;
  if (!puedeVerAgente(session.rol, slug)) redirect('/resumen');

  const [snap, cfg] = await Promise.all([loadSnapshot(), loadConfig()]);
  const rolPuedeCargar = session.rol === 'admin';

  if (!snap) return { ok: false, reason: 'no-data', slug, rolPuedeCargar };
  const spec = AGENTES[slug];
  if (!snap.agentes[spec.slug]) return { ok: false, reason: 'no-agent-data', slug, rolPuedeCargar };

  return { ok: true, snapshot: snap, config: cfg, slug };
}
