import type { NextConfig } from "next";
import { version } from "./src-tauri/tauri.conf.json";

const isProd = process.env.NODE_ENV === 'production';

const internalHost = process.env.TAURI_DEV_HOST || 'localhost';

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: "export",
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:3456`,
  devIndicators: {
  },
  sassOptions: {
    silenceDeprecations: ['legacy-js-api'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
