export const VOCABULARY_DATASET = 'hsk-vocabulary-2025';
export const isBundledVocabulary = course => course?.dataset === VOCABULARY_DATASET && course.builtIn === true;

export function createVocabularyCourses(index, bundles) {
  if (index?.dataset !== VOCABULARY_DATASET || index.total !== 11000 || !Array.isArray(index.groups) || index.groups.length !== 7) throw Error('Danh mục từ vựng chưa hợp lệ.');
  const counts = {'1':300,'2':200,'3':500,'4':1000,'5':1600,'6':1800,'7-9':5600};
  let previous = 0;
  return index.groups.map((group, i) => {
    const data = bundles[i];
    if (group.level !== ['1','2','3','4','5','6','7-9'][i] || !counts[group.level] || data?.level !== group.level || data.dataset !== index.dataset || data.rows?.length !== counts[group.level]) throw Error('Thiếu dữ liệu từ vựng HSK ' + group.level + '.');
    const id = 'hsk-vocabulary-' + group.level + '-2025';
    const words = data.rows.map(row => {
      const [serial,h,p,v,pos,pdfPage,translationSource,translationPage,translationSerial,sense,levelLabel] = row;
      if (serial !== ++previous || [h,p,v].some(s=>typeof s !== 'string'||!s.trim()) || !Number.isInteger(pdfPage) || !index.sources[translationSource]) throw Error('Mục từ vựng chưa hợp lệ: ' + serial);
      return {uid:'v2025-'+String(serial).padStart(5,'0'),serial,h,p,v,pos,sense,levelLabel,pdfPage,translationSource,translationPage,translationSerial,ex:'',ep:'',ev:''};
    });
    const lessons=[];
    for(let start=0;start<words.length;start+=50){const number=lessons.length+1;lessons.push({id:'l'+String(number).padStart(2,'0'),number,title:'Nhóm từ '+(start+1)+'–'+Math.min(start+50,words.length),vi:'HSK '+group.level.replace('-','–')+' · Từ vựng theo đề cương',words:words.slice(start,start+50),grammar:[],sourceNote:'Phân cấp, chữ Hán, pinyin và từ loại: đề cương HSK bạn cung cấp. Nghĩa tiếng Việt: PREP; các mục bổ sung được ghi riêng trong Kho từ HSK.'});}
    return {schemaVersion:1,id,level:group.level,syllabus:'hsk3',name:'HSK '+group.level.replace('-','–')+' · Từ vựng ('+words.length.toLocaleString('vi-VN')+' mục)',edition:index.edition,dataset:index.dataset,kind:'vocabulary',builtIn:true,vocabularyCount:words.length,vocabularyCumulative:group.cumulative,vocabularySources:index.sources,vocabularyNotes:index.notes||{},lessons,documents:{},audioSource:'',jointLevel:group.level==='7-9'};
  });
}

export async function loadVocabularyCourses(fetcher=fetch) {
  const read=async path=>{const r=await fetcher(path,{cache:'no-cache'});if(!r.ok)throw Error('Chưa tải được kho từ HSK. Hãy tải lại trang.');return r.json();};
  const index=await read('/data/vocabulary/index.json');
  if(!Array.isArray(index.groups)||index.groups.some(g=>!/^\/data\/vocabulary\/hsk-(?:[1-6]|7-9)\.json$/.test(g.url)))throw Error('Đường dẫn dữ liệu HSK chưa hợp lệ.');
  const bundles=await Promise.all(index.groups.map(g=>read(g.url)));
  return createVocabularyCourses(index,bundles);
}

export function mergeBaseCourses(base, stored) {
  const map=new Map([...base,...stored].map(c=>[c.id,c]));
  // Reference datasets are shipped with the app. User progress stays in state.
  for(const c of base)if(isBundledVocabulary(c))map.set(c.id,c);
  return [...map.values()];
}
