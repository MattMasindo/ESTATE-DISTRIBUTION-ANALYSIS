// Optional cloud storage for saved client cases.
//
// Leave these null and the calculator runs exactly as it does offline: everything
// stays in the browser, no account, nothing sent anywhere. That is the default.
//
// To turn on saved cases, create a Supabase project, run
// supabase/migrations/0001_init.sql in its SQL editor, then paste the two values
// from Project Settings -> API below.
//
// The anon key is designed to be public — row-level security is what protects the
// data, which is why the migration turns RLS on before anything else.
export const SUPABASE_URL = null;      // e.g. "https://abcdefgh.supabase.co"
export const SUPABASE_ANON_KEY = null; // e.g. "eyJhbGciOi..."
