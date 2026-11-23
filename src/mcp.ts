/** Local MCP adapter. Source is checked/compiled as data; never executed. */
import { readFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio, StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { compile } from './compiler.ts';

const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const sourceSchema = z.string().min(1).max(262144).describe('Woila source code, up to 262144 characters. Supply source text, not a filesystem path.');
const diagnosticSchema = z.object({message:z.string(), line:z.number().nullable(), column:z.number().nullable()});
const annotations = {readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false};
const references = {
  language: {path:'docs/LANGUAGE.md', description:'Complete Woila syntax, type rules and backend semantics.'},
  grammar: {path:'docs/GRAMMAR.ebnf', description:'Formal Woila sentence grammar.'},
  hello: {path:'examples/hello.eng', description:'Variables, output and a while loop.'},
  functions: {path:'examples/functions.eng', description:'Functions, recursion, records and optional fields.'},
  collections: {path:'examples/collections.eng', description:'Lists, indexing and iteration.'},
  async: {path:'examples/async.eng', description:'Explicit waiting and error handling.'},
  models: {path:'examples/models.eng', description:'In-memory record CRUD.'},
  backend: {path:'examples/backend.eng', description:'Local HTTP endpoints and request validation.'},
  books: {path:'examples/books.eng', description:'GET /books with title, name and description.'},
  modules: {path:'examples/modules.eng', description:'External Node module interoperation.'},
};
type Topic = keyof typeof references;
const topics = Object.keys(references) as [Topic,...Topic[]];
async function reference(topic:Topic) {
  return await readFile(new URL('../'+references[topic].path, import.meta.url),'utf8');
}
function failure(error:any) {
  const data={valid:false,diagnostics:[{message:error.message??String(error),line:error.line??null,column:error.column??null}]};
  return {isError:true,content:[{type:'text' as const,text:JSON.stringify(data)}],structuredContent:data};
}

export function createMcpServer() {
  const server=new McpServer({name:'woila',version:metadata.version}, {
    instructions:'Woila uses exact structured-English sentences. Read woila_reference before inventing syntax; use woila_check to validate source and woila_compile for JavaScript. These tools do not run source, write files, start HTTP servers, or import source-declared modules. Compile results reference english-runtime.mjs; request includeRuntime when saving standalone output.'
  });
  server.registerTool('woila_reference', {
    title:'Woila language reference',
    description:'Read the bundled language guide, grammar or runnable examples, including a GET books API. Topic names are an allowlist, not paths.',
    inputSchema:z.object({topic:z.enum(topics).default('language')}), annotations,
  }, async({topic})=>({content:[{type:'text',text:await reference(topic)}]}));

  server.registerTool('woila_check', {
    title:'Check Woila source',
    description:'Check syntax, names, types, named arguments, async use and endpoint return paths. Does not execute code. Errors include line and column where available.',
    inputSchema:z.object({source:sourceSchema}),
    outputSchema:z.object({valid:z.boolean(),diagnostics:z.array(diagnosticSchema)}), annotations,
  }, async({source})=>{
    try {
      compile(source);
      const data={valid:true,diagnostics:[]};
      return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
    } catch(error) {return failure(error);}
  });

  server.registerTool('woila_compile', {
    title:'Compile Woila source',
    description:'Validate Woila and return JavaScript as text. No files are written and no code is executed. For standalone output save the result alongside english-runtime.mjs; includeRuntime returns that file too.',
    inputSchema:z.object({source:sourceSchema,includeRuntime:z.boolean().default(false)}),
    outputSchema:z.object({valid:z.boolean(),diagnostics:z.array(diagnosticSchema),javascript:z.string().optional(),runtimeFilename:z.string().optional(),runtimeJavascript:z.string().optional()}), annotations,
  }, async({source,includeRuntime})=>{
    try {
      const {code}=compile(source);
      const data={valid:true,diagnostics:[],javascript:code,runtimeFilename:'english-runtime.mjs',
        ...(includeRuntime?{runtimeJavascript:await readFile(new URL('./runtime.js',import.meta.url),'utf8')}:{})};
      return {content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data};
    } catch(error) {return failure(error);}
  });

  for(const [topic,entry] of Object.entries(references)) {
    server.registerResource('woila-'+topic, 'woila://reference/'+topic,
      {title:'Woila: '+topic,description:entry.description,mimeType:'text/plain'},
      async(uri)=>({contents:[{uri:uri.href,mimeType:'text/plain',text:await reference(topic as Topic)}]}));
  }
  return server;
}

export function startMcpServer() {
  // Only protocol messages go to stdout. The SDK owns both modern discovery
  // and the legacy initialize handshake, plus connection teardown on stdin EOF.
  return serveStdio(createMcpServer, {
    transport:new StdioServerTransport(process.stdin,process.stdout,{maxBufferSize:2*1024*1024}),
    onerror:error=>console.error('Woila MCP: '+error.message),
  });
}
