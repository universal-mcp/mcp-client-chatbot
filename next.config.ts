import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  cleanDistDir: true,
  devIndicators: {
    position: "bottom-right",
  },
  env: {
    NO_HTTPS: process.env.NO_HTTPS,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  },
  async rewrites() {
    return [
      {
        source: "/api/upload",
        destination: "https://6113a9808199.ngrok-free.app/api/upload",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
