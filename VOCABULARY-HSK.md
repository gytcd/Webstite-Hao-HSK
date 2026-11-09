# Kho từ HSK1–9 theo tài liệu đã cung cấp

Mở **Kho từ HSK1–9** trong thanh điều hướng. Chọn cấp, tìm chữ Hán/pinyin/nghĩa, xem nguồn của từng mục; nút **Ôn SRS** hoặc **Flashcard** chọn đúng bộ từ đang xem. Các nhóm50mục là cách chia để học trên web, không phải bài học chính thức trong giáo trình. Giáo trình, ghi chú và tiến độ hiện có giữ nguyên.

| Nhóm | Mục mới | Lũy kế |
|---|---:|---:|
| HSK1 |300|300|
| HSK2 |200|500|
| HSK3 |500|1000|
| HSK4 |1000|2000|
| HSK5 |1600|3600|
| HSK6 |1800|5400|
| HSK7–9 |5600|11000|

Cấp7–9 là **một nhóm chung** trong đề cương. Số lượng là mục từ có số thứ tự trong nguồn, bao gồm các mục đồng hình được phân biệt riêng. Chú thích cấp như `2（6）` giữ nguyên nguồn và có thể chỉ từ loại mở rộng ở cấp sau. Mỗi mục có ID theo số thứ tự của đề cương để tiến độ SRS không nhập chung các nghĩa khác nhau, như `花1` (tiêu/tốn) và `花2` (hoa).

## Nguồn và đối chiếu

Phân cấp, chữ Hán, pinyin và từ loại lấy từ **新版HSK考试大纲1219.PDF**, bản đề cương2025-11 được người dùng cung cấp. Bảng từ nằm ở trang PDF80–354, đánh số liên tục1–11000. Nghĩa tiếng Việt lấy từ7PDFPREP được người dùng cung cấp:

- `tu_vung_hsk_1_prep_d072618b24.PDF`:300dòng.
- `tu_vung_hsk_2_prep_62814b81a1.PDF`:277dòng.
- `tu_vung_hsk_3_prep_ade7435e3d.PDF`:507dòng.
- `tu_vung_hsk_4_prep_3c740feed1.PDF`:1000dòng.
- `tu_vung_hsk_5_prep_8ff8e54f06.PDF`:1600dòng.
- `tu_vung_hsk_6_prep_d88bc949ca.PDF`:1800dòng.
- `tu_vung_hsk_7_9_prep_5b7a35e9ab.PDF`:5600dòng.

Bảng PREP1–3 có mục lặp, mục ở cấp khác và biến thể/cặp cấu trúc. Mức trong đề cương được dùng làm phân cấp chuẩn của kho. Bộ4–9 ghi nghĩa do PREP biên dịch, tham khảo **CC-CEDICT (CC BY-SA4.0)**; giữ ghi nguồn này trong dữ liệu và giao diện. Nội dung phái sinh cần tiếp tục giữ ghi nguồn phù hợp. Website chỉ đóng gói dữ liệu đã trích và đối chiếu, không tải các PDF cá nhân lên mã nguồn.

`public/data/vocabulary/index.json` chứa SHA-256 của8PDF gốc, sơ đồ cột, phương pháp ghép, nguồn và ghi chú hiệu đính. Mỗi mục lưu trang PDF của đề cương, nguồn/trang/số dòng nghĩa tiếng Việt. Không dùng AI để tự sinh các dòng từ vựng.

Sáu mục chưa có nghĩa trong PREP được **Hǎo bổ sung nghĩa tiếng Việt**, có nhãn riêng: 今年、有点儿、早、近、绿色、上去. Các cặp cấu trúc/biến thể được đối chiếu riêng: 没（有）→没有, 虽然……但是……→虽然, 因为……所以……→因为/所以, 有时（候）→有时.

Pinyin luôn theo đề cương, có ghi chú khi PREP có lỗi/biến thể (ví dụ过年, 任性, 脚踏实地). `横 héng` và `横 hèng` được hiệu đính để tách nghĩa phương ngang và ngang ngược. Nghĩa tính từ mở rộng của花2 được Hǎo ghi bổ sung. Tham khảo từ điển Bộ Giáo dục:

- [横: hai cách đọc](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4941&la=0&powerMode=0)
- [有点儿: mức độ nhẹ](https://dict.concised.moe.edu.tw/dictView.jsp?ID=41424&la=0&powerMode=0)
- [花: danh từ, tính từ và động từ](https://dict.revised.moe.edu.tw/dictView.jsp?ID=5018&la=1&powerMode=0)

## Đồng bộ và sao lưu

Kho tham chiếu được cung cấp cùng phiên bản website; mỗi tài khoản không cần sao chép11000mục vào D1. Tiến độ SRS, đã thuộc, ghi chú và từ riêng vẫn đồng bộ theo tài khoản. ZIP sao lưu giữ dữ liệu học và giáo trình riêng; kho tham chiếu được tải lại khi mở website trên thiết bị mới. Từ riêng có thể thêm qua Sổ tay.

## Tái tạo và kiểm tra

Yêu cầu Python3 với PyMuPDF. Giữ các PDF nguồn trên máy của bạn. Các script trích dựa trên cột/toạ độ của đúng bảnPDF có hash trong danh mục; kiểm tra thất bại nếu thiếu/trùng dòng. Tái tạo từ đầu:

```sh
python scripts/vocabulary/extract-official.py official.pdf work/official.json
python scripts/vocabulary/extract-prep.py --source-dir prep-1-6 --advanced prep-7-9.pdf --output-dir work
python scripts/vocabulary/build-dataset.py --official work/official.json --prep work/prep-rows.json --report work/prep-extraction-report.json --official-pdf official.pdf --output public/data/vocabulary
npm test
```

`npm run test:vocabulary` đối chiếu số dòng, đủ trường, đúng dải cấp và số thứ tự, nguồn/trang, mục đồng hình, SRS độc lập, lưu tiến độ khi đồng bộ và giao diện tra cứu. `npm run build` đóng gói dữ liệu, không cần đọc lại PDF khi triển khai.
