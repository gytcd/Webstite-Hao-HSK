import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {newId,normalizeQuestionBank,validLabEntry,scheduleReview,cardsFromReviews,reviewQueue,cardKey,dayKey,streakInfo,createQuestions,finishAttempt,mistakeBook,segmentText,coverage,mergeLab,validatedLab,DAY} from '../public/study-model.js';
import {courseReadings} from '../public/reading-library.js';
import {localProjection,mergeRecordSets,applyRecords,changedRecords} from '../public/sync-model.js';
import {normalizeCourse} from '../public/engine.js';
import {initialize} from '../lib/standalone-store.mjs';
import {syncHandler} from '../lib/study-service.mjs';
import {aiHandler,parseAIOutput} from '../lib/ai-service.mjs';
import {reminderHandler,sendReminders} from '../lib/reminders.mjs';

function database(){
  const sql=new DatabaseSync(':memory:');
  function prepare(query,args=[]){return {bind(...values){return prepare(query,values);},async run(){const r=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes)}};},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};}};}
  return {sql,prepare,async batch(items){sql.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
const user={userId:'account-a',email:'a@example.com',displayName:'A'};
const words=['我','你','他','她','我们','老师','学校','学习'].map((h,i)=>({h,p:'pinyin '+i,v:'nghĩa '+i,courseId:'hsk-1',lesson:1,source:'Nguồn kiểm tra'}));
const event=(id,grade,at)=>({id,card:cardKey('hsk-1','我'),courseId:'hsk-1',word:'我',grade,at});
const record=(key,value,stamp=100)=>({key,value,stamp,actor:'device_12345678',deleted:false});
const post=(path,data,headers={})=>new Request('https://hao.test'+path,{method:'POST',headers:{'content-type':'application/json',origin:'https://hao.test',...headers},body:JSON.stringify(data)});

test('SRS schedules forgotten words sooner, preserves history and limits new cards',()=>{
  let card=scheduleReview(undefined,3,1000);assert.equal(card.due,1000+DAY);
  card=scheduleReview(card,3,card.due);assert.equal(card.interval,3);
  card=scheduleReview(card,4,card.due);assert.ok(card.interval>=9);
  const forgotten=scheduleReview(card,0,5000);assert.equal(forgotten.due,605000);assert.equal(forgotten.repetitions,0);assert.equal(forgotten.lapses,1);
  const c=cardsFromReviews({b:event('b',3,DAY+1000),a:event('a',3,1000)});assert.equal(c.get('hsk-1:我').reviews,2);
  const queue=reviewQueue(words,'hsk-1',c,{now:8*DAY,newLimit:2});assert.equal(queue.length,3);assert.equal(queue[0].h,'我');
  assert.throws(()=>scheduleReview(card,99,1));
});
test('Vietnam calendar streak handles midnight and gaps',()=>{
  assert.equal(dayKey(Date.parse('2026-11-08T17:10:00Z')),'2026-11-09');
  const s=streakInfo(['2026-11-01','2026-11-02','2026-11-03','2026-11-07','2026-11-08'],Date.parse('2026-11-08T16:00:00Z'));
  assert.equal(s.current,2);assert.equal(s.best,3);assert.equal(s.studiedToday,true);
  assert.equal(streakInfo(['2026-11-07'],Date.parse('2026-11-10T00:00:00Z')).current,0);
});
test('question options survive reload; results and mistakes remain grounded in their source',()=>{
  const questions=createQuestions([...words,{...words[0],v:'nghĩa khác'}],{count:8,listening:true});
  assert.ok(questions.every(q=>q.options.length===4&&new Set(q.options).size===4));
  const active={id:'attempt-1',mode:'practice',status:'active',startedAt:1,deadline:1000,questions,answers:questions.map((q,i)=>i===0?null:q.answer)};
  const restored=JSON.parse(JSON.stringify(active));assert.deepEqual(restored.questions,questions);
  const finished=finishAttempt(restored,1000);assert.equal(finished.correct,7);assert.equal(finished.total,8);assert.equal(finished.rows[0].source,'Nguồn kiểm tra');
  const first=mistakeBook({a:finished},{[questions[0].id]:{at:1500}});assert.equal(first[0].resolved,true);
  const again={...finished,id:'attempt-2',finishedAt:2000};const repeated=mistakeBook({a:finished,b:again},{[questions[0].id]:{at:1500}});assert.equal(repeated[0].resolved,false);assert.equal(repeated[0].count,2);
});
test('dictionary uses longest known words and reports uncovered text honestly',()=>{
  const dict=[{h:'学校',p:'xuéxiào',v:'trường học'},{h:'学',v:'học'}];
  const segments=segmentText('我去学校。',dict);assert.equal(segments.find(s=>s.word)?.h,'学校');assert.equal(segments.map(s=>s.h).join(''),'我去学校。');
  const result=coverage('我去学校。',dict);assert.equal(result.percent,50);assert.deepEqual(result.unknown,['我','去']);
});
test('HSK editions keep separate course identities while old backups preserve their ID',()=>{
  const input={level:'1',lessons:[{number:1,words:[{h:'我',p:'wǒ',v:'tôi'}]}]};
  assert.equal(normalizeCourse(input).id,'hsk-1');
  const a=normalizeCourse({...input,syllabus:'hsk2'}),b=normalizeCourse({...input,syllabus:'hsk3'});
  assert.equal(a.id,'hsk-1-hsk2');assert.equal(b.id,'hsk-1-hsk3');assert.notEqual(a.id,b.id);assert.equal(normalizeCourse(b).id,b.id);
  const lab={review:{a:event('a',3,1000)},attempt:{},resolve:{},reading:{story:{at:1000,position:1,completed:true}},setting:{goal:{daily:10}},writing:{},bank:{}};
  assert.deepEqual(validatedLab(JSON.parse(JSON.stringify(lab))),lab);
  assert.equal(Object.keys(mergeLab(lab,{review:{b:event('b',4,2000)}}).review).length,2);
  assert.throws(()=>validatedLab({review:{bad:{grade:'fake'}}}));
});
test('two-device reviews merge without loss, and legacy clients cannot erase new records',async()=>{
  const db=database();await initialize(db);
  const a=record('lab:review:a',event('a',3,1000)),b=record('lab:review:b',event('b',4,2000));
  for(const r of [a,b])assert.equal((await syncHandler(post('/api/sync?v=2',{records:[r]}),{DB:db},user)).status,200);
  const remote=await(await syncHandler(new Request('https://hao.test/api/sync?v=2'),{DB:db},user)).json();
  const merged=applyRecords({id:'main',days:[],custom:[]},[],remote.records);assert.equal(Object.keys(merged.state.lab.review).length,2);
  assert.equal(cardsFromReviews(merged.state.lab.review).get('hsk-1:我').reviews,2);
  const legacy=await(await syncHandler(new Request('https://hao.test/api/sync'),{DB:db},user)).json();assert.equal(legacy.records.length,0);
  assert.equal((await syncHandler(post('/api/sync',{records:[{...a,deleted:true,value:null,stamp:300}]}),{DB:db},user)).status,400);
  const other=await(await syncHandler(new Request('https://hao.test/api/sync?v=2'),{DB:db},{...user,userId:'account-b'})).json();assert.equal(other.records.length,0);
  const projected=localProjection(merged.state,[]);assert.equal(changedRecords(projected,mergeRecordSets(remote.records),'device_abcdefgh',()=>400).length,0);
  const future=new Map([['future:record',record('future:record',{safe:true})]]);assert.equal(changedRecords(new Map(),future,'device_abcdefgh',()=>400).length,0);
  assert.equal((await syncHandler(post('/api/sync?v=2',{records:[record('lab:review:bad',{grade:99})]}),{DB:db},user)).status,400);
  db.sql.close();
});

const feedback={reply:'我在学习汉语。',pinyin:'Wǒ zài xuéxí Hànyǔ.',translation:'Tôi đang học tiếng Trung.',corrected:'我在学习汉语。',explanation:'Câu diễn tả hoạt động đang diễn ra.',issues:[],score:0,scoreNote:''};
const output=()=>({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(feedback)}]}]});
test('AI is explicit when unconfigured and never sends unapproved or cross-origin inputs',async()=>{
  const db=database();await initialize(db);let calls=0;
  const fetcher=async()=>{calls++;throw Error('No external request expected');};
  const request=post('/api/ai',{mode:'grammar',text:'你好'},{'x-hao-ai':'1'});
  assert.equal((await aiHandler(request,{DB:db},user,{fetcher})).status,503);
  assert.equal((await aiHandler(post('/api/ai',{mode:'grammar',text:'你好'},{origin:'https://evil.test','x-hao-ai':'1'}),{DB:db,GEMINI_API_KEY:'test-key'},user,{fetcher})).status,403);
  assert.equal((await aiHandler(post('/api/ai',{mode:'grammar',text:'你好'},{'x-hao-ai':'1'}),{DB:db},null,{fetcher})).status,401);
  assert.equal(calls,0);db.sql.close();
});
test('Gemini requests keep credentials server-side and enforce persistent per-user quotas',async()=>{
  const db=database();await initialize(db);let calls=0;
  const env={DB:db,GEMINI_API_KEY:'test-key',AI_DAILY_LIMIT:'1'};
  const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/interactions');assert.equal(options.headers['x-goog-api-key'],'test-key');assert.equal(options.redirect,'manual');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.response_format.mime_type,'application/json');assert.ok(body.system_instruction.includes('Vietnamese'));return Response.json(output());};
  const req=()=>post('/api/ai',{mode:'grammar',text:'我在学习汉语。'},{'x-hao-ai':'1'});
  const first=await aiHandler(req(),env,user,{fetcher,now:Date.parse('2026-11-08T01:00:00Z')});assert.equal(first.status,200);assert.equal((await first.json()).result.reply,feedback.reply);
  const second=await aiHandler(req(),env,user,{fetcher,now:Date.parse('2026-11-08T02:00:00Z')});assert.equal(second.status,429);assert.equal(calls,1);
  const status=await(await aiHandler(new Request('https://hao.test/api/ai'),env,user,{now:Date.parse('2026-11-08T02:00:00Z')})).json();assert.equal(status.used,1);assert.equal(JSON.stringify(status).includes('test-key'),false);
  const other=await aiHandler(req(),env,{...user,userId:'account-b'},{fetcher,now:Date.parse('2026-11-08T02:00:00Z')});assert.equal(other.status,200);assert.equal(calls,2);db.sql.close();
});
test('incomplete, oversized and malformed AI feedback is not treated as a valid result',()=>{
  assert.deepEqual(parseAIOutput(output()),feedback);
  assert.throws(()=>parseAIOutput({...output(),status:'incomplete'}));
  assert.throws(()=>parseAIOutput({status:'completed',steps:[]}));
  assert.throws(()=>parseAIOutput({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify({...feedback,score:500})}]}]}));
});
test('email reminders require configuration and opt-in and always use the verified recipient',async()=>{
  const db=database();await initialize(db);const now=Date.parse('2026-11-08T14:00:00Z');
  assert.deepEqual(await sendReminders({DB:db},now),{sent:0,disabled:true});
  assert.equal((await reminderHandler(post('/api/reminders',{enabled:true},{'x-hao-reminder':'1'}),{DB:db},user)).status,503);
  const env={DB:db,RESEND_API_KEY:'test-mail-key',REMINDER_FROM:'Hao <learn@example.org>'};
  const opt=await reminderHandler(post('/api/reminders',{enabled:true,email:'attacker@example.com'},{'x-hao-reminder':'1'}),env,user);assert.equal(opt.status,200);
  db.sql.prepare('INSERT INTO study_records VALUES(?,?,?,?,?,?,?)').run(user.userId,'day:2026-11-07','true',100,'device_abcdefgh',0,100);
  let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.deepEqual(JSON.parse(options.body).to,[user.email]);assert.equal(options.headers['idempotency-key'],'hao-streak/account-a/2026-11-08');return Response.json({id:'mail-id'});};
  assert.equal((await sendReminders(env,now,{fetcher})).sent,1);assert.equal((await sendReminders(env,now+1000,{fetcher})).sent,0);assert.equal(calls,1);
  const off=await reminderHandler(post('/api/reminders',{enabled:false},{'x-hao-reminder':'1'}),env,user);assert.equal(off.status,200);db.sql.close();
});
test('mail retry preserves the exact idempotent payload and skips a day already studied',async()=>{
  const db=database();await initialize(db);const now=Date.parse('2026-11-08T14:00:00Z'),env={DB:db,RESEND_API_KEY:'test-mail-key',REMINDER_FROM:'Hao <learn@example.org>'};
  await reminderHandler(post('/api/reminders',{enabled:true},{'x-hao-reminder':'1'}),env,user);
  db.sql.prepare('INSERT INTO study_records VALUES(?,?,?,?,?,?,?)').run(user.userId,'day:2026-11-07','true',100,'device_abcdefgh',0,100);
  let firstBody;await sendReminders(env,now,{fetcher:async(_,o)=>{firstBody=o.body;return new Response('',{status:503});}});
  const retry=await sendReminders({...env,REMINDER_FROM:'Other <new@example.org>'},now+60000,{fetcher:async(_,o)=>{assert.equal(o.body,firstBody);return Response.json({id:'retry-id'});}});assert.equal(retry.sent,1);
  db.sql.prepare('DELETE FROM hao_mail_log').run();db.sql.prepare('INSERT INTO study_records VALUES(?,?,?,?,?,?,?)').run(user.userId,'day:2026-11-08','true',100,'device_abcdefgh',0,100);
  assert.equal((await sendReminders(env,now,{fetcher:async()=>{throw Error('Must not send');}})).sent,0);db.sql.close();
});
test('built stroke data includes genuine geometry and separate attribution licenses',async()=>{
  const manifest=JSON.parse(await readFile('dist/client/strokes/manifest.json','utf8'));assert.ok(manifest.characters.includes('你'));
  const data=JSON.parse(await readFile('dist/client/strokes/你.json','utf8'));assert.ok(data.strokes.length>0);assert.equal(data.strokes.length,data.medians.length);
  assert.match(await readFile('dist/client/licenses/ARPHICPL.TXT','utf8'),/ARPHIC PUBLIC LICENSE/);
  assert.match(await readFile('dist/client/licenses/hanzi-writer-MIT.txt','utf8'),/MIT/);
});


