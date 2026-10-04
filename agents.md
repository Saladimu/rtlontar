# 🤖 Agents & System Instructions - Dashboard RT Tanjung Duren Utara

Dokumen ini berisi arsitektur sistem, aturan integrasi data, serta petunjuk teknis bagi pengembang atau AI Agent yang bertugas memelihara, memodifikasi, atau memperluas fungsionalitas aplikasi ini.

---

## 🏗️ System Architecture Overview

- **Frontend Architecture:** Single Page Application (SPA) berbasis HTML5, diselaraskan dengan Tailwind CSS CDN untuk *utility styling*, dan FontAwesome CDN untuk ikonografi.
- **Backend Architecture:** Serverless Function via Google Apps Script (`doGet` + `doPost` HTTP Endpoints).
- **Database Layer:** Google Sheets (Relational-like Tabular Spreadsheet Storage).
- **State Persistence Layer:** Dual Storage Mode:
  - *Primary:* Dynamic asynchronous HTTP request ke Google Apps Script Web App.
  - *Fallback / Local State:* `localStorage` browser untuk akses offline dan *instant rendering*.
- **Delete Sync:** Operasi hapus menggunakan **GET dengan JSONP** untuk memastikan sinkronisasi ke Google Sheets sebelum pembaruan lokal.

---

## 📦 Data Schema & Agent Payload Contracts

Setiap permintaan pengiriman data dari Frontend Agent ke Backend Apps Script dikirimkan menggunakan metode `POST` dengan *Content-Type* `text/plain;charset=utf-8` yang membawa objek `sheetName`.

### 1. Modul Data Warga (`sheetName: "Data_Warga"`)
```json
{
  "sheetName": "Data_Warga",
  "nama": "String (Required)",
  "nik": "String (Optional)",
  "noHp": "String (Required)",
  "statusTinggal": "String [Tetap | Kontrak]",
  "alamat": "String (Required)"
}
```

### 2. Modul Iuran & Kas RT (`sheetName: "Iuran_Kas"`)
```json
{
  "sheetName": "Iuran_Kas",
  "tanggal": "YYYY-MM-DD",
  "nama": "String (Required)",
  "noRumah": "String (Optional)",
  "jenis": "String [Pemasukan | Pengeluaran]",
  "jumlah": "Number (Required)",
  "keterangan": "String (Optional)"
}
```

### 3. Modul Pengumuman (`sheetName: "Pengumuman"`)
```json
{
  "sheetName": "Pengumuman",
  "tanggal": "YYYY-MM-DD",
  "judul": "String (Required)",
  "isi": "String (Required)",
  "kategori": "String [Informasi Umum | Penting/Mendesak | Keuangan | Kegiatan]",
  "pj": "String (Required)"
}
```

### 4. Modul Kegiatan Warga (`sheetName: "Kegiatan_Warga"`)
```json
{
  "sheetName": "Kegiatan_Warga",
  "namaKegiatan": "String (Required)",
  "tanggal": "YYYY-MM-DD",
  "waktu": "HH:MM",
  "lokasi": "String (Required)",
  "pj": "String (Required)",
  "keterangan": "String (Optional)"
}
```

---

## 📡 API Endpoints

### GET Requests (JSONP Support)

| Action | Parameter | Deskripsi |
|--------|-----------|-----------|
| `read` | `action=read` | Baca semua data dari 4 sheet |
| `delete` | `action=delete&sheetName=X&rowIndex=Y` | Hapus baris di sheet X (JSONP callback) |
| `version` | `action=version` | Cek versi `code.gs` yang aktif (untuk memastikan sudah redeploy) |

**Contoh:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=read&callback=fn
GET https://script.google.com/macros/s/XXXX/exec?action=delete&sheetName=Data_Warga&rowIndex=0&callback=fn
GET https://script.google.com/macros/s/XXXX/exec?action=version&callback=fn
```

> **Verifikasi deployment:** `CODE_VERSION` di `code.gs` harus sama dengan `EXPECTED_BACKEND_VERSION` di `index.html`. `read` mengembalikan `version`, jadi frontend akan memunculkan peringatan jika Web App masih menjalankan versi lama. Tombol **Cek Versi Backend** juga tersedia di UI.

### POST Requests

Kirim JSON ke URL Web App dengan `Content-Type: text/plain;charset=utf-8`.

| `action` | Parameter | Deskripsi |
|----------|-----------|-----------|
| `add` (default) | `{ sheetName, ...field }` | Tambah baris baru |
| `update` | `{ action:"update", sheetName, rowIndex, ...field }` | Perbarui baris ke-`rowIndex` (0-based di luar header). Timestamp asli dipertahankan, **tidak** menambah baris baru |
| `delete` | `{ action:"delete", sheetName, rowIndex }` | Hapus baris ke-`rowIndex` (0-based di luar header) |

> **Penting:** Operasi `update` **wajib** menyertakan `action:"update"`. Tanpa itu `doPost` menganggapnya `add` dan menambahkan baris duplikat.

---

## 🛠️ New Features & Implementation Details

### 1. Edit Functionality
Semua modul memiliki tombol **Edit** ✏️ yang membuka modal dengan data terisi otomatis.

**Cara kerja:**
- `editMode` object melacak index yang sedang diedit: `{ warga: null, kas: null, pengumuman: null, kegiatan: null }`
- Saat tombol Edit diklik, isi form diisi dengan data record, tombol submit berubah menjadi "Perbarui"
- `submitXxx()` memeriksa `editMode` — jika bukan null, kirim `{ action:'update', rowIndex, ...fields }`; jika null, lakukan insert (`add`)

**Fungsi edit tersedia:**
- `editWarga(index)`
- `editKas(index)`
- `editPengumuman(index)`
- `editKegiatan(index)`

### 2. Delete with Google Sheets Sync

**Flow baru (terbaru):**
1. Tombol delete ditekan → tampilkan warning (untuk Warga) atau confirm box
2. Panggil `deleteRecord(sheetName, index, arrayRef, renderFn, type)`
3. **Kirim DELETE ke Google Sheets dulu** via GET + JSONP
4. **Hanya jika sukses** → hapus dari `appState` dan `localStorage`
5. Jika gagal → tampilkan error, data tetap ada

**Mengapa order ini penting?**
- Jika delete lokal dilakukan dulu, lalu sync gagal → data hilang tapi tidak terhapus dari Sheets
- Dengan menghapus di Sheets dulu, kita pastikan konsistensi data

**Local Delete Tracking:**
- Simpan `localDeletes` sebagai array content signatures per tipe
- Signature dibuat dari kombinasi field unik (NIK+Nama+HP+Alamat untuk Warga, dll)
- Saat reload/sync, filter records yang signature-nya ada di `localDeletes`
- Bersihkan entries yang sudah tidak ada di Sheets

### 3. Delete Warning for Warga
Untuk modul Data Warga, tampilkan dialog konfirmasi yang lebih detail:
```
⚠️ PERHATIAN!

