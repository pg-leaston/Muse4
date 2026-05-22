import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

function allowedDevOrigins(): string[] {
  const raw = process.env.ALLOWED_DEV_ORIGINS;
  const fromEnv =
    typeof raw === "string" ?
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (fromEnv.length > 0) return fromEnv;
  return ["192.168.1.100", "192.168.*", "10.*"];
}

const nextConfig: NextConfig = {
  /** Allow phone/tablet on your LAN to load the dev app (e.g. http://192.168.1.100:3000). */
  allowedDevOrigins: allowedDevOrigins(),
  turbopack: {
    root: turbopackRoot,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
    proxyClientMaxBodySize: "512mb",
  },
};

export default nextConfig;
