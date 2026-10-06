# 🤖 Agents & System Instructions - Dashboard RT Tanjung Duren Utara

Dokumen ini berisi arsitektur sistem, aturan integrasi data, serta petunjuk teknis bagi pengembang atau AI Agent yang bertugas memelihara, memodifikasi, atau memperluas fungsionalitas aplikasi ini.

---

## 🏗️ System Architecture Overview

- **Frontend Architecture:** Dua halaman HTML5 statis:
  - `index.html` — SPA admin (semua modul + integrasi), Tailwind CSS CDN + FontAwesome CDN.
  - `public.html` — portal publik warga (read-only, hanya Pengumuman & Kegiatan `Publik=Ya`).
- **Public Portal Config:** URL backend `public.html` diambil dari `config.js` (`RT_CONFIG.publicApiUrl`) sehingga tautan publik cukup `public.html`; query param `?url=<WebAppURL>` (dibuat otomatis oleh `openPublicPortal()` di admin) tetap didukung sebagai fallback. Tautan yang ditampilkan/dibuka di menu Portal Publik dapat diarahkan ke domain kustom via `RT_CONFIG.publicPortalUrl` (mis. Cloudflare Pages). Tidak ada input URL manual/localStorage di sisi publik; bila semuanya kosong, `showConfigNeeded()` menampilkan instruksi menghubungi admin.
- **Backend Architecture:** Serverless Function via Google Apps Script (`doGet` + `doPost` HTTP Endpoints).
- **Database Layer:** Google Sheets (Relational-like Tabular Spreadsheet Storage).
- **State Persistence Layer:** Dual Storage Mode:
  - *Primary:* Dynamic asynchronous HTTP request ke Google Apps Script Web App.
  - *Fallback / Local State:* `localStorage` browser untuk akses offline dan *instant rendering*.
- **Delete Sync:** Operasi hapus menggunakan **GET dengan JSONP** untuk memastikan sinkronisasi ke Google Sheets sebelum pembaruan lokal.
- **Security Layer:** Web App berjalan sebagai *Anyone*, sehingga `code.gs` melindungi diri dengan **token admin** (`ADMIN_TOKEN` di Script Properties). Semua tulis (`add`/`update`/`delete`/`setPortalStatus`) & baca lengkap (`read`) wajib token; portal publik memakai `readPublic` (tanpa token, hanya data `Publik=Ya`, dan bisa dimatikan total via `PUBLIC_PORTAL_ENABLED`). Frontend menyimpan token di `localStorage` (`rt_admin_token`).

---

## 🧩 Parameterisasi Identitas RT (`config.js`)

Seluruh teks identitas RT (judul halaman, header, footer, sub-judul, placeholder form) **tidak** lagi hardcoded. Sumber tunggalnya ada di `config.js`:

```js
window.RT_CONFIG = {
    appName: 'Sistem RT',
    rt: '005',
    rw: '02',
    kelurahan: 'Tanjung Duren Utara',
    kecamatan: 'Grogol Petamburan',
    kota: 'Jakarta Barat',
    provinsi: 'DKI Jakarta',
    tahun: new Date().getFullYear(),
    alamatContoh: 'Jl. Tanjung Duren Utara No. 12',
    lokasiContoh: 'Lap. Bulutangkis RT'
};
```

- `index.html` & `public.html` memuat `<script src="config.js"></script>`; helper `window.RT.apply()` mengisi elemen ber-atribut `data-rt="<key>"` dan `data-rt-placeholder="<key>"`.
- Teks di dalam HTML tetap ada sebagai **fallback** (bila `config.js` gagal dimuat), lalu ditimpa oleh JS saat halaman dimuat.
- Derived values (mis. `appNameRt`, `headerName`, `footerAdmin`, `titlePublic`, `wilayah`) dibentuk otomatis dari field dasar; mengubah `rt`/`rw`/`kelurahan`/`kecamatan`/`tahun` cukup di satu tempat.
- **Jangan** menambahkan teks identitas RT baru langsung di HTML — tambahkan `data-rt` + key di `config.js`.
- Bila `config.js` ikut di-deploy/GitHub Pages, pastikan file ini ikut diunggah.



## 📦 Data Schema & Agent Payload Contracts

Setiap permintaan pengiriman data dari Frontend Agent ke Backend Apps Script dikirimkan menggunakan metode `POST` dengan *Content-Type* `text/plain;charset=utf-8` yang membawa objek `sheetName`.

### 1. Modul Data Warga (`sheetName: "Data_Warga"`)
```json
{
  "sheetName": "Data_Warga",
  "token": "String (Required - harus sama dengan ADMIN_TOKEN)",
  "nomorKK": "String (Optional - Nomor Kartu Keluarga)",
  "nama": "String (Required - Nama Lengkap)",
  "status": "String [Kepala Keluarga | Suami/Istri | Anak | Menantu | Cucu | Orang tua | Mertua | Family lain | Pembantu | Lainnya]",
  "jenisKelamin": "String [Laki-laki | Perempuan]",
  "nik": "String (Optional)",
  "tempat": "String (Optional - Tempat Lahir)",
  "tanggalLahir": "YYYY-MM-DD (Optional - Tanggal Lahir)",
  "pendidikan": "String (Optional)",
  "pekerjaan": "String (Optional)",
  "noHp": "String (Required)",
  "statusTinggal": "String [Tetap | Kontrak]",
  "alamat": "String (Required)"
}
```

