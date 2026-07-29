import fs from "node:fs";

const source = fs.readFileSync("legacy-pwa/index.html", "utf8");
fs.writeFileSync("frontend/index.html", source);
console.log("frontend/index.html now uses the same production Supabase data source as the existing PWA.");
