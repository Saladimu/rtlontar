# 🏢 Dashboard RT Tanjung Duren Utara

Sistem Informasi & Dashboard Management RT (Rukun Tetangga) berbasis web yang responsif, modern, dan mudah digunakan. Didesain khusus untuk pengurus dan warga RT di wilayah Tanjung Duren Utara. Sistem ini menggunakan **Google Sheets** sebagai *database* tanpa memerlukan *server/backend* yang rumit.

---

## 🚀 Fitur Utama

- **📊 Ringkasan / Dashboard:** Menampilkan statistik total warga, saldo kas berjalan, pengumuman terbaru, dan kegiatan mendatang.
- **👥 Pendataan Warga:** Pengelolaan data penduduk (Nama, NIK, No. HP, Alamat, dan Status Tempat Tinggal) dilengkapi fitur pencarian, filter, **Edit & Hapus** dengan warning dialog.
- **💰 Iuran & Kas RT:** Pencatatan arus kas (Pemasukan & Pengeluaran) beserta akumulasi saldo akhir secara terotomatisasi. **Edit & Hapus** tersedia.
- **📢 Pengumuman RT:** Papan informasi digital resmi untuk menyebarkan imbauan dan berita penting. **Edit & Hapus** tersedia.
- **📅 Kegiatan Warga:** Agenda kerja bakti, posyandu, siskamling, dan acara komunitas RT. **Edit & Hapus** tersedia.
- **🔄 Refresh Data Manual:** Tombol refresh di header desktop/mobile untuk memuat ulang data dari Google Sheets kapan saja.
- **🔗 Integrasi Google Apps Script:** Pengiriman data form langsung terhubung ke Google Sheets, **sync delete**, dengan *fallback* **localStorage** jika dijalankan tanpa internet/koneksi backend.
- **⚠️ Delete Persistence:** Sistem melacak record yang dihapus agar tidak muncul kembali setelah reload/sync.
- **🔐 Token Admin:** Semua operasi tulis (tambah/edit/hapus) dan baca lengkap wajib menyertakan token rahasia (`ADMIN_TOKEN` di Script Properties). Tanpa token, server menolak permintaan sehingga orang yang hanya tahu URL tidak bisa mengubah data.
- **🕵️ Portal Publik Terisolasi:** `public.html` memakai endpoint `readPublic` yang hanya mengembalikan Pengumuman & Kegiatan ber-`Publik=Ya`; data warga & kas tidak pernah dikirim ke portal publik.

---

## 📊 Struktur Google Sheets (Database)

Buat file baru di **Google Sheets**, buat 4 tab/sheet dengan nama exact di bawah ini, lalu salin (*copy*) teks TSV di dalam kotak dan tempel (*paste*) langsung pada sel **A1** di masing-masing tab:

> Kolom **Timestamp** (kolom A) otomatis berformat `dd-mm-yyyy hh:mm` dan mengikuti zona waktu **GMT+7 (Asia/Jakarta)**. Script juga menambahkan satu kolom bantu **`ID`** di ujung kanan secara otomatis (dipakai untuk edit/hapus yang aman, tidak perlu dibuat manual).
>
> Kolom **`Publik`** (khusus Pengumuman & Kegiatan_Warga) menentukan apakah record tampil di Portal Publik: isi `Ya` untuk tampil, `Tidak` untuk sembunyikan. Bisa di-toggle dari aplikasi; baris lama otomatis diisi `Ya`.

### 1. Tab `Data_Warga`
```tsv
Timestamp	Nama Lengkap	NIK	No HP	Status Tempat Tinggal	Alamat/No Rumah
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

---

## 🧩 Mengubah Informasi RT

Semua identitas RT (nama, nomor RT/RW, kelurahan, kecamatan, kota, tahun footer, contoh alamat) diatur di satu file: **`config.js`**. Ubah nilai di dalam objek `RT_CONFIG`, lalu simpan — perubahan otomatis berlaku di `index.html` dan `public.html`.

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

> Pastikan file `config.js` ikut diunggah saat publikasi.

---

## 🌐 Publikasi ke GitHub Pages

1. Upload file `index.html`, `public.html`, `config.js`, `README.md`, dan `AGENTS.md` ke repository GitHub Anda.
2. Buka menu **Settings** > **Pages** di repository.
3. Pada bagian **Branch**, pilih `main` / `master` lalu klik **Save**.
4. Website akan aktif secara publik dalam beberapa menit.

> **Catatan keamanan:** `index.html` adalah halaman **admin** dan tidak memiliki layar login — proteksi ada di token backend. Jangan bagikan link admin (`index.html`) ke warga; bagikan hanya link portal publik (`public.html?url=...`). Data warga/kas tidak akan terkirim ke portal publik berkat endpoint `readPublic`, dan tanpa token `ADMIN_TOKEN` siapa pun tetap tidak bisa mengubah data.
