/**
 * Testes de regressão das correções de segurança da Fase 0.
 *
 * Cada bloco abaixo corresponde a uma falha real encontrada na auditoria do
 * código exportado do Manus. Os testes existem para que a falha não volte:
 * se alguém reverter a correção, o teste quebra e diz exatamente o quê.
 *
 * Referência: claude/defocusapp-auditoria-fase0.md
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
// APP_PUBLIC_URL vem de vitest.config.ts (test.env) — ver nota lá sobre
// içamento de imports em ESM.
import { appRouter } from "./routers";
import type { inferRouterContext } from "@trpc/server";
import type { AppRouter } from "./routers";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    createPasswordResetToken: vi.fn(),
    getPatientById: vi.fn(),
    createPatientIOL: vi.fn(),
    createIOL: vi.fn(),
    updateIOL: vi.fn(),
    deleteIOL: vi.fn(),
    createManufacturer: vi.fn(),
  };
});

vi.mock("./_core/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendNewDoctorNotification: vi.fn().mockResolvedValue(true),
}));

import {
  getUserByEmail,
  createPasswordResetToken,
  getPatientById,
  createPatientIOL,
  createIOL,
  updateIOL,
  deleteIOL,
  createManufacturer,
} from "./db";
import { sendPasswordResetEmail } from "./_core/email";

type Ctx = inferRouterContext<AppRouter>;

function makeCtx(user: Partial<{ id: number; role: "user" | "admin" }> | null): Ctx {
  return {
    req: {} as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    user: user
      ? ({
          id: user.id ?? 1,
          openId: `open_${user.id ?? 1}`,
          name: "Dr. Teste",
          email: `doutor${user.id ?? 1}@exemplo.com`,
          role: user.role ?? "user",
          passwordHash: "$2b$12$hash",
          emailVerified: true,
          crm: null,
          loginMethod: "email",
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as any)
      : null,
  };
}

const doctorA = appRouter.createCaller(makeCtx({ id: 10, role: "user" }));
const doctorB = appRouter.createCaller(makeCtx({ id: 20, role: "user" }));
const admin = appRouter.createCaller(makeCtx({ id: 99, role: "admin" }));
const anonymous = appRouter.createCaller(makeCtx(null));

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────────────────
// Achado 1 (CRÍTICA) — tomada de conta via redefinição de senha
// ───────────────────────────────────────────────────────────────────────────

describe("Achado 1: URL de redefinição não pode vir do cliente", () => {
  const victim = {
    id: 42,
    name: "Dr. Vítima",
    email: "vitima@exemplo.com",
    passwordHash: "$2b$12$hash",
    role: "user",
    loginMethod: "email",
    openId: "open_42",
    emailVerified: true,
    createdAt: new Date(),
    lastSignedIn: new Date(),
  };

  it("ignora a origem hostil enviada pelo cliente", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(victim as any);
    vi.mocked(createPasswordResetToken).mockResolvedValue("token-valido");

    // Esta era a exploração: uma única requisição fazia o app enviar um e-mail
    // legítimo com um token válido apontando para o domínio do atacante.
    //
    // Zod remove chaves desconhecidas em vez de rejeitar, então a garantia real
    // não é "a chamada falha" — é que o valor NUNCA influencia a URL emitida.
    // É isso que este teste fixa.
    await anonymous.auth.requestPasswordReset({
      email: "vitima@exemplo.com",
      origin: "https://dominio-do-atacante.com",
    } as any);

    const urlEnviada = vi.mocked(sendPasswordResetEmail).mock.calls[0][2];
    expect(urlEnviada).toBe("https://defocusapp.com/reset-password?token=token-valido");
    expect(urlEnviada).not.toContain("dominio-do-atacante.com");
  });

  it("monta a URL a partir de APP_PUBLIC_URL, ignorando qualquer entrada", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(victim as any);
    vi.mocked(createPasswordResetToken).mockResolvedValue("token-valido");

    await anonymous.auth.requestPasswordReset({ email: "vitima@exemplo.com" });

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "vitima@exemplo.com",
      "Dr. Vítima",
      "https://defocusapp.com/reset-password?token=token-valido"
    );
  });

  it("nunca emite um link para domínio que não seja o configurado", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(victim as any);
    vi.mocked(createPasswordResetToken).mockResolvedValue("token-valido");

    await anonymous.auth.requestPasswordReset({ email: "vitima@exemplo.com" });

    const urlEnviada = vi.mocked(sendPasswordResetEmail).mock.calls[0][2];
    expect(urlEnviada.startsWith("https://defocusapp.com/")).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Achado 2 (ALTA) — escrita entre tenants
// ───────────────────────────────────────────────────────────────────────────

describe("Achado 2: implante só pode ser gravado em paciente próprio", () => {
  it("bloqueia gravar implante no paciente de outro médico", async () => {
    // getPatientById filtra por userId: paciente de outro médico não retorna.
    vi.mocked(getPatientById).mockResolvedValue(undefined as any);

    await expect(
      doctorB.patientIols.create({
        patientId: 777, // paciente do doutor A
        iolId: 1,
        eye: "OD",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(createPatientIOL).not.toHaveBeenCalled();
  });

  it("permite gravar implante no próprio paciente", async () => {
    vi.mocked(getPatientById).mockResolvedValue({ id: 777, userId: 10 } as any);

    const result = await doctorA.patientIols.create({
      patientId: 777,
      iolId: 1,
      eye: "OD",
    });

    expect(result.success).toBe(true);
    expect(createPatientIOL).toHaveBeenCalledTimes(1);
  });

  it("verifica a posse antes de qualquer escrita no banco", async () => {
    vi.mocked(getPatientById).mockResolvedValue(undefined as any);

    await expect(
      doctorB.patientIols.create({ patientId: 777, iolId: 1, eye: "OS" })
    ).rejects.toBeDefined();

    // A checagem precisa receber o userId do chamador, não confiar na entrada.
    expect(getPatientById).toHaveBeenCalledWith(777, 20);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Achado 4 (ALTA) — catálogo global editável por qualquer médico
// ───────────────────────────────────────────────────────────────────────────

describe("Achado 4: catálogo global de LIOs é somente-admin para escrita", () => {
  const novaIol = {
    manufacturerId: 1,
    model: "Modelo Teste",
    type: "trifocal" as const,
  };

  it("impede médico comum de criar LIO no catálogo global", async () => {
    await expect(doctorA.iols.create(novaIol)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createIOL).not.toHaveBeenCalled();
  });

  it("impede médico comum de alterar LIO do catálogo global", async () => {
    await expect(
      doctorA.iols.update({ id: 1, model: "Renomeada" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(updateIOL).not.toHaveBeenCalled();
  });

  it("impede médico comum de APAGAR LIO do catálogo global", async () => {
    // Era o pior caso: apagar afetava os dados de todos os médicos e, sem
    // chaves estrangeiras, deixava registros de implante órfãos.
    await expect(doctorA.iols.delete({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(deleteIOL).not.toHaveBeenCalled();
  });

  it("impede médico comum de criar fabricante", async () => {
    await expect(
      doctorA.manufacturers.create({ name: "Fabricante Teste" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createManufacturer).not.toHaveBeenCalled();
  });

  it("permite que o admin administre o catálogo", async () => {
    await admin.iols.create(novaIol);
    expect(createIOL).toHaveBeenCalledTimes(1);

    await admin.iols.delete({ id: 1 });
    expect(deleteIOL).toHaveBeenCalledTimes(1);
  });

  it("leitura do catálogo permanece aberta a qualquer médico", async () => {
    // A restrição é só de escrita — o catálogo continua consultável.
    await expect(doctorA.iols.byId({ id: 1 })).resolves.toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Achado 5 (novo) — hash de senha vazando para o navegador
// ───────────────────────────────────────────────────────────────────────────

describe("Achado 5: auth.me não expõe o hash da senha", () => {
  it("não inclui passwordHash na resposta", async () => {
    const me = await doctorA.auth.me();
    expect(me).not.toBeNull();
    expect(me as any).not.toHaveProperty("passwordHash");
  });

  it("ainda devolve os campos que a interface usa", async () => {
    const me = (await doctorA.auth.me()) as any;
    expect(me.id).toBe(10);
    expect(me.role).toBe("user");
    expect(me.email).toBeDefined();
  });

  it("devolve null para visitante não autenticado", async () => {
    await expect(anonymous.auth.me()).resolves.toBeNull();
  });
});