### 2. Modul Iuran & Kas RT (`sheetName: "Iuran_Kas"`)
```json
{
  "sheetName": "Iuran_Kas",
  "token": "String (Required - harus sama dengan ADMIN_TOKEN)",
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
  "token": "String (Required - harus sama dengan ADMIN_TOKEN)",
  "tanggal": "YYYY-MM-DD",
  "judul": "String (Required)",
  "isi": "String (Required)",
  "kategori": "String [Informasi Umum | Penting/Mendesak | Keuangan | Kegiatan]",
  "pj": "String (Required)",
  "publik": "String [Ya | Tidak] (default Ya)"
}
```

### 4. Modul Kegiatan Warga (`sheetName: "Kegiatan_Warga"`)
```json
{
  "sheetName": "Kegiatan_Warga",
  "token": "String (Required - harus sama dengan ADMIN_TOKEN)",
  "namaKegiatan": "String (Required)",
  "tanggal": "YYYY-MM-DD",
  "waktu": "HH:MM",
  "lokasi": "String (Required)",
  "pj": "String (Required)",
  "keterangan": "String (Optional)",
  "publik": "String [Ya | Tidak] (default Ya)"
}
```

---

## 📡 API Endpoints

### GET Requests (JSONP Support)

| Action | Parameter | Deskripsi |
|--------|-----------|-----------|
| `read` | `action=read&token=T` | Baca semua data dari 4 sheet + `portalEnabled`. **Butuh token** |
| `readPublic` | `action=readPublic` | Hanya Pengumuman & Kegiatan `Publik=Ya`. **Tanpa token**. Bila portal OFF → `{result:"error", code:"portal_disabled"}` |
| `delete` | `action=delete&sheetName=X&id=Y&token=T` | Hapus baris di sheet X (JSONP callback). **Butuh token** |
| `version` | `action=version` | Cek versi `code.gs` yang aktif (untuk memastikan sudah redeploy) |

**Contoh:**
```
GET https://script.google.com/macros/s/XXXX/exec?action=read&token=T&callback=fn
GET https://script.google.com/macros/s/XXXX/exec?action=readPublic&callback=fn
GET https://script.google.com/macros/s/XXXX/exec?action=delete&sheetName=Data_Warga&id=id-1728...&token=T&callback=fn
GET https://script.google.com/macros/s/XXXX/exec?action=version&callback=fn
```

> **Otorisasi:** bila token salah/kosong (atau `ADMIN_TOKEN` belum diatur di Script Properties), `read` & `delete` mengembalikan `{result:"error", code:"unauthorized"}`. Frontend menangkap `code:"unauthorized"` (`applySheetsData` / callback delete) lalu memanggil `promptForAdminToken()` untuk mengarahkan admin mengisi token di tab Pengaturan.

> **Verifikasi deployment:** `CODE_VERSION` di `code.gs` harus sama dengan `EXPECTED_BACKEND_VERSION` di `index.html`. `read` mengembalikan `version`, jadi frontend akan memunculkan peringatan jika Web App masih menjalankan versi lama. Tombol **Cek Versi Backend** juga tersedia di UI.

### POST Requests

Kirim JSON ke URL Web App dengan `Content-Type: text/plain;charset=utf-8`.

| `action` | Parameter | Deskripsi |
|----------|-----------|-----------|
| `add` (default) | `{ sheetName, token, id, ...field }` | Tambah baris baru (`id` opsional; dibuat otomatis bila kosong) |
| `update` | `{ action:"update", sheetName, token, id, ...field }` | Perbarui baris dengan `id` tersebut. Timestamp & ID asli dipertahankan, **tidak** menambah baris baru |
| `delete` | `{ action:"delete", sheetName, token, id }` | Hapus baris dengan `id` tersebut |
| `setPortalStatus` | `{ action:"setPortalStatus", enabled:true/false, token }` | Nyalakan/matikan portal publik (Script Property `PUBLIC_PORTAL_ENABLED`). Bukan operasi per-sheet |

> **Token wajib:** semua POST ditolak (`code:"unauthorized"`) bila `token` tidak cocok dengan `ADMIN_TOKEN`. Karena request POST memakai `mode:'no-cors'` (respons tidak terbaca), frontend mencegah pengiriman bila token kosong via `sendToGoogleSheets()` (memanggil `promptForAdminToken()`).

> **Identitas baris:** setiap baris punya **ID stabil** di kolom bantu `ID` (kolom terakhir sheet, tepat setelah field terakhir). Kolom A tetap `Timestamp` asli (Date) yang ditampilkan `dd-mm-yyyy hh:mm` (GMT+7). `doPost`/`doGet` mencari baris lewat ID ini, bukan nomor baris, sehingga urutan/penyisipan baris tidak menyebabkan salah edit/hapus.

> **Penting:** Operasi `update` **wajib** menyertakan `action:"update"`. Tanpa itu `doPost` menganggapnya `add` dan menambahkan baris duplikat.

> **Field per sheet:**
> - `Data_Warga`: `nomorKK, nama, status, jenisKelamin, nik, tempat, tanggalLahir, pendidikan, pekerjaan, noHp, statusTinggal, alamat`
> - `Iuran_Kas`: `tanggal, nama, noRumah, jenis, jumlah, keterangan`
> - `Pengumuman`: `tanggal, judul, isi, kategori, pj, publik` (`Ya`/`Tidak`)
> - `Kegiatan_Warga`: `namaKegiatan, tanggal, waktu, lokasi, pj, keterangan, publik` (`Ya`/`Tidak`)

