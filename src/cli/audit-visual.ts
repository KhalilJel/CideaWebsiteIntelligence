import {runPixelJuryAudit} from "../agents/pixeljury-audit.js";

const url=process.argv[2];
if(!url){
  console.error("Usage: npm run audit:visual -- <url>");
  process.exit(1);
}

const result=await runPixelJuryAudit(url);
console.log(JSON.stringify(result.result,null,2));
