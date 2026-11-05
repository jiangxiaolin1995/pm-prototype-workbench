#!/usr/bin/env python3
"""Verify fresh initialization produces an unconfigured, business-free workbench."""
import json,re,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='workbench-init-') as temporary:
    output=Path(temporary)/'work.html'
    receipt=json.loads(subprocess.check_output(['python3',str(root/'scripts/init_prototype.py'),'--title','初始化验证','--output',str(output),'--html-only']))
    assert receipt['editEntry'] is None and receipt['launcher'] is None
    assert [p.name for p in output.parent.iterdir()]==['work.html']
    html=output.read_text()
    seed=json.loads(re.search(r'id="prototype-data">(.*?)</script>',html,re.S)[1])
    assert seed['model']['data']=={}, 'Fresh workbench still contains example business data'
    assert seed['model']['notes']==[] and seed['model']['drafts']=={}
    assert all(seed['model'].get(k,'')=='' for k in ['globalContent','dataRequirements','trackingContent'])
    assert not any(word in html for word in ['channelsHTML','bindComments','新建渠道','评论审核'])
    second=subprocess.run(['python3',str(root/'scripts/init_prototype.py'),'--title','不能覆盖','--output',str(output)],capture_output=True)
    assert second.returncode!=0 and output.read_text()==html
    seed['model']['globalContent']='用户已确认，要求写入的全局描述'
    seed['model']['trackingContent']='用户提供的埋点文字'
    seed['model']['notes']=[{'id':1,'page':'page-1','requirement':'requirement-1','scene':'default','anchor':'page-root','location':'页面','body':'用户已确认的页面说明'}]
    config=Path(temporary)/'project.json';config.write_text(json.dumps(seed,ensure_ascii=False))
    supplied=Path(temporary)/'supplied.html'
    subprocess.run(['python3',str(root/'scripts/init_prototype.py'),'--title','明确文字','--config',str(config),'--output',str(supplied),'--html-only'],check=True,capture_output=True)
    supplied_seed=json.loads(re.search(r'id="prototype-data">(.*?)</script>',supplied.read_text(),re.S)[1])
    assert supplied_seed['model']['globalContent']==seed['model']['globalContent']
    assert supplied_seed['model']['trackingContent']==seed['model']['trackingContent']
    assert supplied_seed['model']['notes']==seed['model']['notes']
    assert supplied_seed['artifactId']!=seed['artifactId'] and supplied_seed['snapshotId']!=seed['snapshotId']
    print(json.dumps({'ok':True,'checks':['no_demo_business','blank_missing_text','explicit_text_is_retained','refuses_overwrite','new_artifact_identity']}))
