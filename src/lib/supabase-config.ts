const EXPECTED_SUPABASE_PROJECT_REF = "feiewilnuxeyuqvyuzxq";
const DEFAULT_SUPABASE_URL = "https://feiewilnuxeyuqvyuzxq.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RvjwhrlxzZFD615HRJJs0w_nWSvJa2A";

const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
const configuredPublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

let configuredProjectRef = "";
try {
  configuredProjectRef = new URL(configuredUrl).hostname.split(".")[0];
} catch {
  throw new Error("VITE_SUPABASE_URL must be a valid Supabase project URL.");
}

if (configuredProjectRef !== EXPECTED_SUPABASE_PROJECT_REF) {
  throw new Error(
    `Wrong Supabase project configured: expected ${EXPECTED_SUPABASE_PROJECT_REF}, received ${configuredProjectRef || "unknown"}. The clinic app must use the live project.`,
  );
}

export const SUPABASE_PROJECT_REF = EXPECTED_SUPABASE_PROJECT_REF;
export const SUPABASE_URL = configuredUrl;
export const SUPABASE_PUBLISHABLE_KEY = configuredPublishableKey;
