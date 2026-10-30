# RW 06 Orchestrator (`RW Apps Script/code.gs`)

Backend orkestrator untuk portal RW 06. Berkas ini **bukan** backend RT dan tidak boleh dipasang di spreadsheet RT. Setiap RT tetap memakai `Apps Script/code.gs` sendiri; orkestrator hanya membaca dan menulis kolom workflow RW melalui endpoint `rw*` RT.

- Versi kode: `rw-orchestrator-v1-2026-10-29-03`
- RT minimum: `publik-v39-2026-10-28` (v39: `action=read` mengirim `Lapor_Tindak_Lanjut` untuk timeline di panel RT; v38: batas 3 revisi hanya menutup `Kembalikan`; `Tolak` final tetap tersedia; v37 memperbaiki status/timestamp RW; v36 menambahkan `saldoAwal` pada `rwRead` untuk `Iuran_Kas`)
- Pola: hub-and-spoke. Browser RW tidak pernah memanggil Web App RT secara langsung.

## 1. Prasyarat

1. Setiap RT sudah deploy backend v37 atau lebih baru.
2. Setiap RT memiliki `RW_TOKEN` unik dan `RT_ID` (mis. `RT018`) di Script Properties RT.
3. Tersedia satu Spreadsheet khusus orkestrator dan satu project Apps Script yang terikat padanya.
4. Portal RW (Phase 4) akan memakai Cloudflare Pages Function sebagai gateway. Fungsi tersebut memverifikasi Cloudflare Access lalu mengirim `gateway` + `email` terverifikasi ke orkestrator.

Jangan menyimpan `RW_TOKEN`, `GATEWAY_SECRET`, atau token RT lain di spreadsheet, repositori, atau browser.

## 2. Pemasangan

1. Buat Spreadsheet baru khusus RW 06, lalu buat Apps Script yang terikat padanya.
2. Salin seluruh isi `RW Apps Script/code.gs` ke `Code.gs`.
3. Buka **Project Settings > Script Properties** dan isi:

| Properti | Wajib | Keterangan |
|---|---|---|
| `GATEWAY_SECRET` | Ya | String acak minimal 32 karakter. Hanya diketahui gateway dan orkestrator. |
| `RW_BOOTSTRAP_ADMIN` | Disarankan | Email RW Admin pertama. Hanya dipakai bila belum ada RW Admin aktif. |
| `RT_TOKEN_RT018` | Ya per RT | Harus sama dengan `RW_TOKEN` di RT018. Pola: `RT_TOKEN_<RTID>` huruf besar. |
| `RT_TOKEN_RT017` | Ya per RT | Contoh untuk RT017. |

4. Jalankan `setupOrchestrator()` sekali dari editor. Fungsi ini membuat seluruh tab, header, dan pengaturan awal.
5. Jalankan `installTriggers()` sekali. Trigger yang dipasang:
   - `processOutboxTrigger` setiap 5 menit.
   - `cleanupRetention` setiap hari pukul 02.00 zona waktu project.
   - `digestTrigger` setiap jam; hanya mengirim bila `DIGEST_ENABLED=true`, jam lokal sama dengan `DIGEST_HOUR`, dan belum ada kiriman hari itu.
6. Deploy sebagai **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   - Akses data tetap dilindungi `GATEWAY_SECRET`; jangan membagikan URL deployment.
7. Isi registry lewat `rwRegistrySave` atau langsung di tab `RT_Registry`, lalu isi `Users`.
8. Uji `GET ...?action=version`, lalu `POST` dengan `action=rwSession`.

> Deploy ulang memakai **Manage deployments > Edit > New version** agar URL tetap sama.

## 3. Tab spreadsheet

