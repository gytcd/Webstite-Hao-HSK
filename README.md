# Hǎo · HSK learning workspace

Same private Site: appgprj_6aec417b9a04819194070594eb230ba6.

The blue edition runs on the supplied Vinext/Cloudflare starter. Authored static UI and textbook assets are in `public/`; the HTML shell is returned by `app/route.ts`. Hosted sign-in/sign-out is owned by Sites. No client-side passwords, alternate OAuth stack or identity supplied in request bodies is used.

Authenticated `/api/me`, `/api/sync` and `/api/files/:hash` routes use the starter's ChatGPT identity helper. All records and PDF objects are keyed by the stable signed-in user ID. Private audience remains unchanged. D1 holds per-field progress/course records; R2 stores uploaded PDFs per user. Per-record timestamps and deterministic device IDs merge independent offline edits. Newer edits win for the same note. Tombstones preserve deletion. Client changes are queued in account-scoped IndexedDB, retried on connection/focus and polled while visible. PDF uploads are limited to 95 MiB each; larger local files do not block progress sync. Other-device PDF downloads are lazy and cached when opened.

On first sign-in, version 2 local data is claimed/migrated once to an account-specific database; a different account does not inherit it. Version 1 custom words and progress still migrate where authorized by the local claim. Profile settings show cloud status and last successful sync.

Original HSK 1 textbook (144 pages), workbook (139 pages) and writing excerpt (15 pages) remain. There are 15 authored study units, 130 selected vocabulary entries (129 distinct), 93 textbook and 33 workbook audio links. Eighteen exact textbook crops cover all 15 lessons, with three extra word pictures. Their source-page/crop metadata is in `public/data/figures.json`.

Tests: `node tests/core.mjs` and `node --test tests/cloud.test.mjs`. The latter verifies authentication, account isolation, stale edits/deletion, origin checks, PDF ownership, client merge and image mappings. Build with the Sites build helper. D1 migrations are generated from `db/schema.ts`; apply to preview explicitly, and Sites applies hosted schema migrations on deployment. Public authored files are copied into deployment output by the starter.

Editable profiles in **Tài khoản & đồng bộ → Thông tin cá nhân** include display name, full name, contact email, location, bio and avatar. Contact email is independent of ChatGPT sign-in identity. Each field synchronizes independently. JPG/PNG/WebP avatars are cropped to a 512 px square in the browser, stored by content hash, and uploaded to private account-owned R2 objects through `/api/avatar/:hash`. Images can be replaced or removed from the profile; offline changes retry on reconnect. The original source image limit is 8 MiB; the API accepts at most 2 MiB. Browser image preparation requires HTTPS.

Profile checks: `node --test tests/profile.test.mjs tests/cloud.test.mjs` and `node tests/profile-worker.mjs`. The Worker integration exercises real image bytes, avatar ownership, D1 profile persistence and account isolation. Browser QA covers editing, saving, reload persistence and cancelling drafts; the HTTP preview cannot exercise WebCrypto avatar preparation, so use the HTTPS Site for that browser flow.
