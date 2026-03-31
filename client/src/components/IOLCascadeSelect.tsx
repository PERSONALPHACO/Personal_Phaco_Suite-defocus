import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

const IOL_TYPE_LABELS: Record<string, string> = {
  monofocal: "Monofocal",
  bifocal: "Bifocal",
  trifocal: "Trifocal",
  edof: "EDOF",
  toric: "Tórica",
};

const IOL_TYPE_COLORS: Record<string, string> = {
  monofocal: "bg-blue-100 text-blue-700 border-blue-200",
  bifocal: "bg-purple-100 text-purple-700 border-purple-200",
  trifocal: "bg-emerald-100 text-emerald-700 border-emerald-200",
  edof: "bg-amber-100 text-amber-700 border-amber-200",
  toric: "bg-rose-100 text-rose-700 border-rose-200",
};

type IOLCascadeSelectProps = {
  /** Currently selected IOL id (number) or undefined */
  selectedIolId: number | undefined;
  onChange: (iolId: number | undefined) => void;
  /** Show a "Sem IOL" option at the top — useful for optional selections */
  allowNone?: boolean;
  /** Label prefix override */
  labelPrefix?: string;
  /** Pre-select a manufacturer (controlled) */
  manufacturerId?: number;
};

export default function IOLCascadeSelect({
  selectedIolId,
  onChange,
  allowNone = false,
  labelPrefix = "",
  manufacturerId: externalManufacturerId,
}: IOLCascadeSelectProps) {
  const { data: manufacturers = [] } = trpc.manufacturers.list.useQuery();
  const { data: allIols = [] } = trpc.iols.list.useQuery();

  // Internal manufacturer state — sync with external if provided
  const [internalManufacturerId, setInternalManufacturerId] = useState<string>(
    externalManufacturerId ? externalManufacturerId.toString() : "none"
  );

  // When selectedIolId changes externally, sync manufacturer
  useEffect(() => {
    if (selectedIolId) {
      const iol = allIols.find((i) => i.id === selectedIolId);
      if (iol) {
        setInternalManufacturerId(iol.manufacturerId.toString());
      }
    }
  }, [selectedIolId, allIols]);

  const activeManufacturerId =
    internalManufacturerId !== "none" ? parseInt(internalManufacturerId) : null;

  const filteredIols = activeManufacturerId
    ? allIols.filter((i) => i.manufacturerId === activeManufacturerId && i.isActive)
    : [];

  const selectedIol = selectedIolId ? allIols.find((i) => i.id === selectedIolId) : null;

  const handleManufacturerChange = (val: string) => {
    setInternalManufacturerId(val);
    onChange(undefined); // reset IOL when manufacturer changes
  };

  const handleIolChange = (val: string) => {
    if (val === "none") {
      onChange(undefined);
    } else {
      onChange(parseInt(val));
    }
  };

  return (
    <div className="space-y-3">
      {/* Fabricante */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          {labelPrefix ? `${labelPrefix} — ` : ""}Fabricante
        </Label>
        <Select value={internalManufacturerId} onValueChange={handleManufacturerChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione o fabricante..." />
          </SelectTrigger>
          <SelectContent>
            {allowNone && (
              <SelectItem value="none">— Sem fabricante —</SelectItem>
            )}
            {manufacturers.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()}>
                {m.name}
                {m.country && (
                  <span className="ml-1.5 text-muted-foreground text-xs">({m.country})</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* IOL — só aparece após selecionar fabricante */}
      {activeManufacturerId && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Modelo de IOL</Label>
          <Select
            value={selectedIolId ? selectedIolId.toString() : allowNone ? "none" : ""}
            onValueChange={handleIolChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o modelo..." />
            </SelectTrigger>
            <SelectContent>
              {allowNone && (
                <SelectItem value="none">— Sem IOL específica —</SelectItem>
              )}
              {filteredIols.length === 0 ? (
                <SelectItem value="empty" disabled>
                  Nenhuma IOL cadastrada para este fabricante
                </SelectItem>
              ) : (
                filteredIols.map((iol) => (
                  <SelectItem key={iol.id} value={iol.id.toString()}>
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1">{iol.model}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${IOL_TYPE_COLORS[iol.type] ?? ""}`}
                      >
                        {IOL_TYPE_LABELS[iol.type] ?? iol.type}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Info card da IOL selecionada */}
          {selectedIol && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15 text-xs">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground">{selectedIol.model}</span>
                <span className="text-muted-foreground ml-1.5">
                  — {manufacturers.find((m) => m.id === selectedIol.manufacturerId)?.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${IOL_TYPE_COLORS[selectedIol.type] ?? ""}`}
                >
                  {IOL_TYPE_LABELS[selectedIol.type] ?? selectedIol.type}
                </Badge>
                {selectedIol.aConstant && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600 border-slate-200">
                    A = {selectedIol.aConstant}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
