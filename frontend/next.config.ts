import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép tất cả subdomain của ngrok
  allowedDevOrigins: ['*.ngrok-free.app', 'localhost:3000', 'localhost:4000'],
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
        destination: 'http://127.0.0.1:4001/api/:path*',
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://127.0.0.1:4001/socket.io/:path*',
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/profile/saved-articles',
        destination: '/favorites?tab=articles',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;