| Tab | Isi |
|---|---|
| `RT_Registry` | `RT ID`, `Nama`, `Alamat`, `Endpoint`, `Aktif`, `Backend Version`, `Last Sync`, `Last Error`, `Diperbarui` |
| `Users` | `Email`, `Nama`, `Peran`, `Aktif`, `Dibuat`, `Diperbarui` |
| `Surat_Decision_Log` | Riwayat keputusan surat, termasuk `Kunci` idempotensi dan `Status Kirim` |
| `Lapor_Response_Log` | Salinan audit tanggapan pengaduan dan `Timeline ID` |
| `Outbox` | Antrean tulis: `Aksi`, `RT ID`, `Target ID`, `Payload`, `Kunci`, `Status`, `Percobaan`, `Next Retry`, `Last Error`, `Hasil` |
| `KPI_Snapshot` | Snapshot metrik per RT: warga, saldo kas, surat menunggu, pengaduan terbuka/eskalasi |
| `Audit_Log` | Login dan seluruh aksi RW: aktor, email, peran, target, hasil |
| `Settings` | Parameter operasional non-rahasia |

Header dibuat oleh `ensureSchema()`. Jangan mengubah urutan header setelah data terisi.

`Settings` adalah tabel key/value, jadi satu `Key` hanya boleh punya satu baris. `seedSettings()` berjalan di dalam `LockService.getScriptLock()` dan memanggil `dedupeSettings()` lebih dulu, sehingga penyemaian bersamaan tidak lagi membuat baris ganda. Baris duplikat lama dibersihkan otomatis saat `ensureSchema()` berikutnya dijalankan (mis. setelah deploy versi baru, atau buka portal lalu muat ulang sekali). Untuk membersihkan segera dari editor Apps Script, jalankan fungsi `seedSettings()` satu kali.

## 4. Kontrak API

Semua aksi data memakai `POST` dengan body JSON:

```json
{
  "action": "rwDashboard",
  "gateway": "<GATEWAY_SECRET>",
  "email": "nama@example.com"
}
```

- `gateway` wajib dan dibandingkan dengan `safeEqual`.
- `email` adalah identitas pengguna yang sudah diverifikasi gateway, bukan input browser.
- `GET ?action=version` atau `?action=health` hanya mengembalikan versi dan status layanan.
- Respons sukses selalu memuat `result:"success"` dan `version`. Respons gagal memuat `result:"error"`, `code`, dan `message`.

### 4.1 Daftar aksi

| Aksi | Peran | Keterangan |
|---|---|---|
| `rwSession` | Semua | Login/logout audit dan data pengguna aktif. |
| `rwDashboard` | Semua | Fan-out snapshot semua RT aktif; memakai cache `CACHE_TTL_SECONDS`. `forceRefresh` hanya berlaku untuk RW Admin. |
| `rwRefresh` | Semua | Paksa refresh; `forceRefresh` diabaikan untuk RW Viewer. |
| `rwRegistryList` | Semua | Daftar RT. |
| `rwRegistrySave` | RW Admin | Tambah/ubah RT (`nama`, `alamat` opsional). Endpoint wajib `https://.../exec` dan tidak boleh duplikat. |
| `rwUsersList` | RW Admin | Daftar pengguna. |
| `rwUsersSave` | RW Admin | Tambah/ubah pengguna. Gunakan `userEmail` untuk email target agar tidak bertabrakan dengan `email` identitas gateway. |
| `rwSettingsGet` | Semua | Daftar pengaturan. |
| `rwSettingsSave` | RW Admin | Ubah satu pengaturan (`key`, `value`). |
| `rwList` | Semua | Baca `Data_Warga`, `Iuran_Kas`, `Pengajuan_Surat`, `Lapor_Aspirasi`, atau `Lapor_Tindak_Lanjut` dari satu RT. |
| `rwSuratDecision` | RW Admin | Keputusan surat: `Disetujui`, `Dikembalikan`, `Ditolak`. |
| `rwLaporNote` | RW Admin | Tanggapan pengaduan dan status `Ditangani RW`/`Selesai RW`. |
| `rwOutboxList` | RW Admin | Daftar antrean tulis. |
| `rwOutboxRetry` | RW Admin | Retry satu `id`, atau proses semua yang jatuh tempo bila `id` kosong. |
| `rwAuditList` | RW Admin | Audit terbaru, maksimal 500 baris. |
| `rwRtHealth` | Semua | Panggil `rwCheck` satu RT dan perbarui `Backend Version`/`Last Error`. |
| `rwDigestPreview` | RW Admin | Susun ringkasan KPI dari snapshot terakhir tanpa mengirim email. Mengembalikan subjek, teks/HTML, total, penerima, dan waktu kirim terakhir. |
| `rwDigestSend` | RW Admin | Kirim digest sekarang (mengabaikan `DIGEST_ENABLED` dan `DIGEST_HOUR`), lalu catat audit `digest_send_manual`. |

