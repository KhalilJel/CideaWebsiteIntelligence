export type ReachEvidence={sourceUrl:string;platform:"web"|"github"|"reddit"|"twitter"|"youtube"|"linkedin"|"other";title?:string;excerpt?:string;collectedAt:string};
export type AgentReachClient={read(url:string):Promise<ReachEvidence>;search(query:string):Promise<ReachEvidence[]>};
export function createAgentReachClient():AgentReachClient{const unavailable=async()=>{throw new Error("Agent Reach runtime is not configured. Enable the upstream capability before live external research.")};return{read:unavailable,search:unavailable}}
