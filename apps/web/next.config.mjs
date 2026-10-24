// One .env at the repository root serves every app.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env: rely on the environment (CI, Docker, hosting).
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    '@lcg/db',
    '@lcg/domain',
    '@lcg/generation',
    '@lcg/lesson-schema',
    '@lcg/outline',
    '@lcg/queue',
    '@lcg/session',
    '@lcg/standards',
  ],
  serverExternalPackages: ['pg', 'pg-boss', 'exceljs'],
  experimental: {
    // Uploaded Outlines (up to 5 MB) and import proposals travel through server actions.
    serverActions: { bodySizeLimit: '10mb' },
  },
  webpack(config) {
    // Package sources import siblings as "./x.js"; resolve those to the .ts files.
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};

export default nextConfig;
