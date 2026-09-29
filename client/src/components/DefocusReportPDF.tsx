/**
 * DefocusReportPDF
 * Off-screen component captured by html2canvas → jsPDF.
 * Uses ONLY explicit hex/rgb colors — no oklch, no CSS variables —
 * because html2canvas cannot parse oklch (Tailwind 4 default).
 */
import { forwardRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const LOGO_URL =
  "/logo-defocusapp.webp";

const CHART_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#d97706", // amber-600
  "#dc2626", // red-600
  "#7c3aed", // violet-600
  "#0891b2", // cyan-600
];

const IOL_TYPE_LABELS: Record<string, string> = {
  monofocal: "Monofocal",
  multifocal: "Multifocal",
  trifocal: "Trifocal",
  edof: "EDOF",
  toric: "Tórica",
  accommodating: "Acomodativa",
};

const EYE_LABELS: Record<string, string> = {
  OD: "OD (Direito)",
  OS: "OS (Esquerdo)",
  OU: "Ambos",
};

export interface ReportMeasurement {
  id: number;
  measurementDate: string | number | Date;
  eye: string;
  iolModel?: string | null;
  iolType?: string | null;
  manufacturerName?: string | null;
}

export interface ReportPatientIOL {
  id: number;
  eye: string;
  iolModel?: string | null;
  iolType?: string | null;
  manufacturerName?: string | null;
  surgeryDate?: string | number | Date | null;
  refractiveTarget?: number | null;
}

interface Props {
  patientId: number;
  doctorName: string;
  measurements: ReportMeasurement[];
  patientIols: ReportPatientIOL[];
  selectedIds: number[];
  chartData: Record<string, any>[];
}

function formatDate(val: string | number | Date): string {
  try {
    return new Date(val as any).toLocaleDateString("pt-BR");
  } catch {
    return String(val);
  }
}

function getMeasurementLabel(m: ReportMeasurement): string {
  const date = formatDate(m.measurementDate);
  const eye = m.eye;
  const iol = m.iolModel ? ` · ${m.iolModel}` : "";
  return `${date} ${eye}${iol}`;
}

