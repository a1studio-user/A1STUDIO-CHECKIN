import fs from "node:fs";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [
        line.slice(0, index).trim(),
        line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")
      ];
    })
);

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
}

const source = fs.readFileSync("legacy-pwa/index.html", "utf8");
const output = source
  .replace(/const SUPABASE_URL='[^']+';/, `const SUPABASE_URL='${supabaseUrl}';`)
  .replace(/const SUPABASE_ANON_KEY='[^']+';/, `const SUPABASE_ANON_KEY='${anonKey}';`);

fs.writeFileSync("frontend/index.html", output);
console.log("frontend/index.html now uses the pixel-identical legacy UI with the staging Supabase project.");
