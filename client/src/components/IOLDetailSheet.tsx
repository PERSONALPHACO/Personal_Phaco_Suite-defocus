import { trpc } from "@/lib/trpc";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, Eye, Info, TrendingUp, Calendar } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type IOL = {
  id: number;
  model: string;
  type: string;
  manufacturerName: string | null;
  aConstant: string | null;
  opticDesign: string | null;
  material: string | null;
  powerRange: string | null;
  notes: string | null;
};

type IOLDetailSheetProps = {
  iol: IOL | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#2563eb", "#059669", "#d97706", "#7c3aed",
  "#dc2626", "#0891b2", "#be185d", "#65a30d",
  "#ea580c", "#0284c7", "#16a34a", "#9333ea",
];

const IOL_TYPE_LABELS: Record<string, string> = {
  monofocal: "Monofocal",
  bifocal: "Bifocal",
  trifocal: "Trifocal",
  edof: "EDOF",
  toric: "Tórica",
};

const IOL_TYPE_COLORS: Record<string, string> = {
  monofocal: "bg-slate-100 text-slate-700 border-slate-200",
  bifocal: "bg-blue-100 text-blue-700 border-blue-200",
  trifocal: "bg-primary/10 text-primary border-primary/20",
  edof: "bg-emerald-100 text-emerald-700 border-emerald-200",
  toric: "bg-amber-100 text-amber-700 border-amber-200",
};

