import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Eye, Filter, Plus, Search, TrendingUp, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import IOLDetailSheet from "@/components/IOLDetailSheet";

const IOL_TYPES = [
  { value: "monofocal", label: "Monofocal", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "bifocal", label: "Bifocal", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "trifocal", label: "Trifocal", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "edof", label: "EDOF", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "toric", label: "Tórica", color: "bg-amber-100 text-amber-700 border-amber-200" },
];

type IOLFormData = {
  manufacturerId: string;
  model: string;
  type: string;
  material: string;
  opticDesign: string;
  powerRange: string;
  notes: string;
};

type IOLItem = {
  id: number;
  model: string;
  type: "monofocal" | "bifocal" | "trifocal" | "edof" | "toric";
  manufacturerId: number;
  manufacturerName: string | null;
  manufacturerCountry: string | null;
  aConstant: string | null;
  opticDesign: string | null;
  material: string | null;
  powerRange: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// ─── IOL Card with n-curves badge ─────────────────────────────────────────────

function IOLCard({
  iol,
  onClick,
}: {
  iol: IOLItem;
  onClick: () => void;
}) {
  const { data } = trpc.iols.curves.useQuery({ iolId: iol.id });
  const n = data?.count ?? 0;
  const hasData = n > 0;

  const typeInfo =
    IOL_TYPES.find((t) => t.value === iol.type) || {
      label: iol.type,
      color: "bg-muted text-muted-foreground border-border",
    };

  return (
    <Card
      key={iol.id}
      className="border hover:shadow-md hover:border-primary/30 transition-all overflow-hidden cursor-pointer group"
      onClick={onClick}
    >
      {/* Top accent bar — green if has real data, blue otherwise */}
      <div
        className={`h-1.5 bg-gradient-to-r transition-all ${
          hasData
            ? "from-emerald-500 to-emerald-400"
            : "from-primary to-primary/40"
        }`}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Eye className="w-3.5 h-3.5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground truncate">
                {iol.model}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              {iol.manufacturerName}
              {iol.manufacturerCountry && (
                <span className="ml-1 text-muted-foreground/60">
                  · {iol.manufacturerCountry}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 ml-2 shrink-0">
            <Badge variant="outline" className={`text-xs ${typeInfo.color}`}>
              {typeInfo.label}
            </Badge>
          </div>
        </div>

        {/* Specs */}
        <div className="space-y-1.5 mt-3">
          {iol.aConstant && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Const. A:</span>
              <span className="text-xs font-mono font-bold text-primary">{iol.aConstant}</span>
            </div>
          )}
          {iol.opticDesign && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Design:</span>
              <span className="text-xs text-foreground">{iol.opticDesign}</span>
            </div>
          )}
          {iol.material && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Material:</span>
              <span className="text-xs text-foreground">{iol.material}</span>
            </div>
          )}
        </div>

        {/* Footer: n-curves badge + click hint */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          {hasData ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-700">
                n = {n} {n === 1 ? "curva" : "curvas"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground">Sem curvas ainda</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
            <span>Ver curvas</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function IOLs() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterManufacturer, setFilterManufacturer] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Sheet state
  const [selectedIOL, setSelectedIOL] = useState<IOLItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: iols = [], refetch: refetchIOLs } = trpc.iols.list.useQuery();
  const { data: manufacturers = [] } = trpc.manufacturers.list.useQuery();

  const createIOL = trpc.iols.create.useMutation({
    onSuccess: () => {
      toast.success("IOL cadastrada com sucesso!");
      setDialogOpen(false);
      reset();
      refetchIOLs();
    },
    onError: (err) => toast.error("Erro ao cadastrar IOL: " + err.message),
  });

  const { register, handleSubmit, setValue, reset } = useForm<IOLFormData>({
    defaultValues: { type: "trifocal" },
  });

  const onSubmit = (data: IOLFormData) => {
    if (!data.manufacturerId) {
      toast.error("Selecione um fabricante");
      return;
    }
    createIOL.mutate({
      manufacturerId: parseInt(data.manufacturerId),
      model: data.model,
      type: data.type as any,
      material: data.material || undefined,
      opticDesign: data.opticDesign || undefined,
      powerRange: data.powerRange || undefined,
      notes: data.notes || undefined,
    });
  };

  const handleIOLClick = (iol: IOLItem) => {
    setSelectedIOL(iol);
    setSheetOpen(true);
  };

  const filtered = iols.filter((iol) => {
    const matchSearch =
      !search ||
      iol.model.toLowerCase().includes(search.toLowerCase()) ||
      (iol.manufacturerName || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || iol.type === filterType;
    const matchMfr =
      filterManufacturer === "all" || iol.manufacturerId.toString() === filterManufacturer;
    return matchSearch && matchType && matchMfr;
  });

  return (
    <DefocusLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Biblioteca de IOLs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {iols.length} lentes intraoculares cadastradas — clique em uma IOL para ver as curvas
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova IOL
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar Nova IOL</DialogTitle>
                <DialogDescription>
                  Adicione uma nova lente intraocular à biblioteca
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label>Fabricante *</Label>
                    <Select onValueChange={(v) => setValue("manufacturerId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fabricante" />
                      </SelectTrigger>
                      <SelectContent>
                        {manufacturers.map((m) => (
                          <SelectItem key={m.id} value={m.id.toString()}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Modelo *</Label>
                    <Input
                      {...register("model", { required: true })}
                      placeholder="Ex: PanOptix, Vivity, Symfony..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo *</Label>
                    <Select defaultValue="trifocal" onValueChange={(v) => setValue("type", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IOL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Material</Label>
                    <Input
                      {...register("material")}
                      placeholder="Ex: Hydrophobic acrylic"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Design Óptico</Label>
                    <Input
                      {...register("opticDesign")}
                      placeholder="Ex: Trifocal diffractive"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Faixa de Poder (D)</Label>
                    <Input
                      {...register("powerRange")}
                      placeholder="Ex: +6.0 to +34.0 D"
                    />
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Notas Clínicas</Label>
                    <Textarea
                      {...register("notes")}
                      placeholder="Observações sobre a lente..."
                      rows={3}
                    />
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
                    disabled={createIOL.isPending}
                    className="bg-primary text-primary-foreground"
                  >
                    {createIOL.isPending ? "Salvando..." : "Cadastrar IOL"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por modelo ou fabricante..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-44">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {IOL_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterManufacturer} onValueChange={setFilterManufacturer}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Fabricante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fabricantes</SelectItem>
              {manufacturers.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* IOL Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Eye className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Nenhuma IOL encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || filterType !== "all" ? "Tente ajustar os filtros" : "Cadastre a primeira IOL"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((iol) => (
              <IOLCard
                key={iol.id}
                iol={iol as IOLItem}
                onClick={() => handleIOLClick(iol as IOLItem)}
              />
            ))}
          </div>
        )}
      </div>

      {/* IOL Detail Sheet */}
      <IOLDetailSheet
        iol={selectedIOL}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </DefocusLayout>
  );
}
