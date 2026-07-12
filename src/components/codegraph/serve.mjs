import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildIndex, loadIndex, saveIndex } from './indexer.js';
import { search, relate, explore, files, callers, callees, impact } from './search.js';
import { VERSION } from '../../shared/version.js';
import { getProjectDir } from '../../shared/env.js';

const projectDir = getProjectDir();

function ensureIndex() {
  let index = loadIndex(projectDir);
  if (!index) {
    index = buildIndex(projectDir);
    saveIndex(projectDir, index);
  }
  return index;
}

function startCodegraphServer() {
  const server = new Server({ name: 'codegraph', version: VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: 'codegraph_search', description: 'Structural code search', inputSchema: { type: 'object', properties: { query: { type: 'string' }, kind: { type: 'string' }, file: { type: 'string' } }, required: ['query'] } },
      { name: 'codegraph_relate', description: 'Find symbols in files related to a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'codegraph_reindex', description: 'Rebuild the CodeGraph index', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'codegraph_status', description: 'CodeGraph index status', inputSchema: { type: 'object', properties: {}, required: [] } },
      { name: 'codegraph_explore', description: 'Search symbols and their file neighbors', inputSchema: { type: 'object', properties: { query: { type: 'string' }, kind: { type: 'string' }, file: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
      { name: 'codegraph_files', description: 'List files containing matching symbols', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: [] } },
      { name: 'codegraph_callers', description: 'Find files that reference a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'codegraph_callees', description: 'Find symbols referenced from a symbol\'s file', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
      { name: 'codegraph_impact', description: 'List files impacted by changes to a symbol', inputSchema: { type: 'object', properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const args = req.params.arguments;
      switch (req.params.name) {
        case 'codegraph_search': {
          const results = search(ensureIndex(), { query: args.query, kind: args.kind, file: args.file });
          return { content: [{ type: 'text', text: JSON.stringify({ results }) }] };
        }
        case 'codegraph_relate': {
          const results = relate(ensureIndex(), args.symbol);
          return { content: [{ type: 'text', text: JSON.stringify({ results }) }] };
        }
        case 'codegraph_reindex': {
          const newIndex = buildIndex(projectDir);
          saveIndex(projectDir, newIndex);
          return { content: [{ type: 'text', text: JSON.stringify({ symbolCount: newIndex.symbols.length }) }] };
        }
        case 'codegraph_status': {
          const loaded = loadIndex(projectDir);
          return { content: [{ type: 'text', text: JSON.stringify({ status: loaded ? 'ready' : 'not_indexed', symbolCount: loaded?.symbols.length ?? 0 }) }] };
        }
        case 'codegraph_explore': {
          const results = explore(ensureIndex(), { query: args.query, kind: args.kind, file: args.file, limit: args.limit });
          return { content: [{ type: 'text', text: JSON.stringify({ results }) }] };
        }
        case 'codegraph_files': {
          const fileList = files(ensureIndex(), args.query);
          return { content: [{ type: 'text', text: JSON.stringify({ files: fileList }) }] };
        }
        case 'codegraph_callers': {
          const results = callers(ensureIndex(), projectDir, args.symbol);
          return { content: [{ type: 'text', text: JSON.stringify({ callers: results }) }] };
        }
        case 'codegraph_callees': {
          const results = callees(ensureIndex(), projectDir, args.symbol);
          return { content: [{ type: 'text', text: JSON.stringify({ callees: results }) }] };
        }
        case 'codegraph_impact': {
          const fileList = impact(ensureIndex(), projectDir, args.symbol);
          return { content: [{ type: 'text', text: JSON.stringify({ files: fileList }) }] };
        }
        default:
          return { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
      }
    } catch (err) {
      return { content: [{ type: 'text', text: String(err) }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
}

startCodegraphServer();
