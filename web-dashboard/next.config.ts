import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3001/socket.io/:path*",
      },
    ];
  },
};

export default nextConfig;
