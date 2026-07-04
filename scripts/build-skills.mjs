// Build claude.ai Skills from the templates in `skills/`, injecting secrets from
// .env.local, and emit ready-to-upload copies into the gitignored `.skills-dist/`.
//
//   npm run skills:build
//
// Templates use {{VAR}} placeholders; only these vars are substituted:
//   {{RECIPES_PUBLISH_TOKEN}}  - write token (from .env.local)
//   {{API_BASE}}               - PRODUCTION site origin the Skill calls
//                                (SKILLS_API_BASE, default https://justmy.recipes).
//                                NOTE: intentionally NOT NEXT_PUBLIC_SITE_URL — that
//                                is localhost in dev, but the Skill runs in claude.ai
//                                and must reach production.
//
// The emitted folder contains your live token, so it is gitignored. Never commit
// .skills-dist/. Edit the templates in skills/ (which carry placeholders only).
import { config } from "dotenv";
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });

const SRC = "skills";
const OUT = ".skills-dist";

const vars = {
  RECIPES_PUBLISH_TOKEN: process.env.RECIPES_PUBLISH_TOKEN,
  API_BASE: process.env.SKILLS_API_BASE || "https://justmy.recipes",
};

if (!vars.RECIPES_PUBLISH_TOKEN) {
  console.error("✗ RECIPES_PUBLISH_TOKEN is not set in .env.local — cannot build skills.");
  process.exit(1);
}

const inject = (text) =>
  text.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars && vars[key] != null ? vars[key] : m));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const skills = readdirSync(SRC, { withFileTypes: true }).filter((d) => d.isDirectory());
for (const skill of skills) {
  const inDir = join(SRC, skill.name);
  const outDir = join(OUT, skill.name);
  mkdirSync(outDir, { recursive: true });
  for (const file of readdirSync(inDir)) {
    writeFileSync(join(outDir, file), inject(readFileSync(join(inDir, file), "utf8")));
  }
  console.log(`✓ built skill: ${skill.name}`);
}

console.log(`\nEmitted ${skills.length} skill(s) to ${OUT}/ (gitignored, token injected).`);
console.log("Upload a skill's folder to claude.ai → Settings → Capabilities/Skills.");
