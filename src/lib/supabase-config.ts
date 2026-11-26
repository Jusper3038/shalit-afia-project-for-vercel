const FALLBACK_SUPABASE_URL = "https://fkfjwnzdnsjpyfsvgurk.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A0cEjsGuEEiVx4tR9qIQ0Q_i_E4ce-e";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
