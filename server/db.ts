import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
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
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const openId = `email:${data.email}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
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
 * Retorna todas as medições reais associadas a uma IOL específica,
 * com seus pontos de curva Defocus. Dados anonimizados (sem nome do paciente).
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
    .groupBy(users.id, users.name, users.email, users.role, users.loginMethod, users.createdAt, users.lastSignedIn)
    .orderBy(desc(users.createdAt));
  return rows;
}

/**
 * Admin: detalhes de um médico específico (pacientes + IOLs usadas + medições).
 */
export async function adminGetUserDetail(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
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
      totalDoctors: sql<number>`COUNT(DISTINCT ${patients.userId})`,
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