test('imported question banks preserve source, explanation, real audio and answer counts',()=>{
 const input={id:'my-bank',title:'Bài luyện có nguồn',source:'Giáo trình của người dùng · bài 1',minutes:35,questions:[{prompt:'我___学生。',options:['是','有','在'],answer:0,explanation:'是 nối chủ ngữ với danh từ chỉ thân phận.',section:'reading'},{prompt:'Nghe và chọn đáp án.',options:['你好','再见'],answer:1,explanation:'Bản ghi đọc 再见.',section:'listening',audioURL:'https://example.org/original.mp3'}]};
 const bank=normalizeQuestionBank(input,'hsk-1');assert.equal(bank.questions[1].audioURL,input.questions[1].audioURL);assert.equal(bank.questions[0].options.length,3);assert.equal(validLabEntry('bank',bank),true);
 const attempt={id:'bank-attempt',mode:'practice',status:'active',startedAt:1,deadline:1000,questions:bank.questions,answers:[0,1]};assert.equal(validLabEntry('attempt',attempt),true);assert.equal(finishAttempt(attempt,1000).percent,100);assert.equal(validLabEntry('attempt',finishAttempt(attempt,1000)),true);
 assert.throws(()=>normalizeQuestionBank({...input,source:''},'hsk-1'));assert.throws(()=>normalizeQuestionBank({...input,questions:[{...input.questions[0],answer:5}]},'hsk-1'));
});
test('review IDs remain unique in browsers without randomUUID',()=>{
 const original=crypto.randomUUID;try{crypto.randomUUID=undefined;const a=newId(),b=newId();assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.notEqual(a,b);}finally{crypto.randomUUID=original;}
});


test('reading tools also use supplied examples from each imported level without inventing translations',()=>{
 const course={id:'hsk-4-hsk3',name:'Giáo trình của tôi',lessons:[{number:2,title:'Bài gốc',grammar:[{h:'我在学校。',p:'Wǒ zài xuéxiào.',v:'Tôi ở trường.'}]}]};
 const items=courseReadings(course);assert.equal(items[0].id,'hsk-4-hsk3:reading:2');assert.deepEqual(items[0].sentences,[{h:'我在学校。',p:'Wǒ zài xuéxiào.',vi:'Tôi ở trường.'}]);assert.equal(items[0].source,course.name);
});
