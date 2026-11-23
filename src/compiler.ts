/** Plain English v0.1: tokenize -> parse -> check -> emit JavaScript. */
export type Token = { value:string; kind:'word'|'number'|'string'|'newline'|'eof'; line:number; column:number };
export type Node = { kind:string; line:number; [key:string]:any };
export class EnglishError extends Error {
  line:number; column:number;
  constructor(message:string, line=1, column=1) {
    super(`Line ${line}:${column}: ${message}`); this.name='EnglishError'; this.line=line; this.column=column;
  }
}
export function tokenize(source:string):Token[] {
  const out:Token[]=[]; let i=0,line=1,column=1;
  const push=(value:string,kind:Token['kind'],l=line,c=column)=>out.push({value,kind,line:l,column:c});
  while(i<source.length) {
    const c=source[i];
    if(c==='\r' || c===' ' || c==='\t'){i++;column++;continue;}
    if(c==='\n'){push('\n','newline');i++;line++;column=1;continue;}
    if(c==='#'){while(i<source.length && source[i]!=='\n'){i++;column++;}continue;}
    if(c==='"') {
      const start=i,l=line,col=column; i++;column++;
      while(i<source.length && source[i]!=='"') {
        if(source[i]==='\n') throw new EnglishError('A text literal must stay on one line.',l,col);
        if(source[i]==='\\'){i++;column++;}
        i++;column++;
      }
      if(i>=source.length)throw new EnglishError('Close this text with a double quote.',l,col);
      i++;column++;
      try{push(JSON.parse(source.slice(start,i)),'string',l,col);}catch{throw new EnglishError('Invalid text escape. Use JSON escapes such as \\n.',l,col);}
      continue;
    }
    const n=source.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if(n){if(!Number.isFinite(Number(n[0])))throw new EnglishError('Number must be finite.',line,column);push(n[0],'number');i+=n[0].length;column+=n[0].length;continue;}
    const w=source.slice(i).match(/^[A-Za-z][A-Za-z0-9_]*/);
    if(w){push(w[0],'word');i+=w[0].length;column+=w[0].length;continue;}
    throw new EnglishError(`Unexpected character ${JSON.stringify(c)}. Use English operators and double-quoted text.`,line,column);
  }
  push('\n','newline');push('','eof');return out;
}
const forbidden = new Set(['__proto__','prototype','constructor','then','end','as','with','and','or','of','in','to','be','returning','otherwise','on','true','false','nothing','the','a','an','plus','minus','times','divided','remainder','equals','is','not','wait','request','error','list','optional','number','text','boolean','any','void']);
const operators:[string[],number,string][] = [
  [['or'],1,'or'],[['and'],2,'and'],[['equals'],3,'eq'],[['is','not','equal','to'],3,'ne'],
  [['is','greater','than','or','equal','to'],4,'ge'],[['is','less','than','or','equal','to'],4,'le'],
  [['is','greater','than'],4,'gt'],[['is','less','than'],4,'lt'],
  [['plus'],5,'add'],[['minus'],5,'sub'],[['times'],6,'mul'],[['divided','by'],6,'div'],[['remainder','of'],6,'mod']
];
export class Parser {
  tokens:Token[]; pos=0;
  constructor(source:string){this.tokens=tokenize(source);}
  get t(){return this.tokens[this.pos];}
  error(message:string):never{throw new EnglishError(message,this.t.line,this.t.column);}
  at(...words:string[]){return words.every((v,i)=>this.tokens[this.pos+i]?.kind==='word' && this.tokens[this.pos+i]?.value===v);}
  eat(...words:string[]){if(this.at(...words)){this.pos+=words.length;return true;}return false;}
  need(...words:string[]){if(!this.eat(...words))this.error(`Expected "${words.join(' ')}".`);}
  name(){if(this.t.kind!=='word'||forbidden.has(this.t.value))this.error('Expected a single name (letters, digits and underscores), not a reserved word.');return this.tokens[this.pos++].value;}
  text(){if(this.t.kind!=='string')this.error('Expected double-quoted text.');return this.tokens[this.pos++].value;}
  nl(){if(this.t.kind!=='newline')this.error('Put each statement on its own line.');while(this.t.kind==='newline')this.pos++;}
  type():string {if(this.eat('optional'))return `optional ${this.type()}`;if(this.eat('list','of'))return `list of ${this.type()}`;if(this.t.kind!=='word')this.error('Expected a type.');return this.tokens[this.pos++].value;}
  program(){while(this.t.kind==='newline')this.pos++;const body=this.block();if(this.t.kind!=='eof')this.error('Unexpected block ending.');return body;}
  block():Node[]{const body:Node[]=[];while(this.t.kind!=='eof'&&!this.at('end')&&!this.at('otherwise')&&!this.at('on','error'))body.push(this.statement());return body;}
  end(){this.need('end');this.nl();}
  statement():Node {
    const line=this.t.line;let n:Node={kind:'',line};
    if(this.at('let')||this.at('keep')){const constant=this.eat('keep');if(!constant)this.need('let');const name=this.name();this.need('be');const type=this.type();this.need('as');n={kind:'let',line,name,type,constant,value:this.expr()};}
    else if(this.eat('set')){const name=this.name();this.need('to');n={kind:'set',line,name,value:this.expr()};}
    else if(this.eat('print'))n={kind:'print',line,value:this.expr()};
    else if(this.eat('if')){const condition=this.expr();this.nl();const body=this.block();let other:Node[]=[];if(this.eat('otherwise')){this.nl();other=this.block();}this.end();return {kind:'if',line,condition,body,other};}
    else if(this.eat('repeat','while')){const condition=this.expr();this.nl();const body=this.block();this.end();return {kind:'while',line,condition,body};}
    else if(this.eat('for','each')){const name=this.name();this.need('in');const value=this.expr();this.nl();const body=this.block();this.end();return {kind:'for',line,name,value,body};}
    else if(this.at('define')||this.at('share')){
      const shared=this.eat('share');if(!shared)this.need('define');
      const async=this.eat('async');this.need('function');const name=this.name(),params:{name:string;type:string}[]=[];
      if(this.eat('with')){do{const name=this.name();this.need('as');params.push({name,type:this.type()});}while(this.eat('and'));}
      this.need('returning');const type=this.type();this.nl();const body=this.block();this.end();return {kind:'function',line,name,params,type,async,shared,body};
    }
    else if(this.eat('return'))n={kind:'return',line,value:this.expr()};
    else if(this.eat('do'))n={kind:'do',line,value:this.expr()};
    else if(this.eat('raise'))n={kind:'raise',line,value:this.expr()};
    else if(this.eat('try')){this.nl();const body=this.block();this.need('on','error');const name=this.name();this.nl();const handler=this.block();this.end();return {kind:'try',line,body,name,handler};}
    else if(this.eat('unsafe')){this.nl();const body=this.block();this.end();return {kind:'unsafe',line,body};}
    else if(this.eat('schema')){
      const name=this.name();this.nl();const fields:{name:string;type:string}[]=[];
      while(!this.at('end')&&this.t.kind!=='eof'){this.need('field');const name=this.name();this.need('as');fields.push({name,type:this.type()});this.nl();}
      this.end();return {kind:'schema',line,name,fields};
    }
    else if(this.eat('model')){const name=this.name();this.need('for');n={kind:'model',line,name,schema:this.name()};}
    else if(this.eat('store')){const value=this.expr();this.need('in');n={kind:'store',line,value,model:this.name()};}
    else if(this.at('update','records','in')||this.at('remove','records','in')){const update=this.eat('update');if(!update)this.need('remove');this.need('records','in');const model=this.name();this.need('where');const field=this.name();this.need('equals');const key=this.expr();let value:Node|undefined;if(update){this.need('using');value=this.expr();}n={kind:update?'update':'remove',line,model,field,key,value};}
    else if(this.eat('serve')){const method=this.tokens[this.pos++].value;if(!['get','post','put','patch','delete'].includes(method))this.error('Use get, post, put, patch or delete.');const path=this.text();this.nl();const body=this.block();this.end();return {kind:'route',line,method,path,body};}
    else if(this.eat('reply')){const value=this.expr();let status=200;if(this.eat('with','status')){if(this.t.kind!=='number')this.error('Expected HTTP status number.');status=Number(this.tokens[this.pos++].value);if(!Number.isInteger(status)||status<200||status>599||status===204||status===205||status===304)this.error('Use a final HTTP status that permits a JSON body.');}n={kind:'reply',line,value,status};}
    else if(this.eat('listen','on'))n={kind:'listen',line,value:this.expr()};
    else if(this.eat('use')){const specifier=this.text();this.need('as');n={kind:'use',line,specifier,name:this.name()};}
    else this.error('Unknown sentence. Try "let name be text as \"Hello\"" or "print name".');
    this.nl();return n;
  }
  expr(min=0):Node {
    let left=this.primary();
    while(true){if(this.at('and','with'))break;const op=operators.find(([words,prec])=>prec>=min&&this.at(...words));if(!op)break;this.pos+=op[0].length;left={kind:'binary',line:left.line,op:op[2],left,right:this.expr(op[1]+1)};}
    return left;
  }
  primary():Node {
    const line=this.t.line;
    if(this.t.kind==='number')return {kind:'literal',line,value:Number(this.tokens[this.pos++].value)};
    if(this.t.kind==='string')return {kind:'literal',line,value:this.tokens[this.pos++].value};
    if(this.eat('true'))return {kind:'literal',line,value:true};if(this.eat('false'))return {kind:'literal',line,value:false};if(this.eat('nothing'))return {kind:'literal',line,value:null};
    if(this.eat('not'))return {kind:'not',line,value:this.expr(7)};
    if(this.eat('wait'))return {kind:'wait',line,value:this.expr(7)};
    if(this.eat('the','quantity')){const n=this.expr();this.need('end','quantity');return n;}
    if(this.eat('the','result','of')){
      const name=this.name(),module=this.eat('from')?this.name():undefined,args:{name:string;value:Node}[]=[];
      if(this.eat('with')){do{const name=this.name();this.need('as');args.push({name,value:this.expr()});}while(this.eat('and','with'));}
      this.need('end','call');return {kind:'call',line,name,module,args};
    }
    if(this.eat('a','list','containing')){const items:Node[]=[];if(!this.at('end','list')){items.push(this.expr());while(this.eat('then'))items.push(this.expr());}this.need('end','list');return {kind:'list',line,items};}
    if(this.eat('a','new')){const name=this.name(),fields:{name:string;value:Node}[]=[];if(this.eat('with')){do{const name=this.name();this.need('as');fields.push({name,value:this.expr()});}while(this.eat('and','with'));}this.need('end','record');return {kind:'record',line,name,fields};}
    if(this.eat('all','records','in'))return {kind:'records',line,name:this.name()};
    if(this.eat('validate')){const value=this.expr();this.need('as');return {kind:'validate',line,value,name:this.name()};}
    if(this.eat('item')){const index=this.expr();this.need('of');return {kind:'item',line,index,value:this.primary()};}
    if(this.eat('the')){const name=this.tokens[this.pos++].value;if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)||['__proto__','prototype','constructor'].includes(name))this.error('Invalid property.');this.need('of');return {kind:'property',line,name,value:this.primary()};}
    // request is a predeclared endpoint value, not a user-definable name.
    if(this.eat('request'))return {kind:'name',line,name:'request'};
    if(this.t.kind==='word')return {kind:'name',line,name:this.name()};
    this.error('Expected a value.');
  }
}
export function parse(source:string):Node[]{return new Parser(source).program();}