> **Publik (Portal Publik):** kolom `Publik` pada `Pengumuman` & `Kegiatan_Warga` menentukan apakah record tampil di `public.html` (`Ya` = tampil). Di admin, tombol toggle ikon mata (`togglePublikPengumuman` / `togglePublikKegiatan`) membalik nilainya lalu mengirim `action:"update"`. Nilai kosong dinormalisasi menjadi `Ya` oleh `normalizePublik()`.

> **ON/OFF Portal Publik:** toggle di tab **Portal Publik** (`#toggle-public-portal`, handler `togglePublicPortal()`) mengirim `setPortalStatus` dan menyimpan status server-side di Script Property `PUBLIC_PORTAL_ENABLED` (`isPortalEnabled()` / `setPortalEnabled()`). Saat OFF, `readPublicSheets()` mengembalikan `code:"portal_disabled"` dan `public.html` menampilkan pesan non-aktif — jadi blokir ini nyata (bukan sekadar menyembunyikan tautan). Status juga disertakan pada respons `read` (`portalEnabled`) untuk menyinkronkan UI admin.

### 🔐 Keamanan & Otorisasi (Token Admin)

- `ADMIN_TOKEN` disimpan di **Script Properties** (Project Settings > Script Properties), **bukan** di `code.gs`.
- `getAdminToken()` membaca properti tersebut; `isAuthorized(token)` membandingkan dengan `safeEqual()` (perbandingan waktu-konstan).
- Bila `ADMIN_TOKEN` belum diatur, semua operasi terproteksi ditolak (fail-closed).
- `readPublicSheets()` memakai `PUBLIK_INDEX` (`Pengumuman`: 6, `Kegiatan_Warga`: 7) untuk memfilter, sengaja **tidak** mengembalikan `Data_Warga`/`Iuran_Kas`, dan menolak akses (`portal_disabled`) bila `PUBLIC_PORTAL_ENABLED` bernilai `false`.
- Frontend admin: input token (`#admin-token-input`) + `saveAdminToken()`, disimpan di `localStorage` `rt_admin_token`; helper `promptForAdminToken()` membuka tab Pengaturan saat token hilang/tidak valid.

---

## 🛠️ New Features & Implementation Details

### 1. Edit Functionality
Semua modul memiliki tombol **Edit** ✏️ yang membuka modal dengan data terisi otomatis.

**Cara kerja:**
- `editMode` object melacak ID record yang sedang diedit: `{ warga: null, kas: null, pengumuman: null, kegiatan: null }`
- Saat tombol Edit diklik, isi form diisi dengan data record, tombol submit berubah menjadi "Perbarui"
- `submitXxx()` memeriksa `editMode` — jika bukan null, kirim `{ action:'update', id, ...fields }`; jika null, lakukan insert (`add`) dengan `id` baru dari `newId()`

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
   - Setiap baris punya **ID stabil** di kolom bantu terakhir (header `ID`). Frontend menyimpan `_id` (elemen terakhir hasil `read`) dan mengirim `id` pada update/delete. Backend mencari lewat `findRowById()`, jadi tidak ada konversi nomor baris dan tidak terpengaruh pergeseran index.
   - Kolom A `Timestamp` ditulis sebagai `Date` asli dengan format angka `dd-mm-yyyy hh:mm`; timezone spreadsheet dipaksa `Asia/Jakarta` (GMT+7) via `ensureSpreadsheetFormat()`.

4. **Timestamp Formatting (GMT+7):**
   - Timezone spreadsheet di-set ke `Asia/Jakarta` dan kolom A diberi nomor format `dd-mm-yyyy hh:mm` untuk semua sheet.
   - Berlaku otomatis saat `read` maupun saat `add`/`update` (setelah baris ditulis).

5. **Offline Resilience:**
   - Selalu simpan state terbaru ke `localStorage` sebelum meluncurkan perintah `fetch()` ke jaringan external.
   - Implementasikan `localDeletes` tracking untuk mencegah record yang dihapus muncul kembali setelah reload.

6. **Edit Flow Best Practices:**
   - Gunakan `editMode` object untuk membedakan mode tambah vs edit
   - Reset `editMode` ke null saat modal ditutup
   - Ubah teks tombol submit secara dinamis ("Simpan" vs "Perbarui")
   - Ubah judul modal secara dinamis

7. **Delete Flow Best Practices:**
   - SELALU hapus dari Sheets dulu, baru update lokal
   - Gunakan JSONP GET untuk operasi delete (bukan POST)
   - Tampilkan loading state selama proses delete berlangsung
   - Handle timeout dan error dengan toast notification

8. **Date Input & Display Formatting:**
   - Simpan tanggal sebagai string `yyyy-MM-dd` (`fmtDate`) di `appState` sebagai format kanonik.
   - **Input add/edit** memakai text field berformat **`dd-mm-yyyy`** dengan auto-mask `maskDateField()`. Konversi memakai `ddmmyyyyToISO()` / `isoToDDMMYYYY()` dan helper `setDateInput()` / `readDateInput()`. Berlaku untuk semua modul (Warga, Kas, Pengumuman, Kegiatan).
   - Untuk **tampilan** (kartu, tabel, dashboard) gunakan `fmtDateDisplay()` → `dd-Mmm-yyyy` (bulan Indonesia).
   - Portal publik memakai aturan tampilan yang sama.

