import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  date,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Email/password auth fields
  passwordHash: varchar("passwordHash", { length: 256 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  // Professional registration
  crm: varchar("crm", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * IOL Manufacturers (Fabricantes de Lentes Intraoculares)
 */
export const manufacturers = mysqlTable("manufacturers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  country: varchar("country", { length: 64 }),
  website: varchar("website", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Manufacturer = typeof manufacturers.$inferSelect;
export type InsertManufacturer = typeof manufacturers.$inferInsert;

/**
 * IOLs (Intraocular Lenses / Lentes Intraoculares)
 */
export const iols = mysqlTable("iols", {
  id: int("id").autoincrement().primaryKey(),
  manufacturerId: int("manufacturerId").notNull(),
  model: varchar("model", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["monofocal", "bifocal", "trifocal", "edof", "toric"]).notNull().default("trifocal"),
  material: varchar("material", { length: 64 }),
  opticDesign: varchar("opticDesign", { length: 128 }),
  powerRange: varchar("powerRange", { length: 64 }),
  aConstant: decimal("aConstant", { precision: 5, scale: 1 }), // Constante A para cálculo de potência
  notes: text("notes"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IOL = typeof iols.$inferSelect;
export type InsertIOL = typeof iols.$inferInsert;

/**
 * Patients (Pacientes)
 * LGPD: dados pessoais sensíveis, acesso restrito ao médico responsável
 */
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(), // médico responsável
  name: varchar("name", { length: 256 }).notNull(),
  birthDate: date("birthDate"),
  cpf: varchar("cpf", { length: 14 }), // armazenado de forma segura
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  lgpdConsent: boolean("lgpdConsent").default(false).notNull(),
  lgpdConsentDate: timestamp("lgpdConsentDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;

/**
 * Patient IOL Associations (Associação Paciente-IOL)
 * Registra qual IOL foi implantado em qual olho com qual alvo refrativo
 */
export const patientIols = mysqlTable("patient_iols", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  iolId: int("iolId").notNull(),
  eye: mysqlEnum("eye", ["OD", "OS", "OU"]).notNull(), // OD=direito, OS=esquerdo, OU=ambos
  surgeryDate: date("surgeryDate"),
  refractiveTarget: decimal("refractiveTarget", { precision: 4, scale: 2 }), // ex: -0.25, 0.00, +0.50
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PatientIOL = typeof patientIols.$inferSelect;
export type InsertPatientIOL = typeof patientIols.$inferInsert;

/**
 * Measurements (Medições de Acuidade Visual)
 * Cada medição representa uma sessão de avaliação do paciente
 */
export const measurements = mysqlTable("measurements", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  patientIolId: int("patientIolId"), // IOL associado (opcional)
  userId: int("userId").notNull(), // médico que realizou a medição
  measurementDate: date("measurementDate").notNull(),
  eye: mysqlEnum("eye", ["OD", "OS", "OU"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Measurement = typeof measurements.$inferSelect;
export type InsertMeasurement = typeof measurements.$inferInsert;

/**
 * Measurement Points (Pontos da Curva de Defoque)
 * Cada ponto representa (dioptria, acuidade visual) para construir a curva
 */
export const measurementPoints = mysqlTable("measurement_points", {
  id: int("id").autoincrement().primaryKey(),
  measurementId: int("measurementId").notNull(),
  diopter: decimal("diopter", { precision: 4, scale: 2 }).notNull(), // ex: -3.00, -2.50, ..., 0.00, +0.50
  visualAcuity: decimal("visualAcuity", { precision: 4, scale: 2 }).notNull(), // logMAR ou decimal (0.0 a 1.0+)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeasurementPoint = typeof measurementPoints.$inferSelect;
export type InsertMeasurementPoint = typeof measurementPoints.$inferInsert;

/**
 * Password Reset Tokens
 * Tokens de redefinição de senha com expiração de 1 hora
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;
