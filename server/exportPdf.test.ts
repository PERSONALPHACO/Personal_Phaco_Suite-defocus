import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getPatientById: vi.fn(),
    getMeasurementsByPatient: vi.fn(),
    getPatientIOLs: vi.fn(),
  };
});

vi.mock("./pdfGenerator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pdfGenerator")>();
  return { ...actual, generatePDFReport: vi.fn().mockResolvedValue(Buffer.from("%PDF")) };
});

import { appRouter } from "./routers";
import { getPatientById, getMeasurementsByPatient, getPatientIOLs } from "./db";
import { generatePDFReport, buildChartSvg } from "./pdfGenerator";

const user = { id: 7, name: "Dra. Teste", email: "t@t.com", role: "user" } as any;
const caller = appRouter.createCaller({ req: { headers: {} }, res: {}, user } as any);

const serie = (id: number) => ({
  id,
  label: "30/09/26 OD",
  color: "#2a78d6",
  points: [
    { diopter: 0, visualAcuity: 0 },
    { diopter: -2, visualAcuity: 0.2 },
  ],
});

describe("patients.exportPDF — posse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recusa paciente de outro médico", async () => {
    vi.mocked(getPatientById).mockResolvedValue(undefined as any);
    await expect(
      caller.patients.exportPDF({ patientId: 99, series: [serie(1)] })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getPatientById).toHaveBeenCalledWith(99, 7);
    expect(generatePDFReport).not.toHaveBeenCalled();
  });

  it("recusa série que não é medição deste paciente", async () => {
    vi.mocked(getPatientById).mockResolvedValue({ id: 5, userId: 7 } as any);
    vi.mocked(getMeasurementsByPatient).mockResolvedValue([{ id: 1 }] as any);
    await expect(
      caller.patients.exportPDF({ patientId: 5, series: [serie(1), serie(2)] })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(generatePDFReport).not.toHaveBeenCalled();
  });

  it("gera com a lista de LIOs vinda do banco", async () => {
    vi.mocked(getPatientById).mockResolvedValue({ id: 5, userId: 7 } as any);
    vi.mocked(getMeasurementsByPatient).mockResolvedValue([{ id: 1 }] as any);
    vi.mocked(getPatientIOLs).mockResolvedValue([
      { eye: "OD", iolModel: "Lente X", manufacturerName: "Fab", surgeryDate: new Date("2026-08-10T00:00:00Z"), refractiveTarget: "-0.50" },
    ] as any);
    const r = await caller.patients.exportPDF({ patientId: 5, series: [serie(1)] });
    expect(r.pdf).toBe(Buffer.from("%PDF").toString("base64"));
    const data = vi.mocked(generatePDFReport).mock.calls[0][0];
    expect(data.caseId).toBe("5");
    expect(data.iols).toEqual([
      { eye: "OD", iolName: "Lente X", manufacturer: "Fab", surgeryDate: "10/08/2026", refractiveTarget: "-0.50" },
    ]);
  });

  it("limita tamanho e faixa dos pontos", async () => {
    await expect(
      caller.patients.exportPDF({
        patientId: 5,
        series: [{ ...serie(1), points: [{ diopter: -40, visualAcuity: 0 }] }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("gráfico do PDF — padrão Personal Phaco", () => {
  it("eixo X vai de +1,0 (esquerda) a −3,5 (direita)", () => {
    const svg = buildChartSvg([]);
    const xOf = (label: string) => {
      const m = svg.match(new RegExp(`<text x="([\\d.]+)"[^>]*>${label.replace(".", "\\.")}</text>`));
      return m ? parseFloat(m[1]) : NaN;
    };
    expect(xOf("1.0")).toBeLessThan(xOf("0.0"));
    expect(xOf("0.0")).toBeLessThan(xOf("-3.5"));
  });

  it("eixo Y termina em 0,6 logMAR", () => {
    const svg = buildChartSvg([]);
    expect(svg).toContain(">0.6</text>");
    expect(svg).not.toContain(">0.7</text>");
  });
});
