# Google Apps Script — RT Dashboard Backend

File ini berisi kode backend untuk sistem SAPA RT (RT Tanjung Duren Utara). Kode ini dijalankan di **Google Apps Script** yang terhubung ke Google Sheets sebagai database.

---

## 📋 Prasyarat

1. Buat file **Google Sheets** baru
2. Buat 4 tab/sheet dengan nama **exact** (case-sensitive):
   - `Data_Warga`
   - `Iuran_Kas`
   - `Pengumuman`
   - `Kegiatan_Warga`
   - (Tab `Pengajuan_Surat` & `Lapor_Aspirasi` **dibuat otomatis** oleh script saat pertama dibaca/ditulis — opsional dibuat manual)
3. Buka **Ekstensi > Apps Script** di Google Sheets
4. Salin isi `code.gs` ke editor Apps Script
5. Buka **Project Settings > Script Properties**, tambahkan properti:
   - **Nama:** `ADMIN_TOKEN`
   - **Nilai:** token rahasia pilihan Anda (mis. `rt-rahasia-2026`)
   - (Opsional) **Nama:** `PUBLIC_PORTAL_ENABLED`, **Nilai:** `true`/`false`. Bila belum diatur, portal publik dianggap **aktif**. Nilai ini otomatis diubah lewat toggle di aplikasi.
   - (Opsional) **Nama:** `SURAT_ENABLED`, **Nilai:** `true`/`false`. Bila belum diatur, fitur **Layanan Surat** dianggap **aktif**. Nilai ini otomatis diubah lewat toggle **Layanan Surat** di panel Portal Publik aplikasi (aksi `setSuratStatus`).
   - (Opsional) **Nama:** `LAPOR_ENABLED`, **Nilai:** `true`/`false`. Bila belum diatur, fitur **Lapor & Aspirasi** dianggap **aktif**. Nilai ini otomatis diubah lewat toggle **Lapor & Aspirasi** di panel Portal Publik aplikasi (aksi `setLaporStatus`).
    - (Opsional) **Nama:** `ADMIN_EMAIL`, **Nilai:** email admin (boleh beberapa, dipisah koma). Bila diisi, setiap **pengajuan surat** dan **pengaduan Lapor & Aspirasi** baru dari portal publik dikirimkan notifikasi email ke alamat ini (butuh izin `MailApp`). Bila kosong, tidak ada email — data tetap tersimpan. Dapat juga diisi/diubah dari **dashboard admin**: menu **Settings > Integrasi Google Sheets > Admin Email** (aksi `setAdminEmail`).
   - (Opsional) **Nama:** `NOTIF_SENDER_NAME`, **Nilai:** nama pengirim yang tampil di kotak masuk (From display name). Bila kosong, default **`Pengajuan surat`**.
   - (Opsional) **Nama:** `NOTIF_REPLY_TO`, **Nilai:** alamat **Reply-To** email notifikasi. Bila kosong, default memakai nilai `ADMIN_EMAIL` (balasan otomatis mengarah ke admin).
   - (Opsional) **Nama:** `NOTIF_SUBJECT_PREFIX`, **Nilai:** prefiks subjek email notifikasi pengajuan surat. Bila kosong, default **`[SAPA-RT]`**.
   - (Opsional) **Nama:** `LAPOR_FOLDER_ID`, **Nilai:** ID folder Google Drive untuk menyimpan **foto/bukti pengaduan** Lapor & Aspirasi. Bila kosong, script mencari folder bernama **`Lapor`** (dibuat otomatis bila belum ada). Folder perlu dibagikan ke akun admin (mis. `admin.rt017@gmail.com`).
   - (Opsional) **Nama:** `SALDO_AWAL`, **Nilai:** saldo pembukaan kas RT (angka, mis. `1500000`). Menjadi nilai dasar perhitungan saldo: **Saldo Akhir = Saldo Awal + Pemasukan − Pengeluaran**. Bila kosong, default **0**. Dapat juga diisi/diubah dari **dashboard admin**: menu **Iuran & Kas > Saldo Awal** (aksi `setSaldoAwal`).
   - Setelah `ADMIN_EMAIL` diisi, jalankan fungsi **`authorizeMail`** sekali dari editor Apps Script (dropdown fungsi > Run > Review permissions > Allow) agar scope `script.send_mail` diberikan, lalu deploy ulang sebagai **New version**. Tanpa langkah ini, pengiriman email gagal dengan pesan *"You do not have permission to call MailApp.sendEmail"*.
   - Untuk foto **Lapor & Aspirasi**, jalankan fungsi **`authorizeDrive`** sekali dari editor (Run > Review permissions > Allow) agar scope Google Drive diberikan — fungsi ini sekaligus membuat folder **`Lapor`** (bila belum ada) dan membagikannya ke `ADMIN_EMAIL`. Lalu deploy ulang sebagai **New version**. Tanpa izin ini, unggahan foto gagal (pengaduan tetap tersimpan tanpa foto).

---

## 🔐 Keamanan (Token Admin)

Karena Web App di-deploy sebagai **Anyone**, tanpa proteksi siapa pun yang tahu URL dapat menulis data. Karena itu `code.gs` mewajibkan **token admin**:

- Semua operasi **tulis** (`add` / `update` / `delete`) dan **baca lengkap** (`action=read`) wajib menyertakan parameter/field `token`.
- Token disimpan di **Script Properties** dengan key `ADMIN_TOKEN` dan **tidak** ditulis di dalam kode.
- Bila `ADMIN_TOKEN` belum diatur, semua operasi terproteksi otomatis **ditolak** (`code:"unauthorized"`).
- Portal publik memakai `action=readPublic` yang **tanpa token** dan hanya mengembalikan `Pengumuman` & `Kegiatan_Warga` ber-`Publik=Ya`; `Data_Warga`, `Iuran_Kas`, `Pengajuan_Surat`, dan `Lapor_Aspirasi` tidak pernah dikirim keluar.

### ON/OFF Portal Publik

Admin dapat menyalakan/mematikan akses portal publik dari toggle di tab **Portal Publik** (`index.html`). Status disimpan di Script Property `PUBLIC_PORTAL_ENABLED` lewat aksi `setPortalStatus` (butuh token). Saat **OFF**, `action=readPublic` mengembalikan `{result:"error", code:"portal_disabled"}` sehingga `public.html` menampilkan pesan "Portal publik dinonaktifkan" dan tidak ada data yang bocor. Saat properti belum diatur, portal dianggap **aktif** (default).

