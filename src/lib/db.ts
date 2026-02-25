import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const neonConnection = neon(process.env.DATABASE_URL);

/**
 * Enhanced sql helper that supports both tagged template literals and direct calls.
 * 
 * Usage 1 (Tagged Template): 
 *   await sql`SELECT * FROM users WHERE id = ${id}`
 * 
 * Usage 2 (Direct Call for dynamic queries): 
 *   await sql("SELECT * FROM users WHERE id = $1", [id])
 */
export async function sql(strings: TemplateStringsArray | string, ...values: any[]) {
  // If strings is a string, it's a direct call with (query, params)
  if (typeof strings === 'string') {
    return neonConnection(strings, values[0] || []);
  }
  
  // Standard tagged template literal logic
  const query = strings.reduce((acc, part, i) => {
    return acc + part + (i < values.length ? `$${i + 1}` : '');
  }, '');
  
  return neonConnection(query, values);
}
