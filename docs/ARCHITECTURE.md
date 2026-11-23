# Architecture and verification

## Compilation

`tokenize` preserves line/column locations, consumes comments and text escapes, and rejects symbolic source syntax. A recursive-descent sentence parser and precedence-climbing expression parser produce an AST. A separate static checker resolves schemas/functions, validates scopes, checks argument names and types, checks mandatory return paths, enforces async contexts, and validates backend declarations. Emission generates JavaScript ES modules with prefixed identifiers, serialized strings, runtime schema validation and English source-line comments.

`compile(source)` returns `{ ast, code }`, or throws `EnglishError` with line and column. Use it from `dist/compiler.js` after building. Generated modules import `./english-runtime.mjs`; the CLI places this file alongside the output. The generated line comments help locate original code, but are not source maps. Syntax error locations include exact token columns; static errors currently point to column 1 of the relevant source line.

The source is TypeScript. Node 24's built-in syntax stripping produces JavaScript without a dependency download. This is not a substitute for host-language `tsc` analysis; the release's executable verification is the test suite. English program checking is implemented in the compiler and always occurs before execution.

## Node execution

The CLI compiles first and then uses a separate Node process. Its temporary directory lives under the source directory so installed npm packages resolve from the program's project. Relative import specifiers are resolved against the original source before temporary execution. Temporary generated files are removed after completion. `--timeout` kills a program that exceeds the requested deadline and returns exit status 124. Syntax/type/runtime errors return nonzero status. SIGINT/SIGTERM are forwarded to the child.

Node execution has ordinary process permissions: installed module calls can read files, make requests and perform whatever the current user can perform. The CLI is a development tool for trusted programs, not a sandbox for untrusted uploaded code. The core browser runner does not load external modules or perform network calls.

## Browser execution

The editor compiles to validate and show generated JavaScript, but never evaluates that JavaScript. Its module worker interprets the checked AST. Variables use lexical scopes and function calls have explicit parameter scopes. Return signals propagate through nested control flow and cannot be mistaken for language exceptions. Step and depth limits stop runaway programs. The editor terminates the worker on Stop or at the five-second deadline. Output limits prevent unlimited UI growth. Source persistence is browser-local storage, with graceful fallback if storage is unavailable.

The Manifest V3 extension opens the same editor in its own tab. No host permissions, remote scripts, eval permission, content scripts, or telemetry are used. Compiled runtime code contains a lazy Node HTTP import, which is never invoked in browser execution. Backend sentences stop with a message directing the user to the CLI.

## Data and HTTP

Schemas validate and copy records, including nested records/lists, optional values, finite numbers, and strict field membership. The in-memory model adapter validates writes and isolates reads. Update and remove use strict scalar-field equality and affect every matching row. No persistence or uniqueness constraint is implied.

The Node runtime uses the standard HTTP server. Routes match method/path segments and expose a small request record. Request JSON has a 1 MiB limit. Malformed JSON, unsupported content type, validation failures and unknown routes get explicit HTTP statuses. Unanticipated failures get a generic 500 response and a local log. The default loopback binding keeps the example local. It does not provide authorization, persistent storage, TLS termination, rate limiting, handler execution deadlines or database transactions.

## Verification

`npm test` rebuilds the source and runs the standard Node test runner. The suite covers:

- Compiled/interpreted agreement for variables, control flow, recursive functions, nested expressions, records, nullable indexing, models, async calls and exceptions.
- Rejection of invalid types, unknown names, missing/duplicate arguments and fields, name collisions, invalid block endings, unsafe dynamic access, missing returns, invalid async use and duplicate routes.
- Schema rejection of extra/missing/wrongly typed/inherited fields and snapshot isolation for model reads.
- Actual CLI check/compile/run, invalid-program exit status and timeout termination.
- An actual server generated from the English backend example, with HTTP create/read/update/delete and 400/404/413/415/422 responses.
- Optional Playwright checks for the editor, worker execution, UI diagnostics, Stop, source persistence, downloads, responsive layout and a loaded Manifest V3 extension.

See `VERIFICATION.md` for the checks run on this release. Tests establish these behaviors; they do not establish production readiness or full JavaScript equivalence for arbitrary dynamic external modules.

## Extension points

Add sentence forms in the parser, checker, emitter and interpreter together. Add a behavioral test that compares emitted and interpreted execution. For backend changes, add a real request to the integration test. A persistent model adapter should own storage constraints, transactions and async semantics explicitly rather than silently changing `store` behavior. Future static module imports should preserve signatures across files; current external imports intentionally cross a dynamic boundary.
