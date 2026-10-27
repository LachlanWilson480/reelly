module.exports = {
  // Lets the browser read library clips through our own address, because fetching them straight from Supabase gets blocked (CORS)
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    return base ? [{ source: '/sb-storage/:path*', destination: `${base}/storage/v1/:path*` }] : []
  },
}
