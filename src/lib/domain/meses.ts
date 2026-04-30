import type { MesKey } from './types';

/** Mapa YYYY-MM → clave corta. Solo se procesan meses incluidos aquí. */
export const MES_MAP: Record<string, MesKey> = {
  '2026-01': 'ene', '2026-02': 'feb', '2026-03': 'mar', '2026-04': 'abr',
  '2026-05': 'may', '2026-06': 'jun', '2026-07': 'jul', '2026-08': 'ago',
  '2026-09': 'sep', '2026-10': 'oct', '2026-11': 'nov', '2026-12': 'dic',
};

/** Orden canónico de meses dentro del año fiscal SAE. */
export const MES_ORDEN: MesKey[] = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export const MES_LABEL: Record<MesKey, string> = {
  ene: 'Enero',  feb: 'Febrero', mar: 'Marzo',     abr: 'Abril',
  may: 'Mayo',   jun: 'Junio',   jul: 'Julio',     ago: 'Agosto',
  sep: 'Septiembre', oct: 'Octubre', nov: 'Noviembre', dic: 'Diciembre',
};

export const MES_LABEL_CORTO: Record<MesKey, string> = {
  ene: 'Ene', feb: 'Feb', mar: 'Mar', abr: 'Abr',
  may: 'May', jun: 'Jun', jul: 'Jul', ago: 'Ago',
  sep: 'Sep', oct: 'Oct', nov: 'Nov', dic: 'Dic',
};

export function ordenarMeses(meses: MesKey[]): MesKey[] {
  const set = new Set(meses);
  return MES_ORDEN.filter(m => set.has(m));
}