type Binding={type:string;constant?:boolean};
type Signature={params:{name:string;type:string}[];type:string;async:boolean};
type Context={async:boolean;returns?:string;route?:boolean;unsafe?:boolean;top?:boolean};
const builtins:Record<string,Signature>={
  length:{params:[{name:'value',type:'any'}],type:'number',async:false},
  textOf:{params:[{name:'value',type:'any'}],type:'text',async:false},
  numberOf:{params:[{name:'value',type:'text'}],type:'number',async:false},
  pause:{params:[{name:'milliseconds',type:'number'}],type:'void',async:true},
  fetchText:{params:[{name:'url',type:'text'}],type:'text',async:true},
};
export function check(program:Node[]):void {
  const schemas=new Map<string,Map<string,string>>(), funcs=new Map<string,Signature>(Object.entries(builtins));
  const root=new Map<string,Binding>(), claimed=new Set(Object.keys(builtins));
  const fail=(n:Node,msg:string):never=>{throw new EnglishError(msg,n.line);};
  const claim=(n:Node,name:string)=>{if(claimed.has(name))fail(n,`Name "${name}" is already declared.`);claimed.add(name);};
  for(const n of program){if(['schema','function','model','use'].includes(n.kind)){claim(n,n.name);if(n.kind==='schema')schemas.set(n.name,new Map());if(n.kind==='function')funcs.set(n.name,{params:n.params,type:n.type,async:n.async});}}
  function valid(t:string,n:Node,allowVoid=false):void {
    if(t.startsWith('optional '))return valid(t.slice(9),n);
    if(t.startsWith('list of '))return valid(t.slice(8),n);
    if(!['number','text','boolean','any',...(allowVoid?['void']:[])].includes(t)&&!schemas.has(t))fail(n,`Unknown or invalid type "${t}".`);
  }
  for(const n of program)if(n.kind==='schema'){const fields=schemas.get(n.name)!;for(const f of n.fields){valid(f.type,n);if(fields.has(f.name))fail(n,`Duplicate field "${f.name}".`);fields.set(f.name,f.type);}}
  const compatible=(expected:string,actual:string):boolean=>expected===actual||expected==='any'||(expected.startsWith('optional ')&&(actual==='nothing'||compatible(expected.slice(9),actual)))||(expected.startsWith('list of ')&&actual==='list of never');
  const requireType=(expected:string,actual:string,n:Node,c:Context)=>{if(actual==='any'&&!c.unsafe&&expected!=='any')fail(n,`Validate this dynamic value or use an unsafe block before treating it as ${expected}.`);if(!(c.unsafe&&actual==='any')&&!compatible(expected,actual))fail(n,`Expected ${expected}, received ${actual}.`);};
  function lookup(n:Node,env:Map<string,Binding>):Binding {const v=env.get(n.name);if(!v)fail(n,`Unknown name "${n.name}".`);return v!;}
  function expression(n:Node,env:Map<string,Binding>,c:Context):string {
    switch(n.kind){
      case 'literal':return n.value===null?'nothing':typeof n.value==='string'?'text':typeof n.value;
      case 'name':return lookup(n,env).type;
      case 'binary':{const a=expression(n.left,env,c),b=expression(n.right,env,c);if(['and','or'].includes(n.op)){requireType('boolean',a,n,c);requireType('boolean',b,n,c);return 'boolean';}if(['eq','ne'].includes(n.op)){if(!compatible(a,b)&&!compatible(b,a))fail(n,'Equality operands must have compatible types.');return 'boolean';}if(n.op==='add'&&a==='text'&&b==='text')return 'text';requireType('number',a,n,c);requireType('number',b,n,c);return ['gt','ge','lt','le'].includes(n.op)?'boolean':'number';}
      case 'not':requireType('boolean',expression(n.value,env,c),n,c);return 'boolean';
      case 'wait':{if(!c.async)fail(n,'wait requires an async function or top-level program.');const t=expression(n.value,env,c);if(t==='any'&&c.unsafe)return 'any';if(!t.startsWith('promise '))fail(n,'wait requires an async result.');return t.slice(8);}
      case 'call':{if(n.module){if(!c.unsafe)fail(n,'Calling an external module requires an unsafe block.');if(!env.has(n.module))fail(n,'Unknown external module.');const seen=new Set();for(const a of n.args){if(seen.has(a.name))fail(n,'Duplicate argument label.');seen.add(a.name);expression(a.value,env,c);}return 'any';}const f=funcs.get(n.name);if(!f)fail(n,`Unknown function "${n.name}".`);const seen=new Set<string>();for(const a of n.args){if(seen.has(a.name))fail(n,`Duplicate argument "${a.name}".`);seen.add(a.name);const p=f!.params.find(p=>p.name===a.name);if(!p)fail(n,`Unknown argument "${a.name}" for ${n.name}.`);const t=expression(a.value,env,c);requireType(p!.type,t,n,c);}for(const p of f!.params)if(!seen.has(p.name))fail(n,`Missing argument "${p.name}".`);if(n.name==='length'){const t=expression(n.args[0].value,env,c);if(t!=='text'&&!t.startsWith('list of '))fail(n,'length needs text or a list.');}return f!.async?`promise ${f!.type}`:f!.type;}
      case 'list':{if(!n.items.length)return 'list of never';const t=expression(n.items[0],env,c);for(const v of n.items)requireType(t,expression(v,env,c),v,c);return `list of ${t}`;}
      case 'record':{const s=schemas.get(n.name);if(!s)fail(n,`Unknown schema "${n.name}".`);const seen=new Set();for(const f of n.fields){if(seen.has(f.name))fail(n,`Duplicate field "${f.name}".`);seen.add(f.name);if(!s!.has(f.name))fail(n,`Unknown field "${f.name}".`);requireType(s!.get(f.name)!,expression(f.value,env,c),f.value,c);}for(const [name,t] of s!)if(!seen.has(name)&&!t.startsWith('optional '))fail(n,`Missing field "${name}".`);return n.name;}
      case 'property':{const t=expression(n.value,env,c);if(t==='Request')return n.name==='body'?'any':['path','method'].includes(n.name)?'text':['params','query'].includes(n.name)?'any':fail(n,'Unknown request property.');if(t==='any'){if(!c.unsafe)fail(n,'Dynamic property access requires an unsafe block.');return 'any';}if(t.startsWith('optional '))fail(n,'Use a checked non-null value; optional property access is not implicit.');const fields=schemas.get(t);if(!fields?.has(n.name))fail(n,`Type ${t} has no field "${n.name}".`);return fields!.get(n.name)!;}
      case 'item':{requireType('number',expression(n.index,env,c),n,c);const t=expression(n.value,env,c);if(!t.startsWith('list of '))fail(n,'item needs a list.');return `optional ${t.slice(8)}`;}
      case 'records':{const t=lookup(n,env).type;if(!t.startsWith('model '))fail(n,'Expected a model.');return `list of ${t.slice(6)}`;}
      case 'validate':expression(n.value,env,c);if(!schemas.has(n.name))fail(n,'Validation requires a schema.');return n.name;
      default:return fail(n,`Unsupported expression ${n.kind}.`);
    }
  }
  const terminates=(body:Node[]):boolean=>body.some(n=>['return','raise','reply'].includes(n.kind)||(n.kind==='if'&&terminates(n.body)&&terminates(n.other))||(n.kind==='try'&&terminates(n.body)&&terminates(n.handler))||(n.kind==='unsafe'&&terminates(n.body)));
  function block(body:Node[],env:Map<string,Binding>,c:Context){
    const local=new Set<string>();
    const bind=(n:Node,name:string,type:string,constant=false)=>{if(local.has(name)||env.has(name)||claimed.has(name))fail(n,`Name "${name}" is already declared; shadowing is not allowed.`);local.add(name);env.set(name,{type,constant});};
    for(const n of body){
      if(['schema','model','function','route','listen','use'].includes(n.kind)&&!c.top)fail(n,`${n.kind} belongs at the top level.`);
      switch(n.kind){
        case 'schema':break;
        case 'let':valid(n.type,n);if(n.type==='any'&&!c.unsafe)fail(n,'Declare any only inside an unsafe block.');requireType(n.type,expression(n.value,env,c),n,c);bind(n,n.name,n.type,n.constant);break;
        case 'set':{const b=lookup(n,env);if(b.constant)fail(n,`Cannot change constant "${n.name}".`);requireType(b.type,expression(n.value,env,c),n,c);break;}
        case 'print':{const t=expression(n.value,env,c);if(t.startsWith('promise '))fail(n,'Wait for an async value before printing it.');break;}
        case 'raise':requireType('text',expression(n.value,env,c),n,c);break;
        case 'do':{const t=expression(n.value,env,c);if(!['call','wait'].includes(n.value.kind))fail(n,'do requires a function call or wait.');if(t.startsWith('promise '))fail(n,'Use wait for an async call.');break;}
        case 'return':if(!c.returns)fail(n,'return belongs inside a function.');requireType(c.returns,expression(n.value,env,c)==='nothing'&&c.returns==='void'?'void':expression(n.value,env,c),n,c);break;
        case 'if':requireType('boolean',expression(n.condition,env,c),n,c);block(n.body,new Map(env),{...c,top:false});block(n.other,new Map(env),{...c,top:false});break;
        case 'while':requireType('boolean',expression(n.condition,env,c),n,c);block(n.body,new Map(env),{...c,top:false});break;
        case 'for':{const t=expression(n.value,env,c);if(!t.startsWith('list of '))fail(n,'for each requires a list.');const e=new Map(env);if(e.has(n.name)||claimed.has(n.name))fail(n,'Loop name is already declared.');e.set(n.name,{type:t.slice(8),constant:true});block(n.body,e,{...c,top:false});break;}
        case 'function':{valid(n.type,n,true);const e=new Map<string,Binding>();for(const [name,sig] of funcs)e.set(name,{type:'function',constant:true});for(const p of n.params){valid(p.type,n);if(e.has(p.name)||claimed.has(p.name))fail(n,`Duplicate or reserved parameter "${p.name}".`);e.set(p.name,{type:p.type});}block(n.body,e,{async:n.async,returns:n.type});if(n.type!=='void'&&!terminates(n.body))fail(n,`Function ${n.name} must return on every path.`);break;}
        case 'unsafe':block(n.body,new Map(env),{...c,unsafe:true,top:false});break;
        case 'try':block(n.body,new Map(env),{...c,top:false});{const e=new Map(env);if(e.has(n.name)||claimed.has(n.name))fail(n,'Error name is already declared.');e.set(n.name,{type:'text',constant:true});block(n.handler,e,{...c,top:false});}break;
        case 'model':if(!schemas.has(n.schema))fail(n,'A model needs a declared schema.');env.set(n.name,{type:`model ${n.schema}`,constant:true});break;
        case 'store':{const t=env.get(n.model)?.type;if(!t?.startsWith('model '))fail(n,'Unknown model.');requireType(t!.slice(6),expression(n.value,env,c),n,c);break;}
        case 'update':case 'remove':{const t=env.get(n.model)?.type;if(!t?.startsWith('model '))fail(n,'Unknown model.');const schema=t!.slice(6),field=schemas.get(schema)?.get(n.field);if(!field)fail(n,'Unknown model field.');if(!['number','text','boolean'].includes(field!))fail(n,'Match records using a number, text or boolean field.');requireType(field!,expression(n.key,env,c),n,c);if(n.kind==='update')requireType(schema,expression(n.value,env,c),n,c);break;}
        case 'route':{if(!n.path.startsWith('/')||n.path.includes('?')||n.path.includes('#'))fail(n,'Route paths start with / and exclude query strings and fragments.');const e=new Map(env);e.set('request',{type:'Request',constant:true});block(n.body,e,{async:true,route:true});if(!terminates(n.body))fail(n,'An endpoint must reply on every path.');break;}
        case 'reply':if(!c.route)fail(n,'reply belongs in an endpoint.');if(expression(n.value,env,c).startsWith('promise '))fail(n,'Wait for an async value before replying.');break;
        case 'listen':requireType('number',expression(n.value,env,c),n,c);break;
        case 'use':env.set(n.name,{type:'any',constant:true});break;
      }
    }
  }
  const routes=new Set();let listeners=0;
  for(const n of program){if(n.kind==='route'){const key=n.method+' '+n.path.replace(/:[A-Za-z][A-Za-z0-9_]*/g,':');if(routes.has(key))fail(n,'Duplicate endpoint pattern.');routes.add(key);}if(n.kind==='listen'&&++listeners>1)fail(n,'Use only one listen statement.');}
  if(listeners&&program[program.length-1]?.kind!=='listen')fail(program.find(n=>n.kind==='listen')!,'Put listen at the end of the program.');
  block(program,root,{async:true,top:true});
}

