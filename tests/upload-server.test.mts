import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { PutCommandOptions } from "@vercel/blob";

const put = mock.fn(async (pathname: string, file: File, options: PutCommandOptions) => ({
  url: `https://test.private.blob.vercel-storage.com/${pathname}`,
  downloadUrl: `https://test.private.blob.vercel-storage.com/${pathname}?download=1`,
  pathname,
  contentType: options.contentType ?? file.type,
  contentDisposition: "attachment",
  etag: "test",
}));
mock.module("@vercel/blob", { namedExports: { put } });
const { uploadFile, uploadImage, uploadDocument } = await import("../lib/upload/server.ts");

test("上传只在服务端使用私有 Token，生成唯一键并规范化结果", async (t) => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-only-token";
  t.after(() => {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
  });
  const file = new File(["data"], "原始文件.txt", { type: "text/plain" });
  const signal = new AbortController().signal;
  const onProgress = () => {};
  const result = await uploadFile(file, { directory: "documents/project", signal, onProgress });
  const second = await uploadDocument(file);
  assert.equal(result.name, file.name);
  assert.equal(result.size, 4);
  assert.equal(result.access, "private");
  assert.match(result.pathname, /^documents\/project\/[a-f0-9-]+\.txt$/);
  assert.notEqual(result.pathname, second.pathname);
  const options = put.mock.calls[0].arguments[2];
  assert.equal(options.access, "private");
  assert.equal(options.token, "test-only-token");
  assert.equal(options.allowOverwrite, false);
  assert.equal(options.abortSignal, signal);
  assert.equal(options.onUploadProgress, onProgress);
});

test("校验、取消和缺少配置时不调用 Blob", async () => {
  const count = put.mock.callCount();
  const file = new File(["text"], "file.txt");
  await assert.rejects(uploadImage(file), { code: "UNSUPPORTED_TYPE" });
  await assert.rejects(uploadFile(file, { directory: "../escape" }), { code: "INVALID_DIRECTORY" });
  await assert.rejects(uploadFile(file, { signal: AbortSignal.abort() }), { code: "ABORTED" });
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    await assert.rejects(uploadFile(file), { code: "INVALID_CONFIG" });
  } finally {
    if (previous !== undefined) process.env.BLOB_READ_WRITE_TOKEN = previous;
  }
  assert.equal(put.mock.callCount(), count);
});

test("SDK 错误转换为统一上传错误，不把内部信息放进提示消息", async (t) => {
  const previous = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-only-token";
  t.after(() => {
    if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previous;
  });
  put.mock.mockImplementationOnce(async () => { throw new Error("internal provider error"); });
  await assert.rejects(uploadDocument(new File(["text"], "file.txt")), {
    name: "UploadError", code: "UPLOAD_FAILED", message: "文件上传失败，请稍后重试",
  });
});
