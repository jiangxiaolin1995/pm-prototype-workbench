// Regression fixtures are built from the current shared shell; never a stale full copy.
const path=require('node:path'),{execFileSync}=require('node:child_process');
module.exports=(name='channel-review')=>execFileSync('python3',[path.join(__dirname,'build_example.py'),name],{encoding:'utf8',maxBuffer:4*1024*1024});
