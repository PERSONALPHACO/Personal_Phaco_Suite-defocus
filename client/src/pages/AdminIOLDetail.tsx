import { trpc } from "@/lib/trpc";
import DefocusLayout from "@/components/DefocusLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useParams } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import { ArrowLeft, Eye, Activity, Users, BarChart2 } from "lucide-react";

const IOL_TYPE_LABEL: Record<string, string> = {
  monofocal: "Monofocal",
  bifocal: "Bifocal",
  trifocal: "Trifocal",
  edof: "EDOF",
  toric: "Tórica",
};

const IOL_TYPE_COLOR: Record<string, string> = {
  monofocal: "bg-blue-100 text-blue-700",
  bifocal: "bg-purple-100 text-purple-700",
  trifocal: "bg-green-100 text-green-700",
  edof: "bg-amber-100 text-amber-700",
  toric: "bg-rose-100 text-rose-700",
};

function logmarToSnellen(logmar: number): string {
  if (logmar <= 0.0) return "20/20";
  if (logmar <= 0.1) return "20/25";
  if (logmar <= 0.2) return "20/32";
  if (logmar <= 0.3) return "20/40";
  if (logmar <= 0.4) return "20/50";
  if (logmar <= 0.5) return "20/63";
  if (logmar <= 0.6) return "20/80";
  if (logmar <= 0.7) return "20/100";
  if (logmar <= 0.8) return "20/125";
  if (logmar <= 1.0) return "20/200";
  return ">20/200";
}

interface TooltipPayload {
  value: number;
  name: string;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const avgEntry = payload.find((p) => p.name === "Média");
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label} D</p>
      {avgEntry && (
        <>
          <p className="text-blue-600">Média: {avgEntry.value.toFixed(2)} logMAR</p>
          <p className="text-gray-500">Snellen: {logmarToSnellen(avgEntry.value)}</p>
        </>
      )}
    </div>
  );
}

export default function AdminIOLDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const iolId = parseInt(params.id ?? "0");

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  const { data: iolData, isLoading: iolLoading } = trpc.iols.byId.useQuery(
    { id: iolId },
    { enabled: !!user && user.role === "admin" && !!iolId }
  );

  const { data: curveData, isLoading: curveLoading } = trpc.admin.iolCurve.useQuery(
    { iolId },
    { enabled: !!user && user.role === "admin" && !!iolId }
  );

  if (loading || !user) return null;
  if (user.role !== "admin") return null;

  const isLoading = iolLoading || curveLoading;

  // Preparar dados para o gráfico
  const chartData = (curveData?.points ?? []).map((p) => ({
    diopter: p.diopter.toFixed(2),
    avg: parseFloat(p.avgVisualAcuity.toFixed(3)),
    upper: parseFloat((p.avgVisualAcuity + p.stdDev).toFixed(3)),
    lower: parseFloat(Math.max(0, p.avgVisualAcuity - p.stdDev).toFixed(3)),
    count: p.count,
  }));

  const hasData = chartData.length > 0;

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Painel Admin
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Carregando dados da IOL...
          </div>
        ) : !iolData ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            IOL não encontrada.
          </div>
        ) : (
          <>
            {/* IOL Info */}
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Eye className="h-6 w-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{iolData.model}</h1>
                  {iolData.type && (
                    <Badge className={`${IOL_TYPE_COLOR[iolData.type] || "bg-gray-100 text-gray-600"} border-0`}>
                      {IOL_TYPE_LABEL[iolData.type] || iolData.type}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {iolData.manufacturerName || "Fabricante desconhecido"}
                  {iolData.material && ` · ${iolData.material}`}
                  {iolData.opticDesign && ` · ${iolData.opticDesign}`}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Casos</p>
                      <p className="text-2xl font-bold">{curveData?.caseCount ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Médicos</p>
                      <p className="text-2xl font-bold">{curveData?.doctorCount ?? 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Pontos</p>
                      <p className="text-2xl font-bold">{chartData.reduce((s, p) => s + p.count, 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  Curva Defocus Média
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    — média de todos os casos registrados na plataforma
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!hasData ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                    <Activity className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Nenhuma medição registrada para esta IOL ainda.</p>
                    <p className="text-xs">A curva aparecerá quando médicos registrarem medições com esta IOL.</p>
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="diopter"
                          label={{ value: "Dioptria (D)", position: "insideBottom", offset: -5, fontSize: 11 }}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          reversed
                          domain={[-0.1, 1.2]}
                          tickFormatter={(v) => v.toFixed(1)}
                          label={{ value: "logMAR", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "20/40", position: "right", fontSize: 10, fill: "#f59e0b" }} />
                        <ReferenceLine y={0.0} stroke="#10b981" strokeDasharray="4 4" label={{ value: "20/20", position: "right", fontSize: 10, fill: "#10b981" }} />
                        {/* Faixa de desvio padrão */}
                        <Area
                          type="monotone"
                          dataKey="upper"
                          fill="#3b82f620"
                          stroke="none"
                          legendType="none"
                          name="upper"
                        />
                        <Area
                          type="monotone"
                          dataKey="lower"
                          fill="#ffffff"
                          stroke="none"
                          legendType="none"
                          name="lower"
                        />
                        {/* Linha média */}
                        <Line
                          type="monotone"
                          dataKey="avg"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          dot={{ fill: "#3b82f6", r: 4 }}
                          activeDot={{ r: 6 }}
                          name="Média"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {hasData && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    A faixa azul clara representa ±1 desvio padrão em torno da média.
                    Eixo Y invertido: valores menores (topo) = melhor acuidade visual.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DefocusLayout>
  );
}
