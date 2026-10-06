# 🏢 Dashboard RT Tanjung Duren Utara

Sistem Informasi & Dashboard Management RT (Rukun Tetangga) berbasis web yang responsif, modern, dan mudah digunakan. Didesain khusus untuk pengurus dan warga RT di wilayah Tanjung Duren Utara. Sistem ini menggunakan **Google Sheets** sebagai *database* tanpa memerlukan *server/backend* yang rumit.

---

## 🚀 Fitur Utama

- **📊 Ringkasan / Dashboard:** Menampilkan statistik total warga, saldo kas berjalan, pengumuman terbaru, dan kegiatan mendatang.
- **👥 Pendataan Warga:** Pengelolaan data penduduk (Nama, NIK, Tempat & Tanggal Lahir, No. HP, Alamat, dan Status Tempat Tinggal) dilengkapi kolom **Usia** otomatis (dihitung dari Tanggal Lahir, tidak disimpan ke database), fitur pencarian, filter, **Edit & Hapus** dengan warning dialog.
- **💰 Iuran & Kas RT:** Pencatatan arus kas (Pemasukan & Pengeluaran) beserta akumulasi saldo akhir secara terotomatisasi. **Edit & Hapus** tersedia.
- **📢 Pengumuman RT:** Papan informasi digital resmi untuk menyebarkan imbauan dan berita penting. **Edit & Hapus** tersedia.
- **📅 Kegiatan Warga:** Agenda kerja bakti, posyandu, siskamling, dan acara komunitas RT. **Edit & Hapus** tersedia.
- **🔄 Refresh Data Manual:** Tombol refresh di header desktop/mobile untuk memuat ulang data dari Google Sheets kapan saja.
- **📝 Format Tanggal `dd-mm-yyyy`:** Semua kolom tanggal pada form tambah/edit (Warga, Kas, Pengumuman, Kegiatan) memakai format `dd-mm-yyyy` dengan mask otomatis; nilai kanonik tetap disimpan sebagai `yyyy-MM-dd` di Sheets.
- **➕ Input Cepat (Baris Kosong):** Tabel Data Warga & Iuran/Kas menampilkan satu baris kosong di paling atas untuk input langsung tanpa membuka modal. Kolom Nama Warga pada Kas menampilkan saran dari Data_Warga (datalist).
- **🔗 Integrasi Google Apps Script:** Pengiriman data form langsung terhubung ke Google Sheets, **sync delete**, dengan *fallback* **localStorage** jika dijalankan tanpa internet/koneksi backend.
- **⚠️ Delete Persistence:** Sistem melacak record yang dihapus agar tidak muncul kembali setelah reload/sync.
- **🔐 Token Admin:** Semua operasi tulis (tambah/edit/hapus) dan baca lengkap wajib menyertakan token rahasia (`ADMIN_TOKEN` di Script Properties). Tanpa token, server menolak permintaan sehingga orang yang hanya tahu URL tidak bisa mengubah data.
- **🕵️ Portal Publik Terisolasi:** `public.html` memakai endpoint `readPublic` yang hanya mengembalikan Pengumuman & Kegiatan ber-`Publik=Ya`; data warga & kas tidak pernah dikirim ke portal publik.
- **🌗 Tema Terang/Gelap (Portal Publik):** `public.html` punya tombol tema di header untuk beralih mode terang/gelap. Pilihan disimpan di `localStorage` (`rt_theme`) dan default mengikuti preferensi sistem, tanpa kedipan saat dibuka.
- **🔒 ON/OFF Portal Publik:** Toggle di tab Portal Publik untuk mengaktifkan/menonaktifkan akses warga. Saat OFF, server menolak `readPublic` sehingga data benar-benar tidak bisa diakses (bukan sekadar menyembunyikan tautan).

---

## 📊 Struktur Google Sheets (Database)

Buat file baru di **Google Sheets**, buat 4 tab/sheet dengan nama exact di bawah ini, lalu salin (*copy*) teks TSV di dalam kotak dan tempel (*paste*) langsung pada sel **A1** di masing-masing tab:

> Kolom **Timestamp** (kolom A) otomatis berformat `dd-mm-yyyy hh:mm` dan mengikuti zona waktu **GMT+7 (Asia/Jakarta)**. Script juga menambahkan satu kolom bantu **`ID`** di ujung kanan secara otomatis (dipakai untuk edit/hapus yang aman, tidak perlu dibuat manual).
>
> Kolom **`Publik`** (khusus Pengumuman & Kegiatan_Warga) menentukan apakah record tampil di Portal Publik: isi `Ya` untuk tampil, `Tidak` untuk sembunyikan. Bisa di-toggle dari aplikasi; baris lama otomatis diisi `Ya`.

