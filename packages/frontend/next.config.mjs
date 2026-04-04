import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Include sibling packages (e.g. file:../sdk); a root of only this folder blocks resolving those symlinks under Turbopack.
const turbopackRoot = path.join(__dirname, "..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