### ON/OFF Layanan Surat

Toggle **Layanan Surat** di tab **Portal Publik** menyimpan status ke Script Property `SURAT_ENABLED` lewat aksi `setSuratStatus` (butuh token). Saat **OFF**, aksi publik `submitSurat`, `checkSurat`, dan `lookupWarga` mengembalikan `{result:"error", code:"surat_disabled"}` sehingga pengajuan/cek status/isi otomatis NIK ditolak; `public.html` menyembunyikan bagian Layanan Surat. Fitur Lapor & Aspirasi dan data publik lain tetap berjalan. Default **aktif** bila properti belum diatur.

Di frontend admin (`index.html`), isi **Token Admin** di panel *Integrasi Google Sheets* lalu klik **Simpan Token**. Token disimpan di `localStorage` (`rt_admin_token`) pada perangkat admin dan hanya itu yang mengirimkannya.

> Catatan: token dikirim sebagai query param pada JSONP (GET), sehingga idealnya gunakan koneksi HTTPS (default Apps Script) dan jangan bagikan URL admin lengkap berisi token.

---

## 🗂️ Struktur Google Sheets (Database)

> **Timestamp (kolom A):** ditulis sebagai `Date` asli, otomatis berformat angka `dd-mm-yyyy hh:mm` dan zona waktu spreadsheet dipaksa **Asia/Jakarta (GMT+7)**.
>
> **Kolom `ID`:** script menambahkan satu kolom bantu `ID` di ujung kanan setiap sheet secara otomatis (header + backfill baris lama). Kolom ini adalah identitas stabil untuk update/delete dan **tidak perlu dibuat manual**.

### 1. Tab `Data_Warga`
| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Nomor KK | String | 3173012304567890 |
| Nama Lengkap | String | Budi Santoso |
| Status | String | Kepala Keluarga / Suami/Istri / Anak / Menantu / Cucu / Orang tua / Mertua / Family lain / Pembantu / Lainnya |
| Jenis Kelamin | String | Laki-laki / Perempuan |
| NIK | String | 3173012304567890 |
| Tempat Lahir | String | Jakarta |
| Tanggal Lahir | Date | 1990-05-17 |
| Pendidikan | String | Tidak/Belum Sekolah / SD / SMP / SMA/SMK / D1-D3 / S1 / S2 / S3 |
| Pekerjaan | String | Karyawan Swasta / PNS / Wiraswasta / Pelajar/Mahasiswa / Tidak Bekerja / Lainnya |
| No HP | String | 081234567890 |
| Status Tempat Tinggal | String | Tetap / Kontrak |
| Alamat/No Rumah | String | Jl. Tanjung Duren No. 12 |
| Diarsipkan | String | Ya / Tidak — `Ya` menyembunyikan baris dari daftar tanpa menghapusnya |

### 2. Tab `Iuran_Kas`
| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Tanggal | Date | 2026-10-01 |
| Nama Warga | String | Budi Santoso |
| No Rumah | String | 12A |
| Jenis Transaksi | String | Pemasukan / Pengeluaran / Reversal Masuk / Reversal Keluar |
| Jumlah (Rp) | Number | 50000 |
| Keterangan | String | Iuran Kebersihan Bulan Oktober |
| Diarsipkan | String | Ya / Tidak — dipertahankan untuk **data lama**; `Ya` menyembunyikan transaksi dari daftar **dan** perhitungan saldo. Fitur arsip kas sudah dipensiunkan (pembatalan memakai Reversal). |
| Reversal Dari | String | ID transaksi asal untuk entri pembatalan otomatis; kosong pada transaksi normal |

> **Pembatalan (Reversal):** aplikasi tidak menghapus transaksi kas. Tombol **Batalkan** menambahkan baris baru dengan `Jenis Transaksi` = `Reversal Keluar` (pembatalan pemasukan) atau `Reversal Masuk` (pembatalan pengeluaran), nominal sama, dan `Reversal Dari` berisi ID transaksi asal. Pasangan asal + Reversal berjumlah nol. `isKasKeluar()` menilai `Reversal Keluar` sebagai arus keluar; `Reversal Masuk` sebagai arus masuk.

### 3. Tab `Pengumuman`
| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Tanggal | Date | 2026-10-03 |
| Judul Pengumuman | String | Himbauan Kebersihan |
| Isi Pengumuman | String | Diberitahukan kepada seluruh warga... |
| Kategori | String | Informasi Umum / Penting / Keuangan / Kegiatan |
| Penanggung Jawab | String | Ketua RT 005 |
| Publik | String | Ya / Tidak (tampil di Portal Publik) |

### 4. Tab `Kegiatan_Warga`
| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Nama Kegiatan | String | Kerja Bakti Bersih Selokan |
| Tanggal Pelaksanaan | Date | 2026-10-15 |
| Waktu | Time | 07:00 |
| Lokasi | String | Lap. Bulutangkis RT 005 |
| Penanggung Jawab | String | Sekretaris RT |
| Keterangan | String | Membawa cangkul dan sapu lidi |
| Publik | String | Ya / Tidak (tampil di Portal Publik) |

### 5. Tab `Pengajuan_Surat`

Menampung permohonan surat dari warga (fitur **Pengajuan Surat**). Tab ini **dibuat otomatis** oleh script beserta header-nya bila belum ada — tidak perlu dibuat manual. Data tab ini bersifat **privat**: tidak pernah ikut pada `action=readPublic`.

| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Nama Lengkap Pemohon | String | Budi Santoso |
| NIK | String | 3173012304567890 |
| No. HP / WhatsApp | String | 081234567890 |
| Alamat / No. Rumah | String | Jl. Tanjung Duren No. 12 |
| Jenis Surat | String | Surat Pengantar KTP-el (lihat `jenisSurat` di `config.js`) |
| Keperluan / Alasan Pengajuan | String | Perpanjang KTP-el |
| Status Pengurusan | String | Pending / Diproses / Selesai / Ditolak |
| No. Surat | String | 474/017-RT/RW.06/X/2026 (nomor surat resmi; **wajib** bila status `Selesai`) |
| Catatan Pengurus | String | (opsional, diisi pengurus) |
| Tanggal Selesai | String | `yyyy-MM-dd` — tanggal akhir saat status `Selesai` **atau** `Ditolak`; dipakai untuk **membekukan durasi** (label UI menyesuaikan: Tanggal Selesai / Tanggal Ditolak). Kosong untuk status aktif atau data lama. |
| Diarsipkan | String | Ya / Tidak — `Ya` menyembunyikan pengajuan dari daftar utama **dan** dari hasil `checkSurat` publik (tetap tersimpan, dapat dipulihkan) |

