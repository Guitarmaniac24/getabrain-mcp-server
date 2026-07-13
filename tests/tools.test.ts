import { describe, it, expect, vi } from 'vitest'
import { tools } from '../src/tools'
import { TimeoutError } from '@getabrain/sdk'

function byName(name: string) {
  const t = tools.find((x) => x.name === name)
  if (!t) throw new Error(`tool ${name} not found`)
  return t
}

function fakeClient(overrides: any = {}) {
  return {
    account: { balance: vi.fn(async () => ({ balance_cents: 500, company_name: 'X' })), ...overrides.account },
    queries: {
      create: vi.fn(async () => ({ id: 'q1', status: 'active', total_cost_cents: 100 })),
      get: vi.fn(async () => ({ status: 'active', completed_responses: 0, required_responses: 2, responses: [] })),
      list: vi.fn(async () => ({ queries: [], total: 0, has_more: false })),
      waitForResponses: vi.fn(async () => [{ id: 'r1', response_data: { answer: 'yes' }, status: 'accepted', submitted_at: 't' }]),
      ...overrides.queries,
    },
    responses: { rate: vi.fn(async () => ({ response_id: 'r1', score: 5, worker_new_quality_score: 4.8, worker_suspended: false })), ...overrides.responses },
  } as any
}

describe('tools', () => {
  it('exposes exactly the six expected tools', () => {
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['get_balance', 'get_responses', 'list_queries', 'rate_response', 'submit_query', 'wait_for_responses']
    )
  })

  it('get_balance returns the balance', async () => {
    const c = fakeClient()
    const r = await byName('get_balance').run({}, c)
    expect(c.account.balance).toHaveBeenCalled()
    expect(JSON.parse(r.content[0].text).balance_cents).toBe(500)
  })

  it('submit_query passes args to queries.create', async () => {
    const c = fakeClient()
    const args = { type: 'yes_no', title: 'Hello?', content_data: { question: 'ok?' }, required_responses: 1, bid_amount_cents: 5 }
    const r = await byName('submit_query').run(args, c)
    expect(c.queries.create).toHaveBeenCalledWith(args)
    expect(JSON.parse(r.content[0].text).id).toBe('q1')
  })

  it('get_responses summarizes the query', async () => {
    const c = fakeClient()
    const r = await byName('get_responses').run({ query_id: 'q1' }, c)
    expect(c.queries.get).toHaveBeenCalledWith('q1')
    expect(JSON.parse(r.content[0].text)).toMatchObject({ status: 'active', required_responses: 2 })
  })

  it('rate_response calls responses.rate with the score', async () => {
    const c = fakeClient()
    await byName('rate_response').run({ query_id: 'q1', response_id: 'r1', score: 5, feedback_text: 'good' }, c)
    expect(c.responses.rate).toHaveBeenCalledWith('q1', 'r1', { score: 5, feedback_text: 'good' })
  })

  it('wait_for_responses returns ready when responses arrive', async () => {
    const c = fakeClient()
    const r = await byName('wait_for_responses').run({ query_id: 'q1', min_responses: 1, max_wait_seconds: 1 }, c)
    expect(JSON.parse(r.content[0].text).status).toBe('ready')
  })

  it('wait_for_responses returns pending when the bounded wait times out', async () => {
    const c = fakeClient({ queries: { waitForResponses: vi.fn(async () => { throw new TimeoutError() }) } })
    const r = await byName('wait_for_responses').run({ query_id: 'q1', min_responses: 2, max_wait_seconds: 1 }, c)
    const out = JSON.parse(r.content[0].text)
    expect(out.status).toBe('pending')
    expect(out.hint).toMatch(/again/i)
  })
})
