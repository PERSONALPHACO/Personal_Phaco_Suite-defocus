import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Eye,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import { useState, useMemo } from "react";
import IOLCascadeSelect from "@/components/IOLCascadeSelect";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  ReferenceArea,
} from "recharts";

const CHART_COLORS = [
  "#2563eb", // blue
  "#059669", // emerald
  "#d97706", // amber
  "#7c3aed", // violet
  "#dc2626", // red
  "#0891b2", // cyan
];

const EYE_LABELS: Record<string, string> = { OD: "OD (Direito)", OS: "OS (Esquerdo)", OU: "Ambos" };
const IOL_TYPE_LABELS: Record<string, string> = {
  monofocal: "Monofocal", bifocal: "Bifocal", trifocal: "Trifocal", edof: "EDOF", toric: "Tórica",
};

type PatientIOLFormData = {
  iolId: string;
  eye: string;
  surgeryDate: string;
  refractiveTarget: string;
  notes: string;
};

// ─── logMAR helpers (client-side, mirrors server/defocusCurve.ts) ─────────────
function decimalToLogMAR(d: number): number {
  if (d <= 0) return 3.0;
  return -Math.log10(d);
}
function logMARToSnellen(l: number): string {
  return `20/${Math.round(20 * Math.pow(10, l))}`;
}

// Monotone cubic spline (Fritsch–Carlson) — client-side for live preview
function monotonicSpline(pts: {x:number;y:number}[]): (x:number)=>number {
  const n = pts.length;
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  const delta = xs.slice(0,-1).map((_,i)=>(ys[i+1]-ys[i])/(xs[i+1]-xs[i]));
  const m: number[] = new Array(n);
  m[0]=delta[0]; m[n-1]=delta[n-2];
  for(let i=1;i<n-1;i++) m[i]=(delta[i-1]+delta[i])/2;
  for(let i=0;i<n-1;i++){
    if(Math.abs(delta[i])<1e-12){m[i]=0;m[i+1]=0;}
    else{const a=m[i]/delta[i],b=m[i+1]/delta[i],t=a*a+b*b;
      if(t>9){const s=3/Math.sqrt(t);m[i]=s*a*delta[i];m[i+1]=s*b*delta[i];}}
  }
  return (x:number)=>{
    if(x<=xs[0])return ys[0]; if(x>=xs[n-1])return ys[n-1];
    let lo=0,hi=n-2;
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(xs[mid]<x)lo=mid+1;else hi=mid;}
    const i=Math.max(0,lo-1),h=xs[i+1]-xs[i],t=(x-xs[i])/h,t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1];
  };
}

