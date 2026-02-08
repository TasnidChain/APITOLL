/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@apitoll/shared'],
}

module.exports = nextConfig
