import {compile} from './lib/compiler.js';
const $=id=>document.getElementById(id);
const examples={
hello:`# Your first English program
keep greeting be text as "Hello, world!"
print greeting

let count be number as 3
repeat while count is greater than 0
  print count
  set count to count minus 1
end
print "You made it run."
`,
functions:`schema Person
  field name as text
  field age as number
end

define function greet with person as Person returning text
  return "Hello, " plus the name of person
end

keep friend be Person as a new Person with name as "Ali" and with age as 28 end record
print the result of greet with person as friend end call
`,
loops:`keep scores be list of number as a list containing 12 then 24 then 36 end list
let total be number as 0
for each score in scores
  set total to total plus score
end
print total
print item 2 of scores
print the quantity 2 plus 3 end quantity times 4
`,
async:`define async function greet with name as text returning text
  do wait the result of pause with milliseconds as 100 end call
  return "Hello, " plus name
end

print wait the result of greet with name as "Ali" end call
try
  raise "Something went wrong."
on error problem
  print problem
end
`,
backend:`# Save this file and run it with the Node CLI.
schema Person
  field name as text
  field age as number
end
model people for Person

serve get "/people"
  reply all records in people
end

serve post "/people"
  keep person be Person as validate the body of request as Person
  store person in people
  reply person with status 201
end

listen on 3000
`};
let worker,timer,running=false;
try{$('source').value=localStorage.getItem('woila-source')??examples.hello;}catch{$('source').value=examples.hello;}
function save(){try{localStorage.setItem('woila-source',$('source').value);}catch{}}
function stop(message){worker?.terminate();worker=undefined;clearTimeout(timer);running=false;$('run').disabled=false;$('stop').disabled=true;$('status').textContent=message;}
function check(){save();try{const result=compile($('source').value);$('generated').textContent=result.code;$('status').textContent='Valid';return true;}catch(error){$('output').textContent=error.message;$('status').textContent='Needs a fix';return false;}}
function execute(){if(running)return;if(!check())return;$('output').textContent='';$('status').textContent='Running';$('run').disabled=true;$('stop').disabled=false;running=true;worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});timer=setTimeout(()=>{const text='Stopped after 5 seconds. Use the Node CLI for longer programs.';$('output').textContent+='\n'+text;stop('Time limit');},5000);worker.onmessage=({data})=>{if(data.type==='print')$('output').textContent+=data.text+'\n';else if(data.type==='error'){$('output').textContent+=data.text;stop('Needs a fix');}else if(data.type==='done'){if(!$('output').textContent)$('output').textContent='Program finished without output.';stop('Finished');}};worker.onerror=event=>{$('output').textContent=event.message||'Worker failed to start.';stop('Error');};worker.postMessage($('source').value);}
$('run').addEventListener('click',execute);$('check').addEventListener('click',()=>{if(running)stop('Stopped');if(check())$('output').textContent='Your program is valid.';});$('stop').addEventListener('click',()=>stop('Stopped'));
$('example').addEventListener('change',()=>{stop('Ready');$('source').value=examples[$('example').value];save();$('output').textContent='Ready to run.';});
$('source').addEventListener('input',save);$('source').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();execute();}if(event.key==='Tab'){event.preventDefault();const el=event.target;el.setRangeText('  ',el.selectionStart,el.selectionEnd,'end');save();}});
$('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([$('source').value],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='program.eng';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
