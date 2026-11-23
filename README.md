# EngScript

A working structured-English programming language with a TypeScript compiler, Node CLI, offline browser editor and Chrome extension.

## Start from GitHub

Requires Node.js 24+, npm and Git. The package builds automatically during Git installation:

```sh
npx --yes --package=github:palwashakmalik/EngScript engscript init my-app
cd my-app
npm start
```

`init` creates a starter project, installs its pinned compiler dependency, and never overwrites an existing directory. Then `npm start` runs `main.eng`. Use `--skip-install` after the project name to generate files offline and install later. The commands `english` and `engscript` are aliases.

To install the CLI directly:

```sh
npm install --global git+https://github.com/palwashakmalik/EngScript.git#v0.1.0
engscript --help
engscript studio
```

`studio` starts the local browser editor at `http://127.0.0.1:4173` from any working directory. This is GitHub distribution; no npm registry publication is required. The initial starter requires the repository's `v0.1.0` tag to be available.

```text
define function greet with name as text returning text
  return "Hello, " plus name
end
print the result of greet with name as "Ali" end call
```

No AI service, token, paid plan, runtime dependency or account is required. Source programs follow exact English patterns and are checked before execution. **Version 0.1 is an initial development release. Models use memory rather than a production database.**

## Run a program

Install Node.js **24 or newer**, extract this project, and open a terminal in its `plain-english` folder:

```sh
npm run build
node bin/english.mjs run examples/hello.eng
```

Expected output:

```text
Hello, world!
3
2
1
```

To install the command globally from your local copy:

```sh
npm install --global .
english check examples/functions.eng
english run examples/functions.eng
english compile examples/hello.eng
node examples/hello.generated.mjs
```

Use `node bin/english.mjs` in place of `english` if a global install needs permissions. Keep the locally installed folder in place. An npm registry package has **not** been published.

## Open the browser editor

```sh
npm start
```

Open `http://127.0.0.1:4173`. Select an example, edit the sentences, and click **Run program**. **Check** reports source errors and shows generated JavaScript. **Save .eng** downloads your program. Your current source is saved locally in that browser profile. No code is uploaded. Use **Stop** to end a run.

Do not open the HTML using `file://`; JavaScript module workers need the local server or extension origin.

## Install in Chrome

1. Extract the full archive, or the separate Chrome extension archive.
2. For a source checkout, first run `npm run build`. Downloaded release archives already include generated files.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the folder containing `manifest.json`: `plain-english/extension` in the full archive, or `plain-english-extension` in the extension archive.
6. Open Chrome's Extensions menu and click **Plain English Studio**. It opens a full editor tab.

The extension requests no website access, host permissions, accounts, or API keys. It works offline after loading. Chrome's Developer mode is required because the extension has not been published in the Chrome Web Store. Organization policy may disallow unpacked extensions; in that case use the local web editor. This project does not change Chrome settings automatically.

The extension runs the language's core features and in-memory models. HTTP servers and external modules execute with the Node CLI. Save a backend program from the editor and run the downloaded `.eng` file through the CLI.

## Run the example API

```sh
node bin/english.mjs run examples/backend.eng
```

In a second terminal:

```sh
curl http://127.0.0.1:3000/health
curl -X POST http://127.0.0.1:3000/people -H "Content-Type: application/json" -d '{"id":1,"name":"Ali"}'
curl http://127.0.0.1:3000/people
```

On Windows PowerShell, use:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/people -Method Post -ContentType application/json -Body '{"id":1,"name":"Ali"}'
Invoke-RestMethod http://127.0.0.1:3000/people
```

Press Ctrl+C to stop the server. Restarting clears model data. For production applications, replace the memory adapter with durable storage and add application security and operational controls.

## Documentation

- [Complete language rules](docs/LANGUAGE.md): syntax, types, expressions, calls, async, collections, records, models, APIs and modules.
- [Formal sentence grammar](docs/GRAMMAR.ebnf).
- [Architecture and verification](docs/ARCHITECTURE.md).
- [GitHub publishing](docs/GITHUB.md): push this exact project to your own account without sharing a token in chat.

## Development and tests

```sh
npm ci
npm test
```

There are no npm dependencies. The build uses Node 24's built-in TypeScript syntax stripping; it validates supported TypeScript syntax, but does not run TypeScript's `tsc` checker. The language's own static type checker runs for English programs. Tests compare browser-interpreter behavior against compiled JavaScript and exercise real CLI and HTTP behavior.

Optional browser smoke checks require Playwright and Chromium:

```sh
npm install --no-save playwright
npx playwright install chromium
node scripts/browser-smoke.mjs
```

To build distributable ZIP archives, install Python 3 and run `npm run package`. Release archives contain compiled JavaScript, docs, examples, and the ready-to-load extension.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/compiler.ts` | Lexer, AST parser, static type checker, JavaScript emitter |
| `src/runtime.ts` | Validation, standard functions, models, HTTP server |
| `src/interpreter.ts` | Browser AST execution with step/depth limits |
| `bin/english.mjs` | Check, compile and run commands |
| `web/` | Offline editor and worker |
| `extension/` | Chrome Manifest V3 extension |
| `examples/` | Runnable language examples |
| `test/` | Compiler, runtime, CLI and HTTP tests |
| `docs/` | Rules, grammar, architecture and publishing |

MIT licensed. The working name and version are placeholders for the project's first implementation; this repository makes no claim of registry, store or production certification.