> Kolom `ID` bantu tetap ditambahkan otomatis di ujung kanan. Kolom **`Tanggal Selesai`** juga ditambahkan otomatis (sebelum `Diarsipkan`) saat backend baru pertama kali dijalankan; baris lama tidak diubah sehingga tampil `-` sampai tanggalnya dilengkapi lewat Edit. Kolom ini menyimpan **tanggal akhir** baik untuk pengajuan `Selesai` maupun `Ditolak`.
>
> **Aturan bisnis:** saat status diubah menjadi `Selesai`, server menolak simpan bila `No. Surat` kosong (`{result:"error", code:"invalid"}`). Warga dapat melihat `No. Surat` pada hasil `checkSurat` setelah surat selesai.
>
> Saat dibaca (`readAllSheets`), kolom `Timestamp` tab ini diformat menjadi `yyyy-MM-dd HH:mm` (GMT+7) sebelum dikirim ke frontend, sehingga panel admin dapat menampilkannya sebagai `dd-Mmm-yyyy HH:mm`.
>
> **Migrasi otomatis:** tab lama tanpa kolom `No. Surat` akan disusun ulang otomatis berdasarkan nama header saat pertama dibaca (data & ID lama tetap aman).

### 6. Tab `Lapor_Aspirasi`

Menampung pengaduan/aspirasi warga (fitur **Lapor & Aspirasi**). Tab ini **dibuat otomatis** oleh script beserta header-nya bila belum ada — tidak perlu dibuat manual. Data tab ini bersifat **privat**: tidak pernah ikut pada `action=readPublic`.

| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-14 09:15:00 |
| No. Pengaduan | String | ADU/2026-001 (diisi otomatis) |
| Nama | String | Budi Santoso (diambil dari `Data_Warga` berdasarkan No. HP) |
| No. HP | String | 081234567890 |
| Alamat | String | Jl. Tanjung Duren No. 12 (dari `Data_Warga`) |
| Jenis Pengaduan | String | Lingkungan & Kebersihan (lihat `jenisPengaduan` di `config.js`) |
| Judul | String | Sampah menumpuk di depan blok A |
| Detail | String | Uraian pengaduan |
| Lokasi | String | (opsional) |
| Tanggal Kejadian | String | (opsional, `yyyy-MM-dd`) |
| Foto | String | Tautan Google Drive (folder `Lapor`), opsional |
| Harapan | String | (opsional) |
| Status | String | Diterima / Diproses / Selesai (default `Diterima`) |
| Petugas | String | Nama pengurus yang menangani (opsional) |
| Catatan Tindak Lanjut | String | (opsional) |
| Tanggal Penyelesaian | String | (opsional, `yyyy-MM-dd`) |
| Diarsipkan | String | Ya / Tidak — `Ya` menyembunyikan pengaduan dari daftar utama **dan** hasil `checkLapor` (tetap tersimpan, dapat dipulihkan) |

> Kolom `ID` bantu tetap ditambahkan otomatis di ujung kanan (format `ADU-<yyMMdd>-XXXX`).
>
> **No. Pengaduan** dibuat otomatis dengan format **`ADU/<tahun>-<urut>`** (mis. `ADU/2026-001`) baik saat pengaduan dikirim warga maupun saat admin menambah baris manual tanpa nomor.
>
> **Foto** disimpan ke folder Drive (`LAPOR_FOLDER_ID` atau folder bernama `Lapor`); tautannya ditulis ke kolom `Foto`. Kegagalan unggah foto **tidak** membatalkan penyimpanan pengaduan.

---

## 🚀 Deployment Web App

### Langkah 1: Deploy Baru
1. Di Apps Script, klik **Deploy > New Deployment**
2. Pilih tipe: **Web app**
3. **Execute as:** `Me` (akun Anda)
4. **Who has access:** `Anyone` (Siapa saja) — **WAJIB**
5. Klik **Deploy**
6. Izinkan akses saat diminta
7. **Salin Web App URL** (format: `https://script.google.com/macros/s/XXXX/exec`)

### Langkah 2: Update Deployment (saat kode berubah)
1. **Deploy > Manage deployments**
2. Klik ikon **pensil (Edit)** pada deployment Web App
3. **Version:** pilih `New version`
4. Klik **Deploy**
5. URL tetap sama, kode baru langsung aktif

> ⚠️ **Penting:** Tanpa buat versi baru, Web App tetap menjalankan kode lama!

---

## 🌐 Proxy Same-Origin (Cloudflare Pages Function)

Frontend **tidak** memanggil `script.google.com` secara langsung. Browser memanggil endpoint same-origin `/api` yang diteruskan oleh Cloudflare Pages Function `functions/api/[[path]].js` ke Web App `/exec`. Ini mencegah kegagalan JSONP akibat pemblokiran *third-party cookie* / ITP / ekstensi adblock di sebagian perangkat.

- **Transport:** proxy dipakai lebih dulu; bila gagal, frontend otomatis jatuh ke URL Web App langsung (`publicApiUrl`).
- **Nilai Transport yang mungkin** (kartu **Active Data Source** di Pengaturan menampilkan transport yang benar-benar aktif):

| Nilai Transport | Arti |
|---|---|
| `Proxy /api (active) · fallback: direct` | Proxy berhasil & dipakai; URL langsung tersedia sebagai cadangan. |
| `Proxy /api (active)` | Proxy berhasil & dipakai; `publicApiUrl` kosong. |
| `Direct to Apps Script (active)` | Proxy gagal; otomatis jatuh ke URL langsung (`publicApiUrl`). |
| `Proxy /api (fallback: direct)` | Belum ada permintaan sukses; proxy dikonfigurasi dengan cadangan langsung. |
| `Proxy /api` | Belum tersambung; hanya `apiBase` dikonfigurasi. |
| `Direct to Apps Script` | Belum tersambung; hanya `publicApiUrl` dikonfigurasi. |
| `Not configured (local mode)` | `apiBase` & `publicApiUrl` kosong; mode lokal (localStorage). |

