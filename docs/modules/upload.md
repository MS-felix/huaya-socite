# Upload

## 用途与边界

- `lib/upload/server.ts`：服务端上传到项目现有的私有 Vercel Blob，使用官方 `@vercel/blob` SDK。
- `lib/upload/index.ts`：浏览器与服务端共享的校验、类型、常量和错误入口，不导出任何凭据或上传实现。
- `lib/upload/validation.ts`：统一大小、文件名、扩展名和 MIME 校验。
- `lib/upload/types.ts` / `error.ts`：公共参数、结果类型与 `UploadError`。

当前没有认证模块，因此本模块提供服务端函数，没有注册匿名上传 HTTP 接口，也没有浏览器直传授权入口。业务层完成用户认证、权限、配额和所属关系校验后再调用；`server-only` 限制代码运行环境，不等于用户鉴权。

## 主要 API

| API | 参数 | 返回值 |
| --- | --- | --- |
| `uploadFile(file, options?)` | `File`、上传选项 | `Promise<UploadResult>` |
| `uploadImage(file, options?)` | `File`、除 `allowedTypes` 外的上传选项 | `Promise<UploadResult>`，限定图片类型 |
| `uploadDocument(file, options?)` | 同上 | `Promise<UploadResult>`，限定文档类型 |
| `validateUpload(file, options?)` | `File`、`maxSizeBytes`、`allowedTypes` | `{ extension, contentType }`，失败抛出 `UploadError` |

### 上传选项

- `directory`：默认 `uploads`，支持 `documents/orders`。每段仅允许字母、数字、下划线、短横线，总长不超过 200；由受信任服务端逻辑决定。
- `maxSizeBytes`：默认 10 MiB，可按业务配置；必须为正整数。
- `allowedTypes`：扩展名到 MIME 列表的映射，仅 `uploadFile` 支持覆盖，采用替换而非合并。
- `signal`：取消上传的 `AbortSignal`。
- `onProgress`：官方 SDK 进度回调，接收 `{ loaded, total, percentage }`。这是服务器到 Blob 的传输进度，不代表浏览器到服务器的传输进度；不能将回调直接作为 Server Action 的客户端参数。

### 默认文件范围

- 图片：JPEG、PNG、WebP、GIF。
- 文档：PDF、XLS、XLSX、DOC、DOCX、TXT、CSV。
- 普通文件：上述两类的合集。新增类型应由调用方提供明确的 `allowedTypes`，或在确认复用价值后扩展公共常量。
- 空文件、路径式文件名、不匹配的扩展名/MIME、未知扩展名默认拒绝。
- 浏览器未提供 MIME 时采用已允许扩展名的默认 MIME；这是元数据校验，不是文件内容签名或病毒检测。需要内容真实性验证时应在业务入库前额外检查。

## 结果与凭据

`UploadResult` 复用 SDK 的 `PutBlobResult`，含 `pathname`、`url`、`downloadUrl`、`contentType`、`contentDisposition`、`etag`，另含原始文件名 `name`、大小 `size` 和固定 `access: "private"`。

存储路径是 `directory/UUID.extension`，原始文件名不参与存储路径；禁止覆盖已有对象。服务端调用时才读取 `BLOB_READ_WRITE_TOKEN`，未配置时抛出明确错误，导入模块本身不要求凭据。

私有 Blob 的 `url` / `downloadUrl` 不是可匿名访问的地址。后续下载需由鉴权后的服务端读取或签发受限访问；本次没有实现下载接口。

## 使用示例

服务端业务模块在完成鉴权后调用：

```ts
import { uploadDocument } from "@/lib/upload/server";

export async function storeDocument(file: File) {
  // 调用前必须由实际业务入口完成认证、权限和文件所属关系检查。
  return uploadDocument(file, {
    directory: "documents",
    maxSizeBytes: 5 * 1024 * 1024,
  });
}
```

浏览器选择文件后可提前校验，服务端上传时会再次校验：

```ts
import { validateUpload, IMAGE_TYPES, UploadError } from "@/lib/upload";

export function checkImage(file: File) {
  try {
    return validateUpload(file, { allowedTypes: IMAGE_TYPES });
  } catch (error) {
    if (error instanceof UploadError) {
      // 将 error.message 交给业务层的错误展示机制。
    }
    throw error;
  }
}
```

## 错误与接入注意

`UploadError.code` 包括 `INVALID_FILE`、`EMPTY_FILE`、`FILE_TOO_LARGE`、`UNSUPPORTED_TYPE`、`INVALID_DIRECTORY`、`INVALID_CONFIG`、`ABORTED`、`UPLOAD_FAILED`。存储 SDK 错误统一转换为 `UPLOAD_FAILED`，不把底层服务错误直接放进提示消息。`cause` 仅供服务端排查，不直接返回客户端。

- 调用方传入的策略、目录和大小限制属于服务端配置，不可直接信任客户端表单中的同名字段。
- 如通过 Server Action 或 Route Handler 转发，仍受 Next.js 和 Vercel 请求体限制；本模块的 10 MiB 默认值不会改变传输层限制。需要大文件时再接入有鉴权的 Blob 客户端直传。
- 取消上传不是事务回滚；网络中断时可能需要核对存储状态，不自动无限重试。
- 不创建业务数据表，不把上传结果自动写入数据库，不提供无鉴权的读写或删除接口。
- Blob 使用专有存储协议，由官方 SDK 完成传输；普通业务 HTTP API 使用 Request 模块，不重复实现 SDK 协议。

## 当前调用方与验证

暂无业务页面或接口调用。`uploadImage` / `uploadDocument` 复用 `uploadFile`，后者复用 `validateUpload`。

`tests/upload.test.mts` 检查校验边界；`tests/upload-server.test.mts` 通过官方 SDK 的模块替身检查私有访问、凭据、唯一键、错误和取消行为。`pnpm test` 不使用真实 Token，也不会写入云端存储。
