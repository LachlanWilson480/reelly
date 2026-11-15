import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// One config file. Next reads next.config.js before next.config.ts, so while both existed the security
// headers below were never sent. The storage rewrite that lived in next.config.js is merged in here.

// Who the browser may talk to. Supabase (database, storage, sign-in), Stripe (checkout),
// Google (sign-in button), Vercel (analytics) and the Railway render server (only if a finished
// video could not be copied to Supabase and is served straight from there).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.js.stripe.com https://accounts.google.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://accounts.google.com https://vitals.vercel-insights.com https://*.up.railway.app",
  "frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  // Lets the browser read library clips through our own address, because fetching them straight from Supabase gets blocked (CORS)
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    return base ? [{ source: '/sb-storage/:path*', destination: `${base}/storage/v1/:path*` }] : []
  },
  async redirects() {
    return [
      { source: '/dashboard', missing: [{ type: 'query' as const, key: 'tab' }], destination: '/dashboard/overview', permanent: false },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ]
  },
};

// Error tracking. Errors go through /monitoring on our own site, so the security policy above
// needs no changes and ad blockers don't drop them. Source maps are only uploaded when
// SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set in Vercel; without them the build still works.
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/uploading/bundler-plugin-options/

  org: "reelezy",

  project: "reelly",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
