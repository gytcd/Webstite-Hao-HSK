import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readings} from '../public/reading-library.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist/client/', import.meta.url);
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(new URL('../public/', import.meta.url), output, {recursive: true});
const shell = await readFile(new URL('../ui-shell.html', import.meta.url), 'utf8');
if (!shell.includes('id="view"') || !shell.includes('src="/app.js"')) throw new Error('Không tìm thấy giao diện HSK gốc.');
await writeFile(new URL('index.html', output), shell);
await mkdir(new URL('vendor/',output),{recursive:true});
await mkdir(new URL('licenses/',output),{recursive:true});
await mkdir(new URL('strokes/',output),{recursive:true});
await cp(new URL('../node_modules/hanzi-writer/dist/index.esm.js',import.meta.url),new URL('vendor/hanzi-writer.js',output));
await cp(new URL('../node_modules/hanzi-writer/LICENSE',import.meta.url),new URL('licenses/hanzi-writer-MIT.txt',output));
await cp(new URL('../node_modules/hanzi-writer-data/ARPHICPL.TXT',import.meta.url),new URL('licenses/ARPHICPL.TXT',output));
const built = {lessons:(await Promise.all(['hsk-1','hsk-2'].map(async id=>JSON.parse(await readFile(new URL('../public/data/'+id+'.json',import.meta.url),'utf8'))))).flatMap(c=>c.lessons)};
const text = built.lessons.flatMap(l=>(l.words||[]).map(w=>w.h)).join('')+readings.flatMap(r=>r.sentences.map(s=>s.h)).join('');
const characters = [...new Set([...text].filter(c=>/^\p{Script=Han}$/u.test(c)))];
const bundled = [];
for (const character of characters) {
  try {await cp(new URL('../node_modules/hanzi-writer-data/'+encodeURIComponent(character)+'.json',import.meta.url),new URL('strokes/'+encodeURIComponent(character)+'.json',output));bundled.push(character);}
  catch (error) {if(error.code!=='ENOENT')throw error;}
}
await writeFile(new URL('strokes/manifest.json',output),JSON.stringify({source:'hanzi-writer-data',version:'2.0.1',characters:bundled}));
console.log('Đã chuẩn bị giao diện HSK và tài nguyên trong ' + root + 'dist/client');
