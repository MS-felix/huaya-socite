import "server-only";

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { UploadError } from "./error.ts";
import { validateUpload, IMAGE_TYPES, DOCUMENT_TYPES } from "./validation.ts";
import type { UploadOptions, UploadResult, SpecializedUploadOptions } from "./types.ts";

export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const { extension, contentType } = validateUpload(file, options);
  const directory = options.directory ?? "uploads";
  if (directory.length > 200 || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(directory)) {
    throw new UploadError("INVALID_DIRECTORY", "上传目录只能包含字母、数字、下划线、短横线和层级分隔符");
  }
  if (options.signal?.aborted) throw new UploadError("ABORTED", "上传已取消");
  // 显式传入 read-write token，避免 .env.local 中的 OIDC token 触发其他认证方式。
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new UploadError("INVALID_CONFIG", "文件存储尚未配置");

  try {
    const blob = await put(`${directory}/${randomUUID()}.${extension}`, file, {
      token,
      access: "private",
      contentType,
      allowOverwrite: false,
      addRandomSuffix: false,
      abortSignal: options.signal,
      onUploadProgress: options.onProgress,
    });
    return { ...blob, name: file.name, size: file.size, access: "private" };
  } catch (cause) {
    if (options.signal?.aborted) {
      throw new UploadError("ABORTED", "上传已取消", { cause });
    }
    throw new UploadError("UPLOAD_FAILED", "文件上传失败，请稍后重试", { cause });
  }
}

export function uploadImage(file: File, options: SpecializedUploadOptions = {}) {
  return uploadFile(file, { ...options, allowedTypes: IMAGE_TYPES });
}

export function uploadDocument(file: File, options: SpecializedUploadOptions = {}) {
  return uploadFile(file, { ...options, allowedTypes: DOCUMENT_TYPES });
}
