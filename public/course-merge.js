// Content updates are additive. Explicit user deletions are handled separately.
const present = value => value !== undefined && value !== null && value !== '';
function fields(old={},incoming={}){
 const result={...old};
 for(const [key,value] of Object.entries(incoming))if(present(value))result[key]=value;
 return result;
}
function union(old=[],incoming=[],keyOf){
 const result=[...old],positions=new Map(result.map((item,index)=>[keyOf(item),index]));
 for(const item of incoming){const key=keyOf(item),at=positions.get(key);if(at===undefined){positions.set(key,result.length);result.push(item);}else result[at]=fields(result[at],item);}
 return result;
}
export const mergeWords=(old=[],incoming=[])=>union(old,incoming,w=>w.uid||[w.h,w.p||''].join('\u0000'));
const documentKey=doc=>doc?.fileId?'pdf:'+doc.fileId:doc?.base?'images:'+doc.base:JSON.stringify(doc);
export function mergeDocuments(old={},incoming={}){
 const result={...old};
 for(const [kind,doc] of Object.entries(incoming)){
  if(!doc)continue;
  const same=Object.keys(result).find(key=>(key===kind||key.startsWith(kind+'_addition_'))&&documentKey(result[key])===documentKey(doc));
  if(same){result[same]=fields(result[same],doc);continue;}
  let key=kind,n=2;while(result[key])key=kind+'_addition_'+n++;
  result[key]=doc;
 }
 return result;
}
export function mergeLesson(old,incoming){
 if(!old)return incoming;
 const result=fields(old,incoming);
 result.words=mergeWords(old.words,incoming.words);
 result.grammar=union(old.grammar,incoming.grammar,g=>g.title);
 if(old.audio||incoming.audio)result.audio=union(old.audio,incoming.audio,a=>a.url);
 const before=old.rawText||'',after=incoming.rawText||'';
 if(before||after)result.rawText=!before?after:!after||before.includes(after)?before:after.includes(before)?after:before+'\n\n'+after;
 return result;
}
export function mergeCourse(old,incoming){
 if(!old)return incoming;
 if(old.id&&incoming.id&&old.id!==incoming.id)throw Error('Không thể gộp hai cấp giáo trình khác nhau.');
 const lessons=new Map((old.lessons||[]).map(l=>[l.number,l]));
 for(const lesson of incoming.lessons||[])lessons.set(lesson.number,mergeLesson(lessons.get(lesson.number),lesson));
 return {...fields(old,incoming),documents:mergeDocuments(old.documents,incoming.documents),lessons:[...lessons.values()].sort((a,b)=>a.number-b.number)};
}
