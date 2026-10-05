# Google Apps Script — RT Dashboard Backend

File ini berisi kode backend untuk sistem Dashboard RT Tanjung Duren Utara. Kode ini dijalankan di **Google Apps Script** yang terhubung ke Google Sheets sebagai database.

---

## 📋 Prasyarat

1. Buat file **Google Sheets** baru
2. Buat 4 tab/sheet dengan nama **exact** (case-sensitive):
   - `Data_Warga`
   - `Iuran_Kas`
   - `Pengumuman`
   - `Kegiatan_Warga`
3. Buka **Ekstensi > Apps Script** di Google Sheets
4. Salin isi `code.gs` ke editor Apps Script
5. Buka **Project Settings > Script Properties**, tambahkan properti:
   - **Nama:** `ADMIN_TOKEN`
   - **Nilai:** token rahasia pilihan Anda (mis. `rt-rahasia-2026`)
   - (Opsional) **Nama:** `PUBLIC_PORTAL_ENABLED`, **Nilai:** `true`/`false`. Bila belum diatur, portal publik dianggap **aktif**. Nilai ini otomatis diubah lewat toggle di aplikasi.

---

## 🔐 Keamanan (Token Admin)

Karena Web App di-deploy sebagai **Anyone**, tanpa proteksi siapa pun yang tahu URL dapat menulis data. Karena itu `code.gs` mewajibkan **token admin**:

- Semua operasi **tulis** (`add` / `update` / `delete`) dan **baca lengkap** (`action=read`) wajib menyertakan parameter/field `token`.
- Token disimpan di **Script Properties** dengan key `ADMIN_TOKEN` dan **tidak** ditulis di dalam kode.
- Bila `ADMIN_TOKEN` belum diatur, semua operasi terproteksi otomatis **ditolak** (`code:"unauthorized"`).
- Portal publik memakai `action=readPublic` yang **tanpa token** dan hanya mengembalikan `Pengumuman` & `Kegiatan_Warga` ber-`Publik=Ya`; `Data_Warga` dan `Iuran_Kas` tidak pernah dikirim keluar.

### ON/OFF Portal Publik

Admin dapat menyalakan/mematikan akses portal publik dari toggle di tab **Portal Publik** (`index.html`). Status disimpan di Script Property `PUBLIC_PORTAL_ENABLED` lewat aksi `setPortalStatus` (butuh token). Saat **OFF**, `action=readPublic` mengembalikan `{result:"error", code:"portal_disabled"}` sehingga `public.html` menampilkan pesan "Portal publik dinonaktifkan" dan tidak ada data yang bocor. Saat properti belum diatur, portal dianggap **aktif** (default).

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
| Nama Lengkap | String | Budi Santoso |
| NIK | String | 3173012304567890 |
| Tempat Lahir | String | Jakarta |
| Tanggal Lahir | Date | 1990-05-17 |
| No HP | String | 081234567890 |
| Status Tempat Tinggal | String | Tetap / Kontrak |
| Alamat/No Rumah | String | Jl. Tanjung Duren No. 12 |

### 2. Tab `Iuran_Kas`
| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Tanggal | Date | 2026-10-01 |
| Nama Warga | String | Budi Santoso |
| No Rumah | String | 12A |
| Jenis Transaksi | String | Pemasukan / Pengeluaran |
| Jumlah (Rp) | Number | 50000 |
| Keterangan | String | Iuran Kebersihan Bulan Oktober |

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

## 🔌 API Endpoints

Base URL: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

### GET Requests

| Action | Parameter | Deskripsi |
|--------|-----------|-----------|
| `read` | `action=read&token=T` | Baca semua data dari 4 sheet + `portalEnabled`. **Butuh token admin** (JSONP) |
| `readPublic` | `action=readPublic` | Hanya `Pengumuman` & `Kegiatan_Warga` ber-`Publik=Ya`. **Tanpa token**. Mengembalikan `{result:"error", code:"portal_disabled"}` bila portal dinonaktifkan admin |
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

