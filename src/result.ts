import {
  InsufficientBalanceError, AuthError, ValidationError, RateLimitError, NotFoundError, GetABrainError,
} from '@getabrain/sdk'

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export function ok(data: unknown): ToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  const res: ToolResult = { content: [{ type: 'text', text }] }
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    res.structuredContent = data as Record<string, unknown>
  }
  return res
}

export function fail(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

export function toToolError(e: unknown): ToolResult {
  if (e instanceof InsufficientBalanceError)
    return fail('Insufficient balance. Add funds at https://getabrain.ai before submitting more queries.')
  if (e instanceof AuthError)
    return fail('Invalid GetABrain API credentials — check GETABRAIN_API_KEY / GETABRAIN_API_SECRET.')
  if (e instanceof RateLimitError)
    return fail(`Rate limited. Retry in ${Math.ceil((e.retryAfterMs ?? 1000) / 1000)}s.`)
  if (e instanceof ValidationError)
    return fail(`Invalid request: ${e.message}`)
  if (e instanceof NotFoundError)
    return fail('Not found: the query or response does not exist.')
  if (e instanceof GetABrainError)
    return fail(`GetABrain request failed (${e.status}): ${e.message}`)
  return fail(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`)
}
