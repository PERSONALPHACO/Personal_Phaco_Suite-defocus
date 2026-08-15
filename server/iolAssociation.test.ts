import { describe, expect, it } from "vitest";
import {
  associateIOLMeasurements,
  type IOLImplantForAssociation,
  type MeasurementForAssociation,
} from "./db";

const date = new Date("2026-08-15T12:00:00Z");

function measurement(overrides: Partial<MeasurementForAssociation>): MeasurementForAssociation {
  return {
    measurementId: 100,
    patientId: 10,
    patientIolId: null,
    measurementDate: date,
    eye: "OD",
    notes: null,
    userId: 1,
    ...overrides,
  };
}

describe("associateIOLMeasurements", () => {
  it("atribui medição monocular somente ao implante do mesmo olho", () => {
    const implants: IOLImplantForAssociation[] = [
      { id: 1, patientId: 10, eye: "OD", refractiveTarget: "0.00" },
      { id: 2, patientId: 10, eye: "OS", refractiveTarget: "-0.50" },
    ];

    const associations = associateIOLMeasurements(implants, [measurement({ eye: "OD" })]);

    expect(associations).toHaveLength(1);
    expect(associations[0].matchedPatientIolId).toBe(1);
  });

  it("honra patientIolId explícito como vínculo autoritativo", () => {
    const implants: IOLImplantForAssociation[] = [
      { id: 1, patientId: 10, eye: "OD", refractiveTarget: "0.00" },
      { id: 2, patientId: 10, eye: "OS", refractiveTarget: "-0.50" },
    ];

    const associations = associateIOLMeasurements(
      implants,
      [measurement({ eye: "OD", patientIolId: 2 })]
    );

    expect(associations).toHaveLength(1);
    expect(associations[0].matchedPatientIolId).toBe(2);
  });

  it("não atribui medição OU a uma IOL presente em apenas um olho", () => {
    const implants: IOLImplantForAssociation[] = [
      { id: 1, patientId: 10, eye: "OD", refractiveTarget: "0.00" },
    ];

    expect(associateIOLMeasurements(implants, [measurement({ eye: "OU" })])).toEqual([]);
  });

  it("atribui medição OU quando a mesma IOL existe em OD e OS", () => {
    const implants: IOLImplantForAssociation[] = [
      { id: 1, patientId: 10, eye: "OD", refractiveTarget: "0.00" },
      { id: 2, patientId: 10, eye: "OS", refractiveTarget: "0.00" },
    ];

    const associations = associateIOLMeasurements(implants, [measurement({ eye: "OU" })]);

    expect(associations.map((entry) => entry.matchedPatientIolId).sort()).toEqual([1, 2]);
  });

  it("aceita implante OU como cobertura bilateral para medição monocular e binocular", () => {
    const implants: IOLImplantForAssociation[] = [
      { id: 3, patientId: 10, eye: "OU", refractiveTarget: "0.00" },
    ];

    const associations = associateIOLMeasurements(implants, [
      measurement({ measurementId: 101, eye: "OS" }),
      measurement({ measurementId: 102, eye: "OU" }),
    ]);

    expect(associations.map((entry) => entry.matchedPatientIolId)).toEqual([3, 3]);
  });
});
