import assert from "node:assert/strict";
import { test } from "node:test";
import { validateUpload, IMAGE_TYPES, DOCUMENT_TYPES, UploadError } from "../lib/upload/index.ts";

test("文件类型与扩展名匹配，允许无 MIME 的已知文档类型", () => {
  assert.deepEqual(validateUpload(new File(["data"], "PHOTO.JPG", { type: "image/jpeg" })), {
    extension: "jpg", contentType: "image/jpeg",
  });
  assert.deepEqual(validateUpload(new File(["data"], "报表.xlsx")), {
    extension: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
});

test("拒绝空文件、超限文件、伪装类型、未知扩展名和路径文件名", () => {
  const cases: [File, string][] = [
    [new File([], "empty.txt"), "EMPTY_FILE"],
    [new File(["12345"], "big.txt"), "FILE_TOO_LARGE"],
    [new File(["x"], "a.png", { type: "application/pdf" }), "UNSUPPORTED_TYPE"],
    [new File(["x"], "a.svg", { type: "image/svg+xml" }), "UNSUPPORTED_TYPE"],
    [new File(["x"], "README"), "UNSUPPORTED_TYPE"],
    [new File(["x"], "../a.txt"), "INVALID_FILE"],
    [new File(["x"], "a\u0000.txt"), "INVALID_FILE"],
  ];
  for (const [file, code] of cases) {
    assert.throws(() => validateUpload(file, { maxSizeBytes: 4 }), { code });
  }
});

test("大小边界和配置校验、专用类型约束", () => {
  const file = new File(["1234"], "file.pdf", { type: "application/pdf" });
  assert.doesNotThrow(() => validateUpload(file, { maxSizeBytes: 4, allowedTypes: DOCUMENT_TYPES }));
  assert.throws(() => validateUpload(file, { allowedTypes: IMAGE_TYPES }), { code: "UNSUPPORTED_TYPE" });
  assert.throws(() => validateUpload(file, { maxSizeBytes: 0 }), UploadError);
  assert.throws(() => validateUpload(file, { allowedTypes: {} }), { code: "UNSUPPORTED_TYPE" });
  assert.throws(() => validateUpload("not a file" as unknown as File), { code: "INVALID_FILE" });
});
