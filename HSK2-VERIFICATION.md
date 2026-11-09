# HSK 2 content review and interface update — 2026-11-09

## Provenance and limits

Input: user-supplied `File bóc tách ứng dụng HSK 2.zip`, containing `hsk-2.json`, `hsk-2-package.json`, a nested handoff ZIP and a task note. The outer and nested `hsk-2.json` are identical. The package contains 15 lessons, 210 vocabulary entries with examples and 45 grammar explanations; it does not contain an original textbook/workbook PDF, images or audio files. The internal task note's verification claims are not independent evidence.

Read all entries, example/pinyin/Vietnamese fields and grammar explanations. This was a language and structural review, **not a page-by-page comparison with the original books**. Do not present the package as a complete official HSK vocabulary list or verbatim textbook transcription. Page ranges, lesson-to-book alignment and audio-to-dialogue alignment remain supplied metadata, not independently verified. The course displays this distinction.

`public/data/hsk-2-review.json` records the input SHA-256 and every before/after editorial change. Changes cover 9 grammar explanations, the neutral title for 离, the currency translation for 花, and the example for 晴 (14 fields total):

- Restrict 多 after a unit to appropriate divisible measures; avoid the invalid inference 三个多人.
- Allow AB了AB alongside AB了一下; remove the claim that two-syllable verbs generally cannot reduplicate for completed actions.
- Describe 过 as experiential without inferring the speaker no longer does the activity now.
- Remove inaccurate contrasts with Vietnamese for 因为…所以 and 虽然…但是.
- Replace 回家 with 走回家 as a main verb + directional complement example.
- Remove the absolute requirement to repeat a verb with an object and 得 complement.
- Correct the position of 比: 她起得比我早 puts 比 **after 得**.
- Separate 上/下/进/出/回/过 + 来/去 from 起 + 来; do not infer 起去.
- Use “Từ 离” without imposing one part-of-speech analysis.
- Translate 一百块钱 as “một trăm tệ”, avoiding ambiguity with VND.

The less idiomatic example 今天天很晴 was edited to 今天是晴天，我们出去玩吧。; Chinese, pinyin and Vietnamese were updated together and recorded in the review log. Tone-sandhi transcription conventions are not fully uniform in the input. The two lessons using 过 retain the supplied readings guo and guò; legacy lesson-course word progress is keyed by Hanzi and may be shared. The separate official vocabulary catalog already has independent IDs for homographs.

Audio source: https://www.baulchino.com/new-hsk-audios-2026 (HSK 2 textbook/workbook sections checked). Existing catalog provides 8 textbook tracks and 1 workbook track per lesson, without duplicate per-lesson imported links. Presence and URL structure were checked; every recording was not listened to or matched to book text. Four sample CDN HEAD requests returned HTTP403 from this execution environment, so actual audio playback could not be independently confirmed here. The app retains its source-page link and playback-error notice.

## Integration

- Bundled HSK 2 loads beside HSK 1 and the independent HSK 1–9 vocabulary catalog.
- Included characters are added to the existing stroke-data build.
- Imported user course edits/PDF attachments are retained; absent bundled lesson numbers are filled. Older bundled copies receive reviewed content. Known-word, lesson and note keys are unchanged.
- No D1 schema migration, account deletion, R2 setup or publication of private PDF files.

## Visual changes

Logo: the supplied `Logo hǎo.pdf` contains one embedded raster image. `hao-logo.svg` and `hao-icon.svg` wrap crops of that exact artwork, retaining the navy/gold wordmark, icon and tagline; they are not a newly invented logo or a claim of vector reconstruction.

Applied the supplied interface review: mobile lessons become a one-column list, stats use two columns with a wide final card, secondary text is larger/darker, horizontal navigation has a swipe cue, quiz answers have clearer borders and raised states, flashcard Chinese is larger, an empty mistake notebook links to practice, and dictionary rows alternate background color. Cards use restrained depth and hover motion with reduced-motion support. Existing level tiles and generous touch controls remain. Lesson pronunciation buttons also use 48px targets and 24px speaker icons.

## Subsequent source-image update — 2026-11-09

The user subsequently supplied `GTRINH HSK2 (1).z01` and `.z02`. The complete first entry `GTRINH HSK2/hsk-course-2.PDF` could be recovered from `.z01` without the missing final ZIP directory. Raw-deflate end-of-stream, descriptor CRC32 `fb6009f2`, compressed length and uncompressed length were verified. Recovered PDF: 31,351,618 bytes, 164 pages, SHA-256 `7ac520a38e8d75dd4df5664b904ed93f70cb2dab23afa499daa56146dfdb508d`.

All 15 supplied lesson starts were checked against the PDF: PDF pages 17, 26, 35, 45, 53, 62, 72, 80, 89, 100, 109, 118, 128, 137, 146. Printed page = PDF page minus 16. This verifies lesson-start and image placement, not every original word/grammar statement.

Added 29 literal image crops: 14 dialogue illustrations and 15 warm-up groups. Lesson13 uses its warm-up group as its primary figure because the first dialogue pages have no comparable scene photo. Every crop was visually inspected; partial question text around several photos was removed. Manifest `public/data/hsk-2-figures.json` records exact PDF-point crop rectangles, source hash, page references, dimensions and descriptive alt text. Source photos were not AI-generated or reconstructed. Crops are encoded as WebP; the full textbook PDF is not committed or published.

Course-scoped figure selection preserves all legacy HSK1 images and prevents the HSK2 images appearing in unrelated vocabulary courses. Each HSK2 lesson has its own cover image and a zoomable lesson gallery. A source-page reader button appears only when a textbook document is actually available in that course.

Verification note in the course now acknowledges the supplied original PDF, while continuing to distinguish original book images from Hǎo's explanatory examples and translations.