### 4.2 Parameter penting

`rwList`

```json
{
  "action": "rwList",
  "rtId": "RT018",
  "sheet": "Data_Warga",
  "limit": 200,
  "offset": 0,
  "includeArchived": false
}
```

Filter tambahan: `status` untuk `Pengajuan_Surat`, `laporId` untuk `Lapor_Tindak_Lanjut`. `limit` dibatasi 1-2000.

`rwSuratDecision`

```json
{
  "action": "rwSuratDecision",
  "rtId": "RT018",
  "id": "SRT-...",
  "decision": "Disetujui",
  "catatan": "",
  "kunci": "surat-RT018-20261025-001",
  "expectedVersi": 1
}
```

- `catatan` minimal 3 karakter untuk keputusan negatif.
- `kunci` minimal 6 karakter dan wajib unik; pengiriman ulang dengan kunci yang sama tidak membuat keputusan baru.
- `expectedVersi` mencegah keputusan ganda saat data berubah. RT membalas `stale` bila versi tidak cocok.

`rwLaporNote`

```json
{
  "action": "rwLaporNote",
  "rtId": "RT018",
  "id": "ADU-...",
  "catatan": "Sudah ditindaklanjuti RW",
  "status": "Ditangani RW",
  "visibilitas": "Publik",
  "kunci": "lapor-RT018-20261025-001",
  "expectedDiperbarui": "2026-10-25T08:00:00.000Z"
}
```

`visibilitas` hanya `Publik` atau `Internal`. `Publik` juga menyalin catatan ke kolom `Catatan Tindak Lanjut` RT agar portal publik RT tetap kompatibel. `expectedDiperbarui` opsional.

### 4.3 Masking

- RW Admin melihat NIK, nomor HP, dan alamat lengkap.
- RW Viewer melihat NIK/HP hanya 4 digit terakhir dan alamat `[disembunyikan]`.
- Masking dilakukan di server orkestrator dan dapat dimatikan lewat `RW_MASK_VIEWER` (default `true`). Jangan mengandalkan UI saja.

## 5. Cache, outbox, dan retry

- `rwDashboard` membaca snapshot terakhir dari `KPI_Snapshot`. Snapshot lebih tua dari `CACHE_TTL_SECONDS` atau berstatus bukan `OK` akan di-refresh. Snapshot terbaru semua RT diambil dalam satu penelusuran tabel (`latestSnapshots`), bukan satu pembacaan per RT.
- Refresh KPI memakai **4 panggilan per RT** (`Data_Warga`, `Iuran_Kas`, `Pengajuan_Surat`, `Lapor_Aspirasi`) dalam satu `UrlFetchApp.fetchAll`. Versi backend dibaca dari respons `rwRead`, sehingga `rwCheck` tidak lagi dipanggil pada jalur dashboard.
- `rwSession` hanya menulis baris `Audit_Log` login maksimal sekali per 10 menit per pengguna (kunci `CacheService`), agar memuat ulang portal tidak menambah satu penulisan sheet pada setiap boot.
- Daftar (`rwList`) memakai cache baca 25 detik di `CacheService`. Setiap penulisan (registry, pengguna, keputusan surat, tanggapan pengaduan, pengaturan, retry outbox) menaikkan *epoch* cache — global dan per RT — sehingga pembacaan setelah penulisan tidak pernah menyajikan data lama.
- `ensureSchema()` hanya memeriksa header sheet sekali per kombinasi `CODE_VERSION` + `SCHEMA` (Script Property `SCHEMA_READY`), dan `resolveUser` membaca `Users` sekali per permintaan. Penulisan juga membuang cache tabel per eksekusi agar hasil baca konsisten.
- Bila refresh gagal tetapi snapshot `OK` sebelumnya tersedia, dashboard menampilkan status `Stale` beserta nilai terakhir dan pesan error.
- Setiap penulisan membuat baris `Outbox` berstatus `Pending`, lalu langsung dicoba.
- Bila RT sedang tidak bisa dihubungi, status menjadi `Retry` dan `Next Retry` dihitung eksponensial dari `OUTBOX_BASE_DELAY_SECONDS`, maksimal 1 jam.
- Error permanen langsung menjadi `Failed`, antara lain: `stale`, `not_pending`, `max_negative`, `not_found`, `invalid_decision`, `note_required`, `rw_unauthorized`, `rt_token_missing`.
- Setelah `OUTBOX_MAX_ATTEMPTS`, baris menjadi `Failed`.
- `processOutboxTrigger` mengirim ulang baris `Pending`/`Retry` yang sudah jatuh tempo.
- `rwOutboxRetry` dengan `id` tertentu memaksa satu baris dicoba lagi, termasuk yang sudah `Failed`.

