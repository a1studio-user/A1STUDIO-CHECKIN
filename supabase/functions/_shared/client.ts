import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing Supabase Edge Function secrets");
}

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

export function userClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    },
    auth: { persistSession: false }
  });
}
