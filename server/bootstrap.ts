/**
 * Bootstrap do banco: aplica as migrations pendentes e garante o catálogo de
 * LIOs. Roda a cada arranque do contêiner, antes do servidor (ver Dockerfile).
 *
 * Idempotente: migrations já aplicadas são puladas pelo próprio drizzle
 * (tabela __drizzle_migrations) e o seed só insere fabricante/lente que ainda
 * não existe — nunca altera nem apaga o que já está no banco, inclusive lentes
 * cadastradas depois pelo administrador.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

type Catalog = {
  manufacturers: { name: string; country: string | null }[];
  iols: {
    manufacturer: string;
    model: string;
    type: "monofocal" | "bifocal" | "trifocal" | "edof" | "toric";
    aConstant: number | null;
  }[];
};

const ROOT = process.env.APP_ROOT ?? process.cwd();
const MIGRATIONS = path.join(ROOT, "drizzle");
const CATALOG = path.join(ROOT, "scripts", "catalogo-lios.json");

export async function seedCatalog(conn: mysql.Connection, catalog: Catalog) {
  let newMan = 0;
  let newIol = 0;
  const manIds = new Map<string, number>();

  for (const m of catalog.manufacturers) {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM manufacturers WHERE name = ? LIMIT 1",
      [m.name]
    );
    if (rows.length > 0) {
      manIds.set(m.name, rows[0].id);
      continue;
    }
    const [res] = await conn.query<mysql.ResultSetHeader>(
      "INSERT INTO manufacturers (name, country) VALUES (?, ?)",
      [m.name, m.country]
    );
    manIds.set(m.name, res.insertId);
    newMan++;
  }

  for (const l of catalog.iols) {
    const manufacturerId = manIds.get(l.manufacturer);
    if (!manufacturerId) throw new Error(`Fabricante ausente no catálogo: ${l.manufacturer}`);
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id FROM iols WHERE manufacturerId = ? AND model = ? LIMIT 1",
      [manufacturerId, l.model]
    );
    if (rows.length > 0) continue;
    await conn.query(
      "INSERT INTO iols (manufacturerId, model, type, aConstant) VALUES (?, ?, ?, ?)",
      [manufacturerId, l.model, l.type, l.aConstant]
    );
    newIol++;
  }
  return { newMan, newIol };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ausente");

  // O MySQL gerenciado pode levar alguns segundos para aceitar conexões logo
  // após ser criado: tenta por até ~60 s antes de desistir.
  let conn: mysql.Connection | null = null;
  for (let attempt = 1; ; attempt++) {
    try {
      conn = await mysql.createConnection({ uri: url, multipleStatements: false });
      break;
    } catch (err) {
      if (attempt >= 12) throw err;
      console.log(`[bootstrap] banco indisponível (tentativa ${attempt}), aguardando…`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  try {
    await migrate(drizzle(conn), { migrationsFolder: MIGRATIONS });
    console.log("[bootstrap] migrations em dia");

    const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8")) as Catalog;
    const { newMan, newIol } = await seedCatalog(conn, catalog);
    const [[m]] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) n FROM manufacturers");
    const [[i]] = await conn.query<mysql.RowDataPacket[]>("SELECT COUNT(*) n FROM iols");
    console.log(
      `[bootstrap] catálogo: +${newMan} fabricantes, +${newIol} lentes · total ${m.n} fabricantes, ${i.n} lentes`
    );
  } finally {
    await conn.end();
  }
}

// Executa só quando chamado diretamente (não quando importado por testes).
const invokedDirectly =
  process.argv[1] && /bootstrap\.(ts|js|mjs)$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[bootstrap] FALHOU:", err);
    process.exit(1);
  });
}
