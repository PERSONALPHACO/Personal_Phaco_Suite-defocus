import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  createSessionToken,
  readCookie,
  verifySessionToken,
} from "./_core/session";
import { assertRequiredEnv, resolvePort } from "./_core/env";

const GOOD = "x".repeat(48);

describe("sessão própria (JWT)", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.JWT_SECRET = GOOD;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("assina e verifica um token válido", async () => {
    const t = await createSessionToken("email:a@b.com");
    expect(await verifySessionToken(t)).toEqual({ openId: "email:a@b.com" });
  });

  it("rejeita token assinado com outro segredo", async () => {
    const t = await createSessionToken("email:a@b.com");
    process.env.JWT_SECRET = "y".repeat(48);
    expect(await verifySessionToken(t)).toBeNull();
  });

  it("rejeita token forjado com chave adivinhável", async () => {
    const forged = await new SignJWT({ openId: "email:admin@x.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("defocusapp")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("secret"));
    expect(await verifySessionToken(forged)).toBeNull();
  });

  it("rejeita token expirado", async () => {
    const t = await createSessionToken("email:a@b.com", -1000);
    expect(await verifySessionToken(t)).toBeNull();
  });

  it("segredo curto é erro de configuração, não 'não autenticado'", async () => {
    process.env.JWT_SECRET = "curto";
    await expect(verifySessionToken("qualquer")).rejects.toThrow(/JWT_SECRET/);
  });

  it("a sessão dura 30 dias, não um ano", async () => {
    const t = await createSessionToken("email:a@b.com");
    const exp = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString()).exp;
    const days = (exp * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });
});

describe("leitura do cookie", () => {
  it("um % solto em outro cookie não derruba a autenticação", () => {
    const h = "_ga=50%off; app_session_id=abc.def.ghi; x=%E0%A4%A";
    expect(readCookie(h, "app_session_id")).toBe("abc.def.ghi");
  });
  it("ausente → undefined", () => {
    expect(readCookie("a=1; b=2", "app_session_id")).toBeUndefined();
    expect(readCookie(undefined, "app_session_id")).toBeUndefined();
  });
});

describe("validação de boot", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "https://defocus.personalphaco.com";
    process.env.DATABASE_URL = "mysql://u:p@h:3306/d";
    process.env.JWT_SECRET = GOOD;
    delete process.env.PORT;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("configuração completa passa", () => {
    expect(() => assertRequiredEnv()).not.toThrow();
  });
  it("sem JWT_SECRET o servidor recusa subir", () => {
    delete process.env.JWT_SECRET;
    expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
  });
  it("JWT_SECRET curto recusa subir", () => {
    process.env.JWT_SECRET = "abc";
    expect(() => assertRequiredEnv()).toThrow(/JWT_SECRET/);
  });
  it("PORT inválida é erro, não porta aleatória", () => {
    process.env.PORT = "80a";
    expect(() => resolvePort()).toThrow(/PORT/);
    process.env.PORT = "70000";
    expect(() => resolvePort()).toThrow(/PORT/);
    process.env.PORT = "3000";
    expect(resolvePort()).toBe(3000);
    delete process.env.PORT;
    expect(resolvePort()).toBe(8080);
  });
});
