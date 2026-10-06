export type BrowserAction={type:"click"|"type"|"scroll"|"navigate"|"wait";target?:string;value?:string};
export type BrowserObservation={url:string;action:BrowserAction;result:"success"|"blocked"|"failed";observation:string;screenshotUrl?:string;collectedAt:string};
export type JEVBrowserClient={execute(actions:BrowserAction[]):Promise<BrowserObservation[]>};

type JEVResponse={observations:unknown[]};

export function createJEVBrowserClient():JEVBrowserClient|undefined{
  const baseUrl=process.env.JEV_BROWSER_BASE_URL?.trim();
  const apiKey=process.env.JEV_BROWSER_API_KEY?.trim();
  if(!baseUrl)return undefined;

  return {
    async execute(actions){
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),30000);
      try{
        const response=await fetch(new URL("/execute",baseUrl),{
          method:"POST",
          headers:{
            "content-type":"application/json",
            ...(apiKey?{authorization:`Bearer ${apiKey}`}: {})
          },
          body:JSON.stringify({actions}),
          signal:controller.signal
        });
        if(!response.ok)throw new Error(`JEV browser request failed with HTTP ${response.status}.`);
        const payload=await response.json() as JEVResponse;
        if(!Array.isArray(payload.observations))throw new Error("JEV response did not contain an observations array.");
        return payload.observations as BrowserObservation[];
      }finally{
        clearTimeout(timeout);
      }
    }
  };
}
