'use client';

import { ReactNode } from 'react';
import { useCountUp } from './useCountUp';

export interface MetaProgressProps {
  /** Etiqueta superior */
  eyebrow: string;
  /** Valor actual numérico (animable) */
  valorActual: number;
  /** Decimales a mostrar */
  decimales?: number;
  /** Valor a alcanzar para el siguiente tramo */
  valorObjetivo?: number;
  /** Unidad para mostrar al lado del valor */
  unidad?: string;
  /** Tramo actual ya alcanzado */
  tramoActual: { label: string; recompensa: string };
  /** Próximo tramo (null si ya está en el máximo) */
  tramoSiguiente?: { label: string; recompensa: string } | null;
  /** Texto motivacional principal — qué falta + qué se gana */
  desafio?: {
    /** Texto en grande: "Te faltan 11 aprobadas-entregadas" */
    titulo: string;
    /** Texto secundario: "para subir a 1.5× y ganar S/ 1,650" */
    detalle: string;
  } | null;
  /** Porcentaje de avance entre tramo actual y siguiente, 0–100 */
  progresoPct: number;
  /** Color principal */
  color: string;
  /** Color soft */
  colorSoft: string;
  /** Tono del desafío (afecta la animación pulse) */
  tono?: 'aqua' | 'gold';
  /** Pie inferior con info adicional */
  footer?: ReactNode;
}

export function MetaProgress({
  eyebrow,
  valorActual,
  decimales = 0,
  valorObjetivo,
  unidad,
  tramoActual,
  tramoSiguiente,
  desafio,
  progresoPct,
  color,
  colorSoft,
  tono = 'aqua',
  footer,
}: MetaProgressProps) {
  const enMaximo = !tramoSiguiente;
  const valorAnimado = useCountUp(valorActual, 900, decimales);
  const objetivoAnimado = useCountUp(valorObjetivo ?? 0, 900, decimales);
  const progresoAnimado = useCountUp(progresoPct, 1200, 0);
  const pulseClass = tono === 'gold' ? 'anim-pulse-gold' : 'anim-pulse-aqua';

  return (
    <div className="card-surface p-6 relative overflow-hidden">
      {/* Acento superior */}
      <span className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color }} aria-hidden />

      <p className="eyebrow mb-3">{eyebrow}</p>

      {/* Valor grande con objetivo */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-display text-[40px] font-semibold tabular leading-none text-ink">
          {decimales === 0 ? valorAnimado : valorAnimado.toFixed(decimales)}
        </span>
        {valorObjetivo != null && !enMaximo && (
          <span className="text-[15px] text-muted2 tabular leading-none">
            / {decimales === 0 ? objetivoAnimado : objetivoAnimado.toFixed(decimales)}
          </span>
        )}
        {unidad && <span className="text-[12px] text-muted font-medium">{unidad}</span>}
      </div>

      {/* Tramo actual + recompensa */}
      <div className="flex items-center gap-2 mt-3 mb-4">
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide"
          style={{ background: colorSoft, color }}
        >
          Tramo actual: {tramoActual.label}
        </span>
        <span className="text-[11.5px] text-muted2">{tramoActual.recompensa}</span>
      </div>

      {/* Barra de progreso animada */}
      <div className="mb-4">
        <div className="h-2.5 bg-bg rounded-full overflow-hidden relative">
          <div
            className="h-full rounded-full anim-progress-fill transition-[width] duration-700 relative overflow-hidden"
            style={{
              width: `${Math.max(2, progresoPct)}%`,
              background: enMaximo
                ? `linear-gradient(90deg, ${color}, ${color}cc)`
                : `linear-gradient(90deg, ${color}cc, ${color})`,
            }}
            aria-hidden
          >
            {/* Shimmer sutil que recorre la barra cuando está incompleta */}
            {!enMaximo && progresoPct > 5 && (
              <span className="absolute inset-0 anim-shimmer" aria-hidden />
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10.5px]">
          <span className="text-muted2 tabular">{progresoAnimado}% del tramo</span>
          {enMaximo && (
            <span className="font-semibold uppercase tracking-wider text-aqua-700">Tramo máximo alcanzado</span>
          )}
        </div>
      </div>

      {/* Desafío motivacional con pulse glow */}
      {desafio && !enMaximo && (
        <div
          className={`relative rounded-xl border p-4 ${pulseClass}`}
          style={{
            background: colorSoft,
            borderColor: color + '40',
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="inline-flex items-center justify-center px-2.5 h-8 rounded-md shrink-0 font-display font-bold text-[12px] whitespace-nowrap"
              style={{ background: color, color: '#fff', minWidth: '36px' }}
              aria-hidden
            >
              →
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-display text-[15px] font-semibold leading-snug" style={{ color }}>
                {desafio.titulo}
              </div>
              <div className="text-[12.5px] text-ink2 mt-1 leading-snug">{desafio.detalle}</div>
            </div>
          </div>
        </div>
      )}

      {enMaximo && (
        <div className="rounded-xl border border-aqua-300 bg-aqua-100 px-4 py-3 text-[13px] text-aqua-700">
          <strong>¡Excelente!</strong> Estás en el tramo más alto del esquema.
        </div>
      )}

      {footer && <div className="mt-4 pt-3 border-t border-line text-[11.5px] text-muted">{footer}</div>}
    </div>
  );
}
