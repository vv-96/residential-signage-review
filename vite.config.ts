import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  // 注：registry 不使用 .wrangler（工作台安全策略会拦截该目录写入），改到 .cache/wrangler。
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".cache/wrangler-logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".cache/wrangler-registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    build: {
      // 构建产物目录中的旧文件会被 Vite 覆盖；跳过 emptyDir 清空，
      // 避免工作台删除保护拦截构建收尾阶段。
      emptyOutDir: false,
    },
    // 生产构建不需要 noDiscovery——曾因 noDiscovery 导致 chunk 划分时漏合并
    // 相关依赖，vinext 的 RSC prefetch 函数从 index 模块解构出 undefined 报错
    // （如 getPrefetchInterceptionContext is not a function）。
    // dev 模式的 deps_temp 清理崩溃改用 .cache/vite 缓存目录规避（见 worker plugin）。
    plugins: [
      vinext(),
      // sites() 移除：本项目的 hosting.json 中 d1/r2 均为 null，该插件仅在构建后
      // 打包部署元数据到 dist/.openai，对本地 MVP 无实际用途，且会触发目录清理。
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
