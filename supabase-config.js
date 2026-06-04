// ─────────────────────────────────────────────
// Supabase Configuration
// UK Finance Tracker
// ─────────────────────────────────────────────

export const SUPABASE_URL = "https://vxccfmmzbzyoqulamflu.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4Y2NmbW16Ynp5b3F1bGFtZmx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1OTY5NTIsImV4cCI6MjA5NjE3Mjk1Mn0.j8aulWgMGp3H0IgAXwaj88TIRzyW8rEHF-_phEXMBvM";

// Database table names
export const TABLES = {
  PROFILES: "profiles",
  TRANSACTIONS: "transactions",
  PAYSLIPS: "payslips",
  CSV_UPLOADS: "csv_uploads",
};

// Storage bucket
export const STORAGE_BUCKET = "csv-uploads";
