import type { PutBlobResult, OnUploadProgressCallback } from "@vercel/blob";

/** 小写扩展名（不含点）到允许 MIME 类型的映射。 */
export type UploadTypeMap = Readonly<Record<string, readonly string[]>>;

export interface UploadValidationOptions {
  maxSizeBytes?: number;
  allowedTypes?: UploadTypeMap;
}

export interface UploadOptions extends UploadValidationOptions {
  /** 由受信任的服务端逻辑指定，不能直接采用用户提交的路径。 */
  directory?: string;
  signal?: AbortSignal;
  /** 服务器到 Blob 的传输进度，并非浏览器到服务器的进度。 */
  onProgress?: OnUploadProgressCallback;
}

export type SpecializedUploadOptions = Omit<UploadOptions, "allowedTypes">;

export type UploadResult = PutBlobResult & {
  name: string;
  size: number;
  access: "private";
};
