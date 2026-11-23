# Verification — v0.2.1

Checks performed for this build on 23 November 2026:

| Check | Result |
| --- | --- |
| Build TypeScript source with Node 24.22.3 | Passed |
| `npm test` | **58 tests passed, 0 failures** |
| Compiled JavaScript vs interpreter examples | Passed |
| CLI check/compile/run and timeout exit status | Passed |
| Node module and compiled English module imports | Passed |
| Real generated HTTP API create/read/update/delete | Passed |
| HTTP 400/404/413/415/422 behavior | Passed |
| Actual shipped worker module execution through a Node worker bridge | Passed |
| Extension local resources, Manifest V3, CSP and absent host permissions | Passed |
| Generated editor/extension modules match the tested build | Passed |
| Starter generation and protection of existing project files | Passed |
| Studio HTTP assets served from an unrelated working directory | Passed |
| Real MCP legacy and modern stdio handshakes and tool/resource discovery | Passed |
| MCP source diagnostics, standalone compilation and input/resource restrictions | Passed |
| MCP configuration launches the server using absolute Node/CLI paths | Passed |
| MCP stdin EOF shutdown and stdout protocol isolation | Passed |
| Installed npm tarball MCP config, references and compilation from outside checkout | Passed |
| Graphical editor and installed-extension smoke check | **Not completed** |
| Host TypeScript semantic check using `tsc` | Not run; build uses syntax stripping |
| Claude Desktop/Code graphical connection | Not performed; protocol verified with official MCP client |
| npm registry or Chrome Web Store publishing | Not performed |

The graphical check was attempted with Chromium/Playwright. Chromium could not start because the execution environment denied its process-singleton socket operation. A separate shared browser could not reach the local editor server. The optional repeatable smoke-check script remains in `scripts/browser-smoke.mjs`. No claim is made that an extension was loaded successfully in a graphical browser during this session. The real browser worker modules were exercised through the Node worker bridge, which does not verify rendering or Chrome installation.

Repository publication and version tags must be verified separately from the local checks above.

The shipped example backend is a local in-memory API. Passing the tests does not establish durable storage, application authorization, production capacity, or a published release.
