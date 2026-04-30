import { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padding = 'p-6',
}: { children: ReactNode; className?: string; padding?: string }) {
  return (
    <section className={`card-surface ${padding} ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 mb-5">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h3 className="font-display text-[17px] font-semibold leading-tight text-ink">{title}</h3>
        {subtitle && <p className="text-[12.5px] text-muted mt-1">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
