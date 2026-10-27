import { loadPyodide } from "./pyodide.mjs";
let initialized;
const cancelled = new Set();
const queued = new Set();
let queue = Promise.resolve();
function initialize() {
  if (!initialized)
    initialized = (async () => {
      const indexURL = new URL("./", import.meta.url).href;
      const python = await loadPyodide({
        indexURL,
        stdout: () => {},
        stderr: (message) => console.warn(message),
      });
      const response = await fetch(new URL("python-sources.json", indexURL));
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("計算プログラムの配信ファイルを読み込めませんでした。");
      const sources = await response.json();
      for (const [name, source] of Object.entries(sources)) {
        const destination = "/app/" + name;
        python.FS.mkdirTree(destination.slice(0, destination.lastIndexOf("/")));
        python.FS.writeFile(destination, source, { encoding: "utf8" });
      }
      python.runPython(
        "import sys\nsys.path.insert(0, '/app')\nfrom server.service import dispatch_transport",
      );
      return python;
    })();
  return initialized;
}
self.onmessage = (event) => {
  const request = event.data;
  if (request.type === "cancel") {
    if (queued.has(request.id)) cancelled.add(request.id);
    return;
  }
  queued.add(request.id);
  queue = queue
    .then(async () => {
      if (cancelled.delete(request.id)) return;
      try {
        const python = await initialize();
        if (cancelled.delete(request.id)) return;
        python.globals.set("_physics_request", JSON.stringify(request));
        let result;
        try {
          result = python.runPython("dispatch_transport(_physics_request)");
          const [status, body] = result.toJs();
          if (!cancelled.delete(request.id))
            self.postMessage({ id: request.id, status, body });
        } finally {
          result?.destroy();
          python.globals.delete("_physics_request");
        }
      } catch (error) {
        self.postMessage({
          id: request.id,
          fatal: true,
          status: 503,
          body: JSON.stringify({
            error:
              "ブラウザの計算環境を準備できませんでした。ページを再読み込みしてください。配信ファイルの欠落やブラウザのWebAssembly設定も確認してください。",
          }),
        });
        console.error("Physics worker initialization failed", error);
      }
    })
    .catch((error) => console.error("Physics worker request failed", error))
    .finally(() => {
      queued.delete(request.id);
      cancelled.delete(request.id);
    });
};
