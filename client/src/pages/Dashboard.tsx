import DefocusLayout from "@/components/DefocusLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Eye,
  GitCompare,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: patients = [] } = trpc.patients.list.useQuery();
  const { data: iols = [] } = trpc.iols.list.useQuery();
  const { data: measurementCount } = trpc.measurements.totalCount.useQuery();

  const recentPatients = patients.slice(0, 5);

  const iolTypeLabel: Record<string, string> = {
    monofocal: "Monofocal",
    bifocal: "Bifocal",
    trifocal: "Trifocal",
    edof: "EDOF",
    toric: "Tórica",
  };

  const iolTypeColor: Record<string, string> = {
    monofocal: "bg-slate-100 text-slate-700",
    bifocal: "bg-blue-100 text-blue-700",
    trifocal: "bg-primary/10 text-primary",
    edof: "bg-emerald-100 text-emerald-700",
    toric: "bg-amber-100 text-amber-700",
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting()}, Dr. {user?.name?.split(" ")[0] ?? ""}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <Button
            onClick={() => setLocation("/patients")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Total de Pacientes",
              value: patients.length,
              icon: Users,
              color: "text-primary",
              bg: "bg-primary/10",
              action: () => setLocation("/patients"),
            },
            {
              title: "IOLs Cadastradas",
              value: iols.length,
              icon: Eye,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              action: () => setLocation("/iols"),
            },
            {
              title: "Medições Registradas",
              value: measurementCount ?? "—",
              icon: Activity,
              color: "text-amber-600",
              bg: "bg-amber-50",
              action: () => setLocation("/patients"),
            },
            {
              title: "Comparações Realizadas",
              value: "—",
              icon: GitCompare,
              color: "text-purple-600",
              bg: "bg-purple-50",
              action: () => setLocation("/compare"),
            },
          ].map((stat) => (
            <Card
              key={stat.title}
              className="cursor-pointer hover:shadow-md transition-shadow border"
              onClick={stat.action}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Patients */}
          <div className="lg:col-span-2">
            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  Pacientes Recentes
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/patients")}
                  className="text-primary hover:text-primary/80 text-xs font-medium"
                >
                  Ver todos
                  <ArrowRight className="ml-1 w-3 h-3" />
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {recentPatients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground">Nenhum paciente cadastrado</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Comece cadastrando seu primeiro paciente
                    </p>
                    <Button
                      size="sm"
                      className="mt-4 bg-primary text-primary-foreground"
                      onClick={() => setLocation("/patients")}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Cadastrar Paciente
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentPatients.map((patient) => (
                      <div
                        key={patient.id}
                        className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setLocation(`/patients/${patient.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {patient.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{patient.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {patient.birthDate
                                ? `Nasc. ${format(new Date(patient.birthDate), "dd/MM/yyyy")}`
                                : "Data de nascimento não informada"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {patient.lgpdConsent && (
                            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                              LGPD
                            </Badge>
                          )}
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions + IOL Summary */}
          <div className="space-y-4">
            {/* Quick Actions */}
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  Ações Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    icon: Users,
                    label: "Gerenciar Pacientes",
                    desc: "Cadastrar e visualizar",
                    path: "/patients",
                    color: "text-primary",
                    bg: "bg-primary/10",
                  },
                  {
                    icon: Eye,
                    label: "Biblioteca de IOLs",
                    desc: "Lentes e fabricantes",
                    path: "/iols",
                    color: "text-emerald-600",
                    bg: "bg-emerald-50",
                  },
                  {
                    icon: GitCompare,
                    label: "Comparar IOLs",
                    desc: "Análise de performance",
                    path: "/compare",
                    color: "text-amber-600",
                    bg: "bg-amber-50",
                  },
                ].map((action) => (
                  <button
                    key={action.path}
                    onClick={() => setLocation(action.path)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center shrink-0`}>
                      <action.icon className={`w-4 h-4 ${action.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* IOL Types Summary */}
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-foreground">
                  IOLs por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(
                  iols.reduce((acc, iol) => {
                    acc[iol.type] = (acc[iol.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${iolTypeColor[type] || "bg-muted text-muted-foreground"}`}>
                      {iolTypeLabel[type] || type}
                    </span>
                    <span className="text-sm font-bold text-foreground">{count}</span>
                  </div>
                ))}
                {iols.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nenhuma IOL cadastrada
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DefocusLayout>
  );
}
