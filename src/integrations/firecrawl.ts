export type FirecrawlPage={url:string;title?:string;markdown?:string;html?:string;metadata?:Record<string,unknown>};
export type FirecrawlClient={scrape(url:string):Promise<FirecrawlPage>};

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export function createFirecrawlClient():FirecrawlClient|undefined{
  const apiKey=process.env.FIRECRAWL_API_KEY;
  if(!apiKey)return undefined;
  const base=(process.env.FIRECRAWL_BASE_URL??"https://api.firecrawl.dev").replace(/\/$/,"");
  return{async scrape(url){
    let lastError:unknown;
    for(let attempt=0;attempt<3;attempt++){
      const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);
      try{
        const r=await fetch(base+"/v2/scrape",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown","html"],onlyMainContent:true}),signal:c.signal});
        if(!r.ok){
          lastError=new Error("Firecrawl returned HTTP "+r.status);
          if(r.status>=500&&attempt<2){await sleep(500*(attempt+1));continue}
          throw lastError;
        }
        const p=await r.json() as{data?:{markdown?:string;html?:string;metadata?:Record<string,unknown>}};
        return{url,title:typeof p.data?.metadata?.title==="string"?p.data.metadata.title:undefined,markdown:p.data?.markdown,html:p.data?.html,metadata:p.data?.metadata};
      }catch(error){
        lastError=error;
        if(attempt<2){await sleep(500*(attempt+1));continue}
        throw error;
      }finally{clearTimeout(t)}
    }
    throw lastError instanceof Error?lastError:new Error("Firecrawl scrape failed");
  }};
}
