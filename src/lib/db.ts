import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const neonConnection = neon(process.env.DATABASE_URL);

// Create a template literal tag function to mimic @vercel/postgres `sql`
// This provides a safer and more convenient way to write queries with parameters.
export async function sql(strings: TemplateStringsArray, ...values: any[]) {
  const query = strings.reduce((acc, part, i) => {
    // Replace `?` with numbered placeholders `$1`, `$2`, etc.
    return acc + part + (i < values.length ? `$${i + 1}` : '');
  }, '');
  
  return neonConnection(query, values);
}
