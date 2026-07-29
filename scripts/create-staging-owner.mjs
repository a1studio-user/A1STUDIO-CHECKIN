import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trimStart().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const env = readEnv(new URL("../.env", import.meta.url));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const email = "owner.staging@a1studio.local";
const password = `A1staging-${Math.random().toString(36).slice(2, 10)}!7`;

const users = await supabase.auth.admin.listUsers();
if (users.error) throw users.error;

let user = users.data.users.find((item) => item.email === email);
if (!user) {
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: "toni-staging" }
  });
  if (created.error) throw created.error;
  user = created.data.user;
} else {
  const updated = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true
  });
  if (updated.error) throw updated.error;
}

const { error: profileError } = await supabase.from("profiles").upsert({
  id: user.id,
  username: "toni-staging",
  role: "owner",
  programs: { italian: true, portfolio: true }
});
if (profileError) throw profileError;

console.log(JSON.stringify({ email, password, userId: user.id }, null, 2));
