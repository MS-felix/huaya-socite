export type UploadErrorCode =
  | "INVALID_FILE"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "INVALID_DIRECTORY"
  | "INVALID_CONFIG"
  | "ABORTED"
  | "UPLOAD_FAILED";

export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UploadError";
    this.code = code;
  }
}
