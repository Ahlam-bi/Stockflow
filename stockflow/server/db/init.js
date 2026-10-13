import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const schema = await readFile(
    path.join(currentDirectory, "schema.sql"),
    "utf8",
  );

  await pool.query(schema);
  console.log("Schéma StockFlow créé.");
} catch (error) {
  console.error("Échec schema:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
