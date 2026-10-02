import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowRight, Plus, Search, Shield, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { format } from "date-fns";

type PatientFormData = {
  name: string;
  birthDate: string;
  phone: string;
  email: string;
  notes: string;
  lgpdConsent: boolean;
};

export default function Patients() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: patients = [], refetch } = trpc.patients.list.useQuery();

  const createPatient = trpc.patients.create.useMutation({
    onSuccess: () => {
      toast.success("Paciente cadastrado com sucesso!");
      setDialogOpen(false);
      reset();
      refetch();
    },
    onError: (err) => toast.error("Erro ao cadastrar paciente: " + err.message),
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<PatientFormData>({
    defaultValues: { lgpdConsent: false },
  });

  const lgpdConsent = watch("lgpdConsent");

  const onSubmit = (data: PatientFormData) => {
    if (!data.lgpdConsent) {
      toast.error("O consentimento LGPD é obrigatório para cadastrar um paciente");
      return;
    }
    createPatient.mutate({
      name: data.name,
      birthDate: data.birthDate || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      notes: data.notes || undefined,
      lgpdConsent: data.lgpdConsent,
    });
  };

  const filtered = patients.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || "").includes(search)
  );

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pacientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {patients.length} paciente{patients.length !== 1 ? "s" : ""} cadastrado{patients.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo Paciente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Paciente</DialogTitle>
                <DialogDescription>
                  Preencha os dados do paciente. Campos marcados com * são obrigatórios.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome Completo *</Label>
                  <Input
                    {...register("name", { required: true })}
                    placeholder="Nome do paciente"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Data de Nascimento</Label>
                    <Input type="date" {...register("birthDate")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input
                      {...register("phone")}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input
                      {...register("email")}
                      type="email"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Observações Clínicas</Label>
                  <Input
                    {...register("notes")}
                    placeholder="Histórico relevante, alergias, etc."
                  />
                </div>

                {/* LGPD Consent */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        Consentimento LGPD (Lei 13.709/2018)
                      </p>
                      <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                        O paciente autoriza o armazenamento e uso de seus dados clínicos para fins de tratamento médico e análise de performance de lentes intraoculares, conforme a Lei Geral de Proteção de Dados.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="lgpdConsent"
                      checked={lgpdConsent}
                      onCheckedChange={(v) => setValue("lgpdConsent", !!v)}
                    />
                    <label htmlFor="lgpdConsent" className="text-sm font-medium text-emerald-800 cursor-pointer">
                      Paciente deu consentimento informado *
                    </label>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setDialogOpen(false); reset(); }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPatient.isPending || !lgpdConsent}
                    className="bg-primary text-primary-foreground"
                  >
                    {createPatient.isPending ? "Salvando..." : "Cadastrar Paciente"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Patient List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">
              {search ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Tente outro termo de busca" : "Cadastre seu primeiro paciente para começar"}
            </p>
            {!search && (
              <Button
                size="sm"
                className="mt-4 bg-primary text-primary-foreground"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Cadastrar Paciente
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((patient) => (
              <Card
                key={patient.id}
                className="border hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setLocation(`/patients/${patient.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/20">
                      <span className="text-sm font-bold text-primary">
                        {patient.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground text-sm truncate">
                          {patient.name}
                        </h3>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                      {patient.birthDate && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Nasc. {format(new Date(patient.birthDate), "dd/MM/yyyy")}
                        </p>
                      )}
                      {patient.phone && (
                        <p className="text-xs text-muted-foreground">{patient.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    {patient.lgpdConsent ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                      >
                        <Shield className="w-2.5 h-2.5 mr-1" />
                        LGPD
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs text-amber-600 border-amber-200 bg-amber-50"
                      >
                        Sem consentimento
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(patient.createdAt), "dd/MM/yyyy")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DefocusLayout>
  );
}