Anda akan menghapus data warga:
• Nama: [nama]
• NIK: [nik]
• No. HP: [hp]

Yakin ingin menghapus data ini?
```

### 4. Refresh Button
Tombol refresh di:
- **Desktop:** Header sidebar kanan atas (ikon 🔄)
- **Mobile:** Header atas sebelah kanan menu hamburger

**Behavior:**
- Menampilkan spinner animasi
- Toast "Memuat ulang data dari Google Sheets..."
- Panggil `syncFromGoogleSheets()`
- Re-render semua tampilan
- Toast sukses "Data berhasil dimuat ulang!"

---

## ⚙️ Maintenance & Development Guidelines for AI Agents

1. **Responsive First Directive:** Seluruh perombakan antarmuka harus mempertahankan prinsip responsif seluler (`sm:`, `md:`, `lg:` breakpoints pada Tailwind CSS).

2. **CORS Protocol Management:**
   - Untuk **POST** (add/update): Gunakan `mode: 'no-cors'` dengan `Content-Type: text/plain;charset=utf-8`
   - Untuk **DELETE**: Gunakan **GET + JSONP** via `<script src>` dengan callback parameter. Ini menghindari masalah CORS dan memungkinkan pembacaan response.
   - Jangan gunakan `application/json` pada mode `no-cors` karena browser akan strip header tersebut.

3. **Data Integrity:**
   - Pastikan sinkronisasi antara kunci properti JSON pada skrip *frontend* selaras dengan urutan indeks `rowData.push()` pada backend Google Apps Script.
   - Untuk delete: `rowIndex` di frontend adalah 0-based array index. Di Apps Script, konversi ke row spreadsheet: `rowIndex + 2` (row 1 = header, row 2 = data pertama).

4. **Offline Resilience:**
   - Selalu simpan state terbaru ke `localStorage` sebelum meluncurkan perintah `fetch()` ke jaringan external.
   - Implementasikan `localDeletes` tracking untuk mencegah record yang dihapus muncul kembali setelah reload.

5. **Edit Flow Best Practices:**
   - Gunakan `editMode` object untuk membedakan mode tambah vs edit
   - Reset `editMode` ke null saat modal ditutup
   - Ubah teks tombol submit secara dinamis ("Simpan" vs "Perbarui")
   - Ubah judul modal secara dinamis

6. **Delete Flow Best Practices:**
   - SELALU hapus dari Sheets dulu, baru update lokal
   - Gunakan JSONP GET untuk operasi delete (bukan POST)
   - Tampilkan loading state selama proses delete berlangsung
   - Handle timeout dan error dengan toast notification

---

## 📂 File Reference

| File | Deskripsi |
|------|-----------|
| `index.html` | Frontend SPA utama |
| `Apps Script/code.gs` | Backend Apps Script (doGet + doPost) |
| `Apps Script/readme.md` | Dokumentasi lengkap API & Deployment |
| `readme.md` | Dokumentasi proyek utama |
| `agents.md` | Dokumen ini (pedoman untuk AI Agent) |

---

## 🔧 Recent Changes (2026-10-03)

- ✅ **Edit buttons** ditambahkan ke semua 4 modul (Warga, Kas, Pengumuman, Kegiatan)
- ✅ **Delete sync to Google Sheets** — urutan operasi dibalik: Sheets dulu, baru local
- ✅ **Delete persistence** — tracking by content signature mencegah record muncul kembali
- ✅ **Warga delete warning** — dialog detail menampilkan Nama, NIK, No. HP
- ✅ **Refresh button** — tombol 🔄 di header desktop & mobile
- ✅ **JSONP delete handler** — `doGet` sekarang support `action=delete` dengan callback
