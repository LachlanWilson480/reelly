// What Sentry may collect. Kept small on purpose: no names, emails, cookies, headers,
// request bodies (which could hold scripts, captions or business details) or AI prompts.
export const SENTRY_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  genAI: { inputs: false, outputs: false },
}
