# Portal RW 06

Portal pengurus RW 06. Aplikasi statis + Cloudflare Pages Function sebagai gateway ke orkestrator RW (`RW Apps Script`). Browser tidak pernah memegang `GATEWAY_SECRET` atau token RT.

## Status

Milestone 3 (Phase 4 selesai): portal, gateway Access JWT, sesi/peran, ringkasan, data warga, kas, pengajuan surat, pengaduan, dan lima halaman **Administrasi** (`Pengguna RW`, `Registry RT`, `Pengaturan`, `Outbox`, `Audit`). Tabel ringkasan menampilkan kolom **Status** (kesehatan RT) dan **alamat RT** pada baris kedua kolom RT; daftar surat dan pengaduan diurutkan **terbaru di atas**. RW Admin dapat menyetujui/mengembalikan/menolak surat, mengirim tanggapan pengaduan (Publik/Internal), mengelola pengguna dan registry RT, mengubah pengaturan orkestrator, mempratinjau dan mengirim **digest harian**, mengirim ulang outbox, serta membaca audit log. Halaman kas, surat, dan pengaduan punya **filter periode** dan tombol **cetak** laporan. RW Viewer tetap baca-saja: menu Administrasi dinonaktifkan, halaman tidak dapat dibuka, dan data sensitif dimasking.

Kartu KPI di **Ringkasan** dapat diklik dan langsung membuka halaman rinciannya (Warga aktif → Data Warga, Saldo kas → Kas RT, Surat menunggu → Pengajuan Surat, Pengaduan terbuka dan Eskalasi RW → Pengaduan; kartu **Eskalasi RW** sekaligus menyaring `Perlu Tindak Lanjut`). Halaman **Data Warga** punya tombol **Cetak laporan** (A4 landscape, mengikuti pencarian aktif) yang mengurutkan baris menurut **Nomor KK** menaik dengan **Kepala Keluarga** selalu di awal tiap KK dan — khusus **RW Admin** — tombol **Cek NIK ganda** yang memindai `Data_Warga` seluruh RT aktif, menampilkan NIK yang muncul lebih dari sekali (termasuk lintas RT) beserta ID barisnya untuk ditinjau manual, dan dapat dicetak. Sesuai FR-WRG-05, pemindaian **tidak menggabungkan** catatan apa pun; data RT tidak pernah ditulis balik. Tiap baris warga juga punya tombol **Riwayat** yang membuka panel berisi identitas warga (NIK, No. KK, status, alamat) beserta **riwayat pengajuan surat** dan **riwayat pengaduan** warga tersebut; pencocokan memakai NIK (digit saja, minimal 8 digit) dan jatuh ke nama saat NIK kosong atau tersamar untuk RW Viewer. Panel ini baca-saja dan tidak mengubah data warga, surat, maupun pengaduan. Tiap baris riwayat dapat **diklik** (atau lewat tombol **Buka**) untuk membuka detail pengajuan surat atau pengaduan yang asli, lengkap dengan tombol **Kembali ke riwayat warga** agar pengguna tidak kehilangan konteks.

## Performa navigasi

