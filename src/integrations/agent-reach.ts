import {spawn} from "node:child_process";

export type ReachEvidence={sourceUrl:string;platform:"web"|"github"|"reddit"|"twitter"|"youtube"|"linkedin"|"other";title?:string;excerpt?:string;collectedAt:string};
export type AgentReachClient={read(url:string):Promise<ReachEvidence>;search(query:string):Promise<ReachEvidence[]>};

function platformForUrl(url:string):ReachEvidence["platform"]{
  try{
    const host=new URL(url).hostname.replace(/^www\./,"");
    if(host==="github.com")return"github";
    if(host==="reddit.com")return"reddit";
    if(host==="x.com"||host==="twitter.com")return"twitter";
    if(host==="youtube.com"||host==="youtu.be")return"youtube";
    if(host==="linkedin.com")return"linkedin";
    return"web";
  }catch{return"other"}
}

function urlsFromOutput(output:string):string[]{
  return [...output.matchAll(/https?:\/\/[^\s<>"')\]]+/g)].map(m=>m[0].replace(/[.,;:]+$/,"")).filter((url,i,a)=>a.indexOf(url)===i);
}

function runAgentReach(args:string[],timeoutMs=30000):Promise<string>{
  const bin=process.env.AGENT_REACH_BIN??"agent-reach";
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{shell:false,stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="";
    const timer=setTimeout(()=>{child.kill("SIGTERM");reject(new Error("Agent Reach timed out after "+timeoutMs+"ms."))},timeoutMs);
    child.stdout.on("data",chunk=>{stdout+=chunk.toString();});
    child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
    child.on("error",error=>{clearTimeout(timer);reject(error);});
    child.on("close",code=>{clearTimeout(timer);if(code===0)resolve(stdout);else reject(new Error("Agent Reach exited with code "+code+": "+stderr.slice(0,500)))});
  });
}

function parseEvidence(output:string,fallbackUrl?:string):ReachEvidence[]{
  const collectedAt=new Date().toISOString();
  const urls=urlsFromOutput(output);
  if(!urls.length&&fallbackUrl)return[{sourceUrl:fallbackUrl,platform:platformForUrl(fallbackUrl),excerpt:output.slice(0,2000),collectedAt}];
  return urls.map(url=>({sourceUrl:url,platform:platformForUrl(url),excerpt:output.slice(0,2000),collectedAt}));
}

export function createAgentReachClient():AgentReachClient|undefined{
  if(process.env.AGENT_REACH_ENABLED!=="true")return undefined;
  return{
    async read(url){const evidence=parseEvidence(await runAgentReach(["read",url]),url)[0];if(!evidence)throw new Error("Agent Reach returned no readable evidence.");return evidence;},
    async search(query){return parseEvidence(await runAgentReach(["search",query,"-n","5"]));}
  };
}
