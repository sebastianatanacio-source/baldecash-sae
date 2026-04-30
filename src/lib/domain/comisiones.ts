import { esBlipOnly } from './agentes';
import type { AgenteSlug, ComisionConfig, MetricasMes, TramoP1, TramoP2 } from './types';

export interface CalculoComision {
  baseSol: number;
  pilar1: { tramo: TramoP1; aplicado: number };
  pilar2: { tramo: TramoP2; aplicado: number };
  total: number;
}

export function tramoP1(ae: number, tramos: TramoP1[]): TramoP1 {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  let actual = ordenados[0];
  for (const t of ordenados) if (ae >= t.min) actual = t;
  return actual;
}

export function tramoP2(pctSol: number, tramos: TramoP2[]): TramoP2 {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  let actual = ordenados[0];
  for (const t of ordenados) if (pctSol >= t.min) actual = t;
  return actual;
}

/** Próximo tramo del Pilar 1 que el asesor aún no alcanza, o null si ya está en el máximo. */
export function proximoTramoP1(ae: number, tramos: TramoP1[]): TramoP1 | null {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  return ordenados.find(t => t.min > ae) ?? null;
}

/** Próximo tramo del Pilar 2. */
export function proximoTramoP2(pctSol: number, tramos: TramoP2[]): TramoP2 | null {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  return ordenados.find(t => t.min > pctSol) ?? null;
}

/**
 * Progreso (0–100) entre el tramo actual y el siguiente.
 * Si ya está en el máximo, devuelve 100.
 */
export function progresoTramo(actual: number, tramoActual: { min: number }, tramoSiguiente: { min: number } | null): number {
  if (!tramoSiguiente) return 100;
  const span = tramoSiguiente.min - tramoActual.min;
  if (span <= 0) return 100;
  const avance = actual - tramoActual.min;
  return Math.max(0, Math.min(100, (avance / span) * 100));
}

export function calcularComision(
  ae: number,
  pctSol: number,
  cfg: ComisionConfig,
): CalculoComision {
  const t1 = tramoP1(ae, cfg.pilar1);
  const t2 = tramoP2(pctSol, cfg.pilar2);
  const aplicadoP1 = Math.round(cfg.baseSol * t1.mul);
  const aplicadoP2 = t2.bono;
  return {
    baseSol: cfg.baseSol,
    pilar1: { tramo: t1, aplicado: aplicadoP1 },
    pilar2: { tramo: t2, aplicado: aplicadoP2 },
    total: aplicadoP1 + aplicadoP2,
  };
}

/**
 * Cálculo de comisión por agente: usa el esquema correcto según
 * el slug (Luz tiene su propio set de tramos basado en Deja-sol).
 */
export function calcularComisionPorAgente(
  slug: AgenteSlug,
  pilar1Valor: number,
  pilar2Valor: number,
  cfg: ComisionConfig,
): CalculoComision {
  const blipOnly = esBlipOnly(slug);
  const tramos1 = blipOnly && cfg.pilarLuz1 ? cfg.pilarLuz1 : cfg.pilar1;
  const tramos2 = blipOnly && cfg.pilarLuz2 ? cfg.pilarLuz2 : cfg.pilar2;
  const base = blipOnly && cfg.baseLuzSol != null ? cfg.baseLuzSol : cfg.baseSol;

  const t1 = tramoP1(pilar1Valor, tramos1);
  const t2 = tramoP2(pilar2Valor, tramos2);
  const aplicadoP1 = Math.round(base * t1.mul);
  const aplicadoP2 = t2.bono;
  return {
    baseSol: base,
    pilar1: { tramo: t1, aplicado: aplicadoP1 },
    pilar2: { tramo: t2, aplicado: aplicadoP2 },
    total: aplicadoP1 + aplicadoP2,
  };
}

/** Comisión bajo el esquema antiguo: aeCup × S/X + aePre × S/Y. */
export function calcularVieja(m: Pick<MetricasMes, 'aeCup' | 'aePre'>, cfg: ComisionConfig): number {
  return m.aeCup * cfg.viejaCupon + m.aePre * cfg.viejaPreowner;
}

export function formatSol(n: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n).replace('PEN', 'S/');
}
