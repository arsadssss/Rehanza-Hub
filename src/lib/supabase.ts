import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are not set. Please create a `.env.local` file in the root of your project and add your Supabase URL and Anon Key.\n\nExample:\nNEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