`KPI_Snapshot` menyimpan riwayat; dashboard memakai baris dengan `Waktu` terbaru per RT.

## 5.1 Digest harian

- `buildDigest()` menyusun total dan daftar perhatian dari baris `KPI_Snapshot` terbaru per RT, tanpa memanggil RT lagi.
- `digestRecipients()` memakai `DIGEST_RECIPIENTS` bila diisi; bila kosong, dipakai semua `RW Admin` aktif. Email dinormalisasi dan dideduplikasi.
- `digestTrigger` dipasang `installTriggers()` dengan jadwal per jam. Trigger mengirim hanya bila `DIGEST_ENABLED=true` dan jam lokal `Asia/Jakarta` sama dengan `DIGEST_HOUR`.
- Penanda `LAST_DIGEST_STAMP` disimpan di Script Properties agar tidak ada kiriman ganda pada hari yang sama walau trigger berjalan berkali-kali.
- `rwDigestPreview` dan `rwDigestSend` tersedia di halaman **Pengaturan** portal. Pengiriman manual meminta konfirmasi dan mencatat audit.
- Format email: judul dan waktu rata tengah, nominal memakai pemisah ribuan gaya Indonesia (`Rp 958.000`), kolom Status rata tengah.
- `rwDigestSend` mengembalikan `text` yang sama dengan isi email sehingga portal dapat menawarkan **Salin teks untuk WhatsApp** setelah pengiriman manual.

## 6. Pengaturan awal

| Key | Default | Keterangan |
|---|---|---|
| `CACHE_TTL_SECONDS` | `300` | Umur cache dashboard. |
| `OUTBOX_MAX_ATTEMPTS` | `8` | Batas percobaan outbox. |
| `OUTBOX_BASE_DELAY_SECONDS` | `60` | Dasar backoff retry. |
| `AUDIT_RETENTION_MONTHS` | `12` | Retensi `Audit_Log`. |
| `DECISION_RETENTION_MONTHS` | `24` | Retensi log keputusan/tanggapan. |
| `SNAPSHOT_RETENTION_MONTHS` | `24` | Retensi `KPI_Snapshot`. |
| `RW_MASK_VIEWER` | `true` | Masking untuk RW Viewer. |
| `EXPECTED_BACKEND_VERSION` | `publik-v39-2026-10-28` | Versi backend RT yang diharapkan. RT dengan `Backend Version` berbeda ditandai **Versi beda** di portal. |
| `DIGEST_ENABLED` | `false` | Aktifkan digest harian saat pilot. |
| `DIGEST_HOUR` | `7` | Jam kirim digest, 0-23 pada zona waktu project (`Asia/Jakarta`). |
| `DIGEST_RECIPIENTS` | kosong | Daftar email dipisah koma. Bila kosong, digest dikirim ke semua RW Admin aktif. |

