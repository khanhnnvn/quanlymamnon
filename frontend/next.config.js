/** @type {import('next').NextConfig} */
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://127.0.0.1:8097';

const nextConfig = {
  // Tắt tính năng tự sinh AGENTS.md/CLAUDE.md của Next.js 16 - dự án này
  // không dùng các file hướng dẫn AI agent tự động đó.
  agentRules: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Backend Go/Gin router mounts routes under "/api/v1/..." itself
        // (ARCHITECTURE.md muc 5: "Base path: /api/v1"), so we forward the
        // full "/api/..." path through untouched, only swapping the host.
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
