import {detectLessons,normalizeCourse,levelId,extractWords} from './engine.js';
let pdfjs,worker,stopReject;export let cancelled=false;
async function cancellable(p){if(cancelled)throw Error('Đã dừng nhận dạng. Tệp chưa được nhập.');return Promise.race([p,new Promise((_,reject)=>stopReject=reject)])}
export function cancelImport(){cancelled=true;stopReject?.(Error('Đã dừng nhận dạng. Tệp chưa được nhập.'));if(worker){worker.terminate().catch(()=>{});worker=null}}
export async function pdfAPI(){if(!pdfjs){pdfjs=await import('/vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdf.worker.mjs'}return pdfjs}
export async function openPdf(blob,normalize=false){
 let data=new Uint8Array(await blob.arrayBuffer());
 if(normalize&&window.PDFLib){const doc=await PDFLib.PDFDocument.load(data,{ignoreEncryption:false});for(const p of doc.getPages()){const b=p.getMediaBox();p.setCropBox(b.x,b.y,b.width,b.height)}data=await doc.save()}
 return (await pdfAPI()).getDocument({data,cMapUrl:'/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/standard_fonts/'}).promise;
}
function linesFromContent(content){let lines=[],line='',lastY=null,lastRight=null;for(const t of content.items){if(!('str'in t))continue;const y=Math.round(t.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>4){lines.push(line);line='';lastRight=null}line+=(line?(lastRight!==null&&t.transform[4]-lastRight>12?'\t':' '):'')+t.str;lastY=y;lastRight=t.transform[4]+t.width;if(t.hasEOL){lines.push(line);line='';lastY=null}}if(line)lines.push(line);return lines.join('\n')}
async function ocrWorker(log){if(!worker){if(!window.Tesseract)throw Error('Chưa tải được bộ nhận dạng chữ. Hãy tải lại trang.');log('Đang nạp bộ nhận dạng tiếng Trung (lần đầu có thể mất một lúc)…');worker=await Tesseract.createWorker(['chi_sim','eng'],1,{workerPath:new URL('/vendor/ocr/worker.min.js',location.origin).href,corePath:new URL('/vendor/ocr/tesseract-core-simd-lstm.wasm.js',location.origin).href,langPath:new URL('/vendor/ocr/',location.origin).href,workerBlobURL:false,logger:()=>{}});if(cancelled){await worker.terminate();worker=null;throw Error('Đã dừng nhận dạng.')}}return worker}
export async function renderPdfPage(pdf,num,canvas,width=1200){const page=await pdf.getPage(num);const view=page.getViewport({scale:1});const v=page.getViewport({scale:width/view.width});canvas.width=v.width;canvas.height=v.height;await page.render({canvasContext:canvas.getContext('2d'),viewport:v}).promise;return canvas}
export async function scanDocument(blob,{ocr=false,log=()=>{},onProgress=()=>{}}={}){
 cancelled=false;const pdf=await cancellable(openPdf(blob,true));const pages=[];let scans=0;
 try{
 for(let n=1;n<=pdf.numPages;n++){
  if(cancelled)throw Error('Đã dừng nhận dạng. Tệp chưa được nhập.');
  const page=await pdf.getPage(n);let txt=linesFromContent(await page.getTextContent());
  if(txt.replace(/\s/g,'').length<25&&ocr){const w=await cancellable(ocrWorker(log)),canvas=document.createElement('canvas');await renderPdfPage(pdf,n,canvas,1500);if(cancelled)throw Error('Đã dừng nhận dạng.');const result=await cancellable(w.recognize(canvas));txt=result.data.text;scans++;canvas.width=1;canvas.height=1}
  pages.push(txt);onProgress(n,pdf.numPages);if(n===1||n%10===0)log(`Đã đọc ${n}/${pdf.numPages} trang${ocr?' · có nhận dạng bản scan':''}.`);page.cleanup();await new Promise(r=>setTimeout(r,0));
 }
 return {count:pdf.numPages,pages,scanned:scans,lessons:detectLessons(pages),hasText:pages.some(p=>p.trim().length>30)};
 }finally{stopReject=null;await pdf.destroy();if(worker){await worker.terminate();worker=null}}
}
export async function buildDraft({level,name,syllabus='unspecified',book,workbook,writing,ocr,log,onProgress}){
 const id=levelId(level)+(['hsk2','hsk3'].includes(syllabus)?'-'+syllabus:'');if(!book)throw Error('Hãy chọn PDF giáo trình hoặc nhập gói JSON.');if(book.size>250*1024*1024)throw Error('PDF lớn hơn 250 MB. Hãy chia nhỏ trước khi nhập.');
 log('Đọc giáo trình '+book.name+'…');const scan=await scanDocument(book,{ocr,log,onProgress});
 const lessons=scan.lessons.length?scan.lessons:[{number:1,title:'Toàn bộ tài liệu — chỉnh cách chia bài bên dưới',start:1,end:scan.count,rawText:scan.pages.join('\n\n')}];
 const course=normalizeCourse({level,name,syllabus,lessons:lessons.map(l=>({...l,words:extractWords(l.rawText||'')}))});course.importedAt=new Date().toISOString();course.sourceScanned=!scan.hasText;course.documents={textbook:{kind:'pdf',fileId:id+':textbook',name:book.name,count:scan.count,normalized:true}};
 const files=[{id:id+':textbook',blob:book,name:book.name}];
 for(const [kind,file]of [['workbook',workbook],['writing',writing]])if(file){log('Kiểm tra '+file.name+'…');const pdf=await openPdf(file,true);course.documents[kind]={kind:'pdf',fileId:id+':'+kind,name:file.name,count:pdf.numPages,normalized:true};files.push({id:id+':'+kind,blob:file,name:file.name});await pdf.destroy()}
 return {course,files,pages:scan.pages,detected:scan.lessons.length,hasText:scan.hasText};
}
export function templateCourse(){return {schemaVersion:1,level:'2',syllabus:'unspecified',name:'HSK 2 · Đổi tên theo giáo trình của bạn',lessons:[{number:1,title:'Tên bài theo sách',vi:'Tên tiếng Việt',start:1,end:5,words:[{h:'学习',p:'xuéxí',v:'học tập',ex:'我喜欢学习。',ep:'Wǒ xǐhuan xuéxí.',ev:'Tôi thích học.'}],grammar:[{title:'Tên mẫu câu',explanation:'Giải thích tiếng Việt đã được kiểm tra.',h:'我喜欢学习。',p:'Wǒ xǐhuan xuéxí.',v:'Tôi thích học.'}]}]}}
