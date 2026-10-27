import { spawn } from "node:child_process";
const children = [
  spawn("python3", ["-m", "server.app", "--port", "8000"], {
    stdio: "inherit",
  }),
  spawn("node", ["node_modules/vite/bin/vite.js"], {
    stdio: "inherit",
    env: { ...process.env, VITE_PHYSICS_MODE: "http" },
  }),
];
let exiting = false;
function stop(code = 0) {
  if (exiting) return;
  exiting = true;
  children.forEach((c) => c.kill("SIGTERM"));
  process.exit(code);
}
children.forEach((c) => {
  c.on("error", (e) => {
    console.error(e);
    stop(1);
  });
  c.on("exit", (code) => stop(code ?? 0));
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
