/** The browser executes checked ASTs, never eval or generated JavaScript. */
import { compile, EnglishError, type Node } from './compiler.ts';
import { createRuntime } from './runtime.ts';
class Scope {
  values=new Map<string,any>();parent?:Scope;
  constructor(parent?:Scope){this.parent=parent;}
  get(name:string):any{if(this.values.has(name))return this.values.get(name);if(this.parent)return this.parent.get(name);throw new Error(`Unknown name ${name}.`);}
  set(name:string,value:any){if(this.values.has(name))this.values.set(name,value);else if(this.parent)this.parent.set(name,value);else throw new Error(`Unknown name ${name}.`);}
}
class ReturnValue {value:any;constructor(value:any){this.value=value;}}
class BudgetError extends EnglishError {}
export async function run(source:string,options:{print?:(text:string)=>void;maxSteps?:number;maxDepth?:number;browser?:boolean}={}) {
  const {ast}=compile(source), root=new Scope();let steps=0,depth=0;
  const maxSteps=options.maxSteps??100000,maxDepth=options.maxDepth??128;
  const schemas=Object.fromEntries(ast.filter(n=>n.kind==='schema').map(n=>[n.name,Object.fromEntries(n.fields.map((f:any)=>[f.name,f.type]))]));
  const rt=createRuntime(schemas);
  const tick=(n:Node)=>{if(++steps>maxSteps)throw new BudgetError(`Execution stopped after ${maxSteps} steps.`,n.line);};
  const funcs=new Map(ast.filter(n=>n.kind==='function').map(n=>[n.name,n]));
  async function expr(n:Node,s:Scope):Promise<any>{
    tick(n);
    switch(n.kind){
      case 'literal':return n.value;
      case 'name':return s.get(n.name);
      case 'binary':{
        const a=await expr(n.left,s);
        if(n.op==='and'&&!a)return false;if(n.op==='or'&&a)return true;
        const b=await expr(n.right,s);
        switch(n.op){case 'add':return a+b;case 'sub':return a-b;case 'mul':return a*b;case 'div':return rt.divide(a,b);case 'mod':return rt.divide(a,b,true);case 'eq':return a===b;case 'ne':return a!==b;case 'gt':return a>b;case 'ge':return a>=b;case 'lt':return a<b;case 'le':return a<=b;case 'and':return a&&b;case 'or':return a||b;}break;
      }
      case 'not':return !(await expr(n.value,s));
      case 'wait':return await expr(n.value,s);
      case 'list':{const a=[];for(const item of n.items)a.push(await expr(item,s));return a;}
      case 'record':{const obj:Record<string,any>={};for(const f of n.fields)obj[f.name]=await expr(f.value,s);return rt.validate(n.name,obj);}
      case 'property':return rt.property(await expr(n.value,s),n.name);
      case 'item':{const index=await expr(n.index,s);return rt.item(await expr(n.value,s),index);}
      case 'validate':return rt.validate(n.name,await expr(n.value,s));
      case 'records':return rt.all(s.get(n.name));
      case 'call':{
        if(n.module)throw new Error('External modules run with the Node CLI.');
        const f=funcs.get(n.name);const args:Record<string,any>={};
        // Evaluate in parameter order, the same order as emitted JavaScript.
        const params=f?.params??({length:['value'],textOf:['value'],numberOf:['value'],pause:['milliseconds'],fetchText:['url']} as Record<string,string[]>)[n.name].map(name=>({name}));
        for(const p of params)args[p.name]=await expr(n.args.find((a:any)=>a.name===p.name).value,s);
        if(!f){if(n.name==='fetchText'&&options.browser!==false)throw new Error('Network access is disabled in the browser runner.');return await (rt as any)[n.name](...params.map((p:any)=>args[p.name]));}
        if(++depth>maxDepth)throw new Error('Maximum function depth exceeded.');
        const e=new Scope();for(const p of f.params)e.values.set(p.name,args[p.name]);
        try{await block(f.body,e);return null;}catch(v){if(v instanceof ReturnValue)return v.value;throw v;}finally{depth--;}
      }
    }
    throw new Error(`Unsupported expression ${n.kind}.`);
  }
  async function block(body:Node[],s:Scope):Promise<void>{
    for(const n of body){tick(n);try{
      switch(n.kind){
        case 'schema':case 'function':break;
        case 'let':s.values.set(n.name,await expr(n.value,s));break;
        case 'set':s.set(n.name,await expr(n.value,s));break;
        case 'print':{const v=await expr(n.value,s);options.print?.(typeof v==='string'?v:JSON.stringify(v));break;}
        case 'do':await expr(n.value,s);break;
        case 'return':throw new ReturnValue(await expr(n.value,s));
        case 'raise':throw new Error(await expr(n.value,s));
        case 'if':await block(await expr(n.condition,s)?n.body:n.other,new Scope(s));break;
        case 'while':while(await expr(n.condition,s)){tick(n);await block(n.body,new Scope(s));}break;
        case 'for':for(const v of await expr(n.value,s)){const e=new Scope(s);e.values.set(n.name,v);await block(n.body,e);}break;
        case 'unsafe':await block(n.body,new Scope(s));break;
        case 'try':try{await block(n.body,new Scope(s));}catch(v:any){if(v instanceof ReturnValue||v instanceof BudgetError)throw v;const e=new Scope(s);e.values.set(n.name,String(v.message??v));await block(n.handler,e);}break;
        case 'model':s.values.set(n.name,rt.model(n.name,n.schema));break;
        case 'store':rt.store(s.get(n.model),await expr(n.value,s));break;
        case 'update':{const key=await expr(n.key,s);rt.update(s.get(n.model),n.field,key,await expr(n.value,s));break;}
        case 'remove':rt.remove(s.get(n.model),n.field,await expr(n.key,s));break;
        case 'use':case 'route':case 'listen':throw new Error('Servers and external modules run with the Node CLI. Download this program and use woila run.');
        default:throw new Error(`Unsupported sentence ${n.kind}.`);
      }
    }catch(error:any){if(error instanceof ReturnValue||error instanceof EnglishError)throw error;throw new EnglishError(error.message??String(error),n.line);}}
  }
  await block(ast,root);return {steps};
}
