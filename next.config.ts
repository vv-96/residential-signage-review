import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    // 允许上传较大的标识方案 PDF（默认 1MB 会被 413 拦截）。
    // analyze 路由自身仍校验 50MB 上限。
    serverActions: {
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
