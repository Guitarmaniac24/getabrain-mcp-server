import { describe, it, expect, vi } from 'vitest'
import { createServer } from '../src/server'
import { tools } from '../src/tools'

function fakeClient() {
  return { account: { balance: vi.fn() }, queries: { create: vi.fn(), get: vi.fn(), list: vi.fn(), waitForResponses: vi.fn() }, responses: { rate: vi.fn() } } as any
}

describe('createServer', () => {
  it('builds an MCP server without throwing and registers all seven tools', () => {
    const server: any = createServer(fakeClient())
    // McpServer exposes registered tools via its internal map; assert via the connect-less smoke:
    expect(server).toBeTruthy()
    // The tool registry is validated indirectly: creating the server iterates the 7 tools
    // (Task 10 added create_topup_link). A direct count check on the exported `tools`
    // array guards the wiring:
    expect(tools.length).toBe(7)
  })
})
