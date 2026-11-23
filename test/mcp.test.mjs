import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {readFile,mkdtemp,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const cli=resolve('bin/english.mjs');
const metadata=JSON.parse(await readFile('package.json','utf8'));
async function session(mode,body) {
  const cwd=await mkdtemp(join(tmpdir(),'woila-mcp-'));
  const configCommand=spawnSync(process.execPath,[cli,'mcp-config'],{encoding:'utf8'});
  assert.equal(configCommand.status,0,configCommand.stderr);
  const config=JSON.parse(configCommand.stdout).mcpServers.woila;
  const transport=new StdioClientTransport({...config,cwd,stderr:'pipe'});
  let stderr='';transport.stderr.on('data',chunk=>stderr+=chunk);
  const client=new Client({name:'woila-integration-test',version:'1.0.0'},{versionNegotiation:{mode}});
  try{await client.connect(transport);await body(client,cwd);assert.equal(stderr,'',stderr);}
  finally{await client.close();await transport.close();await rm(cwd,{recursive:true,force:true});}
}
async function rejected(operation){try{const result=await operation();assert.equal(result.isError,true,JSON.stringify(result));}catch(error){assert.match(error.message,/invalid|unknown|not found|too big|maximum|262144|Input validation/i);}}

for(const [name,mode] of [['legacy','legacy'],['modern',{pin:'2026-07-28'}]]) {
  test(`MCP ${name}: real stdio handshake, tools and bundled resources`,{timeout:15000},async()=>session(mode,async client=>{
    const {tools}=await client.listTools();
    assert.deepEqual(tools.map(t=>t.name).sort(),['woila_check','woila_compile','woila_reference']);
    for(const tool of tools){assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool.annotations.openWorldHint,false);}
    const checked=await client.callTool({name:'woila_check',arguments:{source:'print "Hello from Claude"'}});
    assert.deepEqual(checked.structuredContent,{valid:true,diagnostics:[]});
    const resources=await client.listResources();assert.equal(resources.resources.length,10);
    const read=await client.readResource({uri:'woila://reference/language'});assert.match(read.contents[0].text,/Woila language reference/);
    const reference=await client.callTool({name:'woila_reference',arguments:{topic:'books'}});assert.match(reference.content[0].text,/serve get "\/books"/);
    const defaults=await client.callTool({name:'woila_reference',arguments:{}});assert.match(defaults.content[0].text,/Woila language reference/);
  }));
}

test('MCP check returns actionable syntax/type errors and remains usable',{timeout:15000},async()=>session('legacy',async client=>{
  const bad=await client.callTool({name:'woila_check',arguments:{source:'let age be number as "wrong"'}});
  assert.equal(bad.isError,true);assert.equal(bad.structuredContent.valid,false);assert.equal(bad.structuredContent.diagnostics[0].line,1);assert.match(bad.structuredContent.diagnostics[0].message,/Expected number/);
  const syntax=await client.callTool({name:'woila_compile',arguments:{source:'print "unclosed'}});
  assert.equal(syntax.isError,true);assert.match(syntax.structuredContent.diagnostics[0].message,/Close this text/);
  const okay=await client.callTool({name:'woila_check',arguments:{source:'print 42'}});assert.equal(okay.structuredContent.valid,true);
}));

test('MCP compile returns working standalone JavaScript plus optional runtime',{timeout:15000},async()=>session('legacy',async(client,cwd)=>{
  const result=await client.callTool({name:'woila_compile',arguments:{source:'print "Compiled by MCP"',includeRuntime:true}});
  assert.equal(result.structuredContent.valid,true);assert.equal(result.structuredContent.runtimeFilename,'english-runtime.mjs');
  await writeFile(join(cwd,'app.mjs'),result.structuredContent.javascript);
  await writeFile(join(cwd,result.structuredContent.runtimeFilename),result.structuredContent.runtimeJavascript);
  const run=spawnSync(process.execPath,[join(cwd,'app.mjs')],{encoding:'utf8',timeout:3000});assert.equal(run.status,0,run.stderr);assert.equal(run.stdout.trim(),'Compiled by MCP');
  const lean=await client.callTool({name:'woila_compile',arguments:{source:'print 1'}});assert.equal(lean.structuredContent.runtimeJavascript,undefined);
}));

test('MCP compiles backend declarations and side effects without executing them',{timeout:15000},async()=>session('legacy',async(client,cwd)=>{
  const backend=await readFile('examples/books.eng','utf8');
  const checked=await client.callTool({name:'woila_check',arguments:{source:backend}});assert.equal(checked.structuredContent.valid,true);
  const source='use "./side-effect.mjs" as external\nraise "Never execute this"\nrepeat while true\nend';
  await writeFile(join(cwd,'side-effect.mjs'),'import {writeFileSync} from "node:fs";writeFileSync("marker","executed");');
  const result=await client.callTool({name:'woila_compile',arguments:{source}});assert.equal(result.structuredContent.valid,true);assert.match(result.structuredContent.javascript,/side-effect/);
  await assert.rejects(()=>access(join(cwd,'marker')),/ENOENT/);
}));

test('MCP rejects invalid inputs, unknown tools and arbitrary resource paths',{timeout:15000},async()=>session('legacy',async client=>{
  for(const args of [{},{source:123},{source:''},{source:'x'.repeat(262145)}])await rejected(()=>client.callTool({name:'woila_check',arguments:args}));
  await rejected(()=>client.callTool({name:'woila_reference',arguments:{topic:'../../package.json'}}));
  await rejected(()=>client.callTool({name:'woila_run',arguments:{source:'print 1'}}));
  await assert.rejects(()=>client.readResource({uri:'file:///etc/passwd'}),/not found|unknown|invalid/i);
}));

test('MCP shuts down cleanly when stdin closes and rejects extra CLI arguments',{timeout:5000},async()=>{
  const child=spawn(process.execPath,[cli,'mcp'],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  child.stdin.end();const code=await new Promise((accept,reject)=>{child.on('error',reject);child.on('exit',accept);});
  assert.equal(code,0,stderr);assert.equal(stdout,'');
  const bad=spawnSync(process.execPath,[cli,'mcp','extra'],{encoding:'utf8',timeout:3000});assert.equal(bad.status,1);assert.equal(bad.stdout,'');assert.match(bad.stderr,/without arguments/);
  const version=spawnSync(process.execPath,[cli,'--version'],{encoding:'utf8'});assert.equal(version.stdout.trim(),metadata.version);
});