9. **Public Portal Scope:**
   - `public.html` read-only, sumber data hanya `action=readPublic`.
   - URL backend diambil dari `config.js` (`RT_CONFIG.publicApiUrl`) sehingga tautan publik cukup `public.html`; `?url=` hanya fallback kompatibilitas (tanpa input manual/localStorage).
   - Tautan yang ditampilkan & dibuka di menu Portal Publik mengikuti `RT_CONFIG.publicPortalUrl` bila diisi (mis. domain kustom Cloudflare Pages); bila kosong fallback ke `public.html` / `?url=`.
   - Inisialisasi `public.html` menunggu config siap (`whenConfigReady` + `window.RT_CONFIG_READY`) agar tidak ada race async / kedipan "belum dikonfigurasi".
   - Tombol "Muat Ulang" `public.html` = hard refresh (`?_rtcache`), sama seperti `index.html`.
   - Tema terang/gelap: tombol `#theme-toggle` (`toggleTheme()` / `applyTheme()` / `currentTheme()`) men-toggle kelas `dark` pada `<html>` (Tailwind `darkMode: 'class'`), disimpan di `localStorage` `rt_theme`, default ikut `prefers-color-scheme`; skrip anti-FOUC di `<head>` menerapkan tema sebelum render. Semua elemen memakai varian `dark:`.
   - Jangan pernah menambahkan operasi tulis atau mengirim token admin ke `public.html`.

10. **Version Gate:**
    - *Backend:* Setiap perubahan `code.gs` (termasuk alur token) wajib menaikkan `CODE_VERSION` di `code.gs` **dan** `EXPECTED_BACKEND_VERSION` di `index.html`, lalu redeploy sebagai **New version**.
    - *Config:* Setiap perubahan `config.js` sebaiknya menaikkan `RT_CONFIG.version` **dan** `EXPECTED_CONFIG_VERSION` di `index.html` & `public.html`. Bila `RT_CONFIG.version` ≠ `EXPECTED_CONFIG_VERSION` (HTML lama ter-cache), halaman melakukan **hard refresh sekali** via `enforceConfigVersion()`; guard `sessionStorage` key `rt_cfg_reload_<versi>` mencegah reload berulang bila versi memang belum disinkronkan.

11. **Identitas RT (No Hardcode):**
    - Semua teks identitas RT wajib berasal dari `config.js` (`RT_CONFIG`).
    - Tambah elemen baru dengan atribut `data-rt="<key>"` dan daftarkan key-nya di `config.js`.
    - Jangan menulis nama RT/kelurahan/kecamatan langsung di `index.html` atau `public.html`.
    - `config.js` dimuat dengan **cache-buster** (`config.js?v=<timestamp>`) agar perubahan config langsung terlihat tanpa hard refresh manual.

12. **Hard Refresh (Tombol "Muat Ulang" di Menu Utama):**
    - Tombol refresh di header desktop/mobile `index.html` memanggil `refreshData()` yang melakukan **hard refresh**, bukan sekadar sync data.
    - Implementasi: set query `?_rtcache=<Date.now()>` lalu `window.location.replace(url)`, sehingga HTML & `config.js` terbaru diambil ulang dari server (melewati cache browser).
    - Karena `window.onload` memanggil `syncFromGoogleSheets()` (bila `scriptUrl` tersimpan), hard refresh otomatis menyinkronkan **data + konfigurasi + tampilan** sekaligus.
    - Parameter `_rtcache` dibersihkan setelah load via `history.replaceState()` agar URL tetap rapi.
    - Jangan mengganti perilaku ini menjadi `location.reload()` biasa, karena reload biasa tidak menjamin melewati cache di semua browser.

13. **Baris Kosong Inline (`Data_Warga` & `Iuran_Kas`):**
    - Tabel `Data_Warga` & `Iuran_Kas` selalu menampilkan satu **baris kosong** di bagian atas untuk input langsung tanpa membuka modal.
    - Nilai disimpan di `draftWarga` / `draftKas`; `saveDraftWarga()` / `saveDraftKas()` menambah record, `clearDraftWarga()` / `clearDraftKas()` membersihkan baris.
    - Kolom tanggal inline memakai format `dd-mm-yyyy` dan dikonversi ke ISO saat disimpan.
    - Field **Nama Warga** pada Kas memakai `<datalist id="warga-nama-list">` yang diisi dari `Data_Warga` (`renderWargaNameList()`).

---

## 📂 File Reference

| File | Deskripsi |
|------|-----------|
| `config.js` | Konfigurasi identitas RT terpusat (`RT_CONFIG`) untuk `index.html` & `public.html` |
| `index.html` | Frontend SPA admin |
| `public.html` | Portal publik warga (memakai `action=readPublic`) |
| `Apps Script/code.gs` | Backend Apps Script (doGet + doPost + token auth) |
| `Apps Script/readme.md` | Dokumentasi lengkap API & Deployment |
| `readme.md` | Dokumentasi proyek utama |
| `agents.md` | Dokumen ini (pedoman untuk AI Agent) |

---

## 🔧 Recent Changes (2026-10-06)

