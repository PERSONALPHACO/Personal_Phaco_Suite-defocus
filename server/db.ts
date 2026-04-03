import { eq, and, desc, asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  manufacturers,
  iols,
  patients,
  patientIols,
  measurements,
  measurementPoints,
  type Manufacturer,
  type InsertManufacturer,
  type IOL,
  type InsertIOL,
  type Patient,
  type InsertPatient,
  type PatientIOL,
  type InsertPatientIOL,
  type Measurement,
  type InsertMeasurement,
  type MeasurementPoint,
  type InsertMeasurementPoint,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Manufacturers ────────────────────────────────────────────────────────────

export async function getAllManufacturers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(manufacturers).orderBy(asc(manufacturers.name));
}

export async function createManufacturer(data: InsertManufacturer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(manufacturers).values(data);
  return result;
}

// ─── IOLs ─────────────────────────────────────────────────────────────────────

export async function getAllIOLs() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: iols.id,
      manufacturerId: iols.manufacturerId,
      model: iols.model,
      type: iols.type,
      material: iols.material,
      opticDesign: iols.opticDesign,
      powerRange: iols.powerRange,
      notes: iols.notes,
      aConstant: iols.aConstant,
      isActive: iols.isActive,
      createdAt: iols.createdAt,
      updatedAt: iols.updatedAt,
      manufacturerName: manufacturers.name,
      manufacturerCountry: manufacturers.country,
    })
    .from(iols)
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .where(eq(iols.isActive, true))
    .orderBy(asc(manufacturers.name), asc(iols.model));
}

export async function getIOLById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      id: iols.id,
      manufacturerId: iols.manufacturerId,
      model: iols.model,
      type: iols.type,
      material: iols.material,
      opticDesign: iols.opticDesign,
      powerRange: iols.powerRange,
      notes: iols.notes,
      aConstant: iols.aConstant,
      isActive: iols.isActive,
      createdAt: iols.createdAt,
      updatedAt: iols.updatedAt,
      manufacturerName: manufacturers.name,
    })
    .from(iols)
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .where(eq(iols.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createIOL(data: InsertIOL) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(iols).values(data);
}

export async function updateIOL(id: number, data: Partial<InsertIOL>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(iols).set(data).where(eq(iols.id, id));
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export async function getPatientsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(patients)
    .where(eq(patients.userId, userId))
    .orderBy(asc(patients.name));
}

export async function getPatientById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createPatient(data: InsertPatient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(patients).values(data);
  return result;
}

export async function updatePatient(id: number, userId: number, data: Partial<InsertPatient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(patients).set(data).where(and(eq(patients.id, id), eq(patients.userId, userId)));
}

export async function deletePatient(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(patients).where(and(eq(patients.id, id), eq(patients.userId, userId)));
}

// ─── Patient IOLs ─────────────────────────────────────────────────────────────

export async function getPatientIOLs(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: patientIols.id,
      patientId: patientIols.patientId,
      iolId: patientIols.iolId,
      eye: patientIols.eye,
      surgeryDate: patientIols.surgeryDate,
      refractiveTarget: patientIols.refractiveTarget,
      notes: patientIols.notes,
      createdAt: patientIols.createdAt,
      iolModel: iols.model,
      iolType: iols.type,
      manufacturerName: manufacturers.name,
    })
    .from(patientIols)
    .leftJoin(iols, eq(patientIols.iolId, iols.id))
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .where(eq(patientIols.patientId, patientId))
    .orderBy(desc(patientIols.createdAt));
}

export async function createPatientIOL(data: InsertPatientIOL) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(patientIols).values(data);
}

export async function deletePatientIOL(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(patientIols).where(eq(patientIols.id, id));
}

// ─── Measurements ─────────────────────────────────────────────────────────────

export async function getMeasurementsByPatient(patientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: measurements.id,
      patientId: measurements.patientId,
      patientIolId: measurements.patientIolId,
      userId: measurements.userId,
      measurementDate: measurements.measurementDate,
      eye: measurements.eye,
      notes: measurements.notes,
      createdAt: measurements.createdAt,
      iolModel: iols.model,
      manufacturerName: manufacturers.name,
    })
    .from(measurements)
    .leftJoin(patientIols, eq(measurements.patientIolId, patientIols.id))
    .leftJoin(iols, eq(patientIols.iolId, iols.id))
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .where(eq(measurements.patientId, patientId))
    .orderBy(desc(measurements.measurementDate));
}

