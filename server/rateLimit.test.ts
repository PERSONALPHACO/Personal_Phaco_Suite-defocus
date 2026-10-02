import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getUserByEmail: vi.fn().mockResolvedValue(undefined) };
});

import { appRouter } from "./routers";
import { enforceRateLimit, resetRateLimits, RATE_LIMITS } from "./_core/rateLimit";

const ctx = (ip: string) =>
  ({ req: { ip, headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() }, user: null }) as any;

describe("enforceRateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("permite até o máximo e bloqueia a tentativa seguinte", () => {
    const max = RATE_LIMITS.loginEmail.max;
    for (let i = 0; i < max; i++) enforceRateLimit("loginEmail", "a@b.com", 1000);
    expect(() => enforceRateLimit("loginEmail", "a@b.com", 1000)).toThrow(/Muitas tentativas/);
  });

  it("não diferencia maiúsculas no e-mail", () => {
    const max = RATE_LIMITS.loginEmail.max;
    for (let i = 0; i < max; i++) enforceRateLimit("loginEmail", "Dr@X.com", 1000);
    expect(() => enforceRateLimit("loginEmail", "dr@x.com", 1000)).toThrow();
  });

  it("libera de novo quando a janela expira", () => {
    const { max, windowMs } = RATE_LIMITS.registerIp;
    for (let i = 0; i < max; i++) enforceRateLimit("registerIp", "1.2.3.4", 0);
    expect(() => enforceRateLimit("registerIp", "1.2.3.4", 0)).toThrow();
    expect(() => enforceRateLimit("registerIp", "1.2.3.4", windowMs + 1)).not.toThrow();
  });

  it("chaves diferentes não se afetam", () => {
    const max = RATE_LIMITS.registerIp.max;
    for (let i = 0; i < max; i++) enforceRateLimit("registerIp", "1.1.1.1", 0);
    expect(() => enforceRateLimit("registerIp", "2.2.2.2", 0)).not.toThrow();
  });
});

describe("auth.loginEmail com limite", () => {
  beforeEach(() => resetRateLimits());

  it("após 8 senhas erradas para o mesmo e-mail responde TOO_MANY_REQUESTS", async () => {
    const caller = appRouter.createCaller(ctx("9.9.9.9"));
    for (let i = 0; i < RATE_LIMITS.loginEmail.max; i++) {
      await expect(
        caller.auth.loginEmail({ email: "alvo@clinica.com", password: "x" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(
      caller.auth.loginEmail({ email: "alvo@clinica.com", password: "x" })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("o limite por IP pega quem varia o e-mail", async () => {
    const caller = appRouter.createCaller(ctx("8.8.8.8"));
    for (let i = 0; i < RATE_LIMITS.loginIp.max; i++) {
      await expect(
        caller.auth.loginEmail({ email: `u${i}@clinica.com`, password: "x" })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(
      caller.auth.loginEmail({ email: "outro@clinica.com", password: "x" })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
