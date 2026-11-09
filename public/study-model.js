export const LAB_VERSION = 2;
export const DAY = 86400000;
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export const LAB_KINDS = ['review', 'attempt', 'resolve', 'reading', 'setting', 'writing', 'bank'];
export const SYLLABI = {hsk2: 'HSK 2.0', hsk3: 'HSK 3.0', unspecified: 'Chưa xác định chuẩn'};
export function labState(state) {
  state.lab ||= {};
  for (const key of LAB_KINDS) state.lab[key] ||= {};
  return state.lab;
}
export function dayKey(at = Date.now(), timeZone = 'Asia/Ho_Chi_Minh') {
  return new Intl.DateTimeFormat('en-CA', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));
}
export function streakInfo(days, at = Date.now()) {
  const set = new Set(days), today = dayKey(at);
  const step = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10);
  let cursor = set.has(today) ? today : step(today, -1), current = 0, best = 0, run = 0, previous;
  while (set.has(cursor)) {current++; cursor = step(cursor, -1);}
  for (const d of [...set].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
    run = previous && step(previous, 1) === d ? run + 1 : 1;
    best = Math.max(best, run); previous = d;
  }
  return {current, best, studiedToday: set.has(today)};
}
export const wordIdentity = word => word && typeof word === 'object' ? word.uid || word.h : word;
export const cardKey = (courseId, word) => courseId + ':' + wordIdentity(word);
export const emptyCard = () => ({repetitions: 0, interval: 0, ease: 2.5, due: 0, lapses: 0, reviews: 0});
export function scheduleReview(previous, grade, at) {
  if (![0, 2, 3, 4].includes(grade) || !Number.isFinite(at)) throw Error('Lượt ôn không hợp lệ.');
  const card = {...emptyCard(), ...previous}, next = {...card, reviews: card.reviews + 1, lastReview: at};
  if (grade === 0) {
    next.repetitions = 0; next.interval = 0; next.ease = Math.max(1.3, card.ease - .2); next.lapses++;
    next.due = at + 10 * 60000;
  } else {
    next.repetitions++;
    if (grade === 2) {next.interval = Math.max(1, Math.round(card.interval * 1.2)); next.ease = Math.max(1.3, card.ease - .15);}
    if (grade === 3) next.interval = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 3 : Math.max(4, Math.round(card.interval * card.ease));
    if (grade === 4) {next.interval = card.repetitions === 0 ? 4 : Math.max(4, Math.round(Math.max(1, card.interval) * card.ease * 1.3)); next.ease = Math.min(3.5, card.ease + .15);}
    next.interval = Math.min(3650, next.interval); next.due = at + next.interval * DAY;
  }
  return next;
}
export function cardsFromReviews(reviews) {
  const cards = new Map();
  for (const event of Object.values(reviews || {}).filter(e => e && typeof e.card === 'string' && Number.isFinite(e.at) && [0, 2, 3, 4].includes(e.grade)).sort((a,b) => a.at - b.at || a.id.localeCompare(b.id))) {
    cards.set(event.card, scheduleReview(cards.get(event.card), event.grade, event.at));
  }
  return cards;
}
export function reviewQueue(words, courseId, cards, {now = Date.now(), newLimit = 10} = {}) {
  const due = [], fresh = [];
  for (const word of words) {
    const id = cardKey(courseId, word), card = cards.get(id);
    if (!card) fresh.push({...word, card: id, isNew: true});
    else if (card.due <= now) due.push({...word, card: id, isNew: false, due: card.due});
  }
  return [...due.sort((a,b) => a.due - b.due), ...fresh.slice(0, Math.max(0, newLimit))];
}
export function allCourseWords(course, custom = []) {
  const words = (course.lessons || []).flatMap(l => (l.words || []).map(w => ({...w, lesson: l.number, courseId: course.id, source: l.sourceNote || course.name})));
  words.push(...custom.filter(w => w.courseId === course.id).map(w => ({...w, source: 'Bộ từ của bạn'})));
  return [...new Map(words.filter(w => w.h && w.v).map(w => [wordIdentity(w), w])).values()];
}
export function shuffle(items, random = Math.random) {
  const a = [...items]; for (let i = a.length - 1; i > 0; i--) {const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];} return a;
}
export function createQuestions(words, {count = 20, listening = false, random = Math.random} = {}) {
  const uniqueHanzi = [...new Map(words.map(w => ({...w,v:w.v.length>300?w.v.slice(0,297)+'…':w.v})).map(w => [w.h, w])).values()];
  const pool = [...new Map(uniqueHanzi.map(w => [w.v, w])).values()];
  if (pool.length < 4) throw Error('Cần ít nhất 4 từ có nghĩa khác nhau.');
  return shuffle(pool, random).slice(0, Math.min(60, count)).map((w, i) => {
    const kind = listening && i % 3 === 0 ? 'listening' : i % 2 === 0 ? 'meaning' : 'hanzi';
    const options = shuffle([w, ...shuffle(pool.filter(x => x.v !== w.v && x.h !== w.h), random).slice(0,3)], random);
    return {id: cardKey(w.courseId, w) + ':' + kind, card:cardKey(w.courseId,w), kind, word: w.h, pinyin: w.p || '', meaning: w.v, lesson: w.lesson || null, courseId: w.courseId, source: w.source || '', prompt: kind === 'hanzi' ? w.v : w.h, options: options.map(o => kind === 'hanzi' ? o.h : o.v), answer: options.findIndex(o => o.h === w.h)};
  });
}
export function finishAttempt(attempt, now = Date.now()) {
  if (attempt.status === 'finished') return attempt;
  const rows = attempt.questions.map((q, index) => ({...q, chosen: Number.isInteger(attempt.answers[index]) ? attempt.answers[index] : null, correct: attempt.answers[index] === q.answer}));
  const correct = rows.filter(q => q.correct).length;
  return {...attempt, status: 'finished', finishedAt: now, rows, correct, total: rows.length, percent: rows.length ? Math.round(correct / rows.length * 100) : 0};
}
export function mistakeBook(attempts, resolved = {}) {
  const map = new Map();
  for (const attempt of Object.values(attempts || {}).filter(a => a.status === 'finished').sort((a,b) => a.finishedAt - b.finishedAt)) {
    for (const q of attempt.rows || []) if (!q.correct) {
      const previous = map.get(q.id); map.set(q.id, {...q, count: (previous?.count || 0) + 1, lastAt: attempt.finishedAt});
    }
  }
  return [...map.values()].map(q => ({...q, resolved: (resolved[q.id]?.at || 0) >= q.lastAt})).sort((a,b) => b.lastAt - a.lastAt);
}
export function segmentText(text, words) {
  const dictionary = new Map(words.filter(w => w.h).map(w => [w.h, w]));
  const max = Math.min(30, Math.max(1, ...[...dictionary.keys()].map(w => w.length)));
  const result = [];
  for (let offset = 0; offset < text.length;) {
    let found;
    for (let length = Math.min(max, text.length - offset); length > 0; length--) {
      const token = text.slice(offset, offset + length);
      if (dictionary.has(token)) {found = dictionary.get(token); break;}
    }
    const h = found?.h || String.fromCodePoint(text.codePointAt(offset));
    result.push({h, start: offset, end: offset + h.length, word: found || null}); offset += h.length;
  }
  return result;
}
export function coverage(text, dictionary) {
  const segments = segmentText(text, dictionary).filter(s => /\p{Script=Han}/u.test(s.h));
  const total = segments.reduce((n,s) => n + [...s.h].length, 0);
  const covered = segments.filter(s => s.word).reduce((n,s) => n + [...s.h].length, 0);
  return {percent: total ? Math.round(covered / total * 100) : 100, unknown: [...new Set(segments.filter(s => !s.word).map(s => s.h))]};
}
export function mergeLab(left = {}, right = {}) {
  const merged = {};
  for (const kind of LAB_KINDS) merged[kind] = {...left[kind], ...right[kind]};
  return merged;
}
export function normalizeQuestionBank(input,courseId) {
  if(!input||typeof input.title!=='string'||!input.title.trim()||typeof input.source!=='string'||!input.source.trim()||!Array.isArray(input.questions)||!input.questions.length||input.questions.length>120)throw Error('Bộ đề cần tên, nguồn và từ 1 đến 120 câu.');
  const id=/^[A-Za-z0-9_-]{1,80}$/.test(input.id||'')?input.id:'bank-'+newId();
  const source=input.source.slice(0,1000);
  const questions=input.questions.map((q,index)=>{
    if(typeof q.prompt!=='string'||!q.prompt.trim()||q.prompt.length>1500||!Array.isArray(q.options)||q.options.length<2||q.options.length>6||q.options.some(x=>typeof x!=='string'||!x.trim()||x.length>300)||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length||typeof q.explanation!=='string'||!q.explanation.trim()||q.explanation.length>1500)throw Error('Câu '+(index+1)+' cần câu hỏi, 2–6 lựa chọn, chỉ số đáp án và lời giải.');
    if(q.audioURL&&(!/^https:\/\//.test(q.audioURL)||q.audioURL.length>2000))throw Error('Audio cần đường dẫn https hợp lệ.');
    return {id:id+':'+index,kind:'bank',word:String(q.word||'Câu '+(index+1)).slice(0,80),pinyin:'',meaning:q.options[q.answer],courseId,prompt:q.prompt,options:q.options.map(x=>x.trim()),answer:q.answer,explanation:q.explanation,source,section:['listening','reading'].includes(q.section)?q.section:'reading',audioURL:q.audioURL||''};
  });
  const result={id,title:input.title.slice(0,160),source,courseId,minutes:Math.min(180,Math.max(1,Math.round(Number(input.minutes)||35))),questions};
  if(new TextEncoder().encode(JSON.stringify(result)).length>300000)throw Error('Bộ đề quá dài; hãy chia thành các phần nhỏ hơn.');
  return result;
}
const validQuestion = q => q && typeof q.id==='string' && q.id.length<=250 && typeof q.word==='string' && q.word.length<=80 && typeof q.courseId==='string' && q.courseId.length<=60 && Array.isArray(q.options) && q.options.length>=2 && q.options.length<=6 && q.options.every(o=>typeof o==='string'&&o.length>0&&o.length<=300) && Number.isInteger(q.answer) && q.answer>=0 && q.answer<q.options.length;
export function validLabEntry(kind, value) {
  if (!LAB_KINDS.includes(kind) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const finite = n => Number.isSafeInteger(n) && n >= 0;
  const str = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
  if (new TextEncoder().encode(JSON.stringify(value)).length > 650000) return false;
  if (kind === 'review') return str(value.id,100) && str(value.card,200) && str(value.courseId,60) && str(value.word,80) && finite(value.at) && [0,2,3,4].includes(value.grade);
  if (kind === 'attempt') return str(value.id,100) && ['active','finished'].includes(value.status) && ['practice','placement'].includes(value.mode) && finite(value.startedAt) && finite(value.deadline) && Array.isArray(value.questions) && value.questions.length > 0 && value.questions.length <= 120 && value.questions.every(validQuestion) && Array.isArray(value.answers) && value.answers.length <= 120 && value.answers.every(a=>a===null || Number.isInteger(a)&&a>=0&&a<6) && (value.status !== 'finished' || finite(value.finishedAt) && Array.isArray(value.rows) && value.rows.length === value.questions.length && Number.isSafeInteger(value.correct) && value.correct>=0 && value.correct<=value.questions.length && value.total===value.questions.length && Number.isSafeInteger(value.percent) && value.percent>=0 && value.percent<=100 && value.rows.every(q=>validQuestion(q)&&typeof q.correct==='boolean'&&(q.chosen===null||Number.isInteger(q.chosen)&&q.chosen>=0&&q.chosen<q.options.length)));
  if (kind === 'bank') return str(value.id,100)&&str(value.title,160)&&str(value.source,1000)&&str(value.courseId,60)&&Number.isFinite(value.minutes)&&value.minutes>0&&value.minutes<=180&&Array.isArray(value.questions)&&value.questions.length>0&&value.questions.length<=120&&value.questions.every(validQuestion)&&new TextEncoder().encode(JSON.stringify(value)).length<=300000;
  if (kind === 'reading') return finite(value.at) && finite(value.position) && typeof value.completed === 'boolean';
  if (kind === 'resolve') return finite(value.at);
  if (kind === 'writing') return str(value.char,2) && /^\p{Script=Han}$/u.test(value.char) && finite(value.at) && finite(value.mistakes);
  if (kind === 'setting') return JSON.stringify(value).length < 4000;
  return false;
}
export function validatedLab(input = {}) {
  const out = {};
  for (const kind of LAB_KINDS) {
    out[kind] = {};
    if (input[kind] === undefined) continue;
    if (!input[kind] || typeof input[kind] !== 'object' || Array.isArray(input[kind])) throw Error('Dữ liệu luyện tập không hợp lệ.');
    for (const [key,value] of Object.entries(input[kind])) {
      if (!validLabEntry(kind,value) || key.length > 250) throw Error('Bản sao lưu có dữ liệu luyện tập không hợp lệ.');
      Object.defineProperty(out[kind],key,{value,writable:true,enumerable:true,configurable:true});
    }
  }
  return out;
}