export async function getMeasurementById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(measurements)
    .where(eq(measurements.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createMeasurement(data: InsertMeasurement) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(measurements).values(data);
  return result;
}

export async function deleteMeasurement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(measurementPoints).where(eq(measurementPoints.measurementId, id));
  await db.delete(measurements).where(eq(measurements.id, id));
}

// ─── Measurement Points ───────────────────────────────────────────────────────

export async function getMeasurementPoints(measurementId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(measurementPoints)
    .where(eq(measurementPoints.measurementId, measurementId))
    .orderBy(asc(measurementPoints.diopter));
}

/** Retorna pontos de múltiplas medições de uma vez (evita N queries no frontend) */
export async function getPointsForMeasurements(measurementIds: number[]) {
  const db = await getDb();
  if (!db || measurementIds.length === 0) return [];
  return db
    .select()
    .from(measurementPoints)
    .where(inArray(measurementPoints.measurementId, measurementIds))
    .orderBy(asc(measurementPoints.diopter));
}

export async function createMeasurementPoints(points: InsertMeasurementPoint[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (points.length === 0) return;
  await db.insert(measurementPoints).values(points);
}

export async function deleteMeasurementPoints(measurementId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(measurementPoints).where(eq(measurementPoints.measurementId, measurementId));
}

// ─── IOL Curves (curvas reais por IOL) ──────────────────────────────────────

/**
 * Retorna todas as medições reais associadas a uma IOL específica,
 * com seus pontos de curva de defoque. Dados anonimizados (sem nome do paciente).
 */
export async function getIOLCurves(iolId: number) {
  const db = await getDb();
  if (!db) return { curves: [], count: 0 };

  // Buscar todas as medições que usaram esta IOL
  const measurementRows = await db
    .select({
      measurementId: measurements.id,
      measurementDate: measurements.measurementDate,
      eye: measurements.eye,
      notes: measurements.notes,
      patientIolId: measurements.patientIolId,
      refractiveTarget: patientIols.refractiveTarget,
    })
    .from(measurements)
    .innerJoin(patientIols, eq(measurements.patientIolId, patientIols.id))
    .where(eq(patientIols.iolId, iolId))
    .orderBy(desc(measurements.measurementDate));

  if (measurementRows.length === 0) return { curves: [], count: 0 };

  // Para cada medição, buscar os pontos
  const curves = await Promise.all(
    measurementRows.map(async (m) => {
      const points = await db
        .select({
          diopter: measurementPoints.diopter,
          visualAcuity: measurementPoints.visualAcuity,
        })
        .from(measurementPoints)
        .where(eq(measurementPoints.measurementId, m.measurementId))
        .orderBy(asc(measurementPoints.diopter));

      return {
        measurementId: m.measurementId,
        measurementDate: m.measurementDate,
        eye: m.eye,
        refractiveTarget: m.refractiveTarget,
        points: points.map((p) => ({
          diopter: Number(p.diopter),
          visualAcuity: Number(p.visualAcuity),
        })),
      };
    })
  );

  // Filtrar curvas que têm pelo menos 1 ponto
  const validCurves = curves.filter((c) => c.points.length > 0);

  return { curves: validCurves, count: validCurves.length };
}

// ─── Aggregated IOL data (for comparison) ────────────────────────────────────

export async function getIOLComparisonData(iolIds: number[]) {
  const db = await getDb();
  if (!db) return [];

  const results = [];
  for (const iolId of iolIds) {
    const iolData = await getIOLById(iolId);
    if (!iolData) continue;

    // Get all measurement points for this IOL across all patients (anonymized)
    const points = await db
      .select({
        diopter: measurementPoints.diopter,
        visualAcuity: measurementPoints.visualAcuity,
      })
      .from(measurementPoints)
      .innerJoin(measurements, eq(measurementPoints.measurementId, measurements.id))
      .innerJoin(patientIols, eq(measurements.patientIolId, patientIols.id))
      .where(eq(patientIols.iolId, iolId));

    results.push({ iol: iolData, points });
  }
  return results;
}
