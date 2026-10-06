import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawn} from "node:child_process";
import {z} from "zod";
import type {AuditFinding} from "../domain/website-audit.js";

const pixelJuryScoreSchema=z.object({
  score:z.number().min(0).max(100).optional(),
  designScore:z.number().min(0).max(100).optional(),
  rubric:z.string().optional()
}).passthrough();

export type PixelJuryResult={
  url:string;
  score?:number;
  critique:string;
  scoreJson:unknown;
  findings:AuditFinding[];
  provider:string;
  collectedAt:string;
};

type CommandRunner=(command:string,args:string[],cwd:string,timeoutMs:number)=>Promise<void>;

function runCommand(command:string,args:string[],cwd:string,timeoutMs=120000):Promise<void>{
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,shell:false,stdio:["ignore","pipe","pipe"]});
    let stderr="";
    const timer=setTimeout(()=>{child.kill("SIGTERM");reject(new Error(`PixelJury timed out after ${timeoutMs}ms.`));},timeoutMs);
    child.stderr.on("data",chunk=>{stderr+=chunk.toString();});
    child.on("error",error=>{clearTimeout(timer);reject(error);});
    child.on("close",code=>{clearTimeout(timer);if(code===0)resolve();else reject(new Error(`PixelJury exited with code ${code}: ${stderr.slice(0,1000)}`));});
  });
}

function categoryFromText(text:string):AuditFinding["category"]{
  const value=text.toLowerCase();
  if(/access|contrast|touch|text size|overflow/.test(value))return"UX";
  if(/typograph|hierarchy|color|spacing|originality|polish|visual|layout/.test(value))return"DESIGN";
  return"UX";
}

function findingsFromCritique(critique:string,url:string):AuditFinding[]{
  const lines=critique.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const actionable=lines.filter(line=>/^(?:[-*x✓]|problem|hard fail|issue|warning)/i.test(line)||/contrast|overflow|touch target|tiny text|typograph|hierarchy|spacing|polish|generic|gradient/i.test(line));
  return actionable.slice(0,20).map((line,index)=>({
    category:categoryFromText(line),
    severity:/hard fail|critical|overflow|contrast/i.test(line)?"high":/warning|problem|issue/i.test(line)?"medium":"low",
    title:`PixelJury visual finding ${index+1}`,
    observation:line.replace(/^[-*x✓]\s*/,"").slice(0,1000),
    recommendation:"Review the PixelJury finding and apply the corresponding visual or accessibility improvement if validated.",
    evidence:[{sourceUrl:url,observation:line.replace(/^[-*x✓]\s*/,"").slice(0,1000)}],
    confidence:0.8
  }));
}

export async function runPixelJury(url:string,provider=process.env.PIXELJURY_PROVIDER??"mock",runner:CommandRunner=runCommand):Promise<PixelJuryResult>{
  new URL(url);
  const workdir=await mkdtemp(join(tmpdir(),"cidea-pixeljury-"));
  try{
    const command=process.platform==="win32"?"npx.cmd":"npx";
    await runner(command,["--yes","pixeljury","review",url,"--provider",provider],workdir,120000);
    const [critique,scoreRaw]=await Promise.all([
      readFile(join(workdir,"pixeljury","critique.md"),"utf8"),
      readFile(join(workdir,"pixeljury","score.json"),"utf8")
    ]);
    const parsed=JSON.parse(scoreRaw);
    const score=pixelJuryScoreSchema.parse(parsed);
    return{url,score:score.score??score.designScore,critique,scoreJson:parsed,findings:findingsFromCritique(critique,url),provider,collectedAt:new Date().toISOString()};
  }finally{
    await rm(workdir,{recursive:true,force:true});
  }
}

export function pixelJuryEnabled():boolean{
  return process.env.PIXELJURY_ENABLED==="true";
}
