import { RequestError } from "./error.ts";

export { RequestError } from "./error.ts";
export type { RequestErrorKind } from "./error.ts";

type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export interface RequestOptions extends RequestInit {
  params?: QueryParams;
  json?: unknown;
  /** 包括响应体读取；0 表示不设置超时。 */
  timeoutMs?: number;
}

export interface RequestClientOptions {
  /** 浏览器可用 /api；服务端必须使用受信任的绝对 HTTP(S) 地址。 */
  baseURL?: string;
  headers?: HeadersInit;
  /** 每次请求读取，避免将用户凭据保存在服务端单例中。 */
  getHeaders?: () => HeadersInit;
  credentials?: RequestCredentials;
  timeoutMs?: number;
  /** 可在此统一处理 401/403；模块自身不决定登录跳转或业务错误 UI。 */
  onError?: (error: RequestError) => void;
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

function buildURL(baseURL: string, path: string, params?: QueryParams): string {
  // 禁止调用方覆盖客户端的目标域名，避免将默认凭据发往其他站点。
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//") || /[\\\s]/.test(path)) {
    throw new RequestError("请求路径必须是相对路径，请通过 baseURL 配置目标服务", { kind: "config" });
  }
  const absolute = /^https?:\/\//i.test(baseURL);
  if (baseURL && !absolute && (!baseURL.startsWith("/") || baseURL.startsWith("//"))) {
    throw new RequestError("baseURL 必须是 HTTP(S) 地址或以 / 开头的路径", { kind: "config" });
  }
  if (/[?#\\\s]/.test(baseURL)) {
    throw new RequestError("baseURL 不能包含查询参数、片段或空白字符", { kind: "config" });
  }
  const url = new URL(
    `${baseURL.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`,
    "https://request.invalid",
  );
  if (url.username || url.password) {
    throw new RequestError("baseURL 不能包含用户名或密码", { kind: "config" });
  }
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined) continue;
    url.searchParams.delete(key);
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== null && item !== undefined) url.searchParams.append(key, String(item));
    }
  }
  url.hash = "";
  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

function httpMessage(status: number, data: unknown): string {
  if (status === 401) return "请先登录或重新登录";
  if (status === 403) return "没有执行此操作的权限";
  if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
    return data.message;
  }
  return `请求失败（HTTP ${status}）`;
}

export function createRequestClient(config: RequestClientOptions = {}) {
  async function send<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutReason = new Error("请求超时");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { params, json, timeoutMs = config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS, signal, ...init } = options;
    const abort = () => controller.abort(signal?.reason);

    try {
      if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 2_147_483_647) {
        throw new RequestError("timeoutMs 必须是有效的非负整数", { kind: "config" });
      }
      if (json !== undefined && init.body != null) {
        throw new RequestError("json 和 body 不能同时传入", { kind: "config" });
      }
      const method = (init.method ?? "GET").toUpperCase();
      if ((method === "GET" || method === "HEAD") && (json !== undefined || init.body != null)) {
        throw new RequestError("GET/HEAD 请求不能携带请求体", { kind: "config" });
      }
      const url = buildURL(config.baseURL ?? "", path, params);
      const headers = new Headers(config.headers);
      for (const source of [config.getHeaders?.(), init.headers]) {
        new Headers(source).forEach((value, key) => headers.set(key, value));
      }
      if (!headers.has("accept")) headers.set("accept", "application/json");
      let body = init.body;
      if (json !== undefined) {
        try {
          body = JSON.stringify(json);
          if (body === undefined) throw new Error("无法序列化");
        } catch (cause) {
          throw new RequestError("请求内容无法序列化为 JSON", { kind: "config", cause });
        }
        if (!headers.has("content-type")) headers.set("content-type", "application/json");
      }
      // FormData 的 boundary 由 fetch 设置，不能继承客户端的 JSON Content-Type。
      if (body instanceof FormData) headers.delete("content-type");
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
      controller.signal.throwIfAborted();
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (!controller.signal.aborted) {
            controller.abort(timeoutReason);
          }
        }, timeoutMs);
      }

      const response = await fetch(url, {
        credentials: config.credentials ?? "same-origin",
        ...init,
        method,
        headers,
        body,
        signal: controller.signal,
      });
      const text = await response.text();
      controller.signal.throwIfAborted();
      let data: unknown;
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (cause) {
          if (response.ok) {
            throw new RequestError("响应内容不是有效 JSON", {
              kind: "invalid-response", status: response.status, cause,
            });
          }
        }
      }
      if (!response.ok) {
        throw new RequestError(httpMessage(response.status, data), {
          kind: "http", status: response.status, data,
        });
      }
      // 保留后端原始结构；泛型是调用方声明，不替代运行时数据校验。
      return data as T;
    } catch (cause) {
      const abortKind = controller.signal.reason === timeoutReason ? "timeout" : "aborted";
      const error = controller.signal.aborted
        ? new RequestError(abortKind === "timeout" ? "请求超时" : "请求已取消", { kind: abortKind, cause })
        : cause instanceof RequestError
          ? cause
          : new RequestError("请求失败，请检查网络或请求配置", { kind: "network", cause });
      try {
        config.onError?.(error);
      } catch {
        // UI 或日志回调失败不覆盖真正的请求错误。
      }
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }

  const withMethod = (method: string) =>
    <T = unknown>(path: string, options?: Omit<RequestOptions, "method">) =>
      send<T>(path, { ...options, method });

  return {
    send,
    get: withMethod("GET"),
    post: withMethod("POST"),
    put: withMethod("PUT"),
    patch: withMethod("PATCH"),
    delete: withMethod("DELETE"),
  };
}

/** 同源浏览器请求入口；服务端通过 createRequestClient 配置绝对 baseURL。 */
export const request = createRequestClient();
