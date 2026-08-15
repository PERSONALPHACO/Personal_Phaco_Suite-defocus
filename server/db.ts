import { eq, and, or, isNull, desc, asc, inArray, sql } from "drizzle-orm";
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
  passwordResetTokens,
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserWithPassword(data: {
  name: string;
  email: string;
  passwordHash: string;
  crm?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `email:${data.email}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    crm: data.crm ?? null,
    loginMethod: "email",
    emailVerified: false,
    lastSignedIn: new Date(),
  });
}

// ─── Manufacturers ────────────────────────────────────────────────────────────────────────────────────

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

/**
 * Returns all active IOLs with usage count for the given user (doctor).
 * IOLs used more frequently by this doctor appear first.
 * Falls back to alphabetical order for ties.
 * Uses a JOIN with patients table to avoid subqueries in ON clause (TiDB limitation).
 */
export async function getAllIOLsWithUsage(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Join patient_iols -> patients to scope usage count to this doctor's patients
  const rows = await db
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
      usageCount: sql<number>`COUNT(DISTINCT CASE WHEN ${patients.userId} = ${userId} THEN ${patientIols.id} ELSE NULL END)`,
    })
    .from(iols)
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .leftJoin(patientIols, eq(patientIols.iolId, iols.id))
    .leftJoin(patients, eq(patientIols.patientId, patients.id))
    .where(eq(iols.isActive, true))
    .groupBy(
      iols.id,
      iols.manufacturerId,
      iols.model,
      iols.type,
      iols.material,
      iols.opticDesign,
      iols.powerRange,
      iols.notes,
      iols.aConstant,
      iols.isActive,
      iols.createdAt,
      iols.updatedAt,
      manufacturers.name,
      manufacturers.country
    )
    .orderBy(
      sql`COUNT(DISTINCT CASE WHEN ${patients.userId} = ${userId} THEN ${patientIols.id} ELSE NULL END) DESC`,
      asc(manufacturers.name),
      asc(iols.model)
    );
  return rows;
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

export async function deleteIOL(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check for dependencies: patient_iols and measurements
  const [piRows] = await db.select({ count: sql<number>`COUNT(*)` }).from(patientIols).where(eq(patientIols.iolId, id));
  if (piRows && Number(piRows.count) > 0) {
    throw new Error(`Esta IOL está associada a ${piRows.count} paciente(s) e não pode ser excluída.`);
  }
  const [mRows] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(measurements)
    .innerJoin(patientIols, eq(measurements.patientIolId, patientIols.id))
    .where(eq(patientIols.iolId, id));
  if (mRows && Number(mRows.count) > 0) {
    throw new Error(`Esta IOL possui ${mRows.count} medição(oes) registrada(s) e não pode ser excluída.`);
  }
  await db.delete(iols).where(eq(iols.id, id));
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

// ───// ─── Patient IOLs ─────────────────────────────────────────────────────

export async function getPatientIOLs(patientId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Verify ownership: only return IOLs for patients belonging to this doctor
  const patient = await getPatientById(patientId, userId);
  if (!patient) return [];
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

export async function deletePatientIOL(id: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify ownership via patient if userId provided
  if (userId !== undefined) {
    const [pi] = await db
      .select({ patientUserId: patients.userId })
      .from(patientIols)
      .innerJoin(patients, eq(patientIols.patientId, patients.id))
      .where(eq(patientIols.id, id))
      .limit(1);
    if (!pi || pi.patientUserId !== userId) throw new Error("IOL de paciente não encontrada ou sem permissão.");
  }
  await db.delete(patientIols).where(eq(patientIols.id, id));
}

// ─── Measurements ─────────────────────────────────────────────────────────────

export async function getMeasurementsByPatient(patientId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Verify ownership before returning measurements
  const patient = await getPatientById(patientId, userId);
  if (!patient) return [];
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

export async function getMeasurementById(id: number, userId?: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(measurements)
    .where(userId !== undefined
      ? and(eq(measurements.id, id), eq(measurements.userId, userId))
      : eq(measurements.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function createMeasurement(data: InsertMeasurement): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(measurements).values(data) as any;
  return result.insertId as number;
}

export async function deleteMeasurement(id: number, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Verify ownership if userId provided
  if (userId !== undefined) {
    const m = await getMeasurementById(id, userId);
    if (!m) throw new Error("Medição não encontrada ou sem permissão.");
  }
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
 * Associa medições a uma IOL segundo a mesma regra clínica em todas as telas.
 * A função retorna uma linha por par medição–implante: uma medição binocular
 * pode ter duas linhas quando a mesma IOL foi implantada em OD e OS.
 */
export type IOLImplantForAssociation = {
  id: number;
  patientId: number;
  eye: "OD" | "OS" | "OU";
  refractiveTarget: string | null;
};

export type MeasurementForAssociation = {
  measurementId: number;
  patientId: number;
  patientIolId: number | null;
  measurementDate: Date;
  eye: "OD" | "OS" | "OU";
  notes: string | null;
  userId: number;
};

export type IOLMeasurementAssociation = {
  measurementId: number;
  measurementDate: Date;
  eye: "OD" | "OS" | "OU";
  notes: string | null;
  userId: number;
  matchedPatientIolId: number;
  refractiveTarget: string | null;
};

/** Aplica a regra clínica de associação sem depender de recursos SQL do banco. */
export function associateIOLMeasurements(
  implants: IOLImplantForAssociation[],
  measurementRows: MeasurementForAssociation[]
): IOLMeasurementAssociation[] {
  const implantsByPatient = new Map<number, IOLImplantForAssociation[]>();
  for (const implant of implants) {
    const patientImplants = implantsByPatient.get(implant.patientId) ?? [];
    patientImplants.push(implant);
    implantsByPatient.set(implant.patientId, patientImplants);
  }

  const associations: IOLMeasurementAssociation[] = [];
  for (const measurement of measurementRows) {
    const patientImplants = implantsByPatient.get(measurement.patientId) ?? [];
    let matches: IOLImplantForAssociation[] = [];

    if (measurement.patientIolId !== null) {
      matches = patientImplants.filter((implant) => implant.id === measurement.patientIolId);
    } else if (measurement.eye === "OD" || measurement.eye === "OS") {
      matches = patientImplants.filter(
        (implant) => implant.eye === measurement.eye || implant.eye === "OU"
      );
    } else {
      const hasBilateralImplant = patientImplants.some((implant) => implant.eye === "OU");
      const hasOD = patientImplants.some((implant) => implant.eye === "OD" || implant.eye === "OU");
      const hasOS = patientImplants.some((implant) => implant.eye === "OS" || implant.eye === "OU");
      if (hasBilateralImplant || (hasOD && hasOS)) matches = patientImplants;
    }

    for (const implant of matches) {
      associations.push({
        measurementId: measurement.measurementId,
        measurementDate: measurement.measurementDate,
        eye: measurement.eye,
        notes: measurement.notes,
        userId: measurement.userId,
        matchedPatientIolId: implant.id,
        refractiveTarget: implant.refractiveTarget,
      });
    }
  }

  return associations;
}

async function getIOLMeasurementAssociations(iolId: number) {
  const db = await getDb();
  if (!db) return [];

  // TiDB não admite subqueries na cláusula ON. Primeiro carregamos apenas os
  // implantes da IOL alvo e as medições dos respectivos pacientes; em seguida,
  // aplicamos em memória a mesma regra clínica que antes estava no JOIN.
  //
  // Regra clínica:
  //  1. patientIolId explícito é autoritativo;
  //  2. medição OD/OS sem vínculo casa com o mesmo olho ou com implante OU;
  //  3. medição OU sem vínculo entra apenas se a IOL existir nos dois olhos
  //     (ou se houver um implante registrado como OU).
  const implants = await db
    .select({
      id: patientIols.id,
      patientId: patientIols.patientId,
      eye: patientIols.eye,
      refractiveTarget: patientIols.refractiveTarget,
    })
    .from(patientIols)
    .where(eq(patientIols.iolId, iolId));

  if (implants.length === 0) return [];

  const patientIds = Array.from(new Set(implants.map((implant) => implant.patientId)));
  const measurementRows = await db
    .select({
      measurementId: measurements.id,
      patientId: measurements.patientId,
      patientIolId: measurements.patientIolId,
      measurementDate: measurements.measurementDate,
      eye: measurements.eye,
      notes: measurements.notes,
      userId: measurements.userId,
    })
    .from(measurements)
    .where(inArray(measurements.patientId, patientIds))
    .orderBy(desc(measurements.measurementDate));

  return associateIOLMeasurements(implants, measurementRows);
}

/**
 * Retorna todas as medições reais associadas a uma IOL específica,
 * com seus pontos de curva Defocus. Dados anonimizados (sem nome do paciente).
 */
export async function getIOLCurves(iolId: number) {
  const db = await getDb();
  if (!db) return { curves: [], count: 0 };

  const rawRows = await getIOLMeasurementAssociations(iolId);

  // Deduplicar por measurementId (segurança extra)
  const seen = new Set<number>();
  const measurementRows = rawRows.filter((r) => {
    if (seen.has(r.measurementId)) return false;
    seen.add(r.measurementId);
    return true;
  });

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

    // Usa a mesma regra de atribuição de getIOLCurves e do painel admin.
    // Assim, uma curva OD não pode contaminar a IOL implantada no OS.
    const associations = await getIOLMeasurementAssociations(iolId);
    const measurementIds = Array.from(new Set(associations.map((row) => row.measurementId)));
    if (measurementIds.length === 0) {
      results.push({ iol: iolData, points: [] });
      continue;
    }

    const points = await db
      .select({
        diopter: measurementPoints.diopter,
        visualAcuity: measurementPoints.visualAcuity,
      })
      .from(measurementPoints)
      .where(inArray(measurementPoints.measurementId, measurementIds));

    results.push({ iol: iolData, points });
  }
  return results;
}

// ─── Measurement count (for dashboard stats) ─────────────────────────────────
export async function getMeasurementCountByUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(measurements)
    .innerJoin(patients, eq(measurements.patientId, patients.id))
    .where(eq(patients.userId, userId));
  return Number(result[0]?.count ?? 0);
}

// ─── Admin Queries ────────────────────────────────────────────────────────────

/**
 * Admin: lista todos os médicos cadastrados com contagem de pacientes e medições.
 */
export async function adminGetAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      crm: users.crm,
      role: users.role,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
      patientCount: sql<number>`COUNT(DISTINCT ${patients.id})`,
      measurementCount: sql<number>`COUNT(DISTINCT ${measurements.id})`,
    })
    .from(users)
    .leftJoin(patients, eq(patients.userId, users.id))
    .leftJoin(measurements, eq(measurements.userId, users.id))
    .groupBy(users.id, users.name, users.email, users.crm, users.role, users.loginMethod, users.createdAt, users.lastSignedIn)
    .orderBy(desc(users.createdAt));
  return rows;
}

export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const raw = String(val);
  // O Excel pode avaliar valores que começam por estes caracteres como uma
  // fórmula. O apóstrofo força texto sem modificar o valor visível na planilha.
  const str = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  // Inclui CR porque CSV pode receber quebras Windows (\r\n) de campos livres.
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Admin: exporta lista de médicos com estatísticas em formato CSV.
 */
export async function adminExportUsersCsv(): Promise<string> {
  const rows = await adminGetAllUsers();

  const formatDate = (d: Date | null | undefined): string => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  };

  const header = [
    "ID",
    "Nome",
    "Email",
    "CRM",
    "Perfil",
    "Método Login",
    "Data Cadastro",
    "Último Acesso",
    "Total Pacientes",
    "Total Medições",
  ].join(",");

  const lines = rows.map((r) =>
    [
      escapeCsvCell(r.id),
      escapeCsvCell(r.name ?? ""),
      escapeCsvCell(r.email ?? ""),
      escapeCsvCell(r.crm ?? ""),
      escapeCsvCell(r.role === "admin" ? "Administrador" : "Médico"),
      escapeCsvCell(r.loginMethod ?? ""),
      escapeCsvCell(formatDate(r.createdAt)),
      escapeCsvCell(formatDate(r.lastSignedIn)),
      escapeCsvCell(r.patientCount ?? 0),
      escapeCsvCell(r.measurementCount ?? 0),
    ].join(",")
  );

  return [header, ...lines].join("\r\n");
}

/**
 * Admin: detalhes de um médico específico (pacientes + IOLs usadas + medições).
 */
export async function adminGetUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;

  // SEGURANÇA: seleção explícita de colunas. Um `select()` sem projeção trazia
  // a linha inteira de `users` — passwordHash incluído — que era serializada
  // para o navegador do admin e ficava no cache do React Query. Nenhuma tela
  // precisa do hash.
  const [user] = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      crm: users.crm,
      loginMethod: users.loginMethod,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;

  const userPatients = await db
    .select({
      id: patients.id,
      name: patients.name,
      birthDate: patients.birthDate,
      createdAt: patients.createdAt,
      measurementCount: sql<number>`COUNT(DISTINCT ${measurements.id})`,
    })
    .from(patients)
    .leftJoin(measurements, eq(measurements.patientId, patients.id))
    .where(eq(patients.userId, userId))
    .groupBy(patients.id, patients.name, patients.birthDate, patients.createdAt)
    .orderBy(asc(patients.name));

  // IOLs usadas por este médico com contagem
  const iolsUsed = await db
    .select({
      iolId: iols.id,
      iolModel: iols.model,
      iolType: iols.type,
      manufacturerName: manufacturers.name,
      usageCount: sql<number>`COUNT(DISTINCT ${patientIols.id})`,
    })
    .from(patientIols)
    .innerJoin(patients, eq(patientIols.patientId, patients.id))
    .innerJoin(iols, eq(patientIols.iolId, iols.id))
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .where(eq(patients.userId, userId))
    .groupBy(iols.id, iols.model, iols.type, manufacturers.name)
    .orderBy(sql`COUNT(DISTINCT ${patientIols.id}) DESC`);

  return { user, patients: userPatients, iolsUsed };
}

/**
 * Admin: ranking de IOLs por número de usos e métricas agregadas.
 */
export async function adminGetIOLStats() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      iolId: iols.id,
      iolModel: iols.model,
      iolType: iols.type,
      manufacturerName: manufacturers.name,
      totalUses: sql<number>`COUNT(DISTINCT ${patientIols.id})`,
      totalMeasurements: sql<number>`COUNT(DISTINCT ${measurements.id})`,
      totalDoctors: sql<number>`COUNT(DISTINCT ${measurements.userId})`,
    })
    .from(iols)
    .leftJoin(patientIols, eq(patientIols.iolId, iols.id))
    .leftJoin(patients, eq(patientIols.patientId, patients.id))
    .leftJoin(measurements, eq(measurements.patientIolId, patientIols.id))
    .leftJoin(manufacturers, eq(iols.manufacturerId, manufacturers.id))
    .where(eq(iols.isActive, true))
    .groupBy(iols.id, iols.model, iols.type, manufacturers.name)
    .orderBy(sql`COUNT(DISTINCT ${patientIols.id}) DESC`);
  return rows;
}

// ─── Password Reset Tokens ────────────────────────────────────────────────────

import crypto from "crypto";

export async function createPasswordResetToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Invalidate any existing unused tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, userId), sql`${passwordResetTokens.usedAt} IS NULL`));

  const token = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  return token;
}

export async function getValidPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        sql`${passwordResetTokens.usedAt} IS NULL`,
        sql`${passwordResetTokens.expiresAt} > NOW()`
      )
    )
    .limit(1);
  return row ?? null;
}

export async function markPasswordResetTokenUsed(token: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.token, token));
}

export async function updateUserPassword(userId: number, passwordHash: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

/**
 * Admin: retorna e-mails e nomes de todos os usuários com role=admin.
 * Usado para enviar notificações de novo cadastro.
 */
export async function adminGetAllAdminEmails(): Promise<{ email: string; name: string | null }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(and(eq(users.role, "admin"), sql`${users.email} IS NOT NULL`));
  return rows.filter((r) => r.email !== null) as { email: string; name: string | null }[];
}

/**
 * Admin: Curva Defocus média de uma IOL específica
 * Agrega todos os pontos de medição de todos os usos daquela IOL na plataforma.
 * Retorna média e desvio padrão de visualAcuity por diopter.
 */
export async function adminGetIOLCurve(iolId: number) {
  const db = await getDb();
  if (!db) return { points: [], caseCount: 0, doctorCount: 0 };

  // Reutiliza a regra clínica compartilhada de atribuição de medições. Antes,
  // este painel aceitava apenas patientIolId explícito, enquanto comparação e
  // ficha da IOL tinham regras diferentes para registros legados sem vínculo.
  const associations = await getIOLMeasurementAssociations(iolId);
  const measurementIds = Array.from(new Set(associations.map((row) => row.measurementId)));
  if (measurementIds.length === 0) return { points: [], caseCount: 0, doctorCount: 0 };

  const rows = await db
    .select({
      diopter: measurementPoints.diopter,
      visualAcuity: measurementPoints.visualAcuity,
      measurementId: measurementPoints.measurementId,
    })
    .from(measurementPoints)
    .where(inArray(measurementPoints.measurementId, measurementIds))
    .orderBy(asc(measurementPoints.diopter));

  if (rows.length === 0) return { points: [], caseCount: 0, doctorCount: 0 };

  // Agrupar por diopter e calcular média + desvio padrão
  const grouped = new Map<number, number[]>();
  for (const row of rows) {
    const d = Number(row.diopter);
    const va = Number(row.visualAcuity);
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(va);
  }

  const points = Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([diopter, values]) => {
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const stdDev = values.length > 1
        ? Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / (values.length - 1))
        : 0;
      return { diopter, avgVisualAcuity: avg, stdDev, count: values.length };
    });

  // Casos são implantes distintos e médicos são os autores das medições.
  // Ambos são derivados da associação clínica, não dos pontos repetidos.
  const caseCount = new Set(associations.map((row) => row.matchedPatientIolId)).size;
  const doctorCount = new Set(associations.map((row) => row.userId)).size;

  return { points, caseCount, doctorCount };
}

/**
 * Atualiza campos do perfil do usuário (nome, email, passwordHash).
 */
export async function updateUserProfile(
  userId: number,
  updates: { name?: string; email?: string; passwordHash?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (Object.keys(updates).length === 0) return;
  await db.update(users).set(updates).where(eq(users.id, userId));
}
