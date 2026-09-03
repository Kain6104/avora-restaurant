import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép tất cả subdomain của ngrok
  allowedDevOrigins: ['*.ngrok-free.app', 'localhost:3000'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;