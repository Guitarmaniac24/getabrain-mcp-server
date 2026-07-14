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
    description:
      'Check the prepaid balance (in cents) available to fund submit_query calls, plus account mode. ' +
      'Call before submit_query if unsure funds suffice, or whenever a query fails/stalls for balance reasons. ' +
      'Read-only, no side effects, free in test and live mode. Response includes mode ("test" = sandbox key, ' +
      'free simulated responses; "live" = real key, real spend), and when relevant whether auto_reload is on, ' +
      'plus an auto_reload_setup_url + hint to enable it so a live account does not stall at zero balance. ' +
      'Disambiguation: reports funds available to spend; does not list queries (list_queries) or responses ' +
      '(get_responses/wait_for_responses).',
    inputShape: {},
    run: async (_args, client) => {
      const b = await client.account.balance()
      return ok({
        balance_cents: b.balance_cents,
        company_name: b.company_name,
        ...(b.mode !== undefined ? { mode: b.mode } : {}),
        ...(b.auto_reload_enabled !== undefined ? { auto_reload_enabled: b.auto_reload_enabled } : {}),
        ...(b.auto_reload_setup_url !== undefined ? { auto_reload_setup_url: b.auto_reload_setup_url } : {}),
        ...(b.hint !== undefined ? { hint: b.hint } : {}),
      })
    },
  },
  {
    name: 'create_topup_link',
    description:
      'Generate a one-time Stripe Checkout URL for adding funds to the prepaid balance. ' +
      'Use when get_balance shows insufficient funds for an upcoming submit_query, or a human asks to add money. ' +
      'Side effect: creates a pending Stripe session (no charge yet); the returned checkout_url must be OPENED IN ' +
      'A BROWSER BY A HUMAN to enter payment details and complete the charge -- the agent cannot complete payment ' +
      'itself; this is an out-of-band, human-in-the-loop step. Works with a test-mode or live-mode key (funding a ' +
      'test-mode account is how you move a sandbox integration to real spending power). Balance updates only after ' +
      'checkout completes; poll get_balance to confirm. Disambiguation: only mints a payment link -- never moves ' +
      'money or blocks waiting for payment itself.',
    inputShape: {
      amount_cents: z
        .number()
        .int()
        .min(500)
        .max(10000000)
        .describe(
          'Amount to add to the prepaid balance, in whole cents (min 500 = $5.00, max 10000000 = $100,000.00). ' +
            'E.g. 5000 = $50.00.'
        ),
    },
    run: async (args, client) => ok(await client.account.createTopupLink(args.amount_cents)),
  },
  {
    name: 'submit_query',
    description:
      'Submit a structured question to real human workers, returning a query_id -- the entry point for any ' +
      'human-in-the-loop (HITL) step: judgment calls, subjective evaluation, approval/review, or "ask a real person" ' +
      `tasks a model should not answer itself. "type" selects the question format (one of: ${QUERY_TYPES.join(', ')}); ` +
      '"content_data" is the matching type-specific payload (e.g. ab_test: {question, variant_a:{description}, ' +
      'variant_b:{description}}; yes_no: {question}; rating_scale: {question, scale_type, scale_min, scale_max}). ' +
      'Cost/side effects: with a LIVE key this deducts (bid_amount_cents + bonus_amount_cents) * required_responses ' +
      'from balance immediately and dispatches to paid workers (fails if balance too low -- check get_balance or use ' +
      'create_topup_link). With a TEST key, no balance is touched and responses are synthetic, marked simulated: ' +
      'true, so you can build/test a full pipeline for free before going live. Returns immediately, does not wait -- ' +
      'use get_responses (one-shot) or wait_for_responses (bounded polling) to retrieve answers.',
    inputShape: {
      type: z
        .enum(QUERY_TYPES as unknown as [string, ...string[]])
        .describe(`Question format/template. One of: ${QUERY_TYPES.join(', ')}. Determines the required shape of content_data.`),
      title: z.string().min(5).max(255).describe('Short human-readable title for the query, shown to workers as the task headline (5-255 characters).'),
      content_data: z
        .record(z.any())
        .describe(
          'Type-specific payload whose required fields depend on "type" (e.g. {question, variant_a, variant_b} for ab_test; {question} for yes_no; ' +
            '{question, scale_type, scale_min, scale_max} for rating_scale). See the API docs for the full schema per type.'
        ),
      required_responses: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .describe('Number of distinct human worker responses to collect before the query is considered complete (1-1000).'),
      bid_amount_cents: z
        .number()
        .int()
        .min(5)
        .max(10000000)
        .describe(
          'Cents paid to EACH worker per accepted response (min 5 = $0.05, max 10000000 = $100,000.00). ' +
            'Total cost = (bid_amount_cents + bonus_amount_cents) * required_responses, deducted from balance in live mode. No charge occurs in test mode.'
        ),
      description: z.string().optional().describe('Optional longer explanation/context shown to workers alongside the title, for extra instructions or background.'),
      bonus_amount_cents: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Optional extra cents paid to EACH worker on top of bid_amount_cents per accepted response (default 0). Included in the total cost calculation.'),
      min_worker_quality: z
        .number()
        .min(0)
        .max(5)
        .optional()
        .describe('Optional minimum worker quality score (0-5) required to accept this query; higher restricts to more experienced/reliable workers.'),
    },
    run: async (args, client) => ok(await client.queries.create(args)),
  },
  {
    name: 'get_responses',
    description:
      'One-shot read: fetch a query\'s current status and whatever human responses have been submitted so far, without waiting. ' +
      'Use this to check progress on demand, or after wait_for_responses reports "pending" if you want an immediate snapshot instead of polling again. ' +
      'Read-only, no cost, returns instantly (does not block or retry). ' +
      'Disambiguation: unlike wait_for_responses, this never delays or blocks waiting for more answers to arrive -- it just reports what exists right now, ' +
      'which may be fewer than required_responses.',
    inputShape: {
      query_id: z.string().describe('The id returned by submit_query, identifying which query to read.'),
    },
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
      'Poll for human responses to a query, blocking for up to max_wait_seconds (default 50, max 50) before returning. ' +
      'Use right after submit_query to wait for real answers in one call instead of manually re-checking with get_responses. ' +
      'DOES NOT GUARANTEE COMPLETION -- if min_responses have not arrived within the time budget it returns status ' +
      '"pending" (with a hint to call again) rather than erroring; call again to keep waiting. Returns status "ready" ' +
      'with the responses array once enough have arrived (or the query otherwise completed). Read-only / free -- cost ' +
      'was already charged by submit_query. Disambiguation: unlike get_responses (instant, one-shot, may return 0 ' +
      'responses), this actively waits, trading time for a higher chance of a complete result.',
    inputShape: {
      query_id: z.string().describe('The id returned by submit_query, identifying which query to wait on.'),
      min_responses: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('How many responses must arrive before returning status "ready" (default: the query\'s required_responses).'),
      max_wait_seconds: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum seconds to poll before giving up and returning status "pending" if not enough responses arrived yet (default 50, max 50).'),
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
    description:
      'List your recent GetABrain queries, most recent first. Use this to get an overview of past/active queries, recover a query_id you lost track of, ' +
      'or filter by status (e.g. find everything still "active" or "pending"). Read-only, no cost. ' +
      'Disambiguation: this lists MANY queries at a summary level; it does not return the individual worker responses for any one query -- use ' +
      'get_responses or wait_for_responses with a specific query_id for that.',
    inputShape: {
      status: z
        .string()
        .optional()
        .describe('Optional filter to only return queries in this status (e.g. "active", "pending", "completed", "cancelled", "failed", "expired"). Omit to return all statuses.'),
      limit: z.number().int().min(1).max(100).optional().describe('Maximum number of queries to return, most recent first (1-100, default server-side).'),
    },
    run: async (args, client) => ok(await client.queries.list(args)),
  },
  {
    name: 'rate_response',
    description:
      "Rate a single worker's response 1-5 to feed the worker quality/reputation system, optionally with free-text " +
      'feedback. Use after reviewing a response from get_responses/wait_for_responses, to reward good answers and ' +
      "flag poor ones -- this affects the worker's quality score and future eligibility (e.g. queries with " +
      'min_worker_quality set) and can trigger rewards/suspension server-side. Side effect: writes a rating record ' +
      'and returns the updated worker quality score; does not resubmit or modify the original response. ' +
      'Disambiguation: rates a response you already have -- does not fetch new responses (use get_responses/' +
      'wait_for_responses first).',
    inputShape: {
      query_id: z.string().describe('The id of the query the response belongs to (from submit_query).'),
      response_id: z.string().describe('The id of the specific response to rate (from get_responses/wait_for_responses output).'),
      score: z.number().int().min(1).max(5).describe('Quality rating for the response, 1 (worst) to 5 (best). Feeds the worker\'s ongoing quality score.'),
      feedback_text: z.string().optional().describe('Optional free-text comment explaining the rating, visible to the worker.'),
    },
    run: async (args, client) =>
      ok(await client.responses.rate(args.query_id, args.response_id, { score: args.score, feedback_text: args.feedback_text })),
  },
]