- **Cache baca di browser (stale-while-revalidate)** — setiap daftar disimpan di memori dengan TTL 20-60 detik (`rwList` 60 detik). Saat menu dibuka, data cache langsung tampil (tanpa spinner), lalu `revalidate()` mengambil data baru di latar belakang dan hanya menggambar ulang bila isinya berubah. Indikator memuat hanya muncul bila halaman belum punya data sama sekali.
- **Cache baca bertahan di `sessionStorage`** — hasil baca yang aman (`rwDashboard`, `rwList`, `rwUsersList`, `rwRegistryList`, `rwSettingsGet`, `rwAuditList`, `rwOutboxList`) juga ditulis ke `sessionStorage` per tab dengan awalan `rw_read_v1:`. Saat halaman dimuat ulang atau dibuka kembali di tab yang sama, `boot()` menghidrasi cache ini lebih dulu sehingga ringkasan dan daftar tampil seketika, lalu divalidasi ulang di latar belakang. Tiap entri diberi tag `BUILD` sehingga deploy baru otomatis membuang cache lama; ukuran per entri dibatasi 256 KB dan bila kuota penuh cache persisten dibersihkan lalu dicoba sekali lagi.
- **Kerangka aplikasi tampil sebelum verifikasi sesi** — bila tab ini sudah pernah memuat portal dan sesi tersimpan masih di bawah 5 menit, `boot()` langsung menggambar sidebar, judul halaman, dan ringkasan dari cache. `rwSession` tetap diverifikasi ulang dengan `{fresh:true}` di latar belakang; bila akun sudah dicabut atau JWT tidak valid, layar akses menggantikan aplikasi seperti biasa. Ini menghapus jeda spinner pada muat ulang.
- **Ringkasan dimuat paralel dengan sesi** — `boot()` memulai `rwDashboard` bersamaan dengan `rwSession`, jadi dashboard tidak menunggu verifikasi sesi selesai. Respons `rwRefresh` (tombol **Segarkan**) juga ditulis ke cache baca agar perpindahan menu berikutnya tidak memicu permintaan baru.
- **Prefetch setelah dashboard** — setelah `rwSession` dan dashboard siap, portal mengambil sekali daftar utama (Data Warga, Pengajuan Surat, Lapor Aspirasi, Iuran Kas) secara bertahap dengan jeda 100 ms + 120 ms per item, sehingga klik menu pertama memakai cache tanpa berebut kuota RT. Untuk **RW Admin**, prefetch berlanjut ke halaman Administrasi (Pengguna RW, Registry RT, Pengaturan, Outbox, Audit) agar menu yang biasanya paling terasa "Memuat..." langsung tampil.
- **Aset boleh di-cache dengan validasi** — `app.js` dan `styles.css` dikirim dengan `Cache-Control: public, max-age=0, must-revalidate` (bukan `no-store`), dan `app.js` di-`preload`, sehingga pemuatan ulang tidak mengunduh ulang seluruh berkas sementara deploy baru tetap langsung terpakai melalui ETag/304.
- **Bust cache saat menulis** — semua aksi tulis (keputusan surat, tanggapan pengaduan, pengguna, registry, pengaturan, outbox) memanggil `clearReadCache()` agar tampilan berikutnya tidak menyajikan data lama. Dashboard yang diminta eksplisit segar memakai `{fresh:true}` untuk menembus cache.
- **Sisi orkestrator** — `rwList` memakai cache `CacheService` 25 detik dengan *epoch* yang dinaikkan pada setiap penulisan, `ensureSchema()` diperiksa sekali per versi, `Users` dibaca sekali per permintaan, snapshot KPI semua RT dibaca dalam satu penelusuran, refresh KPI memakai 4 panggilan per RT, dan audit login dibatasi sekali per 10 menit.

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
- **Registry RT** (`rwRegistryList`/`rwRegistrySave`) — RT ID, nama, **alamat**, endpoint Web App, status aktif, backend version, sinkron terakhir, dan error terakhir. Validasi: `RTNNN`, nama wajib, endpoint `https://.../exec`, endpoint tidak boleh dipakai RT lain, dan registry dibatasi **maksimal 10 RT** (RT ke-11 ditolak `max_rts`). RT yang `Backend Version`-nya berbeda dari pengaturan `EXPECTED_BACKEND_VERSION` ditandai **Versi beda** di daftar dan dashboard. Tombol **Cek** memanggil `rwRtHealth`. Menonaktifkan RT meminta konfirmasi karena RT hilang dari dashboard.
- **Pengaturan** (`rwSettingsGet`/`rwSettingsSave`) — parameter orkestrator tanpa deploy ulang: `CACHE_TTL_SECONDS`, `OUTBOX_MAX_ATTEMPTS`, `OUTBOX_BASE_DELAY_SECONDS`, retensi audit/keputusan/snapshot, `RW_MASK_VIEWER`, `EXPECTED_BACKEND_VERSION`, `DIGEST_ENABLED`, `DIGEST_HOUR`, `DIGEST_RECIPIENTS`. Nilai divalidasi di orkestrator (`invalid_setting`) dan disimpan per baris. Panel **Digest harian** di atas tabel menyediakan **Pratinjau** (`rwDigestPreview`) dan **Kirim sekarang** (`rwDigestSend`); pengiriman meminta konfirmasi in-app dan dicatat di audit. Setelah kirim manual, portal menawarkan **Salin teks** berisi teks yang sama dengan email agar bisa ditempel ke WhatsApp; tombol **Salin teks untuk WhatsApp** juga tersedia di bawah pratinjau.
- **Filter periode dan cetak** — halaman **Kas**, **Surat**, dan **Pengaduan** punya input tanggal *Dari*/*Sampai* dan tombol **Reset periode** yang muncul saat filter aktif. Perbandingan memakai tanggal `yyyy-mm-dd` zona `Asia/Jakarta`. Tombol cetak membuka jendela cetak A4 berisi header, periode, tabel, dan total; halaman kas juga menampilkan saldo awal/akhir periode. Laporan dipaginasi manual (`openPagedReport`): kop berulang penuh di setiap halaman, meta periode/kartu ringkasan hanya di halaman pertama, header tabel ikut berulang, dan footer tiap halaman berisi **Hal X/Y**. Orientasi mengikuti format laporan: **Kas = A4 landscape** (7 kolom), **Surat/Pengaduan/NIK ganda = A4 portrait**, **Data Warga = A4 landscape** (8 kolom, urut Nomor KK + Kepala Keluarga di awal).
- **Ringkasan yang bisa ditelusuri** — setiap kartu KPI adalah tombol (`data-kpi-page`, `#kpi-*`) yang memanggil `navigate()` ke halaman rincian; kartu **Eskalasi RW** juga mengisi filter status `Perlu Tindak Lanjut` pada halaman Pengaduan dan mengembalikan halaman ke 1.
- **Data Warga: cetak dan cek NIK ganda** — **Cetak laporan** memakai baris yang sedang terfilter (pencarian aktif ikut tercetak). **Cek NIK ganda** (hanya RW Admin) memindai `Data_Warga` semua RT aktif lewat `rwList` yang sudah di-cache, mengelompokkan NIK yang muncul lebih dari sekali, menandai kelompok lintas RT, dan menampilkan ID baris untuk ditinjau manual di RT masing-masing. Pemindaian bersifat baca-saja dan **tidak menggabungkan** data (FR-WRG-05); RT yang gagal dipindai dicantumkan agar hasil tidak disalahartikan sebagai lengkap. Daftar dapat dicetak dengan tombol **Cetak daftar NIK ganda**.
- **Outbox** (`rwOutboxList`/`rwOutboxRetry`) — antrean pengiriman ke RT beserta status `Pending`/`Failed`/`Sent`, jumlah percobaan, jadwal retry, dan error terakhir. **Kirim** mengirim ulang satu entri (entri `Sent` dinonaktifkan), **Proses antrean** memproses hingga 50 entri; keduanya memakai konfirmasi in-app.
- **Audit** (`rwAuditList`) — 200 entri terakhir: waktu, user/email, aksi, RT/target, hasil, dan detail. Retensi audit 12 bulan; keputusan/tanggapan dan snapshot 24 bulan.

Mock server lokal menyediakan data contoh untuk kelima halaman dan meniru penyimpanan pengguna, registry, pengaturan, digest, serta retry outbox sehingga alur dapat dicoba tanpa orkestrator.

## Struktur

```
rw/
  index.html                      Shell portal
  app.js                          Router, API client, render halaman
  styles.css                      Gaya portal
  tailwind.css, fonts.css, fonts/ Aset desain SAPA-RT
  favicon.ico, apple-touch-icon.png,
  logo-192/512.webp, logo-192/512.png,
  manifest.webmanifest            Ikon dan manifest web app
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

JWKS di-cache 5 menit. Bila `kid` pada token tidak ada di cache (Cloudflare baru merotasi signing key), gateway mengambil ulang JWKS sekali sebelum menolak. Pengambilan ulang paksa dibatasi maksimal sekali per 60 detik agar token dengan `kid` palsu tidak membanjiri endpoint JWKS.

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
- Portal memakai timeout 25 detik per permintaan baca, satu kali percobaan ulang otomatis untuk kegagalan baca yang bersifat sementara (jaringan/timeout/5xx), serta menggabungkan permintaan baca identik yang berjalan bersamaan.
- Gateway memberi batas 20 detik saat memanggil orkestrator dan 10 detik saat mengambil JWKS, jadi Apps Script yang menggantung tidak menahan permintaan tanpa batas.
- RT juga memberi batas waktu: 15 detik untuk pembacaan JSONP per basis, 30 detik untuk operasi tulis (dengan `AbortController`). Tanpa batas ini, koneksi yang menggantung akan mengunci guard anti-klik-ganda dan antrean outbox sampai halaman dimuat ulang.
- Operasi tulis hanya diulang otomatis bila idempoten (memakai `ID` stabil atau `ref` surat). `submitLapor` selalu membuat baris baru tanpa kunci, jadi **tidak** pernah diulang dan tidak dipindah ke basis cadangan saat gagal jaringan, agar pengaduan tidak berganda.
- Tombol **Segarkan** memakai dashboard yang dikembalikan `rwRefresh` sehingga tidak memicu fan-out kedua.
- Jika tetap gagal, halaman menampilkan tombol **Coba lagi**; data terakhir yang berhasil dimuat tetap dipertahankan orkestrator sebagai snapshot `Stale`.

## Catatan keamanan

- Jangan menaruh `GATEWAY_SECRET`, `RT_TOKEN_*`, atau `RW_TOKEN` di file statis, `localStorage`, atau repositori.
- Gateway hanya meneruskan aksi yang ada di whitelist `ACTIONS` (`rw/functions/api/[[path]].js`) dan selalu menimpa `email`/`gateway` dari browser. Setiap aksi `rw...` baru di orkestrator **wajib** ditambahkan ke allowlist ini; `node tools/check-deployment.js` akan gagal bila ada aksi orkestrator yang belum terdaftar (gejala di UI: "Aksi portal RW tidak dikenal").
- Masking RW Viewer dilakukan di orkestrator; UI hanya menampilkan peringatan.
- Respons gateway dan API memakai `cache-control: no-store`.

## Verifikasi

- `node --check rw/app.js`
- `node --check rw/functions/api/[[path]].js`
- `node --check rw/tools/mock-server.js`
- Uji lokal: login admin, setujui/kembalikan/tolak surat, kirim tanggapan pengaduan, tambah/ubah pengguna, simpan registry dan pengaturan, kirim ulang outbox, buka audit; lalu ganti ke viewer dan pastikan menu Administrasi nonaktif, tidak ada kontrol tulis, serta NIK/HP/alamat tersamar.
- Harness: `/tmp/opencode/test_rw_portal.js` (62 skenario, termasuk cache `sessionStorage`, hidrasi ulang, pembersihan cache saat menulis, dan tampilan sesi tersimpan yang tetap ditutup saat akses dicabut) mencakup konfirmasi, pembatalan, validasi catatan, penolakan, tanggapan pengaduan, pemulihan setelah kegagalan koneksi yang ambigu, lima halaman administrasi (pengguna, registry, pengaturan, outbox, audit), digest (pratinjau + kirim), filter periode dan cetak laporan berulang (kas dan data warga landscape, surat/pengaduan/NIK ganda portrait, penghitung **Hal X/Y**), navigasi kartu KPI, cetak data warga (A4 landscape, urutan Nomor KK + Kepala Keluarga di awal), riwayat per warga (surat + pengaduan, pencocokan NIK lalu nama saat tersamar, buka detail + kembali, baca-saja), pemindaian NIK ganda lintas RT (tanpa menggabung/mengubah data), guard `last_admin`, dan gating Viewer.

