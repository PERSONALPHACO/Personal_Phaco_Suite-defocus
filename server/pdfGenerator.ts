import puppeteer from "puppeteer-core";
import { LOGO_BASE64 } from "./logoBase64";

export interface IOLEntry {
  eye: string;
  iolName: string;
  manufacturer: string;
  surgeryDate?: string;
  refractiveTarget?: string;
}

export interface MeasurementSeries {
  id: number;
  label: string;
  color: string;
  points: { diopter: number; visualAcuity: number }[];
}

export interface PDFReportData {
  doctorName: string;
  caseId: string;
  generatedAt: string;
  iols: IOLEntry[];
  series: MeasurementSeries[];
  logoUrl: string;
}

function buildChartSvg(series: MeasurementSeries[]): string {
  // Chart dimensions
  const W = 700, H = 320;
  const padL = 60, padR = 30, padT = 20, padB = 50;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // X axis: diopter from +1.0 to -3.5
  const xMin = -3.5, xMax = 1.0;
  const xRange = xMax - xMin;

  // Y axis: visual acuity (logMAR) from -0.1 to 0.7
  const yMin = -0.1, yMax = 0.7;
  const yRange = yMax - yMin;

  const toX = (d: number) => padL + ((d - xMin) / xRange) * chartW;
  const toY = (va: number) => padT + ((va - yMin) / yRange) * chartH;

  // Grid lines
  const xTicks = [1.0, 0.5, 0.0, -0.5, -1.0, -1.5, -2.0, -2.5, -3.0, -3.5];
  const yTicks = [-0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

  let gridLines = "";
  for (const x of xTicks) {
    const cx = toX(x);
    gridLines += `<line x1="${cx}" y1="${padT}" x2="${cx}" y2="${padT + chartH}" stroke="#e5e7eb" stroke-width="1"/>`;
    gridLines += `<text x="${cx}" y="${padT + chartH + 16}" text-anchor="middle" font-size="11" fill="#6b7280">${x.toFixed(1)}</text>`;
  }
  for (const y of yTicks) {
    const cy = toY(y);
    gridLines += `<line x1="${padL}" y1="${cy}" x2="${padL + chartW}" y2="${cy}" stroke="#e5e7eb" stroke-width="1"/>`;
    gridLines += `<text x="${padL - 8}" y="${cy + 4}" text-anchor="end" font-size="11" fill="#6b7280">${y.toFixed(1)}</text>`;
  }

  // Functional vision reference line at 0.20 logMAR
  const refY = toY(0.20);
  gridLines += `<line x1="${padL}" y1="${refY}" x2="${padL + chartW}" y2="${refY}" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="6,4"/>`;
  gridLines += `<text x="${padL + chartW - 4}" y="${refY - 4}" text-anchor="end" font-size="10" fill="#ef4444">0.20 logMAR</text>`;

  // Zone backgrounds
  const zoneNear = toX(-2.5);
  const zoneIntermediate = toX(-1.0);
  gridLines = `
    <rect x="${padL}" y="${padT}" width="${toX(-1.0) - padL}" height="${chartH}" fill="#f0fdf4" opacity="0.5"/>
    <rect x="${toX(-1.0)}" y="${padT}" width="${toX(-2.5) - toX(-1.0)}" height="${chartH}" fill="#fefce8" opacity="0.5"/>
    <rect x="${toX(-2.5)}" y="${padT}" width="${padL + chartW - toX(-2.5)}" height="${chartH}" fill="#fef2f2" opacity="0.5"/>
  ` + gridLines;

  // Zone labels
  gridLines += `<text x="${padL + (toX(-1.0) - padL) / 2}" y="${padT + chartH + 35}" text-anchor="middle" font-size="10" fill="#16a34a">Longe</text>`;
  gridLines += `<text x="${toX(-1.0) + (toX(-2.5) - toX(-1.0)) / 2}" y="${padT + chartH + 35}" text-anchor="middle" font-size="10" fill="#ca8a04">Intermédio</text>`;
  gridLines += `<text x="${toX(-2.5) + (padL + chartW - toX(-2.5)) / 2}" y="${padT + chartH + 35}" text-anchor="middle" font-size="10" fill="#dc2626">Perto</text>`;

  // Series lines
  let lines = "";
  for (const s of series) {
    if (!s.points || s.points.length === 0) continue;
    const sorted = [...s.points].sort((a, b) => b.diopter - a.diopter);
    const pathD = sorted
      .map((p, i) => {
        const x = toX(p.diopter);
        const y = toY(p.visualAcuity);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
    lines += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    // Dots
    for (const p of sorted) {
      lines += `<circle cx="${toX(p.diopter).toFixed(1)}" cy="${toY(p.visualAcuity).toFixed(1)}" r="3" fill="${s.color}"/>`;
    }
  }

  // Axis labels
  const axisLabels = `
    <text x="${padL + chartW / 2}" y="${H - 2}" text-anchor="middle" font-size="12" fill="#374151">Defocus (D)</text>
    <text transform="rotate(-90)" x="${-(padT + chartH / 2)}" y="14" text-anchor="middle" font-size="12" fill="#374151">Acuidade Visual (logMAR)</text>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:#fff">
    ${gridLines}
    ${lines}
    ${axisLabels}
  </svg>`;
}

function buildLegend(series: MeasurementSeries[]): string {
  return series
    .map(
      (s) =>
        `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px;">
          <span style="display:inline-block;width:24px;height:3px;background:${s.color};border-radius:2px;"></span>
          <span style="font-size:12px;color:#374151;">${s.label}</span>
        </span>`
    )
    .join("");
}

function buildIOLTable(iols: IOLEntry[]): string {
  if (iols.length === 0) return "<p style='color:#6b7280;font-size:13px;'>Nenhuma IOL registrada.</p>";
  const rows = iols
    .map(
      (iol) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">${iol.eye === "OD" ? "OD (Direito)" : "OS (Esquerdo)"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#111827;">${iol.iolName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${iol.manufacturer}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${iol.surgeryDate || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;color:#6b7280;">${iol.refractiveTarget ? `${Number(iol.refractiveTarget).toFixed(2)} D` : "—"}</td>
      </tr>`
    )
    .join("");
  return `
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Olho</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">IOL</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Fabricante</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Data Cirurgia</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;">Alvo Refrativo</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export async function generatePDFReport(data: PDFReportData): Promise<Buffer> {
  const chartSvg = buildChartSvg(data.series);
  const legend = buildLegend(data.series);
  const iolTable = buildIOLTable(data.iols);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #fff; color: #111827; }
    .page { padding: 32px 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 2px solid #1e3a5f; margin-bottom: 24px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo { height: 64px; width: auto; }
    .header-title { font-size: 22px; font-weight: 700; color: #1e3a5f; }
    .header-subtitle { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .header-right { text-align: right; }
    .header-right .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
    .header-right .value { font-size: 13px; color: #374151; font-weight: 500; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14px; font-weight: 600; color: #1e3a5f; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
    .chart-container { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 12px; }
    .disclaimer { margin-top: 32px; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
    .disclaimer p { font-size: 11px; color: #6b7280; line-height: 1.6; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .footer span { font-size: 11px; color: #9ca3af; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: #dbeafe; color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <img src="${LOGO_BASE64}" class="logo" alt="DefocusApp Logo"/>
        <div>
          <div class="header-title">Relatório de Curva Defocus</div>
          <div class="header-subtitle">Análise de Desempenho de IOL</div>
        </div>
      </div>
      <div class="header-right">
        <div class="label">Médico Responsável</div>
        <div class="value">${data.doctorName}</div>
        <div class="label" style="margin-top:8px;">Gerado em</div>
        <div class="value">${data.generatedAt}</div>
        <div style="margin-top:8px;"><span class="badge">CASO ANÔNIMO</span></div>
      </div>
    </div>

    <!-- IOLs Section -->
    <div class="section">
      <div class="section-title">IOLs Implantadas</div>
      ${iolTable}
    </div>

    <!-- Chart Section -->
    <div class="section">
      <div class="section-title">Curva Defocus</div>
      <div class="chart-container">
        ${chartSvg}
        <div class="legend">${legend}</div>
      </div>
    </div>

    <!-- Disclaimer -->
    <div class="disclaimer">
      <p><strong>Aviso de Privacidade:</strong> Este relatório foi gerado de forma anonimizada, sem identificação do paciente, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Os dados clínicos apresentados são de uso exclusivo do médico responsável e não devem ser compartilhados sem o consentimento expresso do paciente.</p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <span>DefocusApp — Plataforma de Análise de IOL</span>
      <span>Caso: ${data.caseId}</span>
    </div>
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
