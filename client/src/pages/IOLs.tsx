import DefocusLayout from "@/components/DefocusLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
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
import { Filter, Plus, Search, TrendingUp, ChevronRight, Layers, Pencil, Trash2, MoreVertical } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import IOLDetailSheet from "@/components/IOLDetailSheet";
import {
  IOL_TYPES,
  IOL_MATERIALS,
  IOL_OPTIC_DESIGNS,
  getMaterialLabel,
  getOpticDesignLabel,
} from "@/lib/iolConstants";

type IOLFormData = {
  manufacturerId: string;
  model: string;
  type: string;
  aConstant: string;
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
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Manufacturer avatar — brand colors + initials ──────────────────────────────────

/**
 * Maps exact manufacturer names (as stored in DB) to brand color + initials.
 * Colors sourced from official brand guidelines / Brandfetch.
 * Fallback uses a deterministic hue derived from the name string.
 */
const MFR_MAP: Record<string, { bg: string; text: string; initials: string }> = {
  // Zeiss: official blue #0072EF
  "Zeiss":                    { bg: "#E8F1FD", text: "#0072EF", initials: "ZSS" },
  // Alcon: official navy #003595
  "Alcon":                    { bg: "#E6EBF5", text: "#003595", initials: "ALC" },
  // Johnson & Johnson Vision: official red #EB1700
  "Johnson & Johnson Vision": { bg: "#FDECEA", text: "#C41200", initials: "J&J" },
  // Hoya: official blue #0068B6
  "Hoya":                     { bg: "#E6F0F9", text: "#0068B6", initials: "HOY" },
  // Rayner: official green #61A328
  "Rayner":                   { bg: "#EEF6E6", text: "#4A7D1E", initials: "RAY" },
  // Bausch & Lomb: official teal/purple — using their teal #007B8A
  "Bausch & Lomb":            { bg: "#E5F3F5", text: "#007B8A", initials: "B+L" },
  // Hanita Lenses: deep blue from their brand refresh
  "Hanita Lenses":            { bg: "#EAF0FB", text: "#1A4FA0", initials: "HAN" },
  // Teleon Surgical: official green #45A63E
  "Teleon Surgical":          { bg: "#EBF6EA", text: "#2E7A28", initials: "TEL" },
  // PhysIOL: corporate violet/indigo
  "PhysIOL":                  { bg: "#EEE9F8", text: "#5B2D9E", initials: "PHY" },
  // Medicontour (Vertek): warm amber — elegant choice
  "Medicontour (Vertek)":     { bg: "#FDF3E6", text: "#B45309", initials: "MED" },
  // Biotech: emerald green
  "Biotech":                  { bg: "#E6F4EE", text: "#0A6B3D", initials: "BIO" },
  // Leedsay: slate blue — elegant choice
  "Leedsay":                  { bg: "#EAF0F8", text: "#2C5282", initials: "LEE" },
};

function getMfrStyle(name: string | null): { bg: string; text: string; initials: string } {
  if (!name) return { bg: "#F1F5F9", text: "#64748B", initials: "?" };
  // Exact match first
  if (MFR_MAP[name]) return MFR_MAP[name];
  // Partial match fallback
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(MFR_MAP)) {
    if (lower.includes(key.toLowerCase().split(" ")[0])) return val;
  }
  // Deterministic fallback: hash name to a hue
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return {
    bg: `hsl(${hue}, 60%, 93%)`,
    text: `hsl(${hue}, 60%, 30%)`,
    initials: name.split(/[\s&+/]+/).filter(Boolean).slice(0, 3).map((w) => w[0].toUpperCase()).join(""),
  };
}

// ─── IOL Card with n-curves badge ─────────────────────────────────────────────