- **Target:** diatur lewat *environment variable* **`APPS_SCRIPT_URL`** di Cloudflare Pages (Settings → Environment variables) berisi Web App URL (`.../exec`). Bila tidak diset, dipakai URL default di dalam file function.
- **Method:** `GET` (baca/JSONP), `POST` (tulis, `text/plain`), `HEAD`; redirect Apps Script diikuti (`redirect: 'follow'`).
- **Access:** path `/api` **wajib di-bypass** Cloudflare Access (lihat `../readme.md` → **Publikasi & Kontrol Akses**). Operasi sensitif tetap divalidasi `ADMIN_TOKEN` di `code.gs`.

---

## 🔌 API Endpoints

Base URL: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

### GET Requests

| Action | Parameter | Deskripsi |
|--------|-----------|-----------|
| `read` | `action=read&token=T` | Baca semua data dari 6 sheet + `portalEnabled`/`suratEnabled`/`laporEnabled`/`adminEmail`/`saldoAwal`. **Butuh token admin** (JSONP) |
| `readPublic` | `action=readPublic` | Hanya `Pengumuman` & `Kegiatan_Warga` ber-`Publik=Ya` + `suratEnabled`/`laporEnabled`. **Tanpa token**. Mengembalikan `{result:"error", code:"portal_disabled"}` bila portal dinonaktifkan admin |
| `checkSurat` | `action=checkSurat&nik=...&hp=...` **atau** `action=checkSurat&ref=...` | **Publik (tanpa token).** Warga cek status pengajuan surat dengan **NIK + No. HP** (keduanya harus cocok) **atau** dengan **No. Pengajuan** (`ref`, mis. `SRT-261006-AB12`) saja. Hanya mengembalikan `{ref, tanggal, jenisSurat, status, noSurat, catatan}` — tanpa NIK/nama. Pengajuan ber-`Diarsipkan=Ya` **tidak dikembalikan**; jumlahnya dilaporkan pada field `archived` sehingga UI dapat menampilkan keterangan "sudah diarsipkan". Dibatasi ≤ 30 percobaan/jam per NIK+HP atau per ref (ditambah batas global). Mendukung JSONP |
| `checkSuratDuplicate` | `action=checkSuratDuplicate&nik=...&hp=...&jenisSurat=...` | **Publik (tanpa token).** Peringatan sebelum mengirim: cari pengajuan **aktif** dengan **NIK + No. HP** sama dan **jenis surat** sama. Mengembalikan `{result, count, data:[{tanggal, keperluan}]}` (maks. 5 terbaru); hanya tanggal & keperluan, tanpa NIK/nama. Baris `Diarsipkan=Ya` diabaikan. Tidak memblokir pengajuan baru. Dibatasi per NIK+HP + batas global. Mendukung JSONP |
| `lookupWarga` | `action=lookupWarga&nik=...` | **Publik (tanpa token).** Cari SATU warga berdasarkan **NIK (16 digit) persis** untuk mengisi otomatis **Nama, No. HP, & Alamat** pada form pengajuan surat. Ketemu → `{result:"success", found:true, nama, noHp, alamat}`; tidak → `{found:false}` (warga tetap boleh mengisi manual). Hanya 3 field itu yang dibuka (bukan seluruh data warga). Ter-gate status portal; dibatasi ≤ 20 pencarian/jam per NIK. Mendukung JSONP |
| `lookupWargaHp` | `action=lookupWargaHp&hp=...` | **Publik (tanpa token).** Cari SATU warga berdasarkan **No. HP** (dinormalisasi `0`/`62`) untuk mengisi otomatis **Nama & Alamat** pada form **Lapor & Aspirasi**. Ketemu → `{result:"success", found:true, nama, alamat}`; tidak → `{found:false}`. Hanya warga terdaftar yang boleh mengirim pengaduan. Ter-gate status portal; dibatasi per jam. Mendukung JSONP |
| `checkLapor` | `action=checkLapor&nomor=...` | **Publik (tanpa token).** Cek status pengaduan berdasar **No. Pengaduan** (mis. `ADU/2026-001`). Mengembalikan `{result, count, archived, data:[{nomor, tanggal, jenisPengaduan, judul, status, petugas, catatan, tanggalSelesai}]}`. Baris `Diarsipkan=Ya` tidak ditampilkan (dihitung ke `archived`). Dibatasi per jam. Mendukung JSONP |
| `sendTestEmail` | `action=sendTestEmail&token=T[&email=...]` | **Butuh token admin (JSONP).** Kirim email uji ke `ADMIN_EMAIL` untuk memverifikasi notifikasi. Bila `email` diisi, alamat itu dipakai sebagai penerima **sekaligus disimpan** ke `ADMIN_EMAIL`. Bila kosong & `ADMIN_EMAIL` kosong → `{result:"error", code:"no_admin_email"}`; format email salah → `code:"invalid_email"`; scope email belum diizinkan → `code:"mail_scope_denied"`; kegagalan lain → `code:"email_failed"` |
| `delete` | `action=delete&sheetName=X&id=Y&token=T` | Hapus baris dengan ID `Y` di sheet X. **Butuh token admin** (JSONP) |
| `version` | `action=version` | Cek versi `code.gs` yang aktif (`CODE_VERSION`) |
| (default) | — | Health check: `{result:"success", message:"Web App aktif"}` |

**Contoh Read (admin):**
```
GET https://script.google.com/macros/s/XXXX/exec?action=read&token=TOKEN_RAHASIA&callback=myCallback
```

