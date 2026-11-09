# Các công cụ luyện HSK của Hǎo

Website tiếp tục chạy trên Cloudflare Workers và D1, độc lập với ChatGPT và máy tính của bạn. Không cần thêm máy chủ Express chạy liên tục. Node.js dùng cho phát triển, đóng gói và kiểm tra.

## Tính năng đã triển khai

| Công cụ | Cách sử dụng |
|---|---|
| Ôn tập SRS | Chọn phiên ôn, nhớ trước khi lật, đánh giá Quên / Khó / Nhớ / Dễ. Từ quên quay lại sau 10 phút; các lượt nhớ được giãn lịch. |
| Chuẩn HSK | Gói nhập có `syllabus: "hsk2"`, `"hsk3"` hoặc `"unspecified"`. Hai chuẩn có mã giáo trình và PDF riêng; dữ liệu cũ giữ mã cũ. |
| Luyện nét chữ | Xem thứ tự nét hoặc tự viết trên canvas. Hanzi Writer đối chiếu hình và thứ tự nét thật, ghi số lần cần thử lại. |
| Luyện đề | Tạo bài từ bộ từ đang học hoặc nhập bộ đề JSON có nguồn, đáp án và lời giải. Giữ đáp án/thời gian khi tải lại; tự nộp khi hết giờ. |
| Khảo sát đầu vào | Dùng nội dung trong các giáo trình hiện có để tìm phần cần học lại. Không kết luận trình độ ở các cấp chưa có dữ liệu. |
| Sổ lỗi sai | Lưu câu sai/bỏ trống, đáp án, lời giải có trong nguồn và số lần sai. Có thể ôn từ hoặc đánh dấu đã hiểu. |
| Đọc & nghe | Ba bài đọc bổ sung và các mẫu câu trong giáo trình đang chọn; chạm từ xem pinyin/nghĩa. Giọng thiết bị tô câu đang đọc và tô từ khi có sự kiện boundary thật. |
| Tiến độ | Chuỗi ngày học, lịch ôn 14 ngày, mục tiêu ngày/HSK/ngày thi, báo cáo theo từng bộ từ. |
| Gemini | Chữa câu, nhận xét bài viết, hội thoại theo tình huống, giới hạn lượt gửi trên máy chủ. Cần kết nối API như bên dưới. |
| Luyện nói | Nghe mẫu và đối chiếu nội dung Web Speech nhận diện được. Không coi độ tin cậy nhận diện là điểm thanh điệu. |
| Nhắc học | Email lúc 21:00 giờ Việt Nam nếu đã học hôm qua nhưng chưa học hôm nay. Cần dịch vụ email và mỗi người tự bật nhận. |

Các bài tự tạo được ghi là bài luyện. Tỷ lệ đúng không quy đổi thành điểm thi HSK. Nhận xét/điểm luyện viết của AI là tham khảo, không phải kết quả giám khảo. Nhãn HSK của giáo trình do người nhập khai báo; danh sách từ trong ứng dụng chưa phải toàn bộ danh mục thi chính thức.

## Bật Google Gemini

Trong Cloudflare → Workers & Pages → `haohsk` → Settings → Variables and Secrets, thêm:

| Tên | Loại | Giá trị |
|---|---|---|
| `GEMINI_API_KEY` | Secret | Khóa API trong tài khoản Google AI Studio của bạn |
| `GEMINI_MODEL` | Text, tùy chọn | Mặc định `gemini-3.8-flash`; chọn model hỗ trợ Interactions và structured JSON |
| `AI_DAILY_LIMIT` | Text, tùy chọn | Mặc định 15 lượt gửi/người/ngày |
| `AI_GLOBAL_DAILY_LIMIT` | Text, tùy chọn | Mặc định 100 lượt gửi/ngày cho toàn website |

