export class ValidationError extends Error {status=422;}
export function createRuntime(schemas:Record<string,Record<string,string>>={}) {
  const models=new Map<string,{schema:string;rows:any[]}>();
  const routes:{method:string;path:string;handler:(request:any)=>Promise<any>}[]=[];
  const copy=(v:any)=>structuredClone(v);
  function validateType(type:string,value:any,path:string,depth=0):any {
    if(depth>64)throw new ValidationError(`${path}: record nesting exceeds 64 levels.`);
    if(type.startsWith('optional ')){if(value===null||value===undefined)return null;return validateType(type.slice(9),value,path,depth+1);}
    if(type.startsWith('list of ')){if(!Array.isArray(value))throw new ValidationError(`${path}: expected a list.`);return value.map((v,i)=>validateType(type.slice(8),v,`${path} item ${i+1}`,depth+1));}
    if(type==='any')return copy(value);
    if(['text','number','boolean'].includes(type)){if(typeof value!==(type==='text'?'string':type)||(type==='number'&&!Number.isFinite(value)))throw new ValidationError(`${path}: expected ${type}.`);return value;}
    const fields=schemas[type];
    if(!fields||value===null||Array.isArray(value)||typeof value!=='object')throw new ValidationError(`${path}: expected ${type}.`);
    for(const name of Object.keys(value))if(!Object.hasOwn(fields,name))throw new ValidationError(`${path}: unknown field ${name}.`);
    const result:Record<string,any>={};
    for(const [name,t] of Object.entries(fields))Object.defineProperty(result,name,{value:validateType(t,Object.hasOwn(value,name)?value[name]:undefined,`${path}.${name}`,depth+1),enumerable:true,writable:true,configurable:true});
    return result;
  }
  const api={
    validate:(name:string,value:any)=>validateType(name,value,name),
    divide:(a:number,b:number,remainder=false)=>{if(b===0)throw new Error('Cannot divide by zero.');const n=remainder?a%b:a/b;if(!Number.isFinite(n))throw new Error('Arithmetic result is not finite.');return n;},
    property:(v:any,k:string)=>{if(v===null||typeof v!=='object'||!Object.hasOwn(v,k)||['__proto__','prototype','constructor'].includes(k))throw new Error(`No property ${k}.`);return v[k];},
    external:(module:any,name:string,args:any[])=>{const fn=api.property(module,name);if(typeof fn!=='function')throw new Error(`${name} is not a function.`);return fn.apply(module,args);},
    item:(v:any[],i:number)=>{if(!Number.isInteger(i)||i<1)throw new Error('List positions are positive whole numbers starting at 1.');return v[i-1]??null;},
    length:(value:string|any[])=>{if(typeof value!=='string'&&!Array.isArray(value))throw new Error('length expects text or a list.');return value.length;},
    textOf:(value:any)=>typeof value==='string'?value:JSON.stringify(value),
    numberOf:(value:string)=>{if(!value.trim())throw new Error('Cannot turn empty text into a number.');const n=Number(value);if(!Number.isFinite(n))throw new Error('Text is not a finite number.');return n;},
    pause:async(milliseconds:number)=>{if(!Number.isFinite(milliseconds)||milliseconds<0||milliseconds>2147483647)throw new Error('Invalid pause duration.');await new Promise(resolve=>setTimeout(resolve,milliseconds));return null;},
    fetchText:async(url:string)=>{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error('fetchText requires HTTP or HTTPS.');const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);return await response.text();},
    model:(name:string,schema:string)=>{if(!schemas[schema])throw new Error('Unknown schema.');if(models.has(name))throw new Error('Duplicate model.');const m={schema,rows:[] as any[]};models.set(name,m);return m;},
    store:(m:{schema:string;rows:any[]},value:any)=>{m.rows.push(api.validate(m.schema,value));},
    all:(m:{rows:any[]})=>copy(m.rows),
    update:(m:{schema:string;rows:any[]},field:string,key:any,value:any)=>{const row=api.validate(m.schema,value);m.rows=m.rows.map(old=>old[field]===key?copy(row):old);},
    remove:(m:{rows:any[]},field:string,key:any)=>{m.rows=m.rows.filter(row=>row[field]!==key);},
    route:(method:string,path:string,handler:(request:any)=>Promise<any>)=>{routes.push({method,path,handler});},
    listen:async(port:number,host='127.0.0.1')=>{
      if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Port must be a whole number from 0 to 65535.');
      const {createServer}=await import('node:http');
      const server=createServer(async(req,res)=>{
        const send=(status:number,body:any)=>{if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
        try {
          const url=new URL(req.url??'/',`http://${host}`);const actual=url.pathname.split('/');
          let match:typeof routes[number]|undefined;let params:Record<string,string>=Object.create(null);
          for(const r of routes){if(r.method!==req.method)continue;const parts=r.path.split('/');if(parts.length!==actual.length)continue;const found:Record<string,string>=Object.create(null);if(parts.every((p,i)=>{if(p.startsWith(':')){found[p.slice(1)]=decodeURIComponent(actual[i]);return true;}return p===actual[i];})){match=r;params=found;break;}}
          if(!match){req.resume();send(404,{error:'Endpoint not found.'});return;}
          let bytes=0;const chunks:Uint8Array[]=[];
          for await(const chunk of req){bytes+=chunk.length;if(bytes>1048576){send(413,{error:'Request body exceeds 1 MiB.'});return;}chunks.push(chunk);}
          let body:any=null;
          if(bytes){if(!req.headers['content-type']?.split(';')[0].trim().match(/^application\/json$/i)){send(415,{error:'Send a JSON request body.'});return;}try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{send(400,{error:'Invalid JSON.'});return;}}
          const reply=await match.handler({body,params,query:Object.fromEntries(url.searchParams),path:url.pathname,method:req.method});
          if(!reply||!Number.isInteger(reply.status))throw new Error('Endpoint did not reply.');send(reply.status,reply.body);
        } catch(error:any){if(error instanceof URIError)send(400,{error:'Invalid URL encoding.'});else if(error instanceof ValidationError)send(422,{error:error.message});else{console.error(error);send(500,{error:'Internal server error.'});}}
      });
      server.requestTimeout=15000;server.headersTimeout=10000;
      await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});
      console.log(`Plain English server: http://${host}:${(server.address() as any).port}`);
      return server;
    }
  };
  return api;
}
