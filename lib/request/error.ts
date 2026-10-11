export type RequestErrorKind =
  | "config"
  | "network"
  | "timeout"
  | "aborted"
  | "http"
  | "invalid-response";

export class RequestError extends Error {
  readonly kind: RequestErrorKind;
  readonly status?: number;
  readonly data?: unknown;

  constructor(
    message: string,
    options: {
      kind: RequestErrorKind;
      status?: number;
      data?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "RequestError";
    this.kind = options.kind;
    this.status = options.status;
    this.data = options.data;
  }
}
