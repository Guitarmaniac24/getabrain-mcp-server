#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createClient } from './client'
import { createServer } from './server'

async function main(): Promise<void> {
  const client = createClient()
  const server = createServer(client)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // Server now runs over stdio until the transport closes.
}

main().catch((e) => {
  console.error(`getabrain-mcp failed to start: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
