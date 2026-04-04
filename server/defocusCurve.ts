/**
 * DefocusApp — Defocus Curve Utilities
 *
 * Implements:
 *  1. Visual Acuity conversions (Decimal / Snellen / logMAR)
 *  2. Monotone Cubic Spline interpolation (Fritsch–Carlson algorithm)
 *     — avoids Runge's phenomenon seen with polynomial regression
 */

// ─── 1. Conversions ───────────────────────────────────────────────────────────

/** Convert Decimal VA (e.g. 1.0, 0.5) to logMAR */
export function decimalToLogMAR(decimal: number): number {
  if (decimal <= 0) return 3.0; // practical maximum for no light perception
  return -Math.log10(decimal);
}

/** Convert Snellen fraction string (e.g. "20/40") to logMAR */
export function snellenToLogMAR(snellen: string): number {
  const parts = snellen.trim().split("/");
  if (parts.length !== 2) throw new Error(`Invalid Snellen: ${snellen}`);
  const numerator = parseFloat(parts[0]);
  const denominator = parseFloat(parts[1]);
  if (!numerator || !denominator) throw new Error(`Invalid Snellen: ${snellen}`);
  return Math.log10(denominator / numerator);
}

/** Convert logMAR to Decimal VA */
export function logMARToDecimal(logmar: number): number {
  return Math.pow(10, -logmar);
}

/** Convert logMAR to Snellen string (20/x format) */
export function logMARToSnellen(logmar: number): string {
  const denominator = Math.round(20 * Math.pow(10, logmar));
  return `20/${denominator}`;
}

/**
 * Normalize any VA input to logMAR.
 * Accepts:
 *  - number → treated as Decimal VA (e.g. 1.0, 0.8)
 *  - string containing "/" → treated as Snellen (e.g. "20/20")
 *  - string without "/" → treated as logMAR or Decimal depending on avInputType
 */
export type AVInputType = "decimal" | "snellen" | "logmar";

export function normalizeToLogMAR(value: string | number, inputType: AVInputType = "decimal"): number {
  if (typeof value === "number") {
    if (inputType === "logmar") return value;
    if (inputType === "snellen") throw new Error("Snellen must be a string");
    return decimalToLogMAR(value);
  }

  const str = value.toString().trim();
  if (str.includes("/")) return snellenToLogMAR(str);

  const num = parseFloat(str);
  if (isNaN(num)) throw new Error(`Cannot parse VA value: ${str}`);

  if (inputType === "logmar") return num;
  if (inputType === "decimal") return decimalToLogMAR(num);
  return decimalToLogMAR(num); // fallback
}

// ─── 2. Monotone Cubic Spline (Fritsch–Carlson) ───────────────────────────────
// Reference: https://en.wikipedia.org/wiki/Monotone_cubic_interpolation

interface SplinePoint {
  x: number;
  y: number;
}

function monotonicCubicSpline(points: SplinePoint[]): (x: number) => number {
  const n = points.length;
  if (n < 2) throw new Error("Need at least 2 points for spline");

  // Sort by x
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  // Step 1: Compute secant slopes
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  // Step 2: Initialize tangents
  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (delta[i - 1] + delta[i]) / 2;
  }

  // Step 3: Fritsch–Carlson monotonicity conditions
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(delta[i]) < 1e-12) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / delta[i];
      const beta = m[i + 1] / delta[i];
      const tau = alpha * alpha + beta * beta;
      if (tau > 9) {
        const t = 3 / Math.sqrt(tau);
        m[i] = t * alpha * delta[i];
        m[i + 1] = t * beta * delta[i];
      }
    }
  }

  // Step 4: Hermite interpolation
  return function interpolate(x: number): number {
    // Clamp to range
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];

    // Binary search for interval
    let lo = 0;
    let hi = n - 2;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (xs[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    const i = lo - 1 < 0 ? 0 : lo - 1;

    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    // Hermite basis functions
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

// ─── 3. Main export: generate interpolated defocus curve ─────────────────────

export interface RawDefocusPoint {
  diopter: number;
  visualAcuity: number; // stored as Decimal in DB
}

export interface InterpolatedPoint {
  diopter: number;       // dioptric value
  logmar: number;        // logMAR (primary scale for chart)
  decimal: number;       // Decimal VA (for display)
  snellen: string;       // Snellen equivalent (for tooltip)
}

/**
 * Takes raw measurement points (stored as Decimal VA in DB),
 * converts to logMAR, applies monotone cubic spline interpolation,
 * and returns a dense array of points for smooth chart rendering.
 *
 * @param rawPoints  Array of {diopter, visualAcuity} from DB
 * @param nPoints    Number of output points (default 100)
 * @param xMin       Left bound of X axis in diopters (default +1.0)
 * @param xMax       Right bound of X axis in diopters (default -4.0)
 */
export function generateDefocusCurve(
  rawPoints: RawDefocusPoint[],
  nPoints = 100,
  xMin = 1.0,
  xMax = -4.0
): InterpolatedPoint[] {
  if (rawPoints.length < 2) return [];

  // Convert to logMAR and average duplicate diopter values to avoid NaN in spline
  const grouped: Record<string, number[]> = {};
  rawPoints
    .filter((p) => p.visualAcuity > 0 && !isNaN(p.diopter) && !isNaN(p.visualAcuity))
    .forEach((p) => {
      const key = p.diopter.toFixed(2);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(decimalToLogMAR(p.visualAcuity));
    });

  const splineInput: SplinePoint[] = Object.entries(grouped)
    .map(([xStr, ys]) => ({
      x: parseFloat(xStr),
      y: ys.reduce((a, b) => a + b, 0) / ys.length,
    }))
    .sort((a, b) => a.x - b.x);

  if (splineInput.length < 2) return [];

  const interpolate = monotonicCubicSpline(splineInput);

  // Generate dense points from xMin to xMax
  // Note: xMin > xMax because axis goes from +1.0 (left) to -4.0 (right)
  const start = Math.max(xMin, splineInput[0].x);
  const end = Math.min(xMax, splineInput[splineInput.length - 1].x);

  // Ensure we go from higher to lower diopter value (left to right on chart)
  const actualStart = Math.max(start, end);
  const actualEnd = Math.min(start, end);

  const step = (actualEnd - actualStart) / (nPoints - 1);
  const result: InterpolatedPoint[] = [];

  for (let i = 0; i < nPoints; i++) {
    const d = actualStart + step * i;
    const logmar = Math.max(-0.3, Math.min(3.0, interpolate(d))); // clamp to physiological range
    const decimal = logMARToDecimal(logmar);
    result.push({
      diopter: parseFloat(d.toFixed(3)),
      logmar: parseFloat(logmar.toFixed(3)),
      decimal: parseFloat(decimal.toFixed(3)),
      snellen: logMARToSnellen(logmar),
    });
  }

  return result;
}

/**
 * Compute the area under the defocus curve above the 0.20 logMAR threshold
 * (functional vision line). Useful for a single "performance score" metric.
 */
export function computeFunctionalArea(curve: InterpolatedPoint[], threshold = 0.20): number {
  if (curve.length < 2) return 0;
  let area = 0;
  for (let i = 0; i < curve.length - 1; i++) {
    const dx = Math.abs(curve[i + 1].diopter - curve[i].diopter);
    const avgLogMAR = (curve[i].logmar + curve[i + 1].logmar) / 2;
    // Area below threshold = functional vision
    if (avgLogMAR <= threshold) {
      area += dx;
    }
  }
  return parseFloat(area.toFixed(2));
}
