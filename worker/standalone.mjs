import {accessSettings, createAccessVerifier} from '../lib/access-auth.mjs';
import {initialize, rememberAccount, avatarHandler} from '../lib/standalone-store.mjs';
import {json, syncHandler} from '../lib/study-service.mjs';

const verify = createAccessVerifier();
const escapeHTML = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function signInURL(url, settings) {
  const destination = new URL('/cdn-cgi/access/login/' + url.hostname, settings.issuer);
  destination.searchParams.set('kid', settings.audience);
  destination.searchParams.set('redirect_url', '/');
  return destination;
}
function setupResponse(status = 503, {url, settings, code = 'ACCESS_CONFIGURATION_MISSING'} = {}) {
  const missingConfig = status === 503;
  const loggedOut = !missingConfig && code === 'ACCESS_TOKEN_MISSING' && url?.pathname === '/' && url.searchParams.get('__cf_access_message') === 'logged_out';
  const title = missingConfig ? 'Hǎo chưa có đủ cấu hình đăng nhập.' : loggedOut ? 'Bạn đã đăng xuất.' : 'Chưa xác minh được phiên đăng nhập.';
  const message = missingConfig
    ? 'Chủ website cần kiểm tra hai biến ACCESS_TEAM_DOMAIN và ACCESS_AUD trong cấu hình triển khai.'
    : loggedOut ? 'Đăng nhập lại bằng email được cấp quyền để tiếp tục học.'
    : 'Chọn đăng nhập bằng email để mở cổng xác thực Cloudflare. Nếu đã nhập mã mà vẫn thấy trang này, gửi mã kiểm tra bên dưới cho người quản lý website.';
  const links = missingConfig ? '' : '<p><a href="' + escapeHTML(signInURL(url, settings).href) + '">Đăng nhập bằng email</a>' + (loggedOut ? '' : ' · <a href="/cdn-cgi/access/logout">Kết thúc phiên cũ</a>') + '</p>';
  const detail = missingConfig || loggedOut ? '' : '<p>Mã kiểm tra: <code>' + escapeHTML(code) + '</code></p>';
  return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hǎo · Đăng nhập</title><body style="font:16px system-ui;max-width:640px;margin:12vh auto;padding:24px;line-height:1.7"><h1>' + title + '</h1><p>' + message + '</p>' + links + detail + '</body></html>', {status: loggedOut ? 200 : status, headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-hao-access-status': missingConfig ? 'configuration-missing' : loggedOut ? 'logged-out' : 'session-invalid', 'x-hao-access-code': code}});
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), api = url.pathname.startsWith('/api/');
    const settings = accessSettings(env);
    if (!settings) return api ? json({error: 'Chưa cấu hình đăng nhập email.'}, 503) : setupResponse();
    if (['/signin-with-chatgpt', '/login'].includes(url.pathname)) return new Response(null, {status: 303, headers: {location: signInURL(url, settings).href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer'}});
    if (['/signout-with-chatgpt', '/logout'].includes(url.pathname)) return Response.redirect(new URL('/cdn-cgi/access/logout', url), 303);
    const diagnostics = {};
    const user = await verify(request, env, {diagnostics});
    if (!user) return api ? json({error: 'Bạn cần đăng nhập lại bằng email.', code: diagnostics.code}, 401) : setupResponse(401, {url, settings, code: diagnostics.code});
    if (url.pathname === '/' && url.searchParams.has('__cf_access_message')) return new Response(null, {status: 303, headers: {location: new URL('/', url).href, 'cache-control': 'no-store'}});
    if (api) {
      try {
        if (!env.DB) return json({error: 'Chưa kết nối cơ sở dữ liệu D1.'}, 503);
        await initialize(env.DB);
        if (url.pathname === '/api/me' && request.method === 'GET') {
          await rememberAccount(env.DB, user);
          return json({authenticated: true, user: {id: user.userId, name: user.displayName, email: user.email}, cloudReady: true, capabilities: {pdfSync: false, avatarSync: true}, signIn: '/login', signOut: '/cdn-cgi/access/logout'});
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
