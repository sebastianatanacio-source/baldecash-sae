// ============================================================
// Esquemas de comisión congelados por mes
// ============================================================
// Cada vez que cambia el esquema de comisiones, el esquema VIGENTE pasa
// a ser editable desde admin (vive en blob como config.json) y el esquema
// del mes(es) ya cerrados se congela acá para que las cifras pagadas no
// muten retroactivamente cuando cambien los tramos.
//
// Vigencia actual:
//   feb–may 2026 → ESQUEMA_MAY_2026 (Pilar 1 5%/6%/7.6%/9% + Luz todo-o-nada)
//   jun 2026 →     vive en config.json (editable), ver DEFAULT_CONFIG
// ============================================================

import type { ComisionConfig, MesKey, TramoP1, TramoP2 } from './types';

/**
 * Subconjunto del ComisionConfig que define las reglas de comisión propiamente
 * dichas (tramos y baseSol + esquema de Luz). El resto del config (comisiones
 * viejas, tags SAE, etc.) es global y no se versiona por mes.
 */
export interface EsquemaSnapshot {
  baseSol: number;
  pilar1: TramoP1[];
  pilar2: TramoP2[];
  luzEsquema?: ComisionConfig['luzEsquema'];
}

/**
 * Esquema vigente entre febrero y mayo de 2026.
 *   Pilar 1: 5% – 5.9% (1.0×) · 6% – 7.5% (1.25×) · 7.6% – 8.9% (1.5×, piso 1200 aten) · 9%+ (2.0×, piso 1800 aten)
 *   Pilar 2: 0-4 → 0 · 5-15 → 150 · 16-30 → 300 · 31-50 → 500 · 51-70 → 750 · 71+ → 1000
 *   Luz:     todo-o-nada (≥60% → 300)
 */
export const ESQUEMA_MAY_2026: EsquemaSnapshot = {
  baseSol: 1100,
  pilar1: [
    { min: 0,   mul: 0,    label: '0% – 4.9%' },
    { min: 5,   mul: 1.0,  label: '5% – 5.9%' },
    { min: 6,   mul: 1.25, label: '6% – 7.5%' },
    { min: 7.6, mul: 1.5,  label: '7.6% – 8.9%', pisoAten: 1200 },
    { min: 9,   mul: 2.0,  label: '9% o más',    pisoAten: 1800 },
  ],
  pilar2: [
    { min: 0,  bono: 0,    label: '0 – 4 AE' },
    { min: 5,  bono: 150,  label: '5 – 15 AE' },
    { min: 16, bono: 300,  label: '16 – 30 AE' },
    { min: 31, bono: 500,  label: '31 – 50 AE' },
    { min: 51, bono: 750,  label: '51 – 70 AE' },
    { min: 71, bono: 1000, label: '71+ AE' },
  ],
  luzEsquema: { umbralPct: 60, bono: 300 },
};

/**
 * Mapa de esquemas históricos congelados por mes. Si un mes no aparece acá,
 * se considera "vigente" y se usa el config editable (DEFAULT_CONFIG o el
 * persistido en blob).
 */
export const ESQUEMAS_HISTORICOS: Partial<Record<MesKey, EsquemaSnapshot>> = {
  feb: ESQUEMA_MAY_2026,
  mar: ESQUEMA_MAY_2026,
  abr: ESQUEMA_MAY_2026,
  may: ESQUEMA_MAY_2026,
};

/**
 * Devuelve el ComisionConfig que debe usarse para calcular comisión de un mes
 * específico. Si el mes está en ESQUEMAS_HISTORICOS, se reemplazan los tramos
 * y baseSol con los del esquema histórico (manteniendo el resto del config:
 * tags SAE, comisiones viejas, etc.). Si no, se devuelve el config vigente.
 */
export function cfgPorMes(cfg: ComisionConfig, mes: MesKey | undefined): ComisionConfig {
  if (!mes) return cfg;
  const hist = ESQUEMAS_HISTORICOS[mes];
  if (!hist) return cfg;
  return {
    ...cfg,
    baseSol: hist.baseSol,
    pilar1: hist.pilar1,
    pilar2: hist.pilar2,
    luzEsquema: hist.luzEsquema ?? cfg.luzEsquema,
  };
}

/** ¿El mes está bajo un esquema histórico congelado (no editable)? */
export function esMesHistorico(mes: MesKey | undefined): boolean {
  return !!mes && !!ESQUEMAS_HISTORICOS[mes];
}
