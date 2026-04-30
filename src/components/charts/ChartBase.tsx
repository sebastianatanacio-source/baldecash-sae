'use client';

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  ArcElement, BarElement, CategoryScale, Filler, Legend,
  LinearScale, LineElement, PointElement, Tooltip,
);

ChartJS.defaults.font.family = "'Inter', system-ui, sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = '#6B7197';
ChartJS.defaults.borderColor = '#E4E7F2';
ChartJS.defaults.elements.bar.borderRadius = 4;
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: 'bold', size: 12 };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 12 };
ChartJS.defaults.plugins.tooltip.backgroundColor = '#151744';
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.boxPadding = 6;

/**
 * Estilos de ejes compartidos. Tipado como `any` adrede: cada chart espera
 * una variante específica de Chart.js (`linear` para bar/line) que es
 * incompatible con el tipo agregado de `ChartOptions['scales']`. Aplicar
 * a nivel de cada wrapper local evita una explosión de genéricos.
 */
export const baseXAxis: any = {
  grid: { display: false }, border: { display: false }, ticks: { color: '#9CA3C5' },
};
export const baseYAxis: any = {
  grid: { color: '#F0F2F8' }, border: { display: false }, ticks: { color: '#9CA3C5' },
};

export { Bar, Line, Doughnut };
export type { ChartData, ChartOptions };
