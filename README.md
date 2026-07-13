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

## Tools

- `get_balance` — check your prepaid balance.
- `submit_query` — ask real humans a question (16 query types: A/B test, rating, ranking, sentiment, yes/no, image/video/audio review, voice/video/photo capture, …). Returns a `query_id`.
- `get_responses` — fetch the human answers for a query.
- `wait_for_responses` — poll (bounded) until enough humans answer; call again while it returns `pending`.
- `list_queries` — your recent queries.
- `rate_response` — rate a worker's answer 1–5.

## Example agent flow

1. `get_balance` → ensure funds.
2. `submit_query` → get `query_id`.
3. `wait_for_responses` (repeat while `pending`) → read the human answers.

Full API docs: https://getabrain.ai/docs/api
