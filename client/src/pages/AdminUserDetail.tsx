import { trpc } from "@/lib/trpc";
import DefocusLayout from "@/components/DefocusLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useParams } from "wouter";
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
  ArrowLeft,
  Shield,
  Calendar,
} from "lucide-react";

export default function AdminUserDetail() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const userId = parseInt(params.id ?? "0", 10);

  useEffect(() => {
    if (!loading && user && user.role !== "admin") {
      setLocation("/dashboard");
    }
  }, [loading, user, setLocation]);

  const { data: detail, isLoading } = trpc.admin.userDetail.useQuery(
    { userId },
    { enabled: !!user && user.role === "admin" && !!userId }
  );

  if (loading || !user) return null;
  if (user.role !== "admin") return null;

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

  const formatDate = (d: Date | string | null | undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/admin")}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Carregando dados do médico...
          </div>
        ) : !detail ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Médico não encontrado.
          </div>
        ) : (
          <>
            {/* Doctor Info */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Shield className="h-7 w-7 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{detail.user.name || "Sem nome"}</h1>
                <p className="text-sm text-muted-foreground">{detail.user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={detail.user.role === "admin" ? "border-amber-400 text-amber-600 bg-amber-50" : "border-blue-200 text-blue-600 bg-blue-50"}>
                    {detail.user.role === "admin" ? "Administrador" : "Médico"}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Cadastro: {formatDate(detail.user.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pacientes</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{detail.patients.length}</p>
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
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {detail.patients.reduce((s, p) => s + Number(p.measurementCount), 0)}
                      </p>
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
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">IOLs Usadas</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{detail.iolsUsed.length}</p>
                    </div>
                    <div className="p-2.5 bg-amber-50 rounded-xl">
                      <Eye className="h-5 w-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Patients */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-500" />
                    Pacientes (anonimizados)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {detail.patients.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                      Nenhum paciente cadastrado
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">ID</TableHead>
                          <TableHead className="text-xs">Nascimento</TableHead>
                          <TableHead className="text-xs text-center">Medições</TableHead>
                          <TableHead className="text-xs">Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.patients.map((p) => (
                          <TableRow key={p.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-xs text-muted-foreground">#{p.id}</TableCell>
                            <TableCell className="text-sm">{formatDate(p.birthDate)}</TableCell>
                            <TableCell className="text-center font-semibold text-sm">{Number(p.measurementCount)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* IOLs Used */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-500" />
                    IOLs Utilizadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {detail.iolsUsed.length === 0 ? (
                    <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">
                      Nenhuma IOL associada a pacientes
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">IOL</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs text-center">Usos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.iolsUsed.map((iol) => (
                          <TableRow key={iol.iolId} className="hover:bg-muted/50">
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm text-foreground">{iol.iolModel}</p>
                                <p className="text-xs text-muted-foreground">{iol.manufacturerName || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {iol.iolType && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${iolTypeColor[iol.iolType] || "bg-gray-100 text-gray-600"}`}>
                                  {iolTypeLabel[iol.iolType] || iol.iolType}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-bold text-sm">{Number(iol.usageCount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DefocusLayout>
  );
}
