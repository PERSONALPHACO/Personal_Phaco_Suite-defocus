import { describe, it, expect, vi, beforeEach } from "vitest";
// A URL de redefinição passa a ser montada pelo servidor a partir de
// APP_PUBLIC_URL, definida em vitest.config.ts (test.env).
import { appRouter } from "./routers";
import type { inferRouterContext } from "@trpc/server";
import type { AppRouter } from "./routers";

// Mock database helpers
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    createPasswordResetToken: vi.fn(),
    getValidPasswordResetToken: vi.fn(),
    markPasswordResetTokenUsed: vi.fn(),
    updateUserPassword: vi.fn(),
  };
});

// Mock email helper
vi.mock("./_core/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

import {
  getUserByEmail,
  createPasswordResetToken,
  getValidPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from "./db";
import { sendPasswordResetEmail } from "./_core/email";

type Ctx = inferRouterContext<AppRouter>;

function makeCtx(): Ctx {
  return {
    req: {} as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    user: null,
  };
}

const caller = appRouter.createCaller(makeCtx());

describe("auth.requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success without sending email when user not found", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue(null);

    const result = await caller.auth.requestPasswordReset({
      email: "notfound@example.com",
    });

    expect(result.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(createPasswordResetToken).not.toHaveBeenCalled();
  });

  it("returns success without sending email when user has no password (OAuth user)", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: 1,
      name: "Dr. OAuth",
      email: "oauth@example.com",
      passwordHash: null,
      role: "user",
      loginMethod: "oauth",
      openId: "oauth_123",
      emailVerified: false,
      createdAt: new Date(),
      lastSignedIn: new Date(),
    } as any);

    const result = await caller.auth.requestPasswordReset({
      email: "oauth@example.com",
    });

    expect(result.success).toBe(true);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("creates token and sends email when user has password", async () => {
    vi.mocked(getUserByEmail).mockResolvedValue({
      id: 42,
      name: "Dr. Test",
      email: "doctor@example.com",
      passwordHash: "$2b$12$hashedpassword",
      role: "user",
      loginMethod: "email",
      openId: null,
      emailVerified: true,
      createdAt: new Date(),
      lastSignedIn: new Date(),
    } as any);
    vi.mocked(createPasswordResetToken).mockResolvedValue("abc123token");

    const result = await caller.auth.requestPasswordReset({
      email: "doctor@example.com",
    });

    expect(result.success).toBe(true);
    expect(createPasswordResetToken).toHaveBeenCalledWith(42);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "doctor@example.com",
      "Dr. Test",
      "https://defocusapp.com/reset-password?token=abc123token"
    );
  });
});

describe("auth.resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws BAD_REQUEST when token is invalid or expired", async () => {
    vi.mocked(getValidPasswordResetToken).mockResolvedValue(null);

    await expect(
      caller.auth.resetPassword({ token: "invalidtoken", newPassword: "newpassword123" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(markPasswordResetTokenUsed).not.toHaveBeenCalled();
  });

  it("updates password and marks token used when token is valid", async () => {
    vi.mocked(getValidPasswordResetToken).mockResolvedValue({
      id: 1,
      userId: 42,
      token: "validtoken",
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      createdAt: new Date(),
    });
    vi.mocked(updateUserPassword).mockResolvedValue(undefined);
    vi.mocked(markPasswordResetTokenUsed).mockResolvedValue(undefined);

    const result = await caller.auth.resetPassword({
      token: "validtoken",
      newPassword: "newSecurePassword123",
    });

    expect(result.success).toBe(true);
    expect(updateUserPassword).toHaveBeenCalledWith(42, expect.stringMatching(/^\$2b\$/));
    expect(markPasswordResetTokenUsed).toHaveBeenCalledWith("validtoken");
  });

  it("rejects passwords shorter than 8 characters", async () => {
    await expect(
      caller.auth.resetPassword({ token: "anytoken", newPassword: "short" })
    ).rejects.toThrow();
  });
});
