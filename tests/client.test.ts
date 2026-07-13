import { describe, it, expect } from 'vitest'
import { createClient } from '../src/client'
import { GetABrain } from '@getabrain/sdk'

describe('createClient', () => {
  it('throws when credentials are missing', () => {
    expect(() => createClient({} as any)).toThrow(/GETABRAIN_API_KEY/)
  })

  it('builds a GetABrain client when env is present', () => {
    const c = createClient({ GETABRAIN_API_KEY: 'gab_k_x', GETABRAIN_API_SECRET: 'gab_s_y' } as any)
    expect(c).toBeInstanceOf(GetABrain)
    expect(c.queries).toBeTruthy()
    expect(c.account).toBeTruthy()
  })
})
