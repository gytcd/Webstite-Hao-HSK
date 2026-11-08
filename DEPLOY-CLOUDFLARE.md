# Tự vận hành Hǎo HSK trên Cloudflare

Bản triển khai này chạy bằng Cloudflare Worker và Static Assets. Nó dùng giao diện, bài học, hình ảnh và công cụ nhập giáo trình hiện có. D1 lưu tài khoản, tiến độ, ghi chú và ảnh đại diện. Đăng nhập bằng mã gửi qua email do Cloudflare Access xác minh. Không cần R2, máy tính mở liên tục hay phiên ChatGPT.

## 1. Mã nguồn triển khai

Dùng nhánh `main` của repository `gytcd/Webstite-Hao-HSK`. Bản này triển khai trực tiếp bằng Cloudflare Workers và D1.

Các tệp chính:

| Tệp | Chức năng |
|---|---|
| `wrangler.jsonc` | Worker `haohsk`, D1 `DB`, Static Assets và yêu cầu kiểm tra đăng nhập trước khi phục vụ tài nguyên |
| `worker/standalone.mjs` | Phục vụ website, tài khoản và API đồng bộ |
| `lib/access-auth.mjs` | Kiểm tra chữ ký JWT, issuer, audience và hạn dùng của Cloudflare Access |
| `lib/standalone-store.mjs` | Khởi tạo các bảng còn thiếu và lưu ảnh đại diện trong D1 |
| `ui-shell.html`, `public/app.js`, `public/style.css` | Giao diện người học |
| `public/data/` | Bài học, audio và metadata hình từ giáo trình |

Các tệp Next/Vinext của bản xuất vẫn được giữ để đối chiếu. Bản triển khai mới dùng `worker/standalone.mjs` và giao diện `ui-shell.html`, không dùng trang mẫu `app/page.tsx`.

## 2. Điền màn hình Create and deploy

