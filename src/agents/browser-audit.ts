import {validateBrowserObservations} from "./typesafe-browser.js";
import type {BrowserObservation} from "../integrations/jev-browser.js";
import type {AuditFinding} from "../domain/website-audit.js";

export function browserObservationsToFindings(o:BrowserObservation[]):AuditFinding[]{
  return validateBrowserObservations(o)
    .filter(x=>x.result!=="success")
    .map(x=>({
      category:"UX",
      severity:x.result==="blocked"?"medium":"high",
      title:x.action.type+" action failed during browser journey",
      observation:x.observation,
      recommendation:"Review the observed interaction and verify that the intended user journey can complete reliably.",
      evidence:[{sourceUrl:x.url,observation:x.observation}],
      confidence:x.result==="blocked"?.6:.9
    }));
}

export function summarizeBrowserAudit(o:BrowserObservation[]){
  const v=validateBrowserObservations(o);
  const findings=browserObservationsToFindings(v);
  return{observationCount:v.length,failureCount:findings.length,findings};
}
