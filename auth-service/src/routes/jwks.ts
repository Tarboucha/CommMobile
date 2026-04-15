import type { FastifyInstance } from 'fastify'
import { loadKeys } from '../keys.js'

export async function jwksRoutes(fastify: FastifyInstance) {
  fastify.get('/.well-known/jwks.json', async () => {
    const { publicKeyJwk } = await loadKeys()
    return {
      keys: [{ ...publicKeyJwk, use: 'sig', alg: 'ES256', kid: 'kodo-1' }],
    }
  })
}
