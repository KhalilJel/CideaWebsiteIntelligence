import {test} from "node:test";
import assert from "node:assert/strict";
import {runPixelJury} from "../src/integrations/pixeljury.js";

test("PixelJury adapter parses generated artifacts",async()=>{
  const runner=async(_command:string,_args:string[],cwd:string)=>{
    const {mkdir,writeFile}=await import("node:fs/promises");
    const {join}=await import("node:path");
    await mkdir(join(cwd,"pixeljury"),{recursive:true});
    await writeFile(join(cwd,"pixeljury","critique.md"),"Hard fail: text contrast is too low\nProblem: tiny text in footer");
    await writeFile(join(cwd,"pixeljury","score.json"),JSON.stringify({score:72,rubric:"v0.1"}));
  };
  const result=await runPixelJury("https://cidealeads.com/","mock",runner);
  assert.equal(result.score,72);
  assert.equal(result.findings.length,2);
  assert.equal(result.findings[0]?.category,"UX");
});
