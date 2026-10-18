from pathlib import Path
import subprocess,concurrent.futures,json
folder=Path('.user/verification/shared-device-operator')
results=json.loads((folder/'dry-tests.json').read_text())
(folder/'dry-tests.initial.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
changed=subprocess.check_output(['git','diff','--name-only'],text=True).splitlines()
reruns=[r for r in results if r['exit'] or r['file'] in changed or 'shared-device-operator.dry-test' in r['file'] or 'operator.store.dry-test' in r['file']]
def run(r):
 cmd=['npx.cmd','tsx']+(['--tsconfig','jsconfig.json'] if r['file'].startswith('tests/web/') else [])+[r['file']]
 p=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=90)
 return {'file':r['file'],'exit':p.returncode,'output':p.stdout+p.stderr,'command':' '.join(cmd).replace('npx.cmd','npx')}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for r in pool.map(run,reruns):
  results=[r if old['file']==r['file'] else old for old in results]
  print(('FAIL ' if r['exit'] else 'PASS ')+r['file'],flush=True)
(folder/'dry-tests.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(f"Final dry-test files: {len(results)}, passed {sum(r['exit']==0 for r in results)}, failed {sum(r['exit']!=0 for r in results)}",flush=True)