- ✅ **Pengajuan Surat — kartu collapsible di portal publik** — dua kartu **Ajukan Surat Baru** & **Cek Status Pengajuan** di `public.html` kini dapat dibuka/ditutup dengan mengeklik header-nya. Header jadi `<button>` (`#surat-toggle-ajukan`, `#surat-toggle-cek`) dengan `aria-expanded`/`aria-controls`; isi dibungkus panel `#surat-panel-ajukan` / `#surat-panel-cek`; chevron (`#surat-chevron-*`) berputar (`rotate-180`) saat tertutup. Fungsi baru `toggleSuratCard(which)` + `isSuratCardCollapsed(which)`; default terbuka. Berkas uji: `/tmp/opencode/test_surat_collapse.js` (23/23).
- ✅ **Pengajuan Surat — panel admin (v9, fase 4)** — `index.html`: menu sidebar & mobile **Pengajuan Surat** (ikon `fa-envelope-open-text`) + `section#panel-surat`, `modal-surat`, `form-surat`. Tabel (terbaru di atas) menampilkan Tanggal (`fmtTimestamp` → `dd-Mmm-yyyy HH:mm`), Nama, NIK tersamar (`maskNik`, mis. `3173••••••01`), No. HP, Jenis Surat, Keperluan, badge status (`suratStatusBadge`), dan aksi. Fitur: tombol **Catat Pengajuan** (`openAddSurat`), klik baris/ikon pensil untuk **edit** (`editSurat`/`submitSurat`), **ubah status cepat** (`cycleSuratStatus`), **hapus** (`deleteSurat`), **filter status** + **pencarian**, dan kartu ringkasan jumlah per status. State `appState.surat`, `editMode.surat`, `localDeletes.surat` (`rt_surat`); dropdown Jenis & Status diisi `initSuratForm()` dari `RT_CONFIG` setelah config siap; tulis ke Sheets lewat jalur token-gated `action=add/update` + `deleteRecord`. `applySheetsData` memetakan `Pengajuan_Surat` (Timestamp kolom A kini diformat `yyyy-MM-dd HH:mm` oleh `readAllSheets`). Berkas uji: `/tmp/opencode/test_surat_admin.js` (41/41).
- ✅ **Pengajuan Surat — UI portal publik + cek status (v9, fase 3)** — section **Layanan Surat** baru di `public.html`: form **Ajukan Surat Baru** (Nama, NIK 16 digit, No. HP, Alamat, Jenis Surat dari `RT_CONFIG.jenisSurat`, Keperluan + honeypot `#surat-website`) yang mengirim `submitSurat` via `fetch` **no-cors** `text/plain`, lalu menampilkan **nomor pengajuan** `SRT-yyMMdd-XXXX` (dibuat `makeSuratRef`); panel **Cek Status Pengajuan** (NIK + No. HP) via JSONP `action=checkSurat`, menampilkan badge status + catatan dengan **`escapeHtml`** (anti-XSS). Endpoint publik baru `handleCheckSurat(params)` di `doGet` (cocokkan NIK+HP, hanya kembalikan `{ref, tanggal, jenisSurat, status, catatan}`) + rate limit `checkAndRecordSuratCheckRate` (Script Property `SURAT_CHECK_RATE`, ≤30/jam per NIK+HP, ≤300/jam global). Section disembunyikan saat Portal OFF / config belum diisi (`hideSuratSection`). Berkas uji: `/tmp/opencode/test_pengajuan_check.js` (18/18) & `/tmp/opencode/test_pengajuan_public.js` (40/40).
- ✅ **Pengajuan Surat — intake publik (v9, fase 2)** — aksi POST baru `submitSurat` ditangani **sebelum** gerbang token (`doPost`, kode publik tanpa token). `handleSubmitSurat()`: hormati gate Portal Publik, honeypot field `website` (pura-pura sukses tanpa menyimpan), validasi `nama` (≥3), `nik` 16 digit, `noHp` digit (9–15), `alamat`/`jenisSurat`/`keperluan` wajib, **rate limit** Script Property `SURAT_RATE` (≤5/jam per NIK, ≤60/jam global), **paksa `Status="Pending"`** + `Catatan` kosong + Timestamp server, pakai `ref` warga bila aman & unik atau generate `SRT-yyMMdd-XXXX`, lalu `notifyAdminNewSurat()` mengirim email ke Script Property `ADMIN_EMAIL` (gagal email tidak membatalkan simpan). Helper baru: `handleSubmitSurat`, `checkAndRecordSuratRate`, `notifyAdminNewSurat`, `cleanStr`, `suratError`, `sanitizeSuratRef`, `randomCode4`. Berkas uji: `/tmp/opencode/test_pengajuan_submit.js` (40/40).
- ✅ **Fondasi fitur Pengajuan Surat (v9)** — skema tab baru `Pengajuan_Surat` (10 kolom: `Timestamp, Nama Lengkap Pemohon, NIK, No. HP / WhatsApp, Alamat / No. Rumah, Jenis Surat, Keperluan / Alasan Pengajuan, Status Pengurusan, Catatan Pengurus, ID`) ditambahkan ke `EXPECTED_FIELDS` (=9), `DESIRED_HEADERS`, `readAllSheets` (+key `Pengajuan_Surat`), `buildRowData` (Status default `Pending`, Catatan opsional), dan `formats`. Helper baru `getOrCreateSheet(ss, name)` **membuat tab + header otomatis** bila belum ada (dipakai `readAllSheets` & `doPost`). `readPublicSheets` tetap **tidak** menyertakan `Pengajuan_Surat` (data privat). `config.js` → `version:'4'` dengan daftar `jenisSurat` & `statusSurat`; `EXPECTED_CONFIG_VERSION='4'` di `index.html` & `public.html`; `CODE_VERSION` & `EXPECTED_BACKEND_VERSION` → `publik-v9-2026-10-06`. Berkas uji: `/tmp/opencode/test_pengajuan_foundation.js` (23/23).- ✅ **Filter periode Iuran & Kas** — panel Iuran & Kas kini punya pemilih tampilan **Per Bulan / Per Tanggal / Semua Data** (default **Per Bulan** = bulan berjalan). Kontrol `#kas-view-mode` + input `#kas-view-month` (type month) / `#kas-view-date` (type date) + label `#kas-period-label`. State `kasView` dipersist di `localStorage` (`rt_kas_view_mode`, `rt_kas_view_month`, `rt_kas_view_date`); helper `initKasView`, `onKasViewModeChange`, `onKasViewPeriodChange`, `kasMatchesPeriod`, `kasPeriodLabel`. `renderKasTable()` memfilter daftar **dan** menghitung kartu ringkasan (Total Pemasukan/Pengeluaran/Saldo Akhir) mengikuti periode terpilih; pencarian tetap menyaring di dalam periode. Pesan kosong kontekstual. Berkas uji: `/tmp/opencode/test_kas_view.js` (24/24).
- ✅ **Skema `Data_Warga` diperluas (v8)** — 5 kolom baru: `Nomor KK`, `Status`, `Jenis Kelamin`, `Pendidikan`, `Pekerjaan`. Urutan final: `Timestamp, Nomor KK, Nama Lengkap, Status, Jenis Kelamin, NIK, Tempat Lahir, Tanggal Lahir, Pendidikan, Pekerjaan, No HP, Status Tempat Tinggal, Alamat/No Rumah, ID`. `EXPECTED_FIELDS.Data_Warga = 13`, `DESIRED_HEADERS.Data_Warga` diperbarui, `formats.Data_Warga = {7:"yyyy-MM-dd"}` (Tanggal Lahir kini di kolom ke-8/0-based 7).
- ✅ **Migrasi berbasis nama header** — `migrateDataWargaLayout()` diubah dari `insertColumnsBefore(4,2)` (posisional) menjadi pemetaan **berdasarkan nama header**: bangun peta `nama → indeks kolom` lama, susun ulang baris mengikuti header baru, kolom baru diisi kosong, lalu `clearContents()` + tulis ulang. Aman & idempoten untuk berbagai layout lama.
- ✅ **Frontend `index.html`** — tabel 14 kolom, modal & baris kosong inline memakai field baru (`warga-nomorkk`, `warga-statuskeluarga`, `warga-jeniskelamin`, `warga-pendidikan`, `warga-pekerjaan`); konstanta `WARGA_STATUS_KK`, `WARGA_JENIS_KELAMIN`, helper `selectOptions(list, selected)`; `applySheetsData` memetakan indeks baru; `submitWarga`/`saveDraftWarga`/`editWarga`/`deleteWarga` disesuaikan; `EXPECTED_BACKEND_VERSION = 'publik-v8-2026-10-06'`.
- ✅ **`CODE_VERSION`** di `code.gs` = `publik-v8-2026-10-06` (wajib redeploy sebagai **New version**, lalu klik **Cek Versi Backend**).
- ✅ **Perbaikan scroll modal** — container modal `index.html` (keempat modal) diubah ke `items-start ... overflow-y-auto` + panel `my-auto max-h-[calc(100vh-2rem)] overflow-y-auto`, sehingga form tinggi (Warga setelah penambahan field) bisa di-scroll di dalam modal dan tidak lagi menggeser halaman di belakang / terpotong di atas.
- ✅ **Quick edit + zebra baris** — baris `Data_Warga` & `Iuran_Kas` kini bisa diklik/di-tap langsung untuk membuka modal edit (`tr.onclick = () => editWarga/editKas(originalIndex)`, `cursor-pointer`); tombol Edit/Hapus memakai `event.stopPropagation()` agar tidak memicu edit baris. Baris diberi warna selang-seling **putih / hijau** (`bg-white` / `bg-emerald-50`, hover `bg-emerald-100`) untuk keterbacaan.
- ✅ **Kontrol akses admin (Cloudflare Zero Trust / Access)** — halaman admin (`/` & `/index.html`) diproteksi login Cloudflare Access (allowlist email); portal publik di `/public` + aset `/config.js` & `/rt-icon.png` dibuka via aplikasi **Bypass** (`Everyone`). GitHub Pages dimatikan agar admin tidak bocor lewat `saladimu.github.io`. Panduan lengkap (setup + cara menambah/mencabut pengguna) ada di `readme.md` bagian **Publikasi & Kontrol Akses**.

