import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/console', destination: '/lgu', permanent: false },
      { source: '/console/:path*', destination: '/lgu', permanent: false },
      { source: '/services', destination: '/citizen/services', permanent: true },
      { source: '/lgus/:path*', destination: '/citizen/lgus/:path*', permanent: true },
      { source: '/apply/:path*', destination: '/citizen/apply/:path*', permanent: true },
      { source: '/pay/:path*', destination: '/citizen/pay/:path*', permanent: true },
      { source: '/requests', destination: '/citizen/requests', permanent: true },
      { source: '/track/:path*', destination: '/citizen/track/:path*', permanent: true },
    ]
  },
};

export default nextConfig;
