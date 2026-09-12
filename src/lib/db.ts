import { neon } from '@neondatabase/serverless';

/**
 * Robust SQL client for Neon PostgreSQL.
 * Supports both tagged template literals: sql`SELECT...`
 * and direct parameterized calls: sql("SELECT...", [...])
 */
let client: any;

export function getNeonClient() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in environment variables');
    throw new Error('Database connection string is missing. Please check your .env.local file.');
  }
  if (!client) {
    client = neon(dbUrl);
  }
  return client;
}

export const sql = ((strings: any, ...values: any[]) => {
  const c = getNeonClient();
  // The neon client natively handles both (strings, ...values) for tagged templates
  // and (query, params) for direct function calls.
  return c(strings, ...values);
}) as any;

/**
 * Execute multiple parameterized queries in a single atomic transaction roundtrip
 */
sql.transaction = (queries: any[]) => {
  const c = getNeonClient();
  return c.transaction(queries);
};