// Custom tooltip for Defocus chart
function DefocusTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = Number(label);
  const dLabel = `${d > 0 ? "+" : ""}${d.toFixed(2)} D`;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-1.5">{dLabel}</p>
      {payload.map((entry: any) => {
        const logmar = Number(entry.value);
        const snellen = logMARToSnellen(logmar);
        return (
          <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground truncate max-w-[80px]">{entry.name}:</span>
            <span className="font-semibold text-foreground">{logmar.toFixed(2)}</span>
            <span className="text-muted-foreground">({snellen})</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PatientDetail() {
  const params = useParams<{ id: string }>();
  const patientId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [iolDialogOpen, setIolDialogOpen] = useState(false);

  const { data: patient, isLoading } = trpc.patients.byId.useQuery({ id: patientId });
  const { data: patientIols = [], refetch: refetchIols } = trpc.patientIols.list.useQuery({ patientId });
  const { data: measurements = [], refetch: refetchMeasurements } = trpc.measurements.byPatient.useQuery({ patientId });
  const { data: allIols = [] } = trpc.iols.list.useQuery();

  const createPatientIOL = trpc.patientIols.create.useMutation({
    onSuccess: () => {
      toast.success("IOL associada com sucesso!");
      setIolDialogOpen(false);
      iolForm.reset();
      refetchIols();
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const deletePatientIOL = trpc.patientIols.delete.useMutation({
    onSuccess: () => { toast.success("IOL removida"); refetchIols(); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const deleteMeasurement = trpc.measurements.delete.useMutation({
    onSuccess: () => { toast.success("Medição removida"); refetchMeasurements(); },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const iolForm = useForm<PatientIOLFormData>({ defaultValues: { eye: "OD" } });

  const onSubmitIOL = (data: PatientIOLFormData) => {
    createPatientIOL.mutate({
      patientId,
      iolId: parseInt(data.iolId),
      eye: data.eye as any,
      surgeryDate: data.surgeryDate || undefined,
      refractiveTarget: data.refractiveTarget ? parseFloat(data.refractiveTarget) : undefined,
      notes: data.notes || undefined,
    });
  };

  // Build chart data from measurements
  const [selectedMeasurements, setSelectedMeasurements] = useState<number[]>([]);

  const { data: chartPoints } = trpc.measurements.points.useQuery(
    { measurementId: selectedMeasurements[0] ?? 0 },
    { enabled: selectedMeasurements.length > 0 }
  );

  // Build multi-series chart data
  const buildChartData = () => {
    const diopterRange = [-5, -4.5, -4, -3.5, -3, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3];
    return diopterRange.map((d) => ({ diopter: d }));
  };

  if (isLoading) {
    return (
      <DefocusLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
      </DefocusLayout>
    );
  }

  if (!patient) {
    return (
      <DefocusLayout>
        <div className="p-6 text-center">
          <p className="text-muted-foreground">Paciente não encontrado</p>
          <Button className="mt-4" onClick={() => setLocation("/patients")}>
            Voltar para Pacientes
          </Button>
        </div>
      </DefocusLayout>
    );
  }

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/patients")}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-primary">
                  {patient.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{patient.name}</h1>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {patient.birthDate && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(patient.birthDate), "dd/MM/yyyy")}
                    </span>
                  )}
                  {patient.lgpdConsent && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                      <Shield className="w-2.5 h-2.5 mr-1" />
                      LGPD Consentido
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setLocation(`/patients/${patientId}/measurements/new`)}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Medição
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Patient Info + IOLs */}
          <div className="space-y-4">
            {/* Patient Info */}
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Dados do Paciente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {[
                  { label: "CPF", value: patient.cpf },
                  { label: "Telefone", value: patient.phone },
                  { label: "E-mail", value: patient.email },
                  { label: "Notas", value: patient.notes },
                ]
                  .filter((f) => f.value)
                  .map((field) => (
                    <div key={field.label}>
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm text-foreground font-medium">{field.value}</p>
                    </div>
                  ))}
                <div>
                  <p className="text-xs text-muted-foreground">Cadastrado em</p>
                  <p className="text-sm text-foreground font-medium">
                    {format(new Date(patient.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* IOLs */}
            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  IOLs Implantadas
                </CardTitle>
                <Dialog open={iolDialogOpen} onOpenChange={setIolDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                      <Plus className="w-3 h-3 mr-1" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Associar IOL ao Paciente</DialogTitle>
                      <DialogDescription>
                        Registre uma IOL implantada neste paciente
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={iolForm.handleSubmit(onSubmitIOL)} className="space-y-4">
                      <IOLCascadeSelect
                        selectedIolId={iolForm.watch("iolId") ? parseInt(iolForm.watch("iolId")) : undefined}
                        onChange={(id) => iolForm.setValue("iolId", id ? id.toString() : "")}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Olho *</Label>
                          <Select defaultValue="OD" onValueChange={(v) => iolForm.setValue("eye", v)}>
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
                        <div className="space-y-1.5">
                          <Label>Data da Cirurgia</Label>
                          <Input type="date" {...iolForm.register("surgeryDate")} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Alvo Refrativo (D)</Label>
                        <Input
                          {...iolForm.register("refractiveTarget")}
                          type="number"
                          step="0.25"
                          min="-5"
                          max="5"
                          placeholder="Ex: -0.25"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Notas</Label>
                        <Input {...iolForm.register("notes")} placeholder="Observações..." />
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIolDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={createPatientIOL.isPending} className="bg-primary text-primary-foreground">
                          {createPatientIOL.isPending ? "Salvando..." : "Associar IOL"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2">
                {patientIols.length === 0 ? (
                  <div className="text-center py-4">
                    <Eye className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Nenhuma IOL associada</p>
                  </div>
                ) : (
                  patientIols.map((piol) => (
                    <div key={piol.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 border">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30">
                            {piol.eye}
                          </Badge>
                          <span className="text-xs font-semibold text-foreground truncate">
                            {piol.iolModel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{piol.manufacturerName}</p>
                        {piol.surgeryDate && (
                          <p className="text-xs text-muted-foreground">
                            Cirurgia: {format(new Date(piol.surgeryDate), "dd/MM/yyyy")}
                          </p>
                        )}
                        {piol.refractiveTarget && (
                          <p className="text-xs text-muted-foreground">
                            Alvo: {piol.refractiveTarget} D
                          </p>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover IOL?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deletePatientIOL.mutate({ id: piol.id })}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Measurements + Chart */}
          <div className="lg:col-span-2 space-y-4">
            {/* Defocus Chart */}
            <Card className="border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    curva Defocus
                  </CardTitle>
                  {measurements.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Selecione medições abaixo para visualizar
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {measurements.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    <Activity className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Nenhuma medição registrada</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Adicione medições para visualizar a curva Defocus
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 bg-primary text-primary-foreground"
                      onClick={() => setLocation(`/patients/${patientId}/measurements/new`)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Registrar Medição
                    </Button>
                  </div>
                ) : (
                  <DefocusChart patientId={patientId} measurements={measurements} />
                )}
              </CardContent>
            </Card>

            {/* Measurements List */}
            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Medições Registradas
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setLocation(`/patients/${patientId}/measurements/new`)}
                  className="h-7 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Nova Medição
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {measurements.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Nenhuma medição registrada</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {measurements.map((m, idx) => (
                      <div key={m.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/20">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">
                                {format(new Date(m.measurementDate), "dd/MM/yyyy")}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {EYE_LABELS[m.eye] || m.eye}
                              </Badge>
                            </div>
                            {m.iolModel && (
                              <p className="text-xs text-muted-foreground">
                                {m.manufacturerName} — {m.iolModel}
                              </p>
                            )}
                            {m.notes && (
                              <p className="text-xs text-muted-foreground italic">{m.notes}</p>
                            )}
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir medição?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Todos os pontos desta medição serão excluídos permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMeasurement.mutate({ id: m.id })}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
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

// ─── Defocus Chart Component ─────────────────────────────────────────────────

// Defocus zone background bands
// X axis: +1.0 (left) → -3.5 (right), positives first then negatives
// Y axis: logMAR with -0.1 at TOP (best vision) and 0.6 at BOTTOM (worst)
const VISION_ZONES = [
  { x1: 1.0,  x2: -0.5,  fill: "#dbeafe", label: "Longe" },
  { x1: -0.5, x2: -1.75, fill: "#dcfce7", label: "Interm." },
  { x1: -1.75,x2: -3.5,  fill: "#fef9c3", label: "Perto" },
];

function DefocusChart({ patientId, measurements }: { patientId: number; measurements: any[] }) {
  // All hooks MUST be called unconditionally at the top level
  const allIds = useMemo(() => measurements.map((m) => m.id), [measurements]);

  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    measurements.slice(0, 3).map((m) => m.id)
  );

  // Batch raw points — single stable query
  const { data: batchPoints } = trpc.measurements.pointsBatch.useQuery(
    { measurementIds: allIds },
    { enabled: allIds.length > 0 }
  );

  const toggleMeasurement = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Build interpolated spline data in logMAR for each selected measurement
  const chartData = useMemo(() => {
    if (!batchPoints) return [];

    // Group raw points by measurement id
    const byId: Record<number, {x:number;y:number}[]> = {};
    batchPoints.forEach((pt) => {
      const id = pt.measurementId;
      const d = parseFloat(pt.diopter as any);
      const va = parseFloat(pt.visualAcuity as any);
      if (!byId[id]) byId[id] = [];
      byId[id].push({ x: d, y: decimalToLogMAR(va) });
    });

    // Generate 100 dense interpolated points per selected measurement
    // X goes from +1.0 to -3.5 (positives first, then negatives)
    const X_START = 1.0, X_END = -3.5;
    const N = 100;
    const step = (X_END - X_START) / (N - 1);

    // Build spline for each selected id
    const splines: Record<number, ((x:number)=>number) | null> = {};
    selectedIds.forEach((id) => {
      const pts = (byId[id] ?? []).sort((a,b)=>a.x-b.x);
      splines[id] = pts.length >= 2 ? monotonicSpline(pts) : null;
    });

    // Determine x range from actual data
    const allPts = selectedIds.flatMap(id => byId[id] ?? []);
    if (allPts.length === 0) return [];
    // dataXMax is the leftmost point (most positive), dataXMin is the rightmost (most negative)
    const dataXMin = Math.min(...allPts.map(p=>p.x));
    const dataXMax = Math.max(...allPts.map(p=>p.x));

    const rows: Record<string, any>[] = [];
    for (let i = 0; i < N; i++) {
      const x = X_START + step * i;
      // X_START=1.0 > X_END=-3.5, so step is negative; x decreases each iteration
      // dataXMax = most positive diopter, dataXMin = most negative diopter
      if (x > dataXMax + 0.05 || x < dataXMin - 0.05) continue; // only within data range
      const row: Record<string, any> = { diopter: parseFloat(x.toFixed(3)) };
      selectedIds.forEach((id) => {
        const fn = splines[id];
        if (fn) {
          const logmar = Math.max(-0.3, Math.min(3.0, fn(x)));
          row[`m_${id}`] = parseFloat(logmar.toFixed(3));
        }
      });
      rows.push(row);
    }
    return rows;
  }, [batchPoints, selectedIds]);

  const getMeasurementLabel = (id: number) => {
    const m = measurements.find((x) => x.id === id);
    if (!m) return `Medição ${id}`;
    return `${format(new Date(m.measurementDate), "dd/MM/yy")} ${m.eye}${m.iolModel ? ` · ${m.iolModel}` : ""}`;
  };

  return (
    <div className="space-y-4">
      {/* Measurement selector */}
      <div className="flex flex-wrap gap-2">
        {measurements.map((m, idx) => {
          const isSelected = selectedIds.includes(m.id);
          const color = CHART_COLORS[idx % CHART_COLORS.length];
          return (
            <button
              key={m.id}
              onClick={() => toggleMeasurement(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? "border-transparent text-white shadow-sm"
                  : "border-border text-muted-foreground bg-background hover:bg-muted"
              }`}
              style={isSelected ? { background: color } : {}}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: isSelected ? "white" : color }} />
              {format(new Date(m.measurementDate), "dd/MM/yy")} · {m.eye}
              {m.iolModel && ` · ${m.iolModel}`}
            </button>
          );
        })}
      </div>

      {/* Zone legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background:"#dbeafe"}} />Longe</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background:"#dcfce7"}} />Intermédio</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{background:"#fef9c3"}} />Perto</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-6 border-t-2 border-dashed border-red-400" />Visão funcional (0.20 logMAR)</span>
      </div>

      {/* Chart */}
      {selectedIds.length > 0 && chartData.length > 0 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 24 }}>
              {/* Vision zone backgrounds */}
              <defs>
                <linearGradient id="zoneFar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#dbeafe" stopOpacity={0.5}/><stop offset="100%" stopColor="#dbeafe" stopOpacity={0.5}/></linearGradient>
                <linearGradient id="zoneMid" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#dcfce7" stopOpacity={0.5}/><stop offset="100%" stopColor="#dcfce7" stopOpacity={0.5}/></linearGradient>
                <linearGradient id="zoneNear" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fef9c3" stopOpacity={0.5}/><stop offset="100%" stopColor="#fef9c3" stopOpacity={0.5}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 240)" />
              {/*
                AXIS ORIENTATION (matches clinical examples):
                X: +1.0 at LEFT → -3.5 at RIGHT  (positives first, then negatives)
                   Recharts: domain=[-3.5, 1.0] + reversed=true renders +1.0 on left
                Y: -0.1 at TOP (best vision) → 0.6 at BOTTOM (worst vision)
                   Recharts: domain=[0.6, -0.1] without reversed renders -0.1 on top
              */}
              <XAxis
                dataKey="diopter"
                type="number"
                domain={[-3.5, 1.0]}
                reversed={true}
                ticks={[1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5]}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}`}
                label={{ value: "Defocus (D)", position: "insideBottom", offset: -12, fontSize: 11 }}
                tick={{ fontSize: 10 }}
              />
              <YAxis
                domain={[0.6, -0.1]}
                reversed={false}
                ticks={[-0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]}
                tickFormatter={(v) => v.toFixed(1)}
                label={{ value: "Acuidade Visual (logMAR)", angle: -90, position: "insideLeft", offset: 5, fontSize: 11 }}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<DefocusTooltip />} />
              {/* Zone backgrounds as reference areas */}
              {/* Vision zone background bands */}
              <ReferenceArea x1={1.0} x2={-0.5}  fill="#dbeafe" fillOpacity={0.35} />
              <ReferenceArea x1={-0.5} x2={-1.75} fill="#dcfce7" fillOpacity={0.35} />
              <ReferenceArea x1={-1.75} x2={-3.5}  fill="#fef9c3" fillOpacity={0.35} />
              {/* Zone boundary lines */}
              <ReferenceLine x={-0.5}  stroke="#93c5fd" strokeDasharray="2 2" strokeWidth={1} />
              <ReferenceLine x={-1.75} stroke="#86efac" strokeDasharray="2 2" strokeWidth={1} />
              {/* Functional vision cutoff line at 0.20 logMAR */}
              <ReferenceLine
                y={0.20}
                stroke="#ef4444"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: "0.20 logMAR (20/32)", position: "insideTopRight", fontSize: 9, fill: "#ef4444" }}
              />
              {/* Peak (0 D) reference */}
              <ReferenceLine x={0} stroke="#3b82f6" strokeDasharray="4 2" strokeWidth={1.5} />
              {selectedIds.map((id) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={`m_${id}`}
                  name={getMeasurementLabel(id)}
                  stroke={CHART_COLORS[measurements.findIndex((m) => m.id === id) % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Selecione ao menos uma medição para visualizar a curva Defocus
        </div>
      )}
    </div>
  );
}
