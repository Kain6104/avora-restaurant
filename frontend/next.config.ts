import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép tất cả subdomain của ngrok
  allowedDevOrigins: ['*.ngrok-free.app', 'localhost:3000'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;