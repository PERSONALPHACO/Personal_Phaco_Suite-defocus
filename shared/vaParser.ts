/**
 * Visual Acuity Input Parser
 * Converts user-entered VA values in any format to decimal (0.0–2.0 range).
 *
 * Supported input formats:
 *  - Decimal:  "1.0", "0.5", "0.1"
 *  - Snellen slash: "20/20", "20/40", "20/200"
 *  - Snellen bare denominator: "40" → 20/40, "200" → 20/200
 *  - Snellen concatenated: "2020" → 20/20, "2040" → 20/40, "20200" → 20/200
 *  - logMAR: "0.00", "0.30", "1.00"
 */

export type AVInputMode = "decimal" | "snellen" | "logmar";

/**
 * Parse a visual acuity string in the given mode and return a decimal value.
 * Returns null if the input is empty or cannot be parsed.
 */
export function parseVAInput(value: string, mode: AVInputMode): number | null {
  if (!value.trim()) return null;

  if (mode === "decimal") {
    const n = parseFloat(value);
    return isNaN(n) ? null : n;
  }

  if (mode === "logmar") {
    const n = parseFloat(value);
    if (isNaN(n)) return null;
    return parseFloat(Math.pow(10, -n).toFixed(3));
  }

  if (mode === "snellen") {
    const trimmed = value.trim();

    // Format: "20/40" or "20/200"
    const parts = trimmed.split("/");
    if (parts.length === 2) {
      const num = parseFloat(parts[0]), den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den > 0) return parseFloat((num / den).toFixed(3));
    }

    const n = parseFloat(trimmed);
    if (!isNaN(n) && n > 0) {
      // Concatenated format: "2020" → 20/20, "2040" → 20/40, "20200" → 20/200
      // Detect by string prefix "20" with additional digits for the denominator
      if (trimmed.startsWith("20") && trimmed.length > 2) {
        const den = parseFloat(trimmed.slice(2));
        if (!isNaN(den) && den > 0) return parseFloat((20 / den).toFixed(3));
      }
      // Bare denominator (e.g. "40" → 20/40), only for values >= 10
      if (n >= 10) return parseFloat((20 / n).toFixed(3));
      // Small number (< 10) treated as decimal VA (e.g. "1" → 1.0)
      return parseFloat(n.toFixed(3));
    }
    return null;
  }

  return null;
}

/**
 * Convert a decimal VA value to display string in the given mode.
 * Uses a lookup table for common Snellen values.
 */
export function decimalToDisplay(decimal: number, mode: AVInputMode): string {
  if (mode === "decimal") return decimal.toFixed(2).replace(/\.?0+$/, "") || "0";
  if (mode === "logmar") return (-Math.log10(decimal)).toFixed(2);
  // Snellen lookup table (decimal → 20/x)
  const snellenTable: [number, string][] = [
    [2.0, "20/10"], [1.6, "20/13"], [1.26, "20/16"], [1.0, "20/20"],
    [0.8, "20/25"], [0.63, "20/32"], [0.5, "20/40"], [0.4, "20/50"],
    [0.32, "20/63"], [0.25, "20/80"], [0.2, "20/100"], [0.16, "20/125"],
    [0.1, "20/200"], [0.05, "20/400"],
  ];
  // Find closest match
  let closest = snellenTable[0];
  let minDiff = Math.abs(decimal - snellenTable[0][0]);
  for (const entry of snellenTable) {
    const diff = Math.abs(decimal - entry[0]);
    if (diff < minDiff) { minDiff = diff; closest = entry; }
  }
  return closest[1];
}
