import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jcqpuqhdfveleusjsxeo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Kb5B22FeTpHR90AqZ3q3Fw_upK4MKiZ";

export const isSupabaseConfigured = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
