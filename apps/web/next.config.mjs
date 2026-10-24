// One .env at the repository root serves every app.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env: rely on the environment (CI, Docker, hosting).
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@lcg/db', '@lcg/domain', '@lcg/lesson-schema', '@lcg/outline', '@lcg/session', '@lcg/standards'],
  serverExternalPackages: ['pg', 'exceljs'],
  webpack(config) {
    // Package sources import siblings as "./x.js"; resolve those to the .ts files.
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};

export default nextConfig;
