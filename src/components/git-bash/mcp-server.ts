import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export function startGitBashServer() {
  const server = new Server({ name: 'git_bash', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'git_bash_exec', description: 'Execute a command in Git Bash', inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === 'git_bash_exec') {
      return { content: [{ type: 'text', text: 'not implemented on this platform' }] };
    }
    return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
}
