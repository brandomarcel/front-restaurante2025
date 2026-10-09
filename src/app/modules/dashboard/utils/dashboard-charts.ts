import { CashSnapshot, TopProduct } from '../dashboard.models';
import { cashDifference } from './operations-metrics';

/** Opciones de ApexCharts en el formato que espera `<apx-chart>`. */
export type ChartOptions = Record<string, any>;

const formatDecimal = (value: number): string => (Number(value) || 0).toFixed(2);
const formatCurrency = (value: number): string => `$${formatDecimal(value)}`;

export function buildTopProductsChart(products: TopProduct[]): ChartOptions {
  const top = products.slice(0, 8);
  return {
    series: [{ name: 'Unidades', data: top.length ? top.map((item) => item.count) : [0] }],
    chart: {
      type: 'bar',
      height: 360,
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 550 }
    },
    plotOptions: { bar: { horizontal: true, barHeight: '58%', borderRadius: 6, distributed: true } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: top.length ? top.map((item) => item.name) : ['Sin ventas'],
      labels: { style: { colors: '#64748b' } }
    },
    yaxis: { labels: { style: { colors: '#334155', fontWeight: 600 } } },
    colors: ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'],
    grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    tooltip: { y: { formatter: (value: number) => `${formatDecimal(value)} vendidos` } }
  };
}

/** Apertura, ventas y retiros del turno. */
export function buildCashFlowChart(cash: CashSnapshot, salesTotal: number): ChartOptions {
  const series = [cash.openingAmount, salesTotal, cash.withdrawals].map((value) => Number(value) || 0);
  const total = series.reduce((sum, value) => sum + value, 0);
  return {
    series,
    chart: { type: 'donut', height: 330, toolbar: { show: false } },
    labels: ['Apertura', 'Ventas', 'Retiros'],
    colors: ['#f59e0b', '#10b981', '#f43f5e'],
    legend: { show: false },
    dataLabels: { enabled: true, formatter: (value: number) => `${formatDecimal(value)}%` },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: '66%',
          labels: {
            show: true,
            name: { show: true },
            value: { show: true, formatter: (value: string) => formatCurrency(Number(value)) },
            total: { show: true, label: 'Movimiento', formatter: () => formatCurrency(total) }
          }
        }
      }
    },
    tooltip: { y: { formatter: (value: number) => formatCurrency(value) } },
    responsive: [{ breakpoint: 1280, options: { chart: { height: 300 } } }]
  };
}

/** Ventas, retiros, efectivo actual, esperado y diferencia. */
export function buildMoneySummaryChart(cash: CashSnapshot, salesTotal: number): ChartOptions {
  const difference = cashDifference(cash);
  const values = [salesTotal, cash.withdrawals, cash.systemCash, cash.expectedCash, difference].map((value) => Number(value) || 0);
  return {
    series: [{ name: 'USD', data: values }],
    chart: {
      type: 'bar',
      height: 340,
      toolbar: { show: false },
      animations: { enabled: true, easing: 'easeinout', speed: 550 }
    },
    plotOptions: { bar: { horizontal: false, borderRadius: 6, columnWidth: '48%', distributed: true } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: ['Ventas', 'Retiros', 'Efectivo', 'Esperado', 'Diferencia'],
      labels: { style: { colors: '#64748b' } }
    },
    yaxis: { labels: { formatter: (value: number) => formatDecimal(value), style: { colors: '#64748b' } } },
    colors: ['#10b981', '#f43f5e', '#2563eb', '#0ea5e9', difference >= 0 ? '#16a34a' : '#dc2626'],
    grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
    tooltip: { y: { formatter: (value: number) => formatCurrency(value) } }
  };
}
