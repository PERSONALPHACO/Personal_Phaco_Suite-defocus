import { trpc } from "@/lib/trpc";
import DefocusLayout from "@/components/DefocusLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Activity,
  Eye,
  Shield,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function Admin() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  const { data: users, isLoading: usersLoading } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const { data: iolStats, isLoading: iolsLoading } = trpc.admin.iolStats.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  if (loading || !user) return null;
  if (user.role !== "admin") return null;

  const totalDoctors = users?.length ?? 0;
  const totalPatients = users?.reduce((sum, u) => sum + Number(u.patientCount), 0) ?? 0;
  const totalMeasurements = users?.reduce((sum, u) => sum + Number(u.measurementCount), 0) ?? 0;
  const totalIOLsUsed = iolStats?.reduce((sum, i) => sum + Number(i.totalUses), 0) ?? 0;

  const iolTypeLabel: Record<string, string> = {
    monofocal: "Monofocal",
    bifocal: "Bifocal",
    trifocal: "Trifocal",
    edof: "EDOF",
    toric: "Tórica",
  };

  const iolTypeColor: Record<string, string> = {
    monofocal: "bg-blue-100 text-blue-700",
    bifocal: "bg-purple-100 text-purple-700",
    trifocal: "bg-green-100 text-green-700",
    edof: "bg-amber-100 text-amber-700",
    toric: "bg-rose-100 text-rose-700",
  };

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">Visão geral de todos os médicos e resultados da plataforma</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Médicos</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{totalDoctors}</p>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pacientes</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{totalPatients}</p>
                </div>
                <div className="p-2.5 bg-green-50 rounded-xl">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Medições</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{totalMeasurements}</p>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-xl">
                  <Activity className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Implantes</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{totalIOLsUsed}</p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-xl">
                  <Eye className="h-5 w-5 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Doctors Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Médicos Cadastrados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {usersLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Carregando...
                </div>
              ) : !users || users.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Nenhum médico cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Médico</TableHead>
                      <TableHead className="text-xs text-center">Pacientes</TableHead>
                      <TableHead className="text-xs text-center">Medições</TableHead>
                      <TableHead className="text-xs text-center">Perfil</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/admin/users/${u.id}`)}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground">{u.name || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[160px]">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-sm">{Number(u.patientCount)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-sm">{Number(u.measurementCount)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={u.role === "admin" ? "border-amber-400 text-amber-600 bg-amber-50" : "border-blue-200 text-blue-600 bg-blue-50"}>
                            {u.role === "admin" ? "Admin" : "Médico"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* IOL Ranking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Ranking de IOLs por Uso
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {iolsLoading ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Carregando...
                </div>
              ) : !iolStats || iolStats.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  Nenhuma IOL utilizada ainda
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">IOL</TableHead>
                      <TableHead className="text-xs text-center">Usos</TableHead>
                      <TableHead className="text-xs text-center">Médicos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {iolStats.slice(0, 15).map((iol, idx) => (
                      <TableRow key={iol.iolId} className="hover:bg-muted/50">
                        <TableCell className="text-xs font-bold text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm text-foreground">{iol.iolModel}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-muted-foreground">{iol.manufacturerName || "—"}</span>
                              {iol.iolType && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${iolTypeColor[iol.iolType] || "bg-gray-100 text-gray-600"}`}>
                                  {iolTypeLabel[iol.iolType] || iol.iolType}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold text-sm">{Number(iol.totalUses)}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">{Number(iol.totalDoctors)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DefocusLayout>
  );
}
