const fs=require('node:fs'),assert=require('node:assert/strict');
const parse=html=>JSON.parse(html.match(/id="prototype-data">([\s\S]*?)<\/script>/)[1]);
const encode=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
const embed=(html,seed)=>html.replace(/(id="prototype-data">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+encode(seed)+b);
function boot(html,cached,modulePath){
 const {JSDOM,VirtualConsole}=require(modulePath||require.resolve('jsdom',{paths:[process.cwd(),__dirname]}));
 const seed=parse(html),errors=[],downloads=[],vc=new VirtualConsole();let blob;
 vc.on('jsdomError',e=>errors.push(e.message));
 const key=(seed.readOnly?'prototype-viewer:v3:':'prototype-workbench:v3:')+seed.artifactId+':'+seed.snapshotId;
 const dom=new JSDOM(html,{url:'https://isolated-workbench.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
  w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:10,top:10,width:800,height:600,right:810,bottom:610};};
  w.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden],[inert]')?[]:[this.getBoundingClientRect()];};
  w.URL.createObjectURL=b=>(blob=b,'blob:verification');w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.push({blob,filename:this.download});};
  w.fetch=()=>Promise.reject(new Error('Network disabled in verification'));
  w.XMLHttpRequest=class {open(){throw new Error('XHR disabled in isolated verification');}};
  w.navigator.sendBeacon=()=>false;
  if(cached)w.localStorage.setItem(key,JSON.stringify(cached));
 }});
 const w=dom.window,d=w.document,$=s=>{const e=d.querySelector(s);assert.ok(e,'Missing '+s);return e;};
 return {w,d,$,seed,errors,downloads,key,click:s=>$(s).click(),set(s,value,event='input'){$(s).value=value;$(s).dispatchEvent(new w.Event(event,{bubbles:true}));},
  submit:s=>$(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true})),
  cache(){return JSON.parse(w.localStorage.getItem(key));},
  async download(s){const count=downloads.length;$(s).click();assert.equal(downloads.length,count+1,'No real download for '+s);const item=downloads.at(-1);return {filename:item.filename,text:await new Promise((resolve,reject)=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsText(item.blob);})};},
  close(){w.close();}
 };
}
module.exports={parse,embed,encode,boot};
