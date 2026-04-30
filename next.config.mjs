/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // CSV de Blip puede llegar a 25MB+ en meses con alto volumen.
    proxyClientMaxBodySize: '64mb',
    serverActions: { bodySizeLimit: '64mb' },
  },
};

export default nextConfig;
