import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, ArrowLeft, Plus, Trash2, Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import IOLCascadeSelect from "@/components/IOLCascadeSelect";

// Standard defocus curve diopter values
const DEFAULT_DIOPTERS = [-5, -4.5, -4, -3.5, -3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1];

type MeasurementPoint = {
  diopter: number;
  visualAcuity: string;
};

export default function NewMeasurement() {
  const params = useParams<{ id: string }>();
  const patientId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: patient } = trpc.patients.byId.useQuery({ id: patientId });
  const { data: patientIols = [] } = trpc.patientIols.list.useQuery({ patientId });

  const [measurementDate, setMeasurementDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [eye, setEye] = useState("OD");
  const [patientIolId, setPatientIolId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [points, setPoints] = useState<MeasurementPoint[]>(
    DEFAULT_DIOPTERS.map((d) => ({ diopter: d, visualAcuity: "" }))
  );

  const createMeasurement = trpc.measurements.create.useMutation({
    onSuccess: () => {
      toast.success("Medição registrada com sucesso!");
      setLocation(`/patients/${patientId}`);
    },
    onError: (err) => toast.error("Erro ao registrar medição: " + err.message),
  });

  const updatePoint = (index: number, value: string) => {
    setPoints((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], visualAcuity: value };
      return updated;
    });
  };

  const addCustomDiopter = () => {
    const value = prompt("Digite o valor de defoque em dioptrias (ex: -2.75):");
    if (!value) return;
    const d = parseFloat(value);
    if (isNaN(d) || d < -6 || d > 3) {
      toast.error("Valor inválido. Use um número entre -6 e +3");
      return;
    }
    if (points.some((p) => p.diopter === d)) {
      toast.error("Este valor já existe");
      return;
    }
    setPoints((prev) =>
      [...prev, { diopter: d, visualAcuity: "" }].sort((a, b) => a.diopter - b.diopter)
    );
  };

  const removePoint = (index: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const validPoints = points.filter(
      (p) => p.visualAcuity !== "" && !isNaN(parseFloat(p.visualAcuity))
    );

    if (validPoints.length < 2) {
      toast.error("Registre ao menos 2 pontos de acuidade visual");
      return;
    }

    const invalidVA = validPoints.find((p) => {
      const va = parseFloat(p.visualAcuity);
      return va < 0 || va > 2.0;
    });

    if (invalidVA) {
      toast.error("Acuidade visual deve estar entre 0.0 e 2.0");
      return;
    }

    createMeasurement.mutate({
      patientId,
      patientIolId: patientIolId && patientIolId !== "none" ? parseInt(patientIolId) : undefined,
      measurementDate,
      eye: eye as any,
      notes: notes || undefined,
      points: validPoints.map((p) => ({
        diopter: p.diopter,
        visualAcuity: parseFloat(p.visualAcuity),
      })),
    });
  };

  // Preview chart data
  const chartData = points
    .filter((p) => p.visualAcuity !== "" && !isNaN(parseFloat(p.visualAcuity)))
    .map((p) => ({
      diopter: p.diopter,
      va: parseFloat(p.visualAcuity),
    }));

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(`/patients/${patientId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nova Medição</h1>
            {patient && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Paciente: <span className="font-medium text-foreground">{patient.name}</span>
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-4">
            {/* Measurement Info */}
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Informações da Medição
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Data da Medição *</Label>
                    <Input
                      type="date"
                      value={measurementDate}
                      onChange={(e) => setMeasurementDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Olho *</Label>
                    <Select value={eye} onValueChange={setEye}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OD">OD (Direito)</SelectItem>
                        <SelectItem value="OS">OS (Esquerdo)</SelectItem>
                        <SelectItem value="OU">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-foreground">IOL Associada (opcional)</Label>
                  {patientIols.length > 0 ? (
                    <Select value={patientIolId} onValueChange={setPatientIolId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a IOL do paciente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem IOL específica</SelectItem>
                        {patientIols.map((piol) => (
                          <SelectItem key={piol.id} value={piol.id.toString()}>
                            {piol.eye} — {piol.manufacturerName} {piol.iolModel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground italic p-2 bg-muted/30 rounded-lg border">
                      Nenhuma IOL associada a este paciente. Associe uma IOL no perfil do paciente primeiro.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Condições de teste, observações..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Data Points */}
            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Pontos de Acuidade Visual
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Insira a acuidade visual (decimal) para cada valor de defoque
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCustomDiopter}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar D
                </Button>
              </CardHeader>
              <CardContent>
                {/* Info box */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10 mb-4">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Insira a acuidade visual em decimal (ex: 1.0 = 20/20, 0.8 = 20/25, 0.5 = 20/40). 
                    Deixe em branco os pontos não medidos.
                  </p>
                </div>

                {/* Grid of inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {points.map((point, idx) => (
                    <div key={point.diopter} className="flex items-center gap-1.5">
                      <div className="flex-1 relative">
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-primary/70 pointer-events-none">
                          {point.diopter > 0 ? `+${point.diopter}` : point.diopter}D
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max="2.0"
                          step="0.05"
                          value={point.visualAcuity}
                          onChange={(e) => updatePoint(idx, e.target.value)}
                          className="pl-12 text-right font-mono text-sm"
                          placeholder="—"
                        />
                      </div>
                      {!DEFAULT_DIOPTERS.includes(point.diopter) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removePoint(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Quick fill helpers */}
                <div className="mt-4 pt-4 border-t flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Preencher rápido:</span>
                  {[
                    { label: "Trifocal típico", values: { 0: 1.0, "-0.5": 0.9, "-1": 0.7, "-1.5": 0.8, "-2": 0.9, "-2.5": 0.7, "-3": 0.5, "-3.5": 0.3, "-4": 0.2, "-4.5": 0.15, "-5": 0.1, "0.5": 0.7, "1": 0.4 } },
                    { label: "EDOF típico", values: { 0: 1.0, "-0.5": 0.95, "-1": 0.85, "-1.5": 0.8, "-2": 0.75, "-2.5": 0.6, "-3": 0.4, "-3.5": 0.25, "-4": 0.15, "-4.5": 0.1, "-5": 0.08, "0.5": 0.8, "1": 0.5 } },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        setPoints((prev) =>
                          prev.map((p) => ({
                            ...p,
                            visualAcuity: (preset.values as any)[p.diopter.toString()] !== undefined
                              ? String((preset.values as any)[p.diopter.toString()])
                              : p.visualAcuity,
                          }))
                        );
                        toast.info(`Valores de exemplo "${preset.label}" carregados`);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setLocation(`/patients/${patientId}`)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMeasurement.isPending}
                className="flex-1 bg-primary text-primary-foreground font-semibold"
              >
                {createMeasurement.isPending ? "Salvando..." : "Registrar Medição"}
              </Button>
            </div>
          </div>

          {/* Right: Live Preview Chart */}
          <div className="lg:col-span-2">
            <Card className="border sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Pré-visualização
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length < 2 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-center">
                    <Activity className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Insira ao menos 2 pontos para visualizar a curva
                    </p>
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 15, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
                        <XAxis
                          dataKey="diopter"
                          type="number"
                          domain={[-5, 1.5]}
                          tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                          label={{ value: "Defoque (D)", position: "insideBottom", offset: -10, fontSize: 10 }}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis
                          domain={[0, 1.1]}
                          tickCount={6}
                          tickFormatter={(v) => v.toFixed(1)}
                          label={{ value: "AV", angle: -90, position: "insideLeft", offset: 12, fontSize: 10 }}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          formatter={(v: any) => [Number(v).toFixed(2), "AV"]}
                          labelFormatter={(l) => `${l > 0 ? "+" : ""}${l} D`}
                        />
                        <ReferenceLine x={0} stroke="oklch(0.50 0.20 240)" strokeDasharray="4 2" strokeWidth={1.5} />
                        <Line
                          type="monotone"
                          dataKey="va"
                          stroke="oklch(0.50 0.20 240)"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "oklch(0.50 0.20 240)", strokeWidth: 0 }}
                          activeDot={{ r: 6 }}
                          name="Acuidade Visual"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Summary */}
                {chartData.length > 0 && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Pontos</p>
                      <p className="text-lg font-bold text-foreground">{chartData.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">AV Máx.</p>
                      <p className="text-lg font-bold text-primary">
                        {Math.max(...chartData.map((d) => d.va)).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">AV Mín.</p>
                      <p className="text-lg font-bold text-muted-foreground">
                        {Math.min(...chartData.map((d) => d.va)).toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DefocusLayout>
  );
}
