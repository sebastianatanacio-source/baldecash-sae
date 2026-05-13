// Utilidades comunes para combinar métricas y formatear

import { esBlipOnly } from './agentes';
import type { AgenteSlug, ComisionConfig, DataSnapshot, MesKey, MetricasMes, TramoP1, TramoP2 } from './types';

export function nf(n: number, decimals = 0): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function pct(n: number, decimals = 1): string {
  return `${nf(n, decimals)}%`;
}

const VACIO: MetricasMes = {
  aten: 0, deja: 0, pctDeja: 0,
  sol: 0, aeCup: 0, aePre: 0, aeTot: 0, pctSol: 0,
  qtAvg: 0, frtAvg: 0, artAvg: 0, frtMedianaSeg: 0,
  canales: { whatsapp: 0, facebook: 0, otro: 0 },
  tags: [],
  cerradas: 0, solucionadas: 0, noContesta: 0, transferidas: 0, pctResolucion: 0,
};

/** Suma simple por clave numérica */
function add<T extends Record<string, any>>(acc: T, m: T, keys: (keyof T)[]) {
  for (const k of keys) (acc as any)[k] = (acc[k] ?? 0) + (m[k] ?? 0);
}

/** Combina N métricas mensuales en una sola consolidada (con %s recalculados) */
export function combinarMetricas(metricas: MetricasMes[]): MetricasMes {
  if (metricas.length === 0) return { ...VACIO, canales: { ...VACIO.canales }, tags: [] };
  if (metricas.length === 1) return metricas[0];

  const out: MetricasMes = {
    ...VACIO,
    canales: { whatsapp: 0, facebook: 0, otro: 0 },
    tags: [],
  };
  const tagAcc = new Map<string, number>();
  let qtSumW = 0, qtN = 0;
  let frtSumW = 0, frtN = 0;
  let artSumW = 0, artN = 0;
  let frtMedSumW = 0, frtMedN = 0;

  for (const m of metricas) {
    add(out, m, ['aten', 'deja', 'sol', 'aeCup', 'aePre', 'aeTot',
      'cerradas', 'solucionadas', 'noContesta', 'transferidas']);
    out.canales.whatsapp += m.canales.whatsapp;
    out.canales.facebook += m.canales.facebook;
    out.canales.otro     += m.canales.otro;
    for (const t of m.tags) tagAcc.set(t.tag, (tagAcc.get(t.tag) ?? 0) + t.n);
    // promedios ponderados por # atenciones
    if (m.qtAvg > 0)  { qtSumW  += m.qtAvg  * m.aten; qtN  += m.aten; }
    if (m.frtAvg > 0) { frtSumW += m.frtAvg * m.aten; frtN += m.aten; }
    if (m.artAvg > 0) { artSumW += m.artAvg * m.aten; artN += m.aten; }
    if (m.frtMedianaSeg > 0) { frtMedSumW += m.frtMedianaSeg * m.aten; frtMedN += m.aten; }
  }
  // Desde mayo 2026 las transferidas no entran al universo: denominador = cerradas
  out.pctDeja = out.cerradas > 0 ? +(out.deja / out.cerradas * 100).toFixed(1) : 0;
  out.pctSol  = out.cerradas > 0 ? +(out.sol  / out.cerradas * 100).toFixed(1) : 0;
  out.qtAvg  = qtN  > 0 ? +(qtSumW  / qtN ).toFixed(2) : 0;
  out.frtAvg = frtN > 0 ? +(frtSumW / frtN).toFixed(2) : 0;
  out.artAvg = artN > 0 ? +(artSumW / artN).toFixed(2) : 0;
  out.frtMedianaSeg = frtMedN > 0 ? +(frtMedSumW / frtMedN).toFixed(1) : 0;
  // % Resolución sobre contestadas (cerradas - noContesta)
  const contestadas = Math.max(0, out.cerradas - out.noContesta);
  out.pctResolucion = contestadas > 0 ? +(out.solucionadas / contestadas * 100).toFixed(1) : 0;
  out.tags = [...tagAcc.entries()].sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }));
  return out;
}

/** Devuelve la métrica de un agente para un mes específico, o totalizada si mes='all' */
export function metricasAgente(snap: DataSnapshot, slug: string, mes: MesKey | 'all'): MetricasMes {
  const ag = snap.agentes[slug as keyof typeof snap.agentes];
  if (!ag) return { ...VACIO, canales: { ...VACIO.canales }, tags: [] };
  if (mes === 'all') {
    const arr = Object.values(ag.meses).filter(Boolean) as MetricasMes[];
    return combinarMetricas(arr);
  }
  return ag.meses[mes] ?? { ...VACIO, canales: { ...VACIO.canales }, tags: [] };
}

