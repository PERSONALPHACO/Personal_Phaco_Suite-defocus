/**
 * Shared IOL option constants used across forms and display components.
 */

export const IOL_TYPES = [
  { value: "monofocal", label: "Monofocal", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "bifocal", label: "Bifocal", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "trifocal", label: "Trifocal", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "edof", label: "EDOF", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "toric", label: "Tórica", color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export const IOL_MATERIALS = [
  { value: "hydrophobic_acrylic", label: "Acrílico Hidrofóbico" },
  { value: "hydrophilic_acrylic", label: "Acrílico Hidrofílico" },
  { value: "silicone", label: "Silicone" },
  { value: "pmma", label: "PMMA" },
  { value: "collamer", label: "Collamer" },
  { value: "other", label: "Outro" },
];

export const IOL_OPTIC_DESIGNS = [
  { value: "diffractive_trifocal", label: "Difrativo Trifocal" },
  { value: "diffractive_bifocal", label: "Difrativo Bifocal" },
  { value: "refractive_bifocal", label: "Refrativo Bifocal" },
  { value: "edof_diffractive", label: "EDOF Difrativo" },
  { value: "edof_refractive", label: "EDOF Refrativo" },
  { value: "edof_pinhole", label: "EDOF Pinhole" },
  { value: "monofocal_standard", label: "Monofocal Padrão" },
  { value: "monofocal_toric", label: "Monofocal Tórico" },
  { value: "trifocal_toric", label: "Trifocal Tórico" },
  { value: "edof_toric", label: "EDOF Tórico" },
  { value: "other", label: "Outro" },
];

/** Return the human-readable label for a material value, or the raw value as fallback. */
export function getMaterialLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return IOL_MATERIALS.find((m) => m.value === value)?.label ?? value;
}

/** Return the human-readable label for an optic design value, or the raw value as fallback. */
export function getOpticDesignLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return IOL_OPTIC_DESIGNS.find((d) => d.value === value)?.label ?? value;
}
