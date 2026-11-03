#!/usr/bin/env node
// Positive and deliberately broken actual artifacts prove the generic verifier reads its input.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {verify}=require('./verify_workbench.cjs'),{parse,embed}=require('./test_support.cjs');
const args=process.argv.slice(2);let modulePath;
if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.ok(modulePath);assert.equal(args.length,0);}
async function main(){
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'actual-workbench-'));
 try{
  const source=fs.readFileSync(path.join(__dirname,'../assets/workbench.html'),'utf8'),seed=parse(source);
  seed.pages['page-1'].name='独立业务页';seed.pages['page-1'].html='<h2>自定义元素</h2><button id="my-button">业务按钮</button>';
  seed.projectTitle='不是渠道示例';seed.model.globalContent='明确提供的初稿';
  const html=embed(source,seed),file=path.join(temporary,'actual.html');fs.writeFileSync(file,html);
  const good=await verify(file,{modulePath});assert.ok(good.ok);assert.deepEqual(good.pages,['page-1']);
  const broken=path.join(temporary,'broken-export.html');fs.writeFileSync(broken,html.replace("$('#export-html').onclick=exportHTML","$('#export-html').onclick=()=>{}"));
  await assert.rejects(()=>verify(broken,{modulePath}),/No real download/);
  const brokenUI=path.join(temporary,'broken-ui.html'),brokenRuntime=html.replace("'use strict';","'use strict';throw new Error('deliberate runtime failure');");
  assert.notEqual(brokenRuntime,html,'Runtime fault was not injected');fs.writeFileSync(brokenUI,brokenRuntime);
  await assert.rejects(()=>verify(brokenUI,{modulePath}),/Runtime failed/);
  assert.equal(fs.readFileSync(file,'utf8'),html);
  console.log(JSON.stringify({ok:true,checks:['custom_artifact_without_fixture_data','broken_actual_export_detected','broken_actual_runtime_detected','input_not_modified']},null,2));
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
