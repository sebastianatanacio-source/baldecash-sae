import { ReactNode } from 'react';

export interface KpiProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; label?: string; positiveIsGood?: boolean };
  /** Si lo pasas, se pinta como acento del KPI */
  accent?: string;
  /** Texto auxiliar bajo el valor */
  hint?: string;
  /** Tamaño del valor: md por defecto, lg para hero */
  size?: 'md' | 'lg';
  /** Pasar children para reemplazar el valor por algo custom */
  children?: ReactNode;
}

export function Kpi({ label, value, unit, delta, accent, hint, size = 'md', children }: KpiProps) {
  const valueClass =
    size === 'lg'
      ? 'font-display text-[34px] font-semibold leading-none tracking-tight'
      : 'font-display text-[24px] font-semibold leading-none tracking-tight';

  let deltaEl: ReactNode = null;
  if (delta && delta.value !== 0) {
    const positive = delta.value > 0;
    const positiveIsGood = delta.positiveIsGood ?? true;
    const good = positive === positiveIsGood;
    deltaEl = (
      <span
        className={`text-[11px] font-semibold tabular ${
          good ? 'text-aqua-700' : 'text-gold-700'
        }`}
        title={delta.label}
      >
        {positive ? '+' : ''}
        {delta.value.toFixed(1)}%
      </span>
    );
  }

  return (
    <div className="card-surface p-5 relative overflow-hidden">
      {accent && (
        <span
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{ background: accent }}
          aria-hidden
        />
      )}
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`tabular text-ink ${valueClass}`}>
          {children ?? value}
        </span>
        {unit && <span className="text-[12px] text-muted font-medium">{unit}</span>}
        {deltaEl}
      </div>
      {hint && <p className="text-[11.5px] text-muted2 mt-2">{hint}</p>}
    </div>
  );
}

/** Versión compacta para grids más densos */
export function KpiCompact({ label, value, unit, accent }: { label: string; value: string | number; unit?: string; accent?: string }) {
  return (
    <div className="bg-bg/70 border border-line rounded-xl p-4 relative">
      {accent && <span className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: accent }} aria-hidden />}
      <p className="eyebrow text-[9.5px] mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="tabular font-display text-[20px] font-semibold text-ink leading-none">{value}</span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
    </div>
  );
}
