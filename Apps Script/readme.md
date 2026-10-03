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

---

## 🗂️ Struktur Google Sheets (Database)

### 1. Tab `Data_Warga`
| Kolom | Tipe | Contoh |
|-------|------|--------|
| Timestamp | DateTime | 2026-10-03 10:30:00 |
| Nama Lengkap | String | Budi Santoso |
| NIK | String | 3173012304567890 |
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
| `read` | `action=read` | Baca semua data dari 4 sheet (JSONP) |
| `delete` | `action=delete&sheetName=X&rowIndex=Y` | Hapus baris di sheet X (JSONP) |
| (default) | — | Health check: `{result:"success", message:"Web App aktif"}` |

**Contoh Read:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=read&callback=myCallback
```

**Contoh Delete:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=delete&sheetName=Data_Warga&rowIndex=0&callback=myCallback
```

> Semua GET mendukung **JSONP** via parameter `callback` untuk menghindari masalah CORS.

### POST Requests

Kirim JSON ke URL Web App (Content-Type: `text/plain` untuk CORS simple request).

| Sheet | Payload Fields |
|-------|----------------|
| `Data_Warga` | `sheetName`, `nama`, `nik`, `noHp`, `statusTinggal`, `alamat` |
| `Iuran_Kas` | `sheetName`, `tanggal`, `nama`, `noRumah`, `jenis`, `jumlah`, `keterangan` |
| `Pengumuman` | `sheetName`, `tanggal`, `judul`, `isi`, `kategori`, `pj` |
| `Kegiatan_Warga` | `sheetName`, `namaKegiatan`, `tanggal`, `waktu`, `lokasi`, `pj`, `keterangan` |

**Contoh payload (Tambah Warga):**
```json
{
  "sheetName": "Data_Warga",
  "nama": "Budi Santoso",
  "nik": "3173012304567890",
  "noHp": "081234567890",
  "statusTinggal": "Tetap",
  "alamat": "Jl. Tanjung Duren No. 12"
}
```

**Response sukses:**
```json
{ "result": "success" }
```

**Response error:**
```json
{ "result": "error", "message": "Sheet tidak ditemukan" }
```

---

## 🔄 Flow Data

```
Frontend (index.html)                    Google Apps Script                    Google Sheets
─────────────────────                    ──────────────────                    ──────────────
                                    ┌────────────────────────┐
                                    │  doGet(e)              │
                                    │  ├── action=read       │──▶ readAllSheets() ──▶ Baca 4 sheet
                                    │  └── action=delete     │──▶ handleDelete() ──▶ deleteRow()
                                    └────────────────────────┘
                                            ▲
                                            │ JSONP callback
                                            │
        POST {sheetName, ...} ─────────────┘
        GET ?action=delete&... ────────────▶
```

---

## 🛠️ Fungsi Utama

| Fungsi | Deskripsi |
|--------|-----------|
| `doGet(e)` | Handler GET: routing ke `readAllSheets()` atau `handleDelete()` |
| `handleDelete(params)` | Hapus baris: validasi index, `sheet.deleteRow(rowIndex+2)` |
| `readAllSheets()` | Baca 4 sheet, format tanggal, return `{result, data}` |
| `doPost(e)` | Handler POST: tambah baris baru via `sheet.appendRow()` |
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

1. **Row Index**: Frontend mengirim index 0-based (array). Apps Script konversi ke row spreadsheet: `rowIndex + 2` (header di row 1, data mulai row 2).

2. **JSONP**: Frontend menggunakan JSONP (`<script src="...&callback=fn">`) untuk menghindari CORS. Apps Script membungkus response: `callback({result:...})`.

3. **Timestamp**: Otomatis ditambahkan Apps Script saat `appendRow` (kolom pertama di setiap sheet).

4. **Format Tanggal**: `readAllSheets()` memformat kolom tanggal jadi `yyyy-MM-dd` dan waktu jadi `HH:mm` sebelum dikirim ke frontend.

---

## 📂 File Terkait

- `code.gs` — Kode utama (copy ke Apps Script)
- `../index.html` — Frontend dashboard
- `../readme.md` — Dokumentasi utama proyek