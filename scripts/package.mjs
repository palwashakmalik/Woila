import {spawnSync} from 'node:child_process';
const script=`
import os, zipfile
from pathlib import Path
root=Path.cwd()
release=root/'release'
release.mkdir(exist_ok=True)
def write_zip(path, files, base):
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        for f in sorted(files):
            info=zipfile.ZipInfo.from_file(f, str(Path(base)/f.relative_to(root if base=='plain-english' else root/'extension')))
            info.compress_type=zipfile.ZIP_DEFLATED
            if f.name=='english.mjs': info.external_attr=0o100755 << 16
            z.writestr(info,f.read_bytes())
    print(path)
files=[p for p in root.rglob('*') if p.is_file() and not any(x in p.relative_to(root).parts for x in ['.git','node_modules','release']) and not p.name.endswith('.generated.mjs')]
write_zip(release/'plain-english-v0.1.0.zip',files,'plain-english')
write_zip(release/'plain-english-extension-v0.1.0.zip',[p for p in (root/'extension').rglob('*') if p.is_file()],'plain-english-extension')
`;
let result=spawnSync('python3',['-c',script],{stdio:'inherit'});
if(result.error?.code==='ENOENT')result=spawnSync('python',['-c',script],{stdio:'inherit'});
if(result.error){console.error('Python 3 is required to create ZIP archives.');process.exitCode=1;}else process.exitCode=result.status??1;
