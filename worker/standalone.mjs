import {accessSettings, createAccessVerifier} from '../lib/access-auth.mjs';
import {initialize, rememberAccount, avatarHandler} from '../lib/standalone-store.mjs';
import {json, syncHandler} from '../lib/study-service.mjs';

const verify = createAccessVerifier();
function setupResponse(status = 503) {
  return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hǎo · Cấu hình đăng nhập</title><body style="font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;line-height:1.7"><h1>Hǎo cần hoàn tất cấu hình đăng nhập.</h1><p>Chủ website hãy bật Cloudflare Access cho ứng dụng này, cho phép các email được dùng và đặt hai biến <code>ACCESS_TEAM_DOMAIN</code>, <code>ACCESS_AUD</code> trong Settings → Variables &amp; Secrets.</p><p>Sau khi cấu hình, mở lại trang để đăng nhập bằng mã gửi qua email.</p></body></html>', {status, headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), api = url.pathname.startsWith('/api/');
    if (!accessSettings(env)) return api ? json({error: 'Chưa cấu hình đăng nhập email.'}, 503) : setupResponse();
    const user = await verify(request, env);
    if (!user) return api ? json({error: 'Bạn cần đăng nhập lại bằng email.'}, 401) : setupResponse(401);
    if (['/signin-with-chatgpt', '/login'].includes(url.pathname)) return Response.redirect(new URL('/', url), 303);
    if (['/signout-with-chatgpt', '/logout'].includes(url.pathname)) return Response.redirect(new URL('/cdn-cgi/access/logout', url), 303);
    if (api) {
      try {
        if (!env.DB) return json({error: 'Chưa kết nối cơ sở dữ liệu D1.'}, 503);
        await initialize(env.DB);
        if (url.pathname === '/api/me' && request.method === 'GET') {
          await rememberAccount(env.DB, user);
          return json({authenticated: true, user: {id: user.userId, name: user.displayName, email: user.email}, cloudReady: true, capabilities: {pdfSync: false, avatarSync: true}, signIn: '/', signOut: '/cdn-cgi/access/logout'});
        }
        if (url.pathname === '/api/sync') return await syncHandler(request, env, user);
        if (url.pathname.startsWith('/api/avatar/')) return await avatarHandler(request, env.DB, user, url.pathname.slice('/api/avatar/'.length));
        if (url.pathname.startsWith('/api/files/')) return json({error: 'PDF được lưu trên từng thiết bị. Hãy chuyển PDF bằng bản sao lưu ZIP trong Sổ tay & sao lưu.'}, 410);
        return json({error: 'Không tìm thấy chức năng này.'}, 404);
      } catch {
        return json({error: 'Chưa đọc hoặc lưu được dữ liệu. Bản trên thiết bị vẫn được giữ.'}, 503);
      }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {allow: 'GET, HEAD'}});
    const response = await env.ASSETS.fetch(request);
    const secured = new Response(response.body, response);
    secured.headers.set('cache-control', 'private, max-age=0, must-revalidate');
    secured.headers.set('x-content-type-options', 'nosniff');
    secured.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    return secured;
  }
};
