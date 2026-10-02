import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { createSessionToken, SESSION_TTL_MS } from "./_core/session";
import { generateDefocusCurve, computeFunctionalArea } from "./defocusCurve";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendNewDoctorNotification } from "./_core/email";
import { requireAppPublicUrl } from "./_core/env";
import { enforceRateLimit, clientIp } from "./_core/rateLimit";
import { generatePDFReport, type PDFReportData } from "./pdfGenerator";
import {
  getAllManufacturers,
  createManufacturer,
  adminGetAllUsers,
  adminGetUserDetail,
  adminGetIOLStats,
  adminGetIOLCurve,
  adminExportUsersCsv,
  adminGetAllAdminEmails,
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
  updateUserProfile,
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
    // SEGURANÇA: devolvia ctx.user inteiro — a linha completa da tabela users,
    // passwordHash incluído. O hash bcrypt chegava ao navegador e o hook
    // useAuth ainda o gravava em localStorage, onde persiste e fica ao alcance
    // de qualquer XSS ou de quem tenha acesso à máquina. Nenhuma tela precisa
    // do hash: devolvemos apenas os campos que a interface usa.
    me: publicProcedure.query((opts) => {
      const user = opts.ctx.user;
      if (!user) return null;
      return {
        id: user.id,
        openId: user.openId,
        name: user.name,
        email: user.email,
        role: user.role,
        crm: user.crm,
        loginMethod: user.loginMethod,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
      };
    }),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(128),
          email: z.string().email(),
          password: z.string().min(8).max(128),
          crm: z.string().max(20).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit("registerIp", clientIp(ctx.req));
        // Check if email already in use
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "E-mail já cadastrado. Faça login ou use outro e-mail." });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        await createUserWithPassword({ name: input.name, email: input.email, passwordHash, crm: input.crm });
        // Fetch the created user and create session
        const user = await getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao criar conta." });
        const token = await createSessionToken(user.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });

        // Notify all admins asynchronously (does not block registration)
        setImmediate(async () => {
          try {
            const admins = await adminGetAllAdminEmails();
            await Promise.allSettled(
              admins.map((admin) =>
                sendNewDoctorNotification(admin.email, admin.name, {
                  name: user.name ?? input.name,
                  email: user.email ?? input.email,
                  registeredAt: new Date(),
                })
              )
            );
          } catch (err) {
            console.error("[Register] Failed to notify admins:", err);
          }
        });

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
        enforceRateLimit("loginIp", clientIp(ctx.req));
        enforceRateLimit("loginEmail", input.email);
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos." });
        }
        const token = await createSessionToken(user.openId);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_MS });
        return { success: true, user: { id: user.id, name: user.name, email: user.email } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /**
     * Atualiza perfil do médico: nome, email e/ou senha.
     * Requer senha atual para qualquer alteração.
     */
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().min(2).max(128).optional(),
        email: z.string().email().optional(),
        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(8).max(128).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = ctx.user;
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });

        // If changing password, validate current password
        if (input.newPassword) {
          enforceRateLimit("passwordChangeUser", String(user.id));
          if (!input.currentPassword) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a senha atual para alterar a senha." });
          }
          if (!user.passwordHash) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta não usa senha. Use o método de login original." });
          }
          const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
          if (!valid) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
          }
        }

        // If changing email, check if new email is already in use
        if (input.email && input.email !== user.email) {
          const existing = await getUserByEmail(input.email);
          if (existing && existing.id !== user.id) {
            throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está em uso por outra conta." });
          }
        }

        // Apply updates
        const profileUpdates: { name?: string; email?: string; passwordHash?: string } = {};
        if (input.name && input.name !== user.name) profileUpdates.name = input.name;
        if (input.email && input.email !== user.email) profileUpdates.email = input.email;
        if (input.newPassword) {
          profileUpdates.passwordHash = await bcrypt.hash(input.newPassword, 12);
        }

        await updateUserProfile(user.id, profileUpdates);
        return { success: true };
      }),

    /**
     * Solicita redefinição de senha: gera token e envia e-mail.
     * Sempre retorna success para não revelar se o e-mail existe.
     */
    requestPasswordReset: publicProcedure
      .input(z.object({
        email: z.string().email(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Limites antes de tudo: a resposta não depende de o e-mail existir.
        enforceRateLimit("resetRequestIp", clientIp(ctx.req));
        enforceRateLimit("resetRequestEmail", input.email);
        // SEGURANÇA: a base da URL vem exclusivamente da configuração do
        // servidor. Ela já foi um parâmetro de entrada, o que permitia a
        // qualquer pessoa fazer o app enviar um e-mail legítimo contendo um
        // token de redefinição válido apontando para um domínio hostil —
        // tomada de conta em uma única requisição. Nada vindo do cliente
        // (corpo, query, cabeçalho Host, Origin ou Referer) pode compor um
        // link que carrega credencial.
        //
        // A falha é resolvida antes de qualquer consulta ao banco, de modo que
        // o comportamento é idêntico para qualquer e-mail — preservando a
        // proteção contra enumeração de contas. A mensagem interna não é
        // repassada: esta rota é pública e o texto chegaria ao navegador.
        let baseUrl: string;
        try {
          baseUrl = requireAppPublicUrl();
        } catch (err) {
          console.error("[requestPasswordReset]", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Não foi possível processar a solicitação. Tente novamente mais tarde.",
          });
        }

        const user = await getUserByEmail(input.email);
        if (user && user.passwordHash) {
          // Only email/password accounts can reset via email
          const token = await createPasswordResetToken(user.id);
          const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
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
      .mutation(async ({ input, ctx }) => {
        enforceRateLimit("resetConfirmIp", clientIp(ctx.req));
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
  //
  // Fabricantes e LIOs formam um catálogo GLOBAL, compartilhado por todos os
  // médicos. Escrita aqui afeta os dados de todo mundo, então é restrita a
  // admin. Antes eram protectedProcedure: qualquer médico cadastrado podia
  // renomear uma lente, alterar sua constante A ou apagar uma LIO do catálogo
  // inteiro — sem má-fé, bastava alguém "limpando" o que julgasse duplicado.
  manufacturers: router({
    list: publicProcedure.query(async () => {
      return getAllManufacturers();
    }),

    create: adminProcedure
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

    // Catálogo global: escrita restrita a admin (ver nota em manufacturers).
    create: adminProcedure
      .input(
        z.object({
          manufacturerId: z.number(),
          model: z.string().min(1).max(128),
          type: iolTypeEnum,
          aConstant: z.string().max(10).optional(),
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

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          model: z.string().min(1).max(128).optional(),
          type: iolTypeEnum.optional(),
          aConstant: z.string().max(10).optional(),
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

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteIOL(input.id);
        return { success: true };
      }),

    compare: protectedProcedure
      .input(z.object({ iolIds: z.array(z.number()).min(1).max(8) }))
      .query(async ({ input }) => {
        return getIOLComparisonData(input.iolIds);
      }),

    // Retorna todas as curvas reais de Defocus associadas a uma IOL específica
    curves: protectedProcedure
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

    exportPDF: protectedProcedure
      .input(
        z.object({
          patientId: z.number().int().positive(),
          // Os pontos chegam do cliente porque são a curva já exibida na tela
          // (mesma agregação do gráfico). O servidor confere que cada série é
          // uma medição DESTE paciente e limita tamanhos e faixas — o PDF
          // roda num Chromium do servidor.
          series: z
            .array(
              z.object({
                id: z.number().int().positive(),
                label: z.string().max(160),
                color: z.string().max(32),
                points: z
                  .array(
                    z.object({
                      diopter: z.number().min(-6).max(3),
                      visualAcuity: z.number().min(-0.5).max(2),
                    })
                  )
                  .max(60),
              })
            )
            .min(1)
            .max(12),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // SEGURANÇA: antes o PDF era montado só com o que o cliente mandava,
        // sem conferir dono — servia para gerar "laudo DefocusApp" de qualquer
        // conteúdo. Agora o paciente precisa ser do médico logado, as séries
        // precisam ser medições dele, e a lista de LIOs vem do banco.
        const patient = await getPatientById(input.patientId, ctx.user.id);
        if (!patient) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Paciente não encontrado ou sem permissão." });
        }
        const owned = new Set(
          (await getMeasurementsByPatient(input.patientId, ctx.user.id)).map((m) => m.id)
        );
        if (input.series.some((s) => !owned.has(s.id))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Medição não pertence a este paciente." });
        }
        const fmtDate = (d: unknown) => {
          if (!d) return undefined;
          const dt = new Date(d as string);
          return Number.isNaN(dt.getTime())
            ? undefined
            : dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
        };
        const iolsList = (await getPatientIOLs(input.patientId, ctx.user.id)).map((p) => ({
          eye: p.eye,
          iolName: p.iolModel ?? "IOL",
          manufacturer: p.manufacturerName ?? "",
          surgeryDate: fmtDate(p.surgeryDate),
          refractiveTarget: p.refractiveTarget != null ? String(p.refractiveTarget) : undefined,
        }));

        const reportData: PDFReportData = {
          doctorName: ctx.user.name ?? ctx.user.email ?? "Médico",
          caseId: String(input.patientId),
          generatedAt: new Date().toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          iols: iolsList,
          series: input.series,
        };
        const pdfBuffer = await generatePDFReport(reportData);
        return { pdf: pdfBuffer.toString("base64") };
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
      .mutation(async ({ ctx, input }) => {
        // SEGURANÇA: sem esta verificação, qualquer médico autenticado podia
        // gravar um implante no prontuário de qualquer paciente da plataforma
        // informando um patientId arbitrário. Mesmo padrão já usado em
        // measurements.create.
        const patient = await getPatientById(input.patientId, ctx.user.id);
        if (!patient) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Paciente não encontrado ou sem permissão.",
          });
        }

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
      .query(async ({ ctx, input }) => {
        // Verify ownership before returning points
        const m = await getMeasurementById(input.measurementId, ctx.user.id);
        if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Medição não encontrada ou sem permissão." });
        return getMeasurementPoints(input.measurementId);
      }),

    /** Batch: retorna pontos de múltiplas medições de uma vez */
    pointsBatch: protectedProcedure
      .input(z.object({ measurementIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        if (input.measurementIds.length === 0) return [];
        // Verify ALL measurements belong to the authenticated user (strict enforcement)
        const owned = await Promise.all(
          input.measurementIds.map((id) => getMeasurementById(id, ctx.user.id))
        );
        const unauthorized = input.measurementIds.filter((_, i) => owned[i] === null);
        if (unauthorized.length > 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a uma ou mais medições." });
        }
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
      .query(async ({ ctx, input }) => {
        // Verify ownership
        const m = await getMeasurementById(input.measurementId, ctx.user.id);
        if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Medição não encontrada ou sem permissão." });
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
      .query(async ({ ctx, input }) => {
        // Verify ALL measurement IDs belong to the authenticated user (strict enforcement)
        const owned = await Promise.all(
          input.measurementIds.map((id) => getMeasurementById(id, ctx.user.id))
        );
        const unauthorized = input.measurementIds.filter((_, i) => owned[i] === null);
        if (unauthorized.length > 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso negado a uma ou mais medições." });
        }
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

        // Verify patient ownership before creating measurement
        const patient = await getPatientById(input.patientId, ctx.user.id);
        if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Paciente não encontrado ou sem permissão." });

        // Verify patientIolId belongs to this patient (and thus this user)
        if (input.patientIolId !== undefined) {
          const patientIolList = await getPatientIOLs(input.patientId, ctx.user.id);
          const validIol = patientIolList.find((pi) => pi.id === input.patientIolId);
          if (!validIol) throw new TRPCError({ code: "NOT_FOUND", message: "IOL do paciente não encontrada ou sem permissão." });
        }

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
      .mutation(async ({ ctx, input }) => {
        // Verify ownership before updating points
        const m = await getMeasurementById(input.measurementId, ctx.user.id);
        if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Medição não encontrada ou sem permissão." });
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

// ─── Admin Router ────────────────────────────────────────────────────────────

const adminRouter = router({
  listUsers: adminProcedure.query(async () => {
    return await adminGetAllUsers();
  }),

  userDetail: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const detail = await adminGetUserDetail(input.userId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      return detail;
    }),

  iolStats: adminProcedure.query(async () => {
    return await adminGetIOLStats();
  }),

  iolCurve: adminProcedure
    .input(z.object({ iolId: z.number() }))
    .query(async ({ input }) => {
      return await adminGetIOLCurve(input.iolId);
    }),

  exportUsersCsv: adminProcedure.query(async () => {
    const csv = await adminExportUsersCsv();
    return { csv };
  }),
});

export const appRouter2 = router({
  ...appRouter._def.record,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter2;

