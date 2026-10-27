/** JSON-compatible transport. Default execution stays entirely in the browser. */
interface Reply {
  id: number;
  status: number;
  body: string;
  fatal?: boolean;
}
type Pending = {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};
export class PhysicsClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 0;
  constructor(
    private factory: () => Worker = () =>
      new Worker(
        new URL(
          `${import.meta.env.BASE_URL}${__PHYSICS_RUNTIME_PATH__}/physics-worker.mjs`,
          location.origin,
        ),
        { type: "module", name: "physica-python" },
      ),
  ) {}
  private response(reply: Pick<Reply, "status" | "body">) {
    return new Response(reply.body, {
      status: reply.status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  private open() {
    if (this.worker) return this.worker;
    const worker = this.factory();
    this.worker = worker;
    worker.addEventListener("message", (event: MessageEvent<Reply>) => {
      if (this.worker !== worker) return;
      const reply = event.data,
        task = this.pending.get(reply.id);
      if (task) {
        this.pending.delete(reply.id);
        task.cleanup();
        task.resolve(this.response(reply));
      }
      if (reply.fatal) {
        for (const task of this.pending.values()) {
          task.cleanup();
          task.resolve(this.response(reply));
        }
        this.pending.clear();
        worker.terminate();
        if (this.worker === worker) this.worker = null;
      }
    });
    worker.addEventListener("error", () => {
      if (this.worker !== worker) return;
      for (const task of this.pending.values()) {
        task.cleanup();
        task.reject(
          new Error(
            "ブラウザの計算処理を開始できませんでした。ページを再読み込みしてください。",
          ),
        );
      }
      this.pending.clear();
      worker.terminate();
      if (this.worker === worker) this.worker = null;
    });
    return worker;
  }
  request(path: string, options: RequestInit = {}): Promise<Response> {
    if (options.signal?.aborted)
      return Promise.reject(
        new DOMException("計算を取り消しました。", "AbortError"),
      );
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = this.open();
      } catch {
        reject(
          new Error(
            "このブラウザでは計算用のWeb Workerを開始できません。最新のブラウザで開いてください。",
          ),
        );
        return;
      }
      const abort = () => {
        this.pending.delete(id);
        options.signal?.removeEventListener("abort", abort);
        worker.postMessage({ type: "cancel", id });
        reject(new DOMException("計算を取り消しました。", "AbortError"));
      };
      this.pending.set(id, {
        resolve,
        reject,
        cleanup: () => options.signal?.removeEventListener("abort", abort),
      });
      options.signal?.addEventListener("abort", abort, { once: true });
      try {
        worker.postMessage({
          id,
          method: options.method || "GET",
          path,
          body: options.body,
        });
      } catch {
        this.pending.delete(id);
        options.signal?.removeEventListener("abort", abort);
        reject(
          new Error("計算条件を送れませんでした。入力内容を確認してください。"),
        );
      }
    });
  }
}
const client = new PhysicsClient();
export function requestPhysics(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  if (import.meta.env?.VITE_PHYSICS_MODE === "http")
    return fetch(path, options);
  return client.request(path, options);
}
export async function readPhysicsJson<T>(response: Response): Promise<T> {
  if (
    !response.headers
      .get("Content-Type")
      ?.toLowerCase()
      .includes("application/json")
  )
    throw new Error(
      `計算APIがJSONを返しませんでした（HTTP ${response.status}）。公開先のAPI設定を確認してください。`,
    );
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "計算結果のJSONを読み取れませんでした。ページを再読み込みしてください。",
    );
  }
  if (!response.ok)
    throw new Error(
      data?.error || `計算を完了できませんでした（HTTP ${response.status}）。`,
    );
  return data as T;
}
export async function callPhysics<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return readPhysicsJson<T>(await requestPhysics(path, options));
}
