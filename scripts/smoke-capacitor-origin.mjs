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
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

const { data, error } = await supabase.auth.signInWithPassword({
  email: "owner.staging@a1studio.local",
  password: process.argv[2]
});
if (error) throw error;

const response = await fetch(`${env.VITE_APP_API_URL}/me`, {
  headers: {
    Authorization: `Bearer ${data.session.access_token}`,
    Origin: "capacitor://localhost"
  }
});

console.log(
  JSON.stringify(
    {
      status: response.status,
      allowOrigin: response.headers.get("access-control-allow-origin"),
      body: await response.json()
    },
    null,
    2
  )
);
