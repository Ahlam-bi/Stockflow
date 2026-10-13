import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (error) => {
  console.error("Erreur PostgreSQL:", error);
});