# Plain English language reference — 0.1

Plain English is a deterministic, structured programming language. You write exact English sentences. No AI, account, API key, or JavaScript knowledge is required to write a program. The TypeScript implementation compiles `.eng` files into Node.js JavaScript. The browser executes the same checked syntax through an interpreter.

This is the first working release of the language. The name is a working name, not a final brand decision. It follows the chosen direction: sentence-oriented syntax, explicit `end`, static types with explicit unsafe sections, async/wait, separate schemas and models, English operators and grouping, full argument clauses, natural properties, English lists and record constructors, and explicit result phrases.

## Basic writing rules

- One logical statement per line. Headers and their bodies occupy separate lines.
- Keywords and names are case-sensitive. Keywords use lowercase English.
- Indentation helps people read; `end` closes a block.
- A name starts with an ASCII letter, followed by letters, digits, or underscores. Use `firstName`, not `first name`.
- `#` starts a comment outside text. Blank lines are ignored.
- Text uses double quotes. JSON escapes such as `\n`, `\"` and `\\` work. Text cannot span source lines.
- Numbers use decimal notation, optionally negative or scientific notation: `-2`, `3.5`, `1e3`.
- There are no semicolons, symbolic operators, commas, parentheses, or JavaScript expressions in English source. Punctuation inside quoted text is ordinary text.
- Unknown words and sentences are errors, not guesses or fuzzy matches.

## Values, variables, and types

```text
let score be number as 10
set score to score plus 5
keep title be text as "My program"
keep enabled be boolean as true
let nickname be optional text as nothing
keep scores be list of number as a list containing 10 then 20 end list
print title
```

`let` declares a mutable binding; `keep` declares a binding that cannot be reassigned. Names cannot be redeclared or shadowed. Block-local names do not escape their block. A variable's type never changes after declaration. `nothing` is the null value.

Types are `number`, `text`, `boolean`, a schema name, `optional TYPE`, and `list of TYPE`. `void` is a function return type. `any` permits a dynamic value; declare an `any` local inside `unsafe`. Dynamic values need validation before they can become checked records. Dynamic property access and external calls require `unsafe`.

Optional types must be handled explicitly: they can be printed, compared with `nothing`, passed as optional values, or inspected in an unsafe block. This release does not narrow an optional type inside an `if`. List indexing returns an optional value. There is no automatic text/number conversion.

Numbers use JavaScript's double-precision floating-point representation. Number literals must be finite. Division by zero throws. Other arithmetic follows JavaScript number semantics; validate external record data before storing it. Equality is strict and compares lists and records by identity. Text length counts UTF-16 code units.

## English expressions

| Operation | Sentence fragment | Precedence, high to low |
| --- | --- | --- |
| Grouping | `the quantity 2 plus 3 end quantity` | Explicit grouping |
| Prefix | `not enabled`, `wait RESULT` | 7 |
| Multiply | `a times b`, `a divided by b`, `a remainder of b` | 6 |
| Add | `a plus b`, `a minus b` | 5 |
| Compare | `a is greater than b`, `a is less than b` | 4 |
| Inclusive compare | `a is greater than or equal to b`, `a is less than or equal to b` | 4 |
| Equality | `a equals b`, `a is not equal to b` | 3 |
| Boolean conjunction | `a and b` | 2 |
| Boolean alternative | `a or b` | 1 |

Equal-precedence operators associate left to right. `and` and `or` short-circuit. `plus` adds two numbers or joins two texts; mixed types are rejected. Ordering and other arithmetic require numbers. Conditions require booleans.

```text
print the quantity 2 plus 3 end quantity times 4
print true or false and false
```

Outputs: `20`, then `true`.

## Decisions and loops

```text
if score is greater than 10
  print "High"
otherwise
  print "Low"
end

repeat while score is greater than 0
  set score to score minus 1
end

for each value in scores
  print value
end
```

`otherwise` is optional. Nest `if` inside `otherwise` for additional branches. A `for each` item is a constant binding. There are no implicit truthy values, `break`, or `continue` in this release.

## Functions and calls

```text
define function subtract with left as number and right as number returning number
  return left minus right
end

print the result of subtract with right as 2 and with left as 9 end call
```

