import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Activity, Download, Eye, GitCompare, Info, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import IOLCascadeSelect from "@/components/IOLCascadeSelect";

const CHART_COLORS = [
  "#2563eb", // Medical Blue
  "#059669", // Emerald
  "#d97706", // Amber
  "#7c3aed", // Violet
  "#dc2626", // Red
  "#0891b2", // Cyan
  "#be185d", // Pink
  "#65a30d", // Lime
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

// Typical defocus curve profiles in logMAR (clinical standard)
// logMAR = -log10(decimal): 0.00 = 20/20, 0.10 = 20/25, 0.20 = 20/32, 0.30 = 20/40, 0.60 = 20/80
const REFERENCE_CURVES: Record<string, Record<string, number>> = {
  //          +1.0   +0.5   0.0   -0.5   -1.0   -1.5   -2.0   -2.5   -3.0   -3.5
  trifocal:  { "1": 0.40, "0.5": 0.10, "0": 0.00, "-0.5": 0.10, "-1": 0.22, "-1.5": 0.10, "-2": 0.05, "-2.5": 0.22, "-3": 0.40, "-3.5": 0.52 },
  edof:      { "1": 0.30, "0.5": 0.08, "0": 0.00, "-0.5": 0.05, "-1": 0.10, "-1.5": 0.10, "-2": 0.15, "-2.5": 0.25, "-3": 0.40, "-3.5": 0.55 },
  monofocal: { "1": 0.22, "0.5": 0.05, "0": 0.00, "-0.5": 0.10, "-1": 0.22, "-1.5": 0.40, "-2": 0.52, "-2.5": 0.60, "-3": 0.60, "-3.5": 0.60 },
  bifocal:   { "1": 0.40, "0.5": 0.10, "0": 0.00, "-0.5": 0.10, "-1": 0.30, "-1.5": 0.40, "-2": 0.15, "-2.5": 0.10, "-3": 0.30, "-3.5": 0.50 },
  toric:     { "1": 0.22, "0.5": 0.05, "0": 0.00, "-0.5": 0.10, "-1": 0.22, "-1.5": 0.40, "-2": 0.52, "-2.5": 0.60, "-3": 0.60, "-3.5": 0.60 },
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl shadow-xl p-3 text-xs min-w-[180px]">
      <p className="font-bold text-foreground mb-2 pb-1.5 border-b">
        {Number(label) > 0 ? "+" : ""}{Number(label).toFixed(2)} D
      </p>
      {payload.map((entry: any) => {
        const lm = Number(entry.value);
        const snellen = `20/${Math.round(20 * Math.pow(10, lm))}`;
        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
              <span className="text-muted-foreground truncate max-w-[100px]">{entry.name}</span>
            </div>
            <span className="font-bold text-foreground">{lm.toFixed(2)} ({snellen})</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Compare() {
  const [selectedIolIds, setSelectedIolIds] = useState<number[]>([]);
  const [addingId, setAddingId] = useState<number | undefined>(undefined);
  const [showReference, setShowReference] = useState(false);

  const { data: allIols = [] } = trpc.iols.list.useQuery();


  const addIOL = () => {
    if (!addingId) return;
    if (selectedIolIds.includes(addingId)) {
      toast.error("Esta IOL já está na comparação");
      return;
    }
    if (selectedIolIds.length >= 8) {
      toast.error("Máximo de 8 IOLs na comparação");
      return;
    }
    setSelectedIolIds((prev) => [...prev, addingId]);
    setAddingId(undefined);
  };

  const removeIOL = (id: number) => {
    setSelectedIolIds((prev) => prev.filter((x) => x !== id));
  };

  const selectedIols = allIols.filter((iol) => selectedIolIds.includes(iol.id));

  // Build chart data with reference curves for selected IOLs (clinical range +1.0 to -3.5 D)
  const diopters = [1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5];

  const chartData = diopters.map((d) => {
    const row: Record<string, any> = { diopter: d };
    selectedIols.forEach((iol) => {
      const refCurve = REFERENCE_CURVES[iol.type] || REFERENCE_CURVES["monofocal"];
      row[`iol_${iol.id}`] = refCurve[d.toString()] ?? null;
    });
    return row;
  });

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comparação de IOLs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compare curvas Defocus de múltiplas lentes intraoculares
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Exportação de gráfico em breve", { description: "Esta funcionalidade estará disponível em uma próxima versão." })}
            className="shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Gráfico
          </Button>
        </div>

        {/* Demo notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Curvas de Referência</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              As curvas exibidas são perfis de referência baseados no tipo de IOL (trifocal, EDOF, monofocal). 
              Para curvas baseadas em dados reais de seus pacientes, registre medições na seção de Pacientes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: IOL Selector */}
          <div className="space-y-4">
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-primary" />
                  IOLs Selecionadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Add IOL */}
                <div className="space-y-2">
                  <IOLCascadeSelect
                    selectedIolId={addingId}
                    onChange={setAddingId}
                    allowNone={false}
                  />
                  <Button
                    onClick={addIOL}
                    disabled={!addingId}
                    size="sm"
                    className="w-full bg-primary text-primary-foreground"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Adicionar à Comparação
                  </Button>
                </div>

                {/* Selected IOLs */}
                {selectedIols.length === 0 ? (
                  <div className="text-center py-6">
                    <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Selecione IOLs para comparar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedIols.map((iol, idx) => (
                      <div
                        key={iol.id}
                        className="flex items-center gap-2 p-2.5 rounded-lg border bg-card"
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {iol.model}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {iol.manufacturerName}
                          </p>
                        </div>
                        <button
                          onClick={() => removeIOL(iol.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedIols.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setSelectedIolIds([])}
                  >
                    Limpar seleção
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick presets */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Comparações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    label: "Trifocais Alcon",
                    ids: allIols.filter((i) => i.type === "trifocal" && i.manufacturerName === "Alcon").map((i) => i.id),
                  },
                  {
                    label: "Todos os EDOFs",
                    ids: allIols.filter((i) => i.type === "edof").slice(0, 4).map((i) => i.id),
                  },
                  {
                    label: "Trifocal vs EDOF",
                    ids: [
                      allIols.find((i) => i.type === "trifocal")?.id,
                      allIols.find((i) => i.type === "edof")?.id,
                    ].filter(Boolean) as number[],
                  },
                ]
                  .filter((p) => p.ids.length > 0)
                  .map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      className="w-full text-xs justify-start"
                      onClick={() => setSelectedIolIds(preset.ids)}
                    >
                      {preset.label}
                    </Button>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Chart + Details */}
          <div className="lg:col-span-3 space-y-4">
            {/* Chart */}
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  curvas Defocus Comparativas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedIols.length === 0 ? (
                  <div className="h-80 flex flex-col items-center justify-center text-center">
                    <GitCompare className="w-14 h-14 text-muted-foreground mb-4" />
                    <p className="font-medium text-foreground">Nenhuma IOL selecionada</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Selecione IOLs no painel à esquerda para comparar suas curvas Defocus
                    </p>
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
                        {/*
                          X: +1.0 at LEFT → -3.5 at RIGHT (clinical standard)
                          Y: -0.1 at TOP (best) → 0.6 at BOTTOM (worst)
                        */}
                        <XAxis
                          dataKey="diopter"
                          type="number"
                          domain={[-3.5, 1.0]}
                          reversed={true}
                          ticks={[1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5]}
                          tickFormatter={(v) => `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}`}
                          label={{
                            value: "Defocus (D)",
                            position: "insideBottom",
                            offset: -12,
                            fontSize: 12,
                            fill: "oklch(0.50 0.03 240)",
                          }}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0.6, -0.1]}
                          reversed={false}
                          ticks={[-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]}
                          tickFormatter={(v) => v.toFixed(1)}
                          label={{
                            value: "logMAR",
                            angle: -90,
                            position: "insideLeft",
                            offset: 15,
                            fontSize: 12,
                            fill: "oklch(0.50 0.03 240)",
                          }}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                          formatter={(value) => (
                            <span className="text-foreground">{value}</span>
                          )}
                        />
                        {/* Vision zone backgrounds */}
                        <ReferenceLine x={-0.5}  stroke="#93c5fd" strokeDasharray="2 2" strokeWidth={1} />
                        <ReferenceLine x={-1.75} stroke="#86efac" strokeDasharray="2 2" strokeWidth={1} />
                        {/* Functional cutoff at 0.20 logMAR */}
                        <ReferenceLine
                          y={0.20}
                          stroke="#ef4444"
                          strokeDasharray="6 3"
                          strokeWidth={1.5}
                          label={{ value: "0.20 logMAR (20/32)", position: "insideTopRight", fontSize: 9, fill: "#ef4444" }}
                        />
                        {/* Plano (0 D) reference */}
                        <ReferenceLine
                          x={0}
                          stroke="#3b82f6"
                          strokeDasharray="4 2"
                          strokeWidth={1.5}
                          label={{ value: "Plano", position: "top", fontSize: 9, fill: "#3b82f6" }}
                        />
                        {selectedIols.map((iol, idx) => (
                          <Line
                            key={iol.id}
                            type="monotone"
                            dataKey={`iol_${iol.id}`}
                            name={`${iol.model} (${IOL_TYPE_LABELS[iol.type] || iol.type})`}
                            stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                            strokeWidth={2.5}
                            dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                            activeDot={{ r: 6 }}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* IOL Details Table */}
            {selectedIols.length > 0 && (
              <Card className="border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Especificações Técnicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">IOL</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Fabricante</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Tipo</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-muted-foreground">Constante A</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Design</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Material</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedIols.map((iol, idx) => (
                          <tr key={iol.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                                />
                                <span className="font-semibold text-foreground">{iol.model}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{iol.manufacturerName}</td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`text-xs ${IOL_TYPE_COLORS[iol.type] || "bg-muted text-muted-foreground"}`}
                              >
                                {IOL_TYPE_LABELS[iol.type] || iol.type}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {iol.aConstant ? (
                                <span className="font-mono font-semibold text-primary">{iol.aConstant}</span>
                              ) : (
                                <span className="text-muted-foreground italic text-[10px]">Consultar</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{iol.opticDesign || "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{iol.material || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DefocusLayout>
  );
}
