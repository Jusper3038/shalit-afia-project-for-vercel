import { supabase } from "@/integrations/supabase/client";

export const logAudit = async (action: string, details?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("owner_user_id")
    .eq("user_id", user.id)
    .single();

  await supabase.from("audit_logs").insert({
    user_id: profile?.owner_user_id ?? user.id,
    action,
    details: details ?? "",
  });
};