const EYE_LABELS: Record<string, string> = {
  OD: "OD (Direito)",
  OS: "OS (Esquerdo)",
  OU: "Ambos",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-bold text-foreground mb-2 pb-1.5 border-b">
        {Number(label) > 0 ? "+" : ""}{label} D
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-muted-foreground truncate max-w-[90px]">{entry.name}</span>
          </div>
          <span className="font-bold text-foreground">{Number(entry.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IOLDetailSheet({ iol, open, onOpenChange }: IOLDetailSheetProps) {
  const { data, isLoading } = trpc.iols.curves.useQuery(
    { iolId: iol?.id ?? 0 },
    { enabled: open && !!iol?.id }
  );

  const curves = data?.curves ?? [];
  const n = data?.count ?? 0;

  // Build chart data: one column per diopter, one series per measurement
  const allDiopters = Array.from(
    new Set(curves.flatMap((c) => c.points.map((p) => p.diopter)))
  ).sort((a, b) => a - b);

  const chartData = allDiopters.map((d) => {
    const row: Record<string, any> = { diopter: d };
    curves.forEach((curve, idx) => {
      const pt = curve.points.find((p) => p.diopter === d);
      row[`curve_${idx}`] = pt?.visualAcuity ?? null;
    });
    return row;
  });

  // Calculate mean curve (average AV per diopter)
  const meanData = allDiopters.map((d) => {
    const vals = curves
      .map((c) => c.points.find((p) => p.diopter === d)?.visualAcuity)
      .filter((v): v is number => v !== undefined);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { diopter: d, mean: avg !== null ? parseFloat(avg.toFixed(3)) : null };
  });

  if (!iol) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <SheetTitle className="text-lg font-bold text-foreground leading-tight">
                  {iol.model}
                </SheetTitle>
              </div>
              <SheetDescription className="text-sm text-muted-foreground">
                {iol.manufacturerName}
              </SheetDescription>
            </div>
            <Badge
              variant="outline"
              className={`text-xs shrink-0 mt-1 ${IOL_TYPE_COLORS[iol.type] || "bg-muted text-muted-foreground"}`}
            >
              {IOL_TYPE_LABELS[iol.type] || iol.type}
            </Badge>
          </div>

          {/* Quick specs */}
          <div className="flex flex-wrap gap-3 mt-3">
            {iol.aConstant && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Constante A:</span>
                <span className="font-mono font-bold text-primary">{iol.aConstant}</span>
              </div>
            )}
            {iol.opticDesign && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Design:</span>
                <span className="font-medium text-foreground">{iol.opticDesign}</span>
              </div>
            )}
            {iol.material && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Material:</span>
                <span className="font-medium text-foreground">{iol.material}</span>
              </div>
            )}
          </div>
        </SheetHeader>

        <div className="px-6 py-5 space-y-6">

          {/* N counter */}
          <div className="flex items-center gap-4">
            <div className="flex-1 rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">
                  n = {isLoading ? "..." : n}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {n === 1 ? "curva de defoque registrada" : "curvas de defoque registradas"}
                </p>
              </div>
            </div>

            {n > 0 && (
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">
                    {allDiopters.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">pontos por curva</p>
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          {isLoading ? (
            <div className="h-64 rounded-xl border bg-muted/20 flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 animate-pulse" />
                <p className="text-sm text-muted-foreground">Carregando curvas...</p>
              </div>
            </div>
          ) : n === 0 ? (
            <div className="h-64 rounded-xl border bg-muted/10 flex items-center justify-center">
              <div className="text-center px-6">
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Nenhuma curva registrada ainda
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Associe esta IOL a um paciente e registre uma medição de acuidade visual
                  para que as curvas apareçam aqui.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Curvas de Defoque Individuais
                </h3>
                <span className="text-xs text-muted-foreground">
                  {n} {n === 1 ? "medição" : "medições"}
                </span>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
                    <XAxis
                      dataKey="diopter"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                      label={{
                        value: "Defoque (D)",
                        position: "insideBottom",
                        offset: -12,
                        fontSize: 11,
                        fill: "oklch(0.50 0.03 240)",
                      }}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      domain={[0, 1.1]}
                      tickCount={7}
                      tickFormatter={(v) => v.toFixed(1)}
                      label={{
                        value: "AV (decimal)",
                        angle: -90,
                        position: "insideLeft",
                        offset: 15,
                        fontSize: 11,
                        fill: "oklch(0.50 0.03 240)",
                      }}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                      x={0}
                      stroke="oklch(0.50 0.20 240)"
                      strokeDasharray="6 3"
                      strokeWidth={1.5}
                    />
                    <ReferenceLine
                      y={0.5}
                      stroke="oklch(0.55 0.22 25)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      label={{ value: "20/40", position: "right", fontSize: 9, fill: "oklch(0.55 0.22 25)" }}
                    />
                    {curves.map((curve, idx) => (
                      <Line
                        key={curve.measurementId}
                        type="monotone"
                        dataKey={`curve_${idx}`}
                        name={`Curva ${idx + 1} (${EYE_LABELS[curve.eye] || curve.eye})`}
                        stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                        strokeWidth={1.5}
                        strokeOpacity={0.7}
                        dot={{ r: 3, strokeWidth: 1.5, fill: "white" }}
                        activeDot={{ r: 5 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Mean curve */}
              {n >= 2 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">Curva Média</h3>
                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                      n = {n}
                    </Badge>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={meanData} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
                        <XAxis
                          dataKey="diopter"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                          label={{
                            value: "Defoque (D)",
                            position: "insideBottom",
                            offset: -12,
                            fontSize: 11,
                            fill: "oklch(0.50 0.03 240)",
                          }}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          domain={[0, 1.1]}
                          tickCount={6}
                          tickFormatter={(v) => v.toFixed(1)}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine x={0} stroke="oklch(0.50 0.20 240)" strokeDasharray="6 3" strokeWidth={1.5} />
                        <ReferenceLine y={0.5} stroke="oklch(0.55 0.22 25)" strokeDasharray="4 4" strokeWidth={1} />
                        <Line
                          type="monotone"
                          dataKey="mean"
                          name="Média"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Measurement list */}
          {n > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Medições Registradas</h3>
                <div className="space-y-2">
                  {curves.map((curve, idx) => (
                    <div
                      key={curve.measurementId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">
                            Curva {idx + 1}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {EYE_LABELS[curve.eye] || curve.eye}
                          </Badge>
                          {curve.refractiveTarget && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                              Alvo: {Number(curve.refractiveTarget) > 0 ? "+" : ""}{Number(curve.refractiveTarget).toFixed(2)} D
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">
                            {curve.measurementDate
                              ? new Date(curve.measurementDate).toLocaleDateString("pt-BR")
                              : "—"}
                          </span>
                          <span className="text-[11px] text-muted-foreground ml-2">
                            {curve.points.length} pontos
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* LGPD note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/20 border border-muted">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Dados exibidos de forma anonimizada, sem identificação de pacientes, em conformidade com a LGPD (Lei 13.709/2018).
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