Lưu/triển khai thay đổi trong Cloudflare, mở **Trợ lý Gemini → Kiểm tra kết nối**. Nút này dùng khóa ở máy chủ để đọc metadata của model từ Google, không gửi câu của người học và không tạo câu trả lời AI. Có khóa chỉ hiển thị **Đã lưu khóa Gemini**; Google chấp nhận yêu cầu kiểm tra mới hiển thị **Google đã chấp nhận khóa**. Sau đó gửi một câu để kiểm tra phản hồi thực tế. Khóa ở máy chủ, không nhập vào GitHub hay ô hội thoại của ứng dụng. Xem [hướng dẫn API key của Google](https://ai.google.dev/gemini-api/docs/api-key).

Nếu thất bại, sao chép **Mã kiểm tra** trong ô thông báo, không gửi khóa. Mã có thể kèm HTTP status và mã Google đã được lọc; thông điệp thô của Google không được đưa về trình duyệt vì có thể chứa thông tin riêng.

| Mã | Hành động |
|---|---|
| `AI_KEY_INVALID` | Kiểm tra khóa còn hiệu lực và Secret `GEMINI_API_KEY` |
| `AI_KEY_RESTRICTED`, `AI_PERMISSION_DENIED` | Kiểm tra quyền Gemini API, giới hạn website/IP và quyền dùng model của dự án |
| `AI_MODEL_UNAVAILABLE` | Kiểm tra tên `GEMINI_MODEL` và model được dự án hỗ trợ; cần hỗ trợ Interactions và structured JSON |
| `AI_PROVIDER_QUOTA` | Xem Usage và Rate limits của Google; đây là hạn mức khác với 15 lượt/ngày trong Hǎo |
| `AI_BILLING_REQUIRED`, `AI_PROJECT_PRECONDITION` | Kiểm tra điều kiện dự án, trạng thái thanh toán và khu vực tại Google AI Studio |
| `AI_REQUEST_REJECTED` | Gửi mã cho người quản lý để sửa cấu trúc/tham số gọi API |
| `AI_CONNECTION_FAILED`, `AI_PROVIDER_UNAVAILABLE` | Kiểm tra lại sau; dịch vụ hoặc kết nối đang chưa sẵn sàng |

Nguồn mã lỗi: [Google Interactions API errors](https://ai.google.dev/gemini-api/docs/api-errors). Khóa mới trong Google AI Studio có thể chưa được cấp quyền dùng mọi model; lưu khóa thành công trong Cloudflare không xác nhận hạn mức hay quyền sử dụng của Google.

Ứng dụng gửi REST tới Interactions API, đặt `store: false`, giới hạn độ dài, xác minh cấu trúc JSON trả về và từ chối kết quả chưa hoàn chỉnh. `store: false` không phải cam kết không dùng dữ liệu để huấn luyện. [Điều khoản Gemini](https://ai.google.dev/gemini-api/terms) phân biệt dịch vụ miễn phí và trả phí; nội dung gửi qua dịch vụ miễn phí có thể được dùng để cải thiện sản phẩm. Giao diện yêu cầu người học đồng ý gửi nội dung trước khi gọi API.

Hạn mức đếm lượt yêu cầu sau khi nội dung hợp lệ, kể cả khi nhà cung cấp trả lỗi. Giới hạn này giúp kiểm soát sử dụng, không phải báo cáo thanh toán của Google. Không có khóa thì ứng dụng hiển thị chưa kết nối, không tạo câu trả lời giả.

## Bật email nhắc giữ chuỗi

Kết nối một tài khoản [Resend](https://resend.com/docs/introduction) và một tên miền gửi thư đã xác minh. Địa chỉ Gmail hay tên miền `workers.dev` không dùng làm miền gửi đã xác minh của bạn.

Thêm tại Cloudflare Settings → Variables and Secrets:

| Tên | Loại | Giá trị |
|---|---|---|
| `RESEND_API_KEY` | Secret | Khóa gửi email của Resend |
| `REMINDER_FROM` | Text | Ví dụ `Hǎo <hoc@ten-mien-cua-ban.com>` trên tên miền bạn đã xác minh |

Cron `0 14 * * *` đã được cấu hình: 14:00 UTC = 21:00 Việt Nam. Sau khi lưu cấu hình, người học mở **Tiến độ & mục tiêu → Bật email nhắc học**. Email chỉ gửi tới địa chỉ đăng nhập đã được Access xác minh; không lấy email liên hệ từ hồ sơ hoặc địa chỉ do trình duyệt truyền lên.

Lượt gửi được lưu theo tài khoản/ngày và dùng idempotency key. Thử lại trong cùng ngày giữ nguyên nội dung và người nhận, tránh gửi trùng. Tắt nhận ở cùng màn hình. Chưa đủ cấu hình hoặc chưa có người bật nhận thì cron không gửi email.

Nguồn kỹ thuật: [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Resend gửi email](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [tên miền gửi](https://resend.com/docs/dashboard/domains/introduction).

## Nhập bộ đề có nguồn

Vào **Luyện đề & đầu vào → Nhập bộ đề có đáp án và nguồn → Tải mẫu bộ đề**. Gói hỗ trợ 1–120 câu nghe/đọc trắc nghiệm, mỗi câu có 2–6 lựa chọn. `answer` bắt đầu từ 0. `audioURL`, nếu có, phải là HTTPS và trỏ tới bản ghi phù hợp với câu hỏi. Lời giải không được ứng dụng tự suy đoán.

```json
{
  "id": "bai-luyen-1",
  "title": "Bài luyện mẫu tự biên soạn",
  "source": "Hǎo biên soạn · mẫu câu A 是 B",
  "minutes": 10,
  "questions": [{
    "prompt": "Chọn từ điền vào: 我___学生。",
    "options": ["是", "有", "在"],
    "answer": 0,
    "explanation": "是 nối chủ ngữ 我 với danh từ chỉ thân phận 学生.",
    "section": "reading"
  }]
}
```

Bộ đề nhập dùng đủ câu và thời gian đã khai báo; lựa chọn số câu/thời gian của bài từ vựng được vô hiệu hóa khi chọn bộ đề. Bộ đề và bản lưu bài làm là dữ liệu riêng của tài khoản, được giữ trong D1. Chỉ nhập nội dung bạn có quyền sử dụng. Đề mẫu chính thức có thể tìm từ [ChineseTest](https://www.chinesetest.cn/HSK).

## Dữ liệu, sao lưu và kiểm tra

Mỗi lượt ôn có UUID riêng, nên hai thiết bị cùng ôn không ghi đè lượt của nhau. API đồng bộ phiên bản 2 gửi các bản ghi luyện tập riêng, còn tab cũ không nhận những khóa mới để tránh xóa nhầm. Sao lưu ZIP bao gồm lịch ôn, bài làm, bộ đề, lỗi đã xử lý và tiến độ đọc. PDF riêng vẫn lưu tại thiết bị và chuyển bằng ZIP.

155 ký tự trong bộ từ/bài đọc đi kèm có dữ liệu nét đóng gói sẵn. Chữ mới từ gói nhập có thể nạp dữ liệu Hanzi Writer từ CDN; nếu chưa có dữ liệu, ứng dụng báo rõ và không chấm đạt. Mã Hanzi Writer dùng MIT; dữ liệu từ Make Me a Hanzi theo Arphic Public License. Bản giấy phép được phân phối tại `/licenses/`.

```sh
npm ci
npm test
node --test tests/cloud.test.mjs tests/profile.test.mjs
node tests/core.mjs
npx --yes wrangler@4.92.0 deploy --dry-run
```

`npm test` kiểm tra SRS, dữ liệu hai thiết bị, bộ đề, quota, nhắc học và chạy API bảo vệ cùng D1 trong runtime Workers. Các bài kiểm tra Gemini/Resend dùng phản hồi giả lập; gọi dịch vụ thật cần khóa của chủ website.
