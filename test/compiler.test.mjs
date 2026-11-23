import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,copyFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {compile,tokenize} from '../dist/compiler.js';
import {run} from '../dist/interpreter.js';
import {createRuntime} from '../dist/runtime.js';
const root=resolve('.');
async function emitted(source){const temp=await mkdtemp(join(tmpdir(),'english-test-'));try{await writeFile(join(temp,'program.mjs'),compile(source).code);await copyFile('dist/runtime.js',join(temp,'english-runtime.mjs'));const result=spawnSync(process.execPath,[join(temp,'program.mjs')],{encoding:'utf8',timeout:3000});assert.equal(result.status,0,result.stderr);return result.stdout.trim().split('\n');}finally{await rm(temp,{recursive:true,force:true});}}
async function interpreted(source,options={}){const output=[];await run(source,{print:text=>output.push(text),...options});return output;}
for(const [file,expected] of [
  ['hello.eng',['Hello, world!','3','2','1']],['functions.eng',['Hello, Ali','120']],
  ['collections.eng',['72','24','null','3','20']],['async.eng',['Hello, Ali','Recovered from an error.']],
  ['models.eng',['[{"id":1,"name":"Ali Imam"}]','0']]
])test(`compiler and browser parity: ${file}`,async()=>{const source=await readFile(`examples/${file}`,'utf8');assert.deepEqual(await emitted(source),expected);assert.deepEqual(await interpreted(source),expected);});
test('all examples compile',async()=>{for(const file of await readdir('examples'))compile(await readFile(`examples/${file}`,'utf8'));});
test('external Node module call',async()=>assert.deepEqual(await emitted(await readFile('examples/modules.eng','utf8')),['hello.eng']));
test('English modules share exports and run resolves source-relative imports',async()=>{const temp=await mkdtemp(join(tmpdir(),'english-module-'));try{await writeFile(join(temp,'math.eng'),'share function double with value as number returning number\n return value times 2\nend');const cli=join(root,'bin/english.mjs');let r=spawnSync(process.execPath,[cli,'compile',join(temp,'math.eng')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);await writeFile(join(temp,'main.eng'),'use "./math.generated.mjs" as math\nunsafe\n print the result of double from math with value as 21 end call\nend');r=spawnSync(process.execPath,[cli,'run',join(temp,'main.eng')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),'42');}finally{await rm(temp,{recursive:true,force:true});}});
test('tokenizer preserves escaped strings, comment characters, source location',()=>{const ts=tokenize('# comment\nprint "# hello \\"world\\""\n');assert.equal(ts[2].kind,'string');assert.equal(ts[2].value,'# hello "world"');assert.equal(ts[2].line,2);assert.throws(()=>compile('print "no end'),/Close this text/);});
for(const [name,source,pattern] of [
 ['wrong type','let age be number as "twenty"',/Expected number/],
 ['unknown name','print missing',/Unknown name/],
 ['constant mutation','keep x be number as 1\nset x to 2',/constant/],
 ['duplicate variable','let x be number as 1\nlet x be number as 2',/already declared/],
 ['missing block end','if true\nprint "hi"',/Expected "end"/],
 ['stray end','end',/Unexpected block/],
 ['JS escape','print process.exit()',/Unexpected character/],
 ['bad operator','print 1 + 2',/Unexpected character/],
 ['missing argument','print the result of length end call',/Missing argument/],
 ['unknown argument','print the result of length with other as "hi" end call',/Unknown argument/],
 ['duplicate argument','print the result of length with value as "hi" and with value as "a" end call',/Duplicate argument/],
 ['mixed list','print a list containing 1 then "a" end list',/Expected number/],
 ['void variable','let x be void as nothing',/invalid type/],
 ['missing return','define function thing returning number\n print 1\nend',/every path/],
 ['wrong return','define function thing returning number\n return "hi"\nend',/Expected number/],
 ['unawaited call','do the result of pause with milliseconds as 1 end call',/Use wait/],
 ['wait sync','print wait 1',/async result/],
 ['wait in sync function','define function thing returning number\n do wait the result of pause with milliseconds as 1 end call\n return 1\nend',/async function/],
 ['bad property','schema Person\n field age as number\nend\nlet p be Person as a new Person with age as 1 end record\nprint the name of p',/no field/],
 ['missing field','schema Person\n field age as number\nend\nprint a new Person end record',/Missing field/],
 ['duplicate field','schema Person\n field age as number\n field age as number\nend',/Duplicate field/],
 ['reserved name','let constructor be number as 1',/reserved word/],
 ['unsafe any','let x be any as 1',/unsafe block/],
 ['top-level return','return 1',/inside a function/],
 ['nested schema','if true\n schema Person\n end\nend',/top level/],
 ['endpoint return','serve get "/"\n print "hi"\nend',/reply on every path/],
 ['reply outside endpoint','reply 1',/endpoint/],
 ['listener ordering','listen on 3000\nprint "hi"',/at the end/],
 ['duplicate route','serve get "/:id"\n reply 1\nend\nserve get "/:name"\n reply 2\nend',/Duplicate endpoint/]
])test(`rejects ${name}`,()=>assert.throws(()=>compile(source),pattern));
test('named parameters bind in declaration order',async()=>{const source='define function subtract with left as number and right as number returning number\n return left minus right\nend\nprint the result of subtract with right as 2 and with left as 9 end call';assert.deepEqual(await emitted(source),['7']);assert.deepEqual(await interpreted(source),['7']);});
test('boolean precedence and short circuit',async()=>{const source='print true or false and false\nprint false and 1 divided by 0 equals 1\nprint not false';assert.deepEqual(await interpreted(source),['true','false','true']);assert.deepEqual(await emitted(source),['true','false','true']);});
test('return propagates through try',async()=>{const source='define function thing returning number\n try\n  return 42\n on error issue\n  return 0\n end\nend\nprint the result of thing end call';assert.deepEqual(await interpreted(source),['42']);assert.deepEqual(await emitted(source),['42']);});
test('execution budget cannot be caught by user code',async()=>{await assert.rejects(()=>run('try\n repeat while true\n end\non error issue\n print "caught"\nend',{maxSteps:30}),/stopped after 30/);});
test('recursive calls stop within browser depth limit',async()=>{await assert.rejects(()=>run('define function loop returning number\n return the result of loop end call\nend\nprint the result of loop end call',{maxDepth:10}),/Maximum function depth/);});
test('validation rejects extra fields, missing fields, wrong types and inherited properties',()=>{const rt=createRuntime({Person:{name:'text',age:'number',nick:'optional text'}});assert.deepEqual(rt.validate('Person',{name:'Ali',age:1}),{name:'Ali',age:1,nick:null});for(const bad of [{name:'Ali'},{name:'Ali',age:'1'},{name:'Ali',age:1,admin:true},Object.create({name:'Ali',age:1})])assert.throws(()=>rt.validate('Person',bad));assert.throws(()=>rt.property({},'constructor'));assert.throws(()=>rt.item([],0));});
test('models return isolated snapshots',()=>{const rt=createRuntime({Person:{name:'text'}});const people=rt.model('people','Person');const p={name:'Ali'};rt.store(people,p);p.name='changed';const rows=rt.all(people);rows[0].name='changed';assert.equal(rt.all(people)[0].name,'Ali');rt.update(people,'name','Ali',{name:'New'});assert.equal(rt.all(people)[0].name,'New');rt.remove(people,'name','New');assert.deepEqual(rt.all(people),[]);});
test('CLI check, compile, execution, error status and timeout',async()=>{const temp=await mkdtemp(join(tmpdir(),'english-cli-'));try{const cli=join(root,'bin/english.mjs');const source=join(temp,'hello.eng');await copyFile('examples/hello.eng',source);let result=spawnSync(process.execPath,[cli,'check',source],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);result=spawnSync(process.execPath,[cli,'compile',source],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(await readFile(join(temp,'hello.generated.mjs'),'utf8'),/Hello, world/);result=spawnSync(process.execPath,[cli,'run',source],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Hello, world/);await writeFile(source,'repeat while true\nend');result=spawnSync(process.execPath,[cli,'run',source,'--timeout','100'],{encoding:'utf8',timeout:3000});assert.equal(result.status,124);await writeFile(source,'print missing');result=spawnSync(process.execPath,[cli,'check',source],{encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/Line 1/);}finally{await rm(temp,{recursive:true,force:true});}});
test('compiled HTTP API validates requests and supports CRUD',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'english-http-'));let child;
  try{
    const source=(await readFile('examples/backend.eng','utf8')).replace('listen on 3000','listen on 0');
    await writeFile(join(temp,'server.mjs'),compile(source).code);await copyFile('dist/runtime.js',join(temp,'english-runtime.mjs'));
    child=spawn(process.execPath,[join(temp,'server.mjs')],{stdio:['ignore','pipe','pipe']});
    const base=await new Promise((accept,reject)=>{const timer=setTimeout(()=>reject(new Error('Server did not start')),5000);child.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);accept(match[0]);}});child.on('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited ${code}`));});child.on('error',reject);});
    const request=(path,options={})=>fetch(base+path,{signal:AbortSignal.timeout(3000),...options});
    assert.equal((await request('/health')).status,200);
    assert.equal((await request('/missing')).status,404);
    const json=(method,value)=>({method,headers:{'content-type':'application/json'},body:JSON.stringify(value)});
    let r=await request('/people',json('POST',{id:1,name:'Ali'}));assert.equal(r.status,201);assert.deepEqual(await r.json(),{id:1,name:'Ali'});
    r=await request('/people');assert.deepEqual(await r.json(),[{id:1,name:'Ali'}]);
    assert.equal((await request('/people',json('POST',{name:'Bad'}))).status,422);
    assert.equal((await request('/people',json('POST',{id:2,name:'Bad',admin:true}))).status,422);
    assert.equal((await request('/people',{method:'POST',headers:{'content-type':'application/json'},body:'{bad'})).status,400);
    assert.equal((await request('/people',{method:'POST',body:'hi'})).status,415);
    assert.equal((await request('/people',{method:'POST',headers:{'content-type':'application/json'},body:' '.repeat(1048577)})).status,413);
    r=await request('/people',json('PUT',{id:1,name:'Updated'}));assert.equal(r.status,200);
    r=await request('/people');assert.deepEqual(await r.json(),[{id:1,name:'Updated'}]);
    assert.equal((await request('/people/1',{method:'DELETE'})).status,200);
    r=await request('/people');assert.deepEqual(await r.json(),[]);
  }finally{if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(temp,{recursive:true,force:true});}
});
