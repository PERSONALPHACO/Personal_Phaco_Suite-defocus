import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Activity, Download, Eye, GitCompare, Plus, X, TrendingUp } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
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
  monofocal_plus: "Monofocal Plus",
  bifocal: "Bifocal",
  trifocal: "Trifocal",
  edof: "EDOF",
  toric: "Tórica",
};

const DIOPTERS = [1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5];

// Converte Snellen decimal para logMAR
function toLogMAR(snellen: number): number {
  if (snellen <= 0) return 1.0;
  return parseFloat((-Math.log10(snellen)).toFixed(4));
}

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

// Componente que busca e processa a curva média de uma IOL
function useIOLAverageCurve(iolId: number | undefined) {
  const { data, isLoading } = trpc.iols.curves.useQuery(
    { iolId: iolId! },
    { enabled: !!iolId }
  );

  const averageCurve = useMemo(() => {
    if (!data || data.curves.length === 0) return null;

    // Para cada ponto de dioptria, calcular a média logMAR de todas as curvas
    const avgByDiopter: Record<number, number> = {};
    for (const d of DIOPTERS) {
      const values: number[] = [];
      for (const curve of data.curves) {
        const pt = curve.points.find((p) => Math.abs(p.diopter - d) < 0.01);
        if (pt && pt.visualAcuity > 0) {
          values.push(toLogMAR(pt.visualAcuity));
        }
      }
      if (values.length > 0) {
        avgByDiopter[d] = parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4));
      }
    }
    return { avgByDiopter, count: data.count };
  }, [data]);

  return { averageCurve, isLoading, count: data?.count ?? 0 };
}

// Componente interno que carrega a curva de uma IOL
function IOLCurveLoader({
  iolId,
  onReady,
}: {
  iolId: number;
  onReady: (iolId: number, avgByDiopter: Record<number, number> | null, count: number) => void;
}) {
  const { averageCurve, count } = useIOLAverageCurve(iolId);

  // Notifica o pai quando os dados chegam (useEffect evita setState durante render)
  useEffect(() => {
    onReady(iolId, averageCurve?.avgByDiopter ?? null, count);
  }, [iolId, averageCurve, count, onReady]);

  return null;
}

export default function Compare() {
  const [selectedIolIds, setSelectedIolIds] = useState<number[]>([]);
  const [addingId, setAddingId] = useState<number | undefined>(undefined);
  // Map: iolId → { avgByDiopter, count }
  const [curveData, setCurveData] = useState<Record<number, { avg: Record<number, number> | null; count: number }>>({});

  const { data: allIols = [] } = trpc.iols.list.useQuery();

  const handleCurveReady = useMemo(
    () => (iolId: number, avg: Record<number, number> | null, count: number) => {
      setCurveData((prev) => {
        if (prev[iolId]?.avg === avg && prev[iolId]?.count === count) return prev;
        return { ...prev, [iolId]: { avg, count } };
      });
    },
    []
  );

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
    setCurveData((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const selectedIols = allIols.filter((iol) => selectedIolIds.includes(iol.id));

  // Montar chartData com médias reais
  const chartData = useMemo(() => {
    return DIOPTERS.map((d) => {
      const row: Record<string, any> = { diopter: d };
      selectedIols.forEach((iol) => {
        const cd = curveData[iol.id];
        row[`iol_${iol.id}`] = cd?.avg?.[d] ?? null;
      });
      return row;
    });
  }, [selectedIols, curveData]);

  const hasAnyData = selectedIols.some((iol) => {
    const cd = curveData[iol.id];
    return cd?.count && cd.count > 0;
  });

  return (
    <DefocusLayout>
      {/* Loaders invisíveis para buscar dados de cada IOL selecionada */}
      {selectedIolIds.map((id) => (
        <IOLCurveLoader key={id} iolId={id} onReady={handleCurveReady} />
      ))}

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Comparação de IOLs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compare curvas Defocus médias baseadas em dados reais dos pacientes
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
                    {selectedIols.map((iol, idx) => {
                      const cd = curveData[iol.id];
                      return (
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
                              {cd?.count
                                ? `n = ${cd.count} curva${cd.count !== 1 ? "s" : ""}`
                                : "Sem dados reais"}
                            </p>
                          </div>
                          <button
                            onClick={() => removeIOL(iol.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedIols.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => {
                      setSelectedIolIds([]);
                      setCurveData({});
                    }}
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
                    label: "Trifocais",
                    ids: allIols.filter((i) => i.type === "trifocal").slice(0, 4).map((i) => i.id),
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
                      onClick={() => {
                        setCurveData({});
                        setSelectedIolIds(preset.ids);
                      }}
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
                  Curvas Defocus Comparativas
                  {hasAnyData && (
                    <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Média das curvas reais
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedIols.length === 0 ? (
                  <div className="h-80 flex flex-col items-center justify-center text-center">
                    <GitCompare className="w-14 h-14 text-muted-foreground mb-4" />
                    <p className="font-medium text-foreground">Nenhuma IOL selecionada</p>
                    <p className="text-sm text-muted-foreground mt-1 max-xs">
                      Selecione IOLs no painel à esquerda para comparar suas curvas Defocus
                    </p>
                  </div>
                ) : !hasAnyData ? (
                  <div className="h-80 flex flex-col items-center justify-center text-center">
                    <TrendingUp className="w-14 h-14 text-muted-foreground mb-4" />
                    <p className="font-medium text-foreground">Sem dados reais para as IOLs selecionadas</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                      Registre medições de acuidade visual para pacientes com essas IOLs implantadas para que as curvas apareçam aqui.
                    </p>
                  </div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
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
                          domain={[-0.1, 0.6]}
                          reversed={true}
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
                        {selectedIols.map((iol, idx) => {
                          const cd = curveData[iol.id];
                          if (!cd?.count) return null;
                          return (
                            <Line
                              key={iol.id}
                              type="linear"
                              dataKey={`iol_${iol.id}`}
                              name={`${iol.model} (n=${cd.count})`}
                              stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                              strokeWidth={2.5}
                              dot={{ r: 4, strokeWidth: 2, fill: "white" }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                          );
                        })}
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
                          <th className="text-left p-3 font-semibold text-muted-foreground">IOL</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Fabricante</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Tipo</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Material</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Const. A</th>
                          <th className="text-left p-3 font-semibold text-muted-foreground">Curvas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedIols.map((iol, idx) => {
                          const cd = curveData[iol.id];
                          return (
                            <tr key={iol.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                                  />
                                  <span className="font-semibold text-foreground">{iol.model}</span>
                                </div>
                              </td>
                              <td className="p-3 text-muted-foreground">{iol.manufacturerName}</td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                  {IOL_TYPE_LABELS[iol.type] || iol.type}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground">{iol.material || "—"}</td>
                              <td className="p-3 text-muted-foreground">{(iol as any).aConstant ?? "—"}</td>
                              <td className="p-3">
                                <span className={`font-semibold ${cd?.count ? "text-primary" : "text-muted-foreground"}`}>
                                  {cd?.count ? `n = ${cd.count}` : "Sem dados"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
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
