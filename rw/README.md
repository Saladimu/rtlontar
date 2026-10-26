# Portal RW 06

Portal baca-saja untuk pengurus RW 06. Aplikasi statis + Cloudflare Pages Function sebagai gateway ke orkestrator RW (`RW Apps Script`). Browser tidak pernah memegang `GATEWAY_SECRET` atau token RT.

## Status

Milestone 1 (Phase 4): kerangka portal, gateway Access JWT, sesi/peran, ringkasan, data warga, kas, pengajuan surat, dan pengaduan. Keputusan surat/tanggapan pengaduan, pengguna, registry, outbox, audit, dan pengaturan menyusul pada milestone berikutnya.

## Struktur

```
rw/
  index.html                      Shell portal
  app.js                          Router, API client, render halaman
  styles.css                      Gaya portal
  tailwind.css, fonts.css, fonts/ Aset desain SAPA-RT
  functions/api/[[path]].js       Gateway Cloudflare Pages
  tools/mock-server.js            Preview lokal + API tiruan
  tools/mock-data.js              Data demo
  _headers, _routes.json          Konfigurasi Pages
```

## Environment variables (Cloudflare Pages)

| Variable | Wajib | Keterangan |
|---|---|---|
| `ORCHESTRATOR_URL` | Ya | URL Web App orkestrator yang berakhiran `/exec`. |
| `GATEWAY_SECRET` | Ya | Harus sama dengan Script Property `GATEWAY_SECRET` orkestrator. Minimal 16 karakter; gunakan 32+ acak. |
| `CF_ACCESS_TEAM_DOMAIN` | Ya | Mis. `rw06.cloudflareaccess.com` (tanpa `https://`). |
| `CF_ACCESS_AUD` | Ya | Audience tag aplikasi Cloudflare Access. Beberapa nilai dipisahkan koma. |
| `DEV_MODE` | Tidak | `true` hanya untuk preview lokal dan hanya berlaku pada host `localhost`/`127.0.0.1`. Jangan aktifkan di produksi. |
| `DEV_USER_EMAIL` | Tidak | Email fallback saat `DEV_MODE=true`. |

Deploy sebagai Cloudflare Pages project terpisah dengan **root directory `rw`**. Semua route statis dan `/api/*` berada di project yang sama.

## Cloudflare Access

1. Buat aplikasi Access untuk domain portal RW.
2. Kebijakan: izinkan hanya email pengurus RW (Google identity).
3. Salin audience tag ke `CF_ACCESS_AUD`.
4. Tambahkan `ORCHESTRATOR_URL` dan `GATEWAY_SECRET`.
5. Pastikan email pengguna juga terdaftar di tab `Users` orkestrator dengan peran `RW Admin` atau `RW Viewer`.
6. Jangan membuat bypass `/api`; gateway harus selalu memverifikasi JWT.

Gateway menerima `Cf-Access-Jwt-Assertion` atau cookie `CF_Authorization`, memverifikasi RS256 terhadap JWKS Access, lalu mengirim `email` terverifikasi + `gateway` ke orkestrator. Identitas/role dari browser diabaikan.

## Preview lokal

```bash
cd rw
node tools/mock-server.js
```

Buka `http://localhost:8001`. Akun demo:

- `rw@example.com` (RW Admin)
- `viewer@example.com` (RW Viewer, data dimasking)

Ganti akun demo:

```text
http://localhost:8001/?devEmail=viewer@example.com
```

Mock server tidak memakai Cloudflare Access dan tidak boleh dipakai di produksi.

## Catatan keamanan

- Jangan menaruh `GATEWAY_SECRET`, `RT_TOKEN_*`, atau `RW_TOKEN` di file statis, `localStorage`, atau repositori.
- Gateway hanya meneruskan aksi yang ada di whitelist dan selalu menimpa `email`/`gateway` dari browser.
- Masking RW Viewer dilakukan di orkestrator; UI hanya menampilkan peringatan.
- Respons gateway dan API memakai `cache-control: no-store`.

## Verifikasi

- `node --check rw/app.js`
- `node --check rw/functions/api/[[path]].js`
- `node --check rw/tools/mock-server.js`
- Uji lokal: login admin, buka semua halaman, ganti ke viewer, pastikan NIK/HP/alamat tersamar.