## 7. Operasional

- **Tambah RT:** isi `RT_TOKEN_<RTID>` di Script Properties, lalu `rwRegistrySave` dengan endpoint `/exec`. Pastikan `RW_TOKEN` RT sama persis. Registry dibatasi maksimal **10 RT**; `rwRegistrySave` menolak RT ke-11 dengan kode `max_rts`.
- **Versi RT tertinggal:** bandingkan `Backend Version` terhadap `EXPECTED_BACKEND_VERSION`; portal menandai `Versi beda` bila tidak sama. Ubah pengaturan itu setelah semua RT naik versi.
- **Rotasi token RT:** ubah `RW_TOKEN` di RT, lalu `RT_TOKEN_<RTID>` di orkestrator pada waktu yang sama. Tidak perlu mengubah kode.
- **RT offline:** dashboard menampilkan `Error` atau `Stale`; RT lain tetap diproses. Periksa `Last Error` di registry atau jalankan `rwRtHealth`.
- **Outbox macet:** periksa `Last Error`, perbaiki RT/token, lalu `rwOutboxRetry`.
- **Retensi:** `cleanupRetention` menghapus baris lebih lama dari batas. Jalankan manual dari editor bila perlu.
- **Digest harian:** isi `DIGEST_RECIPIENTS`, set `DIGEST_HOUR`, lalu ubah `DIGEST_ENABLED` menjadi `true`. Uji lewat **Pratinjau** dan **Kirim sekarang** di portal sebelum mengandalkan trigger. Jalankan `installTriggers()` lagi setelah upgrade agar `digestTrigger` terpasang.
- **Backup:** cadangkan spreadsheet orkestrator sebelum perubahan skema atau pembersihan besar.

## 8. Keamanan

- Jangan pernah menaruh `GATEWAY_SECRET` atau `RT_TOKEN_*` di HTML, JavaScript frontend, `localStorage`, atau repositori.
- Portal RW harus berada di belakang Cloudflare Access. Gateway memverifikasi JWT lalu mengirim email terverifikasi.
- Orkestrator tidak menerima peran dari browser; peran selalu dibaca dari tab `Users`.
- `RW_TOKEN` hanya boleh dipakai orkestrator. RT admin memakai `ADMIN_TOKEN`; token tidak boleh saling dipakai.
- Web App orkestrator memakai akses **Anyone** agar gateway dapat memanggilnya. Karena itu `GATEWAY_SECRET` harus kuat dan URL tidak dipublikasikan.
- audit login dan seluruh aksi RW; jangan menghapus `Audit_Log` secara manual.

## 9. Pengujian

Harness berada di luar repositori:

```bash
cd /tmp/opencode
node test_rw_orchestrator.js
```

Cakupan (139 skenario): bootstrap admin, peran dan masking, registry (termasuk batas 10 RT dan validasi `EXPECTED_BACKEND_VERSION`), fan-out dashboard, cache, perhitungan kas dengan `saldoAwal`, keputusan surat, idempotensi, batas keputusan negatif, tanggapan pengaduan, outbox retry, stale fallback, RT tanpa token, validasi pengaturan, digest harian (penerima, pratinjau, kirim manual, trigger), dan audit.

Uji regresi RT terkait:

```bash
node test_rw_phase1.js
node test_codegs_read.js
node test_kas_feature.js
```

## 10. Rollback

1. Nonaktifkan RT bermasalah dengan `rwRegistrySave` (`aktif:false`).
2. Untuk menghentikan pengiriman otomatis, hapus trigger `processOutboxTrigger` dan `digestTrigger` dari editor, atau set `DIGEST_ENABLED=false`.
3. Kembalikan deployment orkestrator ke versi sebelumnya lewat **Manage deployments**.
4. Data RT tidak terpengaruh karena orkestrator hanya menulis kolom `Rw *` dan `Lapor_Tindak_Lanjut`.
5. Periksa `Outbox` yang masih `Pending`/`Retry` sebelum mengaktifkan kembali trigger.
