import {json, sameOrigin} from './study-service.mjs';

export const schema = [
  'CREATE TABLE IF NOT EXISTS study_records (user_id TEXT NOT NULL,record_key TEXT NOT NULL,value TEXT NOT NULL,stamp INTEGER NOT NULL,actor TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,record_key))',
  'CREATE TABLE IF NOT EXISTS hao_accounts (user_id TEXT PRIMARY KEY NOT NULL,email TEXT NOT NULL,display_name TEXT NOT NULL,created_at INTEGER NOT NULL,last_seen INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS hao_avatars (user_id TEXT NOT NULL,hash TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,hash))'
];
const initialized = new WeakMap();
export async function initialize(db) {
  if (!db) throw new Error('Missing D1 binding');
  if (!initialized.has(db)) {
    const task = db.batch(schema.map(sql => db.prepare(sql))).catch(error => {initialized.delete(db); throw error;});
    initialized.set(db, task);
  }
  await initialized.get(db);
}
export async function rememberAccount(db, user) {
  const now = Date.now();
  await db.prepare('INSERT INTO hao_accounts(user_id,email,display_name,created_at,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,last_seen=excluded.last_seen').bind(user.userId, user.email, user.displayName, now, now).run();
}
async function readLimited(request, limit) {
  if (!request.body) return null;
  const reader = request.body.getReader(), chunks = [];
  let total = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {await reader.cancel(); return null;}
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of chunks) {bytes.set(part, offset); offset += part.byteLength;}
  return bytes;
}
function imageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP') return 'image/webp';
  return null;
}
export async function avatarHandler(request, db, user, hash) {
  if (!/^[a-f0-9]{64}$/.test(hash)) return json({error: 'Mã ảnh không hợp lệ.'}, 400);
  if (request.method === 'PUT') {
    if (!sameOrigin(request) || request.headers.get('x-hao-upload') !== '1') return json({error: 'Nguồn tải lên không hợp lệ.'}, 403);
    const mime = request.headers.get('content-type')?.split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return json({error: 'Hãy chọn ảnh JPG, PNG hoặc WebP.'}, 415);
    const bytes = await readLimited(request, 512 * 1024);
    if (!bytes?.length) return json({error: 'Ảnh cần nhỏ hơn 512 KB sau khi xử lý.'}, 413);
    if (imageType(bytes) !== mime) return json({error: 'Nội dung ảnh không hợp lệ.'}, 400);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    if ([...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('') !== hash) return json({error: 'Mã ảnh không khớp nội dung.'}, 400);
    await db.prepare('INSERT INTO hao_avatars(user_id,hash,mime,bytes,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,hash) DO UPDATE SET updated_at=excluded.updated_at').bind(user.userId, hash, mime, bytes, Date.now()).run();
    return json({ok: true, hash, size: bytes.byteLength});
  }
  if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'Phương thức không được hỗ trợ.'}, 405);
  const row = await db.prepare('SELECT mime,bytes FROM hao_avatars WHERE user_id=? AND hash=?').bind(user.userId, hash).first();
  if (!row) return json({error: 'Không tìm thấy ảnh trong tài khoản này.'}, 404);
  const bytes = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes);
  return new Response(request.method === 'HEAD' ? null : bytes, {headers: {'content-type': row.mime, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox"}});
}
