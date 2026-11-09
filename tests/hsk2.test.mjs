import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeBaseCourses} from '../public/vocabulary-catalog.js';
import {localProjection,applyRecords} from '../public/sync-model.js';
import {allCourseWords,createQuestions,validLabEntry} from '../public/study-model.js';
const read=async name=>JSON.parse(await readFile('public/data/'+name+'.json','utf8'));
const [first,course,audio,review]=await Promise.all(['hsk-1','hsk-2','audio-catalog','hsk-2-review'].map(read));
test('HSK2 ships 15 ordered lessons, 210 complete entries and 45 grammar explanations',()=>{
 assert.equal(course.id,'hsk-2-hsk3');assert.equal(course.level,'2');assert.equal(course.syllabus,'hsk3');
 assert.deepEqual(course.lessons.map(l=>l.number),Array.from({length:15},(_,i)=>i+1));
 assert.deepEqual(course.lessons.map(l=>l.words.length),[15,17,15,16,18,14,15,16,13,13,13,11,11,11,12]);
 assert.equal(course.lessons.flatMap(l=>l.words).length,210);assert.equal(course.lessons.flatMap(l=>l.grammar).length,45);
 for(const l of course.lessons){assert.ok(l.start<=l.end);assert.ok(l.workbookStart<=l.workbookEnd);for(const w of l.words)for(const k of ['h','p','v','ex','ep','ev'])assert.ok(w[k]?.trim(),`${l.number}:${k}`);for(const g of l.grammar)for(const k of ['title','explanation','h','p','v'])assert.ok(g[k]?.trim());}
 assert.match(course.verificationNote,/chưa có PDF/i);assert.equal(review.changes.length,14);
});
test('HSK2 keeps existing catalog audio without duplicating imported lesson tracks',()=>{
 for(const l of course.lessons){const k=String(l.number).padStart(2,'0');assert.equal(l.audio,undefined);assert.equal(audio['2-textbook'][k].length,8);assert.equal(audio['2-workbook'][k].length,1);for(const t of [...audio['2-textbook'][k],...audio['2-workbook'][k]])assert.match(t.url,/^https:\/\/cdn\.baulchino\.com\/new-hsk-books-audios\/hsk-2-/);}
});
test('HSK2 update retains imported PDF, custom lesson edits, progress and all bundled lesson numbers after sync',()=>{
 const saved={id:course.id,builtIn:false,name:'My HSK2 PDF',documents:{textbook:{kind:'pdf',fileId:'private-pdf',count:160}},lessons:[{...course.lessons[0],vi:'Ghi chú riêng',rawText:'Văn bản của tôi'}]};
 const state={known:{[course.id+':你好']:true},notes:{[course.id+':l01']:'Ghi chú đã lưu'},days:[],done:{},custom:[]};
 const rows=[...localProjection(state,[saved])].map(([key,value])=>({key,value,stamp:1,actor:'test_device',deleted:false}));
 const synced=applyRecords({},[first,course],rows);const merged=mergeBaseCourses([first,course],synced.courses);const c=merged.find(c=>c.id===course.id);
 assert.equal(c.lessons.length,15);assert.equal(c.documents.textbook.fileId,'private-pdf');assert.equal(c.lessons[0].vi,'Ghi chú riêng');assert.equal(c.lessons[0].rawText,'Văn bản của tôi');assert.equal(c.builtIn,false);assert.equal(synced.state.known[course.id+':你好'],true);assert.equal(synced.state.notes[course.id+':l01'],'Ghi chú đã lưu');assert.deepEqual(merged.find(c=>c.id===first.id),first);
});
test('stale bundled lessons receive reviewed grammar while keeping locally attached PDFs',()=>{
 const stale=structuredClone(course);stale.contentRevision='old';stale.lessons[11].grammar[1].explanation='old incorrect explanation';stale.documents={textbook:{fileId:'existing'}};
 const merged=mergeBaseCourses([course],[stale])[0];assert.equal(merged.lessons[11].grammar[1].explanation,course.lessons[11].grammar[1].explanation);assert.equal(merged.documents.textbook.fileId,'existing');
 const questions=createQuestions(allCourseWords(merged),{count:10});assert.equal(questions.length,10);assert.equal(validLabEntry('attempt',{id:'hsk2-practice',status:'active',mode:'practice',startedAt:1,deadline:100000,questions,answers:questions.map(()=>null)}),true);
});
