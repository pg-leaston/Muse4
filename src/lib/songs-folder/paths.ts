import { join } from "node:path";

export function defaultSongsRoot(): string {
  return join(process.cwd(), "Songs");
}