/** Métrica consolidada del equipo entero por mes */
export function metricasEquipo(snap: DataSnapshot, mes: MesKey | 'all'): MetricasMes {
  const arr: MetricasMes[] = [];
  for (const ag of Object.values(snap.agentes)) {
    if (!ag) continue;
    if (mes === 'all') {
      for (const m of Object.values(ag.meses)) if (m) arr.push(m);
    } else if (ag.meses[mes]) {
      arr.push(ag.meses[mes]!);
    }
  }
  return combinarMetricas(arr);
}

/** Mes más reciente con datos (o null si no hay). */
export function mesActual(snap: DataSnapshot): MesKey | null {
  return snap.meta.meses.length > 0 ? snap.meta.meses[snap.meta.meses.length - 1] : null;
}

/** Días totales del mes (para 2026, fijo). */
const DIAS_MES_2026: Record<string, number> = {
  ene: 31, feb: 28, mar: 31, abr: 30, may: 31, jun: 30,
  jul: 31, ago: 31, sep: 30, oct: 31, nov: 30, dic: 31,
};
export function diasTotalesDelMes(mes: MesKey): number {
  return DIAS_MES_2026[mes] ?? 30;
}

/** Días con actividad real (atenciones > 0) registrados en el mes. */
export function diasTrabajados(snap: DataSnapshot, slug: string, mes: MesKey): number {
  const ag = snap.agentes[slug as keyof typeof snap.agentes];
  if (!ag) return 0;
  const dia = ag.diario[mes] ?? [];
  return dia.filter(d => d.aten > 0).length;
}

/** Último día con datos en el mes (formato DD-MM). */
export function ultimoDiaConDatos(snap: DataSnapshot, slug: string, mes: MesKey): string | null {
  const ag = snap.agentes[slug as keyof typeof snap.agentes];
  if (!ag) return null;
  const dia = ag.diario[mes] ?? [];
  const concant = dia.filter(d => d.aten > 0 || d.ae > 0 || d.deja > 0);
  return concant.length > 0 ? concant[concant.length - 1].day : null;
}

/** Proyección lineal a fin de mes basada en ritmo actual. */
export function proyectarFinDeMes(
  actual: number, diasUsados: number, diasTotales: number,
): number {
  if (diasUsados <= 0) return 0;
  return Math.round((actual / diasUsados) * diasTotales);
}

/**
 * Solicitudes adicionales que se necesitan para alcanzar un porcentaje
 * objetivo de Sol/Aten, manteniendo las atenciones constantes.
 */
export function solicitudesParaPct(solActual: number, atenActual: number, pctObjetivo: number): number {
  if (atenActual <= 0) return 0;
  const necesarias = Math.ceil((pctObjetivo / 100) * atenActual);
  return Math.max(0, necesarias - solActual);
}

/**
 * Devuelve los tramos del Pilar 1. Luz no usa este sistema (tiene esquema
 * todo-o-nada), así que para ella devolvemos los tramos generales como
 * fallback informativo.
 */
export function tramosP1Para(_slug: AgenteSlug, cfg: ComisionConfig): TramoP1[] {
  return cfg.pilar1;
}

export function tramosP2Para(_slug: AgenteSlug, cfg: ComisionConfig): TramoP2[] {
  return cfg.pilar2;
}

export function basePara(_slug: AgenteSlug, cfg: ComisionConfig): number {
  return cfg.baseSol;
}

/**
 * Métricas equivalentes a los dos pilares de comisión según el agente.
 *
 * Esquema vigente desde mayo 2026 (Fernanda/Stefania/Julio):
 *   - Pilar 1 = % Sol / Cerradas (la eficiencia maneja el multiplicador)
 *   - Pilar 2 = AE del mes (volumen entrega bono fijo)
 *   - Las transferidas no entran al universo del Pilar 1.
 *
 * Para Luz mantiene el esquema todo-o-nada:
 *   - Pilar 1 = consultas solucionadas (count, informativo)
 *   - Pilar 2 = tasa de resolución (la métrica que cobra)
 */
