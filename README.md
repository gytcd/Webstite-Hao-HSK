# Hǎo · Góc học HSK

Website học HSK dùng Cloudflare Workers, Static Assets và D1. Người dùng đăng nhập bằng mã email qua Cloudflare Access; mỗi tài khoản có tiến độ, ghi chú, hồ sơ và ảnh đại diện riêng. PDF tự nhập được lưu trên thiết bị và chuyển bằng bản sao lưu ZIP. Bản triển khai này không dùng R2.

**Hướng dẫn đưa web lên Cloudflare và tự quản lý:** [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md).

```sh
npm ci
npm run build
npm run test:standalone
npm run dev
```

Giao diện xem trên máy tại `http://127.0.0.1:5173`. Đăng nhập và đồng bộ được kiểm tra trên URL Cloudflare sau khi cấu hình Access.

Chỉnh giao diện trong `ui-shell.html`, `public/app.js` và `public/style.css`. Nội dung bài học ở `public/data/`; tài nguyên giáo trình ở `public/books/`, `public/figures/` và `public/vendor/`. Worker triển khai là `worker/standalone.mjs`, cấu hình tại `wrangler.jsonc`.

Mã kiểm tra chữ ký, issuer, audience và hạn dùng của Access JWT trước khi phục vụ website hoặc API. Khi thiếu cấu hình đăng nhập, Worker hiển thị hướng dẫn thiết lập và chặn dữ liệu tài khoản. Các bảng D1 còn thiếu được tạo bằng `CREATE TABLE IF NOT EXISTS`; dữ liệu hiện có được giữ.

## Công cụ luyện tập

Website có SRS, luyện nét chữ, đọc/nghe, bài luyện tính giờ, nhập bộ đề có nguồn, sổ lỗi sai và báo cáo mục tiêu. Xem [FEATURES-HSK.md](FEATURES-HSK.md) để sử dụng và bật Gemini/email nhắc học bằng Cloudflare Secrets.
