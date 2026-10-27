# Portal RW 06

Portal pengurus RW 06. Aplikasi statis + Cloudflare Pages Function sebagai gateway ke orkestrator RW (`RW Apps Script`). Browser tidak pernah memegang `GATEWAY_SECRET` atau token RT.

## Status

Milestone 3 (Phase 4 selesai): portal, gateway Access JWT, sesi/peran, ringkasan, data warga, kas, pengajuan surat, pengaduan, dan lima halaman **Administrasi** (`Pengguna RW`, `Registry RT`, `Pengaturan`, `Outbox`, `Audit`). Tabel ringkasan menampilkan kolom **Status** (kesehatan RT) dan **alamat RT** pada baris kedua kolom RT; daftar surat dan pengaduan diurutkan **terbaru di atas**. RW Admin dapat menyetujui/mengembalikan/menolak surat, mengirim tanggapan pengaduan (Publik/Internal), mengelola pengguna dan registry RT, mengubah pengaturan orkestrator, mengirim ulang outbox, serta membaca audit log. RW Viewer tetap baca-saja: menu Administrasi dinonaktifkan, halaman tidak dapat dibuka, dan data sensitif dimasking.

## Aksi tulis

- **Keputusan surat** hanya untuk `RW Admin` dan hanya saat `Rw Status=Menunggu`.
  - Setujui boleh tanpa catatan.
  - Kembalikan/Tolak wajib catatan minimal 3 karakter.
  - Setelah 3 kali revisi, **Kembalikan** dinonaktifkan; **Setujui** dan **Tolak** tetap tersedia sebagai keputusan final.
  - `expectedVersi` dikirim dari `Rw Versi`; perubahan bersamaan ditolak sebagai `stale`.
- **Tanggapan pengaduan** hanya untuk `RW Admin`.
  - Catatan wajib minimal 3 karakter.
  - Status dapat dipertahankan, diubah ke `Ditangani RW`, atau `Selesai RW`.
  - Visibilitas `Publik` juga menyalin catatan ke kolom RT untuk portal warga; `Internal` hanya tersimpan untuk pengurus RW.
  - `expectedDiperbarui` dikirim dari `Rw Diperbarui`.
- Semua aksi memakai modal konfirmasi in-app (`#modal-warning`), bukan `confirm()` bawaan browser.
- Kunci idempotensi dibuat deterministik dari RT, ID, versi/waktu data, aksi, dan isi catatan. Percobaan ulang dengan isi yang sama tidak membuat duplikat.
- Bila RT tidak dapat dihubungi, orkestrator menyimpan aksi di outbox dan UI menampilkan bahwa pengiriman akan dicoba ulang otomatis.
- Kegagalan jaringan/5xx yang membuat hasil tidak pasti akan menutup drawer dan memuat ulang daftar; periksa status/riwayat sebelum mengirim ulang.


## Halaman administrasi

Semua halaman di bawah hanya untuk `RW Admin`. Bila `RW Viewer` membuka portal, item menu Administrasi tampil nonaktif (`disabled` + tooltip "Hanya RW Admin") dan `navigate()` mengalihkan ke Ringkasan tanpa memanggil API admin.

