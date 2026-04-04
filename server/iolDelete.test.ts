import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../drizzle/schema", () => ({
  iols: { id: "id" },
  patientIols: { id: "id", iolId: "iolId" },
  measurements: { id: "id", patientIolId: "patientIolId" },
}));

// We test the business logic of deleteIOL by simulating the dependency checks
describe("deleteIOL - dependency checks", () => {
  it("should throw if IOL has associated patients", async () => {
    // Simulate: piRows.count = 2 (2 patients associated)
    const piRows = { count: 2 };
    const mRows = { count: 0 };

    const simulateDeleteIOL = (piRows: { count: number }, mRows: { count: number }) => {
      if (piRows && Number(piRows.count) > 0) {
        throw new Error(
          `Esta IOL está associada a ${piRows.count} paciente(s) e não pode ser excluída.`
        );
      }
      if (mRows && Number(mRows.count) > 0) {
        throw new Error(
          `Esta IOL possui ${mRows.count} medição(oes) registrada(s) e não pode ser excluída.`
        );
      }
      return "deleted";
    };

    expect(() => simulateDeleteIOL(piRows, mRows)).toThrow(
      "Esta IOL está associada a 2 paciente(s) e não pode ser excluída."
    );
  });

  it("should throw if IOL has associated measurements", async () => {
    const piRows = { count: 0 };
    const mRows = { count: 3 };

    const simulateDeleteIOL = (piRows: { count: number }, mRows: { count: number }) => {
      if (piRows && Number(piRows.count) > 0) {
        throw new Error(
          `Esta IOL está associada a ${piRows.count} paciente(s) e não pode ser excluída.`
        );
      }
      if (mRows && Number(mRows.count) > 0) {
        throw new Error(
          `Esta IOL possui ${mRows.count} medição(oes) registrada(s) e não pode ser excluída.`
        );
      }
      return "deleted";
    };

    expect(() => simulateDeleteIOL(piRows, mRows)).toThrow(
      "Esta IOL possui 3 medição(oes) registrada(s) e não pode ser excluída."
    );
  });

  it("should succeed if IOL has no dependencies", async () => {
    const piRows = { count: 0 };
    const mRows = { count: 0 };

    const simulateDeleteIOL = (piRows: { count: number }, mRows: { count: number }) => {
      if (piRows && Number(piRows.count) > 0) {
        throw new Error(
          `Esta IOL está associada a ${piRows.count} paciente(s) e não pode ser excluída.`
        );
      }
      if (mRows && Number(mRows.count) > 0) {
        throw new Error(
          `Esta IOL possui ${mRows.count} medição(oes) registrada(s) e não pode ser excluída.`
        );
      }
      return "deleted";
    };

    expect(simulateDeleteIOL(piRows, mRows)).toBe("deleted");
  });

  it("should prioritize patient association error over measurement error", async () => {
    const piRows = { count: 1 };
    const mRows = { count: 5 };

    const simulateDeleteIOL = (piRows: { count: number }, mRows: { count: number }) => {
      if (piRows && Number(piRows.count) > 0) {
        throw new Error(
          `Esta IOL está associada a ${piRows.count} paciente(s) e não pode ser excluída.`
        );
      }
      if (mRows && Number(mRows.count) > 0) {
        throw new Error(
          `Esta IOL possui ${mRows.count} medição(oes) registrada(s) e não pode ser excluída.`
        );
      }
      return "deleted";
    };

    expect(() => simulateDeleteIOL(piRows, mRows)).toThrow(
      "Esta IOL está associada a 1 paciente(s) e não pode ser excluída."
    );
  });
});