The declaration separates parameters with `and`. The call separates full argument clauses with `and with`. All declared parameters must appear exactly once. Calls may reorder arguments by name. Expressions are evaluated in parameter declaration order, including reordered calls. The result above is `7`.

```text
define function answer returning number
  return 42
end
print the result of answer end call
```

Use `do CALL` when discarding a function's result. Non-void functions must return or raise on every statically checked path. `return nothing` completes a `void` function. Functions may call themselves or other declared functions, including later declarations. They operate on explicit parameters rather than capturing top-level local variables or models. Functions, schemas, models, routes, imports, and listening belong at the top level; nested functions are not supported.

## Async and waiting

```text
define async function greet with name as text returning text
  do wait the result of pause with milliseconds as 10 end call
  return "Hello, " plus name
end
print wait the result of greet with name as "Ali" end call
```

`wait` requires an async function or the top level, and an async result. Endpoints are async automatically. Explicit waiting is required before storing, printing, or replying with an async result. The interpreter and compiled output execute checked programs with the same visible sequencing. Concurrent tasks, cancellation syntax and promise-valued variables are not part of v0.1.

## Records and natural property access

```text
schema Person
  field name as text
  field age as number
  field nickname as optional text
end
keep person be Person as a new Person with name as "Ali" and with age as 28 end record
print the name of person
```

Schema declarations describe data. Constructor sentences create validated records. Required fields must be present, unknown and duplicate fields are rejected, and omitted optional fields become `nothing`. Property access reads from the nearest following value: `the name of the owner of project`. Use English quantity grouping around a compound record expression. Property mutation is not supported; construct a replacement record.

`validate VALUE as SchemaName` validates untrusted data at runtime, returning a new checked record. Validation rejects missing required fields, wrong types, extra fields, inherited fields, and deeply nested data beyond 64 levels. Schemas can refer to other schemas.

## Lists

```text
keep names be list of text as a list containing "Ali" then "Sara" end list
keep empty be list of text as a list containing end list
print item 1 of names
print the result of length with value as names end call
```

Lists contain one element type. Positions start at **1**. An out-of-range position returns `nothing`; a zero, negative, or fractional position throws. Elements use `then` as a separator to avoid ambiguity with boolean `and`. Lists are read through iteration and indexing; list mutation is not part of this release.

## Errors and unsafe sections

```text
try
  raise "The operation failed."
on error problem
  print problem
end
```

`raise` requires text. Error handlers receive text, not an engine-specific error object. There is no `finally` syntax. Browser step limits cannot be suppressed by an error handler. Syntax and type errors are reported before execution and cannot be caught by a program.

```text
unsafe
  let value be any as "dynamic"
  print value
end
```

An unsafe section allows dynamic interoperation. It does not accept embedded JavaScript or disable parsing, and it has its own variable scope. Assignment to an outer binding still uses its declared type unless the source value is explicitly dynamic. Prefer schema validation at external boundaries.

## Models: create, read, update and delete

```text
schema Person
  field id as number
  field name as text
end
model people for Person
store a new Person with id as 1 and with name as "Ali" end record in people
print all records in people
update records in people where id equals 1 using a new Person with id as 1 and with name as "Ali Imam" end record
remove records in people where id equals 1
```

Models are separate from schemas. `store` validates and copies the record. Reads return copies. Update replaces every matching record with the validated replacement; remove deletes every match. Matching fields must be text, number or boolean. IDs are ordinary schema fields: no automatic IDs or uniqueness constraints exist.

**The supplied model adapter is in memory.** Restarting a program clears its records. It is a working local prototype adapter, not a database or production persistence system. There are no migrations, transactions, relations, database drivers, indexes, or authentication policies in v0.1.

## HTTP endpoints (Node only)

```text
serve post "/people"
  keep person be Person as validate the body of request as Person
  store person in people
  reply person with status 201
end
listen on 3000
```

Methods: `get`, `post`, `put`, `patch`, `delete`. Paths support literal segments and `:name` parameters. Routes match in declaration order, so put literal paths before overlapping parameter paths. Duplicate normalized method/path patterns are rejected. The `request` value supplies `body`, `params`, `query`, `path`, and `method`. Body, query and path parameters are dynamic; use validation or an explicit unsafe block. Query and parameter values are text. Repeated query keys use the last value.

