# 🤖 Agents & System Instructions - SAPA RT (RT Tanjung Duren Utara)

Dokumen ini berisi arsitektur sistem, aturan integrasi data, serta petunjuk teknis bagi pengembang atau AI Agent yang bertugas memelihara, memodifikasi, atau memperluas fungsionalitas aplikasi ini.

---

## 🏗️ System Architecture Overview

- **Frontend Architecture:** Dua halaman HTML5 statis:
  - `index.html` — SPA admin (semua modul + integrasi), Tailwind CSS statis (`tailwind.css`) + FontAwesome CDN.
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
    appName: 'SAPA RT',
    appLongName: 'Sistem Administrasi & Pelayanan Antarwarga',
    rt: '017',
    rw: '06',
    kelurahan: 'Tanjung Duren Utara',
    kecamatan: 'Grogol Petamburan',
    kota: 'Jakarta Barat',
    provinsi: 'DKI Jakarta',
    alamatrt: 'Lontar Barat',
    tahun: new Date().getFullYear(),
    alamatContoh: 'Jl. Lontar Barat No. 06',
    lokasiContoh: 'Depan lapangan'
};
```

- `index.html` & `public.html` memuat `<script src="config.js"></script>`; helper `window.RT.apply()` mengisi elemen ber-atribut `data-rt="<key>"` dan `data-rt-placeholder="<key>"`.
- Teks di dalam HTML tetap ada sebagai **fallback** (bila `config.js` gagal dimuat), lalu ditimpa oleh JS saat halaman dimuat.
- Derived values (mis. `appNameRt`, `appLongName`, `headerName`, `footerAdmin`, `titlePublic`, `wilayah`) dibentuk otomatis dari field dasar; mengubah `rt`/`rw`/`kelurahan`/`kecamatan`/`tahun` cukup di satu tempat.
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
    - *App build (HTML):* Setiap deploy yang mengubah `index.html`/`public.html` (walau `config.js` tidak berubah) wajib menaikkan konstanta **`APP_BUILD`** pada file HTML yang berubah (bump hanya file yang diubah agar halaman lain tidak dinotifikasi palsu). `checkForUpdate()` memeriksa **dua sinyal** — versi `config.js` **dan** `APP_BUILD` di server (`fetch(location.pathname + '?_rtcache=...')`) — sehingga perubahan HTML saja tetap memunculkan penanda "Muat Ulang" bagi pengguna yang membuka halaman lama. `startUpdateWatcher()` menjalankannya segera saat mulai, tiap 60 dtk, dan saat tab kembali terlihat. Di `public.html` penanda hanya **berkedip** (label "Versi Baru") tanpa auto-reload agar tidak mengganggu form warga.
    - *App version (footer):* `RT_CONFIG.appVersion` (mis. `'v1.0.0'`) adalah **label rilis untuk manusia** yang tampil di teks footer copyright (`footerAdmin`/`footerPublic`). Berbeda dari `version` (sinkronisasi config → hard refresh) dan `APP_BUILD` (penanda update HTML). Naikkan saat ada rilis penting (tidak wajib tiap deploy). Tiap halaman juga memanggil `decorateFooterBuildInfo()` (saat load) untuk memasang **tooltip** berisi detail build (`Build <APP_BUILD> · config v<version> · backend <CODE_VERSION>` di `index.html`; tanpa backend di `public.html`).

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

13. **Pencarian & Filter (`Data_Warga` & `Iuran_Kas`):**
    - Tabel `Data_Warga` memakai **kotak pencarian atas** (`search-warga`) + **filter status tempat tinggal** (`filter-status-warga`); baris filter per kolom **dihapus** untuk Warga. Haystack pencarian mencakup seluruh field + `hitungUsia()` + `fmtDateDisplay()`, sehingga nama/NIK/HP/tempat/tanggal/usia/status/pendidikan/pekerjaan/alamat dapat dicari dari satu kotak. Helper `WARGA_FILTER_IDS` & `clearWargaFilters()` sudah dibuang.
    - Tabel `Iuran_Kas` tetap memakai satu **baris filter per kolom** tepat di bawah header. Setiap kolom punya `<input>` id `fw-kas-*` dengan `oninput="renderKasTable()"`. Penyaringan memakai helper `filterValue(id)` + `matchFilter(value, needle)` (substring, case-insensitive), digabung AND dan menyatu dengan kotak pencarian toolbar (`search-kas`) serta periode kas.
    - Kolom **Tanggal** dicocokkan terhadap nilai ISO maupun tampilan (`dd-Mmm-yyyy`); kolom **Jumlah** terhadap angka mentah maupun `formatRupiah()`.
    - Tombol ikon corong di kolom Aksi Kas memanggil `clearKasFilters()` (mengosongkan seluruh filter kolom **dan** toolbar lalu render ulang).
    - Tabel `Data_Warga` memakai **kolom bertumpuk** (8 kolom): `No. KK` | `Nama Lengkap / Usia` | `NIK / No. HP` | `Tempat / Tgl Lahir` | `Status / Jenis Kelamin` | `Pendidikan / Pekerjaan` | `Status Tinggal / Alamat` | `Aksi`. Empty-state `colspan="8"`.
    - **Jumlah record ditemukan** ditampilkan di samping header **No. KK** (`<span id="warga-count">`) dalam tanda kurung, mis. `No. KK (12)`; nilainya = `filtered.length` dan di-set di `renderWargaTable()` (termasuk saat 0).
    - Menambah data kini **hanya** lewat modal `Tambah Data Warga` / `Catat Transaksi Kas`. Field **Nama Warga** pada modal Kas tetap memakai `<datalist id="warga-nama-list">` dari `Data_Warga` (`renderWargaNameList()`).
    - Berkas uji: `/tmp/opencode/test_column_filter.js`; guard penghapusan fitur lama di `/tmp/opencode/test_inline_draft.js`.

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

## 🔧 Recent Changes (2026-10-09)

- ✅ **Masking & kunci No. HP pada form surat publik (bila NIK terdaftar)** — saat `lookupWarga` mengembalikan `found:true` dengan No. HP terdaftar, `public.html` kini **menyamar** nomor itu (format **`0812••••7890`**: 4 digit depan + 4 digit belakang, tengah jadi `•`) dan membuat kolom `#surat-hp` **hanya-baca** (`readonly` + kelas `cursor-not-allowed`/`bg-slate-100`/`dark:bg-slate-800`), dengan catatan `#surat-hp-note` *"Nomor HP dari data warga (tidak dapat diubah)…"*. **Nilai asli disimpan** (`suratHpFull`) dan dipakai saat submit (`submitSuratWarga` memakai `suratHpFull` bila `suratHpLocked`), sehingga nomor lengkap tak tampil di layar tetapi tetap terkirim benar. Bila NIK **tidak terdaftar**/error/NIK tidak valid/No. HP kosong, kolom **dibuka & dikosongkan** (`unlockSuratHp`, `releaseSuratHpIfLocked` — hanya melepas bila sedang terkunci, agar isian manual warga tak terhapus). Helper baru: `maskPhone()`, `lockSuratHp()`, `unlockSuratHp()`, `releaseSuratHpIfLocked()`, `setSuratHpNote()`. Kelas Tailwind baru → `tailwind.css` dibangun ulang. `APP_BUILD` public → `2026-10-09-11` (+ `version.json`). Uji `test_public_surat_lookup.js` diperluas (**38**: unit `maskPhone` + lock/unlock/reveal). Dokumentasi: `readme.md`.

- ✅ **Form surat publik terhubung ke Data Warga (NIK di urutan pertama + isi otomatis)** — kolom **NIK (16 digit)** dipindah ke **paling atas** form **Ajukan Surat Baru** di `public.html`. Begitu NIK 16 digit & valid, frontend memanggil aksi publik baru **`action=lookupWarga&nik=...`** (JSONP via `loadApiJsonp`, debounce 500 ms, guard urutan `wargaLookupSeq`): bila **ketemu** → `handleLookupWarga` mengembalikan `{found:true, nama, noHp, alamat}` (hanya 3 field itu; **bukan** seluruh Data_Warga) lalu frontend **mengisi otomatis Nama/No. HP/Alamat** (`fillSuratFromWarga`) + pesan hijau *"Data warga ditemukan: <nama>"*; bila **tidak terdaftar** → `{found:false}` + pesan kuning *"NIK tidak terdaftar dalam data warga. Anda tetap dapat mengisi data di bawah secara manual."* dan form **tetap aktif** (bisa diisi manual & dikirim). Backend: helper `handleLookupWarga()` + rate-limit `checkAndRecordWargaLookupRate()` (prop `WARGA_LOOKUP_RATE`; ≤ 20/NIK & ≤ 200 global per jam, jendela `SURAT_RATE_WINDOW_MS`), konstanta indeks `WARGA_COL_NAMA/NIK/HP/ALAMAT` (2/5/10/12), gate `isPortalEnabled()`. State/cleanup helper: `scheduleWargaLookup`, `lookupWargaByNik`, `fillSuratFromWarga`, `setSuratNikLookup` (elemen baru `#surat-nik-lookup`); pesan lookup dibersihkan saat submit sukses. **Cek Status tetap butuh NIK + No. HP** (tidak ikut autofill — menjaga kontrol keamanan). `CODE_VERSION` & `EXPECTED_BACKEND_VERSION` → **`publik-v15-2026-10-11`** (perlu redeploy **New version**); `APP_BUILD` public → `2026-10-09-10`, index → `2026-10-09-13` (+ `version.json`). Uji baru **`test_warga_lookup.js`** (16) & **`test_public_surat_lookup.js`** (25); `test_codegs_read.js`/`test_id_identity.js`/`test_script_url.js` disesuaikan ke v15. Dokumentasi: `readme.md` (fitur + bagian **Pengajuan Surat**), `Apps Script/readme.md` (tabel aksi + contoh `lookupWarga`).

