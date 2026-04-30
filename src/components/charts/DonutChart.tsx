'use client';

import { Doughnut, type ChartOptions } from './ChartBase';

export default function DonutChart({
  labels,
  values,
  colors,
  height = 200,
  centerLabel,
  centerValue,
}: {
  labels: string[];
  values: number[];
  colors: string[];
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        display: true, position: 'bottom',
        labels: {
          boxWidth: 10, padding: 12, font: { size: 11 },
          generateLabels: (chart) => {
            const ds = chart.data.datasets[0];
            const total = (ds.data as number[]).reduce((a, b) => a + (b || 0), 0);
            return (chart.data.labels as string[]).map((label, i) => {
              const v = ds.data[i] as number;
              const pctv = total > 0 ? (v / total * 100).toFixed(1) : '0';
              return {
                text: `${label} · ${v.toLocaleString('es-PE')} (${pctv}%)`,
                fillStyle: (ds.backgroundColor as string[])[i],
                strokeStyle: (ds.backgroundColor as string[])[i],
                index: i,
              };
            });
          },
        },
      },
    },
  };

  const centerPlugin = centerValue != null ? [{
    id: 'centerLabel',
    afterDraw: (chart: any) => {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0E1228';
      ctx.font = '600 22px Source Serif 4, Georgia, serif';
      ctx.fillText(String(centerValue), cx, cy);
      if (centerLabel) {
        ctx.fillStyle = '#9CA3C5';
        ctx.font = '600 9.5px Inter';
        ctx.fillText(centerLabel.toUpperCase(), cx, cy + 16);
      }
      ctx.restore();
    },
  }] : [];

  return (
    <div style={{ height }}>
      <Doughnut
        data={{
          labels,
          datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }],
        }}
        options={options}
        plugins={centerPlugin}
      />
    </div>
  );
}
