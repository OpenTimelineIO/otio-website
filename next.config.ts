import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
//   cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  transpilePackages: [
    "remark-gfm",
    "remark-breaks",
    "rehype-raw",
    "rehype-slug",
    "rehype-autolink-headings",
    "mdast-util-gfm",
    "mdast-util-to-markdown",
    "micromark-extension-gfm",
    "unified",
    "remark",
    "remark-parse",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cezanne.studio",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "*.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
