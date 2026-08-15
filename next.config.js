/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Unique per build/deploy. Embedded into the served service worker so its
    // bytes change on every deploy, which is what makes browsers install the
    // new worker and swap the PWA to the fresh build automatically.
    NEXT_PUBLIC_KINOS_BUILD_ID: String(Date.now()),
  },
};
module.exports = nextConfig;
