import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { generateDefocusCurve, computeFunctionalArea } from "./defocusCurve";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail } from "./_core/email";
import {
  getAllManufacturers,
  createManufacturer,
  getAllIOLs,
  adminGetAllUsers,
  adminGetUserDetail,
  adminGetIOLStats,
  createPasswordResetToken,
  getValidPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
  getAllIOLsWithUsage,
  getIOLById,
  createIOL,
  updateIOL,
  deleteIOL,
  getPatientsByUser,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientIOLs,
  createPatientIOL,
  deletePatientIOL,
  getMeasurementsByPatient,
  getMeasurementById,
  createMeasurement,
  deleteMeasurement,
  getMeasurementPoints,
  getPointsForMeasurements,
  createMeasurementPoints,
  deleteMeasurementPoints,
  getIOLComparisonData,
  getIOLCurves,
  getMeasurementCountByUser,
  getUserByEmail,
  createUserWithPassword,
} from "./db";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const iolTypeEnum = z.enum(["monofocal", "bifocal", "trifocal", "edof", "toric"]);
const eyeEnum = z.enum(["OD", "OS", "OU"]);

const measurementPointSchema = z.object({
  diopter: z.number().min(-5).max(3),
  visualAcuity: z.number().min(0).max(2.0),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(128),
          email: z.string().email(),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Check if email already in use
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado. Faça login ou use outro e-mail." });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        await createUserWithPassword({ name: input.name, email: input.email, passwordHash });
        // Fetch the created user and create session
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar conta." });
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    loginEmail: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "" });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, cookieOptions);
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Solicita redefinição de senha: gera token e envia e-mail.
     * Sempre retorna success para não revelar se o e-mail existe.
     */
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
        origin: z.string().url(),
      }))
      .mutation(async ({ input }) => {
        const user = await getUserByEmail(input.email);
        if (user && user.passwordHash) {
          // Only email/password accounts can reset via email
          const token = await createPasswordResetToken(user.id);
          const resetUrl = `${input.origin}/reset-password?token=${token}`;
          await sendPasswordResetEmail(user.email!, user.name ?? "Médico", resetUrl);
        }
        // Always return success to prevent email enumeration
        return { success: true };
      }),

    /**
     * Redefine a senha usando um token válido.
     */
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1),
        newPassword: z.string().min(8).max(128),
      }))
      .mutation(async ({ input }) => {
        const resetToken = await getValidPasswordResetToken(input.token);
        if (!resetToken) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Link inválido ou expirado. Solicite um novo link de redefinição.",
          });
        }
        const passwordHash = await bcrypt.hash(input.newPassword, 12);
        await updateUserPassword(resetToken.userId, passwordHash);
        await markPasswordResetTokenUsed(input.token);
        return { success: true };
      }),
  }),

  // ─── Manufacturers ──────────────────────────────────────────────────────────
  manufacturers: router({
    list: publicProcedure.query(async () => {
      return getAllManufacturers();
    }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(128),
          country: z.string().max(64).optional(),
          website: z.string().max(256).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createManufacturer(input);
        return { success: true };
      }),
  }),

  // ─── IOLs ───────────────────────────────────────────────────────────────────
  iols: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getAllIOLsWithUsage(ctx.user.id);
    }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getIOLById(input.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          manufacturerId: z.number(),
          model: z.string().min(1).max(128),
          type: iolTypeEnum,
          material: z.string().max(64).optional(),
          opticDesign: z.string().max(128).optional(),
          powerRange: z.string().max(64).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createIOL(input);
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          model: z.string().min(1).max(128).optional(),
          type: iolTypeEnum.optional(),
          material: z.string().max(64).optional(),
          opticDesign: z.string().max(128).optional(),
          powerRange: z.string().max(64).optional(),
          notes: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await updateIOL(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteIOL(input.id);
        return { success: true };
      }),

    compare: publicProcedure
      .input(z.object({ iolIds: z.array(z.number()).min(1).max(8) }))
      .query(async ({ input }) => {
        return getIOLComparisonData(input.iolIds);
      }),

    // Retorna todas as curvas reais de Defocus associadas a uma IOL específica
    curves: publicProcedure
      .input(z.object({ iolId: z.number() }))
      .query(async ({ input }) => {
        return getIOLCurves(input.iolId);
      }),
  }),

  // ─── Patients ───────────────────────────────────────────────────────────────
  patients: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPatientsByUser(ctx.user.id);
    }),

    byId: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return getPatientById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(256),
          birthDate: z.string().optional(), // ISO date string
          cpf: z.string().max(14).optional(),
          phone: z.string().max(20).optional(),
          email: z.string().email().optional().or(z.literal("")),
          notes: z.string().optional(),
          lgpdConsent: z.boolean().default(false),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data = {
          ...input,
          userId: ctx.user.id,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          lgpdConsentDate: input.lgpdConsent ? new Date() : undefined,
        };
        await createPatient(data as any);
        return { success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(256).optional(),
          birthDate: z.string().optional(),
          cpf: z.string().max(14).optional(),
          phone: z.string().max(20).optional(),
          email: z.string().email().optional().or(z.literal("")),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await updatePatient(id, ctx.user.id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deletePatient(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Patient IOLs ────────────────────────────────────────────────────────────
  patientIols: router({
    list: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getPatientIOLs(input.patientId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          iolId: z.number(),
          eye: eyeEnum,
          surgeryDate: z.string().optional(),
          refractiveTarget: z.number().min(-5).max(5).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data = {
          ...input,
          surgeryDate: input.surgeryDate ? new Date(input.surgeryDate) : undefined,
          refractiveTarget: input.refractiveTarget?.toString(),
        };
        await createPatientIOL(data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deletePatientIOL(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  // ─── Measurements ────────────────────────────────────────────────────────────
  measurements: router({
    totalCount: protectedProcedure
      .query(async ({ ctx }) => {
        return getMeasurementCountByUser(ctx.user.id);
      }),

    byPatient: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getMeasurementsByPatient(input.patientId, ctx.user.id);
      }),

    points: protectedProcedure
      .input(z.object({ measurementId: z.number() }))
      .query(async ({ input }) => {
        return getMeasurementPoints(input.measurementId);
      }),

    /** Batch: retorna pontos de múltiplas medições de uma vez */
    pointsBatch: protectedProcedure
      .input(z.object({ measurementIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return getPointsForMeasurements(input.measurementIds);
      }),

    /**
     * Retorna a curva Defocus interpolada (spline monótona) em logMAR
     * para uma medição específica. Inclui métricas de visão funcional.
     */
    defocusCurve: protectedProcedure
      .input(z.object({
        measurementId: z.number(),
        nPoints: z.number().min(20).max(500).default(100),
      }))
      .query(async ({ input }) => {
        const rawPoints = await getMeasurementPoints(input.measurementId);
        const normalized = rawPoints.map((p) => ({
          diopter: parseFloat(p.diopter as any),
          visualAcuity: parseFloat(p.visualAcuity as any),
        }));
        const curve = generateDefocusCurve(normalized, input.nPoints);
        const functionalArea = computeFunctionalArea(curve);
        const peakPoint = curve.reduce(
          (best, p) => (p.logmar < best.logmar ? p : best),
          curve[0] ?? { logmar: 3, diopter: 0, decimal: 0, snellen: "CF" }
        );
        return {
          measurementId: input.measurementId,
          curve,
          rawPoints: normalized,
          functionalArea,
          peakLogMAR: peakPoint.logmar,
          peakDiopter: peakPoint.diopter,
          peakSnellen: peakPoint.snellen,
        };
      }),

    /**
     * Retorna curvas Defocus interpoladas para múltiplas medições (batch)
     */
    defocusCurveBatch: protectedProcedure
      .input(z.object({
        measurementIds: z.array(z.number()),
        nPoints: z.number().min(20).max(500).default(100),
      }))
      .query(async ({ input }) => {
        const results = await Promise.all(
          input.measurementIds.map(async (id) => {
            const rawPoints = await getMeasurementPoints(id);
            const normalized = rawPoints.map((p) => ({
              diopter: parseFloat(p.diopter as any),
              visualAcuity: parseFloat(p.visualAcuity as any),
            }));
            const curve = generateDefocusCurve(normalized, input.nPoints);
            const functionalArea = computeFunctionalArea(curve);
            const peakPoint = curve.length > 0
              ? curve.reduce((best, p) => (p.logmar < best.logmar ? p : best), curve[0])
              : { logmar: 3, diopter: 0, decimal: 0, snellen: "CF" };
            return {
              measurementId: id,
              curve,
              rawPoints: normalized,
              functionalArea,
              peakLogMAR: peakPoint.logmar,
              peakDiopter: peakPoint.diopter,
              peakSnellen: peakPoint.snellen,
            };
          })
        );
        return results;
      }),

    create: protectedProcedure
      .input(
        z.object({
          patientId: z.number(),
          patientIolId: z.number().optional(),
          measurementDate: z.string(), // ISO date string
          eye: eyeEnum,
          notes: z.string().optional(),
          points: z.array(measurementPointSchema).min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { points, ...measurementData } = input;

        // Create measurement
        const result = await createMeasurement({
          ...measurementData,
          userId: ctx.user.id,
          measurementDate: new Date(measurementData.measurementDate),
        } as any);

        // Use insertId directly from the insert result to avoid race conditions
        const newMeasurementId = result; // createMeasurement now returns insertId directly
        if (newMeasurementId) {
          const pointsToInsert = points.map((p) => ({
            measurementId: newMeasurementId,
            diopter: p.diopter.toString(),
            visualAcuity: p.visualAcuity.toString(),
          }));
          await createMeasurementPoints(pointsToInsert as any);
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMeasurement(input.id, ctx.user.id);
        return { success: true };
      }),

    updatePoints: protectedProcedure
      .input(
        z.object({
          measurementId: z.number(),
          points: z.array(measurementPointSchema),
        })
      )
      .mutation(async ({ input }) => {
        await deleteMeasurementPoints(input.measurementId);
        if (input.points.length > 0) {
          const pointsToInsert = input.points.map((p) => ({
            measurementId: input.measurementId,
            diopter: p.diopter.toString(),
            visualAcuity: p.visualAcuity.toString(),
          }));
          await createMeasurementPoints(pointsToInsert as any);
        }
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

