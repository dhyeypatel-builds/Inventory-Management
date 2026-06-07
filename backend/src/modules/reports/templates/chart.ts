import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import type { ReportResult } from '../reports.service';

// Inline the Chart.js UMD bundle once so the headless render needs no network.
// chart.js's `exports` map hides the UMD file, so resolve via its package.json.
let chartJsSource: string | null = null;
function chartJs(): string {
  if (chartJsSource === null) {
    // The main export resolves into chart.js's dist dir; the UMD sits beside it.
    const distDir = dirname(require.resolve('chart.js'));
    chartJsSource = readFileSync(join(distDir, 'chart.umd.min.js'), 'utf8');
  }
  return chartJsSource;
}

interface ChartSpec {
  title: string;
  labelKey: string;
  valueKey: string;
  money: boolean;
  max?: number;
}

// Which reports get a chart, and from which columns.
const CHART_SPECS: Partial<Record<ReportResult['name'], ChartSpec>> = {
  'best-selling-brands': { title: 'Revenue by brand', labelKey: 'brandName', valueKey: 'revenue', money: true },
  'stock-valuation': { title: 'Stock value by brand', labelKey: 'brandName', valueKey: 'totalValue', money: true },
  'fast-moving': { title: 'Units sold', labelKey: 'productName', valueKey: 'units', money: false, max: 10 },
};

const AMBER = '#E8820C';
const INK = '#1c1f24';

/**
 * Returns an HTML block (canvas + inlined Chart.js + init) for reports where a
 * chart adds meaning, or '' otherwise. Animation is disabled so the chart is
 * fully drawn synchronously before Chrome prints the PDF.
 */
export function chartBlock(report: ReportResult): string {
  const spec = CHART_SPECS[report.name];
  if (!spec || report.rows.length === 0) return '';

  const rows = spec.max ? report.rows.slice(0, spec.max) : report.rows;
  const labels = rows.map((r) => String(r[spec.labelKey] ?? '—'));
  const data = rows.map((r) => (typeof r[spec.valueKey] === 'number' ? (r[spec.valueKey] as number) : 0));
  if (data.every((d) => d === 0)) return '';

  const config = {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: AMBER, borderRadius: 3, maxBarThickness: 46 }] },
    options: {
      animation: false,
      responsive: false,
      plugins: { legend: { display: false }, title: { display: true, text: spec.title, color: INK, font: { size: 13, weight: '700' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: INK, font: { size: 10 } } },
        y: { grid: { color: '#eef0f3' }, ticks: { color: '#5b6470', font: { size: 10 } } },
      },
    },
  };

  const tickFn = spec.money
    ? `cfg.options.scales.y.ticks.callback = function(v){ return '\\u00A3' + Number(v).toLocaleString('en-GB'); };`
    : '';

  return `<div class="chart-wrap"><canvas id="report-chart" width="980" height="300"></canvas></div>
<script>${chartJs()}</script>
<script>
  (function(){
    var cfg = ${JSON.stringify(config)};
    ${tickFn}
    new Chart(document.getElementById('report-chart'), cfg);
  })();
</script>`;
}
