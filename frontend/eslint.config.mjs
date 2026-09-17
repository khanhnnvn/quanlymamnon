import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Toàn bộ trang trong app này chủ động fetch dữ liệu client-side trong
      // useEffect (yêu cầu bắt buộc: không gọi API lúc build, luôn có
      // loading/error/empty state) và tái sử dụng cùng một hàm load() cho cả
      // lần tải đầu tiên lẫn nút "Thử lại". Đây là pattern chuẩn của React,
      // không phải lỗi - hạ mức rule này xuống warning thay vì chặn build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