export function metricasMeta(slug: AgenteSlug, m: MetricasMes): {
  /** Valor del Pilar 1 (%Sol para no-Luz, count solucionadas para Luz) */
  pilar1Valor: number;
  pilar1Label: string;
  pilar1Plural: string;
  pilar1Numerador: number;
  pilar1Denominador: number;
  pilar1NumeradorLabel: string;
  /** true si pilar1 es un ratio (%) — útil para formato y "necesitas X más" */
  pilar1EsRatio: boolean;

  pilar2Valor: number;
  pilar2Label: string;
  pilar2Plural: string;
  pilar2Numerador: number;
  pilar2Denominador: number;
  pilar2NumeradorLabel: string;
  pilar2EsRatio: boolean;
} {
  if (esBlipOnly(slug)) {
    // Luz: Pilar 1 = consultas solucionadas (universo unificado),
    //      Pilar 2 = % resolución sobre contestadas (la métrica que cobra)
    const contestadas = Math.max(0, m.cerradas - m.noContesta);
    return {
      pilar1Valor: m.solucionadas,
      pilar1Label: 'consultas solucionadas',
      pilar1Plural: 'consultas solucionadas',
      pilar1Numerador: m.solucionadas,
      pilar1Denominador: 0,
      pilar1NumeradorLabel: 'solucionadas',
      pilar1EsRatio: false,

      pilar2Valor: m.pctResolucion,
      pilar2Label: '% Resolución sobre contestadas',
      pilar2Plural: 'puntos de resolución',
      pilar2Numerador: m.solucionadas,
      pilar2Denominador: contestadas,
      pilar2NumeradorLabel: 'consultas resueltas',
      pilar2EsRatio: true,
    };
  }
  // Esquema general (Fernanda, Stefania, Julio) desde mayo 2026:
  // Pilar 1 = % Sol / Cerradas (eficiencia → multiplicador)
  // Pilar 2 = AE del mes      (volumen → bono fijo)
  return {
    pilar1Valor: m.pctSol,
    pilar1Label: '% Solicitudes / Cerradas',
    pilar1Plural: 'puntos de conversión',
    pilar1Numerador: m.sol,
    pilar1Denominador: m.cerradas,
    pilar1NumeradorLabel: 'solicitudes',
    pilar1EsRatio: true,

    pilar2Valor: m.aeTot,
    pilar2Label: 'AE del mes · bono fijo',
    pilar2Plural: 'aprobadas-entregadas',
    pilar2Numerador: m.aeTot,
    pilar2Denominador: 0,
    pilar2NumeradorLabel: 'AE',
    pilar2EsRatio: false,
  };
}

// ============================================================
// Universo SAE configurable por admin (tipificaciones de Luz)
// ============================================================

import { normalizar } from '@/lib/parser/blip';

/** Set por defecto — debe coincidir con TAGS_SOLUCIONADAS del parser. */
export const TAGS_SOLUCIONADAS_DEFAULT = [
  'consulta solucionada',
  'desbloqueo de equipos',
  'derivado a otra area',
  'desbloqueo equipos',
  'desbloqueo celular',
  'consultas zona estudiante',
  'consultas admin',
  'derivado a soporte t.',
  'derivado a cobranzas',
  'consultas logistica',
  'quejas/reclamos',
  'derivado a soporte tecnico',
  'desbloqueo equipo',
  'desbloqueo cel.',
];

export const TAGS_NO_CONTESTA_DEFAULT = [
  'no contesta',
  'no contesta mensaje del asesor',
  'cliente no contesta',
  'consulta no respondida',
  'ticket cerrado por inactividad',
  'no es estudiante',
  'no quiere que lo vuelvan a contactar',
  'numero de empresa',
];

export interface MetricasLuzEfectivas {
  solucionadas: number;
  cerradas: number;
  noContesta: number;
  contestadas: number;
  pctResolucion: number;
  setSolucionadas: Set<string>;
  setNoContesta: Set<string>;
  incluyeTransferencias: boolean;
}

/**
 * Recalcula las métricas de Luz aplicando la configuración del admin
 * (override del universo de tipificaciones y manejo de transferencias).
 *
 * Reclasifica los tags presentes en m.tags contra los sets configurables.
 */
export function metricasLuzEfectivas(
  m: { tags: Array<{ tag: string; n: number }>; cerradas: number; transferidas: number },
  cfg: import('./types').ComisionConfig,
): MetricasLuzEfectivas {
  const setSolu = new Set(cfg.tagsLuzSolucionadas ?? TAGS_SOLUCIONADAS_DEFAULT);
  const setNo = new Set(cfg.tagsLuzNoContesta ?? TAGS_NO_CONTESTA_DEFAULT);
  const incluyeTransferencias = cfg.incluirTransferenciasLuz ?? false;

  let solucionadas = 0;
  let noContesta = 0;
  for (const t of m.tags) {
    const n = normalizar(t.tag);
    if (setSolu.has(n)) solucionadas += t.n;
    if (setNo.has(n))   noContesta   += t.n;
  }

  // Por defecto las transferencias quedan fuera del universo (regla SAE).
  // Si el admin elige incluirlas, se suman a cerradas.
  const cerradas = incluyeTransferencias ? m.cerradas + m.transferidas : m.cerradas;
  const contestadas = Math.max(0, cerradas - noContesta);
  const pctResolucion = contestadas > 0 ? +(solucionadas / contestadas * 100).toFixed(1) : 0;

  return {
    solucionadas, cerradas, noContesta, contestadas, pctResolucion,
    setSolucionadas: setSolu, setNoContesta: setNo,
    incluyeTransferencias,
  };
}

/** Etiqueta corta de fecha de actualización */
export function fechaCorta(iso?: string): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${dt.getDate()} ${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}
