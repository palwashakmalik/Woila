# Changelog

## 0.2.1

- Install the CLI and starter dependency from prebuilt GitHub release tarballs, avoiding global Git-install link/lifecycle issues.
- Local MCP installation now needs Node.js and npm, without a Git checkout or a compiler build.

## 0.2.0

- Add `woila mcp`, a local stdio MCP server for Claude Desktop, Claude Code and other compatible clients.
- Expose `woila_reference`, `woila_check` and `woila_compile`, plus ten bundled reference resources, including a GET books API example.
- Add `woila mcp-config` to print client configuration with absolute paths.
- Support both legacy MCP initialization and modern 2026-07-28 discovery through the official MCP SDK.
- Return source diagnostics and optional standalone runtime code without executing source or writing files.
- Add actual MCP client/subprocess tests, including packaged installation and clean connection shutdown.
- Read CLI/server version from package metadata and pin starter projects to the compiler version that created them.
- Keep the MCP adapter out of browser/extension bundles and load it only for the MCP command.

## 0.1.0

Initial experimental release: structured English compiler, static checker, Node CLI, project starter, browser interpreter/editor, unpacked Chrome extension, schemas, in-memory model CRUD, local HTTP endpoints, examples and documentation.
