import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const exportRoutes = Router();

/**
 * @openapi
 * /runs/{id}/export/json:
 *   get:
 *     tags: [Export]
 *     summary: Export a test run as a JSON file download
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: JSON file download
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 status: { type: string }
 *                 scriptName: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *                 metrics:
 *                   type: array
 *                   items: { type: object }
 *                 thresholds:
 *                   type: array
 *                   items: { type: object }
 *       404:
 *         description: Run not found
 */
exportRoutes.get('/runs/:id/export/json', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: {
      results: true,
      thresholdResults: true,
      script: { select: { name: true } },
    },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  const data = {
    id: run.id,
    status: run.status,
    scriptName: run.script?.name,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    k6ExitCode: run.k6ExitCode,
    metrics: run.results.map((r) => ({
      metricName: r.metricName,
      type: r.metricType,
      avg: r.avg,
      min: r.min,
      max: r.max,
      med: r.med,
      p90: r.p90,
      p95: r.p95,
      p99: r.p99,
      count: r.count,
    })),
    thresholds: run.thresholdResults.map((t) => ({
      metricName: t.metricName,
      expression: t.thresholdExpr,
      passed: t.passed,
      actualValue: t.actualValue,
    })),
  };

  const json = JSON.stringify(data, null, 2);
  const filename = `run-${run.id.slice(0, 8)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(json);
});

/**
 * @openapi
 * /runs/{id}/export/csv:
 *   get:
 *     tags: [Export]
 *     summary: Export a test run as a CSV file download
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: Run not found
 */
exportRoutes.get('/runs/:id/export/csv', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { results: true, script: { select: { name: true } } },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  const header = 'metricName,type,avg,min,max,med,p90,p95,p99,count';
  const rows = run.results.map((r) =>
    `"${r.metricName}",${r.metricType},${r.avg ?? ''},${r.min ?? ''},${r.max ?? ''},${r.med ?? ''},${r.p90 ?? ''},${r.p95 ?? ''},${r.p99 ?? ''},${r.count ?? ''}`
  );
  const csv = [header, ...rows].join('\n');
  const filename = `run-${run.id.slice(0, 8)}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

exportRoutes.get('/runs/:id/export/junit', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { results: true, thresholdResults: true, script: { select: { name: true } } },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  const duration = run.startedAt && run.finishedAt
    ? ((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(2)
    : '0';

  const failures = run.thresholdResults?.filter((t) => !t.passed) || [];
  const errors = run.results?.filter((r) => r.metricName === 'http_req_failed' && (r.avg ?? 0) > 0) || [];
  const tests = run.thresholdResults?.length || run.results?.length || 0;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<testsuite name="${escXml(run.script?.name || 'k6 test')}" tests="${tests}" failures="${failures.length}" errors="${errors.length}" time="${duration}">\n`;

  for (const t of run.thresholdResults || []) {
    xml += `  <testcase name="${escXml(t.metricName)}: ${escXml(t.thresholdExpr)}" classname="k6.threshold" time="0">\n`;
    if (!t.passed) {
      xml += `    <failure message="Threshold not met" type="failure">\n`;
      xml += `      Expected ${escXml(t.thresholdExpr)}, got ${escXml(String(t.actualValue ?? 'N/A'))}\n`;
      xml += `    </failure>\n`;
    }
    xml += `  </testcase>\n`;
  }

  for (const r of run.results || []) {
    if (r.metricName === 'http_req_failed' && (r.avg ?? 0) > 0) {
      xml += `  <testcase name="${escXml(r.metricName)}" classname="k6.metric" time="0">\n`;
      xml += `    <error message="Error rate: ${r.avg}%" type="error">\n`;
      xml += `      ${escXml(r.metricName)} failed rate is ${r.avg ?? 0}%\n`;
      xml += `    </error>\n`;
      xml += `  </testcase>\n`;
    }
  }

  xml += `</testsuite>\n`;

  const filename = `run-${run.id.slice(0, 8)}-junit.xml`;
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
});

exportRoutes.get('/runs/:id/export/html', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: {
      results: true,
      thresholdResults: true,
      script: { select: { name: true } },
      config: { select: { name: true } },
    },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  const html = await generateReportHtml(run);
  const filename = `run-${run.id.slice(0, 8)}-report.html`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(html);
});

/**
 * @openapi
 * /runs/{id}/export/pdf:
 *   get:
 *     tags: [Export]
 *     summary: Export a test run as a PDF report
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Run not found
 *       500:
 *         description: PDF generation failed
 */
exportRoutes.get('/runs/:id/export/pdf', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: {
      results: true,
      thresholdResults: true,
      script: { select: { name: true } },
      config: { select: { name: true } },
    },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const html = await generateReportHtml(run);

    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
      printBackground: true,
    });

    await browser.close();

    const filename = `run-${run.id.slice(0, 8)}-report.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    logger.error({ err }, 'Failed to generate PDF');
    res.status(500).json({ message: 'PDF generation failed. Ensure browser engine is installed (npx playwright install chromium).' });
  }
});

async function generateReportHtml(run: any): Promise<string> {
  const duration = run.finishedAt && run.startedAt
    ? ((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)
    : '—';

  const metrics = run.results || [];
  const thresholds = run.thresholdResults || [];
  const passedThresholds = thresholds.filter((t: any) => t.passed).length;

  const metricRows = metrics.map((m: any) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;">${escHtml(m.metricName)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.avg?.toFixed(2) ?? '—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.min?.toFixed(2) ?? '—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.max?.toFixed(2) ?? '—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.p90?.toFixed(2) ?? '—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.p95?.toFixed(2) ?? '—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.p99?.toFixed(2) ?? '—'}</td></tr>`
  ).join('\n');

  const thresholdRows = thresholds.map((t: any) =>
    `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;">${escHtml(t.metricName)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:13px;">${escHtml(t.thresholdExpr)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${t.actualValue?.toFixed(2) ?? '—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${t.passed ? '#16a34a' : '#dc2626'};font-weight:600;">${t.passed ? '✓ Pass' : '✗ Fail'}</td></tr>`
  ).join('\n');

  const label = run.status === 'completed' ? 'Pass' : run.status === 'failed' ? 'Fail' : run.status;
  const statusColor = run.status === 'completed' ? '#16a34a' : run.status === 'failed' ? '#dc2626' : '#f59e0b';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Run Report — ${run.id.slice(0, 8)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#111827;padding:32px;max-width:960px;margin:0 auto}
h1{font-size:24px;font-weight:700}
h2{font-size:16px;font-weight:600;margin-top:24px;margin-bottom:12px;color:#374151}
.status-badge{display:inline-block;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;color:#fff;background:${statusColor}}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0}
.meta-card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}
.meta-card .label{font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px}
.meta-card .value{font-size:18px;font-weight:700;margin-top:4px}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb}
th{background:#f3f4f6;padding:8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;text-align:left;border-bottom:2px solid #e5e7eb}
td{padding:8px;font-size:13px;border-bottom:1px solid #f3f4f6}
.chart-container{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-top:12px}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center}
@media print{body{background:#fff}.meta-card{break-inside:avoid}}
</style>
</head>
<body>
<h1>Test Run Report</h1>
<p style="color:#6b7280;margin-top:4px;">${escHtml(run.script?.name || 'Unnamed Script')}${run.config?.name ? ' — ' + escHtml(run.config.name) : ''}</p>
<div style="margin-top:8px;"><span class="status-badge">${label}</span> <span style="color:#6b7280;font-size:13px;margin-left:8px;">ID: ${run.id.slice(0, 8)}</span></div>

<div class="meta">
  <div class="meta-card"><div class="label">Duration</div><div class="value">${duration}s</div></div>
  <div class="meta-card"><div class="label">Started</div><div class="value">${run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}</div></div>
  <div class="meta-card"><div class="label">Finished</div><div class="value">${run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</div></div>
  <div class="meta-card"><div class="label">Metrics</div><div class="value">${metrics.length}</div></div>
  <div class="meta-card"><div class="label">Thresholds</div><div class="value">${passedThresholds} / ${thresholds.length} passed</div></div>
  <div class="meta-card"><div class="label">Exit Code</div><div class="value">${run.k6ExitCode ?? '—'}</div></div>
</div>

<h2>Metrics</h2>
<table>
<thead><tr><th>Metric</th><th style="text-align:right;">Avg</th><th style="text-align:right;">Min</th><th style="text-align:right;">Max</th><th style="text-align:right;">P90</th><th style="text-align:right;">P95</th><th style="text-align:right;">P99</th></tr></thead>
<tbody>${metricRows}</tbody>
</table>

<div class="chart-container">
  <canvas id="metricsChart" height="200"></canvas>
</div>
<script>
new Chart(document.getElementById('metricsChart'), {
  type: 'bar',
  data: {
    labels: [${metrics.map((m: any) => `"${escHtml(m.metricName)}"`).join(',')}],
    datasets: [
      {label:'Avg',data:[${metrics.map((m: any) => m.avg ?? 0).join(',')}],backgroundColor:'#6366f1',borderRadius:4},
      {label:'P95',data:[${metrics.map((m: any) => m.p95 ?? 0).join(',')}],backgroundColor:'#f59e0b',borderRadius:4},
      {label:'P99',data:[${metrics.map((m: any) => m.p99 ?? 0).join(',')}],backgroundColor:'#ef4444',borderRadius:4}
    ]
  },
  options:{
    responsive:true,
    plugins:{legend:{position:'bottom'}},
    scales:{y:{beginAtZero:true}}
  }
});
</script>

${thresholdRows.length > 0 ? `<h2>Thresholds</h2><table><thead><tr><th>Metric</th><th>Expression</th><th style="text-align:right;">Actual</th><th style="text-align:center;">Result</th></tr></thead><tbody>${thresholdRows}</tbody></table>` : ''}

<div class="footer">
  Generated by TenjinT6 Performance Testing Platform &middot; ${new Date().toISOString()}
</div>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