const DefocusReportPDF = forwardRef<HTMLDivElement, Props>(
  ({ patientId, doctorName, measurements, patientIols, selectedIds, chartData }, ref) => {
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

    const selectedMeasurements = measurements.filter((m) =>
      selectedIds.includes(m.id)
    );

    // Styles — all explicit hex/rgb, no CSS variables or oklch
    const s = {
      page: {
        width: "794px",
        minHeight: "1123px",
        backgroundColor: "#ffffff",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "12px",
        color: "#1e293b",
        padding: "40px",
        boxSizing: "border-box" as const,
      },
      header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "2px solid #1e40af",
        paddingBottom: "16px",
        marginBottom: "24px",
      },
      logo: {
        height: "52px",
        objectFit: "contain" as const,
      },
      headerRight: {
        textAlign: "right" as const,
        color: "#475569",
        fontSize: "11px",
        lineHeight: "1.6",
      },
      reportTitle: {
        fontSize: "18px",
        fontWeight: "700",
        color: "#1e40af",
        marginBottom: "2px",
      },
      section: {
        marginBottom: "20px",
      },
      sectionTitle: {
        fontSize: "11px",
        fontWeight: "700",
        color: "#64748b",
        textTransform: "uppercase" as const,
        letterSpacing: "0.08em",
        marginBottom: "8px",
        paddingBottom: "4px",
        borderBottom: "1px solid #e2e8f0",
      },
      infoGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px 24px",
      },
      infoItem: {
        display: "flex",
        flexDirection: "column" as const,
      },
      infoLabel: {
        fontSize: "10px",
        color: "#94a3b8",
        fontWeight: "600",
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
      },
      infoValue: {
        fontSize: "13px",
        color: "#1e293b",
        fontWeight: "600",
      },
      table: {
        width: "100%",
        borderCollapse: "collapse" as const,
        fontSize: "11px",
      },
      th: {
        backgroundColor: "#f1f5f9",
        color: "#475569",
        fontWeight: "700",
        padding: "6px 10px",
        textAlign: "left" as const,
        borderBottom: "1px solid #cbd5e1",
        fontSize: "10px",
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
      },
      td: {
        padding: "7px 10px",
        borderBottom: "1px solid #f1f5f9",
        color: "#334155",
      },
      tdAlt: {
        padding: "7px 10px",
        borderBottom: "1px solid #f1f5f9",
        color: "#334155",
        backgroundColor: "#f8fafc",
      },
      chartContainer: {
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "16px",
      },
      chartTitle: {
        fontSize: "13px",
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: "12px",
      },
      legendRow: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "8px",
        marginTop: "10px",
      },
      legendChip: (color: string) => ({
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "10px",
        color: "#475569",
        backgroundColor: "#f1f5f9",
        borderRadius: "4px",
        padding: "3px 7px",
        border: `1px solid ${color}`,
      }),
      legendDot: (color: string) => ({
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }),
      zoneLegend: {
        display: "flex",
        gap: "16px",
        marginTop: "8px",
        fontSize: "10px",
        color: "#64748b",
      },
      zoneItem: {
        display: "flex",
        alignItems: "center",
        gap: "5px",
      },
      zoneBox: (bg: string) => ({
        width: "12px",
        height: "12px",
        backgroundColor: bg,
        borderRadius: "2px",
        flexShrink: 0,
      }),
      footer: {
        marginTop: "32px",
        paddingTop: "12px",
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "10px",
        color: "#94a3b8",
      },
      disclaimer: {
        backgroundColor: "#fef9c3",
        border: "1px solid #fde047",
        borderRadius: "6px",
        padding: "10px 14px",
        fontSize: "10px",
        color: "#713f12",
        marginBottom: "16px",
        lineHeight: "1.5",
      },
    };

    return (
      <div ref={ref} style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <img src={LOGO_URL} alt="DefocusApp" style={s.logo} crossOrigin="anonymous" />
          </div>
          <div style={s.headerRight}>
            <div style={s.reportTitle}>Relatório de Curva de Defoque</div>
            <div>{today}</div>
            <div style={{ marginTop: "4px", fontSize: "10px", color: "#94a3b8" }}>
              Documento gerado automaticamente pelo DefocusApp
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={s.disclaimer}>
          <strong>Documento anonimizado</strong> — Este relatório não contém dados pessoais
          identificáveis do paciente, em conformidade com a LGPD (Lei nº 13.709/2018).
          Os dados clínicos são de uso exclusivo do profissional de saúde responsável.
        </div>

        {/* Case & Doctor Info */}
        <div style={s.section}>
          <div style={s.sectionTitle}>Identificação</div>
          <div style={s.infoGrid}>
            <div style={s.infoItem}>
              <span style={s.infoLabel}>Caso</span>
              <span style={s.infoValue}>CASO-{patientId}</span>
            </div>
            <div style={s.infoItem}>
              <span style={s.infoLabel}>Médico Responsável</span>
              <span style={s.infoValue}>Dr(a). {doctorName}</span>
            </div>
            <div style={s.infoItem}>
              <span style={s.infoLabel}>Medições no Relatório</span>
              <span style={s.infoValue}>{selectedMeasurements.length}</span>
            </div>
            <div style={s.infoItem}>
              <span style={s.infoLabel}>IOLs Implantadas</span>
              <span style={s.infoValue}>{patientIols.length}</span>
            </div>
          </div>
        </div>

        {/* IOL Table */}
        {patientIols.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>IOLs Implantadas</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Modelo</th>
                  <th style={s.th}>Fabricante</th>
                  <th style={s.th}>Tipo</th>
                  <th style={s.th}>Olho</th>
                  <th style={s.th}>Cirurgia</th>
                  <th style={s.th}>Alvo Refrativo</th>
                </tr>
              </thead>
              <tbody>
                {patientIols.map((iol, i) => (
                  <tr key={iol.id}>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {iol.iolModel ?? "—"}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {iol.manufacturerName ?? "—"}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {iol.iolType ? (IOL_TYPE_LABELS[iol.iolType] ?? iol.iolType) : "—"}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {EYE_LABELS[iol.eye] ?? iol.eye}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {iol.surgeryDate ? formatDate(iol.surgeryDate) : "—"}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {iol.refractiveTarget != null
                        ? (() => { const v = parseFloat(String(iol.refractiveTarget)); return `${v > 0 ? "+" : ""}${v.toFixed(2)} D`; })()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Chart */}
        {selectedIds.length > 0 && chartData.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Curva de Defoque (Defocus Curve)</div>
            <div style={s.chartContainer}>
              <div style={s.chartTitle}>Acuidade Visual × Defocus (D)</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 28 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <ReferenceArea x1={1.0} x2={-0.5} fill="#dbeafe" fillOpacity={0.4} />
                  <ReferenceArea x1={-0.5} x2={-1.75} fill="#dcfce7" fillOpacity={0.4} />
                  <ReferenceArea x1={-1.75} x2={-3.5} fill="#fef9c3" fillOpacity={0.4} />
                  <XAxis
                    dataKey="diopter"
                    type="number"
                    domain={[-3.5, 1.0]}
                    reversed={true}
                    ticks={[1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5]}
                    tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
                    label={{
                      value: "Defocus (D)",
                      position: "insideBottom",
                      offset: -14,
                      fontSize: 11,
                      fill: "#475569",
                    }}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis
                    domain={[-0.1, 0.6]}
                    reversed={true}
                    ticks={[-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]}
                    tickFormatter={(v) => v.toFixed(1)}
                    label={{
                      value: "Acuidade Visual (logMAR)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 5,
                      fontSize: 11,
                      fill: "#475569",
                    }}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) => [
                      typeof v === "number" ? v.toFixed(2) : v,
                      name,
                    ]}
                  />
                  <ReferenceLine
                    x={-0.5}
                    stroke="#93c5fd"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                  <ReferenceLine
                    x={-1.75}
                    stroke="#86efac"
                    strokeDasharray="2 2"
                    strokeWidth={1}
                  />
                  <ReferenceLine
                    y={0.2}
                    stroke="#ef4444"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{
                      value: "0.20 logMAR",
                      position: "insideTopRight",
                      fontSize: 9,
                      fill: "#ef4444",
                    }}
                  />
                  <ReferenceLine
                    x={0}
                    stroke="#3b82f6"
                    strokeDasharray="4 2"
                    strokeWidth={1.5}
                  />
                  {selectedIds.map((id, idx) => {
                    const m = measurements.find((x) => x.id === id);
                    const color = CHART_COLORS[idx % CHART_COLORS.length];
                    return (
                      <Line
                        key={id}
                        type="linear"
                        dataKey={`m_${id}`}
                        name={m ? getMeasurementLabel(m) : `Medição ${id}`}
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                      />
                    );
                  })}
                  <Legend
                    wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Zone legend */}
              <div style={s.zoneLegend}>
                <div style={s.zoneItem}>
                  <div style={s.zoneBox("#dbeafe")} />
                  <span>Longe (+1.0 a -0.5 D)</span>
                </div>
                <div style={s.zoneItem}>
                  <div style={s.zoneBox("#dcfce7")} />
                  <span>Intermédio (-0.5 a -1.75 D)</span>
                </div>
                <div style={s.zoneItem}>
                  <div style={s.zoneBox("#fef9c3")} />
                  <span>Perto (-1.75 a -3.5 D)</span>
                </div>
                <div style={s.zoneItem}>
                  <div
                    style={{
                      width: "20px",
                      height: "2px",
                      backgroundColor: "#ef4444",
                      borderTop: "2px dashed #ef4444",
                    }}
                  />
                  <span>Visão funcional (0.20 logMAR)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Measurements Summary */}
        {selectedMeasurements.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionTitle}>Medições Incluídas neste Relatório</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Data</th>
                  <th style={s.th}>Olho</th>
                  <th style={s.th}>IOL</th>
                  <th style={s.th}>Fabricante</th>
                </tr>
              </thead>
              <tbody>
                {selectedMeasurements.map((m, i) => (
                  <tr key={m.id}>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      <span
                        style={{
                          display: "inline-block",
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          marginRight: "6px",
                          verticalAlign: "middle",
                        }}
                      />
                      {i + 1}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {formatDate(m.measurementDate)}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {EYE_LABELS[m.eye] ?? m.eye}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {m.iolModel ?? "—"}
                    </td>
                    <td style={i % 2 === 0 ? s.td : s.tdAlt}>
                      {m.manufacturerName ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div style={s.footer}>
          <div>
            <strong>DefocusApp</strong> — Relatório gerado em {today}
          </div>
          <div style={{ textAlign: "right" as const }}>
            CASO-{patientId} · Dr(a). {doctorName}
          </div>
        </div>
      </div>
    );
  }
);

DefocusReportPDF.displayName = "DefocusReportPDF";
export default DefocusReportPDF;
