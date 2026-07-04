// Generate served copies of the API spec from the single source, openapi.yaml.
// Runs on `prebuild` so the public copies never drift from the root spec.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";

const source = readFileSync("openapi.yaml", "utf8");
const spec = parse(source); // also validates that the YAML parses

mkdirSync("public", { recursive: true });
writeFileSync("public/openapi.yaml", source);
writeFileSync("public/openapi.json", `${JSON.stringify(spec, null, 2)}\n`);

console.log("Wrote public/openapi.yaml and public/openapi.json");
