import {execFileSync} from 'node:child_process';
execFileSync('python3',['-c',`import zipfile,pathlib
root=pathlib.Path('services/browser')
with zipfile.ZipFile('projects/browser/mac-server.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['server.py','requirements.txt','Start-Browser.command','README.md']:
  z.write(root/name,'dock-browser-server/'+name)
`],{stdio:'inherit'});
