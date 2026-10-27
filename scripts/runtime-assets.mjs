import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const pyodideDirectory = path.join(root, "node_modules/pyodide");
export const pyodideVersion = JSON.parse(
  readFileSync(path.join(pyodideDirectory, "package.json"), "utf8"),
).version;
export const workerTemplate = readFileSync(
  path.join(root, "scripts/templates/physics-worker.mjs"),
  "utf8",
);
export function pythonSources() {
  const files = {};
  function walk(dir) {
    for (const item of readdirSync(path.join(root, dir), {
      withFileTypes: true,
    }).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = dir + "/" + item.name;
      if (item.isDirectory() && item.name !== "__pycache__") walk(name);
      else if (
        item.isFile() &&
        name.endsWith(".py") &&
        !["server/app.py", "server/http_api.py"].includes(name)
      )
        files[name] = readFileSync(path.join(root, name), "utf8");
    }
  }
  walk("server");
  return files;
}
export const sources = pythonSources();
const digest = createHash("sha256")
  .update(JSON.stringify(sources))
  .update(workerTemplate)
  .digest("hex")
  .slice(0, 16);
export const runtimePath = `physics-runtime/${pyodideVersion}-${digest}`;