### 1. Tab `Data_Warga`
```tsv
Timestamp	Nama Lengkap	NIK	Tempat Lahir	Tanggal Lahir	No HP	Status Tempat Tinggal	Alamat/No Rumah
```

### 2. Tab `Iuran_Kas`
```tsv
Timestamp	Tanggal	Nama Warga	No Rumah	Jenis Transaksi	Jumlah (Rp)	Keterangan
```

### 3. Tab `Pengumuman`
```tsv
Timestamp	Tanggal	Judul Pengumuman	Isi Pengumuman	Kategori	Penanggung Jawab	Publik
```

### 4. Tab `Kegiatan_Warga`
```tsv
Timestamp	Nama Kegiatan	Tanggal Pelaksanaan	Waktu	Lokasi	Penanggung Jawab	Keterangan	Publik
```

---

## ⚙️ Kode Google Apps Script (`Apps Script/code.gs`)

Kode Apps Script sudah tersedia pada folder `Apps Script/code.gs`. Lihat juga dokumentasi lengkap di `Apps Script/readme.md`.

Lihat `Apps Script/readme.md` untuk:
- Struktur database detail
- API endpoints (GET/POST)
- Panduan deployment
- Troubleshooting

<details>
<summary>📖 Panduan Singkat (klik untuk buka)</summary>

**Langkah Deployment:**
1. Buka Google Sheets → Ekstensi → Apps Script
2. Salin isi `code.gs` dan tempel di editor
3. Deploy > New Deployment → pilih **Web app**
4. Execute as: **Me** | Who has access: **Anyone**
5. Salin Web App URL ke aplikasi web (tab Koneksi)
6. Setelah update kode, Deploy > Manage deployments > Edit > New version > Deploy

**Perubahan Terbaru di code.gs:**
- ✅ `doGet` mendukung `action=delete` + JSONP callback
- ✅ `handleDelete()` untuk hapus baris dengan validasi
- ✅ `doPost` mendukung `action=add` / `action=update` / `action=delete`
- ✅ `action=update` memperbarui baris berdasarkan **ID stabil** (mempertahankan Timestamp) tanpa menambah baris duplikat
- ✅ `action=version` + `CODE_VERSION` untuk memverifikasi Web App sudah redeploy (tombol **Cek Versi Backend**)
- ✅ Kolom `Timestamp` otomatis berformat `dd-mm-yyyy hh:mm` (GMT+7) untuk semua sheet
- ✅ Kolom bantu `ID` otomatis dibuat & di-backfill untuk baris lama
- ✅ Kolom `Publik` pada Pengumuman & Kegiatan + toggle ON/OFF dari aplikasi (Portal Publik)
- ✅ Format tanggal otomatis saat read dari Sheets
- ✅ **Token admin** (`ADMIN_TOKEN` di Script Properties) untuk melindungi semua operasi tulis & baca lengkap
- ✅ **Endpoint `readPublic`** untuk portal publik (hanya Pengumuman & Kegiatan `Publik=Ya`, tanpa data warga/kas)
- ✅ **ON/OFF Portal Publik** server-side (`PUBLIC_PORTAL_ENABLED` di Script Properties + aksi `setPortalStatus`); saat OFF `readPublic` ditolak
- ✅ **Identitas RT terpusat** di `config.js` (ubah info RT di satu tempat)
</details>

### Langkah Deployment Web App:
1. Klik tombol **Deploy > New Deployment**.
2. Pilih tipe **Web app**.
3. Atur *Execute as*: **Me** (Email Anda).
4. Atur *Who has access*: **Anyone** (Siapa saja).
5. Klik **Deploy**, lalu salin **Web App URL** yang didapat.
6. Di Apps Script, buka **Project Settings > Script Properties**, tambahkan properti **`ADMIN_TOKEN`** dengan nilai rahasia pilihan Anda.
7. Buka aplikasi web RT, masuk ke tab **Koneksi App Script**, tempelkan URL tersebut, isi **Token Admin** dengan nilai `ADMIN_TOKEN` yang sama, lalu klik **Simpan Token** (dan **Simpan URL Koneksi**).

> **Penting:** setiap kali `code.gs` diubah, buat versi baru melalui **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. Tanpa ini, Web App masih menjalankan kode lama.

### Membaca data dari Google Sheets
Aplikasi akan otomatis memuat data dari Google Sheets saat dibuka (bila Web App URL sudah tersimpan) menggunakan `doGet` + JSONP. Anda juga dapat menekan tombol **Muat Data dari Sheets** di tab **Koneksi App Script** atau **tombol Refresh 🔄** di header untuk menyegarkan data kapan saja.

