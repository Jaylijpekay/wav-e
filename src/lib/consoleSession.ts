type ConsoleSessionPayload = {
  type: 'trainer' | 'management'
  id: string
  exp: number
}

const encoder = new TextEncoder()

const base64UrlEncode = (input: string | Uint8Array) => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const base64UrlDecode = (input: string) => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - input.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

const getSecret = () => {
  const secret = process.env.CONSOLE_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('CONSOLE_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY is required')
  return secret
}

const sign = async (payload: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return base64UrlEncode(new Uint8Array(signature))
}

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export const createConsoleSession = async (
  type: ConsoleSessionPayload['type'],
  id: string,
  maxAgeSeconds: number
) => {
  const payload = base64UrlEncode(JSON.stringify({
    type,
    id,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  } satisfies ConsoleSessionPayload))
  return `${payload}.${await sign(payload)}`
}

export const verifyConsoleSession = async (cookieValue: string | undefined) => {
  if (!cookieValue) return null

  const [payload, signature] = cookieValue.split('.')
  if (!payload || !signature) return null
  if (!timingSafeEqual(signature, await sign(payload))) return null

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as Partial<ConsoleSessionPayload>
    if (session.type !== 'trainer' && session.type !== 'management') return null
    if (!session.id || typeof session.id !== 'string') return null
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null
    return session as ConsoleSessionPayload
  } catch {
    return null
  }
}
