import {json, sameOrigin} from './study-service.mjs';
import {initialize} from './standalone-store.mjs';
import {dayKey, DAY} from '../public/study-model.js';

export const mailConfigured = env => !!(env.RESEND_API_KEY && env.REMINDER_FROM);
export async function reminderHandler(request, env, user) {
  if (!user?.userId) return json({error:'Bạn cần đăng nhập.'},401);
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT enabled FROM hao_reminders WHERE user_id=?').bind(user.userId).first();
    return json({configured:mailConfigured(env),enabled:!!row?.enabled,email:user.email,hour:'21:00',timeZone:'Asia/Ho_Chi_Minh'});
  }
  if (request.method !== 'POST') return json({error:'Phương thức không hỗ trợ.'},405);
  if (!sameOrigin(request) || request.headers.get('x-hao-reminder') !== '1') return json({error:'Nguồn yêu cầu không hợp lệ.'},403);
  let data;
  try {const raw = await request.text();if(raw.length>300)return json({error:'Yêu cầu quá dài.'},413);data=JSON.parse(raw);if(typeof data.enabled!=='boolean')throw Error();}catch{return json({error:'Chọn bật hoặc tắt nhắc học.'},400);}
  if (data.enabled && !mailConfigured(env)) return json({error:'Chủ website chưa bật dịch vụ gửi email.'},503);
  // The recipient always comes from the verified Access identity, never the body.
  await env.DB.prepare('INSERT INTO hao_reminders(user_id,email,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,enabled=excluded.enabled,updated_at=excluded.updated_at').bind(user.userId,user.email,data.enabled?1:0,Date.now()).run();
  return json({ok:true,enabled:data.enabled,email:user.email});
}
export async function sendReminders(env, at = Date.now(), {fetcher = fetch} = {}) {
  if (!mailConfigured(env) || !env.DB) return {sent:0,disabled:true};
  await initialize(env.DB);
  const today = dayKey(at), yesterday = dayKey(at-DAY);
  const users = await env.DB.prepare('SELECT user_id,email FROM hao_reminders WHERE enabled=1 ORDER BY user_id LIMIT 50').all();
  let sent = 0;
  for (const user of users.results || []) {
    const rows = await env.DB.prepare('SELECT record_key FROM study_records WHERE user_id=? AND deleted=0 AND (record_key=? OR record_key=?)').bind(user.user_id,'day:'+today,'day:'+yesterday).all();
    const keys = new Set((rows.results||[]).map(r=>r.record_key));
    if (keys.has('day:'+today) || !keys.has('day:'+yesterday)) continue;
    const subject = 'Hǎo nhắc bạn: một chút tiếng Trung hôm nay';
    const text = 'Bạn đã học hôm qua. Hôm nay hãy dành vài phút ôn từ để tiếp nối chuỗi ngày học.\n\nMở Hǎo: https://haohsk.thamnam875.workers.dev/\n\nBạn có thể tắt email trong Tiến độ → Nhắc học.';
    const payload = JSON.stringify({from:env.REMINDER_FROM,to:[user.email],subject,text});
    await env.DB.prepare('INSERT INTO hao_mail_log(user_id,day,status,payload,updated_at) VALUES(?,?,\'pending\',?,?) ON CONFLICT(user_id,day) DO NOTHING').bind(user.user_id,today,payload,at).run();
    const log = await env.DB.prepare('SELECT status,payload FROM hao_mail_log WHERE user_id=? AND day=?').bind(user.user_id,today).first();
    if (log?.status === 'sent') continue;
    try {
      if (JSON.parse(log.payload).to[0] !== user.email) continue;
      const response = await fetcher('https://api.resend.com/emails',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json','idempotency-key':'hao-streak/'+user.user_id+'/'+today},body:log.payload});
      if (!response.ok) continue;
      const result = await response.json();if(typeof result.id!=='string')continue;
      await env.DB.prepare('UPDATE hao_mail_log SET status=\'sent\',updated_at=? WHERE user_id=? AND day=?').bind(at,user.user_id,today).run();sent++;
    } catch { /* Retry only this local day, with the same idempotency key. */ }
  }
  return {sent};
}
