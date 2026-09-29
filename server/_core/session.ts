/**
 * Sessão própria — substitui o SDK/OAuth da plataforma Manus.
 *
 * O cookie de sessão carrega um JWT HS256 assinado com JWT_SECRET. O único
 * dado de identidade no token é o `openId` do usuário (para contas criadas por
 * e-mail, `email:<endereço>`); o restante é lido do banco a cada requisição,
 * de modo que mudança de papel (admin/user) vale imediatamente.
 */
import { COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV, requireJwtSecret } from "./env";

const ownerOpenId = () => ENV.ownerOpenId;

/** Duração da sessão. Era um ano — um cookie roubado valia doze meses. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const ISSUER = "defocusapp";

export type SessionPayload = { openId: string };

function secretKey(): Uint8Array {
  // Lança se o segredo estiver ausente ou curto. Não é engolido em
  // verifySessionToken: um erro de configuração não pode se disfarçar de
  // "usuário não autenticado" silencioso.
  return new TextEncoder().encode(requireJwtSecret());
}

export async function createSessionToken(
  openId: string,
  ttlMs: number = SESSION_TTL_MS
): Promise<string> {
  if (!openId) throw new Error("openId obrigatório para criar sessão");
  const now = Date.now();
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setIssuedAt(Math.floor(now / 1000))
    .setExpirationTime(Math.floor((now + ttlMs) / 1000))
    .sign(secretKey());
}

/** Devolve o payload se o token for válido; null se inválido/expirado. */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const key = secretKey(); // fora do try: erro de configuração propaga
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    const openId = (payload as Record<string, unknown>).openId;
    if (typeof openId !== "string" || openId.length === 0) return null;
    return { openId };
  } catch {
    return null;
  }
}

/**
 * Lê um cookie pelo nome sem depender de decodificação global do cabeçalho.
 *
 * `cookie.parse` aplica decodeURIComponent em todos os valores; um único `%`
 * solto em qualquer cookie do domínio (analytics, script de terceiro) fazia a
 * autenticação da requisição inteira falhar. Aqui só o nosso cookie é
 * decodificado, e com tolerância a erro.
 */
export function readCookie(
  header: string | undefined,
  name: string
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    let value = part.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export async function authenticateRequest(req: Request): Promise<User> {
  const token = readCookie(req.headers.cookie, COOKIE_NAME);
  const session = await verifySessionToken(token);
  if (!session) throw ForbiddenError("Sessão inválida");

  const user = await db.getUserByOpenId(session.openId);
  if (!user) throw ForbiddenError("Usuário não encontrado");

  // upsertUser promove OWNER_OPEN_ID a admin; atualiza o último acesso.
  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  if (user.role !== "admin" && user.openId === ownerOpenId()) {
    return { ...user, role: "admin" };
  }
  return user;
}