## 🔧 Recent Changes (2026-10-05)

- ✅ **Token admin (`ADMIN_TOKEN`)** — proteksi server-side untuk semua operasi tulis & baca lengkap (`isAuthorized`, `safeEqual`, `unauthorized`)
- ✅ **Endpoint `readPublic`** — portal publik hanya menerima Pengumuman & Kegiatan `Publik=Ya`; `Data_Warga`/`Iuran_Kas` tidak lagi terkirim keluar
- ✅ **Frontend token** — input Token Admin di panel Integrasi, `saveAdminToken()`, simpan di `localStorage` `rt_admin_token`, `promptForAdminToken()` saat `code:"unauthorized"`
- ✅ `index.html` `EXPECTED_BACKEND_VERSION` = `publik-v7-2026-10-05`; `CODE_VERSION` di `code.gs` disamakan
- ✅ **ON/OFF Portal Publik (backend-enforced)** — toggle di tab Portal Publik, aksi `setPortalStatus`, flag `PUBLIC_PORTAL_ENABLED` di Script Properties; saat OFF `readPublic` mengembalikan `code:"portal_disabled"` dan `public.html` menampilkan pesan non-aktif; respons `read` menyertakan `portalEnabled`; tombol **Buka Portal** difokuskan ke tautan aktif
- ✅ **Tombol "Muat Ulang" di `public.html`** — `refreshPublicData()` + `loadPublicData(onComplete)`; fungsi `showLoadError()` yang sebelumnya hilang kini ditambahkan
- ✅ **Kolom baru `Data_Warga`**: `Tempat Lahir` + `Tanggal Lahir` (setelah `NIK`); `migrateDataWargaLayout()` menyisipkan otomatis 2 kolom (`insertColumnsBefore(4,2)`) untuk sheet lama, `EXPECTED_FIELDS.Data_Warga = 8`, payload `tempat`/`tanggalLahir`, tabel & form warga diperbarui
- ✅ Perbaikan bug: blok mapping duplikat di `applySheetsData()` dihapus (mengakibatkan `_id` salah & tanggal edit kosong)
- ✅ Perbaikan bug: tanggal di kartu Pengumuman/Kegiatan admin kini diformat `dd-Mmm-yyyy` lewat `fmtDateDisplay()` (sebelumnya menampilkan `yyyy-MM-dd` mentah); diterapkan juga ke widget dashboard & tabel Kas
- ✅ `public.html` disederhanakan: fitur "Atur URL" (input manual + fallback `localStorage` `rt_public_webapp_url`) dihapus; URL hanya dari `?url=`
- ✅ **Parameterisasi identitas RT** lewat `config.js` (`RT_CONFIG`) + helper `window.RT.apply()`; teks di `index.html`/`public.html` memakai atribut `data-rt` / `data-rt-placeholder`
- ✅ **Hard refresh tombol "Muat Ulang"** di menu utama `index.html` — `refreshData()` menambahkan `?_rtcache=<ts>` lalu `location.replace()`, sehingga HTML & `config.js` terbaru diambil ulang (melewati cache) dan data ikut tersinkron saat `onload`; `_rtcache` dibersihkan via `history.replaceState()`
- ✅ **`config.js` cache-busting** — dimuat via `config.js?v=<timestamp>` di kedua halaman; fallback `data-rt` di HTML diperbarui ke nilai saat ini; `appName` double-space diperbaiki
- ✅ **Favicon & logo `rt-icon.png`** — dipasang sebagai `rel="icon"` / `apple-touch-icon` dan sebagai logo header (desktop/mobile admin & portal publik)
- ✅ **Format tanggal global `dd-mm-yyyy`** untuk semua input add/edit (Warga, Kas, Pengumuman, Kegiatan) memakai text field bermasker (`maskDateField`, `ddmmyyyyToISO`, `isoToDDMMYYYY`, `setDateInput`, `readDateInput`); nilai kanonik tetap `yyyy-MM-dd`
- ✅ **Baris kosong inline** di tabel `Data_Warga` & `Iuran_Kas` untuk input langsung tanpa modal (`saveDraftWarga`/`saveDraftKas`, `clearDraftWarga`/`clearDraftKas`); nilai bertahan saat tabel di-render ulang
- ✅ **Datalist Nama Warga** (`warga-nama-list`) pada input Kas (modal & inline) diisi dari `Data_Warga` via `renderWargaNameList()`
- ✅ **Perbaikan bug pencarian (`Data_Warga` & `Iuran_Kas`)** — filter kini menormalkan semua field ke string (`v == null ? '' : String(v)`) sebelum `indexOf`, sehingga sel kosong (`null`/`undefined`) tidak lagi memicu `TypeError` yang menghentikan render (gejala: pencarian seolah tidak berfungsi)
- ✅ **Kolom `Usia` di tabel `Data_Warga`** — ditampilkan setelah `Nama Lengkap`, dihitung dari `Tanggal Lahir` via `hitungUsia()` (tahun penuh, format `X th`). **Tidak disimpan** ke `appState`/Sheets; baris kosong inline memperbarui usia secara live saat tanggal diisi.
- ✅ **Portal Publik tanpa URL panjang (config-based)** — `RT_CONFIG.publicApiUrl` di `config.js`; `public.html` memakai URL itu (fallback `?url=` tetap didukung); tautan admin cukup `public.html` via `getPublicPortalUrl()`; init `public.html` menunggu config siap (`window.RT_CONFIG_READY` + `whenConfigReady`) sehingga tidak ada race async/kedipan "belum dikonfigurasi"; tombol **Muat Ulang** `public.html` kini hard refresh (`?_rtcache`) dan `_rtcache` dibersihkan via `history.replaceState()`. Toggle Portal Publik tetap ditegakkan server-side.
- ✅ **Gerbang versi config (auto hard refresh)** — `RT_CONFIG.version` di `config.js` dibandingkan dengan `EXPECTED_CONFIG_VERSION` di `index.html` & `public.html` via `enforceConfigVersion()`. Bila berbeda (HTML lama ter-cache), halaman auto hard refresh sekali (`?_rtcache`) agar HTML & config sinkron; guard `sessionStorage` `rt_cfg_reload_<versi>` mencegah loop. Fungsi `hardReload()` dipakai ulang oleh tombol "Muat Ulang" kedua halaman.
- ✅ **Domain kustom Portal Publik** — `RT_CONFIG.publicPortalUrl` di `config.js` (mis. `https://rt017.pages.dev/`) membuat tautan & tombol "Buka Portal" di menu admin memakai domain itu; `getPublicPortalUrl()` memprioritaskan `publicPortalUrl` → lalu `public.html` (bila `publicApiUrl` terisi) → lalu `public.html?url=...`.
- ✅ **Tema terang/gelap di `public.html`** — tombol ikon matahari/bulan di header, `applyTheme()`/`toggleTheme()` men-toggle `dark` pada `<html>` (Tailwind `darkMode: 'class'`), persist di `localStorage` `rt_theme`, default `prefers-color-scheme`, plus skrip anti-FOUC; seluruh kartu, badge, empty-state, alert, dan footer memakai varian `dark:`.

