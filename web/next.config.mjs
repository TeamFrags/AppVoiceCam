/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the site is plain files, served by any web host (Apache at IONOS today).
  // Keep the code free of server-only features so this option stays removable, not required.
  output: 'export',
  // /pricing/ becomes pricing/index.html, which Apache serves without rewrite rules.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Each language has its own root layout, so the 404 page brings its own document
  // (src/app/global-not-found.tsx).
  experimental: { globalNotFound: true },
  // Linting runs once for the whole repository (`npm run lint`).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
