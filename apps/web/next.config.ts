import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@gitpulse/agent-core", "@gitpulse/schemas"],
};

export default config;