**Contoh Read publik:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=readPublic&callback=myCallback
```

**Contoh Cek Status Pengajuan Surat (warga, NIK + No. HP):**
```
GET https://script.google.com/macros/s/XXXX/exec?action=checkSurat&nik=3173012304567890&hp=081234567890&callback=myCallback
```

**Contoh Cek Status Pengajuan Surat (warga, No. Pengajuan):**
```
GET https://script.google.com/macros/s/XXXX/exec?action=checkSurat&ref=SRT-261006-AB12&callback=myCallback
```
Respons: `{"result":"success","count":1,"data":[{"ref":"SRT-261006-AB12","tanggal":"06-10-2026 13:00","jenisSurat":"Surat Pengantar KTP-el","status":"Diproses","catatan":"Menunggu tanda tangan"}]}`

**Contoh Lookup Warga berdasarkan NIK (form pengajuan surat):**
```
GET https://script.google.com/macros/s/XXXX/exec?action=lookupWarga&nik=3173012304567890&callback=myCallback
```
Respons (ditemukan): `{"result":"success","version":"publik-v25-2026-10-14","found":true,"nama":"Budi Santoso","noHp":"081234567890","alamat":"Jl. Merdeka No. 1"}`
Respons (tidak terdaftar): `{"result":"success","version":"publik-v25-2026-10-14","found":false}`

**Contoh Lookup Warga berdasarkan No. HP (form Lapor & Aspirasi):**
```
GET https://script.google.com/macros/s/XXXX/exec?action=lookupWargaHp&hp=081234567890&callback=myCallback
```
Respons (ditemukan): `{"result":"success","found":true,"nama":"Budi Santoso","alamat":"Jl. Merdeka No. 1"}`

**Contoh Cek Status Pengaduan (warga):**
```
GET https://script.google.com/macros/s/XXXX/exec?action=checkLapor&nomor=ADU%2F2026-001&callback=myCallback
```
Respons: `{"result":"success","count":1,"archived":0,"data":[{"nomor":"ADU/2026-001","tanggal":"14-10-2026 09:15","jenisPengaduan":"Lingkungan & Kebersihan","judul":"Sampah menumpuk","status":"Diproses","petugas":"Ketua RT","catatan":"Sudah dijadwalkan pengangkutan","tanggalSelesai":""}]}`

**Contoh Delete:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=delete&sheetName=Data_Warga&id=id-1728...&token=TOKEN_RAHASIA&callback=myCallback
```

> Semua GET mendukung **JSONP** via parameter `callback` untuk menghindari masalah CORS.

> Tanpa token yang benar, `read` dan `delete` mengembalikan `{result:"error", code:"unauthorized"}`.

### POST Requests

Kirim JSON ke URL Web App (Content-Type: `text/plain` untuk CORS simple request).

`action` yang didukung: `add` (default), `update`, `delete`. Sertakan `action:"update"` atau `action:"delete"` beserta `id` untuk mengubah/menghapus baris. **Semua POST admin wajib menyertakan `token` admin** (field `token` di body) — kecuali aksi publik `submitSurat` & `submitLapor` (lihat di bawah).

> **Idempotensi `add`:** bila payload `add` menyertakan `id` dan baris dengan ID itu **sudah ada** (mis. pengiriman ulang dari antrean/outbox setelah koneksi putus), server **tidak menambah baris baru** dan membalas `{"result":"success","id":...,"duplicate":true}`. Aman dikirim ulang.

| Sheet | Payload Fields |
|-------|----------------|
| `Data_Warga` | `sheetName`, `token`, `id` (opsional saat add), `nomorKK`, `nama`, `status`, `jenisKelamin`, `nik`, `tempat`, `tanggalLahir`, `pendidikan`, `pekerjaan`, `noHp`, `statusTinggal`, `alamat`, `arsip` (`Ya`/`Tidak`) |
| `Iuran_Kas` | `sheetName`, `token`, `id` (opsional saat add), `tanggal`, `nama`, `noRumah`, `jenis` (`Pemasukan`/`Pengeluaran`/`Reversal Masuk`/`Reversal Keluar`), `jumlah`, `keterangan`, `arsip` (`Ya`/`Tidak`), `reversalDari` (ID transaksi asal untuk entri Reversal) |
| `Pengumuman` | `sheetName`, `token`, `id` (opsional saat add), `tanggal`, `judul`, `isi`, `kategori`, `pj`, `publik` (`Ya`/`Tidak`) |
| `Kegiatan_Warga` | `sheetName`, `token`, `id` (opsional saat add), `namaKegiatan`, `tanggal`, `waktu`, `lokasi`, `pj`, `keterangan`, `publik` (`Ya`/`Tidak`) |
| `Pengajuan_Surat` | `sheetName`, `token`, `id` (wajib saat update/delete), `nama`, `nik`, `noHp`, `alamat`, `jenisSurat`, `keperluan`, `status` (`Pending`/`Diproses`/`Selesai`/`Ditolak`), `noSurat`, `catatan`, `tanggalSelesai` (`yyyy-MM-dd`, opsional), `arsip` (`Ya`/`Tidak`) |
| `Lapor_Aspirasi` | `sheetName`, `token`, `id` (wajib saat update/delete), `noPengaduan`, `nama`, `noHp`, `alamat`, `jenisPengaduan`, `judul`, `detail`, `lokasi`, `tanggalKejadian`, `foto`, `harapan`, `status` (`Diterima`/`Diproses`/`Selesai`), `petugas`, `catatanTindakLanjut`, `tanggalPenyelesaian`, `arsip` (`Ya`/`Tidak`) |

**Aksi khusus (bukan per-sheet):**

| Aksi | Payload | Deskripsi |
|------|---------|-----------|
| `setPortalStatus` | `{action:"setPortalStatus", enabled:true/false, token:T}` | Menyalakan/mematikan portal publik. Butuh token admin. Disimpan di Script Property `PUBLIC_PORTAL_ENABLED` |
| `setSuratStatus` | `{action:"setSuratStatus", enabled:true/false, token:T}` | Menyalakan/mematikan fitur **Layanan Surat**. Butuh token admin. Disimpan di Script Property `SURAT_ENABLED` |
| `setLaporStatus` | `{action:"setLaporStatus", enabled:true/false, token:T}` | Menyalakan/mematikan fitur **Lapor & Aspirasi**. Butuh token admin. Disimpan di Script Property `LAPOR_ENABLED` |
| `setAdminEmail` | `{action:"setAdminEmail", email:"admin@contoh.com", token:T}` | Menyimpan alamat email admin ke Script Property `ADMIN_EMAIL` (penerima notifikasi pengajuan surat). Butuh token admin. Validasi format: bila kosong/salah → `{result:"error", code:"invalid_email"}`; sukses → `{result:"success", adminEmail}`. Dipakai tombol **Save Email** di panel Pengaturan (`index.html`) |
| `setSaldoAwal` | `{action:"setSaldoAwal", saldoAwal:1500000, token:T}` | Menyimpan saldo pembukaan kas ke Script Property `SALDO_AWAL`. Butuh token admin. Bila bukan angka / negatif → `{result:"error", code:"invalid"}`; sukses → `{result:"success", saldoAwal}`. Dipakai tombol pensil pada kartu **Saldo Awal** di panel Iuran & Kas (`index.html`) |
| `submitSurat` | `{action:"submitSurat", nama, nik, noHp, alamat, jenisSurat, keperluan, ref?, website?}` | **Publik (tanpa token).** Hanya menambah baris baru di `Pengajuan_Surat`. Server memaksa `Status="Pending"`, mengisi Timestamp & ID. NIK wajib 16 digit; `website` adalah honeypot; dibatasi ≤ 5 pengajuan/jam per NIK (dan ≤ 60/jam total). Ditolak bila Portal Publik OFF. Bila `ADMIN_EMAIL` diatur, email notifikasi dikirim. Respons: `{result:"success", id}` |
| `submitLapor` | `{action:"submitLapor", noHp, jenisPengaduan, judul, detail, lokasi?, tanggalKejadian?, foto?, harapan?, setuju, website?}` | **Publik (tanpa token).** Hanya menambah baris baru di `Lapor_Aspirasi`. **No. HP wajib terdaftar** di `Data_Warga` (Nama & Alamat diambil dari sana, bukan dari klien); server memaksa `Status="Diterima"`, mengisi Timestamp, ID (`ADU-...`), & **No. Pengaduan** (`ADU/<tahun>-NNN`). `foto` (base64) opsional diunggah ke Drive; `website` honeypot; dibatasi ≤ 5/jam per No. HP (dan ≤ 60/jam total). Ditolak bila Portal Publik OFF atau No. HP tidak terdaftar (`{result:"error", code:"not_registered"}`). Bila `ADMIN_EMAIL` diatur, email notifikasi dikirim. Respons: `{result:"success", noPengaduan, id}` |

