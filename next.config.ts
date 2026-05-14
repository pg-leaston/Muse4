import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
