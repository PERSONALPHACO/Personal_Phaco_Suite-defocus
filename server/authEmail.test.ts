import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockCookie = vi.fn();
const mockClearCookie = vi.fn();

function makeCtx() {
  return {
    req: { headers: { cookie: "" } } as any,
    res: { cookie: mockCookie, clearCookie: mockClearCookie } as any,
    user: null,
  };
}

const caller = appRouter.createCaller(makeCtx());

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects short password", async () => {
    await expect(
      caller.auth.register({
        name: "Dr. Teste",
        email: `short-pw-${Date.now()}@test.com`,
        password: "abc",
      })
    ).rejects.toThrow();
  });

  it("rejects short name", async () => {
    await expect(
      caller.auth.register({
        name: "A",
        email: `short-name-${Date.now()}@test.com`,
        password: "senha12345",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid email", async () => {
    await expect(
      caller.auth.register({
        name: "Dr. Teste",
        email: "not-an-email",
        password: "senha12345",
      })
    ).rejects.toThrow();
  });
});

describe("auth.loginEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unknown email", async () => {
    await expect(
      caller.auth.loginEmail({
        email: `nonexistent-${Date.now()}@test.com`,
        password: "qualquersenha",
      })
    ).rejects.toThrow(/E-mail ou senha incorretos/);
  });

  it("rejects empty password", async () => {
    await expect(
      caller.auth.loginEmail({
        email: "test@test.com",
        password: "",
      })
    ).rejects.toThrow();
  });
});
