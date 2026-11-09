#!/usr/bin/env python3
"""Extract the vocabulary table in the supplied CLEC 2025-11 HSK syllabus.

Usage: python3 extract_official.py /path/to/新版HSK考试大纲1219.PDF /path/to/rows.json
Requires PyMuPDF (fitz). Source pages80–354, printed77–351.
Keeps homograph numerals and full levelLabel; does not fabricate translations.
"""
import argparse
import collections
import json
import re
from pathlib import Path
import fitz

parser = argparse.ArgumentParser()
parser.add_argument('pdf', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
doc = fitz.open(args.pdf)
rows = []
for pno in range(79, 354):
    # Exclude the large diagonal watermark, retain small superscripts.
    words = [w for w in doc[pno].get_text('words') if w[3] - w[1] < 24]
    serials = [w for w in words if 65 < w[0] < 112 and 88 < w[1] < 800 and re.fullmatch(r'\d{1,5}', w[4])]
    for marker in serials:
        y = (marker[1] + marker[3]) / 2
        line = [w for w in words if abs((w[1] + w[3]) / 2 - y) < 7.5]
        cols = []
        for left, right in [(115, 210), (220, 310), (310, 435), (435, 580)]:
            cols.append(''.join(w[4] for w in sorted(line, key=lambda w: w[0]) if left <= w[0] < right))
        level, hanzi, pinyin, pos = cols
        rows.append({'serial': int(marker[4]), 'pdfPage': pno + 1, 'printedPage': pno - 2,
                     'levelLabel': level, 'hanzi': hanzi, 'pinyin': pinyin, 'pos': pos})
assert [r['serial'] for r in rows] == list(range(1, 11001)), 'Missing, duplicate, or out-of-order serials'
assert all(r['levelLabel'] and r['hanzi'] and r['pinyin'] for r in rows), 'Missing a required source field'
counts = collections.Counter(r['levelLabel'].split('（')[0] for r in rows)
assert dict(counts) == {'1':300, '2':200, '3':500, '4':1000, '5':1600, '6':1800, '7-9':5600}, counts
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'rows': len(rows), 'counts': counts, 'output': str(args.output)}, ensure_ascii=False))
