import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequestClient, RequestError } from "../lib/request/index.ts";

test("合并路径和查询参数，保留完整响应结构", async (t) => {
  const response = { success: true, data: [1], message: "ok" };
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(url, "https://example.test/api/items?page=2&tag=a&tag=b&enabled=false");
    return Response.json(response);
  });
  const client = createRequestClient({ baseURL: "https://example.test/api/" });
  assert.deepEqual(await client.get("/items?page=1", {
    params: { page: 2, tag: ["a", "b"], enabled: false, missing: undefined, empty: null },
  }), response);
});

test("JSON 写入和各 HTTP 方法使用统一入口", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    calls.push(init.method!);
    assert.equal(new Headers(init.headers).get("content-type"), "application/json");
    assert.equal(init.body, '{"name":"测试"}');
    return Response.json({ ok: true });
  });
  const client = createRequestClient();
  for (const method of ["post", "put", "patch", "delete"] as const) {
    await client[method]("/api/items", { json: { name: "测试" } });
  }
  assert.deepEqual(calls, ["POST", "PUT", "PATCH", "DELETE"]);
});

test("每次读取凭据、Header 大小写合并并允许单次覆盖", async (t) => {
  let token = "first";
  const client = createRequestClient({
    baseURL: "/api",
    headers: { "X-App": "base" },
    getHeaders: () => ({ Authorization: `Bearer ${token}` }),
  });
  const seen: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    seen.push(headers.get("authorization")!);
    assert.equal(headers.get("x-app"), "request");
    assert.equal(init.credentials, "same-origin");
    return Response.json(null);
  });
  await client.get("me", { headers: new Headers({ "x-app": "request" }) });
  token = "second";
  await client.get("me", { headers: [["x-app", "request"]] });
  assert.deepEqual(seen, ["Bearer first", "Bearer second"]);
});

test("FormData 不继承 JSON Content-Type，原生 fetch 设置 boundary", async (t) => {
  const body = new FormData();
  body.set("file", new File(["text"], "file.txt"));
  const client = createRequestClient({ headers: { "Content-Type": "application/json" } });
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(init.body, body);
    assert.equal(new Headers(init.headers).has("content-type"), false);
    return new Response(null, { status: 204 });
  });
  assert.equal(await client.post<void>("/upload", { body }), undefined);
});

test("统一处理 401/403、JSON 错误和非 JSON 错误，回调不掩盖原错误", async (t) => {
  const errors: RequestError[] = [];
  const client = createRequestClient({ onError(error) { errors.push(error); throw new Error("UI error"); } });
  let status = 401;
  t.mock.method(globalThis, "fetch", async () => status === 500
    ? new Response("<html>upstream failed</html>", { status })
    : Response.json({ message: "错误", code: "TEST" }, { status }));
  for (status of [401, 403, 422, 500]) {
    await assert.rejects(client.get("/test"), (error: unknown) => {
      assert.ok(error instanceof RequestError);
      assert.equal(error.kind, "http");
      assert.equal(error.status, status);
      if (status === 422) assert.deepEqual(error.data, { message: "错误", code: "TEST" });
      if (status === 500) assert.equal(error.message.includes("<html>"), false);
      return true;
    });
  }
  assert.equal(errors.length, 4);
});

test("区分响应解析失败和网络失败", async (t) => {
  const client = createRequestClient();
  const mocked = t.mock.method(globalThis, "fetch", async () => new Response("not json"));
  await assert.rejects(client.get("/test"), { kind: "invalid-response", status: 200 });
  mocked.mock.mockImplementation(async () => { throw new TypeError("offline"); });
  await assert.rejects(client.get("/test"), { kind: "network" });
});

test("拒绝外部 URL 覆盖和错误请求配置，且不发出网络请求", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({}));
  const client = createRequestClient({ baseURL: "https://example.test/api" });
  for (const path of ["https://other.test/path", "//other.test/path", "\\other.test/path"]) {
    await assert.rejects(client.get(path), { kind: "config" });
  }
  await assert.rejects(client.post("/test", { json: {}, body: "raw" }), { kind: "config" });
  await assert.rejects(client.get("/test", { json: {} }), { kind: "config" });
  await assert.rejects(client.get("/test", { timeoutMs: -1 }), { kind: "config" });
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  await assert.rejects(client.post("/test", { json: circular }), { kind: "config" });
  assert.equal(fetch.mock.callCount(), 0);
});

test("超时和主动取消分别归类，已取消请求不发出网络调用", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
    }));
  const client = createRequestClient();
  await assert.rejects(client.get("/slow", { timeoutMs: 5 }), { kind: "timeout" });
  const controller = new AbortController();
  const pending = client.get("/slow", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { kind: "aborted" });
  await assert.rejects(client.get("/never", { signal: controller.signal }), { kind: "aborted" });
  assert.equal(fetch.mock.callCount(), 2);
});

test("超时覆盖响应体读取；Next.js 缓存配置原样传递", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(init.cache, "force-cache");
    assert.deepEqual(init.next, { revalidate: 60, tags: ["items"] });
    return new Response(new ReadableStream({
      start(controller) {
        setTimeout(() => { controller.enqueue(new TextEncoder().encode("{}")); controller.close(); }, 20);
      },
    }));
  });
  await assert.rejects(createRequestClient().get("/slow-body", {
    timeoutMs: 5, cache: "force-cache", next: { revalidate: 60, tags: ["items"] },
  }), { kind: "timeout" });
});
