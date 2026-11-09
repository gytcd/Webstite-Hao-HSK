import fitz,json,re,unicodedata,hashlib
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Extract the seven user-provided PREP vocabulary tables without OCR or generated meanings.')
parser.add_argument('--source-dir',type=Path,required=True)
parser.add_argument('--advanced',type=Path,required=True)
parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args()
args.output_dir.mkdir(parents=True,exist_ok=True)
ROOT=args.source_dir
inputs=[(str(n),next(ROOT.glob(f'tu_vung_hsk_{n}_prep_*.PDF'))) for n in range(1,7)]
inputs.append(('7-9',args.advanced))

def clustered(values):
 groups=[]
 for v in sorted(values):
  if groups and v-groups[-1][-1]<.8:groups[-1].append(v)
  else:groups.append([v])
 return [sum(g)/len(g) for g in groups]

def clean(s):return unicodedata.normalize('NFC',re.sub(r'\s+',' ',s)).strip()

def cell(words,rect):
 return clean(' '.join(w[4] for w in words if rect.contains(fitz.Point((w[0]+w[2])/2,(w[1]+w[3])/2))))

allrows=[];report=[]
for level,path in inputs:
 doc=fitz.open(path);rows=[]
 old=level in ['1','2','3'];cols=[43.25,100.3,176.2,271.1,365.9,551.1] if old else [31.5,56.9,130.3,215.7,283.2,564.8]
 for pn,page in enumerate(doc):
  lines=page.get_text('words')
  nums=[w for w in page.get_text('words') if w[4].isdigit() and cols[0]<(w[0]+w[2])/2<cols[1] and (90 if old else 20)<(w[1]+w[3])/2<800]
  if not nums:continue
  rects=[d['rect'] for d in page.get_drawings() if abs(d['rect'].x0-cols[0])<1 and (abs(d['rect'].x1-cols[1])<1 or abs(d['rect'].x1-cols[-1])<1) and 8<d['rect'].height<200 and d['rect'].y0>(60 if old else 0)]
  ys=clustered([v for r in rects for v in [r.y0,r.y1]]+[800])
  for w in nums:
   cy=(w[1]+w[3])/2
   before=[y for y in ys if y<cy];after=[y for y in ys if y>cy]
   if not before or not after:raise ValueError((path.name,pn+1,w,'No bounds'))
   top=max(before);bottom=min(after)
   values=[cell(lines,fitz.Rect(cols[i],top,cols[i+1],bottom)) for i in range(5)]
   serial=int(w[4])
   if values[0]!=str(serial):raise ValueError((path.name,pn+1,serial,values))
   rows.append({'serial':serial,'level':level,'pdfPage':pn+1,'h':re.sub(r'\s+','',values[1]),'p':values[2],'pos':values[3],'v':values[4],'sourceFile':path.name})
 serials=[r['serial']for r in rows]
 if sorted(serials)!=list(range(1,max(serials)+1)):raise ValueError((level,'missing/duplicate serials',len(serials),max(serials)))
 missing=[r for r in rows if not r['h']or not r['p']or not r['v']]
 report.append({'level':level,'rows':len(rows),'missingCells':missing,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'file':path.name})
 allrows.extend(rows)
 print(level,len(rows),'missing',len(missing),flush=True)
(args.output_dir/'prep-rows.json').write_text(json.dumps(allrows,ensure_ascii=False,indent=2))
(args.output_dir/'prep-extraction-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
