#!/usr/bin/env node
import {readFile,writeFile,mkdtemp,rm,copyFile,mkdir} from 'node:fs/promises';
import {dirname,resolve,join,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {compile} from '../dist/compiler.js';
const args=process.argv.slice(2),command=args.shift();
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const help=`Woila ${version} — Node 24 or newer

woila init my-app
woila studio
woila mcp
woila mcp-config

woila check program.eng
woila compile program.eng [--out output.mjs]
woila run program.eng [--timeout milliseconds]
woila --help

Compile creates JavaScript and english-runtime.mjs next to the output.
Run executes your program with normal Node permissions. Only run trusted programs.
Browser extension: load the extension folder as an unpacked Chrome extension.
`;
if(!command||command==='--help'){console.log(help);process.exit(0);}
if(command==='--version'){console.log(version);process.exit(0);}
if(command==='mcp-config'){
  if(args.length){console.error('mcp-config takes no arguments.');process.exit(1);}
  console.log(JSON.stringify({mcpServers:{woila:{command:process.execPath,args:[fileURLToPath(import.meta.url),'mcp']}}},null,2));
}else if(command==='mcp'){
  if(args.length){console.error('Use woila mcp without arguments. Your MCP client starts and communicates with this stdio server.');process.exit(1);}
  try{const {startMcpServer}=await import('../dist/mcp.js');startMcpServer();}catch(error){console.error('Woila MCP failed to start: '+error.message);process.exitCode=1;}
}else if(command==='studio'){
  if(args.length){console.error('studio takes no arguments.');process.exit(1);}
  await import('../scripts/serve.mjs');
}else if(command==='init'){
  const name=args.shift(),skipInstall=args.length===1&&args[0]==='--skip-install';
  if(!name||(args.length&&!skipInstall)||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)){console.error('Use woila init NAME [--skip-install] with a simple new folder name.');process.exit(1);}
  const folder=resolve(name);
  try{
    await mkdir(folder); // Deliberately refuse to overwrite any existing directory.
    const starter=await readFile(new URL('../examples/hello.eng',import.meta.url),'utf8');
    await writeFile(join(folder,'main.eng'),starter,{flag:'wx'});
    await writeFile(join(folder,'package.json'),JSON.stringify({name:name.toLowerCase(),version:'0.1.0',private:true,scripts:{start:'woila run main.eng',check:'woila check main.eng',studio:'woila studio'},devDependencies:{'@palwashakmalik/woila':`https://github.com/palwashakmalik/Woila/releases/download/v${version}/palwashakmalik-woila-${version}.tgz`}},null,2)+'\n',{flag:'wx'});
    await writeFile(join(folder,'README.md'),`# ${name}\n\nEdit main.eng to write your program.\n\nRun npm install once, then npm start.\nUse npm run studio for the browser editor.\n`,{flag:'wx'});
    if(!skipInstall){
      console.log(`Created ${name}. Installing the pinned compiler dependency...`);
      const npm=process.platform==='win32'?'npm.cmd':'npm';
      const result=await new Promise((accept,reject)=>{const child=spawn(npm,['install'],{cwd:folder,stdio:'inherit',shell:process.platform==='win32'});child.on('error',reject);child.on('exit',code=>accept(code));});
      if(result!==0)throw new Error(`Project files were created, but npm install failed. Retry npm install inside ${name}.`);
    }
    console.log(`Created ${name}.\n\nNext:\n  cd ${name}\n${skipInstall?'  npm install\n':''}  npm start`);
  }catch(error){console.error(error.code==='EEXIST'?`Folder ${name} already exists; no existing files were changed.`:error.message);process.exitCode=1;}
}else{
try {
  if(!['check','compile','run'].includes(command))throw new Error('Unknown command. Use woila --help.');
  const input=args.shift();if(!input||input.startsWith('--'))throw new Error('Supply a .eng source file.');
  const sourcePath=resolve(input);if(extname(sourcePath)!=='.eng')throw new Error('Source files must end with .eng.');
  let output=sourcePath.replace(/\.eng$/,'.generated.mjs'),timeout=0;
  while(args.length){const flag=args.shift(),value=args.shift();if(!value)throw new Error(`Missing value for ${flag}.`);if(flag==='--out'&&command==='compile')output=resolve(value);else if(flag==='--timeout'&&command==='run'){timeout=Number(value);if(!Number.isInteger(timeout)||timeout<1||timeout>2147483647)throw new Error('Timeout must be a positive integer up to 2147483647.');}else throw new Error(`Unknown option ${flag}.`);}
  const {code}=compile(await readFile(sourcePath,'utf8'));
  if(command==='check'){console.log(`${input}: valid`);process.exit(0);}
  const runtimePath=fileURLToPath(new URL('../dist/runtime.js',import.meta.url));
  if(command==='compile'){
    if(extname(output)!=='.mjs')throw new Error('Compiled output must end with .mjs.');
    await mkdir(dirname(output),{recursive:true});
    const destination=join(dirname(output),'english-runtime.mjs');
    const runtime=await readFile(runtimePath,'utf8');
    try{const existing=await readFile(destination,'utf8');if(existing!==runtime)throw new Error('Refusing to overwrite an unrelated english-runtime.mjs. Choose a fresh output folder.');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(output===destination)throw new Error('Output name english-runtime.mjs is reserved.');
    await writeFile(destination,runtime);await writeFile(output,code);console.log(output);
  }else{
    const temp=await mkdtemp(join(dirname(sourcePath),'.english-run-'));
    try {
      // Resolve source-relative imports before moving the generated entry into its temporary folder.
      const entry=join(temp,'program.mjs');
      const resolvedCode=code.replace(/await import\(("(?:[^"\\]|\\.)*")\)/g,(whole,literal)=>{const name=JSON.parse(literal);return name.startsWith('.')?`await import(${JSON.stringify(pathToFileURL(resolve(dirname(sourcePath),name)).href)})`:whole;});
      await writeFile(entry,resolvedCode);await copyFile(runtimePath,join(temp,'english-runtime.mjs'));
      const child=spawn(process.execPath,[entry],{stdio:'inherit',cwd:dirname(sourcePath)});
      let timedOut=false;
      const timer=timeout?setTimeout(()=>{timedOutOut();},timeout):undefined;
      function timedOutOut(){timedOut=true;child.kill('SIGKILL');}
      const forward=()=>child.kill('SIGTERM');process.on('SIGINT',forward);process.on('SIGTERM',forward);
      try{const result=await new Promise((accept,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>accept({code,signal}));});if(timedOut){console.error(`Execution stopped after ${timeout} ms.`);process.exitCode=124;}else process.exitCode=result.code??1;}finally{if(timer)clearTimeout(timer);process.off('SIGINT',forward);process.off('SIGTERM',forward);}
    }finally{await rm(temp,{recursive:true,force:true});}
  }
}catch(error){console.error(error.message);process.exitCode=1;}
}