const jsName=(s:string)=>`v_${s}`;
const q=(x:any)=>JSON.stringify(x);
const binary:Record<string,string>={add:'+',sub:'-',mul:'*',eq:'===',ne:'!==',gt:'>',ge:'>=',lt:'<',le:'<=',and:'&&',or:'||'};
export function emit(program:Node[]):string {
  const signatures=new Map(Object.entries(builtins));for(const n of program)if(n.kind==='function')signatures.set(n.name,n as any);
  function expr(n:Node):string {
    switch(n.kind){
      case 'literal':return q(n.value);
      case 'name':return n.name==='request'?'request':jsName(n.name);
      case 'binary':if(n.op==='div'||n.op==='mod')return `__rt.divide(${expr(n.left)}, ${expr(n.right)}, ${n.op==='mod'})`;return `(${expr(n.left)} ${binary[n.op]} ${expr(n.right)})`;
      case 'not':return `(!${expr(n.value)})`;
      case 'wait':return `(await ${expr(n.value)})`;
      case 'call':{if(n.module)return `__rt.external(${jsName(n.module)},${q(n.name)},[${n.args.map((a:any)=>expr(a.value)).join(',')}])`;const f=signatures.get(n.name)!;const vals=f.params.map(p=>expr(n.args.find((a:any)=>a.name===p.name).value));return `${Object.hasOwn(builtins,n.name)?'__rt.'+n.name:jsName(n.name)}(${vals.join(', ')})`;}
      case 'list':return `[${n.items.map(expr).join(', ')}]`;
      case 'record':return `__rt.validate(${q(n.name)}, {${n.fields.map((f:any)=>`${q(f.name)}:${expr(f.value)}`).join(',')}})`;
      case 'property':return `__rt.property(${expr(n.value)},${q(n.name)})`;
      case 'item':return `__rt.item(${expr(n.value)}, ${expr(n.index)})`;
      case 'records':return `__rt.all(${jsName(n.name)})`;
      case 'validate':return `__rt.validate(${q(n.name)}, ${expr(n.value)})`;
      default:throw new EnglishError('Cannot emit '+n.kind,n.line);
    }
  }
  function block(body:Node[],indent=''):string {return body.map(n=>{
    let s='';switch(n.kind){
      case 'let':s=`${n.constant?'const':'let'} ${jsName(n.name)} = ${expr(n.value)};`;break;
      case 'set':s=`${jsName(n.name)} = ${expr(n.value)};`;break;
      case 'print':s=`console.log(${expr(n.value)});`;break;
      case 'do':s=`${expr(n.value)};`;break;
      case 'return':s=`return ${expr(n.value)};`;break;
      case 'raise':s=`throw new Error(${expr(n.value)});`;break;
      case 'if':s=`if (${expr(n.condition)}) {\n${block(n.body,indent+'  ')}\n${indent}} else {\n${block(n.other,indent+'  ')}\n${indent}}`;break;
      case 'while':s=`while (${expr(n.condition)}) {\n${block(n.body,indent+'  ')}\n${indent}}`;break;
      case 'for':s=`for (const ${jsName(n.name)} of ${expr(n.value)}) {\n${block(n.body,indent+'  ')}\n${indent}}`;break;
      case 'function':s=`${n.async?'async ':''}function ${jsName(n.name)}(${n.params.map((p:any)=>jsName(p.name)).join(',')}) {\n${block(n.body,indent+'  ')}\n${indent}}${n.shared?'\nexport { '+jsName(n.name)+' as '+n.name+' };':''}`;break;
      case 'unsafe':s=`{\n${block(n.body,indent+'  ')}\n${indent}}`;break;
      case 'try':s=`try {\n${block(n.body,indent+'  ')}\n${indent}} catch (__caught) {\n${indent}  const ${jsName(n.name)} = String(__caught?.message ?? __caught);\n${block(n.handler,indent+'  ')}\n${indent}}`;break;
      case 'schema':s='';break;
      case 'model':s=`const ${jsName(n.name)} = __rt.model(${q(n.name)}, ${q(n.schema)});`;break;
      case 'store':s=`__rt.store(${jsName(n.model)}, ${expr(n.value)});`;break;
      case 'update':case 'remove':s=`__rt.${n.kind}(${jsName(n.model)}, ${q(n.field)}, ${expr(n.key)}${n.kind==='update'?', '+expr(n.value):''});`;break;
      case 'route':s=`__rt.route(${q(n.method.toUpperCase())}, ${q(n.path)}, async (request) => {\n${block(n.body,indent+'  ')}\n${indent}});`;break;
      case 'reply':s=`return {status:${n.status}, body:${expr(n.value)}};`;break;
      case 'listen':s=`await __rt.listen(${expr(n.value)});`;break;
      case 'use':s=`const ${jsName(n.name)} = await import(${q(n.specifier)});`;break;
    }
    return s?`${indent}// English line ${n.line}\n${indent}${s}`:'';
  }).filter(Boolean).join('\n');}
  const definitions=Object.fromEntries(program.filter(n=>n.kind==='schema').map(n=>[n.name,Object.fromEntries(n.fields.map((f:any)=>[f.name,f.type]))]));
  return `// Generated by Plain English 0.1.0\nimport { createRuntime } from './english-runtime.mjs';\nconst __rt = createRuntime(${q(definitions)});\n${block(program)}\n`;
}
export function compile(source:string):{ast:Node[];code:string}{const ast=parse(source);check(ast);return {ast,code:emit(ast)};}