> **Catatan `submitSurat`:** dipakai halaman `public.html`. ID bisa berasal dari `ref` yang dikirim warga (bila formatnya aman & belum terpakai), atau dibuat otomatis dengan format `SRT-yyMMdd-XXXX`.

> **Catatan No. Pengajuan `Pengajuan_Surat`:** untuk menjaga konsistensi, jalur **ADD admin** (`sheetName:"Pengajuan_Surat"` tanpa `id`) juga memakai format `SRT-<yymmdd>-XXXX` lewat helper `makeSuratId()` — bukan lagi `id-...`. Fallback `buildRowData()` dan `handleSubmitSurat()` memakai helper yang sama, sehingga semua No. Pengajuan seragam.

**Contoh payload (Tambah Warga):**
```json
{
  "sheetName": "Data_Warga",
  "id": "id-1728031200000-ab12cd",
  "nomorKK": "3173012304567890",
  "nama": "Budi Santoso",
  "status": "Kepala Keluarga",
  "jenisKelamin": "Laki-laki",
  "nik": "3173012304567890",
  "tempat": "Jakarta",
  "tanggalLahir": "1990-05-17",
  "pendidikan": "S1",
  "pekerjaan": "Karyawan Swasta",
  "noHp": "081234567890",
  "statusTinggal": "Tetap",
  "alamat": "Jl. Tanjung Duren No. 12"
}
```

**Contoh payload (Update Warga):**
```json
{
  "action": "update",
  "sheetName": "Data_Warga",
  "id": "id-1728031200000-ab12cd",
  "nomorKK": "3173012304567890",
  "nama": "Budi Santoso (revisi)",
  "status": "Kepala Keluarga",
  "jenisKelamin": "Laki-laki",
  "nik": "3173012304567890",
  "tempat": "Bandung",
  "tanggalLahir": "1990-05-17",
  "pendidikan": "S1",
  "pekerjaan": "Karyawan Swasta",
  "noHp": "081234567890",
  "statusTinggal": "Kontrak",
  "alamat": "Jl. Tanjung Duren No. 15"
}
```

**Contoh payload (Submit Pengajuan Surat — publik, tanpa token):**
```json
{
  "action": "submitSurat",
  "nama": "Budi Santoso",
  "nik": "3173012304567890",
  "noHp": "081234567890",
  "alamat": "Jl. Tanjung Duren No. 12",
  "jenisSurat": "Surat Pengantar KTP-el",
  "keperluan": "Perpanjang KTP-el",
  "ref": "SRT-261006-AB12",
  "website": ""
}
```
Respons: `{"result":"success","id":"SRT-261006-AB12","message":"Pengajuan surat berhasil dikirim."}`

**Response sukses:**
```json
{ "result": "success", "id": "id-1728031200000-ab12cd" }
```

**Response error:**
```json
{ "result": "error", "message": "Sheet tidak ditemukan" }
```

---

## 🔄 Flow Data

```
Frontend (index.html / public.html)      Google Apps Script                    Google Sheets
────────────────────────────────         ──────────────────                    ──────────────
                                    ┌────────────────────────┐
                                    │  doGet(e)              │
                                    │  ├── action=read  [T]  │──▶ readAllSheets() ──▶ Baca 6 sheet
                                    │  ├── action=readPublic │──▶ readPublicSheets()▶ Pengumuman+Kegiatan Ya
                                    │  ├── action=lookupWarga│──▶ handleLookupWarga() ──▶ 1 baris Data_Warga
                                    │  ├── action=lookupWargaHp│─▶ handleLookupWargaHp()▶ 1 baris Data_Warga (HP)
                                    │  ├── action=checkSurat │──▶ handleCheckSurat() ──▶ Pengajuan_Surat
                                    │  ├── action=checkLapor │──▶ handleCheckLapor() ──▶ Lapor_Aspirasi
                                    │  └── action=delete [T] │──▶ handleDelete() ───▶ deleteRow()
                                    └────────────────────────┘
                                            ▲
                                            │ JSONP callback
                                            │
        POST {sheetName, token, ...} ───────┘
        GET ?action=...&token=T ───────────▶
```

> `[T]` = wajib token admin. `readPublic` tanpa token.

---

## 🛠️ Fungsi Utama

