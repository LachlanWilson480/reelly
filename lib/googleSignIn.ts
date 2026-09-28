type GoogleCredentialResponse = { credential: string }

type GoogleIdApi = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    nonce?: string
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

const SCRIPT_ID = 'google-gsi-script'

const sha256Hex = async (text: string) => {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const randomNonce = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const loadGoogleScript = (): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.google) {
      resolve()
      return
    }
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(script)
  })

export async function mountGoogleButton(options: {
  container: HTMLElement
  onCredential: (idToken: string, rawNonce: string) => void | Promise<void>
}): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('Google sign-in is not configured.')

  await loadGoogleScript()
  const google = window.google
  if (!google) throw new Error('Could not load Google sign-in.')

  const rawNonce = randomNonce()
  const hashedNonce = await sha256Hex(rawNonce)

  google.accounts.id.initialize({
    client_id: clientId,
    nonce: hashedNonce,
    use_fedcm_for_prompt: true,
    callback: (response) => {
      void options.onCredential(response.credential, rawNonce)
    },
  })

  options.container.innerHTML = ''
  google.accounts.id.renderButton(options.container, {
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 320,
  })
}
