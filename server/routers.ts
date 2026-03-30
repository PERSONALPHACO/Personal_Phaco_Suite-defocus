import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getAllManufacturers,
  createManufacturer,
  getAllIOLs,
  getIOLById,
  createIOL,
  updateIOL,
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
  createMeasurementPoints,
  deleteMeasurementPoints,
  getIOLComparisonData,
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
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
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
    list: publicProcedure.query(async () => {
      return getAllIOLs();
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

    compare: publicProcedure
      .input(z.object({ iolIds: z.array(z.number()).min(1).max(8) }))
      .query(async ({ input }) => {
        return getIOLComparisonData(input.iolIds);
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
      .query(async ({ input }) => {
        return getPatientIOLs(input.patientId);
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
      .mutation(async ({ input }) => {
        await deletePatientIOL(input.id);
        return { success: true };
      }),
  }),

  // ─── Measurements ────────────────────────────────────────────────────────────
  measurements: router({
    byPatient: protectedProcedure
      .input(z.object({ patientId: z.number() }))
      .query(async ({ input }) => {
        return getMeasurementsByPatient(input.patientId);
      }),

    points: protectedProcedure
      .input(z.object({ measurementId: z.number() }))
      .query(async ({ input }) => {
        return getMeasurementPoints(input.measurementId);
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

        // Get the new measurement ID
        const [newMeasurement] = await getMeasurementsByPatient(input.patientId);
        if (newMeasurement) {
          const pointsToInsert = points.map((p) => ({
            measurementId: newMeasurement.id,
            diopter: p.diopter.toString(),
            visualAcuity: p.visualAcuity.toString(),
          }));
          await createMeasurementPoints(pointsToInsert as any);
        }

        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteMeasurement(input.id);
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
