import { neon } from '@neondatabase/serverless';

/**
 * Enhanced sql helper that supports both tagged template literals and direct calls.
 * This version is more resilient to missing environment variables during initialization.
 */
export async function sql(strings: TemplateStringsArray | string, ...values: any[]) {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in environment variables');
    throw new Error('Database connection string is missing');
  }

  const neonConnection = neon(dbUrl);
  
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
