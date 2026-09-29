/**
 * Configuração lida do ambiente. Getters, e não valores congelados no import:
 * testes e o boot leem o valor atual de process.env.
 */
export const ENV = {
  get cookieSecret() { return process.env.JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  /** openId da conta dona (ex.: "email:renato@personalphaco.com") — vira admin. */
  get ownerOpenId() { return (process.env.OWNER_OPEN_ID ?? "").trim(); },
  get isProduction() { return process.env.NODE_ENV === "production"; },
};

/** Tamanho mínimo do segredo de sessão. `openssl rand -base64 48` gera 64. */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Segredo de assinatura das sessões.
 *
 * SEGURANÇA: era opcional (`?? ""`). Sem a variável, os tokens eram assinados
 * com chave vazia e qualquer pessoa forjaria uma sessão de administrador.
 */
export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET ausente ou curto (mínimo ${MIN_JWT_SECRET_LENGTH} caracteres).`
    );
  }
  return secret;
}

/**
 * Porta HTTP. PORT inválida virava porta aleatória com log dizendo que estava
 * tudo bem; agora é erro de boot.
 */
export function resolvePort(): number {
  const raw = (process.env.PORT ?? "").trim();
  if (!raw) return 8080;
  if (!/^\d+$/.test(raw)) throw new Error(`PORT inválida: "${raw}"`);
  const port = Number(raw);
  if (port < 1 || port > 65535) throw new Error(`PORT fora do intervalo: ${port}`);
  return port;
}

/**
 * URL pública canônica da aplicação (ex.: https://defocusapp.com).
 *
 * SEGURANÇA: é a única origem admitida para montar links que carregam
 * credencial (redefinição de senha, verificação de e-mail). Nunca derive essas
 * URLs de entrada do cliente nem de cabeçalhos da requisição — ambos são
 * controlados pelo atacante e permitem sequestro do token.
 *
 * Lida em tempo de chamada, e não no carregamento do módulo: imports em ESM são
 * içados para o topo, então um teste que faz `process.env.APP_PUBLIC_URL = ...`
 * no corpo do arquivo executa depois do import — congelar o valor aqui deixaria
 * a configuração dependente da ordem de carregamento.
 */
export function getAppPublicUrl(): string {
  return (process.env.APP_PUBLIC_URL ?? "").replace(/\/+$/, "");
}

/**
 * Retorna a URL pública canônica, falhando alto se não estiver configurada.
 *
 * Preferimos derrubar o fluxo de redefinição a enviar um link inválido — ou,
 * pior, a cair em algum valor derivado da requisição.
 */
export function requireAppPublicUrl(): string {
  const url = getAppPublicUrl();
  if (!url) {
    throw new Error(
      "APP_PUBLIC_URL não configurada. É obrigatória para gerar links de redefinição de senha."
    );
  }

  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("URL inválida");
    }
  } catch {
    throw new Error(
      "APP_PUBLIC_URL deve ser uma URL HTTP(S) absoluta, sem credenciais, query string ou fragmento."
    );
  }

  return url;
}

/**
 * Valida a configuração obrigatória na subida do processo.
 *
 * Falhar no boot é muito melhor que falhar na primeira redefinição de senha de
 * um usuário real — um deploy que esqueceu a variável é descoberto por quem faz
 * o deploy, não por um médico trancado fora da conta.
 */
export function assertRequiredEnv(): void {
  const missing: string[] = [];
  if (!getAppPublicUrl()) missing.push("APP_PUBLIC_URL");
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET) missing.push("JWT_SECRET");
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}.`
    );
  }

  // Valida também o formato. Sem isso, uma configuração como ftp:// ou uma URL
  // com credenciais só falharia na primeira solicitação de redefinição de senha.
  requireAppPublicUrl();
  requireJwtSecret();
  resolvePort();
}
