import {
  mkdir,
  rm,
  copyFile,
  writeFile,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import {
  root,
  pyodideDirectory,
  pyodideVersion,
  sources,
  workerTemplate,
  runtimePath,
} from "./runtime-assets.mjs";
const base = path.join(root, "public/physics-runtime"),
  output = path.join(root, "public", runtimePath);
await rm(base, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const assets = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];
for (const asset of assets)
  await copyFile(path.join(pyodideDirectory, asset), path.join(output, asset));
await writeFile(
  path.join(output, "python-sources.json"),
  JSON.stringify(sources),
);
await writeFile(path.join(output, "physics-worker.mjs"), workerTemplate);
await writeFile(
  path.join(output, "NOTICE.txt"),
  `Pyodide ${pyodideVersion}\nhttps://github.com/pyodide/pyodide\nMPL-2.0; CPython and bundled standard library retain their original licenses.\nhttps://github.com/pyodide/pyodide/blob/${pyodideVersion}/LICENSE\n`,
);
let bytes = 0;
for (const file of await readdir(output))
  bytes += (await stat(path.join(output, file))).size;
console.log(
  `Browser Python: ${runtimePath} (${(bytes / 1024 / 1024).toFixed(1)} MiB, self-hosted)`,
);
