// ============================================================
// Persistencia de la configuración de comisiones (base + tramos)
// ============================================================

import { promises as fs } from 'fs';
import path from 'path';
import { DEFAULT_CONFIG } from '@/lib/domain/types';
import type { ComisionConfig } from '@/lib/domain/types';

const KEY = 'config.json';
const LOCAL_PATH = path.join(process.cwd(), 'data', KEY);
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

/**
 * Migración del config persistido al esquema vigente. Detecta esquemas
 * previos y los reemplaza con los defaults actuales:
 *
 *   1. Pre-mayo 2026 (v1): AE manejaba multiplicador, % manejaba bono.
 *      Señal: ningún tramo de pilar1 tiene mul=0.
 *
 *   2. Mayo 2026 (v2): tramos 5% / 6% / 7.6% / 9%.
 *      Junio 2026 (v3, vigente): tramos 7% / 9% / 11% / 13% / 15%.
 *      Señal: hay un tramo con min===5.
 *
 *   3. Luz todo-o-nada (legacy): luzEsquema sin array `tramos`.
 *      Junio 2026: luzEsquema con `tramos` escalonados.
 *
 * La migración reemplaza pilar1/pilar2/luzEsquema con los defaults actuales
 * y preserva baseSol, comisiones viejas y tags SAE.
 */
function migrarSiNecesario(cfg: ComisionConfig): ComisionConfig {
  let out = cfg;

  const noTieneMulCero =
    !Array.isArray(cfg.pilar1) || !cfg.pilar1.some(t => t && t.mul === 0);
  const tieneTramoMin5 =
    Array.isArray(cfg.pilar1) && cfg.pilar1.some(t => t && t.min === 5);
  if (noTieneMulCero || tieneTramoMin5) {
    out = { ...out, pilar1: DEFAULT_CONFIG.pilar1, pilar2: DEFAULT_CONFIG.pilar2 };
  }

  const luzLegacy =
    !cfg.luzEsquema ||
    !Array.isArray(cfg.luzEsquema.tramos) ||
    cfg.luzEsquema.tramos.length === 0;
  if (luzLegacy) {
    out = { ...out, luzEsquema: DEFAULT_CONFIG.luzEsquema };
  }

  return out;
}

export async function loadConfig(): Promise<ComisionConfig> {
  if (useBlob()) {
    try {
      const { list } = await import('@vercel/blob');
      const res = await list({ prefix: KEY, token: process.env.BLOB_READ_WRITE_TOKEN });
      const blob = res.blobs.find(b => b.pathname === KEY);
      if (!blob) return DEFAULT_CONFIG;
      const r = await fetch(blob.url, { cache: 'no-store' });
      if (!r.ok) return DEFAULT_CONFIG;
      const raw = (await r.json()) as ComisionConfig;
      const migrated = migrarSiNecesario(raw);
      // Si hubo migración, persistimos para que la próxima lectura sea directa
      if (migrated !== raw) {
        try { await saveConfig(migrated); } catch { /* no bloqueamos lectura por fallo de save */ }
      }
      return migrated;
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  try {
    const raw = JSON.parse(await fs.readFile(LOCAL_PATH, 'utf-8')) as ComisionConfig;
    const migrated = migrarSiNecesario(raw);
    if (migrated !== raw) {
      try { await saveConfig(migrated); } catch { /* idem */ }
    }
    return migrated;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(cfg: ComisionConfig): Promise<void> {
  const json = JSON.stringify(cfg, null, 2);
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    await put(KEY, json, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }
  await fs.mkdir(path.dirname(LOCAL_PATH), { recursive: true });
  await fs.writeFile(LOCAL_PATH, json, 'utf-8');
}
