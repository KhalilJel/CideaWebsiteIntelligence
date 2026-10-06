import type {JEVBrowserClient} from "../integrations/jev-browser.js";
import {validateBrowserActions,validateBrowserObservations} from "./typesafe-browser.js";
import {summarizeBrowserAudit} from "./browser-audit.js";

export async function runBrowserJourney(c:JEVBrowserClient,a:unknown[]){
  const validatedActions=validateBrowserActions(a);
  const rawObservations=await c.execute(validatedActions);
  const observations=validateBrowserObservations(rawObservations);
  return{observations,summary:summarizeBrowserAudit(observations)};
}