function IOLCard({
  iol,
  onClick,
  onEdit,
  onDelete,
  rank,
  canManage,
}: {
  iol: IOLItem;
  onClick: () => void;
  onEdit: (iol: IOLItem) => void;
  onDelete: (iol: IOLItem) => void;
  rank: number; // 1-based position for "most used" badge
  // O catálogo de LIOs é global e compartilhado: escrita é só de admin no
  // servidor. A interface precisa refletir isso, senão o médico comum preenche
  // o formulário inteiro para receber um erro de permissão no final.
  canManage: boolean;
}) {
  const { data } = trpc.iols.curves.useQuery({ iolId: iol.id });
  const n = data?.count ?? 0;
  const hasData = n > 0;
  const isFrequent = iol.usageCount > 0;

  const typeInfo =
    IOL_TYPES.find((t) => t.value === iol.type) || {
      label: iol.type,
      color: "bg-muted text-muted-foreground border-border",
    };

  return (
    <Card
      key={iol.id}
      className={`border transition-all overflow-hidden cursor-pointer group ${
        isFrequent
          ? "hover:shadow-lg hover:border-accent/50 border-accent/20"
          : "hover:shadow-md hover:border-primary/30"
      }`}
      onClick={onClick}
    >
      {/* Top accent bar — gold if frequently used, green if has data, blue otherwise */}
      <div
        className={`h-1.5 bg-gradient-to-r transition-all ${
          isFrequent
            ? "from-amber-400 to-yellow-300"
            : hasData
            ? "from-emerald-500 to-emerald-400"
            : "from-primary to-primary/40"
        }`}
      />
      <CardContent className="p-5">
        {/* Header row: avatar + model + type badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {/* Manufacturer avatar — brand color + initials */}
              {(() => {
                const style = getMfrStyle(iol.manufacturerName);
                return (
                  <div
                    style={{ background: style.bg }}
                    className="w-10 h-7 rounded-md flex items-center justify-center shrink-0"
                  >
                    <span
                      style={{ color: style.text }}
                      className="text-[10px] font-black tracking-tight leading-none"
                    >
                      {style.initials}
                    </span>
                  </div>
                );
              })()}
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
            {isFrequent && (
              <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                ★ {iol.usageCount}× usada
              </span>
            )}
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
              <span className="text-xs text-foreground">
                {getOpticDesignLabel(iol.opticDesign)}
              </span>
            </div>
          )}
          {iol.material && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground w-20 shrink-0">Material:</span>
              <span className="text-xs text-foreground">
                {getMaterialLabel(iol.material)}
              </span>
            </div>
          )}
        </div>

        {/* Footer: n-curves badge + action buttons */}
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
          {/* Ações do catálogo global: visíveis apenas para admin */}
          {canManage && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted gap-1"
              onClick={(e) => { e.stopPropagation(); onEdit(iol); }}
            >
              <Pencil className="w-3 h-3" />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-1"
              onClick={(e) => { e.stopPropagation(); onDelete(iol); }}
            >
              <Trash2 className="w-3 h-3" />
              Excluir
            </Button>
          </div>
          )}
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIOL, setEditingIOL] = useState<IOLItem | null>(null);
  const [deleteConfirmIOL, setDeleteConfirmIOL] = useState<IOLItem | null>(null);

  // Sheet state
  const [selectedIOL, setSelectedIOL] = useState<IOLItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Escrita no catálogo global de LIOs é restrita a admin no servidor
  // (iols.create/update/delete e manufacturers.create são adminProcedure).
  const { user } = useAuth();
  const canManage = user?.role === "admin";

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

  const updateIOL = trpc.iols.update.useMutation({
    onSuccess: () => {
      toast.success("IOL atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingIOL(null);
      editReset();
      refetchIOLs();
    },
    onError: (err) => toast.error("Erro ao atualizar IOL: " + err.message),
  });

  const deleteIOL = trpc.iols.delete.useMutation({
    onSuccess: () => {
      toast.success("IOL excluída com sucesso!");
      setDeleteConfirmIOL(null);
      refetchIOLs();
    },
    onError: (err) => toast.error("Erro ao excluir IOL: " + err.message),
  });

  const { register, handleSubmit, setValue, reset } = useForm<IOLFormData>({
    defaultValues: { type: "trifocal" },
  });

  const { register: editRegister, handleSubmit: editHandleSubmit, setValue: editSetValue, reset: editReset } = useForm<IOLFormData>();

  const onSubmit = (data: IOLFormData) => {
    if (!data.manufacturerId) {
      toast.error("Selecione um fabricante");
      return;
    }
    createIOL.mutate({
      manufacturerId: parseInt(data.manufacturerId),
      model: data.model,
      type: data.type as any,
      aConstant: data.aConstant || undefined,
      material: data.material || undefined,
      opticDesign: data.opticDesign || undefined,
      powerRange: data.powerRange || undefined,
      notes: data.notes || undefined,
    });
  };

  const onEditSubmit = (data: IOLFormData) => {
    if (!editingIOL) return;
    updateIOL.mutate({
      id: editingIOL.id,
      model: data.model,
      type: data.type as any,
      aConstant: data.aConstant || undefined,
      material: data.material || undefined,
      opticDesign: data.opticDesign || undefined,
      powerRange: data.powerRange || undefined,
      notes: data.notes || undefined,
    });
  };

  const handleEditIOL = (iol: IOLItem) => {
    setEditingIOL(iol);
    editReset({
      manufacturerId: iol.manufacturerId.toString(),
      model: iol.model,
      type: iol.type,
      aConstant: iol.aConstant || "",
      material: iol.material || "",
      opticDesign: iol.opticDesign || "",
      powerRange: iol.powerRange || "",
      notes: iol.notes || "",
    });
    setEditDialogOpen(true);
  };

  const handleDeleteIOL = (iol: IOLItem) => {
    setDeleteConfirmIOL(iol);
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
          {!canManage && (
            <p className="text-xs text-muted-foreground max-w-xs sm:text-right">
              O catálogo de lentes é compartilhado por todos os médicos e mantido
              pela administração. Para incluir ou corrigir uma lente, fale conosco.
            </p>
          )}
          <Dialog open={canManage && dialogOpen} onOpenChange={setDialogOpen}>
            {canManage && (
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Nova IOL
              </Button>
            </DialogTrigger>
            )}
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
                    <Select
                      onValueChange={(val) => setValue("material", val)}
                      defaultValue=""
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o material" />
                      </SelectTrigger>
                      <SelectContent>
                        {IOL_MATERIALS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-1.5">
                    <Label>Design Óptico</Label>
                    <Select
                      onValueChange={(val) => setValue("opticDesign", val)}
                      defaultValue=""
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o design óptico" />
                      </SelectTrigger>
                      <SelectContent>
                        {IOL_OPTIC_DESIGNS.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Constante A</Label>
                    <Input
                      {...register("aConstant")}
                      placeholder="Ex: 118.4"
                      type="number"
                      step="0.1"
                    />
                  </div>

                  <div className="space-y-1.5">
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
              <Layers className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Nenhuma IOL encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search || filterType !== "all" ? "Tente ajustar os filtros" : "Cadastre a primeira IOL"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((iol, idx) => (
              <IOLCard
                key={iol.id}
                iol={iol as IOLItem}
                rank={idx + 1}
                onClick={() => handleIOLClick(iol as IOLItem)}
                onEdit={handleEditIOL}
                onDelete={handleDeleteIOL}
                canManage={canManage}
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

      {/* Edit IOL Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setEditingIOL(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar IOL</DialogTitle>
            <DialogDescription>
              Atualize as informações da lente intraocular
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editHandleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Fabricante</Label>
                <p className="text-sm text-muted-foreground">{editingIOL ? manufacturers.find(m => m.id === editingIOL.manufacturerId)?.name ?? "—" : "—"}</p>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Modelo *</Label>
                <Input
                  {...editRegister("model", { required: true })}
                  placeholder="Ex: PanOptix, Vivity, Symfony..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  defaultValue={editingIOL?.type ?? "trifocal"}
                  onValueChange={(v) => editSetValue("type", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IOL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Material</Label>
                <Select
                  defaultValue={editingIOL?.material ?? ""}
                  onValueChange={(v) => editSetValue("material", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o material" /></SelectTrigger>
                  <SelectContent>
                    {IOL_MATERIALS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Design Óptico</Label>
                <Select
                  defaultValue={editingIOL?.opticDesign ?? ""}
                  onValueChange={(v) => editSetValue("opticDesign", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o design óptico" /></SelectTrigger>
                  <SelectContent>
                    {IOL_OPTIC_DESIGNS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Constante A</Label>
                <Input
                  {...editRegister("aConstant")}
                  placeholder="Ex: 118.4"
                  type="number"
                  step="0.1"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Faixa de Poder (D)</Label>
                <Input
                  {...editRegister("powerRange")}
                  placeholder="Ex: +6.0 to +34.0 D"
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label>Notas Clínicas</Label>
                <Textarea
                  {...editRegister("notes")}
                  placeholder="Observações sobre a lente..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setEditDialogOpen(false); setEditingIOL(null); }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateIOL.isPending}
                className="bg-primary text-primary-foreground"
              >
                {updateIOL.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmIOL} onOpenChange={(open) => { if (!open) setDeleteConfirmIOL(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir IOL</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a IOL <strong>{deleteConfirmIOL?.model}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmIOL && deleteIOL.mutate({ id: deleteConfirmIOL.id })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteIOL.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DefocusLayout>
  );
}
