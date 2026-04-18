import { generateKeyPair, exportJWK, importJWK } from 'jose'

export interface KeyPair {
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyJwk: Record<string, unknown>
}

let _keys: KeyPair | null = null

export async function loadKeys(): Promise<KeyPair> {
  if (_keys) return _keys

  if (process.env.AUTH_PRIVATE_KEY && process.env.AUTH_PUBLIC_KEY) {
    const privateKey = (await importJWK(
      JSON.parse(process.env.AUTH_PRIVATE_KEY),
      'ES256'
    )) as CryptoKey

    const publicKey = (await importJWK(
      JSON.parse(process.env.AUTH_PUBLIC_KEY),
      'ES256'
    )) as CryptoKey

    const publicKeyJwk = JSON.parse(process.env.AUTH_PUBLIC_KEY) as Record<string, unknown>

    _keys = { privateKey, publicKey, publicKeyJwk }
    return _keys
  }

  // First run — generate and print to stdout so you can save to .env
  console.warn('⚠️  AUTH_PRIVATE_KEY not set — generating ephemeral keys (not for production)')
  console.warn('    Copy the values below into your .env file:\n')

  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
  const privateJwk = await exportJWK(privateKey)
  const publicJwk = await exportJWK(publicKey)

  console.log(`AUTH_PRIVATE_KEY='${JSON.stringify(privateJwk)}'`)
  console.log(`AUTH_PUBLIC_KEY='${JSON.stringify(publicJwk)}'\n`)

  _keys = {
    privateKey,
    publicKey,
    publicKeyJwk: publicJwk as Record<string, unknown>,
  }
  return _keys
}
