import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    rules: {
      // 本项目因 vinext 1.0.0-beta.2 的 RSC prefetch bug（客户端引用 server-only
      // 函数，点击 next/link 报 "te is not a function"），全站统一用原生 <a>
      // 替代 next/link，导航为整页刷新（见各页面顶部注释）。故关闭该规则。
      // 等 vinext 修复后改回 <Link prefetch={false}> 并恢复此规则。
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
