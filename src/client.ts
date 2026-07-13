import { GetABrain } from '@getabrain/sdk'

export function createClient(env: Record<string, string | undefined> = process.env): GetABrain {
  const apiKey = env.GETABRAIN_API_KEY
  const apiSecret = env.GETABRAIN_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('GETABRAIN_API_KEY and GETABRAIN_API_SECRET environment variables are required.')
  }
  return new GetABrain({ apiKey, apiSecret, baseUrl: env.GETABRAIN_BASE_URL })
}
