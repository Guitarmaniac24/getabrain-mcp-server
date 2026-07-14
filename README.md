# @getabrain/mcp-server

MCP server for [GetABrain.ai](https://getabrain.ai) — give your AI agent real human judgment as native tools.

## Use with Claude Desktop / Cursor

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "getabrain": {
      "command": "npx",
      "args": ["-y", "@getabrain/mcp-server"],
      "env": {
        "GETABRAIN_API_KEY": "gab_k_…",
        "GETABRAIN_API_SECRET": "gab_s_…"
      }
    }
  }
}
```

Get your API key by signing up at https://getabrain.ai.

## Test mode

Test mode is a flag on the key, not a different key format. When you mint an API key — via
`POST /api/v1/requestor/keys` with `{"mode":"test"}`, or by choosing "test" in the dashboard — you get
back a completely normal `gab_k_…` / `gab_s_…` key pair. There's no `_test_` in the string; the
test-ness lives in the database as an `is_test` flag on that key. No funding or card required.

Point `GETABRAIN_API_KEY` / `GETABRAIN_API_SECRET` at a test-mode key and the server behaves identically, except:

- `submit_query` never touches your balance — no charge, no `insufficient_balance` errors.
- Responses come back synthetic and are always marked **`simulated: true`**, so your pipeline (submit →
  wait/poll → rate) can be built and exercised end-to-end before any real human worker or real money is
  involved.
- `get_balance` reports `mode: "test"` so the agent/human can tell at a glance which environment it's in.

When you're ready to go live: mint a **live-mode key** (same call, `{"mode":"live"}` or the dashboard
default), fund the account with `create_topup_link` (works with either key type — a test-mode agent can
generate the link, a human completes checkout to add real funds), and swap the env vars. `get_balance`
then reports `mode: "live"`, and `submit_query` starts spending real balance and dispatching to real paid
workers.

## Tools

- `get_balance` — read-only: prepaid balance (cents), `mode` (`"test"`/`"live"`), and `auto_reload_enabled`
  (with a setup link + hint when it's off and would otherwise stall a live account at zero balance).
- `create_topup_link` — mints a Stripe Checkout URL to add funds (min $5); a human opens it in a browser to
  pay — the agent cannot complete payment itself.
- `submit_query` — ask real humans a question (16 query types: A/B test, rating, ranking, sentiment, yes/no,
  image/video/audio review, voice/video/photo capture, …). Returns a `query_id`. Spends balance on a live
  key; free and `simulated: true` on a test key.
- `get_responses` — one-shot, read-only: current status + whatever responses exist right now, no waiting.
- `wait_for_responses` — bounded polling (up to `max_wait_seconds`, default/max 50s); returns `ready` with
  responses once enough arrive, or `pending` — call again to keep waiting. Use this instead of `get_responses`
  when you want the tool call itself to wait.
- `list_queries` — read-only: your recent queries, optionally filtered by `status`.
- `rate_response` — rate a worker's answer 1–5 (optional `feedback_text`); feeds the worker quality system.

## Example agent flow

1. `get_balance` → confirm funds (or `mode: "test"` for a free sandbox run).
2. If funds are short on a live key: `create_topup_link` → human completes checkout → `get_balance` again.
3. `submit_query` → get `query_id`.
4. `wait_for_responses` (repeat while `pending`) → read the human (or simulated, in test mode) answers.
5. `rate_response` → optionally rate each response to improve future worker matching.

Full API docs: https://getabrain.ai/docs/api
