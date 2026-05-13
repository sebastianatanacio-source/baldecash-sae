import { esBlipOnly } from './agentes';
import type { AgenteSlug, ComisionConfig, MetricasMes, TramoP1, TramoP2 } from './types';

// ============================================================
// Esquema vigente desde mayo 2026 (Fernanda, Stefania, Julio):
//
//   Pilar 1 = comisión base (S/ 1,100) × multiplicador del % Sol/Cerradas
//   Pilar 2 = bono fijo por cantidad de AE del mes
//   Transferidas no entran al denominador del Pilar 1 (regla SAE).
//   Guardrail: los tramos 1.50× y 2.00× requieren piso mínimo de
//   atenciones (campo TramoP1.pisoAten) para activarse.
// ============================================================

export interface CalculoComision {
  baseSol: number;
  pilar1: { tramo: TramoP1; aplicado: number; capadoPorGuardrail?: boolean };
  pilar2: { tramo: TramoP2; aplicado: number };
  total: number;
}

/**
 * Encuentra el tramo de Pilar 1 que corresponde al % Sol del agente,
 * aplicando el guardrail de piso de atenciones si está definido en el
 * tramo. Si `atenForGuardrail` no se pasa, se ignora el piso (modo legacy).
 */
export function tramoP1(
  pctSol: number,
  tramos: TramoP1[],
  atenForGuardrail?: number,
): TramoP1 {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  let actual = ordenados[0];
  for (const t of ordenados) {
    if (pctSol < t.min) break;
    // Guardrail: si el tramo requiere un piso mínimo de atenciones y la
    // agente no llega, se queda en el tramo anterior alcanzable.
    if (
      atenForGuardrail !== undefined &&
      t.pisoAten !== undefined &&
      atenForGuardrail < t.pisoAten
    ) {
      break;
    }
    actual = t;
  }
  return actual;
}

export function tramoP2(aeTot: number, tramos: TramoP2[]): TramoP2 {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  let actual = ordenados[0];
  for (const t of ordenados) if (aeTot >= t.min) actual = t;
  return actual;
}

/** Próximo tramo del Pilar 1 que el asesor aún no alcanza, o null si ya está en el máximo. */
export function proximoTramoP1(pctSol: number, tramos: TramoP1[]): TramoP1 | null {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  return ordenados.find(t => t.min > pctSol) ?? null;
}

/** Próximo tramo del Pilar 2. */
export function proximoTramoP2(aeTot: number, tramos: TramoP2[]): TramoP2 | null {
  const ordenados = [...tramos].sort((a, b) => a.min - b.min);
  return ordenados.find(t => t.min > aeTot) ?? null;
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

/**
 * Cálculo de comisión estándar (Fernanda/Stefania/Julio):
 *   Pilar 1: pctSol → multiplicador sobre baseSol
 *   Pilar 2: aeTot → bono fijo
 *
 * @param pctSol Tasa de conversión Sol / Cerradas (%)
 * @param aeTot Aprobadas-entregadas del mes
 * @param cfg Configuración con tramos y baseSol
 * @param atenForGuardrail Atenciones del mes (incl. transferidas). Si se pasa,
 *        activa el guardrail anti-gaming: tramos con pisoAten requieren ese mínimo.
 */
export function calcularComision(
  pctSol: number,
  aeTot: number,
  cfg: ComisionConfig,
  atenForGuardrail?: number,
): CalculoComision {
  const t1Reach = tramoP1(pctSol, cfg.pilar1, atenForGuardrail);
  const t1NoGuard = tramoP1(pctSol, cfg.pilar1);
  const t2 = tramoP2(aeTot, cfg.pilar2);
  const aplicadoP1 = Math.round(cfg.baseSol * t1Reach.mul);
  const aplicadoP2 = t2.bono;
  return {
    baseSol: cfg.baseSol,
    pilar1: {
      tramo: t1Reach,
      aplicado: aplicadoP1,
      capadoPorGuardrail: t1Reach.min < t1NoGuard.min,
    },
    pilar2: { tramo: t2, aplicado: aplicadoP2 },
    total: aplicadoP1 + aplicadoP2,
  };
}

/**
 * Esquema simple de Luz: si su tasa de resolución (% solucionadas
 * sobre contestadas) alcanza el umbral, comisiona el bono fijo.
 * Sin pilares, sin multiplicadores, sin escalones.
 */
export interface CalculoLuz {
  umbralPct: number;
  bono: number;
  pctResolucion: number;
  cumple: boolean;
  total: number;
}

export function calcularComisionLuz(pctResolucion: number, cfg: ComisionConfig): CalculoLuz {
  const umbralPct = cfg.luzEsquema?.umbralPct ?? 60;
  const bono = cfg.luzEsquema?.bono ?? 300;
  const cumple = pctResolucion >= umbralPct;
  return {
    umbralPct,
    bono,
    pctResolucion,
    cumple,
    total: cumple ? bono : 0,
  };
}

/**
 * Cálculo de comisión por agente. Para Luz devuelve un CalculoLuz simple;
 * para el resto, el cálculo de pilares estándar.
 *
 * @param pilar1Valor Para no-Luz: % Sol/Cerradas. Para Luz: se ignora.
 * @param pilar2Valor Para no-Luz: AE del mes. Para Luz: tasa de resolución.
 * @param atenForGuardrail Atenciones del mes (no-Luz) para activar guardrail.
 */
export function calcularComisionPorAgente(
  slug: AgenteSlug,
  pilar1Valor: number,
  pilar2Valor: number,
  cfg: ComisionConfig,
  atenForGuardrail?: number,
): CalculoComision {
  if (esBlipOnly(slug)) {
    // Para Luz, "pilar1Valor" se ignora; "pilar2Valor" es la tasa de resolución
    const luz = calcularComisionLuz(pilar2Valor, cfg);
    // Adaptamos al shape CalculoComision para no romper consumidores
    return {
      baseSol: 0,
      pilar1: {
        tramo: { min: 0, mul: 0, label: 'No aplica para Luz' },
        aplicado: 0,
      },
      pilar2: {
        tramo: {
          min: luz.umbralPct,
          bono: luz.bono,
          label: luz.cumple ? `≥ ${luz.umbralPct}% · cobra ${luz.bono}` : `< ${luz.umbralPct}% · no cobra`,
        },
        aplicado: luz.total,
      },
      total: luz.total,
    };
  }

  return calcularComision(pilar1Valor, pilar2Valor, cfg, atenForGuardrail);
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
