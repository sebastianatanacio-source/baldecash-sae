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
  /** FRT mediana en segundos — clave para el guardrail de Luz */
  frtMedianaSeg: number;

  /** Distribución por canal: WhatsApp / Facebook / Otro */
  canales: { whatsapp: number; facebook: number; otro: number };
  /** Distribución por tag de cierre — top 8 (resto agregado en "otros") */
  tags: Array<{ tag: string; n: number }>;

  // ============== Métricas específicas para SAE / Luz ==============
  /** Total de tickets cerrados por la agente (no transferidos) */
  cerradas: number;
  /** Conversaciones tipificadas con cualquier tag del universo "solucionadas" */
  solucionadas: number;
  /** Conversaciones tipificadas como "No contesta" o similares */
  noContesta: number;
  /** Conversaciones transferidas a otra cola (Status = Transferred) */
  transferidas: number;
  /** % Resolución sobre contestadas: solucionadas / (cerradas - noContesta) · 100 */
  pctResolucion: number;
}

export interface SerieDiariaPunto {
  /** Día en formato "DD-MM" */
  day: string;
  aten: number;
  deja: number;
  ae: number;
  /** Cerradas por la agente (no transferidas) */
  cerradas: number;
  /** Tipificaciones del universo "solucionadas" para SAE / Luz */
  solucionadas: number;
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
  /** %Sol/Cerradas mínimo para entrar al tramo (inclusive) — desde mayo 2026 */
  min: number;
  /** Multiplicador sobre la comisión base */
  mul: number;
  /** Etiqueta humana */
  label: string;
  /**
   * Piso de atenciones del mes para activar este tramo (guardrail anti-gaming).
   * Si está definido y la agente tiene menos atenciones que esto, no puede
   * acceder a este multiplicador y queda en el tramo anterior. Opcional.
   */
  pisoAten?: number;
}

export interface TramoP2 {
  /** AE mínimo del mes para entrar al tramo (inclusive) — desde mayo 2026 */
  min: number;
  /** Bono fijo en Soles */
  bono: number;
  /** Etiqueta humana */
  label: string;
}

export interface TramoLuz {
  /** % resolución mínimo para entrar al tramo (inclusive) */
  min: number;
  /** Bono fijo en Soles que cobra Luz si alcanza este tramo */
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
   * Esquema de Luz. Desde junio 2026 admite escalones (campo `tramos`):
   * cada tramo aplica si `pctResolucion >= min`, y se elige el de mayor `min`
   * alcanzado. Si no se define `tramos`, se usa el legacy todo-o-nada con
   * `umbralPct`/`bono` (un solo escalón).
   */
  luzEsquema?: {
    /** [LEGACY] Umbral único para esquema todo-o-nada. Ignorado si hay tramos. */
    umbralPct?: number;
    /** [LEGACY] Bono único del esquema todo-o-nada. Ignorado si hay tramos. */
    bono?: number;
    /** Tramos escalonados (esquema vigente desde junio 2026). */
    tramos?: TramoLuz[];
  };

  /**
   * Universo de tipificaciones que cuentan como "solucionadas" para Luz.
   * Si está omitido, se usa el set por defecto (las 14 del reporte SAE).
   * Los tags se guardan con normalización aplicada (lowercase, sin acentos).
   */
  tagsLuzSolucionadas?: string[];

  /**
   * Tipificaciones que cuentan como "no contesta" (se restan del denominador
   * de contestadas). Si está omitido, se usa el set por defecto.
   */
  tagsLuzNoContesta?: string[];

  /**
   * Si está en true, las atenciones transferidas SE INCLUYEN como
   * cerradas (denominador). Por defecto false: las transferencias
   * quedan fuera del universo (regla actual del reporte SAE).
   */
  incluirTransferenciasLuz?: boolean;

  /** @deprecated Se reemplazó por luzEsquema */
  pilarLuz1?: TramoP1[];
  /** @deprecated Se reemplazó por luzEsquema */
  pilarLuz2?: TramoP2[];
  /** @deprecated Ya no aplica al modelo de Luz */
  baseLuzSol?: number;
}

export const DEFAULT_CONFIG: ComisionConfig = {
  baseSol: 1100,
  // Esquema vigente desde JUNIO 2026 — "Ventas call":
  //   Tramos más estrictos, sin guardrail de piso de atenciones.
  //   El % Sol/Cerradas maneja el multiplicador (transferidas excluidas).
  // Para meses anteriores (feb–may 2026), ver ESQUEMAS_HISTORICOS.
  pilar1: [
    { min: 0,  mul: 0,    label: '0% – 6.9%' },
    { min: 7,  mul: 0.5,  label: '7% – 8.9%' },
    { min: 9,  mul: 1.0,  label: '9% – 10.9%' },
    { min: 11, mul: 1.25, label: '11% – 12.9%' },
    { min: 13, mul: 1.5,  label: '13% – 14.9%' },
    { min: 15, mul: 2.0,  label: '15% o más' },
  ],
  // Pilar 2: sin cambios (bono fijo por AE del mes).
  pilar2: [
    { min: 0,  bono: 0,    label: '0 – 4 AE' },
    { min: 5,  bono: 150,  label: '5 – 15 AE' },
    { min: 16, bono: 300,  label: '16 – 30 AE' },
    { min: 31, bono: 500,  label: '31 – 50 AE' },
    { min: 51, bono: 750,  label: '51 – 70 AE' },
    { min: 71, bono: 1000, label: '71+ AE' },
  ],
  // Esquema de Luz desde junio 2026: escalonado por % de resolución.
  // Reemplaza el viejo todo-o-nada (≥60 → 300).
  luzEsquema: {
    tramos: [
      { min: 60, bono: 300, label: '60% – 79% · S/300' },
      { min: 80, bono: 350, label: '80% – 89% · S/350' },
      { min: 90, bono: 500, label: '90% o más · S/500' },
    ],
  },
  viejaCupon: 20,
  viejaPreowner: 12,
};
