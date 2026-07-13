import { z, type ZodRawShape } from 'zod'
import { QUERY_TYPES, TimeoutError, type GetABrain } from '@getabrain/sdk'
import { ok, type ToolResult } from './result'

export interface ToolDef {
  name: string
  description: string
  inputShape: ZodRawShape
  run: (args: any, client: GetABrain) => Promise<ToolResult>
}

export const tools: ToolDef[] = [
  {
    name: 'get_balance',
    description: 'Get the prepaid balance (in cents) available to fund GetABrain queries.',
    inputShape: {},
    run: async (_args, client) => {
      const b = await client.account.balance()
      return ok({ balance_cents: b.balance_cents, company_name: b.company_name })
    },
  },
  {
    name: 'submit_query',
    description:
      `Ask a human / add a human in the loop: submit a human-judgment query to real human workers and get its id back. ` +
      `Use this for any human-in-the-loop (HITL) step, human approval, or when your model needs a real human opinion. ` +
      `"type" is one of: ${QUERY_TYPES.join(', ')}. ` +
      `"content_data" is the type-specific payload (e.g. ab_test: {question, variant_a:{description}, variant_b:{description}}; ` +
      `yes_no: {question}; rating_scale: {question, scale_type, scale_min, scale_max}). ` +
      `Cost = (bid_amount_cents + bonus_amount_cents) * required_responses, deducted from your balance.`,
    inputShape: {
      type: z.enum(QUERY_TYPES as unknown as [string, ...string[]]),
      title: z.string().min(5).max(255),
      content_data: z.record(z.any()),
      required_responses: z.number().int().min(1).max(1000),
      bid_amount_cents: z.number().int().min(5).max(10000000),
      description: z.string().optional(),
      bonus_amount_cents: z.number().int().min(0).optional(),
      min_worker_quality: z.number().min(0).max(5).optional(),
    },
    run: async (args, client) => ok(await client.queries.create(args)),
  },
  {
    name: 'get_responses',
    description: 'Get a query and the human responses submitted so far.',
    inputShape: { query_id: z.string() },
    run: async (args, client) => {
      const q = await client.queries.get(args.query_id)
      return ok({
        status: q.status,
        completed_responses: q.completed_responses,
        required_responses: q.required_responses,
        responses: q.responses ?? [],
      })
    },
  },
  {
    name: 'wait_for_responses',
    description:
      'Poll for up to max_wait_seconds (default 50) for human responses to a query. ' +
      'Returns status "ready" with the responses if enough arrived, otherwise status "pending" — call again to keep waiting.',
    inputShape: {
      query_id: z.string(),
      min_responses: z.number().int().min(1).optional(),
      max_wait_seconds: z.number().int().min(1).max(50).optional(),
    },
    run: async (args, client) => {
      const current = await client.queries.get(args.query_id)
      const minResponses = args.min_responses ?? current.required_responses
      try {
        const responses = await client.queries.waitForResponses(args.query_id, {
          minResponses,
          timeoutMs: (args.max_wait_seconds ?? 50) * 1000,
          pollIntervalMs: 5000,
        })
        return ok({ status: 'ready', responses })
      } catch (e) {
        if (!(e instanceof TimeoutError)) throw e
        const q = await client.queries.get(args.query_id)
        if (q.status === 'completed' || (q.completed_responses ?? 0) >= minResponses) {
          return ok({ status: 'ready', responses: q.responses ?? [] })
        }
        return ok({
          status: 'pending',
          completed_responses: q.completed_responses ?? 0,
          required_responses: q.required_responses,
          hint: 'Call wait_for_responses again to keep waiting for more human answers.',
        })
      }
    },
  },
  {
    name: 'list_queries',
    description: 'List your recent GetABrain queries (most recent first).',
    inputShape: {
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    run: async (args, client) => ok(await client.queries.list(args)),
  },
  {
    name: 'rate_response',
    description: "Rate a worker's response 1-5 (feeds the quality system). Optionally include feedback_text.",
    inputShape: {
      query_id: z.string(),
      response_id: z.string(),
      score: z.number().int().min(1).max(5),
      feedback_text: z.string().optional(),
    },
    run: async (args, client) =>
      ok(await client.responses.rate(args.query_id, args.response_id, { score: args.score, feedback_text: args.feedback_text })),
  },
]
