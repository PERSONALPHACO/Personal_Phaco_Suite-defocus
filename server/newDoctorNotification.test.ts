import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { inferRouterContext } from "@trpc/server";
import type { AppRouter } from "./routers";

// Mock database helpers
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    createUserWithPassword: vi.fn(),
    adminGetAllAdminEmails: vi.fn(),
  };
});

// Mock email helper
vi.mock("./_core/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendNewDoctorNotification: vi.fn().mockResolvedValue(true),
}));

// Mock da sessão própria
vi.mock("./_core/session", () => ({
  SESSION_TTL_MS: 30 * 24 * 60 * 60 * 1000,
  createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  authenticateRequest: vi.fn().mockResolvedValue(null),
}));

import { getUserByEmail, createUserWithPassword, adminGetAllAdminEmails } from "./db";
import { sendNewDoctorNotification } from "./_core/email";

type Ctx = inferRouterContext<AppRouter>;

function makeCtx(): Ctx {
  return {
    req: { headers: { "x-forwarded-proto": "https" } } as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    user: null,
  };
}

// Helper to flush all pending setImmediate callbacks
const flushImmediate = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("auth.register — admin notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: email not yet in use
    vi.mocked(getUserByEmail)
      .mockResolvedValueOnce(null) // first call: check if email exists
      .mockResolvedValueOnce({    // second call: fetch created user
        id: 99,
        name: "Dr. Novo",
        email: "novo@example.com",
        passwordHash: "$2b$12$hash",
        role: "user",
        loginMethod: "email",
        openId: "openid_novo",
        emailVerified: false,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      } as any);
    vi.mocked(createUserWithPassword).mockResolvedValue(undefined);
  });

  it("calls sendNewDoctorNotification for each admin after successful registration", async () => {
    const caller = appRouter.createCaller(makeCtx());
    vi.mocked(adminGetAllAdminEmails).mockResolvedValue([
      { email: "admin1@example.com", name: "Admin Um" },
      { email: "admin2@example.com", name: "Admin Dois" },
    ]);

    await caller.auth.register({
      name: "Dr. Novo",
      email: "novo@example.com",
      password: "senha12345",
    });

    await flushImmediate();

    expect(sendNewDoctorNotification).toHaveBeenCalledTimes(2);
    expect(sendNewDoctorNotification).toHaveBeenCalledWith(
      "admin1@example.com",
      "Admin Um",
      expect.objectContaining({ name: "Dr. Novo", email: "novo@example.com" })
    );
    expect(sendNewDoctorNotification).toHaveBeenCalledWith(
      "admin2@example.com",
      "Admin Dois",
      expect.objectContaining({ name: "Dr. Novo", email: "novo@example.com" })
    );
  });

  it("does not call sendNewDoctorNotification when there are no admins", async () => {
    const caller = appRouter.createCaller(makeCtx());
    vi.mocked(adminGetAllAdminEmails).mockResolvedValue([]);

    await caller.auth.register({
      name: "Dr. Novo",
      email: "novo@example.com",
      password: "senha12345",
    });

    await flushImmediate();

    expect(sendNewDoctorNotification).not.toHaveBeenCalled();
  });

  it("registration succeeds even if admin notification fails", async () => {
    const caller = appRouter.createCaller(makeCtx());
    vi.mocked(adminGetAllAdminEmails).mockRejectedValue(new Error("DB error"));

    const result = await caller.auth.register({
      name: "Dr. Novo",
      email: "novo@example.com",
      password: "senha12345",
    });

    await flushImmediate();

    // Registration should succeed regardless of notification failure
    expect(result.success).toBe(true);
  });

  it("registration succeeds even if email sending fails for one admin", async () => {
    const caller = appRouter.createCaller(makeCtx());
    vi.mocked(adminGetAllAdminEmails).mockResolvedValue([
      { email: "admin1@example.com", name: "Admin Um" },
      { email: "admin2@example.com", name: "Admin Dois" },
    ]);
    vi.mocked(sendNewDoctorNotification)
      .mockResolvedValueOnce(false) // first admin: email fails
      .mockResolvedValueOnce(true); // second admin: email succeeds

    const result = await caller.auth.register({
      name: "Dr. Novo",
      email: "novo@example.com",
      password: "senha12345",
    });

    await flushImmediate();

    expect(result.success).toBe(true);
    expect(sendNewDoctorNotification).toHaveBeenCalledTimes(2);
  });
});
