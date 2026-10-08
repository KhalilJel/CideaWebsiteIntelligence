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
  return [...output.matchAll(/https?:\/\/[^\s<>"')\]]+/g)]
    .map(m=>m[0].replace(/[.,;:]+$/,""))
    .filter((url,i,a)=>a.indexOf(url)===i);
}

function runCommand(bin:string,args:string[],timeoutMs=30000):Promise<string>{
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{shell:false,stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="";
    const timer=setTimeout(()=>{
      child.kill("SIGTERM");
      reject(new Error(bin+" timed out after "+timeoutMs+"ms."));
    },timeoutMs);
    child.stdout.on("data",chunk=>{stdout+=chunk.toString();});
    child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
    child.on("error",error=>{clearTimeout(timer);reject(error);});
    child.on("close",code=>{
      clearTimeout(timer);
      if(code===0)resolve(stdout);
      else reject(new Error(bin+" exited with code "+code+": "+stderr.slice(0,500)));
    });
  });
}

function parseEvidence(output:string,fallbackUrl?:string):ReachEvidence[]{
  const collectedAt=new Date().toISOString();
  const urls=urlsFromOutput(output);
  if(!urls.length&&fallbackUrl)return[{sourceUrl:fallbackUrl,platform:platformForUrl(fallbackUrl),excerpt:output.slice(0,2000),collectedAt}];
  return urls.map(url=>({sourceUrl:url,platform:platformForUrl(url),excerpt:output.slice(0,2000),collectedAt}));
}

/**
 * Agent Reach v1.5 is a capability router/skill, not a read/search CLI.
 * For generic web access its documented routing is Jina Reader for reads
 * and Exa through mcporter for search. Keep the application boundary here
 * so upstream tools can change without leaking into the pipeline.
 */
export function createAgentReachClient():AgentReachClient|undefined{
  if(process.env.AGENT_REACH_ENABLED!=="true")return undefined;
  return{
    async read(url){
      const readerUrl="https://r.jina.ai/"+url;
      const output=await runCommand("curl",["-fsSL",readerUrl]);
      const evidence=parseEvidence(output,url)[0];
      if(!evidence)throw new Error("Agent Reach returned no readable evidence.");
      return evidence;
    },
    async search(query){
      const output=await runCommand("mcporter",["call","exa.web_search_exa","query="+query,"numResults=5"]);
      return parseEvidence(output);
    }
  };
}
