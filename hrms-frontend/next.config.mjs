import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const apiProxyTargetRaw = process.env.API_PROXY_TARGET?.trim();
if (!apiProxyTargetRaw) {
  throw new Error(
    "API_PROXY_TARGET is required (set it in hrms-frontend/.env).",
  );
}
const apiProxyTarget = apiProxyTargetRaw.replace(/\/$/, "");

/** This app lives in a subdirectory of the git repo; pin tracing to avoid parent node_modules. */
const appDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  // Hide the Next.js "N" badge (bottom-right) so it does not sit on the login form.
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  outputFileTracingRoot: appDirectory,
transpilePackages: [
    "country-state-city",
    "uqr",
    "@tanstack/react-table",
    "@tanstack/table-core",
    "@tanstack/react-store",
    "@tanstack/store",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  // Turbopack treats absolute alias targets as relative (`./Users/...`).
  // Pin the app root and alias with a project-relative path instead.
  turbopack: {
    root: appDirectory,
    resolveAlias: {
      "country-state-city": "./node_modules/country-state-city",
    },
  },
  async redirects() {
    return [
      {
        source: "/company",
        destination: "/company/overview",
        permanent: false,
      },
      {
        source: "/departments",
        destination: "/company/departments",
        permanent: false,
      },
      {
        source: "/locations",
        destination: "/company/locations",
        permanent: false,
      },
      {
        source: "/designations",
        destination: "/company/designations",
        permanent: false,
      },
      {
        source: "/dashboard",
        destination: "/",
        permanent: false,
      },
      {
        source: "/skills",
        destination: "/",
        permanent: false,
      },
      {
        source: "/company/skills",
        destination: "/",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