| Ô | Giá trị |
|---|---|
| Project name | `haohsk` |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx --yes wrangler@4.92.0 deploy` |
| Enable Preview builds | Tắt trong lần thiết lập đầu |

Tên Worker trong cấu hình phải trùng `haohsk`. D1 đã được gắn bằng đúng ID bạn cung cấp: `a83768bc-63e2-46f6-bb9f-c34313308144`, tài khoản `b2bae3f2ba7e09ab0223cd93a8d2f5a2`. Không có binding R2. Tên D1 không được suy đoán; cấu hình dùng ID để chọn cơ sở dữ liệu.

Nhấn Deploy sau khi mã đã có trong `main`. Website sẽ hiển thị hướng dẫn hoàn tất đăng nhập cho tới khi làm xong bước 3. Đây là trạng thái có chủ ý: dữ liệu tài khoản không được mở công khai khi thiếu cấu hình.

## 3. Bật đăng nhập bằng email

1. Trong Cloudflare, mở **Zero Trust** và hoàn tất thiết lập nếu tài khoản chưa có.
2. Mở Worker `haohsk` → **Access** → **Protect this Worker behind Access**. Chọn bảo vệ **All traffic**, không chỉ preview. Giao diện cũ có thể đặt nút **Enable Cloudflare Access** tại **Settings → Domains & Routes**, cạnh địa chỉ `workers.dev`.
3. Mở ứng dụng Access vừa tạo trong **Zero Trust → Access controls → Applications**. Chỉnh chính sách **Allow → Include → Emails** thành danh sách email được sử dụng web. Xóa các điều kiện rộng như cho toàn bộ tên miền nếu bạn chỉ muốn vài người dùng.
4. Trong **Zero Trust → Integrations → Identity providers**, thêm **One-time PIN** nếu chưa có; sau đó bật phương thức này trong ứng dụng Access để người dùng nhận mã qua email. Các tài khoản Zero Trust mới có thể mặc định dùng tài khoản Cloudflare thay vì mã email. Không cần tạo mật khẩu riêng trên website.
5. Trong Worker → **Access → Application values**, lấy **AUD tag** và **JWKS** của ứng dụng này. Team domain là tên miền trong URL JWKS, không gồm `/cdn-cgi/access/certs`.
6. Hai thông số đã được cấu hình tại `vars` trong **`wrangler.jsonc`** và được triển khai cùng mã nguồn:

| Tên biến | Nội dung |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `odd-queen-5cc6.cloudflareaccess.com` |
| `ACCESS_AUD` | Audience tag của ứng dụng Access đang bảo vệ Worker |

Khi tạo lại ứng dụng Access hoặc đổi Team domain, sửa hai giá trị trong `wrangler.jsonc`, commit và đẩy lên `main`. Dùng domain đầy đủ và AUD của đúng ứng dụng đang bảo vệ Worker. Đây là thông số định danh, không phải mật khẩu. Các biến này được quản lý trong mã nguồn để các lần triển khai tiếp theo dùng đúng cấu hình; không cần nhập lại chúng thủ công ở dashboard. `keep_vars: true` giữ các biến khác được cấu hình riêng trên dashboard.

7. Mở URL website, đăng nhập bằng email đã có trong danh sách, nhận mã rồi xác nhận. Mở **Tài khoản & đồng bộ**, kiểm tra đúng email và trạng thái đồng bộ.
8. Mở trên thiết bị thứ hai bằng cùng email, ghi một ghi chú thử và kiểm tra nó xuất hiện ở thiết bị còn lại.

Các bảng `study_records`, `hao_accounts`, `hao_avatars` được tạo nếu chưa có, khi API nhận yêu cầu đã đăng nhập. Không xóa bảng hay ghi đè dữ liệu hiện có. JWT được đọc từ header Access hoặc cookie ứng dụng `CF_Authorization` khi thiếu header; cả hai cách đều kiểm tra chữ ký, issuer, audience và hạn dùng. Header không hợp lệ không được thay thế bằng cookie. Gửi tùy ý các header định danh cũ không đăng nhập được.

## 4. PDF và dữ liệu từ website cũ

- Các trang giáo trình HSK 1 tích hợp sẵn vẫn đi kèm mã nguồn.
- Tiến độ, ghi chú, từ riêng, nội dung giáo trình đã nhập và ảnh đại diện được đồng bộ qua D1.
- **PDF riêng lưu trên từng thiết bị.** Khi chuyển thiết bị, dùng **Sổ tay & sao lưu → Tạo bản sao lưu đầy đủ (.zip)**, sau đó khôi phục ZIP trên thiết bị mới. ZIP chỉ có những tệp thực sự hiện diện trên thiết bị tạo bản sao lưu.
- Danh tính Cloudflare Access khác danh tính ChatGPT cũ. Dữ liệu D1 cũ được giữ nguyên nhưng không tự gán sang tài khoản email. Để chuyển dữ liệu của mình, tạo ZIP từ website cũ, đăng nhập website mới và khôi phục ZIP. Không gán hàng loạt bản ghi của người khác cho tài khoản mới.

## 5. Quản lý và sửa web

- **Thêm người:** thêm đúng email vào chính sách Allow của Access.
- **Thu hồi quyền:** bỏ email khỏi Allow và thu hồi phiên của người đó trong phần quản lý người dùng Access. Phiên cũ có thể còn hiệu lực cho tới khi bị thu hồi hoặc hết hạn.
- **Sửa nội dung/giao diện:** chỉnh các tệp trong bảng ở bước 1, kiểm tra rồi đẩy lên nhánh `main`. Cloudflare tự build và triển khai nếu bạn đã kết nối nhánh đó.
- **Xem lỗi:** Worker → Deployments/Build history và Logs. Mã 503 kèm hướng dẫn đăng nhập thường do thiếu biến Access hoặc D1 chưa được gắn đúng; mã 401 sau khi đăng nhập thường do sai Team domain/AUD hoặc token không hợp lệ.
- **Khôi phục đăng nhập:** mở `/login` để đến cổng Access với đúng audience và quay về trang chủ sạch. Trang sau đăng xuất có nút đăng nhập lại. Nếu đã nhập mã email mà vẫn lỗi, đọc **Mã kiểm tra** trên trang: `ACCESS_TOKEN_MISSING` là chưa nhận token, `ACCESS_ISSUER_MISMATCH`/`ACCESS_AUDIENCE_MISMATCH` là cấu hình không khớp, `ACCESS_KEYS_UNAVAILABLE` là chưa tải được khóa xác minh. Chỉ cần mã kiểm tra để hỗ trợ; không sao chép JWT hoặc cookie.
- **Sao lưu:** dùng chức năng xuất dữ liệu của D1 trong dashboard và giữ ZIP của các PDF riêng. GitHub lưu mã nguồn, không tự sao lưu những dữ liệu này.

## 6. Kiểm tra trên máy của bạn

Yêu cầu Node.js 22.13 trở lên; khuyến nghị Node.js 24 như bộ kiểm tra tự động.

```sh
npm ci
npm run build
npm test
npm run dev
```

Mở `http://127.0.0.1:5173` để xem và sửa giao diện. Bản xem trên máy lưu dữ liệu học tại trình duyệt; đăng nhập email và đồng bộ tài khoản được kiểm tra trên URL Cloudflare sau khi Access đã được cấu hình.

`npm test` chạy cả kiểm tra tài khoản/D1 trên Node và kiểm tra xác minh JWT trong runtime Workers bằng Miniflare. Bộ kiểm tra Workers tải khóa qua API `fetch` thật của runtime và xác nhận không đi theo chuyển hướng của máy chủ khóa. Miniflare chỉ là phụ thuộc phát triển, không được đóng gói vào Worker vận hành.

Có thể kiểm tra đóng gói Worker mà không xuất bản:

```sh
npx --yes wrangler@4.92.0 deploy --dry-run
```

## Tài liệu chính thức

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [Cloudflare Access cho Worker](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
- [Xác minh JWT và lấy AUD](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Đăng nhập One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [Quản lý và thu hồi phiên](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)
