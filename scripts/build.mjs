import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
let html=readFileSync(resolve(root,'src/shell.html'),'utf8');
for(const [marker,file] of [['/* INLINE_CSS */','styles.css'],['/* INLINE_ENGINE */','engine.js'],['/* INLINE_APP */','app.js']]) {
  html=html.replace(marker,()=>readFileSync(resolve(root,'src',file),'utf8'));
}
writeFileSync(resolve(root,'index.html'),html);
console.log('Built index.html (self-contained, offline).');