## 🔧 Recent Changes (2026-10-03)

- ✅ **Edit buttons** ditambahkan ke semua 4 modul (Warga, Kas, Pengumuman, Kegiatan)
- ✅ **Delete sync to Google Sheets** — urutan operasi dibalik: Sheets dulu, baru local
- ✅ **Delete persistence** — tracking by content signature mencegah record muncul kembali
- ✅ **Warga delete warning** — dialog detail menampilkan Nama, NIK, No. HP
- ✅ **Refresh button** — tombol 🔄 di header desktop & mobile
- ✅ **JSONP delete handler** — `doGet` sekarang support `action=delete` dengan callback
- ✅ **Public Portal** — halaman publik `public.html` untuk warga (hanya Pengumuman & Kegiatan)
  - Data diambil langsung dari Google Sheets via JSONP
  - Tanggal & waktu sudah diformat oleh Apps Script menggunakan timezone spreadsheet (GMT+7)
  - Frontend hanya melakukan reformat: "yyyy-MM-dd" → "dd-Mmm-YYYY", "HH:mm" → "HH:MM am/pm"
  - **Tidak ada konversi timezone tambahan di frontend** — data sudah benar dari sumber
  - Format konsisten di semua halaman: `index.html` dan `public.html` menampilkan tanggal yang sama

