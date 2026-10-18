from pathlib import Path
import concurrent.futures, subprocess, json
files=sorted(p for p in Path('tests').rglob('*.dry-test.ts') if not any(x in p.parts for x in ['integration','e2e']))
def run(p):
 cmd=['npx.cmd','tsx']
 if 'web' in p.parts: cmd+=['--tsconfig','jsconfig.json']
 cmd+=[str(p)]
 try:
  r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=90)
  return {'file':p.as_posix(),'exit':r.returncode,'output':r.stdout+r.stderr,'command':' '.join(cmd).replace('npx.cmd','npx')}
 except Exception as e:return {'file':p.as_posix(),'exit':-1,'output':str(e)}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for r in pool.map(run,files):
  results.append(r)
  if r['exit']:print('FAIL '+r['file'],flush=True)
Path('.user/verification/shared-device-operator/dry-tests.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(f"Dry-test files: {len(results)}, passed: {sum(r['exit']==0 for r in results)}, failed: {sum(r['exit']!=0 for r in results)}",flush=True)
