#!/usr/bin/env python3
"""Join the supplied official level list with PREP translations; never generate missing rows."""
import argparse,collections,hashlib,json,re,unicodedata
from pathlib import Path
p=argparse.ArgumentParser()
for arg in ['official','prep','report','official-pdf','output']:p.add_argument('--'+arg,type=Path,required=True)
a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
official=json.loads(a.official.read_text());prep=json.loads(a.prep.read_text());report=json.loads(a.report.read_text())
assert [r['serial']for r in official]==list(range(1,11001))
levels=['1','2','3','4','5','6','7-9'];counts=[300,200,500,1000,1600,1800,5600]
def base(s):return re.sub(r'\d+$','',unicodedata.normalize('NFKC',s)).replace(' ','')
def reading(s):
 s=unicodedata.normalize('NFC',s).lower().replace('ı','i')
 for mark,comb in [('ˇ','\u030c'),('ˉ','\u0304'),('ˊ','\u0301'),('ˋ','\u0300')]:s=re.sub('([aeiouü])'+mark,lambda m:unicodedata.normalize('NFC',m[1]+comb),s)
 return re.sub(r"[\s’'·・.\-‐‑–—]",'',s)
def plain(s):return ''.join(c for c in unicodedata.normalize('NFD',s)if not unicodedata.combining(c))
by_h=collections.defaultdict(list)
for r in prep:by_h[base(r['h'])].append(r)
# Explicit reviewed aliases, never approximate automated spelling substitutions.
aliases={122:('1',122),438:('2',193),439:('2',243),475:('2',243),479:('2',249)}
alias_glosses={438:'Mặc dù, tuy',439:'Vì vậy, cho nên',475:'Bởi vì',479:'Có lúc, đôi khi'}
editorial={93:'Năm nay',265:'Hơi, có chút (chỉ mức độ; thường đứng trước tính từ)',273:'Sớm',373:'Gần',396:'Màu xanh lá cây',427:'Đi lên, lên phía trên'}
reviewed={4147:'(Tính từ) Ngang, nằm ngang; (Động từ) Đặt ngang, chắn ngang; (Danh từ) Nét ngang',7060:'Ngang ngược, thô bạo, vô lý'}
notes={};groups={level:[]for level in levels};methods=collections.Counter();unresolved=[]
for o in official:
 serial=o['serial'];h=base(o['hanzi']);key=reading(o['pinyin']);level=o['levelLabel'].split('（')[0];candidates=by_h[h];method='exact-reading'
 selected=[r for r in candidates if reading(r['p'])==key]
 if not selected:
  selected=[r for r in candidates if plain(reading(r['p']))==plain(key)];method='reviewed-reading-variant'
 if not selected and len({r['v']for r in candidates})==1:selected=candidates;method='source-pinyin-corrected'
 if selected:
  tagged=[r for r in selected if r['h']==o['hanzi']]
  if tagged:selected=tagged
  same=[r for r in selected if r['level']==level]
  if same:selected=same
  # Flower homographs in the early PREP table have no printed sense numbers.
  if serial in [357,358]:selected=[r for r in selected if ('Động' if serial==357 else 'Danh')in r['pos']]
  assert selected,(serial,'unresolved homograph')
  if len({r['v']for r in selected})>1:raise ValueError((serial,'ambiguous translations'))
  chosen=selected[0];v=chosen['v'];source=levels.index(chosen['level']);page=chosen['pdfPage'];source_serial=chosen['serial']
  if method!='exact-reading':notes[str(serial)]={'kind':method,'note':'Giữ pinyin theo đề cương; phiên âm trong PREP có biến thể hoặc lỗi trích xuất.','sourcePinyin':chosen['p']}
 elif serial in aliases:
  pl,ps=aliases[serial];chosen=next(r for r in prep if r['level']==pl and r['serial']==ps);v=alias_glosses.get(serial,chosen['v']);source=levels.index(pl);page=chosen['pdfPage'];source_serial=ps;method='reviewed-source-variant';notes[str(serial)]={'kind':method,'note':'Hǎo đối chiếu biến thể/cặp cấu trúc trong PREP với mục riêng của đề cương.','sourceSpelling':chosen['h']}
 elif serial in editorial:
  v=editorial[serial];source=7;page=0;source_serial=0;method='hao-supplement';notes[str(serial)]={'kind':method,'note':'Nghĩa tiếng Việt do Hǎo bổ sung cho mục chưa có trong bộ PREP đã gửi; không phải bản dịch trích từ đề cương.'}
 else:unresolved.append(o);continue
 if serial in reviewed:
  v=reviewed[serial];notes[str(serial)]={'kind':'hao-correction','note':'Hǎo hiệu đính để phân biệt 横 héng (ngang) và 横 hèng (ngang ngược).','reference':'https://dict.revised.moe.edu.tw/dictView.jsp?ID=4941&la=0&powerMode=0'}
 if serial==358:
  v+='; (tính từ, nghĩa mở rộng ở cấp 6) có hoa văn, nhiều màu';notes[str(serial)]={'kind':'hao-supplement','note':'Hǎo bổ sung nghĩa tính từ theo chú thích cấp 2（6） của đề cương.','reference':'https://dict.revised.moe.edu.tw/dictView.jsp?ID=5018&la=1&powerMode=0'}
 sense=re.search(r'(\d+)$',o['hanzi']);sense=sense[1]if sense else ''
 groups[level].append([serial,h,o['pinyin'],v,o['pos'],o['pdfPage'],source,page,source_serial,sense,o['levelLabel']]);methods[method]+=1
assert not unresolved,('Missing translations',unresolved)
sources=[{'name':'PREP · HSK '+r['level'],'file':r['file'],'sha256':r['sha256'],'rows':r['rows'],'attribution':'Nghĩa tiếng Việt trong PDF người dùng cung cấp. Các PDF4–9 ghi tham khảo CC-CEDICT (CC BY-SA4.0).'}for r in report]
sources.append({'name':'Hǎo · nghĩa bổ sung','attribution':'Nghĩa tiếng Việt biên soạn bổ sung, được ghi riêng trong chú thích từng mục.'})
metadata={'schemaVersion':1,'dataset':'hsk-vocabulary-2025','edition':'HSK 考试大纲 · bản2025-11 người dùng cung cấp','total':11000,'columns':['serial','hanzi','pinyin','meaningVi','partOfSpeechZh','officialPdfPage','translationSource','translationPdfPage','translationSerial','homograph','officialLevelLabel'],'official':{'file':a.official_pdf.name,'sha256':hashlib.sha256(a.official_pdf.read_bytes()).hexdigest(),'pdfPages':[80,354]},'sources':sources,'notes':notes,'groups':[],'audit':{'prepRows':len(prep),'methods':dict(methods),'jointAdvancedLevel':True}}
cumulative=0
for level,count in zip(levels,counts):
 rows=groups[level];assert len(rows)==count,(level,len(rows));cumulative+=count
 payload={'schemaVersion':1,'dataset':metadata['dataset'],'level':level,'count':count,'rows':rows}
 (a.output/('hsk-'+level+'.json')).write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 metadata['groups'].append({'level':level,'count':count,'cumulative':cumulative,'url':'/data/vocabulary/hsk-'+level+'.json'})
(a.output/'index.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'total':11000,'groups':{k:len(v)for k,v in groups.items()},'methods':methods,'editorialRows':len(editorial),'maxMeaning':max(len(r[3])for rows in groups.values()for r in rows),'bytes':sum(p.stat().st_size for p in a.output.glob('*.json'))},ensure_ascii=False))
