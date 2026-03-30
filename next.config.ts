import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid picking a parent-folder lockfile as the tracing root when the repo lives under home.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
