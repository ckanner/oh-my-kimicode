import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildIndex, loadIndex, saveIndex } from './indexer.js';
import { search, relate } from './search.js';

const projectDir = process.env.OMO_KIMI_PROJECT ?? process.cwd();

function ensureIndex() {
  let index = loadIndex(projectDir);
  if (!index) {
    index = buildIndex(projectDir);
    saveIndex(projectDir, index);
  }
  return index;
}

function startCodegraphServer() {
  const server = new Server({ name: 'codegraph', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'codegraph_search', description: 'Structural code search', inputSchema: { type: 'object', properties: { query: { type: 'string' }, kind: { type: 'string' }, file: { type: 'string' } }, required: ['query'] } },
      { name: 'codegraph_relate', description: 'Find symbols in files related to a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'codegraph_reindex', description: 'Rebuild the CodeGraph index', inputSchema: { type: 'object', properties: {}, required: [] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      if (req.params.name === 'codegraph_search') {
        const args = req.params.arguments;
        const index = ensureIndex();
        const results = search(index, { query: args.query, kind: args.kind, file: args.file });
        return { content: [{ type: 'text', text: JSON.stringify({ results }) }] };
      }
      if (req.params.name === 'codegraph_relate') {
        const args = req.params.arguments;
        const index = ensureIndex();
        const results = relate(index, args.symbol);
        return { content: [{ type: 'text', text: JSON.stringify({ results }) }] };
      }
      if (req.params.name === 'codegraph_reindex') {
        const index = buildIndex(projectDir);
        saveIndex(projectDir, index);
        return { content: [{ type: 'text', text: JSON.stringify({ symbolCount: index.symbols.length }) }] };
      }
      return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
    } catch (err) {
      return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
}

startCodegraphServer();
