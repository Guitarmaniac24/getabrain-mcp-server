import { describe, it, expect } from 'vitest'
import { ok, fail, toToolError } from '../src/result'
import { InsufficientBalanceError, AuthError, ValidationError, RateLimitError, NotFoundError, GetABrainError } from '@getabrain/sdk'

describe('result helpers', () => {
  it('ok wraps data as JSON text with no isError', () => {
    const r = ok({ a: 1 })
    expect(r.content[0]).toEqual({ type: 'text', text: '{"a":1}' })
    expect(r.isError).toBeUndefined()
  })

  it('ok passes a string through verbatim', () => {
    expect(ok('hi').content[0].text).toBe('hi')
  })

  it('fail sets isError and the message', () => {
    const r = fail('boom')
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toBe('boom')
  })

  it('toToolError maps each SDK error to an actionable message', () => {
    expect(toToolError(new InsufficientBalanceError('x', 402, 'e')).content[0].text).toMatch(/Insufficient balance/i)
    expect(toToolError(new AuthError('x', 401, 'e')).content[0].text).toMatch(/credentials/i)
    expect(toToolError(new RateLimitError('x', 429, 'e', 5000)).content[0].text).toMatch(/Retry in 5s/)
    expect(toToolError(new ValidationError('bad field', 400, 'e')).content[0].text).toMatch(/bad field/)
    expect(toToolError(new NotFoundError('x', 404, 'e')).content[0].text).toMatch(/not found/i)
    expect(toToolError(new GetABrainError('weird', 418, 'e')).content[0].text).toMatch(/418/)
    expect(toToolError(new Error('plain')).content[0].text).toMatch(/plain/)
  })

  it('every toToolError result is an error result', () => {
    expect(toToolError(new AuthError('x', 401, 'e')).isError).toBe(true)
  })
})
