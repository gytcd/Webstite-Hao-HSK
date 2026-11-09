import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createVocabularyCourses,mergeBaseCourses,loadVocabularyCourses,isBundledVocabulary} from '../public/vocabulary-catalog.js';
import {allCourseWords,cardKey,reviewQueue,cardsFromReviews,validLabEntry,createQuestions} from '../public/study-model.js';
import {localProjection,applyRecords} from '../public/sync-model.js';
import {createStudyLab} from '../public/study-lab.js';

const index=JSON.parse(await readFile('public/data/vocabulary/index.json','utf8'));
const bundles=await Promise.all(index.groups.map(g=>readFile('public'+g.url,'utf8').then(JSON.parse)));
const courses=createVocabularyCourses(index,bundles),words=courses.flatMap(c=>c.lessons.flatMap(l=>l.words));

test('source dataset has all11000 official serials in the correct incremental and joint bands',()=>{
  assert.deepEqual(courses.map(c=>c.vocabularyCount),[300,200,500,1000,1600,1800,5600]);
  assert.deepEqual(courses.map(c=>c.vocabularyCumulative),[300,500,1000,2000,3600,5400,11000]);
  assert.deepEqual(words.map(w=>w.serial),Array.from({length:11000},(_,i)=>i+1));
  assert.equal(new Set(words.map(w=>w.uid)).size,11000);assert.equal(courses.at(-1).level,'7-9');
  for(const word of words){assert.ok(word.h&&word.p&&word.v);assert.ok(word.pdfPage>=80&&word.pdfPage<=354);assert.ok(index.sources[word.translationSource]);assert.equal(/\d+$/.test(word.h),false);}
  for(const c of courses)assert.equal(allCourseWords(c).length,c.vocabularyCount);
  assert.equal(index.sources.filter(s=>s.file).length,7);assert.equal(index.notes['7060'].kind,'hao-correction');
  assert.equal(words.filter(w=>w.translationSource===7).length,6);
});

test('different homographs and readings retain independent flashcard and SRS progress',()=>{
  const c=courses[1],flowers=allCourseWords(c).filter(w=>w.h==='花');assert.equal(flowers.length,2);
  assert.match(flowers[0].v,/tiêu/i);assert.match(flowers[1].v,/Hoa/);assert.notEqual(cardKey(c.id,flowers[0]),cardKey(c.id,flowers[1]));
  const at=Date.now(),first=flowers[0],event={id:'source-review',card:cardKey(c.id,first),courseId:c.id,word:first.h,grade:3,at};
  assert.equal(validLabEntry('review',event),true);
  const queue=reviewQueue(flowers,c.id,cardsFromReviews({event}),{now:at,newLimit:10});assert.equal(queue.length,1);assert.equal(queue[0].uid,flowers[1].uid);
  assert.equal(cardKey('hsk-1','我'),'hsk-1:我');assert.equal(cardKey('hsk-1',{h:'我'}),'hsk-1:我');
  const horizontal=words.filter(w=>w.h==='横');assert.ok(horizontal.some(w=>w.p==='héng'&&!w.v.includes('ngang ngược')));assert.ok(horizontal.some(w=>w.p==='hèng'&&w.v.includes('Ngang ngược')));
  assert.equal(words.find(w=>w.serial===975).p,'zhǐ');assert.equal(words.find(w=>w.serial===975).v,'Chỉ');
});

test('reference updates preserve user courses and sync progress without copying the entire dictionary into D1',()=>{
  const userCourse={id:'hsk-2',name:'My PDF',lessons:[]},stale={...courses[0],name:'Stale'};
  const merged=mergeBaseCourses(courses,[stale,userCourse]);assert.equal(merged.find(c=>c.id===courses[0].id).name,courses[0].name);assert.equal(merged.find(c=>c.id===userCourse.id),userCourse);
  const first=words[0],key=cardKey(courses[0].id,first),state={known:{[key]:true},done:{},notes:{},custom:[],days:[]};
  const projection=localProjection(state,merged);assert.ok(projection.has('known:'+encodeURIComponent(key)));assert.equal([...projection.keys()].some(k=>k.startsWith('lesson:hsk-vocabulary')),false);assert.ok(projection.has('course:hsk-2'));
  const rows=[...projection].map(([key,value])=>({key,value,stamp:1,actor:'test_device',deleted:false}));const restored=applyRecords({known:{},days:[],custom:[]},courses,rows);assert.equal(restored.state.known[key],true);assert.equal(restored.courses.filter(isBundledVocabulary).length,7);
});

test('loader rejects redirected asset paths and incomplete level bundles',async()=>{
  assert.throws(()=>createVocabularyCourses(index,bundles.slice(0,6)));
  const bad=structuredClone(bundles);bad[0].rows[0][0]=200;assert.throws(()=>createVocabularyCourses(index,bad));
  let calls=0;await assert.rejects(loadVocabularyCourses(async()=>{calls++;return Response.json({groups:[{url:'https://untrusted.test/vocab.json'}]});}));assert.equal(calls,1);
});

test('all levels produce valid practice attempts and searchable escaped vocabulary pages',()=>{
  for(const c of courses){const questions=createQuestions(allCourseWords(c),{count:10});assert.equal(questions.length,10);assert.equal(validLabEntry('attempt',{id:'vocabulary-exam',status:'active',mode:'practice',startedAt:1,deadline:100000,questions,answers:questions.map(()=>null)}),true);}
  const previous=globalThis.window;try{globalThis.window={speechSynthesis:{}};const state={known:{},days:[],custom:[]};const ui=createStudyLab({state:()=>state,course:()=>courses[0],courses:()=>courses,page:()=> 'vocabulary'});const html=ui.html('vocabulary');assert.match(html,/Kho từ HSK/);assert.match(html,/HSK 7–9/);assert.match(html,/Năm nay|Đề cương/);assert.equal((html.match(/data-vocabulary-speak=/g)||[]).length,50);assert.match(html,/Flashcard/);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
