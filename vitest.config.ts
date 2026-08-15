import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Configuração obrigatória do servidor, definida aqui e não no corpo dos
    // arquivos de teste: imports em ESM são içados para o topo, então uma
    // atribuição a process.env no corpo do módulo roda DEPOIS dos imports, e o
    // resultado passaria a depender da ordem de carregamento.
    env: {
      APP_PUBLIC_URL: "https://defocusapp.com",
    },
  },
});
