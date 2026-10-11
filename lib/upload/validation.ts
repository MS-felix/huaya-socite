import { UploadError } from "./error.ts";
import type { UploadTypeMap, UploadValidationOptions } from "./types.ts";

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES: UploadTypeMap = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
};

export const DOCUMENT_TYPES: UploadTypeMap = {
  pdf: ["application/pdf"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
};

export const FILE_TYPES: UploadTypeMap = { ...IMAGE_TYPES, ...DOCUMENT_TYPES };

export function validateUpload(file: File, options: UploadValidationOptions = {}) {
  const { maxSizeBytes = DEFAULT_MAX_UPLOAD_BYTES, allowedTypes = FILE_TYPES } = options;
  if (!Number.isSafeInteger(maxSizeBytes) || maxSizeBytes <= 0) {
    throw new UploadError("INVALID_CONFIG", "文件大小上限必须是正整数");
  }
  if (!(file instanceof File) || !file.name.trim() || /[\x00-\x1f/\\]/.test(file.name)) {
    throw new UploadError("INVALID_FILE", "请选择有效的文件");
  }
  if (file.size === 0) throw new UploadError("EMPTY_FILE", "不能上传空文件");
  if (file.size > maxSizeBytes) throw new UploadError("FILE_TOO_LARGE", "文件超过允许的大小");

  const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
  const types = Object.hasOwn(allowedTypes, extension) && file.name.includes(".")
    ? allowedTypes[extension]
    : undefined;
  const contentType = file.type.toLowerCase().split(";")[0].trim();
  if (!types?.length || (contentType && !types.includes(contentType))) {
    throw new UploadError("UNSUPPORTED_TYPE", "文件扩展名或 MIME 类型不被允许");
  }
  return { extension, contentType: contentType || types[0] };
}
