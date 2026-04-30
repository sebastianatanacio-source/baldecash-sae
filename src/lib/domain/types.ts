// ============================================================
// Tipos de dominio — BaldeCash SAE
// ============================================================
// Estructuras compartidas entre parser, API, persistencia y UI.

export type AgenteSlug = 'fernanda' | 'stefania' | 'julio' | 'luz';
export type MesKey = 'feb' | 'mar' | 'abr' | 'may' | 'jun' | 'jul' | 'ago' | 'sep' | 'oct' | 'nov' | 'dic' | 'ene';

export interface MetricasMes {
  /** Atenciones totales en Blip */
  aten: number;
  /** Conversaciones tipificadas como "Deja solicitud" */
  deja: number;
  /** % Deja-solicitud sobre atenciones totales */
  pctDeja: number;

  /** Solicitudes ingresadas atribuidas por cupón propio */
  sol: number;
  /** AE atribuidas por cupón */
  aeCup: number;
  /** AE atribuidas por preowner (sin cupón propio) */
  aePre: number;
  /** Total AE — usado en Pilar 1 */
  aeTot: number;
  /** % Sol/Aten — usado en Pilar 2 */
  pctSol: number;

  // ============== Métricas operativas (Blip) ==============
  /** Tiempo de cola promedio (min) */
  qtAvg: number;
  /** Tiempo de primera respuesta promedio (min) */
  frtAvg: number;
  /** Tiempo de respuesta entre mensajes (min) */
  artAvg: number;

  /** Distribución por canal: WhatsApp / Facebook / Otro */
  canales: { whatsapp: number; facebook: number; otro: number };
  /** Distribución por tag de cierre — top 8 (resto agregado en "otros") */
  tags: Array<{ tag: string; n: number }>;
}

export interface SerieDiariaPunto {
  /** Día en formato "DD-MM" */
  day: string;
  aten: number;
  deja: number;
  ae: number;
  /** Día de semana 0=Lun … 6=Dom */
  dow: number;
}

export interface DistribucionHora {
  /** Promedio de chats en cada hora del día (0–23) */
  hora: number[];
}

export interface AgenteData {
  slug: AgenteSlug;
  nombre: string;
  cupon: string;
  /** Iniciales para avatar */
  initials: string;
  meses: Partial<Record<MesKey, MetricasMes>>;
  diario: Partial<Record<MesKey, SerieDiariaPunto[]>>;
  /** Distribución horaria consolidada del rango procesado */
  horario?: DistribucionHora;
}

export interface SnapshotMeta {
  /** ISO timestamp del último procesamiento */
  generadoEn: string;
  /** Quién subió los archivos (email/slug) */
  generadoPor?: string;
  /** Nombre del archivo CSV de Blip */
  archivoBlip?: string;
  /** Nombre del archivo XLSX de Admin */
  archivoAdmin?: string;
  /** Rango de meses presentes en los datos */
  meses: MesKey[];
  /** Métricas globales para validación rápida */
  totales: { atenciones: number; solicitudes: number; ae: number };
}

export interface DataSnapshot {
  version: 1;
  meta: SnapshotMeta;
  agentes: Partial<Record<AgenteSlug, AgenteData>>;
}

// ============== Configuración de comisiones (Pilar 1 / Pilar 2) ==============

export interface TramoP1 {
  /** AE mínimo para entrar al tramo (inclusive) */
  min: number;
  /** Multiplicador sobre la base */
  mul: number;
  /** Etiqueta humana */
  label: string;
}

export interface TramoP2 {
  /** %Sol/Aten mínimo para entrar al tramo (inclusive) */
  min: number;
  /** Bono fijo en Soles */
  bono: number;
  /** Etiqueta humana */
  label: string;
}

export interface ComisionConfig {
  baseSol: number;
  pilar1: TramoP1[];
  pilar2: TramoP2[];
  /** Comisión antigua: S/ por AE con cupón propio */
  viejaCupon: number;
  /** Comisión antigua: S/ por AE con preowner */
  viejaPreowner: number;

  /**
   * Esquema específico para Luz (que no tiene atribución por cupón).
   * Sus métricas son Blip-only:
   *   Pilar 1 = cantidad de "Deja solicitud" del mes
   *   Pilar 2 = % Deja solicitud / Atenciones
   * Si están omitidos, se usa el esquema general (pilar1/pilar2).
   */
  pilarLuz1?: TramoP1[];
  pilarLuz2?: TramoP2[];
  /** Base mensual para Luz (si difiere). Por defecto usa baseSol. */
  baseLuzSol?: number;
}

export const DEFAULT_CONFIG: ComisionConfig = {
  baseSol: 1100,
  pilar1: [
    { min: 0,  mul: 1.0,  label: '1 – 29 AE' },
    { min: 30, mul: 1.25, label: '30 – 44 AE' },
    { min: 45, mul: 1.5,  label: '45 – 59 AE' },
    { min: 60, mul: 2.0,  label: '60+ AE' },
  ],
  pilar2: [
    { min: 0,  bono: 0,   label: 'Menos de 5%' },
    { min: 5,  bono: 100, label: '5% – 7.9%' },
    { min: 8,  bono: 300, label: '8% – 10.9%' },
    { min: 11, bono: 500, label: '11% o más' },
  ],
  pilarLuz1: [
    { min: 0,   mul: 1.0,  label: 'Menos de 100 Deja-sol.' },
    { min: 100, mul: 1.25, label: '100 – 149 Deja-sol.' },
    { min: 150, mul: 1.5,  label: '150 – 199 Deja-sol.' },
    { min: 200, mul: 2.0,  label: '200+ Deja-sol.' },
  ],
  pilarLuz2: [
    { min: 0,  bono: 0,   label: 'Menos de 8%' },
    { min: 8,  bono: 100, label: '8% – 9.9%' },
    { min: 10, bono: 300, label: '10% – 11.9%' },
    { min: 12, bono: 500, label: '12% o más' },
  ],
  viejaCupon: 20,
  viejaPreowner: 12,
};
