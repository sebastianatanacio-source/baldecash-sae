import type { AgenteSlug } from './types';

/**
 * Catálogo de asesores activos. Una sola fuente de verdad para
 * cupones, nombres, colores y reglas de detección.
 */
export interface AgenteSpec {
  slug: AgenteSlug;
  nombre: string;
  initials: string;
  cupon: string;
  /** Texto exacto de Preowner en Admin */
  preowner: string;
  /** Patrones (regex case-insensitive) para detectar el agente en CSV de Blip */
  matchBlip: RegExp[];
  /** Color principal según paleta corporativa */
  color: string;
  /** Color soft de fondo */
  colorSoft: string;
  /** Email/usuario para login */
  username: string;
}

export const AGENTES: Record<AgenteSlug, AgenteSpec> = {
  fernanda: {
    slug: 'fernanda',
    nombre: 'Fernanda Ferrer',
    initials: 'FF',
    cupon: 'CC20253',
    preowner: 'Fernanda Ferrer',
    matchBlip: [/fernanda/i],
    color: '#00A29B',     // Aqua 600
    colorSoft: '#E0F1F3', // Aqua 100
    username: 'fernanda',
  },
  stefania: {
    slug: 'stefania',
    nombre: 'Stefania Mc Gregor',
    initials: 'SM',
    cupon: 'CC2024',
    preowner: 'Stefania Mc Gregor',
    matchBlip: [/stefania/i],
    color: '#D1A646',     // Gold 500
    colorSoft: '#FFF7E6', // Gold 100
    username: 'stefania',
  },
  julio: {
    slug: 'julio',
    nombre: 'Julio Vargas',
    initials: 'JV',
    cupon: '',
    preowner: '',
    matchBlip: [/julio/i],
    color: '#4453A0',     // Blue 400
    colorSoft: '#D6DCED', // Blue 100
    username: 'julio',
  },
  luz: {
    slug: 'luz',
    nombre: 'Luz Rojas',
    initials: 'LR',
    cupon: '',     // No tiene cupón propio
    preowner: '',  // Tampoco aparece como preowner en Admin
    matchBlip: [/luz/i],
    color: '#6873D7',     // Blue 300 (lavanda)
    colorSoft: '#D6DCED', // Blue 100
    username: 'luz',
  },
};

export const AGENTES_LIST: AgenteSpec[] = [
  AGENTES.fernanda, AGENTES.stefania, AGENTES.julio, AGENTES.luz,
];

/** Agentes que solo se actualizan con Blip (sin atribución por cupón en Admin). */
export const AGENTES_BLIP_ONLY = new Set<AgenteSlug>(['luz']);

/** ¿Este agente usa el esquema Blip-only (Deja-sol en lugar de AE)? */
export function esBlipOnly(slug: AgenteSlug): boolean {
  return AGENTES_BLIP_ONLY.has(slug);
}

/** Detecta el slug del agente a partir del campo AgentName del CSV de Blip. */
export function detectarAgente(agentName: string | null | undefined): AgenteSlug | null {
  if (!agentName) return null;
  const s = String(agentName).toLowerCase();
  for (const ag of AGENTES_LIST) {
    if (ag.matchBlip.some(rx => rx.test(s))) return ag.slug;
  }
  return null;
}

/** Detecta el slug del agente desde Cupón + Preowner del XLSX Admin. Devuelve criterio. */
export function detectarAgenteAdmin(
  cupon: string,
  preowner: string,
): { slug: AgenteSlug; via: 'cupon' | 'preowner' } | null {
  const cu = (cupon || '').trim();
  const pre = (preowner || '').trim();
  for (const ag of AGENTES_LIST) {
    if (ag.cupon && cu === ag.cupon) return { slug: ag.slug, via: 'cupon' };
  }
  for (const ag of AGENTES_LIST) {
    if (ag.preowner && pre === ag.preowner) return { slug: ag.slug, via: 'preowner' };
  }
  return null;
}
