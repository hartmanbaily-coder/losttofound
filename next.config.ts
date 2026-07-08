import type { NextConfig } from "next";

const projectRoot = process.cwd();
const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSrc = ["script-src", "'self'", "'unsafe-inline'", ...(isDevelopment ? ["'unsafe-eval'"] : [])];

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          scriptSrc.join(" "),
          "connect-src 'self'",
        ].join("; "),
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
      },
      { key: "X-Frame-Options", value: "DENY" },
    ];

    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache, max-age=0" }],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
