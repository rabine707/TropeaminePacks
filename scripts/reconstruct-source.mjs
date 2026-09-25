import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';

const jobs=[
  ['source-parts/collection-app','components/collection-app.tsx'],
  ['source-parts/globals-css','app/globals.css'],
];

for(const [source,target] of jobs){
  const parts=(await readdir(source)).filter(x=>x.startsWith('part-')).sort();
  if(!parts.length) throw new Error(`No source parts found in ${source}`);
  const content=(await Promise.all(parts.map(p=>readFile(join(source,p),'utf8')))).join('');
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,content,'utf8');
  console.log(`Reconstructed ${target} from ${parts.length} parts (${Buffer.byteLength(content)} bytes)`);
}