| Fungsi | Deskripsi |
|--------|-----------|
| `doGet(e)` | Handler GET: routing ke `readAllSheets()`, `readPublicSheets()`, `handleDelete()`, `handleLookupWarga()`, `handleLookupWargaHp()`, `handleCheckSurat()`, `handleCheckLapor()`, `handleSendTestEmail()`, atau `version`. `read`/`delete`/`sendTestEmail` diverifikasi token |
| `handleDelete(params)` | Hapus baris berdasarkan `id` (kolom bantu ID) via `findRowById()`; verifikasi token |
| `readAllSheets()` | Baca 6 sheet lengkap (termasuk `Pengajuan_Surat` & `Lapor_Aspirasi`), pastikan format GMT+7, backfill ID, format tanggal, return `{result, version, portalEnabled, suratEnabled, laporEnabled, adminEmail, saldoAwal, data}` |
| `readPublicSheets()` | Versi publik: hanya Pengumuman & Kegiatan ber-`Publik=Ya`, tanpa `Data_Warga`/`Iuran_Kas`/`Pengajuan_Surat`/`Lapor_Aspirasi`; ditolak (`portal_disabled`) bila portal OFF |
| `getOrCreateSheet(ss, name)` | Ambil sheet; **buat otomatis** (beserta header) bila belum ada & termasuk skema dikenal |
| `isPortalEnabled()` / `setPortalEnabled(bool)` | Baca/tulis status portal publik di Script Property `PUBLIC_PORTAL_ENABLED` (default aktif) |
| `isSuratEnabled()` / `setSuratEnabled(bool)` | Baca/tulis status fitur Layanan Surat di Script Property `SURAT_ENABLED` (default aktif) |
| `isLaporEnabled()` / `setLaporEnabled(bool)` | Baca/tulis status fitur Lapor & Aspirasi di Script Property `LAPOR_ENABLED` (default aktif) |
| `getSaldoAwal()` / `handleSetSaldoAwal(data)` | Baca/tulis saldo pembukaan kas di Script Property `SALDO_AWAL` (default `0`). Dipakai `readAllSheets()` (field `saldoAwal`) dan aksi admin `setSaldoAwal` |
| `isAuthorized(token)` / `getAdminToken()` | Verifikasi token terhadap Script Property `ADMIN_TOKEN` (perbandingan konstan) |
| `doPost(e)` | Handler POST: `add` / `update` (by `id`) / `delete` (by `id`) / `setPortalStatus` / `setSuratStatus` / `setLaporStatus` / `setAdminEmail` / `setSaldoAwal` (token) + `submitSurat` & `submitLapor` (publik) |
| `handleSubmitSurat(data)` | Aksi publik `submitSurat`: validasi (NIK 16 digit, HP, field wajib), gate portal, honeypot, rate limit, simpan `Status=Pending` (+ `No. Surat` kosong), email admin |
| `handleCheckSurat(params)` | Aksi publik `checkSurat`: cocokkan **NIK + No. HP** atau **No. Pengajuan (`ref`)**, kembalikan hanya `{ref, tanggal, jenisSurat, status, noSurat, catatan}`; baris `Diarsipkan=Ya` dilewati & dihitung ke field `archived` (tidak ditampilkan ke warga) |
| `handleCheckSuratDuplicate(params)` | Aksi publik `checkSuratDuplicate`: cari pengajuan aktif dengan NIK+HP+jenis sama; kembalikan tanggal & keperluan (maks. 5) untuk peringatan form |
| `handleLookupWarga(params)` | Aksi publik `lookupWarga`: cari warga berdasar NIK, buka hanya Nama/No. HP/Alamat |
| `handleLookupWargaHp(params)` | Aksi publik `lookupWargaHp`: cari warga berdasar No. HP (dinormalisasi), buka hanya Nama/Alamat (dipakai form Lapor) |
| `handleSubmitLapor(data)` | Aksi publik `submitLapor`: gate portal, No. HP wajib terdaftar (`findWargaByHpNorm`), honeypot, rate limit, ambil Nama/Alamat dari `Data_Warga`, simpan `Status=Diterima` + No. Pengaduan, unggah foto (opsional), email admin |
| `handleCheckLapor(params)` | Aksi publik `checkLapor`: cari berdasar No. Pengaduan, kembalikan `{nomor, tanggal, jenisPengaduan, judul, status, petugas, catatan, tanggalSelesai}`; arsip dilewati & dihitung ke `archived` |
| `makeNomorPengaduan(sheet)` | Hasilkan No. Pengaduan berurutan `ADU/<tahun>-NNN` |
| `saveLaporFoto(data, folder)` | Decode base64 → simpan ke Drive (`Utilities.newBlob`/`createFile`) → kembalikan URL; cap ukuran |
| `getLaporFolder()` | Ambil folder Drive `Lapor`: dari Script Property `LAPOR_FOLDER_ID`, atau cari berdasarkan nama, atau **buat otomatis** lalu bagikan ke `ADMIN_EMAIL` |
| `authorizeDrive()` | Jalankan **sekali** dari editor (Run) untuk memicu izin scope Google Drive; sekaligus membuat folder `Lapor` |
| `notifyAdminNewLapor(row)` | Email notifikasi pengaduan baru ke `ADMIN_EMAIL`; bila ada lampiran foto, email memuat baris **"Bukti pendukung : View foto"** dengan tautan ke foto Drive (gagal email tidak membatalkan simpan) |
| `suratSaveError(sheetName, data)` | Aturan bisnis: tolak simpan bila status `Selesai` tanpa `No. Surat` (dipakai jalur admin add/update) |
| `checkAndRecordSuratRate(nik)` | Rate limit berbasis Script Property `SURAT_RATE` (≤ 5/jam per NIK, ≤ 60/jam global) |
| `checkAndRecordSuratCheckRate(key)` | Rate limit cek status di Script Property `SURAT_CHECK_RATE` (≤ 30/jam per NIK+HP, ≤ 300/jam global) |
| `checkAndRecordLaporRate(hp)` | Rate limit pengaduan di Script Property `LAPOR_RATE` (≤ 5/jam per No. HP, ≤ 60/jam global) |
| `checkAndRecordLaporCheckRate(key)` | Rate limit cek pengaduan di Script Property `LAPOR_CHECK_RATE` (per key & global) |
| `notifyAdminNewSurat(row)` | Kirim email notifikasi ke `ADMIN_EMAIL` (bila diatur) memakai `buildNotifMailOptions()`; gagal email tidak membatalkan penyimpanan |
| `handleSendTestEmail()` | Aksi admin `sendTestEmail`: kirim email uji ke `ADMIN_EMAIL`; kembalikan `no_admin_email` / `email_failed` / `mail_scope_denied` bila gagal |
| `getNotifSenderName()` | Nama pengirim notifikasi dari Script Property `NOTIF_SENDER_NAME` (default `Pengajuan surat`) |
| `getNotifReplyTo(adminEmail)` | Alamat Reply-To dari Script Property `NOTIF_REPLY_TO` (default `adminEmail`/`ADMIN_EMAIL`) |
| `getNotifSubjectPrefix()` | Prefiks subjek email notifikasi dari Script Property `NOTIF_SUBJECT_PREFIX` (default `[SAPA-RT]`) |
| `buildNotifMailOptions(to, subject, body)` | Susun objek opsi `MailApp.sendEmail` lengkap dengan `name` & `replyTo` terparameter |
| `authorizeMail()` | Jalankan **sekali** dari editor (Run) untuk memicu izin scope `script.send_mail`. Wajib sebelum email dapat dikirim; tanpa ini `MailApp.sendEmail` error "You do not have permission..." |
| `findRowById(sheet, name, id)` | Cari nomor baris berdasarkan ID stabil |
| `ensureIds(sheet, name)` | Pastikan header `ID` & backfill ID baris lama |
| `ensureSpreadsheetFormat(ss, sheet, name)` | Set timezone Asia/Jakarta + format `dd-mm-yyyy hh:mm` + header ID |
| `migrateLayout(sheet, name)` | Migrasi header: sisipkan `Publik` (Pengumuman/Kegiatan_Warga) & delegasi `Data_Warga` |
| `migrateDataWargaLayout(sheet, desired)` | Susun ulang `Data_Warga` ke urutan terbaru (Nomor KK, Status, Jenis Kelamin, Pendidikan, Pekerjaan) berbasis **nama header**; kolom baru yang belum ada diisi kosong; idempoten |
| `buildRowData(sheetName, data, timestamp, id)` | Susun array baris (Timestamp, field, ID) |
| `respond(obj)` | Helper: return JSON dengan MIME type benar |

