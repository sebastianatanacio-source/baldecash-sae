'use client';

import { ReactNode } from 'react';

export interface ChipOption<T extends string = string> {
  value: T;
  label: string;
}

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: 'md' | 'sm';
}) {
  const padding = size === 'sm' ? 'px-3 py-1' : 'px-4 py-1.5';
  return (
    <div className="inline-flex flex-wrap items-center gap-1 bg-white border border-line rounded-full p-1">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`${padding} rounded-full text-[12px] font-semibold tracking-wide transition-colors ${
            o.value === value
              ? 'bg-blue-700 text-white'
              : 'text-muted hover:text-ink hover:bg-blue-100/50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'aqua' | 'gold' | 'blue';
  className?: string;
}) {
  const map: Record<string, string> = {
    neutral: 'bg-bg text-muted border-line',
    aqua: 'bg-aqua-100 text-aqua-700 border-aqua-300',
    gold: 'bg-gold-100 text-gold-700 border-gold-300',
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold uppercase tracking-wider ${map[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
