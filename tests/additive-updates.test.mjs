import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeCourse} from '../public/course-merge.js';
import {mergeBaseCourses} from '../public/vocabulary-catalog.js';
import {localProjection,changedRecords,applyRecords} from '../public/sync-model.js';
const first=JSON.parse(await readFile('public/data/hsk-1.json','utf8'));
const second=JSON.parse(await readFile('public/data/hsk-2.json','utf8'));
const state={known:{'hsk-1:你好':true},done:{'hsk-1:l01':true},notes:{'hsk-1:l01':'Ghi chú riêng'},days:['2026-11-09'],custom:[]};
test('partial HSK2 import adds lessons, words, grammar and audio without changing HSK1 or progress',()=>{
 const original=structuredClone(first),old={...second,lessons:[{...second.lessons[0],audio:[{url:'https://example.test/old.mp3',label:'old'}]},...second.lessons.slice(1)]};
 const addition={...second,lessons:[{...second.lessons[0],words:[{h:'新增',p:'xīnzēng',v:'mới thêm'}],grammar:[{title:'Nội dung bổ sung',explanation:'Thêm mới'}],audio:[{url:'https://example.test/new.mp3',label:'new'}]},{number:16,id:'l16',title:'Bài bổ sung',words:[],grammar:[]}]};
 const merged=mergeCourse(old,addition);assert.equal(merged.lessons.length,16);assert.equal(merged.lessons[0].words.length,old.lessons[0].words.length+1);assert.equal(merged.lessons[0].grammar.length,old.lessons[0].grammar.length+1);assert.equal(merged.lessons[0].audio.length,2);
 const courses=mergeBaseCourses([first,second],[merged]);assert.deepEqual(courses.find(c=>c.id===first.id),original);assert.equal(courses.find(c=>c.id===second.id).lessons.length,16);assert.deepEqual(mergeCourse(merged,addition),merged);assert.throws(()=>mergeCourse(first,addition),/khác nhau/);
 const rows=[...localProjection(state,courses)].map(([key,value])=>({key,value,stamp:1,actor:'test_device',deleted:false}));const roundtrip=applyRecords({},[first,second],rows);assert.deepEqual(roundtrip.state.known,state.known);assert.deepEqual(roundtrip.state.done,state.done);assert.deepEqual(roundtrip.state.notes,state.notes);
});
test('adding another PDF keeps the primary textbook and every previous attachment across repeated imports',()=>{
 const old={id:'hsk-1',lessons:[],documents:{textbook:{fileId:'original',name:'Sách cũ'},writing:{fileId:'writing'}}};
 const incoming={id:'hsk-1',lessons:[],documents:{textbook:{fileId:'new',name:'Sách mới'}}};
 const merged=mergeCourse(old,incoming);assert.equal(merged.documents.textbook.fileId,'original');assert.equal(merged.documents.textbook_addition_2.fileId,'new');assert.equal(merged.documents.writing.fileId,'writing');assert.deepEqual(mergeCourse(merged,incoming),merged);
});
test('a stale device cannot infer course deletion from its incomplete local catalog or truncate lesson content on sync',()=>{
 const base=new Map([...localProjection(state,[first,second])].map(([key,value])=>[key,{key,value,stamp:1,actor:'test_device',deleted:false}]));
 const changed=changedRecords(localProjection(state,[second]),base,'old_device',()=>2);assert.equal(changed.some(r=>r.deleted&&/^(course|lesson):/.test(r.key)),false);
 const update={key:'lesson:hsk-1:1',value:{number:1,words:[{h:'新增',p:'xīnzēng',v:'bổ sung'}],grammar:[]},stamp:2,actor:'test_device',deleted:false};
 const result=applyRecords(state,[first,second],[update]);const c=result.courses.find(c=>c.id===first.id);assert.equal(c.lessons.length,first.lessons.length);assert.equal(c.lessons[0].words.length,first.lessons[0].words.length+1);assert.deepEqual(result.state.notes,state.notes);
});
