/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Permissive remote-images config for now — covers Supabase Storage,
    // YouTube thumbnails, S3, Cloudinary, and the various external hosts
    // editors paste from. Tighten to a specific allowlist before launch.
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
