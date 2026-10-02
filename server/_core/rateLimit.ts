/**
 * Limite de tentativas em memória (janela fixa) para as rotas públicas de
 * autenticação: login, cadastro e redefinição de senha.
 *
 * Sem isto, qualquer um podia testar senhas de um médico sem limite, criar
 * contas em massa ou usar o "esqueci a senha" para disparar e-mails em série
 * (custo e reputação do domínio remetente).
 *
 * Em memória basta: o app roda em uma única instância. Se um dia escalar
 * horizontalmente, trocar por um armazenamento compartilhado.
 */
import { TRPCError } from "@trpc/server";
import type { Request } from "express";

type Rule = { max: number; windowMs: number };

const MIN = 60_000;

export const RATE_LIMITS = {
  loginIp: { max: 20, windowMs: 15 * MIN },
  loginEmail: { max: 8, windowMs: 15 * MIN },
  registerIp: { max: 5, windowMs: 60 * MIN },
  resetRequestIp: { max: 10, windowMs: 60 * MIN },
  resetRequestEmail: { max: 3, windowMs: 60 * MIN },
  resetConfirmIp: { max: 20, windowMs: 60 * MIN },
  passwordChangeUser: { max: 10, windowMs: 15 * MIN },
} satisfies Record<string, Rule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const buckets = new Map<string, { count: number; resetAt: number }>();

function sweep(now: number) {
  if (buckets.size < 10_000) return;
  buckets.forEach((b, k) => {
    if (b.resetAt <= now) buckets.delete(k);
  });
}

/** Conta uma tentativa; lança TOO_MANY_REQUESTS se o limite foi excedido. */
export function enforceRateLimit(name: RateLimitName, key: string, now = Date.now()): void {
  const rule = RATE_LIMITS[name];
  const id = `${name}:${key.toLowerCase()}`;
  sweep(now);
  let b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(id, b);
  }
  b.count++;
  if (b.count > rule.max) {
    const minutes = Math.max(1, Math.ceil((b.resetAt - now) / MIN));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Muitas tentativas. Aguarde ${minutes} min e tente novamente.`,
    });
  }
}

/** IP do cliente (o Express já resolve X-Forwarded-For com trust proxy = 1). */
export function clientIp(req: Pick<Request, "ip"> | undefined | null): string {
  return req?.ip || "desconhecido";
}

/** Só para testes. */
export function resetRateLimits(): void {
  buckets.clear();
}
