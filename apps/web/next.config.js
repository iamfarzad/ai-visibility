/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Static export for Vercel
  images: { unoptimized: true },
};

module.exports = nextConfig;
