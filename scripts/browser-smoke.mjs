import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
let playwright;
try{playwright=await import('playwright');}catch{
  if(!process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)throw new Error('Install optional Playwright first: npm install --no-save playwright');
  playwright=await import(pathToFileURL(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright/index.mjs')).href);
}
let executablePath=process.env.CHROMIUM_PATH;
if(!executablePath){try{await access('/usr/bin/chromium');executablePath='/usr/bin/chromium';}catch{}}
const server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:'pipe'});
const temp=await mkdtemp(join(tmpdir(),'english-browser-'));let browser,context;
try{
  await new Promise((accept,reject)=>{const timer=setTimeout(()=>reject(new Error('Editor server did not start.')),5000);server.stdout.once('data',()=>{clearTimeout(timer);accept();});server.on('error',reject);});
  browser=await playwright.chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  const run=async()=>{await page.getByRole('button',{name:'Run program'}).click();await page.waitForFunction(()=>['Finished','Needs a fix'].includes(document.getElementById('status').textContent));return page.locator('#output').innerText();};
  assert.match(await run(),/Hello, world/);
  await page.selectOption('#example','functions');assert.match(await run(),/Hello, Ali/);
  await page.selectOption('#example','loops');assert.match(await run(),/72\n24\n20/);
  await page.selectOption('#example','async');assert.match(await run(),/Something went wrong/);
  await page.selectOption('#example','backend');assert.match(await run(),/Node CLI/);
  await page.fill('#source','let age be number as "wrong"');await page.getByRole('button',{name:'Check',exact:true}).click();assert.match(await page.locator('#output').innerText(),/Expected number/);
  await page.fill('#source','print "Saved program"');await page.reload();assert.equal(await page.locator('#source').inputValue(),'print "Saved program"');
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save .eng',exact:true}).click();const download=await downloadEvent;assert.equal(await readFile(await download.path(),'utf8'),'print "Saved program"');
  await page.fill('#source','do wait the result of pause with milliseconds as 10000 end call');await page.getByRole('button',{name:'Run program'}).click();await page.getByRole('button',{name:'Stop',exact:true}).click();assert.equal(await page.locator('#status').innerText(),'Stopped');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.setViewportSize({width:1440,height:1000});await page.selectOption('#example','functions');await run();
  if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: editor examples, worker execution, diagnostics, persistence, download, Stop, mobile layout.');
  await browser.close();browser=undefined;
  const extension=resolve('extension');
  context=await playwright.chromium.launchPersistentContext(join(temp,'profile'),{headless:true,executablePath,args:['--no-sandbox',`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
  let sw=context.serviceWorkers()[0];if(!sw)sw=await context.waitForEvent('serviceworker',{timeout:10000});
  const extensionId=new URL(sw.url()).host;
  const extPage=await context.newPage();const extErrors=[];extPage.on('pageerror',error=>extErrors.push(error.message));
  await extPage.goto(`chrome-extension://${extensionId}/index.html`);
  await extPage.getByRole('button',{name:'Run program'}).click();await extPage.waitForFunction(()=>document.getElementById('status').textContent==='Finished');
  assert.match(await extPage.locator('#output').innerText(),/Hello, world/);assert.deepEqual(extErrors,[]);
  console.log('PASS: loaded Manifest V3 extension and executed its module worker under extension CSP.');
}finally{await browser?.close();await context?.close();server.kill();await rm(temp,{recursive:true,force:true});}
