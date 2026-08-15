export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

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
  if (missing.length > 0) {
    throw new Error(
      `Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}.`
    );
  }
}
