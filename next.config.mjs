import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads its built-in .afm font metrics from disk relative to its own
  // directory. When webpack bundles it, that path breaks (ENOENT on
  // Helvetica.afm), so keep it as a native runtime require.
  serverExternalPackages: ['pdfkit'],
};

export default withPWA(nextConfig);
