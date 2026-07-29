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
const email = process.argv[2];
const password = process.argv[3];

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;

const response = await fetch(`${env.VITE_APP_API_URL}/me`, {
  headers: { Authorization: `Bearer ${data.session.access_token}` }
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`app-api /me failed: ${response.status} ${body}`);
}

console.log(body);
