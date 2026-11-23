import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync,spawn} from 'node:child_process';
const cli=resolve('bin/english.mjs');
test('init makes a valid starter and refuses to overwrite existing files',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'woila-starter-'));
  try{
    let result=spawnSync(process.execPath,[cli,'init','my-app','--skip-install'],{cwd:temp,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
    const project=join(temp,'my-app');const pkg=JSON.parse(await readFile(join(project,'package.json'),'utf8'));
    const metadata=JSON.parse(await readFile('package.json','utf8'));
    assert.equal(pkg.scripts.start,'woila run main.eng');assert.equal(pkg.devDependencies['@palwashakmalik/woila'],`git+https://github.com/palwashakmalik/Woila.git#v${metadata.version}`);
    result=spawnSync(process.execPath,[cli,'run',join(project,'main.eng')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Hello, world!/);
    await writeFile(join(project,'main.eng'),'print "keep my work"');
    result=spawnSync(process.execPath,[cli,'init','my-app','--skip-install'],{cwd:temp,encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/already exists/);assert.equal(await readFile(join(project,'main.eng'),'utf8'),'print "keep my work"');
    result=spawnSync(process.execPath,[cli,'init','../outside','--skip-install'],{cwd:temp,encoding:'utf8'});assert.equal(result.status,1);
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('studio serves installed assets from an unrelated working directory',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'woila-studio-'));let child;
  try{
    child=spawn(process.execPath,[cli,'studio'],{cwd:temp,stdio:['ignore','pipe','pipe']});
    await new Promise((accept,reject)=>{const timer=setTimeout(()=>reject(new Error('studio did not start')),5000);child.stdout.once('data',()=>{clearTimeout(timer);accept();});child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(new Error(`studio exited ${code}`));});});
    const response=await fetch('http://127.0.0.1:4173',{signal:AbortSignal.timeout(3000)});assert.equal(response.status,200);assert.match(await response.text(),/Woila Studio/);
    const module=await fetch('http://127.0.0.1:4173/lib/compiler.js',{signal:AbortSignal.timeout(3000)});assert.equal(module.status,200);assert.match(await module.text(),/function compile/);
  }finally{if(child&&child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}await rm(temp,{recursive:true,force:true});}
});
