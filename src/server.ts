import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetABrain } from '@getabrain/sdk'
import { tools } from './tools'
import { toToolError } from './result'

// Builds the MCP server and registers every tool. This is the ONLY file that
// depends on @modelcontextprotocol/sdk — if the installed SDK version requires
// `server.registerTool(name, { description, inputSchema }, handler)` instead of
// the `server.tool(name, description, shape, handler)` form below, adapt only here.
export function createServer(client: GetABrain): McpServer {
  const server = new McpServer({ name: 'getabrain', version: '0.1.0' })
  for (const t of tools) {
    server.tool(t.name, t.description, t.inputShape, async (args: any): Promise<any> => {
      try {
        return await t.run(args, client)
      } catch (e) {
        return toToolError(e)
      }
    })
  }
  return server
}