---

## 🐛 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Data tidak muncul | URL sumber data salah / belum deploy | Cek `publicApiUrl` di `config.js` & `APPS_SCRIPT_URL` di Cloudflare Pages |
| Delete tidak work | Kode lama di Web App | **Deploy ulang dengan versi baru** |
| CORS error | `mode: 'no-cors'` tapi butuh response | Frontend pakai JSONP GET untuk delete |
| Empty rows di Sheets | Delete pakai POST lama | Gunakan GET delete di code.gs terbaru |
| "Script function not found" | Nama fungsi typo | Pastikan `doGet` & `doPost` exact |
| Email gagal: **"You do not have permission to call MailApp.sendEmail. Required permissions: .../auth/script.send_mail"** | Scope kirim email belum diizinkan pada akun pemilik skrip | Di editor Apps Script: simpan (Ctrl+S) > pilih fungsi **`authorizeMail`** > **Run** > **Review permissions** > pilih akun pemilik > **Allow**. Lalu **Manage deployments > Edit > Version: New version > Deploy**. Di UI, error ini tampil sebagai kode `mail_scope_denied`. Akun yang meng-Allow harus **sama** dengan pemilik/pendeploy (Web App *Execute as: Me*) |
| Email tidak terkirim tapi tidak ada error | `ADMIN_EMAIL` belum diisi | Tambahkan Script Property **`ADMIN_EMAIL`**, lalu jalankan **`authorizeMail`** dan redeploy |
| "Gagal cek versi backend" / "Gagal memuat data" di UI | URL Web App salah, atau proxy `/api` gagal & URL cadangan tidak valid | Pastikan `publicApiUrl` di `config.js` berakhiran `/exec`, dan `APPS_SCRIPT_URL` di Cloudflare Pages (Settings → Environment variables) menunjuk Web App `/exec` yang benar. Koneksi memakai proxy `/api` lebih dulu lalu jatuh ke URL langsung. |

---

## 📝 Catatan Penting

1. **ID Stabil**: Frontend mengirim `id` pada add/update/delete. Backend mencari baris lewat kolom bantu `ID` (`findRowById`), bukan nomor baris. Jadi menyisipkan/menghapus baris lain tidak akan salah sasaran.

2. **JSONP**: Frontend menggunakan JSONP (`<script src="...&callback=fn">`) untuk menghindari CORS. Apps Script membungkus response: `callback({result:...})`.

3. **Timestamp**: Otomatis ditambahkan Apps Script saat `appendRow` (kolom pertama di setiap sheet), berupa `Date` asli berformat `dd-mm-yyyy hh:mm` (GMT+7).

4. **Format Tanggal**: `readAllSheets()` memformat kolom tanggal jadi `yyyy-MM-dd` (termasuk `Tanggal Lahir` pada `Data_Warga`) dan waktu jadi `HH:mm` sebelum dikirim ke frontend.

5. **Migrasi**: Saat pertama kali `read`, header `ID` dibuat, kolom `Publik` disisipkan (Pengumuman & Kegiatan_Warga), layout `Data_Warga` disusun ulang berbasis nama header (menambahkan `Nomor KK`, `Status`, `Jenis Kelamin`, `Pendidikan`, `Pekerjaan` bila belum ada), dan semua baris lama otomatis diberi ID + `Publik=Ya`. Tidak ada langkah manual.

6. **Publik**: Kolom `Publik` bernilai `Ya`/`Tidak`. Hanya record `Ya` yang tampil di `public.html`. Di sisi admin, gunakan tombol toggle (ikon mata) pada kartu Pengumuman/Kegiatan untuk mengubahnya.

7. **Token Admin**: `ADMIN_TOKEN` disimpan di Script Properties (bukan di kode). Semua tulis & baca lengkap diverifikasi. Ganti token kapan saja dengan mengubah Script Property; admin perlu memperbarui Token Admin di `index.html`.

8. **Status Portal Publik**: `PUBLIC_PORTAL_ENABLED` disimpan di Script Properties. Toggle di `index.html` mengirim `setPortalStatus`; bila `false`, `readPublic` ditolak (`code:"portal_disabled"`). Properti ini sengaja terpisah dari `ADMIN_TOKEN`. Toggle **Layanan Surat** memakai properti terpisah `SURAT_ENABLED` (aksi `setSuratStatus`); bila `false`, `submitSurat`/`checkSurat`/`lookupWarga` ditolak (`code:"surat_disabled"`).

---

## 📂 File Terkait

- `code.gs` — Kode utama (copy ke Apps Script)
- `../functions/api/[[path]].js` — Cloudflare Pages Function (proxy same-origin `/api` ke Apps Script)
- `../index.html` — Frontend dashboard
- `../public.html` — Portal publik warga
- `../readme.md` — Dokumentasi utama proyek