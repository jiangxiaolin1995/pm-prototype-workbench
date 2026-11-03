#!/usr/bin/env node
// Regression for the 1280x720 resize-feedback cycle observed in the real browser.
// CSS zoom can change text/border rounding, so natural height is not invariant.
const assert=require('node:assert/strict');
const {parse,embed}=require('./test_support.cjs');
async function main(){
 const args=process.argv.slice(2);let modulePath;
 if(args.length){assert.equal(args.shift(),'--jsdom');modulePath=args.shift();assert.ok(modulePath);assert.equal(args.length,0);}
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const source=require('./fixture.cjs')(),seed=parse(source);seed.model.notes=[];
 const errors=[],callbacks=[],checks=[],vc=new VirtualConsole();vc.on('jsdomError',error=>errors.push(error.message));
 let contentGrowth=0,availableHeight=449;
 const dom=new JSDOM(embed(source,seed),{url:'https://fit-stability.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
  w.ResizeObserver=class{constructor(callback){callbacks.push(callback);}observe(){}disconnect(){}};
  Object.defineProperty(w.HTMLElement.prototype,'offsetHeight',{configurable:true,get(){
   if(this.id==='prototype'){const scale=Number(this.style.zoom)||1;return contentGrowth+(scale!==1&&scale>=.59?712:703);}
   return 0;
  }});
  Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{configurable:true,get(){return this.id==='prototype-viewport'?635:0;}});
  Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{configurable:true,get(){return this.id==='prototype-viewport'?availableHeight:0;}});
 }});
 const w=dom.window,d=w.document,$=s=>{const node=d.querySelector(s);assert.ok(node,s);return node;};
 const zoom=value=>{$('#canvas-zoom').value=value;$('#canvas-zoom').dispatchEvent(new w.Event('change',{bubbles:true}));};
 const settle=async()=>{const samples=[];for(let i=0;i<12;i++){
  callbacks.forEach(callback=>callback([]));await new Promise(resolve=>w.requestAnimationFrame(resolve));
  samples.push(Number($('#prototype').style.zoom));
 }assert.equal(new Set(samples.slice(-6)).size,1,'Idle fit scale oscillates: '+samples.join(', '));return samples.at(-1);};
 try{
  const initial=await settle();assert.ok(initial>0&&initial<1);
  const viewportStyle=w.getComputedStyle($('#prototype-viewport')),verticalPadding=parseFloat(viewportStyle.paddingTop)+parseFloat(viewportStyle.paddingBottom);
  assert.ok($('#prototype').offsetHeight*initial<=availableHeight-verticalPadding,'Rounding must not overflow the fitted viewport');
  checks.push('natural_height_fit_converges_and_stays_inside_viewport_despite_text_rounding');
  $('#new-channel').click();const input=$('#channel-name-input');input.value='缩放时保留的输入';input.dispatchEvent(new w.Event('input',{bubbles:true}));
  contentGrowth=400;const taller=await settle();assert.ok(taller<initial,'Real content growth must still update fit');
  availableHeight=700;const enlarged=await settle();assert.ok(enlarged>taller,'Viewport growth must still update fit');
  assert.equal($('#channel-name-input'),input);assert.equal(input.value,'缩放时保留的输入');
  checks.push('real_content_and_viewport_changes_resize_without_rebuilding_inputs');
  zoom('0.8');assert.equal(await settle(),.8);contentGrowth=0;availableHeight=449;zoom('fit');await settle();
  assert.equal($('#channel-name-input'),input);assert.equal(input.value,'缩放时保留的输入');
  assert.deepEqual(errors,[]);checks.push('manual_ratio_stays_exact_and_returning_to_fit_is_stable');
  console.log(JSON.stringify({ok:true,checks},null,2));
 }finally{w.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