### Edit & Delete Data
Semua modul (Warga, Kas, Pengumuman, Kegiatan) sekarang memiliki tombol **Edit** ✏️ dan **Hapus** 🗑️ di setiap record.
- **Hapus**: Data warga akan menampilkan warning dialog detail sebelum dihapus.
- **Edit**: Modal akan terbuka dengan data yang sudah terisi, klik simpan untuk menyimpan perubahan.
- **Delete Sync**: Penghapusan dilakukan di Google Sheets dulu, jika gagal data lokal tidak berubah.

### Tambah Data Cepat (Inline)
Tabel **Data Warga** dan **Iuran & Kas RT** memiliki satu baris kosong di bagian atas. Isi kolomnya langsung, lalu klik tombol centang (simpan) pada kolom Aksi untuk menambah record tanpa membuka modal. Tanggal pada baris ini memakai format `dd-mm-yyyy`.

---

## 🧩 Mengubah Informasi RT

Semua identitas RT (nama, nomor RT/RW, kelurahan, kecamatan, kota, tahun footer, contoh alamat) diatur di satu file: **`config.js`**. Ubah nilai di dalam objek `RT_CONFIG`, lalu simpan — perubahan otomatis berlaku di `index.html` dan `public.html`.

```js
window.RT_CONFIG = {
    // Naikkan versi ini setiap kali mengubah config.js (mis. '2', '3', ...).
    // Halaman akan membandingkannya dan hard-refresh otomatis bila berbeda.
    version: '3',
    appName: 'Sistem RT',
    rt: '005',
    rw: '02',
    kelurahan: 'Tanjung Duren Utara',
    kecamatan: 'Grogol Petamburan',
    kota: 'Jakarta Barat',
    provinsi: 'DKI Jakarta',
    tahun: new Date().getFullYear(),
    alamatContoh: 'Jl. Tanjung Duren Utara No. 12',
    lokasiContoh: 'Lap. Bulutangkis RT',

    // URL Web App Google Apps Script (berakhiran /exec) untuk Portal Publik.
    // Isi agar public.html dapat diakses cukup lewat "public.html" tanpa ?url=...
    publicApiUrl: 'https://script.google.com/macros/s/xxxx/exec',

    // URL halaman Portal Publik yang dibagikan ke warga (opsional).
    // Isi dengan domain kustom (mis. Cloudflare Pages) agar tautan menu
    // Portal Publik di admin memakai URL ini. Kosongkan ('') untuk memakai public.html.
    publicPortalUrl: 'https://rt017.pages.dev/'
};
```

> **Portal Publik tanpa URL panjang:** isi `publicApiUrl` dengan URL Web App Anda. Setelah itu tautan yang dibagikan ke warga cukup **`public.html`** (URL Apps Script tidak tampil di address bar). Bila Anda memakai domain kustom (mis. Cloudflare Pages), isi juga `publicPortalUrl` dengan URL tersebut agar tautan & tombol "Buka Portal" di menu admin mengarah ke sana. `public.html` tetap mendukung `?url=...` sebagai fallback bila `publicApiUrl` masih kosong. `config.js` dimuat dengan cache-bust dan tombol **Muat Ulang** melakukan *hard refresh*, sehingga perubahan config selalu terbaru. Pemuatan config juga menunggu (*readiness gate*) agar tidak ada kedipan "belum dikonfigurasi".

> **Auto hard refresh (versi config):** setiap kali mengubah `config.js`, naikkan `version` **dan** samakan `EXPECTED_CONFIG_VERSION` di `index.html` & `public.html`. Bila browser masih memegang HTML lama (versi tak cocok), halaman otomatis melakukan *hard refresh* sekali agar HTML & config sinkron; ada pengaman anti-loop, jadi tidak akan reload berulang.

> Pastikan file `config.js` ikut diunggah saat publikasi.

---

## 🌐 Publikasi ke GitHub Pages

1. Upload file `index.html`, `public.html`, `config.js`, `README.md`, dan `AGENTS.md` ke repository GitHub Anda.
2. Buka menu **Settings** > **Pages** di repository.
3. Pada bagian **Branch**, pilih `main` / `master` lalu klik **Save**.
4. Website akan aktif secara publik dalam beberapa menit.

> **Catatan keamanan:** `index.html` adalah halaman **admin** dan tidak memiliki layar login — proteksi ada di token backend. Jangan bagikan link admin (`index.html`) ke warga; bagikan hanya link portal publik (**`public.html`**). Data warga/kas tidak akan terkirim ke portal publik berkat endpoint `readPublic`, dan tanpa token `ADMIN_TOKEN` siapa pun tetap tidak bisa mengubah data. Toggle **Portal Publik ON/OFF** ditegakkan di sisi server, bukan sekadar menyembunyikan tampilan.
