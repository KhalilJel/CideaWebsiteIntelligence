import {runPixelJury,type PixelJuryResult} from "../integrations/pixeljury.js";
import type {AuditFinding} from "../domain/website-audit.js";

export type PixelJuryAudit={result:PixelJuryResult;findings:AuditFinding[]};

export async function runPixelJuryAudit(url:string):Promise<PixelJuryAudit>{
  const result=await runPixelJury(url);
  return{result,findings:result.findings};
}
