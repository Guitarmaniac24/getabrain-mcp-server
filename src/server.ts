import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetABrain } from '@getabrain/sdk'
import { tools } from './tools'
import { toToolError } from './result'

// Builds the MCP server and registers every tool via `server.registerTool`, which
// carries outputSchema + annotations (unlike the older `server.tool` form). This is
// the ONLY file that depends on @modelcontextprotocol/sdk -- if a future SDK version
// changes this registration contract, adapt only here.
export function createServer(client: GetABrain): McpServer {
  const server = new McpServer({ name: 'getabrain', version: '0.1.0' })
  for (const t of tools) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.inputShape, outputSchema: t.outputShape, annotations: t.annotations },
      async (args: any): Promise<any> => {
        try {
          return await t.run(args, client)
        } catch (e) {
          return toToolError(e)
        }
      },
    )
  }
  return server
}
