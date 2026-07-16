import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server (HMR + client hydration) to work when accessed
  // through a Cloudflare quick tunnel (random *.trycloudflare.com host).
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