- ✅ **Portal publik: "Terakhir diperbarui" kini dari tanggal terbaru Pengumuman & Kegiatan Warga** — `public.html` sebelumnya menampilkan **waktu perangkat pengunjung** (`new Date()` di `updateLastUpdated()`), sehingga tidak mencerminkan data. Kini `updateLastUpdated(pengumuman, kegiatan)` mengambil **tanggal ISO paling baru** dari kedua daftar (Pengumuman + Agenda Kegiatan Warga yang lolos filter publik) dan menampilkannya sebagai `dd-Mmm-yyyy`; bila tidak ada data valid → `-`. Nilai non-`yyyy-MM-dd` diabaikan. Panggilan berbasis jam perangkat saat init dihapus; nilai di-set setelah `readPublic` sukses (di `loadPublicData` `onSuccess`). `APP_BUILD` public → `2026-10-09-9` (+ `version.json`). Uji baru **`test_public_last_updated.js`** (7); suite hijau (44).

- ✅ **Header portal publik (mobile): judul di baris penuh, tombol/ikon di bawahnya** — pada `public.html`, kontainer header diubah dari `flex items-center justify-between` menjadi **`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`**, sehingga di layar kecil blok judul (**Portal Publik** + **Sistem Administrasi & Pelayanan Antarwarga**, plus logo) mengambil **satu baris penuh**, sedangkan deretan tombol ikon (Tentang, Siaga, Tema, Install, Muat Ulang) turun ke **baris berikutnya** (`flex items-center gap-2 flex-wrap`). Di layar ≥`sm` tata letak kembali berdampingan (judul kiri, tombol kanan). Ditambah `min-w-0` agar teks judul boleh menyusut rapi. Kelas Tailwind baru → `tailwind.css` dibangun ulang. `APP_BUILD` public → `2026-10-09-8` (+ `version.json`).

- ✅ **Optimasi jaringan (payload lebih ringan + pemeriksaan update hemat kuota)** — (1) Ikon **WhatsApp** pada tombol "Chat WhatsApp" (`index.html`) diganti **SVG inline**, sehingga `fa-brands-400.woff2` (~108 KB) tidak lagi diunduh untuk satu ikon. (2) Sinyal build HTML untuk deteksi update kini dibaca dari berkas kecil **`version.json`** (`{"index":"...","public":"..."}`) memakai `fetch('version.json', {cache:'no-cache'})` — bukan lagi mengunduh seluruh `index.html` tiap 60 dtk; `config.js` juga memakai `cache:'no-cache'` (ETag → **304 tanpa body** bila tak berubah). `hardReload()`/`_rtcache` tetap untuk hard refresh. (3) Berkas baru **`_headers`** (Cloudflare Pages): cache 7 hari untuk ikon ber-cache-buster (`rt-icon.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon.ico`) dan `must-revalidate` untuk `/config.js`, `/version.json`, `/sw.js`. (4) Ikon di-optimalkan ke palet 256 warna: `rt-icon.png` 190 KB→27 KB, `apple-touch-icon.png` 40 KB→8 KB, `icon-192.png` 44 KB→8 KB, `favicon.ico` 17 KB→8 KB (multi-ukuran 16/32/48/64). `APP_BUILD` index → `2026-10-09-12`, public → `2026-10-09-7`. **Tindak lanjut manual:** tambahkan `/version.json` ke policy **Bypass** Cloudflare Access (`RT Public Assets`) agar portal publik bisa memeriksa versi. Uji `test_update_watcher.js` disesuaikan (version.json + 304); suite hijau.

- ✅ **Gestur "Back" Android (swipe/back) kini menutup modal & kembali tab, bukan keluar aplikasi — admin & portal publik** — memakai **History API**. `index.html`: snapshot tampilan (`{rt:1, tab, modal}`) di-`pushState` setiap **pindah tab** (`switchTab`) dan **buka modal** (`openModal`, termasuk `openAbout`); `closeModal` menghapus entri modal ini (`history.back()`, hanya bila state atas cocok). Handler **`popstate`** → **`applyNavState()`** menyelaraskan tab + modal tanpa menambah entri. Urutan "Back": tutup modal teratas → kembali ke tab sebelumnya → baru keluar. Escape kini menutup **modal apa pun yang terbuka** (`getOpenModal()`), bukan hanya Tentang. `public.html`: modal **Siaga**, **Panduan Surat**, **Tentang** dilacak lewat `openPublicModalId` + `pushPublicNav()`/`applyPublicNav()` sehingga "Back" menutup modal; setup awal memakai `history.replaceState` (tanpa menambah entri). `APP_BUILD` index → `2026-10-09-11`, public → `2026-10-09-6`. Uji suite (43 file) hijau.

- ✅ **"Pasang Aplikasi" selalu tampil (tidak lagi menunggu `beforeinstallprompt`)** — tombol pasang pada grup **Setting** (sidebar + menu mobile) dan tombol **Pasang** di header portal publik kini **terlihat secara default** (kelas `hidden` dihapus); `setBtns()` tetap menyembunyikannya hanya bila aplikasi sudah terpasang (`display-mode: standalone` / `appinstalled`). `installApp()` kini menangani klik tanpa prompt secara informatif: jika sudah terpasang → "Aplikasi sudah terpasang", iOS → petunjuk Bagikan, selainnya → petunjuk menu browser. `APP_BUILD` index → `2026-10-09-10`, public → `2026-10-09-4`.

- ✅ **Menu "Setting" (grup) di sidebar admin** — item **Integrasi Google Sheets**, **Pasang Aplikasi** (PWA, tetap tersembunyi hingga installable), dan **Tentang Aplikasi** digabung ke dalam satu grup **Setting** yang dapat dibuka/tutup (`toggleSettingMenu()` + elemen `nav-setting-group`/`setting-submenu`/`nav-setting-chevron`, ikon chevron berputar `rotate-180`). Menu mobile (`mobile-menu`) juga memakai grup serupa (`toggleMobileSettingMenu()` + `mobile-setting-submenu`); label "Koneksi Google Sheets" diselaraskan menjadi "Integrasi Google Sheets". `switchTab()` tetap mengaktifkan `nav-settings` di dalam submenu. Kelas Tailwind baru → `tailwind.css` dibangun ulang. `APP_BUILD` index → `2026-10-09-9`. Uji baru **`test_setting_menu.js`** (14).

