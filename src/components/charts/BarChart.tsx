'use client';

import { Bar, baseXAxis, baseYAxis, type ChartOptions } from './ChartBase';

interface BarChartProps {
  labels: string[];
  series: Array<{ label: string; data: number[]; color: string; }>;
  height?: number;
  /** Mostrar leyenda inferior */
  legend?: boolean;
  /** Apilado */
  stacked?: boolean;
  /** Mostrar valores sobre las barras (default: true) */
  showValues?: boolean;
}

export default function BarChart({ labels, series, height = 220, legend = false, stacked = false, showValues = true }: BarChartProps) {
  const datasets = series.map(s => ({
    label: s.label,
    data: s.data,
    backgroundColor: s.color,
    borderColor: s.color,
    borderWidth: 0,
    maxBarThickness: 36,
  }));

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: legend ? { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 14, font: { size: 11 } } } : { display: false },
    },
    scales: {
      x: { ...baseXAxis, stacked },
      y: { ...baseYAxis, stacked, beginAtZero: true },
    },
    animation: { duration: 350 },
  };

  // Mini plugin custom para etiquetas sobre barras (sin chartjs-plugin-datalabels)
  const valuePlugin = showValues
    ? {
        id: 'valuePlugin',
        afterDatasetsDraw: (chart: any) => {
          const { ctx } = chart;
          ctx.save();
          ctx.font = '600 10.5px "Plus Jakarta Sans", system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          chart.data.datasets.forEach((ds: any, di: number) => {
            const meta = chart.getDatasetMeta(di);
            if (!meta.visible) return;
            meta.data.forEach((bar: any, i: number) => {
              const v = ds.data[i];
              if (v == null || v === 0) return;
              const fmt = formatNum(v);
              // Sombra sutil tipo halo blanco para mantener legibilidad sobre cualquier fondo
              ctx.fillStyle = 'rgba(255,255,255,0.92)';
              ctx.fillText(fmt, bar.x, bar.y - 4);
              ctx.fillText(fmt, bar.x, bar.y - 4);
              ctx.fillStyle = ds.borderColor ?? '#0E1228';
              ctx.fillText(fmt, bar.x, bar.y - 4);
            });
          });
          ctx.restore();
        },
      }
    : undefined;

  function formatNum(v: number): string {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
    if (Math.abs(v) < 1 && v !== 0) return v.toFixed(2);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  return (
    <div style={{ height }}>
      <Bar data={{ labels, datasets }} options={options} plugins={valuePlugin ? [valuePlugin] : []} />
    </div>
  );
}
