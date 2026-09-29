import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter2 as appRouter } from "../routers";
import { createContext } from "./context";
import { assertRequiredEnv, resolvePort } from "./env";

// Falha no boot, e não na primeira requisição de um usuário real: um deploy
// que esqueceu uma variável obrigatória é descoberto por quem faz o deploy.
assertRequiredEnv();

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Atrás do proxy da hospedagem (Railway): req.protocol/req.ip refletem o
  // cliente, e o cookie de sessão sai com `secure` em HTTPS.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // Healthcheck da plataforma — não toca no banco.
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (process.env.NODE_ENV === "development") {
    // Import DINÂMICO. O bundle de produção é gerado com --packages=external:
    // um import estático de ./vite sobreviveria em dist/index.js, e o Node
    // resolve imports estáticos antes de executar qualquer linha — sem `vite`
    // instalado (imagem com pnpm prune --prod), o processo morria no arranque
    // com ERR_MODULE_NOT_FOUND. O `if` não protegeria um import estático.
    // O caminho vai numa variável para o esbuild NÃO embutir o módulo (e o seu
    // import de "vite") no bundle de produção. Só o tsx do modo dev o resolve.
    const viteModule = "./vite";
    const { setupVite } = await import(viteModule);
    await setupVite(app, server);
  } else {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  }

  const port = resolvePort();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Servidor ouvindo em 0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error("[Boot] Falha ao iniciar o servidor:", err);
  process.exit(1);
});