- ✅ **Dukungan PWA (pasang ke layar utama/desktop) — admin & portal publik** — berkas baru: **`manifest.webmanifest`** (admin, `start_url:/`, `scope:/`) & **`manifest-public.webmanifest`** (publik, `start_url:/public`, name "SAPA RT — Portal Publik"), **`sw.js`** (service worker pass-through: `install`/`activate` + listener `fetch` kosong agar memenuhi syarat installability tanpa caching), dan **`icon-192.png`** (192×192 dari logo). `index.html` & `public.html` menambah `<link rel="manifest">`, `theme-color` (#0f172a), `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, dan blok skrip PWA di akhir `<body>`: menangkap **`beforeinstallprompt`** (simpan `deferredPrompt`), `appinstalled`, plus **`window.installApp()`**. Tombol **Pasang Aplikasi** (`data-install-btn`, tersembunyi default) ditambah di sidebar admin + menu mobile, dan tombol **Pasang** di header portal publik; tampil otomatis saat installable, pada iOS menampilkan petunjuk **Bagikan → Tambahkan ke Layar Utama**. Service worker didaftarkan `navigator.serviceWorker.register('sw.js')`. `APP_BUILD` index → `2026-10-09-8`, public → `2026-10-09-3`. Uji baru **`test_pwa.js`** (32). Dokumentasi: `readme.md` (fitur PWA + tabel aset & daftar **Bypass Access** kini termasuk `/manifest-public.webmanifest`, `/sw.js`, `/icon-192.png`). **Tindak lanjut manual:** tambahkan ketiga path itu ke policy **Bypass** Cloudflare Access (`RT Public Assets`).

- ✅ **Ringkasan: kartu Pengumuman & Agenda Kegiatan menampilkan jumlah tampil + "(N)" disembunyikan** — `renderDashboardStats()` (index.html) kini menghitung item yang **publik** (`isPublikVal`) sebagai angka utama, lalu menambahkan `"(N)"` (font lebih kecil, abu-abu) untuk jumlah yang **disembunyikan** dari portal publik. Contoh: `5 (2)` = 5 tampil, 2 disembunyikan. `APP_BUILD` index → `2026-10-09-7`.

- ✅ **Ikon aplikasi baru (SAPA RT)** — `rt-icon.png` (512×512), `apple-touch-icon.png` (180×180), dan `favicon.ico` (multi-ukuran 16/32/48/64) diganti dari logo SAPA RT terbaru. `index.html` & `public.html` menambahkan cache-buster `?v=2` pada `<link rel="icon">`/`apple-touch-icon` agar ikon baru langsung terlihat tanpa bergantung cache browser (nama berkas tidak berubah, jadi daftar Bypass Cloudflare Access tetap sama). `APP_BUILD` index → `2026-10-09-6`, public → `2026-10-09-2`.

- ✅ **Header tabel Iuran & Kas: "Nama Warga / Keterangan" → "Nama Warga"** — kolom pertama tabel **Iuran & Kas RT** kini berjudul **Nama Warga** (sebelumnya "Nama Warga / Keterangan"). Hanya label `<th>` yang diubah (index.html), struktur data/kolom tidak berubah. `APP_BUILD` index → `2026-10-09-5`.

- ✅ **Panel Pengaturan (Integrasi Google Sheets) dialihkan ke Bahasa Inggris** — seluruh teks panel diterjemahkan: heading **Google Sheets Integration**, kartu **Active Data Source** (label **Transport** / **Web App URL** / **Backend version**), bagian **Admin Token (ADMIN_TOKEN)** + **Save Token**, tombol **Test Connection** / **Load Data from Sheets** / **Check Backend Version** / **Reset Demo Data (Local)**, kotak **Demo Mode (Offline) — without Apps Script**, dan **Google Sheets & Apps Script Setup Guide** (8 langkah). String status dinamis `updateConnectionInfo()` juga Inggris: `Proxy /api (active) · fallback: direct`, `Proxy /api (active)`, `Direct to Apps Script (active)`, `Proxy /api (fallback: direct)`, `Proxy /api`, `Direct to Apps Script`, `Not configured (local mode)`. Tab sidebar & sisa aplikasi tetap Bahasa Indonesia. `APP_BUILD` index → `2026-10-09-4`. Dokumentasi: semua nilai **Transport** dirinci di `readme.md` (tabel nilai Transport) & `Apps Script/readme.md` (bagian Proxy Same-Origin).

- ✅ **Proxy same-origin `/api` (Cloudflare Pages Function) — perbaikan permanen "Gagal memuat data / cek versi" di sebagian perangkat** — akar masalah: browser memanggil `script.google.com` secara lintas situs untuk JSONP, lalu diblokir *third-party cookie* / ITP / ekstensi adblock (Android Chrome). Solusi: file baru **`functions/api/[[path]].js`** (Pages Function `onRequest`) meneruskan `GET`/`POST`/`HEAD` ke Web App `/exec` dari sisi edge (target via env **`APPS_SCRIPT_URL`**, fallback URL default; `redirect:'follow'`; POST `text/plain;charset=utf-8`; `cache-control:no-store`; 502 `proxy_fetch_failed`). Frontend kini **proxy-first dengan fallback otomatis** ke URL langsung: ditambahkan **`getApiBase()`**, **`getDirectBase()`**, **`apiBases()`**, **`loadApiJsonp()`** (coba base berurutan saat `onerror`, timeout default 15s) di `index.html` & `public.html`; `syncFromGoogleSheets()`, `checkBackendVersion()`, `deleteRecord()`, `testAdminEmail()`, `togglePublicPortal()`, `sendToGoogleSheets()`, dan portal publik (`loadPublicData`, `cekStatusSurat`, `submitSuratWarga`) memakai jalur ini. Di Pengaturan, kolom **Web App URL** dan tombol **Simpan URL Koneksi** **dihapus**; sumber data kini murni dari **`config.js` → `publicApiUrl`** (proxy `/api` sebagai transport utama, URL langsung sebagai cadangan); ditambahkan kartu **Sumber Data Aktif** di Pengaturan (`updateConnectionInfo()` + elemen `conn-transport`/`conn-source`/`conn-backend`) yang menampilkan transport, Web App URL, dan versi backend (diisi dari `res.version` saat sinkronisasi atau tombol Cek Versi Backend). Helper `saveScriptUrl()`, `normalizeScriptUrl()`, `isValidScriptUrl()`, `resolveScriptUrl()`, `updateScriptUrlInput()`, `appState.scriptUrl`, dan `localStorage.rt_script_url` dihapus. `config.js` `version` `'8'`→`'9'`, tambah **`apiBase:'/api'`**; `EXPECTED_CONFIG_VERSION` `index.html` & `public.html` → `'9'`; `APP_BUILD` index → `2026-10-09-3`, public → `2026-10-09-1`. Uji baru **`test_proxy.js`** (23) + penyesuaian `test_script_url.js` (34), `test_pengajuan_public.js`, `test_config_gate_index.js`, `test_public_ready.js`, `test_app_version.js` (total 41 suite hijau). Dokumentasi: `readme.md` (config `apiBase`, catatan proxy, bypass Access `/api`), `Apps Script/readme.md` (bagian Proxy Same-Origin). **Tindak lanjut manual:** tambahkan `/api` ke policy **Bypass** Cloudflare Access (`RT Public Assets`) agar portal publik bisa memuat data.

- ✅ **Prefiks subjek email notifikasi `[SAPA-RT]`** — subjek **notifikasi pengajuan surat** & **email uji** kini memakai prefiks yang dapat diatur lewat Script Property **`NOTIF_SUBJECT_PREFIX`** (default **`[SAPA-RT]`**; sebelumnya hardcoded `[RT]`). Helper baru `getNotifSubjectPrefix()` + konstanta `NOTIF_SUBJECT_PREFIX_DEFAULT` di `code.gs`, dipakai di `notifyAdminNewSurat()` dan `handleSendTestEmail()`. `CODE_VERSION` & `EXPECTED_BACKEND_VERSION` → `publik-v14-2026-10-09` (perlu redeploy **New version**); `APP_BUILD` index → `2026-10-09-1`. Uji `test_send_test_email.js` diperluas (17, default + override); `test_codegs_read.js`, `test_id_identity.js`, `test_script_url.js` disesuaikan ke v14. Dokumentasi: `readme.md` & `Apps Script/readme.md` (Script Properties + tabel fungsi).


- ✅ **Diagnosa "Gagal cek versi backend": URL tanpa `/exec`** — penyebab kedua error tersebut adalah URL Web App yang tidak berakhiran **`/exec`** (mis. hanya `.../macros/s/<ID>`); request lalu dialihkan Google ke halaman login (`text/html`), sehingga `<script>` JSONP gagal (`onerror`). Ditambahkan helper **`resolveScriptUrl()`** (pakai isian kolom Pengaturan bila valid — jadi uji bisa tanpa simpan dulu — fallback ke URL tersimpan) dan validasi **`isValidScriptUrl()`** di **`checkBackendVersion()`** serta **`syncFromGoogleSheets()`**, dengan pesan jelas "URL Web App tidak valid. Pastikan ... diakhiri /exec." menggantikan "Gagal cek versi backend" yang ambigu. `APP_BUILD` index → `2026-10-08-14`. Uji `test_script_url.js` diperluas (32). Dokumentasi: `Apps Script/readme.md` tabel Troubleshooting.


- ✅ **Perbaikan URL Web App ganda di Pengaturan** — penyebab error **"Gagal cek versi backend"** ketika URL tersimpan ganda akibat paste berulang (mis. `https://script.google.https://script.google.com/macros/s/.../exec`). `saveScriptUrl()` kini memakai **`normalizeScriptUrl(raw)`** (memotong awalan ganda: ambil dari `https://` terakhir) dan **`isValidScriptUrl(url)`** (regex `https://script.google.com/macros/s/<id>/exec`); URL tidak valid **ditolak** dengan toast jelas dan tidak menimpa nilai lama, sementara URL ganda **otomatis dirapikan lalu disimpan**. `APP_BUILD` index → `2026-10-08-13`. Uji baru: `/tmp/opencode/test_script_url.js` (23). Dokumentasi: `Apps Script/readme.md` tabel Troubleshooting.


- ✅ **Pindah deployment/akun (owner/executor) Portal Publik** — `config.js` `publicApiUrl` diarahkan ke Web App baru milik **`admin.rt017@gmail.com`** (`AKfycbxpKHBNpvDvUzAlKSzRT7eI0QpRsCRN1GabW33IM5V9eKSNH5s_cBFJpqIWlGaYfyRW`). Karena `config.js` berubah, **`RT_CONFIG.version` `'7'`→`'8'`** dan **`EXPECTED_CONFIG_VERSION`** di `index.html` & `public.html` → `'8'`; `APP_BUILD` index `2026-10-08-12`, public `2026-10-08-5`. Deployment baru diverifikasi live: `action=version` → `publik-v13-2026-10-08`, `action=readPublic` → sukses (data spreadsheet yang sama, `portalEnabled:true`). **Tindak lanjut manual (di akun baru):** set Script Properties `ADMIN_TOKEN` (+ `ADMIN_EMAIL`, opsional `NOTIF_*`/`SURAT_*`), jalankan `authorizeMail()` sekali, lalu di halaman admin **Pengaturan** tempel URL Web App baru + Token Admin yang sama agar `localStorage.rt_script_url` menunjuk ke deployment baru.


- ✅ **No. Surat tampil bertumpuk di bawah Jenis Surat (tabel admin)** — pada tabel **Pengajuan Surat**, sel **Jenis Surat** kini menampilkan **No. Surat** sebagai baris kedua (ikon `fa-file-signature` warna amber) bila sudah diisi (yakni saat status `Selesai`). `renderSuratTable()` mengubah sel menjadi bertumpuk: `<div>Jenis Surat</div>` + `<div>ikon + No. Surat</div>` (hanya muncul jika `item.noSurat` tidak kosong). `tailwind.css` di-rebuild (kelas `text-amber-500`/`mt-0.5`). Uji `test_surat_admin.js` diperluas (93, memverifikasi No. Surat ada di dalam sel Jenis Surat & tidak muncul untuk record tanpa No. Surat). Dokumentasi: `readme.md` bagian **Mengelola Pengajuan di Halaman Admin** (bullet No. Surat).


- ✅ **NIK & No. HP dikunci saat Edit Pengajuan Surat** — karena warga memakai **NIK + No. HP** untuk **Cek Status**, kedua kolom pada form **Edit Pengajuan Surat** kini dibuat **hanya-baca** (`readOnly`) agar nilainya tidak bisa diubah dan pencarian status tetap cocok. Helper baru **`setSuratNikHpLocked(locked)`**: mengatur `readOnly` + gaya (`bg-slate-100`, `text-slate-500`, `cursor-not-allowed`) + `title` pada `#surat-nik` & `#surat-hp`, serta menampilkan catatan `#surat-nikhp-locked-hint`. Dipanggil `true` di `editSurat()` dan `false` di `openAddSurat()` sehingga saat **Catat Pengajuan** baru kedua kolom tetap dapat diisi. `APP_BUILD` index tetap dalam batch `2026-10-08-11`. Uji `test_surat_admin.js` diperluas (89). Dokumentasi: `readme.md` bagian **Mengelola Pengajuan di Halaman Admin** (bullet Edit).


- ✅ **Tombol Chat WhatsApp / Telepon Pengajuan Surat dipindah ke form Edit** — agar seragam dengan **Data Warga**, kolom **No. HP** pada tabel Pengajuan Surat kini ditampilkan sebagai **teks biasa** (terformat 3-3-4 via `fmtPhone`), bukan tautan `wa.me`. Tombol **Chat WhatsApp** & **Telepon** baru muncul di **form edit Pengajuan Surat** (`#surat-hp-actions` / `#surat-hp-wa` / `#surat-hp-call` / `#surat-hp-hint`), **hanya saat mengedit** record (`editMode.surat !== null`), dengan tautan mengikuti nilai No. HP yang tampil. Helper baru **`updateSuratHpActions()`** (mirror `updateWargaHpActions`), dipanggil dari `openModal('modal-surat')`/`closeModal('modal-surat')` dan `oninput` pada `#surat-hp`. `APP_BUILD` index tetap dalam batch `2026-10-08-11`. Uji `test_surat_admin.js` disesuaikan (81, tabel tanpa tautan + tombol muncul di form edit); `test_phone_input.js` disesuaikan. Dokumentasi: `readme.md` bullet **Chat WhatsApp & Telepon** + bagian **Mengelola Pengajuan di Halaman Admin**.


- ✅ **Normalisasi No. HP saat Cek Status Pengajuan** — pencarian status kini menerima penulisan nomor HP dengan awalan **`0`** maupun **`62`** (`+62`, spasi, tanda hubung), sehingga warga yang mengetik `081234567890` tetap cocok dengan data yang tersimpan `6281234567890` (dan sebaliknya). Helper baru `normalizeSuratHp(value)` di `code.gs` (digit saja; awalan `0` → `62`, awalan `8` → `62`), dipakai di `handleCheckSurat()` untuk mencocokkan baris **dan** sebagai kunci rate-limit (varian `0`/`62` berbagi kuota). `CODE_VERSION` & `EXPECTED_BACKEND_VERSION` → `publik-v13-2026-10-08` (perlu redeploy **New version**); `APP_BUILD` index → `2026-10-08-11`. Uji `test_pengajuan_check.js` diperluas (31, termasuk kedua arah normalisasi + unit `normalizeSuratHp`); `test_codegs_read.js` & `test_id_identity.js` disesuaikan ke v13. Dokumentasi: `readme.md` bagian **Cek Status Pengajuan**.


- ✅ **Validasi NIK di Portal Publik** — form **Ajukan Surat Baru** (`#surat-nik`) dan **Cek Status** (`#cek-nik`) di `public.html` kini memvalidasi NIK mengikuti aturan `Data_Warga`, untuk menangkap salah ketik sebelum dikirim. Helper baru **`parseNIK(nik)`** (salinan aturan: panjang 16, jenis kelamin dari digit 7-8 `01-31`/`41-71`, bulan 1-12, dan jumlah hari per bulan — mis. 30 Feb ditolak; tahun `YY <= tahun berjalan` → `20YY` else `19YY`), **`setSuratNIKHint(hintId, msg, kind)`**, dan **`onSuratNIKInput(el, hintId)`** (input hanya angka, maks 16, memberi petunjuk real-time ``N/16 digit`` → ``NIK valid.`` atau **Harap periksa ulang NIK** bila tanggal tidak wajar). Kedua input diberi `oninput="onSuratNIKInput(...)"` + elemen petunjuk `#surat-nik-hint` / `#cek-nik-hint`; `submitSuratWarga()` & jalur cek status menolak NIK yang lolos 16 digit tetapi tanggalnya tidak wajar dengan pesan **Harap periksa ulang NIK**. `APP_BUILD` public → `2026-10-08-4` (index tidak berubah). Uji baru: `/tmp/opencode/test_public_nik_validation.js` (26). Dokumentasi: `readme.md` bagian **Portal Publik**.

- ✅ **Parameter nama pengirim & Reply-To notifikasi email** — notifikasi pengajuan surat kini memakai `buildNotifMailOptions(to, subject, body)` yang menyusun opsi `MailApp.sendEmail` dengan `name` & `replyTo`. Nilainya **terparameter lewat Script Properties** (mudah dirawat tanpa ubah kode): **`NOTIF_SENDER_NAME`** (nama pengirim/From display name, default **`Pengajuan surat`**) dan **`NOTIF_REPLY_TO`** (alamat Reply-To, default = **`ADMIN_EMAIL`**). Helper baru: `getNotifSenderName()`, `getNotifReplyTo(adminEmail)`, `buildNotifMailOptions()`, plus konstanta `NOTIF_SENDER_NAME_DEFAULT`. Dipakai di jalur **`notifyAdminNewSurat()`** (pengajuan publik) **dan** **`handleSendTestEmail()`** (tombol Tes Email Admin) agar konsisten. Alamat **From** tetap akun Google pemilik/pendeploy skrip (*Execute as: Me*); `name` hanya mengubah nama tampilan. `CODE_VERSION` & `EXPECTED_BACKEND_VERSION` → `publik-v12-2026-10-08` (perlu redeploy **New version**); `APP_BUILD` index → `2026-10-08-10`. Uji baru: `/tmp/opencode/test_notif_mail_options.js` (15); `test_codegs_read.js` & `test_id_identity.js` disesuaikan ke v12. Dokumentasi: `Apps Script/readme.md` (Script Properties + tabel fungsi), `readme.md` bagian **Notifikasi Email ke Admin** (termasuk penjelasan siapa pengirimnya).

- ✅ **Input No. HP dibatasi hanya angka** — semua kolom **No. HP / WhatsApp** kini menolak huruf/simbol dengan helper baru **`onPhoneInput(el)`** (mengambil digit via `replace(/\D/g,'')` lalu `slice(0,15)`): form **Warga** (`#warga-hp`, digabung `oninput="onPhoneInput(this); updateWargaHpActions()"`), form **Pengajuan Surat admin** (`#surat-hp`), serta Portal Publik (`#surat-hp` & `#cek-hp` di `public.html`). Semua input diberi `inputmode="numeric" maxlength="15"` agar keyboard ponsel menampilkan angka. Sebelumnya kolom hanya `type="tel"` sehingga huruf tetap bisa diketik. Karena `public.html` juga berubah, `APP_BUILD` index → `2026-10-08-9` & public → `2026-10-08-3`. Uji baru: `/tmp/opencode/test_phone_input.js` (26); `test_warga_hp_actions.js` disesuaikan (oninput gabungan). Dokumentasi: `readme.md` bullet **Input No. HP hanya angka**.

- ✅ **Format tampilan No. HP 3-3-4 pada tabel record** — No. HP di tabel **Data Warga** (`renderWargaTable`, sel `NIK / No. HP`) dan **Pengajuan Surat** (`renderSuratTable`, sel No. HP termasuk pada tautan WhatsApp-nya) kini ditampilkan berkelompok **3-3-4** agar mudah dibaca, mis. `0812345678` → `081-234-5678`; nomor lebih panjang melanjutkan grup 4 digit berikutnya (mis. 12 digit → `081-234-5678-90`), dan sisa 1 digit pada grup terakhir digabung ke grup sebelumnya agar rapi. Helper baru **`fmtPhone(noHp)`** (di dekat `waNumber`/`waLink`): hanya **TAMPILAN** — nilai tersimpan di Sheets, input form, serta tautan `waLink()`/`telLink()` tetap memakai digit asli. Nomor <7 digit ditampilkan apa adanya; kosong/null → `''`. Tidak mengubah skema backend. Uji baru: `/tmp/opencode/test_fmt_phone.js` (15). Dokumentasi: `readme.md` bullet **Format No. HP (tampilan)**.

- ✅ **Chat WhatsApp & Telepon dari No. HP (hanya saat Edit Warga)** — di form Data Warga, di bawah input `#warga-hp` kini muncul tombol **Chat WhatsApp** (`#warga-hp-wa`) & **Telepon** (`#warga-hp-call`) di dalam kontainer `#warga-hp-actions`. Sesuai permintaan, tombol **hanya aktif saat mengedit** record (`editMode.warga !== null`); saat menambah warga (`editMode.warga === null`) kontainer disembunyikan, sehingga pengurus harus membuka detail warga lebih dulu. Helper baru: **`telLink(noHp)`** (`tel:+<62...>`, memakai `waNumber()` yang sama dengan `waLink()`) dan **`updateWargaHpActions()`** (dipanggil dari `oninput` `#warga-hp`, serta dari `openModal`/`closeModal('modal-warga')`). Tautan mengikuti nilai No. HP yang sedang tampil dan dinormalisasi ke `62...`; bila nomor kosong/tidak valid saat mengedit, tombol disembunyikan dan `#warga-hp-hint` menampilkan petunjuk; saat menambah, semuanya (termasuk hint) disembunyikan. Tidak mengubah skema backend. Uji baru: `/tmp/opencode/test_warga_hp_actions.js` (29). Dokumentasi: `readme.md` bullet **Chat WhatsApp & Telepon**.

- ✅ **Tabel Data Warga jadi kolom bertumpuk + baris filter per kolom dihapus (khusus Warga)** — tabel Data Warga diringkas dari 14 menjadi **8 kolom** dengan beberapa field digabung bertumpuk: `No. KK` | `Nama Lengkap / Usia` | `NIK / No. HP` | `Tempat / Tgl Lahir` | `Status / Jenis Kelamin` | `Pendidikan / Pekerjaan` | `Status Tinggal / Alamat` | `Aksi`. Baris filter per kolom untuk Warga (`fw-warga-*`), konstanta `WARGA_FILTER_IDS`, dan fungsi `clearWargaFilters()` **dihapus**; penyaringan Warga kini lewat **kotak pencarian atas** (`search-warga`) + **filter status tempat tinggal** (`filter-status-warga`). Haystack pencarian `renderWargaTable()` diperluas mencakup semua field + `hitungUsia()` + `fmtDateDisplay()` (nama, NIK, HP, tempat, tanggal, usia, status, pendidikan, pekerjaan, alamat), dan `filterSig` disederhanakan jadi `[search, filterStatus]`. Empty-state `colspan` 14→8. Filter per kolom `Iuran_Kas` (`fw-kas-*`, `clearKasFilters()`) **tetap** berlaku. `tailwind.css` di-rebuild (kelas `mb-0.5`, `whitespace-nowrap`). `APP_BUILD` index → `2026-10-08-8`; `public.html` tidak berubah. Uji: `test_column_filter.js` ditulis ulang (49, kini menguji pencarian atas Warga + filter kolom Kas), `test_inline_draft.js` disesuaikan (19), `test_nik_parse.js` APP_BUILD disesuaikan. Dokumentasi: `readme.md` bullet Pendataan Warga + bagian **Pencarian & Filter**.

- ✅ **Perbaikan: auto-isi NIK kini mengikuti perubahan digit NIK** — sebelumnya `fillWargaFromNIK(false)` hanya menulis ke kolom yang **kosong**, sehingga setelah terisi, memperbaiki digit NIK yang salah (mis. salah hari) tidak memperbarui hasil dan justru menampilkan "Data NIK cocok dengan isian yang ada." Kini ditambahkan pelacak **`nikAuto = { jk, dob }`** + **`resetNIKAuto()`** (dipanggil saat `openModal`/`closeModal('modal-warga')`): sebuah kolom ditulis ulang bila masih kosong **atau** masih berisi nilai hasil auto-isi sebelumnya (`field.value === nikAuto.<x>`), sehingga memperbaiki digit NIK memperbarui Jenis Kelamin/Tanggal Lahir, sedangkan koreksi **manual** tidak tertimpa. Pesan hint dibedakan: field yang diisi, field yang dibiarkan karena manual, atau "Isian manual berbeda dari NIK; klik **Isi dari NIK** untuk menimpanya." Tombol **Isi dari NIK** (`force=true`) tetap menimpa paksa. `APP_BUILD` index → `2026-10-08-7`. Uji `test_nik_parse.js` diperluas (38).

- ✅ **Urutan field form Data Warga disesuaikan** — form Tambah/Edit Warga kini berurutan: **Nomor KK → Nama Lengkap → NIK → Tempat & Tanggal Lahir → Status dalam Keluarga & Jenis Kelamin → Pendidikan & Pekerjaan → No. HP → Status Tempat Tinggal → Alamat**. Blok NIK (beserta tombol **Isi dari NIK**) dipindah ke atas, tepat setelah Nama Lengkap, dan blok Tempat/Tanggal Lahir sebelum Status/Jenis Kelamin. Murni menata ulang markup (tanpa perubahan `id`/logika). `APP_BUILD` index → `2026-10-08-6`. Uji baru: `/tmp/opencode/test_warga_form_order.js` (14). Dokumentasi: `readme.md` bullet Pendataan Warga.

- ✅ **Perbaikan: modal "Tambah" menampilkan data edit terakhir** — membuka modal Tambah (`openModal`) dalam mode tambah (`editMode.<x> === null`) kini **me-reset** form terkait (`form-warga`/`form-kas`/`form-pengumuman`/`form-kegiatan`) lebih dulu, sehingga sisa isian dari sesi edit sebelumnya tidak ikut tampil (mis. lihat/edit Warga lalu Keluar, kemudian Tambah Data Warga). Saat mode edit (`editMode.<x>` terisi) form **tidak** direset agar data yang sedang diedit aman. Karena reset terjadi saat membuka, default tanggal-hari-ini (`setDateInput`) tetap diterapkan setelahnya. `APP_BUILD` index → `2026-10-08-5`. Uji baru: `/tmp/opencode/test_modal_reset.js` (10).

- ✅ **Isi otomatis Jenis Kelamin & Tanggal Lahir dari NIK (Data Warga)** — form Tambah/Edit Warga kini menurunkan **Jenis Kelamin** & **Tanggal Lahir** dari **NIK 16 digit** (`PPKKSS-DDMMYY-NNNN`). Aturan: laki-laki bila digit 7-8 = `01-31`; perempuan bila `41-71` (= `40 + tanggal`). Tahun 2 digit ditebak: `YY <= tahun berjalan` → `20YY`, selain itu → `19YY` (mencakup usia 0-99). Helper baru: **`parseNIK(nik)`** (mengembalikan `{gender, tanggalLahir}` atau `null`; memvalidasi panjang 16, rentang hari, bulan 1-12, dan jumlah hari per bulan — mis. 30 Feb ditolak), **`fillWargaFromNIK(force)`** (default hanya mengisi kolom kosong agar tidak menimpa koreksi manual; `force=true` dari tombol **Isi dari NIK**), **`onNIKInput(el)`** (input hanya angka, maks 16, auto-isi saat mencapai 16 digit), dan **`setNIKHint(msg, kind)`** (`#warga-nik-hint`). Input `#warga-nik` diberi `inputmode="numeric" maxlength="16" oninput="onNIKInput(this)"`; hint direset di `openModal`/`closeModal('modal-warga')`. Tidak mengubah skema backend (kolom sudah ada). `APP_BUILD` index → `2026-10-08-4`; `public.html` tidak berubah. Uji baru: `/tmp/opencode/test_nik_parse.js` (33). Dokumentasi: `readme.md` bagian **Isi otomatis dari NIK**.

- ✅ **Versi rilis (`appVersion`) di footer copyright** — field baru **`RT_CONFIG.appVersion`** (mis. `'v1.0.0'`) menjadi **label rilis untuk manusia** yang ditampilkan di teks footer (`copyright() + ' · ' + appVersion` untuk `footerAdmin`; `+ ' - Portal Publik · ' + appVersion` untuk `footerPublic`), plus nilai `data-rt="appVersion"`. Fallback statis footer di `index.html` (2 tempat) & `public.html` diselaraskan. Tiap halaman menambahkan `decorateFooterBuildInfo()` (dipanggil saat load) yang memasang **tooltip** detail build pada elemen footer: `Build <APP_BUILD> · config v<version> · backend <CODE_VERSION>` di `index.html`, dan tanpa backend di `public.html`. Karena `config.js` berubah, `version` dinaikkan `'6'` → `'7'` (+ `EXPECTED_CONFIG_VERSION='7'` di kedua HTML; uji gate disesuaikan). `APP_BUILD`: `index.html` → `2026-10-08-3`, `public.html` → `2026-10-08-2`. Uji baru: `/tmp/opencode/test_app_version.js` (21). Dokumentasi: `readme.md` (contoh config + catatan **Versi rilis di footer** + baris tabel checklist deploy), `agents.md` **Version Gate** (*App version*).

- ✅ **Mode Demo (Offline) diperjelas** — tombol **"Reset Semua Data"** diubah menjadi **"Reset Data Demo (Lokal)"** (dengan tooltip yang menegaskan data Google Sheets tidak terhapus), dan panel **Integrasi Google Sheets** menambahkan section info **"Mode Demo (Offline) — tanpa Apps Script"** yang menjelaskan: biarkan Web App URL kosong untuk berjalan mode lokal (data hanya di `localStorage`, tidak dikirim ke server), Portal Publik tidak menampilkan data mode lokal, klik reset untuk membersihkan setelah demo, serta data Sheets tidak pernah terhapus. Dialog konfirmasi & toast `resetAllData()` diperbarui. Dokumentasi baru: section **🎬 Mode Demo (Offline)** di `readme.md`.

- ✅ **Deteksi update dua sinyal (versi config + versi build HTML)** — sebelumnya tombol "Muat Ulang" hanya muncul bila `version` di `config.js` berubah, sehingga perubahan `index.html`/`public.html` tanpa menaikkan config tidak pernah terdeteksi. Kini ditambahkan konstanta **`APP_BUILD`** di `index.html` & `public.html`; `checkForUpdate()` memeriksa **dua sinyal** secara paralel: (1) `fetch('config.js?v=<ts>')` → bandingkan `version` dengan `currentConfigVersion()`, (2) `fetch(location.pathname + '?_rtcache=<ts>')` → bandingkan `APP_BUILD` server dengan `APP_BUILD` halaman. `startUpdateWatcher()` menjalankan cek **segera saat mulai** (bukan hanya tiap 60 dtk / saat tab kembali terlihat). `index.html`: `showUpdateAvailable()` menampilkan `#sidebar-refresh-btn` + memunculkan kedip; `public.html`: ditambahkan `startUpdateWatcher()` + `showUpdateAvailable()` yang membuat `#refresh-btn` berkedip & berlabel **"Versi Baru"** (tanpa auto-reload, agar tidak mengganggu form warga); CSS `@keyframes rt-update-flash`/`.update-flash` ditambahkan ke `public.html`. **Wajib menaikkan `APP_BUILD` pada file HTML yang berubah setiap deploy (bump hanya file yang diubah).** Uji baru: `/tmp/opencode/test_update_watcher.js` (20).

- ✅ **Paginasi & tabel lebih rapat** — Data Warga & Iuran/Kas kini dipaginasi **15 record per halaman** dengan kontrol **Sebelumnya/Berikutnya** dan indikator rentang/halaman (`renderPaginationBar()`, `gotoWargaPage()`/`gotoKasPage()`, `TABLE_PAGE_SIZE=15`); perubahan pencarian/filter/periode otomatis kembali ke halaman 1 dan halaman di luar rentang di-clamp. Padding baris dirapatkan (`p-4` → `px-3 py-2`, header `py-2.5`, badge lebih tipis). Tabel **Pengajuan Surat**: kolom **Tanggal** & **No. Pengajuan** digabung bertumpuk (header "Tanggal<br>No. Pengajuan"), **NIK** & **No. HP** digabung bertumpuk, sehingga jumlah kolom 9→7 dan **Nama Pemohon** lebih lega. `tailwind.css` di-rebuild. Uji baru: `/tmp/opencode/test_pagination.js` (21).

- ✅ **Portal publik satu domain dengan admin (`sapa-rt017.pages.dev`)** — `config.js` `publicPortalUrl` diubah ke **`https://sapa-rt017.pages.dev/public`**; wrapper/domain tambahan `rt017.pages.dev` (dan domain lama `rtlontar.pages.dev`) tidak dipakai lagi. Keamanan admin bersumber dari **Cloudflare Access** pada path `/` & `/index.html` (Allow), sedangkan `/public`, `/public.html`, `/config.js`, `/rt-icon.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css` di-bypass (Everyone) sehingga portal publik tetap terbuka di origin yang sama. `readme.md` bagian **Publikasi & Kontrol Akses** disesuaikan (hostname Access → `sapa-rt017.pages.dev`, tanpa wrapper).

- ✅ **Identitas RT/RW/alamat kini benar-benar satu file (`config.js`)** — semua teks turunan dihitung dari `rt`, `rw`, `alamatrt`, `kelurahan`, `kecamatan`, `tahun` (fungsi `rtShort()`/`rtFull()`/`wilayah()`/`copyright()`): `dashboardTitle`, `wargaTitle`, `kasTitle`, `publicSubtitle`, `titleAdmin`/`titlePublic`, `footerAdmin`/`footerPublic`. `apply()` diperluas menangani atribut baru **`data-rt-title`** (tooltip), **`data-rt-aria-label`**, dan **`data-rt-alt`** (mis. `aboutTitle`, `logoAlt`). Placeholder baru **`suratNo`** (`mis. 474/<rt>-RT/RW.<rw>/X/<tahun>`) dipakai `#surat-nosurat`. Fallback statis di `index.html`/`public.html` dinetralkan (tanpa angka RT/RW/alamat yang bisa basi) sehingga mengubah `rt`/`rw`/`alamatrt` tidak perlu menyentuh HTML. Uji baru: `/tmp/opencode/test_config_apply.js` (21, termasuk skenario ganti `rt`/`rw`/`alamatrt`/`kelurahan`/`tahun`).

- ✅ **Judul header portal publik disederhanakan** — `publicSubtitle` di `config.js` diubah dari "Portal Informasi Publik · RT 017/RW 06 · Lontar Barat" menjadi **"Portal Publik RT &lt;rt&gt;/RW &lt;rw&gt;"** (memakai `rtShort()`). Fallback statis `data-rt="publicSubtitle"` di `public.html` diselaraskan. `version` config → `'6'` (dan `EXPECTED_CONFIG_VERSION='6'` di `index.html` & `public.html`) agar HTML lama ter-refresh otomatis. Uji `test_config_gate_index.js` & `test_public_ready.js` disesuaikan (versi 6).

- ✅ **Menu "Tentang Aplikasi" (visi & misi SAPA RT)** — ikon info (`#about-btn`, `fa-circle-info`) di header sidebar desktop, item nav "Tentang Aplikasi", dan entri menu mobile, semuanya membuka modal `#modal-about` (`openAbout()`/`closeAbout()`, tutup via tombol X, klik latar, atau `Esc`). Modal menampilkan brand SAPA RT + tagline **"Melayani Warga, Menghubungkan Tetangga"**, **Visi**, dan **6 butir Misi** (list bernomor) dengan tata letak bersih (header gradien slate→cyan, kartu visi, badge nomor). Identitas (`data-rt="appName"`/`appLongName`/`wilayah`/`footerAdmin`) tetap terisi otomatis dari `config.js`. Handler `Esc` dijaga `if (document.addEventListener)` agar aman pada harness uji. **Portal publik** (`public.html`) memakai modal yang sama: ikon info di header (di samping Nomor Siaga & tema) + tautan "Tentang Aplikasi" di footer, mendukung mode gelap, `openAbout()` mengunci scroll body, dan `Esc` ikut menutupnya. Uji baru: `/tmp/opencode/test_about.js` (11) & `/tmp/opencode/test_about_public.js` (11).

- ✅ **Pencarian Daftar Pengajuan Surat mengikuti pola Iuran & Kas** — kotak pencarian `#search-surat` kini mencocokkan **nilai yang tampil** (Timestamp terformat `dd-Mmm-yyyy HH:mm` via `fmtTimestamp` + mentah `waktu`, NIK tersamar via `maskNik` + mentah, No. HP asli + normalisasi `waNumber`), bukan hanya field mentah. **Empty-state menyesuaikan**: bila ada data tetapi tidak ada yang cocok (pencarian/filter status aktif) → "Tidak ada pengajuan yang cocok dengan pencarian/filter."; bila memang belum ada data → pesan onboarding lama. Ditambahkan tombol **bersihkan filter** (`clearSuratFilters()`, ikon `fa-filter-circle-xmark`) di toolbar yang mengosongkan pencarian + filter status sekaligus. Penelusuran spasi di-trim (`.trim()`). Uji baru: `/tmp/opencode/test_surat_search.js` (14).

- ✅ **Rebrand: SAPA RT (Sistem Administrasi & Pelayanan Antarwarga)** — identitas aplikasi di `config.js` diperbarui: `appName:'SAPA RT'`, field baru `appLongName:'Sistem Administrasi & Pelayanan Antarwarga'`, `kelurahan:'Tanjung Duren Utara'` (sebelumnya keliru `'Lontar Barat'`), field baru `alamatrt:'Lontar Barat'` (nama kawasan/jalan, hanya untuk tampilan), dan contoh alamat → `Jl. Lontar Barat No. 06`. `appNameRt` & `headerName` kini = `appName` (menghindari "SAPA RT RT 017/RW 06" ganda); `appLongName` menjadi sub-judul header admin; `publicSubtitle` memuat kawasan; footer & `<title>` memakai brand. `version` → `'5'`, `EXPECTED_CONFIG_VERSION='5'` di `index.html` & `public.html`; fallback `data-rt`/placeholder di kedua HTML diselaraskan. Uji `test_config_gate_index.js` & `test_public_ready.js` disesuaikan (versi 5).

- ✅ **Header panel "Data Warga"** — judul di `index.html` menjadi `data-rt="wargaTitle"` (key baru di `config.js`: `'Data Warga RT ' + rt + ' / RW ' + rw` → "Data Warga RT 017 / RW 06"); baris sub-judul `wargaSubtitle` ("Pendataan warga ...") dihapus.

- ✅ **Header panel "Ringkasan"** — `data-rt="dashboardTitle"` menjadi "Ringkasan RT &lt;rt&gt; / RW &lt;rw&gt;" (mis. "Ringkasan RT 017 / RW 06"); `data-rt="wilayah"` kini menampilkan "alamatrt, kelurahan, kecamatan" (mis. "Lontar Barat, Tanjung Duren Utara, Grogol Petamburan").

- ✅ **Header panel "Iuran & Kas"** — judul menjadi `data-rt="kasTitle"` (key baru `config.js`: `'Iuran Kas RT ' + rt + ' / RW ' + rw` → "Iuran Kas RT 017 / RW 06"); baris sub-judul ("Pencatatan pemasukan & pengeluaran kas warga") dihapus.

- ✅ **Header panel "Kegiatan Warga"** — baris sub-judul ("Kerja bakti, posyandu, siskamling, dan acara RT") dihapus.
- ✅ **Header `public.html`** — posisi tukar: judul header (h1, besar) kini `data-rt="publicSubtitle"` ("Portal Informasi Publik · RT 017/RW 06 · Lontar Barat"), baris kedua (kecil) `data-rt="appLongName"` ("Sistem Administrasi & Pelayanan Antarwarga").

- ✅ **Footer** — urutan lokasi di `footerAdmin` / `footerPublic` menjadi `alamatrt, kelurahan` (mis. "© 2026 SAPA RT · RT 017/RW 06 Lontar Barat, Tanjung Duren Utara").

- ✅ **Teks batas NIK (`public.html`)** — petunjuk "Satu NIK dibatasi maksimal 5 pengajuan per jam." diubah menjadi "Satu NIK dibatasi maksimal 5 pengajuan." (hanya teks; logika rate-limit 5 pengajuan/jam di backend tetap).

- ✅ **Pilih tanggal lewat kalender (Iuran Kas, Pengumuman, Kegiatan Warga)** — field tanggal modal `#kas-tanggal`, `#pengumuman-tanggal`, `#kegiatan-tanggal` kini membuka kalender native saat diklik (`onclick="openDatePicker(id)"`), memakai helper `<input type="date">` tersembunyi + `showPicker()`. Tampilan teks tetap `dd-mm-yyyy` (mask tetap berfungsi); hasil pilih kalender mengisi field via `isoToDDMMYYYY()` + event `change`. Tidak mengubah logika baca/simpan (`readDateInput`).

- ✅ **Badge "N hari lagi" di agenda `public.html`** — di samping nama kegiatan, agenda yang belum jatuh tempo menampilkan badge berkedip "(N hari lagi)" (kelas `.rt-days-left` + `@keyframes rt-days-flash`, warna kuning↔merah). Agenda yang tanggalnya sudah lewat atau hari ini (`days <= 0`) tidak menampilkan badge. Helper `daysLeftFromISO()` + `daysLeftBadge()`; menghormati `prefers-reduced-motion`.

- ✅ **Urut & kelompok kartu Pengumuman / Kegiatan (admin)** — kartu `Pengumuman` di `index.html` diurutkan **tanggal menurun** (terbaru dulu) dan `Kegiatan Warga` **tanggal menaik** (terdekat dulu), lalu kartu yang berstatus **Disembunyikan** (Publik=Tidak) dipisah ke grup sendiri di bawah judul pemisah "Disembunyikan dari publik (N)". Indeks asli record tetap dipakai pada aksi Edit/Sembunyikan/Hapus (urutan tampilan tidak mengubah indeks `appState`).

- ✅ **Urut tanggal (`public.html`)** — daftar **Pengumuman** diurutkan tanggal menurun (terbaru dulu), **Agenda Kegiatan** menaik (terdekat dulu), memakai field mentah `tanggalISO` (menggantikan `.reverse()` lama).

## 🔧 Recent Changes (2026-10-06)

- ✅ **Baris filter per kolom (ganti input tambah cepat)** — baris kosong "tambah cepat" pada tabel **Data Warga** & **Iuran/Kas** di `index.html` diubah fungsinya menjadi **baris filter per kolom** (`<input>` id `fw-warga-*` / `fw-kas-*` di `<thead>`, `oninput` memanggil render). Penyaringan *contains* (case-insensitive) via `filterValue()` + `matchFilter()`, digabung AND antar kolom dan tetap menyatu dengan toolbar (`search-warga`/`filter-status-warga`, `search-kas` + periode). Kolom Tanggal dicocokkan ke ISO & tampilan `dd-Mmm-yyyy`; kolom Jumlah ke angka mentah & `formatRupiah()`. Tombol corong `clearWargaFilters()`/`clearKasFilters()` mengosongkan semua filter (kolom + toolbar). Fitur inline-add dihapus (`saveDraftWarga`/`saveDraftKas`/`clearDraft*`/`captureDraft`/`WARGA_DRAFT_FIELDS`/`KAS_DRAFT_FIELDS` dibuang); tambah data hanya lewat modal. Uji baru: `/tmp/opencode/test_column_filter.js` (48); `test_inline_draft.js` kini jadi guard penghapusan; `test_kas_view.js` disesuaikan (tak ada baris draft).
- ✅ **Jumlah record di header No. KK** — khusus tabel **Data Warga**, header `No. KK` menampilkan jumlah record yang ditemukan di sampingnya dalam tanda kurung, mis. `No. KK (12)` (`<span id="warga-count">`). Nilai = `filtered.length` dan di-update setiap `renderWargaTable()` (termasuk `(0)`), sehingga ikut berubah saat difilter. Uji: `test_column_filter.js` (52).
- ✅ **Total Warga = jiwa / KK unik** — kartu **Total Warga** di Ringkasan (`#stat-warga`, `renderDashboardStats()`) kini menampilkan `#total / #totalNomorKKUnik (KK)` (mis. `12 / 4 (KK)`), dengan Nomor KK kosong/spasi tidak dihitung. Subtitle kartu menjadi "Jiwa / No. KK unik". Uji: `test_dashboard_kk.js` (6).
- ✅ **No. HP Pengajuan Surat bisa klik chat WhatsApp** — pada tabel admin `Pengajuan Surat`, sel No. HP kini menjadi tautan `https://wa.me/<nomor>` (tab baru, ikon `fa-brands fa-whatsapp`, hijau) dengan `event.stopPropagation()` agar tidak ikut membuka modal edit. Helper baru `waNumber(noHp)` (normalisasi Indonesia: `0...`→`62...`, `+62`/spasi/tanda hubung dirapikan, panjang 9–15 digit) & `waLink(noHp)` di `index.html`. Nomor kosong/tak valid tetap tampil teks biasa. Uji: `test_surat_admin.js` (71).
- ✅ **No. Pengajuan konsisten `SRT-<yymmdd>-XXXX` di semua jalur** — sebelumnya catat manual admin (`Catat Pengajuan`) memakai ID generik `id-<timestamp>-<rand>`, sedangkan Portal Publik memakai `SRT-...`. Kini admin juga memakai `SRT-...` lewat helper baru `makeSuratRef()` (`index.html`) untuk `submitSurat` (add), `editSurat`, `cycleSuratStatus`, & fallback `deleteRecord` (bila `sheetName==='Pengajuan_Surat'`). Backend `code.gs` menambah `makeSuratId()` dan memakainya pada jalur ADD (`doPost`), fallback `buildRowData`, & `handleSubmitSurat`. `CODE_VERSION`/`EXPECTED_BACKEND_VERSION` → `publik-v11-2026-10-07` (perlu redeploy **New version**). Uji: `test_surat_admin.js` (75), `test_id_identity.js` (108).
- ✅ **Loading lebih cepat: Tailwind statis (ganti Play CDN)** — `index.html` & `public.html` tidak lagi memuat `cdn.tailwindcss.com` (engine berat yang men-generate CSS di browser). CSS dibangun lebih dulu via Tailwind CLI menjadi `tailwind.css` (~35 KB) memakai `tailwind.config.js` (`darkMode:'class'`, `content: ['./index.html','./public.html','./config.js']`) + `tailwind.input.css`. Ditambah `preconnect` ke `fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com`, `script.google.com`, `script.googleusercontent.com`. Regenerate: `npx tailwindcss@3 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify`. Semua kelas (termasuk `dark:`, `peer-checked:`, `after:`, arbitrary `[..]`) terverifikasi ada di hasil build. Uji: seluruh suite tetap hijau.
- ✅ **Tombol "Muat Ulang" (Hard Refresh) di sidebar — hanya muncul saat ada update** — `#sidebar-refresh-btn` (ikon `fa-arrows-rotate`, label "Versi Baru — Muat Ulang") tepat di bawah pill status `Google Sheets:` (`#desk-status-pill`), **tersembunyi secara default** (class `hidden`) dan **berkedip** saat update terdeteksi (CSS `@keyframes rt-update-flash` + `.update-flash`); tombol refresh header mobile (`#mobile-refresh-btn`) ikut berkedip agar update terlihat di ponsel. Deteksi update: (1) `enforceConfigVersion()` kini **menampilkan tombol** (bukan diam) saat mismatch config & guard aktif, (2) `checkForUpdate()` mem-`fetch('config.js', {cache:'no-store'})` lalu membandingkan `version` dengan `currentConfigVersion()`, dipanggil oleh `startUpdateWatcher()` (interval 60 dtk + saat tab kembali terlihat). Helper: `showUpdateAvailable(reason)`, `hideUpdateAvailable()`, `currentConfigVersion()`, `startUpdateWatcher()`. `refreshData()` memutar ikon pada tiga tombol (desktop, mobile, sidebar). Uji: `test_sidebar_refresh.js` (22).
- ✅ **Favicon asli** — sebelumnya browser meminta `/favicon.ico` tetapi berkasnya tidak ada (404). Dibuat `favicon.ico` (multi-ukuran 16/24/32/48/64 dari `rt-icon.png`) & `apple-touch-icon.png` (180x180). `index.html` & `public.html` kini menautkan `favicon.ico` + PNG `rt-icon.png` (512) + `apple-touch-icon.png`. Tambahkan `favicon.ico` & `apple-touch-icon.png` ke daftar aset publik di Cloudflare Access (**RT Public Assets**).
- ✅ **Perbaikan format tanggal (bulan tampil sebagai menit)** — pada hasil **Cek Status** publik, tanggal sempat tampil keliru seperti `07-56-2026` (contoh lain `06-45-2026`). Penyebabnya pola `Utilities.formatDate(..., 'dd-mm-yyyy HH:mm')` memakai `mm` (menit pada `SimpleDateFormat`), bukan `MM` (bulan). Diperbaiki di 3 tempat (`notifyAdminNewSurat` ×2, `formatTimestampCell`) menjadi `'dd-MM-yyyy HH:mm'` sehingga kini benar `07-10-2026 09:56`. `TS_FORMAT` (number format Google Sheets) tetap `dd-mm-yyyy hh:mm` karena Sheets membedakan bulan/menit dari posisi. Diberi komentar jelas + regresi uji di `test_pengajuan_check.js` (mock `_backend_mock.js` kini mengemulasi `mm`=menit/`MM`=bulan agar kesalahan ini tertangkap).
- ✅ **Pengajuan Surat — kolom "No. Surat"** — skema `Pengajuan_Surat` bertambah kolom **`No. Surat`** (setelah `Status Pengurusan`): `EXPECTED_FIELDS` 9→10, `DESIRED_HEADERS` 11 kolom, `buildRowData` menyisipkan `data.noSurat`. `handleCheckSurat` mengembalikan `noSurat` (indeks bergeser: `ref`=row[10], `catatan`=row[9]). Migrasi otomatis via `migrateLayoutByName` (generalisasi `migrateDataWargaLayout`) untuk tab lama tanpa kolom ini (data & ID lama aman). **Aturan bisnis** `suratSaveError()`: status `Selesai` wajib `No. Surat` (ditolak `code:"invalid"`). `CODE_VERSION` & `EXPECTED_BACKEND_VERSION` → `publik-v10-2026-10-07`. `index.html` modal: field `#surat-nosurat` di bawah No. Pengajuan (tanda wajib dinamis `#surat-nosurat-req`, validasi di `submitSurat`, `cycleSuratStatus` membuka modal & menampilkan error bila kosong), mapping `applySheetsData` `noSurat:r[8]`/`catatan:r[9]`, haystack pencarian + `noSurat`. `public.html`: hasil cek menampilkan No. Surat pada kotak sorotan **amber** (`bg-amber-100`/`dark:bg-amber-500/25`, ikon `fa-file-signature`) agar mencolok. Uji: `test_pengajuan_foundation.js` (33, termasuk migrasi + aturan Selesai), `test_pengajuan_check.js`, `test_pengajuan_submit.js`, `test_surat_admin.js`.
- ✅ **Layanan Surat default tertutup** — kedua kartu (**Ajukan Surat Baru** & **Cek Status Pengajuan**) di `public.html` kini **tertutup** saat halaman dimuat (panel `#surat-panel-*` punya class `hidden`, `aria-expanded="false"`, chevron `rotate-180`). Warga mengeklik judul untuk membuka. `test_surat_collapse.js` diperbarui (26/26).
- ✅ **Nomor Siaga Darurat di Portal Publik** — tombol ikon telepon (`#siaga-btn`, `fa-phone-volume`, merah) di header `public.html` membuka modal `#siaga-modal` berisi **Nomor Siaga Darurat Utama**: 112 (`fa-tower-broadcast`), 110 (`fa-shield-halved`), 113 (`fa-fire-extinguisher`), 118/119 (`fa-truck-medical`), 115 (`fa-life-ring`), 117 (`fa-house-crack`), 129 (`fa-tent`), 123 (`fa-bolt`). Tiap entri `<a href="tel:...">`. Fungsi `openSiaga()`/`closeSiaga()` (kunci scroll body + tutup via latar/`Esc`); data statis sehingga tetap jalan tanpa backend. Berkas uji: `/tmp/opencode/test_siaga_numbers.js` (42/42).
- ✅ **Panduan Layanan Surat di Portal Publik** — ikon bantuan (`#surat-guide-btn`, `fa-circle-info`) di samping judul **Layanan Surat** (`public.html`) membuka modal `#panduan-surat-modal` berisi **panduan berurutan 1–6**: buka formulir, isi data (NIK 16 digit/HP/alamat/jenis/keperluan), kirim & simpan **Nomor Pengajuan**, alur status (`Pending`→`Diproses`→`Selesai`/`Ditolak`), cara **Cek Status** (NIK + No. HP sama), dan membaca **No. Surat** saat `Selesai`. Disertai kotak **Tips** (NIK/HP harus sama persis, batas 5 pengajuan/jam, keamanan data pribadi). Fungsi `openPanduanSurat()`/`closePanduanSurat()` (kunci scroll body; tombol X, tombol Mengerti, klik latar); handler `Esc` kini menutup modal panduan **dan** siaga. Berkas uji: `/tmp/opencode/test_panduan_surat.js` (41/41).
- ✅ **Pengajuan Surat — perbaikan 3 temuan + uji email admin** — (1) **No. Pengajuan** (kolom `ID`, mis. `SRT-261006-AB12`) kini tampil sebagai kolom di tabel panel admin (header `No. Pengajuan`, `colspan` empty-state 8→9) dan sebagai input readonly `#surat-ref-info` di modal edit; pencarian ikut menyertakan `item._id`. (2) **Validasi manual admin kini menampilkan error inline**: `showSuratFormError(msg, fieldId)` menyorot field, menampilkan kotak `#surat-form-error`, dan toast; `clearSuratFormError()` dipanggil saat modal dibuka/render. `submitSurat` memvalidasi nama≥3, NIK tepat 16 digit (pesan menyebut jumlah digit), No. HP 9–15 digit, alamat, jenisSurat, keperluan≥3. (3) **Uji email admin**: aksi JSONP **`sendTestEmail`** (token-gated) → `handleSendTestEmail()` di `code.gs` (baca Script Property `ADMIN_EMAIL`; error `no_admin_email`/`email_failed`, serta `mail_scope_denied` bila scope `script.send_mail` belum diizinkan), tombol **Tes Email Admin** (`testAdminEmail()`) di header `#panel-surat`. Fungsi bantu **`authorizeMail()`** (jalankan sekali dari editor) memicu dialog izin scope email. Berkas uji: `/tmp/opencode/test_surat_admin.js` (46/46) & `/tmp/opencode/test_send_test_email.js` (15/15).
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
- ✅ **Domain kustom Portal Publik** — `RT_CONFIG.publicPortalUrl` di `config.js` (mis. `https://sapa-rt017.pages.dev/public`) membuat tautan & tombol "Buka Portal" di menu admin memakai domain itu; `getPublicPortalUrl()` memprioritaskan `publicPortalUrl` → lalu `public.html` (bila `publicApiUrl` terisi) → lalu `public.html?url=...`.
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
