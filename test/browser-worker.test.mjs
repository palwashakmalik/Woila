import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile,access} from 'node:fs/promises';
test('browser worker executes its real module graph and reports program output',async()=>{
  // A web-worker self bridge checks shipped worker code without a graphical browser.
  const url=new URL('../web/worker.js',import.meta.url).href;
  const bootstrap=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:value=>parentPort.postMessage(value)};await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({type:'ready'});`;
  const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bootstrap)),{type:'module'});
  try{
    const messages=await new Promise((accept,reject)=>{const output=[];const timer=setTimeout(()=>reject(new Error('Worker deadline')),3000);worker.on('error',reject);worker.on('message',value=>{if(value.type==='ready')worker.postMessage('print "Browser worker works"');else{output.push(value);if(value.type==='done'||value.type==='error'){clearTimeout(timer);accept(output);}}});});
    assert.deepEqual(messages,[{type:'print',text:'Browser worker works'},{type:'done'}]);
  }finally{await worker.terminate();}
});
test('ready-to-load extension has complete local resources and no remote code or host permissions',async()=>{
  const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
  assert.equal(manifest.manifest_version,3);assert.equal(manifest.host_permissions,undefined);assert.equal(manifest.permissions,undefined);assert.doesNotMatch(manifest.content_security_policy.extension_pages,/unsafe-eval|https:/);
  for(const path of ['background.js','index.html','style.css','app.js','worker.js','lib/compiler.js','lib/interpreter.js','lib/runtime.js'])await access(`extension/${path}`);
  const app=await readFile('extension/app.js','utf8');assert.doesNotMatch(app,/\beval\s*\(|new Function\s*\(/);
  const html=await readFile('extension/index.html','utf8');assert.match(html,/type="module" src="app.js"/);
});
