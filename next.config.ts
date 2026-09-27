import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.133', 'localhost'],
  experimental: {
    // Foto del menu fino a 2MB: margine per l'overhead multipart
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
};

export default withNextIntl(nextConfig);
