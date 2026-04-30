'use client';

import { Line, baseXAxis, baseYAxis, type ChartOptions } from './ChartBase';

export default function LineChart({
  labels,
  series,
  height = 240,
  legend = true,
  showLabels = true,
}: {
  labels: string[];
  series: Array<{ label: string; data: number[]; color: string; fill?: boolean; }>;
  height?: number;
  legend?: boolean;
  /** Mostrar valores en máximos / último punto (default true) */
  showLabels?: boolean;
}) {
  const datasets = series.map(s => ({
    label: s.label,
    data: s.data,
    borderColor: s.color,
    backgroundColor: s.fill ? hexA(s.color, 0.12) : s.color,
    fill: !!s.fill,
    tension: 0.32,
    pointRadius: 2,
    pointHoverRadius: 5,
    borderWidth: 2.2,
  }));

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: legend ? { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } } : { display: false },
    },
    scales: { x: baseXAxis, y: { ...baseYAxis, beginAtZero: true } },
    animation: { duration: 350 },
  };

  // Plugin: etiqueta el valor del punto máximo y del último punto de cada serie
  const labelPlugin = showLabels ? [{
    id: 'lineLabelPlugin',
    afterDatasetsDraw: (chart: any) => {
      const { ctx } = chart;
      ctx.save();
      ctx.font = '700 10.5px "Plus Jakarta Sans", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      chart.data.datasets.forEach((ds: any, di: number) => {
        const meta = chart.getDatasetMeta(di);
        if (!meta.visible || !ds.data || ds.data.length === 0) return;
        const idxs = new Set<number>();
        // último punto con valor > 0
        for (let i = ds.data.length - 1; i >= 0; i--) {
          if (ds.data[i] > 0) { idxs.add(i); break; }
        }
        // máximo
        let maxIdx = 0, maxV = -Infinity;
        ds.data.forEach((v: number, i: number) => { if (v != null && v > maxV) { maxV = v; maxIdx = i; } });
        if (maxV > 0) idxs.add(maxIdx);

        idxs.forEach(i => {
          const point = meta.data[i];
          if (!point) return;
          const v = ds.data[i];
          const fmt = formatNum(v);
          // Halo blanco
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillText(fmt, point.x, point.y - 8);
          ctx.fillText(fmt, point.x, point.y - 8);
          ctx.fillStyle = ds.borderColor ?? '#0E1228';
          ctx.fillText(fmt, point.x, point.y - 8);
        });
      });
      ctx.restore();
    },
  }] : [];

  return (
    <div style={{ height }}>
      <Line data={{ labels, datasets }} options={options} plugins={labelPlugin} />
    </div>
  );
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(2);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function hexA(hex: string, a: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
