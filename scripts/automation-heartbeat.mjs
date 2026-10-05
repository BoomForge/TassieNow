import fs from 'node:fs/promises';

const FILE = new URL('../src/data/automation-health.json', import.meta.url);
function tasDate(date=new Date()){const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const get=(type)=>parts.find((part)=>part.type===type)?.value;return`${get('year')}-${get('month')}-${get('day')}`;}
const eventName=process.env.GITHUB_EVENT_NAME||'unknown';
let current={lastScheduledRun:null,note:'Updated only by the scheduled automation-health workflow.'};
try{current={...current,...JSON.parse(await fs.readFile(FILE,'utf8'))};}catch{}
if(eventName!=='schedule'){
  console.log(`Automation heartbeat not advanced for ${eventName}; scheduled runs only.`);
  process.exit(0);
}
current.lastScheduledRun=tasDate();
current.note='A GitHub Actions schedule reached the TassieNow automation-health workflow on this date.';
await fs.writeFile(FILE,`${JSON.stringify(current,null,2)}\n`);
console.log(`Recorded scheduled automation heartbeat for ${current.lastScheduledRun}.`);
