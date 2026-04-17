import type { NextConfig } from "next";

import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_BUILD_STAMP: new Date().toISOString(),
  },
};

export default nextConfig;
