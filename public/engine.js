export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeUrl(s){try{const u=new URL(s,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}}
export function levelId(level){if(!/^[1-9](?:[abAB])?$/.test(String(level)))throw Error('Cấp HSK không hợp lệ.');return 'hsk-'+String(level).toLowerCase()}
const text=(s,n=500)=>typeof s==='string'?s.slice(0,n):'';
export function normalizeCourse(input){
 const c=input.course||input;const syllabus=['hsk2','hsk3'].includes(c.syllabus)?c.syllabus:'unspecified';const id=levelId(c.level)+(syllabus==='unspecified'?'':'-'+syllabus);
 if(!Array.isArray(c.lessons)||!c.lessons.length||c.lessons.length>500)throw Error('Gói cần có từ 1 đến 500 bài học.');
 const seen=new Set();const lessons=c.lessons.map((l,i)=>{
  const number=Number(l.number??i+1);if(!Number.isInteger(number)||number<1||number>999||seen.has(number))throw Error('Số thứ tự bài bị trùng hoặc không hợp lệ.');seen.add(number);
  const words=(l.words||[]);if(!Array.isArray(words)||words.length>2000)throw Error('Danh sách từ không hợp lệ.');
  const grammar=(l.grammar||[]);if(!Array.isArray(grammar))throw Error('Phần mẫu câu không hợp lệ.');
  const result={id:'l'+String(number).padStart(2,'0'),number,title:text(l.title||'Bài '+number,180),vi:text(l.vi,180),words:words.map(w=>{if(!text(w.h,80).trim()||!text(w.v,300).trim())throw Error('Mỗi từ cần có chữ Hán và nghĩa.');return {h:text(w.h,80),p:text(w.p,180),v:text(w.v,300),ex:text(w.ex,500),ep:text(w.ep,500),ev:text(w.ev,600)}}),grammar:grammar.map(g=>({title:text(g.title,180),explanation:text(g.explanation,3000),h:text(g.h,500),p:text(g.p,600),v:text(g.v,600)})),rawText:text(l.rawText,100000),sourceNote:text(l.sourceNote,1000)};
  for(const k of ['start','end','printedStart','workbookStart','workbookEnd'])if(Number.isInteger(+l[k])&&+l[k]>0)result[k]=+l[k];
  if(result.start&&result.end&&result.start>result.end)throw Error('Trang bắt đầu phải nhỏ hơn trang kết thúc.');
  if(Array.isArray(l.audio))result.audio=l.audio.slice(0,100).map(t=>({label:text(t.label,180),url:text(t.url,2000)})).filter(t=>/^https:\/\//.test(t.url));
  return result;
 }).sort((a,b)=>a.number-b.number);
 return {schemaVersion:1,id,level:String(c.level).toLowerCase(),syllabus,name:text(c.name||'HSK '+c.level,160),edition:text(c.edition,250),audioSource:text(c.audioSource||'https://www.baulchino.com/new-hsk-audios-2026',2000),lessons,documents:{},builtIn:false};
}
export function findHeading(raw,fallbackNumber){
 const normalized=raw.replace(/\r/g,'').replace(/([\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fff])/g,'$1');let m=normalized.match(/(?:Lesson|LESSON|Unit|UNIT)\s*([0-9]{1,2})(?![0-9])/);if(!m)m=normalized.match(/第\s*([0-9一二三四五六七八九十]{1,3})\s*[课課]/);
 if(!m&&fallbackNumber&&/(?:^|\n)[^\n]{0,25}Objectives[^\n]{0,30}(?:\n|$)/mi.test(normalized.slice(0,1800))){const head=normalized.split(/Objectives|目标/i)[0].split('\n').map(x=>x.trim()).filter(Boolean);return {number:fallbackNumber,title:head.find(x=>/[\u4e00-\u9fff]{3,}/.test(x)&&x.length<70)||'Bài '+fallbackNumber}}if(!m)return null;let n=Number(m[1]);if(!n){const cs={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};const parts=m[1].split('十');n=parts.length===2?(parts[0]?cs[parts[0]]:1)*10+(parts[1]?cs[parts[1]]:0):cs[m[1]]}if(!n||n>99)return null;
 const lines=normalized.slice(m.index+m[0].length).split('\n').map(x=>x.trim()).filter(Boolean);let title=lines.find(x=>/[\u4e00-\u9fff]{2,}/.test(x)&&x.length<100&&!/目标|生词|课文|汉字|练习|目录/.test(x));return {number:n,title:title||lines.find(x=>/[A-Za-z]{3,}/.test(x)&&x.length<90&&!/Objectives|New Words|Read the|Contents/i.test(x))||'Bài '+n};
}
export function detectLessons(pages){
 const starts=[];let previous=0;
 for(let i=0;i<pages.length;i++){
  const h=findHeading(pages[i],previous+1);if(!h||h.number!==previous+1)continue;
  if(starts.length&&i-starts.at(-1).start<1)continue;
  starts.push({...h,start:i+1});previous=h.number;
 }
 return starts.map((s,i)=>({...s,end:starts[i+1]?starts[i+1].start-1:pages.length,rawText:pages.slice(s.start-1,starts[i+1]?starts[i+1].start-1:pages.length).join('\n\n')}));
}
export {mergeCourse,mergeWords} from './course-merge.js';
export function parseWordLines(input){
 const lines=input.trim().split(/\n/).filter(Boolean);return lines.map((line,i)=>{const a=line.split('\t').map(x=>x.trim());if(a.length<3||!a[0]||!a[2])throw Error('Dòng '+(i+1)+': cần Chữ Hán, Pinyin, Nghĩa, ngăn bằng phím Tab.');return {h:a[0].slice(0,80),p:a[1].slice(0,180),v:a[2].slice(0,300),ex:(a[3]||'').slice(0,500),ev:(a[4]||'').slice(0,600)}});
}
export function openDB(name='hao-study-v2'){return new Promise((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{for(const n of ['courses','files','state'])if(!r.result.objectStoreNames.contains(n))r.result.createObjectStore(n,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export function dbGet(db,store,id){return new Promise((res,rej)=>{const r=db.transaction(store).objectStore(store).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export function dbAll(db,store){return new Promise((res,rej)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export function dbWrite(db,records){return new Promise((res,rej)=>{const tx=db.transaction([...new Set(records.map(x=>x[0]))],'readwrite');for(const [store,value]of records)tx.objectStore(store).put(value);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||Error('Không lưu được dữ liệu.'))})}

export function extractWords(raw){
 const found=[];for(const line of raw.split('\n')){const cells=line.trim().split(/\t+| {2,}/).map(s=>s.trim()).filter(Boolean);if(cells.length<3)continue;const h=cells[0].replace(/^[0-9①-⑳.、)\s]+/,'').trim();const p=cells[1];const v=cells.slice(2).join(' · ').replace(/^(?:n|v|adj|adv|pron|num|prep|conj|part|m)\.\s*/i,'');if(/^[\u3400-\u9fff]{1,12}$/.test(h)&&/^[A-Za-züÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s’'·-]{1,100}$/.test(p)&&v.length>=2&&v.length<250)found.push({h,p,v})}return [...new Map(found.map(w=>[w.h,w])).values()];
}
