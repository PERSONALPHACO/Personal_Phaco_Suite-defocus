import { describe, it, expect } from "vitest";
import { parseVAInput, decimalToDisplay } from "../shared/vaParser";

// ─── Tests for parseVAInput ───────────────────────────────────────────────────

describe("parseVAInput - Snellen mode", () => {
  it("parses standard slash format: 20/20", () => {
    expect(parseVAInput("20/20", "snellen")).toBe(1.0);
  });

  it("parses standard slash format: 20/40", () => {
    expect(parseVAInput("20/40", "snellen")).toBe(0.5);
  });

  it("parses standard slash format: 20/200", () => {
    expect(parseVAInput("20/200", "snellen")).toBe(0.1);
  });

  it("parses standard slash format: 20/100", () => {
    expect(parseVAInput("20/100", "snellen")).toBe(0.2);
  });

  it("parses bare denominator: 40 → 20/40", () => {
    expect(parseVAInput("40", "snellen")).toBe(0.5);
  });

  it("parses bare denominator: 200 → 20/200", () => {
    expect(parseVAInput("200", "snellen")).toBe(0.1);
  });

  it("parses bare denominator: 100 → 20/100", () => {
    expect(parseVAInput("100", "snellen")).toBe(0.2);
  });

  it("parses concatenated format: 2020 → 20/20", () => {
    expect(parseVAInput("2020", "snellen")).toBe(1.0);
  });

  it("parses concatenated format: 2040 → 20/40", () => {
    expect(parseVAInput("2040", "snellen")).toBe(0.5);
  });

  it("parses concatenated format: 20200 → 20/200", () => {
    expect(parseVAInput("20200", "snellen")).toBe(0.1);
  });

  it("parses concatenated format: 20100 → 20/100", () => {
    expect(parseVAInput("20100", "snellen")).toBe(0.2);
  });

  it("parses concatenated format: 2025 → 20/25", () => {
    expect(parseVAInput("2025", "snellen")).toBeCloseTo(0.8, 2);
  });

  it("parses concatenated format: 2050 → 20/50", () => {
    expect(parseVAInput("2050", "snellen")).toBeCloseTo(0.4, 2);
  });

  it("parses concatenated format: 2080 → 20/80", () => {
    expect(parseVAInput("2080", "snellen")).toBeCloseTo(0.25, 2);
  });

  it("parses concatenated format: 20400 → 20/400", () => {
    expect(parseVAInput("20400", "snellen")).toBeCloseTo(0.05, 2);
  });

  it("returns null for empty string", () => {
    expect(parseVAInput("", "snellen")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseVAInput("abc", "snellen")).toBeNull();
  });
});

describe("parseVAInput - decimal mode", () => {
  it("parses 1.0", () => {
    expect(parseVAInput("1.0", "decimal")).toBe(1.0);
  });

  it("parses 0.5", () => {
    expect(parseVAInput("0.5", "decimal")).toBe(0.5);
  });

  it("returns null for empty", () => {
    expect(parseVAInput("", "decimal")).toBeNull();
  });
});

describe("parseVAInput - logMAR mode", () => {
  it("parses 0.00 → 1.0 decimal", () => {
    expect(parseVAInput("0.00", "logmar")).toBeCloseTo(1.0, 2);
  });

  it("parses 0.30 → ~0.5 decimal", () => {
    expect(parseVAInput("0.30", "logmar")).toBeCloseTo(0.501, 2);
  });

  it("parses 1.00 → 0.1 decimal", () => {
    expect(parseVAInput("1.00", "logmar")).toBeCloseTo(0.1, 2);
  });

  it("returns null for empty", () => {
    expect(parseVAInput("", "logmar")).toBeNull();
  });
});

describe("decimalToDisplay", () => {
  it("converts 1.0 to Snellen 20/20", () => {
    expect(decimalToDisplay(1.0, "snellen")).toBe("20/20");
  });

  it("converts 0.5 to Snellen 20/40", () => {
    expect(decimalToDisplay(0.5, "snellen")).toBe("20/40");
  });

  it("converts 1.0 to logMAR 0.00", () => {
    expect(decimalToDisplay(1.0, "logmar")).toBe("0.00");
  });

  it("converts 0.5 to logMAR 0.30", () => {
    expect(decimalToDisplay(0.5, "logmar")).toBe("0.30");
  });

  it("converts 1.0 to decimal 1", () => {
    expect(decimalToDisplay(1.0, "decimal")).toBe("1");
  });
});
