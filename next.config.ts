import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/*": ["./certs/supabase-prod-ca-2021.crt"] },
};

export default nextConfig;
