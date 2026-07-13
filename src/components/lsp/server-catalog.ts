import path from 'node:path';

export interface LspServerDefinition {
  id: string;
  aliases?: string[];
  name: string;
  command: string;
  args: string[];
  extensions: string[];
  installHint?: string;
}

export const LSP_SERVER_CATALOG: LspServerDefinition[] = [
  {
    id: 'typescript-language-server',
    aliases: ['typescript', 'ts'],
    name: 'TypeScript Language Server',
    command: 'typescript-language-server',
    args: ['--stdio'],
    extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    installHint: 'npm install -g typescript-language-server typescript',
  },
  {
    id: 'deno',
    aliases: ['deno-lsp'],
    name: 'Deno Language Server',
    command: 'deno',
    args: ['lsp'],
    extensions: ['ts', 'tsx', 'js', 'jsx'],
    installHint: 'deno upgrade',
  },
  {
    id: 'vue-language-server',
    aliases: ['vue', 'vls'],
    name: 'Vue Language Server',
    command: 'vue-language-server',
    args: ['--stdio'],
    extensions: ['vue'],
    installHint: 'npm install -g @volar/vue-language-server',
  },
  {
    id: 'eslint',
    aliases: ['eslint-lsp'],
    name: 'ESLint Language Server',
    command: 'eslint-lsp',
    args: ['--stdio'],
    extensions: ['js', 'jsx', 'ts', 'tsx'],
    installHint: 'npm install -g @microsoft/eslint-lsp',
  },
  {
    id: 'biome',
    aliases: ['biome-lsp'],
    name: 'Biome Language Server',
    command: 'biome',
    args: ['lsp-proxy'],
    extensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
    installHint: 'npm install -g @biomejs/biome',
  },
  {
    id: 'pyright',
    aliases: ['python', 'py'],
    name: 'Pyright',
    command: 'pyright-langserver',
    args: ['--stdio'],
    extensions: ['py'],
    installHint: 'npm install -g pyright',
  },
  {
    id: 'gopls',
    aliases: ['go'],
    name: 'gopls',
    command: 'gopls',
    args: [],
    extensions: ['go'],
    installHint: 'go install golang.org/x/tools/gopls@latest',
  },
  {
    id: 'rust-analyzer',
    aliases: ['rust', 'rs'],
    name: 'rust-analyzer',
    command: 'rust-analyzer',
    args: [],
    extensions: ['rs'],
    installHint: 'rustup component add rust-analyzer',
  },
  {
    id: 'clangd',
    aliases: ['c', 'cpp', 'cxx'],
    name: 'clangd',
    command: 'clangd',
    args: [],
    extensions: ['c', 'cpp', 'cc', 'cxx', 'h', 'hpp'],
    installHint: 'brew install llvm (macOS) or apt install clangd (Linux)',
  },
  {
    id: 'jdtls',
    aliases: ['java'],
    name: 'Eclipse JDT Language Server',
    command: 'jdtls',
    args: [],
    extensions: ['java'],
    installHint: 'brew install jdtls (macOS) or apt install jdtls (Linux)',
  },
  {
    id: 'csharp-ls',
    aliases: ['csharp', 'cs'],
    name: 'C# Language Server',
    command: 'csharp-ls',
    args: [],
    extensions: ['cs'],
    installHint: 'dotnet tool install --global csharp-ls',
  },
  {
    id: 'elixir-ls',
    aliases: ['elixir', 'ex'],
    name: 'Elixir Language Server',
    command: 'elixir-ls',
    args: [],
    extensions: ['ex', 'exs'],
    installHint: 'mix archive.install github elixir-lsp/elixir-ls',
  },
  {
    id: 'svelte-language-server',
    aliases: ['svelte'],
    name: 'Svelte Language Server',
    command: 'svelte-language-server',
    args: ['--stdio'],
    extensions: ['svelte'],
    installHint: 'npm install -g svelte-language-server',
  },
  {
    id: 'astro-language-server',
    aliases: ['astro'],
    name: 'Astro Language Server',
    command: 'astro-ls',
    args: ['--stdio'],
    extensions: ['astro'],
    installHint: 'npm install -g @astrojs/language-server',
  },
];

export function findServerById(id: string): LspServerDefinition | undefined {
  return LSP_SERVER_CATALOG.find((s) => s.id === id || s.aliases?.includes(id));
}

export function findServerByExtension(ext: string): LspServerDefinition | undefined {
  const clean = ext.replace(/^\./, '');
  return LSP_SERVER_CATALOG.find((s) => s.extensions.includes(clean));
}

export function findServerByCommand(command: string): LspServerDefinition | undefined {
  const base = command.split(/[\s/\\]/).pop() ?? command;
  return LSP_SERVER_CATALOG.find((s) => s.command === base || path.basename(s.command) === base);
}

export function listServerIds(): string[] {
  return LSP_SERVER_CATALOG.flatMap((s) => [s.id, ...(s.aliases ?? [])]);
}
