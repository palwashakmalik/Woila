# Local Claude integration

Woila 0.2 adds a local MCP server over stdio. Claude Desktop and Claude Code start it as a subprocess. It has no HTTP address and does not use port 4173. Your browser editor is independent of the MCP connection.

## Install or upgrade

Install Node.js 24+ and Git, then:

```sh
npm install --global git+https://github.com/palwashakmalik/Woila.git#v0.2.0
woila --version
```

The reported version should be `0.2.0`. A source checkout also works: run `npm ci` and `npm run build`, then substitute `node bin/english.mjs` for `woila` in commands below. You do not need a GitHub token for this public repository or an API key for Woila.

## Claude Desktop (Windows, macOS or Linux)

1. Run `woila mcp-config` in your terminal. It prints valid JSON using the actual absolute paths to your Node executable and installed Woila CLI. This avoids Windows backslash and desktop PATH problems.
2. Open Claude Desktop's local MCP configuration. Depending on its version, find it under Settings → Desktop app → Extensions → Advanced settings, or Settings → Developer → Edit Config.
3. Add the printed `woila` entry under `mcpServers` in `claude_desktop_config.json`. If other servers are already configured, merge the entry into that object rather than replacing their configuration. If no config exists, use the entire printed JSON.
4. Save the file, fully quit Claude Desktop, then reopen it.
5. Check its local MCP server status. `woila` should connect and list three tools.

The generated configuration has this shape; your command output contains real paths:

```json
{
  "mcpServers": {
    "woila": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/Woila/bin/english.mjs", "mcp"]
    }
  }
}
```

Config file locations:

| System | Location |
| --- | --- |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Keep the installation in place: moving/uninstalling it changes the paths in the config. Run `woila mcp-config` again after relocating Node or Woila. The command only prints configuration and never edits Claude settings.

## Claude Code

After global installation:

```sh
claude mcp add --transport stdio woila -- woila mcp
claude mcp list
```

If the Claude environment cannot find `woila`, use the absolute command and arguments printed by `woila mcp-config`, for example:

```sh
claude mcp add --transport stdio woila -- /absolute/path/to/node /absolute/path/to/Woila/bin/english.mjs mcp
```

Quote any path containing spaces. Claude Code's MCP configuration is separate from Claude Desktop's. No network server or hosted connector is needed for this local integration.

## What Claude can use

| Tool | Inputs | Behavior |
| --- | --- | --- |
| `woila_reference` | `topic` (optional, default `language`) | Returns bundled language documentation or a runnable example. |
| `woila_check` | `source` | Reports syntax/type validation and line/column diagnostics. |
| `woila_compile` | `source`, `includeRuntime` (optional, default false) | Returns generated JavaScript; optionally includes the companion runtime source. |

Reference topics: `language`, `grammar`, `hello`, `functions`, `collections`, `async`, `models`, `backend`, `books`, `modules`. They are also available as read-only resources with URIs such as `woila://reference/language` and `woila://reference/books`.

Check results use `{ "valid": true, "diagnostics": [] }`, or a tool error with `valid: false` and diagnostic entries containing `message`, `line` and `column`. Source must be nonempty and no longer than 262,144 characters. The stdio transport bounds each protocol message at 2 MiB.

Compile results contain `javascript` and `runtimeFilename: "english-runtime.mjs"`. Ask for `includeRuntime: true` when you need both files. The returned `runtimeJavascript` belongs in that companion file next to the generated `.mjs` program. The tool returns text; saving/running it requires a separate editor or terminal action.

Try this in Claude:

> Use Woila's reference tool to read the books example. Write a GET /books API returning title, name and description. Check the source, fix any diagnostics, then compile it with the runtime included. Show me the .eng source and instructions to run it locally.

## Execution and data access

This version exposes reference, checking and compilation only. It does not execute Woila, start servers, load source-declared npm modules, write files or read arbitrary local paths. It reads only bundled reference files and its own runtime/package metadata. Its tools have read-only/idempotent annotations. Compilation accepts imports as source syntax without importing those modules.

Claude may have other tools capable of writing files or running shell commands; those capabilities are separate from Woila's MCP adapter. Use your terminal's `woila run` command when you intentionally want to execute a program.

The adapter uses the official MCP server SDK and negotiates both the legacy initialize handshake and modern 2026-07-28 discovery. Only protocol messages go to stdout; errors go to stderr. No telemetry or remote Woila account is used. Initial npm installation downloads dependencies; using the installed local tools does not require a remote Woila service.

## Troubleshooting

- `Unknown command`: you are running v0.1.0. Upgrade, then confirm with `woila --version`.
- Server not found: use `woila mcp-config` for absolute paths; confirm Node 24+ is installed.
- Manually running `woila mcp` waits silently: that is expected. Claude starts it and communicates through stdin/stdout. Ctrl+C stops a manual run.
- Tool is absent: restart Claude and check that the config entry is under `mcpServers`.
- Syntax error: ask `woila_reference` for the grammar or the relevant example, then recheck the corrected source.
- Claude in a web browser: local stdio configuration applies to Desktop/Code, not the hosted web connector interface.

Official setup references: [MCP local servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers), [Claude Desktop local MCP](https://support.claude.com/en/articles/10949351-getting-started-with-local-mcp-servers-on-claude-desktop), [Claude Code MCP](https://code.claude.com/docs/en/mcp).
