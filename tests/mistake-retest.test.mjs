import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createQuestions,finishAttempt,mistakeBook,createMistakeRetest,resolveRetest,practicePinyin,validLabEntry,validatedLab,normalizeQuestionBank} from '../public/study-model.js';
import {localProjection,applyRecords} from '../public/sync-model.js';
const words=[['你','nǐ','bạn'],['我','wǒ','tôi'],['他','tā','anh ấy'],['八','bā','tám'],['请','qǐng','mời']].map(([h,p,v])=>({h,p,v,courseId:'hsk-1',source:'Giáo trình kiểm tra',lesson:1}));
const course={id:'hsk-1',level:'1',lessons:[{number:1,words}]};
const questions=createQuestions(words,{count:5,random:()=>.7});
const original=finishAttempt({id:'original',mode:'practice',status:'active',startedAt:1,deadline:100,questions,answers:questions.map(()=>null)},100);

test('HSK1 question and all Hanzi choices use aligned source pinyin, including saved attempts without new metadata',()=>{
 for(const q of questions){const p=practicePinyin(q,[course]);if(q.kind==='meaning'){assert.equal(p.prompt,q.pinyin);assert.ok(p.options.every(p=>p===''));}else{assert.equal(p.prompt,'');assert.equal(p.options.length,4);q.options.forEach((h,i)=>assert.equal(p.options[i],words.find(w=>w.h===h).p));}const legacy=structuredClone(q);delete legacy.optionPinyin;delete legacy.promptPinyin;assert.deepEqual(practicePinyin(legacy,[course]),p);}
 const q=questions[0];assert.deepEqual(practicePinyin({...q,courseId:'hsk-2-hsk3'},[{...course,id:'hsk-2-hsk3',level:'2'}]),{prompt:'',options:q.options.map(()=> '')});
 const custom={h:'您好',p:'nín hǎo',v:'xin chào',courseId:course.id};const bank={courseId:course.id,kind:'bank',prompt:'您好',options:['你','您好','我','八']};assert.equal(practicePinyin(bank,[course],[custom]).options[1],'nín hǎo');assert.equal(practicePinyin({...bank,prompt:'未知句子'},[course]).prompt,'');
});
test('retest preserves exact original questions, sources and answer mappings while resetting answers and shuffling',()=>{
 const snapshot=structuredClone(original),resolved={[questions[0].id]:{at:101}};const retest=createMistakeRetest({original},resolved,{id:'retest',now:200,random:()=>.1});
 assert.equal(retest.questions.length,4);assert.equal(retest.retest,true);assert.ok(retest.answers.every(v=>v===null));assert.equal(validLabEntry('attempt',retest),true);
 for(const q of retest.questions){const before=questions.find(b=>b.id===q.id);assert.equal(q.options[q.answer],before.options[before.answer]);assert.equal(q.source,before.source);assert.equal(q.prompt,before.prompt);assert.equal(q.optionPinyin[q.answer],before.optionPinyin[before.answer]);}
 assert.deepEqual(original,snapshot);assert.equal(createMistakeRetest({original},resolved,{includeResolved:true}).questions.length,5);
 const one={...original,questions:[questions[1]],rows:[original.rows[1]],answers:[null]};assert.equal(createMistakeRetest({one}).questions.length,1);assert.throws(()=>createMistakeRetest({},{}),/Chưa có câu sai/);
});
test('retest grading resolves only correct answers and retains unresolved questions, history and sync data',()=>{
 const attempt=createMistakeRetest({original},{},{id:'retest',now:200});attempt.answers=attempt.questions.map((q,i)=>i?null:q.answer);const finished=finishAttempt(attempt,300),resolved=resolveRetest(finished,{}),book=mistakeBook({original,retest:finished},resolved);
 assert.equal(book.filter(q=>q.resolved).length,1);assert.equal(book.filter(q=>!q.resolved).length,4);assert.equal(createMistakeRetest({original,retest:finished},resolved).questions.length,4);
 assert.equal(validLabEntry('attempt',finished),true);const lab=validatedLab({attempt:{original,retest:finished},resolve:resolved});
 const rows=[...localProjection({known:{'hsk-1:你':true},notes:{old:'Ghi chú cũ'},lab},[course])].map(([key,value])=>({key,value,stamp:1,actor:'test_device',deleted:false}));const restored=applyRecords({},[course],rows);assert.deepEqual(validatedLab(restored.state.lab),lab);assert.equal(restored.state.notes.old,'Ghi chú cũ');assert.equal(restored.state.known['hsk-1:你'],true);
 assert.deepEqual(resolveRetest(finished,{[finished.rows[0].id]:{at:400}})[finished.rows[0].id],{at:400});
});
test('large mistake books are batched without deleting remaining questions; imported bank audio and explanations survive',()=>{
 const bank=normalizeQuestionBank({id:'bank',title:'Nguồn riêng',source:'Nguồn gốc',questions:[{prompt:'我___学生。',options:['是','在','有','去'],answer:0,explanation:'Giải thích từ nguồn',audioURL:'https://example.test/audio.mp3'}]},course.id);
 const rows=Array.from({length:125},(_,i)=>({...bank.questions[0],id:'bank:'+i,correct:false,chosen:null}));const many={...original,rows};const a=createMistakeRetest({many});assert.equal(a.questions.length,120);assert.equal(a.mistakeTotal,125);assert.equal(validLabEntry('attempt',a),true);assert.equal(a.questions[0].audioURL,bank.questions[0].audioURL);assert.equal(a.questions[0].explanation,bank.questions[0].explanation);
 const done=finishAttempt({...a,answers:a.questions.map(q=>q.answer)},1000),resolved=resolveRetest(done);assert.equal(createMistakeRetest({many,retest:done},resolved).questions.length,5);
 const bad=structuredClone(a);bad.questions[0].optionPinyin=[false];assert.equal(validLabEntry('attempt',bad),false);
});
