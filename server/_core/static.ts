import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // Em produção este módulo é empacotado em dist/index.js; o front fica em
  // dist/public.
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Assets com hash no nome: cache longo. index.html: sempre revalidado.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), { immutable: true, maxAge: "1y" })
  );
  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
