import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  console.log("\nPlease set your database connection string:");
  console.log(
    'export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.rlilyfqfoxxxqqhsignc.supabase.co:5432/postgres"',
  );
  console.log(
    "\nYou can find your database password in your Supabase project settings.",
  );
  process.exit(1);
}

async function runMigration() {
  const sql = postgres(DATABASE_URL!);

  try {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (migrationFiles.length === 0) {
      console.log("No migration files found");
      process.exit(0);
    }

    const lastMigration = migrationFiles[migrationFiles.length - 1];
    console.log(`Running latest migration: ${lastMigration}`);

    const migrationSQL = readFileSync(
      join(migrationsDir, lastMigration),
      "utf-8",
    );

    await sql.unsafe(migrationSQL);
    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