---

## 🌍 Rule: Timezone GMT+7 (Asia/Jakarta)

### Sumber Data
Google Sheets menyimpan dan memformat semua tanggal/waktu menggunakan timezone **GMT+7 (Asia/Jakarta)**.

### Alur Data
```
Google Sheets (GMT+7)
        │
        ▼
Apps Script (code.gs)
  - Utilities.formatDate(cell, tz, format) menggunakan spreadsheet timezone
  - Mengirim STRING terformat: "yyyy-MM-dd" dan "HH:mm"
        │
        ▼
Frontend (index.html, public.html)
  - fmtDate() / formatDateDDMMMYYYY(): reformat STRING, TIDAK konversi timezone
  - fmtDateDisplay() (admin): "yyyy-MM-dd" -> "dd-Mmm-yyyy" untuk tampilan kartu/tabel
  - fmtTime() / formatTimeOnly(): reformat STRING, TIDAK konversi timezone
```

### Fungsi Format (Frontend)
| Fungsi | File | Input | Output |
|--------|------|-------|--------|
| `fmtDate(v)` | index.html | `"2026-10-03"` | `"2026-10-03"` (untuk `<input type="date">`) |
| `fmtDateDisplay(v)` | index.html | `"2026-10-03"` | `"03-Okt-2026"` (tampilan kartu/tabel) |
| `fmtTime(v)` | index.html | `"07:00"` | `"07:00"` |
| `formatDateDDMMMYYYY(v)` | public.html | `"2026-10-03"` | `"03-Okt-2026"` |
| `formatTimeOnly(v)` | public.html | `"07:00"` | `"07:00 am"` |

> **Penting:** nilai mentah `item.tanggal` (format `yyyy-MM-dd`) HANYA dipakai untuk prefill `<input type="date">` (form edit). Semua **tampilan** tanggal harus melewati `fmtDateDisplay()` (admin) / `formatDateDDMMMYYYY()` (publik), yang memakai singkatan bulan Indonesia (`Okt`, bukan `Oct`).

### Larangan
❌ **JANGAN** lakukan konversi timezone di frontend
❌ **JANGAN** parse string sebagai Date object untuk dikonversi
❌ **JANGAN** gunakan `new Date()`, `getHours()`, `getTimezoneOffset()`, dll
✅ **HANYA** lakukan reformat string yang sudah benar dari Apps Script

### Troubleshooting Tanggal Salah
Jika tanggal显示 salah (misal: source "2026-10-02" tapi display "2026-10-01"):
1. Buka browser console (F12)
2. Look for log: `=== RAW DATA FROM SHEETS ===`
3. Check `tanggal raw value` - should be string "2026-10-02"
4. If it's a Date object or ISO string, there's a serialization issue in Apps Script
5. Check `tanggal formatted` output to see what the formatter returns