**Contoh Delete:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=delete&sheetName=Data_Warga&id=id-1728...&token=TOKEN_RAHASIA&callback=myCallback
```

> Semua GET mendukung **JSONP** via parameter `callback` untuk menghindari masalah CORS.

> Tanpa token yang benar, `read` dan `delete` mengembalikan `{result:"error", code:"unauthorized"}`.

### POST Requests

Kirim JSON ke URL Web App (Content-Type: `text/plain` untuk CORS simple request).

`action` yang didukung: `add` (default), `update`, `delete`. Sertakan `action:"update"` atau `action:"delete"` beserta `id` untuk mengubah/menghapus baris. **Semua POST wajib menyertakan `token` admin** (field `token` di body).

| Sheet | Payload Fields |
|-------|----------------|
| `Data_Warga` | `sheetName`, `token`, `id` (opsional saat add), `nama`, `nik`, `tempat`, `tanggalLahir`, `noHp`, `statusTinggal`, `alamat` |
| `Iuran_Kas` | `sheetName`, `token`, `id` (opsional saat add), `tanggal`, `nama`, `noRumah`, `jenis`, `jumlah`, `keterangan` |
| `Pengumuman` | `sheetName`, `token`, `id` (opsional saat add), `tanggal`, `judul`, `isi`, `kategori`, `pj`, `publik` (`Ya`/`Tidak`) |
| `Kegiatan_Warga` | `sheetName`, `token`, `id` (opsional saat add), `namaKegiatan`, `tanggal`, `waktu`, `lokasi`, `pj`, `keterangan`, `publik` (`Ya`/`Tidak`) |

**Aksi khusus (bukan per-sheet):**

| Aksi | Payload | Deskripsi |
|------|---------|-----------|
| `setPortalStatus` | `{action:"setPortalStatus", enabled:true/false, token:T}` | Menyalakan/mematikan portal publik. Butuh token admin. Disimpan di Script Property `PUBLIC_PORTAL_ENABLED` |

**Contoh payload (Tambah Warga):**
```json
{
  "sheetName": "Data_Warga",
  "id": "id-1728031200000-ab12cd",
  "nama": "Budi Santoso",
  "nik": "3173012304567890",
  "tempat": "Jakarta",
  "tanggalLahir": "1990-05-17",
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
  "nama": "Budi Santoso (revisi)",
  "nik": "3173012304567890",
  "tempat": "Bandung",
  "tanggalLahir": "1990-05-17",
  "noHp": "081234567890",
  "statusTinggal": "Kontrak",
  "alamat": "Jl. Tanjung Duren No. 15"
}
```

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
                                    │  ├── action=read  [T]  │──▶ readAllSheets() ──▶ Baca 4 sheet
                                    │  ├── action=readPublic │──▶ readPublicSheets()▶ Pengumuman+Kegiatan Ya
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
| `doGet(e)` | Handler GET: routing ke `readAllSheets()`, `readPublicSheets()`, `handleDelete()`, atau `version`. `read`/`delete` diverifikasi token |
| `handleDelete(params)` | Hapus baris berdasarkan `id` (kolom bantu ID) via `findRowById()`; verifikasi token |
| `readAllSheets()` | Baca 4 sheet lengkap, pastikan format GMT+7, backfill ID, format tanggal, return `{result, version, portalEnabled, data}` |
| `readPublicSheets()` | Versi publik: hanya Pengumuman & Kegiatan ber-`Publik=Ya`, tanpa `Data_Warga`/`Iuran_Kas`; ditolak (`portal_disabled`) bila portal OFF |
| `isPortalEnabled()` / `setPortalEnabled(bool)` | Baca/tulis status portal publik di Script Property `PUBLIC_PORTAL_ENABLED` (default aktif) |
| `isAuthorized(token)` / `getAdminToken()` | Verifikasi token terhadap Script Property `ADMIN_TOKEN` (perbandingan konstan) |
| `doPost(e)` | Handler POST: `add` / `update` (by `id`) / `delete` (by `id`) / `setPortalStatus`; wajib token |
| `findRowById(sheet, name, id)` | Cari nomor baris berdasarkan ID stabil |
| `ensureIds(sheet, name)` | Pastikan header `ID` & backfill ID baris lama |
| `ensureSpreadsheetFormat(ss, sheet, name)` | Set timezone Asia/Jakarta + format `dd-mm-yyyy hh:mm` + header ID |
| `migrateLayout(sheet, name)` | Migrasi header: sisipkan `Publik` (Pengumuman/Kegiatan_Warga) & delegasi `Data_Warga` |
| `migrateDataWargaLayout(sheet, desired)` | Sisipkan kolom `Tempat Lahir` & `Tanggal Lahir` (setelah `NIK`) bila belum ada; idempoten |
| `buildRowData(sheetName, data, timestamp, id)` | Susun array baris (Timestamp, field, ID) |
| `respond(obj)` | Helper: return JSON dengan MIME type benar |

---

## 🐛 Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| Data tidak muncul | URL salah / belum deploy | Cek Web App URL di Settings > Koneksi |
| Delete tidak work | Kode lama di Web App | **Deploy ulang dengan versi baru** |
| CORS error | `mode: 'no-cors'` tapi butuh response | Frontend pakai JSONP GET untuk delete |
| Empty rows di Sheets | Delete pakai POST lama | Gunakan GET delete di code.gs terbaru |
| "Script function not found" | Nama fungsi typo | Pastikan `doGet` & `doPost` exact |

---

## 📝 Catatan Penting

1. **ID Stabil**: Frontend mengirim `id` pada add/update/delete. Backend mencari baris lewat kolom bantu `ID` (`findRowById`), bukan nomor baris. Jadi menyisipkan/menghapus baris lain tidak akan salah sasaran.

2. **JSONP**: Frontend menggunakan JSONP (`<script src="...&callback=fn">`) untuk menghindari CORS. Apps Script membungkus response: `callback({result:...})`.

3. **Timestamp**: Otomatis ditambahkan Apps Script saat `appendRow` (kolom pertama di setiap sheet), berupa `Date` asli berformat `dd-mm-yyyy hh:mm` (GMT+7).

4. **Format Tanggal**: `readAllSheets()` memformat kolom tanggal jadi `yyyy-MM-dd` (termasuk `Tanggal Lahir` pada `Data_Warga`) dan waktu jadi `HH:mm` sebelum dikirim ke frontend.

5. **Migrasi**: Saat pertama kali `read`, header `ID` dibuat, kolom `Publik` disisipkan (Pengumuman & Kegiatan_Warga), kolom `Tempat Lahir` & `Tanggal Lahir` disisipkan pada `Data_Warga` (setelah `NIK`), dan semua baris lama otomatis diberi ID + `Publik=Ya`. Tidak ada langkah manual.

6. **Publik**: Kolom `Publik` bernilai `Ya`/`Tidak`. Hanya record `Ya` yang tampil di `public.html`. Di sisi admin, gunakan tombol toggle (ikon mata) pada kartu Pengumuman/Kegiatan untuk mengubahnya.

7. **Token Admin**: `ADMIN_TOKEN` disimpan di Script Properties (bukan di kode). Semua tulis & baca lengkap diverifikasi. Ganti token kapan saja dengan mengubah Script Property; admin perlu memperbarui Token Admin di `index.html`.

8. **Status Portal Publik**: `PUBLIC_PORTAL_ENABLED` disimpan di Script Properties. Toggle di `index.html` mengirim `setPortalStatus`; bila `false`, `readPublic` ditolak (`code:"portal_disabled"`). Properti ini sengaja terpisah dari `ADMIN_TOKEN`.

---

## 📂 File Terkait

- `code.gs` — Kode utama (copy ke Apps Script)
- `../index.html` — Frontend dashboard
- `../readme.md` — Dokumentasi utama proyek