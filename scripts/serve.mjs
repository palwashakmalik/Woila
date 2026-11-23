import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../web',import.meta.url)),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.eng':'text/plain'};
const server=createServer(async(req,res)=>{
  try{const url=new URL(req.url,'http://localhost');const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}const content=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream','x-content-type-options':'nosniff'});res.end(content);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Plain English Studio: http://127.0.0.1:4173'));