Every endpoint path must `reply` or raise. `reply VALUE` defaults to 200; `with status NUMBER` selects a final status from 200–599 that permits a JSON body. Each reply is JSON. Use one `listen` at the end. The server binds to `127.0.0.1`; port 0 chooses an available port. The API runtime can also be embedded from JavaScript and given an explicit host.

Runtime responses: 400 malformed JSON/URL encoding, 404 missing endpoint, 413 body over 1 MiB, 415 non-JSON request body, 422 schema validation failure, 500 unexpected handler error. Unexpected failures are logged locally without exposing stack traces to HTTP clients. Header and request timeouts apply. Browser programs cannot start servers.

These endpoints are a local development API. Production hosting needs durable storage, authorization, transport security, resource controls, operational logging and deployment configuration suited to the application.

## Modules and npm (Node only)

```text
use "node:path" as paths
unsafe
  keep result be text as the result of basename from paths with path as "/home/ali/hello.eng" end call
  print result
end
```

`use` imports an installed npm package, built-in Node module, or JavaScript ES module. Install a package next to your program with `npm install PACKAGE`. External calls use `the result of EXPORT from ALIAS ... end call`. External argument labels are descriptive; their **source order** determines positional JavaScript arguments. External results are dynamic and must stay in an unsafe block or cross a validation boundary. Use `wait` for external async functions inside an async context and unsafe block. Package calls have the same permissions as the Node process.

To share an English function:

```text
share function double with value as number returning number
  return value times 2
end
```

Save as `math.eng`, compile it to `math.generated.mjs`, then `use "./math.generated.mjs" as math` in another program. Call its `double` export through an unsafe external call. Shared functions use positional arguments across the JavaScript module boundary. English modules currently share compiled JavaScript, without cross-file static signature checking. Relative module paths in `english run` resolve from the source file; after `compile`, they resolve from the output file. Move the module's runtime alongside it if distributing compiled output.

## Built-in calls

| Function | Argument clause | Result |
| --- | --- | --- |
| `length` | `with value as TEXT_OR_LIST` | number |
| `textOf` | `with value as VALUE` | text, using JSON for non-text values |
| `numberOf` | `with value as TEXT` | number; throws for empty/invalid/non-finite text |
| `pause` | `with milliseconds as NUMBER` | async void |
| `fetchText` | `with url as TEXT` | async text; HTTP(S), 10-second request deadline |

Use the full result phrase and `end call` for all built-ins. Browser network calls are disabled; `fetchText` runs through the CLI. Console rendering of records differs from the browser's JSON output; use `textOf` for consistent serialized output.

## Reserved names

These words cannot be names: `__proto__`, `prototype`, `constructor`, `then`, `end`, `as`, `with`, `and`, `or`, `of`, `in`, `to`, `be`, `returning`, `otherwise`, `on`, `true`, `false`, `nothing`, `the`, `a`, `an`, `plus`, `minus`, `times`, `divided`, `remainder`, `equals`, `is`, `not`, `wait`, `request`, `error`, `list`, `optional`, `number`, `text`, `boolean`, `any`, `void`. Built-in function names cannot be redeclared. Statement keywords are recognized at statement starts. Use distinct descriptive names to avoid unclear English.

## Execution limits and release boundary

The browser runner uses a module worker, no `eval`, 100,000 execution steps, a call depth of 128, a five-second wall deadline, and output limits of 1,000 messages/200,000 characters. Stop terminates the worker. Browser execution supports core language and in-memory models; Node handles imports, networking and servers. The Node CLI has normal process permissions and no default time limit; `--timeout` applies an explicit deadline.

This is a tested v0.1 language implementation, not a production-certified language platform. Unicode identifiers, generic types, classes/inheritance, overloads, static cross-file imports, optional-value narrowing, source maps, debugger integration, persistent database adapters, extension-store publishing and native binaries are future work. The parser in `src/compiler.ts` is the authoritative executable grammar; `GRAMMAR.ebnf` records its sentence forms.
