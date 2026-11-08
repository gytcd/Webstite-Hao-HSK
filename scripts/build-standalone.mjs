import {cp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../dist/client/', import.meta.url);
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(new URL('../public/', import.meta.url), output, {recursive: true});
const shell = await readFile(new URL('../ui-shell.html', import.meta.url), 'utf8');
if (!shell.includes('id="view"') || !shell.includes('src="/app.js"')) throw new Error('Không tìm thấy giao diện HSK gốc.');
await writeFile(new URL('index.html', output), shell);
console.log('Đã chuẩn bị giao diện HSK và tài nguyên trong ' + root + 'dist/client');
