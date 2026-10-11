# Request / API Client

## 用途与位置

`lib/request/index.ts` 基于原生 `fetch` 统一 JSON API 请求。浏览器和服务端均可使用，不引入 axios，不自动解包 `data`，不预设业务响应协议。

## 主要 API

| API | 参数 | 返回值 |
| --- | --- | --- |
| `request.get<T>(path, options?)` | 同源路径、请求选项 | `Promise<T>` |
| `request.post/put/patch/delete<T>(path, options?)` | 路径、请求选项，JSON 放在 `options.json` | `Promise<T>` |
| `request.send<T>(path, options?)` | 允许自行指定 `method` 的请求选项 | `Promise<T>` |
| `createRequestClient(config?)` | 基础地址、Header、凭据策略、超时、错误回调 | 独立客户端，方法同上 |

`T` 默认 `unknown`，是调用方的类型声明，不会执行运行时数据校验。空响应（包括 204）返回 `undefined`，这类接口请声明 `<void>`。非空成功响应必须是 JSON，否则抛出 `RequestError`。

### 客户端配置

- `baseURL`：默认空字符串。浏览器可设为 `/api`，服务端必须使用受信任的完整 HTTP(S) 地址。基础地址可包含路径前缀，例如 `https://example.com/api`。
- `headers`：公共 Header；`getHeaders()` 在每次请求时同步获取动态 Header。单次请求的 Header 最后覆盖，大小写不敏感。
- `credentials`：默认 `same-origin`。模块不自行存储 Token，不自动读取 Cookie；浏览器遵循 Fetch Cookie 策略。服务端需要根据实际会话明确传递凭据。
- `timeoutMs`：默认 30 秒，覆盖响应体读取，`0` 表示不设置超时。
- `onError(error)`：统一错误入口，可接入未来认证、通知或日志模块。回调抛错不会覆盖原始请求错误；不执行自动登录跳转。

### 单次请求选项

- `params`：支持字符串、数字、布尔值及数组，数组编码为重复键；`undefined` 不覆盖已有查询参数，`null` 删除该键。
- `json`：自动序列化并默认设置 `Content-Type: application/json`。
- `body`：传递原生请求体，例如 `FormData`；不能与 `json` 同时使用。FormData 的 Content-Type 和 boundary 交给 fetch 设置。
- `signal`：调用方的 `AbortSignal`，与模块超时一起生效。
- 其余原生 `RequestInit` 和 Next.js `next` 配置原样传递，包括 `cache`、`credentials`、`revalidate` 和 `tags`。

## 使用示例

以下路径为接口形式示意，仓库目前没有这些业务接口；业务类型和路径应在对应业务模块中集中定义。

```ts
import { createRequestClient, RequestError } from "@/lib/request";

const api = createRequestClient({ baseURL: "/api" });

// 已有业务类型时直接复用，不在页面重复定义。
const result = await api.get<unknown>("items", {
  params: { page: 1, tag: ["a", "b"] },
});

await api.post("items", { json: { name: "示例" } });
await api.delete<void>("items/123");

const controller = new AbortController();
try {
  await api.get("items", { signal: controller.signal, timeoutMs: 5_000 });
} catch (error) {
  if (error instanceof RequestError && error.kind === "aborted") {
    // 用户取消时通常无需弹出错误提示。
  } else {
    throw error;
  }
}
```

需要 Token 的服务端调用应在本次请求作用域创建客户端或传递 Header，不能把当前用户凭据存入模块级共享单例。外部 API 必须由业务模块配置受信任的 `baseURL`，`path` 不允许绝对 URL、协议相对 URL 或反斜线，避免覆盖目标域名。

## 错误与限制

`RequestError` 定义于 `lib/request/error.ts`，统一暴露 `kind`、可选 `status`、可选 `data` 和原始 `cause`。

| kind | 含义 |
| --- | --- |
| `config` | 配置错误、JSON 无法序列化或请求体冲突 |
| `network` | 网络或底层请求失败 |
| `timeout` | 超时 |
| `aborted` | 调用方取消 |
| `http` | 非 2xx，`status` 保留原始 HTTP 状态码 |
| `invalid-response` | 成功响应不是有效 JSON |

401 和 403 有统一提示，可在 `onError` 中通过 `status` 接入认证行为。其他 HTTP 错误优先采用响应顶层字符串 `message`，同时保留 JSON 错误数据。非 JSON 错误页不会当作用户提示。

- HTTP 2xx 中的业务失败（例如 `success: false`）保持原样，由未来确定的业务协议处理。
- 不自动重试写请求，避免重复提交；不提供响应拦截器、二进制下载或流式响应能力。
- 每次调用携带独立 AbortSignal，因此不要依赖 Next.js 对该调用的自动请求去重；持久缓存选项仍交给 Next.js 处理。
- 服务端业务模块可直接调用数据库或存储，不需要通过 HTTP 绕回自身 Route Handler。
- 错误的 `data` / `cause` 可能含敏感信息，不应直接输出到浏览器或日志。

## 当前调用方与验证

暂无业务页面调用。`tests/request.test.mts` 覆盖参数编码、凭据更新、JSON/FormData、HTTP 状态、错误分类、取消、响应体超时及 Next.js 选项传递；运行 `pnpm test`。
