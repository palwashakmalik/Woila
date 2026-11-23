import {run} from './lib/interpreter.js';
let outputCount=0,outputBytes=0;
self.onmessage=async(event)=>{
  try{await run(event.data,{browser:true,maxSteps:100000,print:text=>{outputBytes+=text.length;if(++outputCount>1000||outputBytes>200000)throw new Error('Output limit reached.');self.postMessage({type:'print',text});}});self.postMessage({type:'done'});}catch(error){self.postMessage({type:'error',text:error.message});}
};