- **Pengguna RW** (`rwUsersList`/`rwUsersSave`) — daftar email, nama, peran, status, dan waktu pembaruan. Form menambah pengguna baru atau mengubah nama/peran/status. Menurunkan atau menonaktifkan **RW Admin aktif terakhir** diblokir di klien dan orkestrator (`last_admin`); penurunan peran lain meminta konfirmasi in-app. Email harus sama dengan identitas Google terverifikasi Cloudflare Access.
- **Registry RT** (`rwRegistryList`/`rwRegistrySave`) — RT ID, nama, **alamat**, endpoint Web App, status aktif, backend version, sinkron terakhir, dan error terakhir. Validasi: `RTNNN`, nama wajib, endpoint `https://.../exec`, endpoint tidak boleh dipakai RT lain. Tombol **Cek** memanggil `rwRtHealth`. Menonaktifkan RT meminta konfirmasi karena RT hilang dari dashboard.
- **Pengaturan** (`rwSettingsGet`/`rwSettingsSave`) — parameter orkestrator tanpa deploy ulang: `CACHE_TTL_SECONDS`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_BASE_DELAY_SECONDS`, retensi audit/keputusan/snapshot, `RW_MASK_VIEWER`, `DIGEST_ENABLED`, `DIGEST_HOUR`. Nilai divalidasi di orkestrator (`invalid_setting`) dan disimpan per baris.
- **Outbox** (`rwOutboxList`/`rwOutboxRetry`) — antrean pengiriman ke RT beserta status `Pending`/`Failed`/`Sent`, jumlah percobaan, jadwal retry, dan error terakhir. **Kirim** mengirim ulang satu entri (entri `Sent` dinonaktifkan), **Proses antrean** memproses hingga 50 entri; keduanya memakai konfirmasi in-app.
- **Audit** (`rwAuditList`) — 200 entri terakhir: waktu, aktor/email, aksi, RT/target, hasil, dan detail. Retensi audit 12 bulan; keputusan/tanggapan dan snapshot 24 bulan.

Mock server lokal menyediakan data contoh untuk kelima halaman dan meniru penyimpanan pengguna, registry, pengaturan, serta retry outbox sehingga alur dapat dicoba tanpa orkestrator.

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

### Verifikasi Access gagal (`JWKS HTTP 404`)

Pesan ini muncul **sebelum** orkestrator memeriksa tab `Users`, jadi email yang sudah terdaftar tetap bisa gagal.

- `CF_ACCESS_TEAM_DOMAIN` harus **team domain Zero Trust**, mis. `rw06.cloudflareaccess.com`, **bukan** domain portal seperti `sapa-rw06.pages.dev`, dan tanpa path `/cdn-cgi/access/certs`.
- `CF_ACCESS_AUD` harus audience tag dari aplikasi Access yang sama.
- Setelah mengubah environment variable, buat **deployment baru** di Cloudflare Pages agar nilai baru dipakai.
- Uji `https://<team-domain>/cdn-cgi/access/certs`; respons harus JSON berisi `keys`. Jika 404, team domain masih salah.
- Cara menemukan team domain: buka portal tanpa sesi, lalu lihat header `Location` pada redirect Access; host-nya adalah team domain (mis. `rt017.cloudflareaccess.com`). Nilai `aud` pada parameter `meta` adalah audience tag aplikasi.
- Baru setelah JWT terverifikasi, email dicek di tab `Users` orkestrator (`Aktif=Ya`, peran `RW Admin`/`RW Viewer`).

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

## Keandalan pemuatan data

- Orkestrator menjalankan KPI semua RT dalam satu `UrlFetchApp.fetchAll` (paralel), bukan berurutan per RT, sehingga latensi mengikuti RT paling lambat dan dashboard tidak melewati batas waktu gateway.
- Portal memakai timeout 25 detik per permintaan, satu kali percobaan ulang otomatis untuk kegagalan baca yang bersifat sementara (jaringan/timeout/5xx), serta menggabungkan permintaan baca identik yang berjalan bersamaan.
- Tombol **Segarkan** memakai dashboard yang dikembalikan `rwRefresh` sehingga tidak memicu fan-out kedua.
- Jika tetap gagal, halaman menampilkan tombol **Coba lagi**; data terakhir yang berhasil dimuat tetap dipertahankan orkestrator sebagai snapshot `Stale`.

## Catatan keamanan

- Jangan menaruh `GATEWAY_SECRET`, `RT_TOKEN_*`, atau `RW_TOKEN` di file statis, `localStorage`, atau repositori.
- Gateway hanya meneruskan aksi yang ada di whitelist dan selalu menimpa `email`/`gateway` dari browser.
- Masking RW Viewer dilakukan di orkestrator; UI hanya menampilkan peringatan.
- Respons gateway dan API memakai `cache-control: no-store`.

## Verifikasi

- `node --check rw/app.js`
- `node --check rw/functions/api/[[path]].js`
- `node --check rw/tools/mock-server.js`
- Uji lokal: login admin, setujui/kembalikan/tolak surat, kirim tanggapan pengaduan, tambah/ubah pengguna, simpan registry dan pengaturan, kirim ulang outbox, buka audit; lalu ganti ke viewer dan pastikan menu Administrasi nonaktif, tidak ada kontrol tulis, serta NIK/HP/alamat tersamar.
- Harness: `/tmp/opencode/test_rw_portal.js` mencakup konfirmasi, pembatalan, validasi catatan, penolakan, tanggapan pengaduan, pemulihan setelah kegagalan koneksi yang ambigu, lima halaman administrasi (pengguna, registry, pengaturan, outbox, audit), guard `last_admin`, dan gating Viewer.

