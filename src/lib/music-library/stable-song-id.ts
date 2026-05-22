import { createHash } from "node:crypto";

/** Deterministic UUID from local folder key so re-sync updates the same row. */
export function songUuidFromSourceKey(sourceKey: string): string {
  const hash = createHash("sha256").update(`muse4:song:${sourceKey}`).digest();
  const bytes = Uint8Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
