# 🏢 Dashboard RT Tanjung Duren Utara

Sistem Informasi & Dashboard Management RT (Rukun Tetangga) berbasis web yang responsif, modern, dan mudah digunakan. Didesain khusus untuk pengurus dan warga RT di wilayah Tanjung Duren Utara. Sistem ini menggunakan **Google Sheets** sebagai *database* tanpa memerlukan *server/backend* yang rumit.

---

## 🚀 Fitur Utama

- **📊 Ringkasan / Dashboard Dashboard:** Menampilkan statistik total warga, saldo kas berjalan, pengumuman terbaru, dan kegiatan mendatang.
- **👥 Pendataan Warga:** Pengelolaan data penduduk (Nama, NIK, No. HP, Alamat, dan Status Tempat Tinggal) dilengkapi fitur pencarian dan filter.
- **💰 Iuran & Kas RT:** Pencatatan arus kas (Pemasukan & Pengeluaran) beserta akumulasi saldo akhir secara terotomatisasi.
- **📢 Pengumuman RT:** Papan informasi digital resmi untuk menyebarkan imbauan dan berita penting.
- **📅 Kegiatan Warga:** Agenda kerja bakti, posyandu, siskamling, dan acara komunitas RT.
- **🔗 Integrasi Google Apps Script:** Pengiriman data form langsung terhubung ke Google Sheets, dengan *fallback* **localStorage** jika dijalankan tanpa internet/koneksi backend.

---

## 📊 Struktur Google Sheets (Database)

Buat file baru di **Google Sheets**, buat 4 tab/sheet dengan nama exact di bawah ini, lalu salin (*copy*) teks TSV di dalam kotak dan tempel (*paste*) langsung pada sel **A1** di masing-masing tab:

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
Timestamp	Tanggal	Judul Pengumuman	Isi Pengumuman	Kategori	Penanggung Jawab
```

### 4. Tab `Kegiatan_Warga`
```tsv
Timestamp	Nama Kegiatan	Tanggal Pelaksanaan	Waktu	Lokasi	Penanggung Jawab	Keterangan
```

---

## ⚙️ Kode Google Apps Script (`Code.gs`)

Kode Apps Script sudah tersedia pada file `Apps Script/code.gs`. Buka Google Sheets Anda, pilih menu **Ekstensi > Apps Script**, lalu salin dan tempelkan isi file tersebut.

### Langkah Deployment Web App:
1. Klik tombol **Deploy > New Deployment**.
2. Pilih tipe **Web app**.
3. Atur *Execute as*: **Me** (Email Anda).
4. Atur *Who has access*: **Anyone** (Siapa saja).
5. Klik **Deploy**, lalu salin **Web App URL** yang didapat.
6. Buka aplikasi web RT, masuk ke tab **Koneksi App Script**, lalu tempelkan URL tersebut dan klik **Simpan**.

> **Penting:** setiap kali `code.gs` diubah, buat versi baru melalui **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. Tanpa ini, Web App masih menjalankan kode lama.

### Membaca data dari Google Sheets
Aplikasi akan otomatis memuat data dari Google Sheets saat dibuka (bila Web App URL sudah tersimpan) menggunakan `doGet` + JSONP. Anda juga dapat menekan tombol **Muat Data dari Sheets** di tab **Koneksi App Script** untuk menyegarkan data kapan saja.

---

## 🌐 Publikasi ke GitHub Pages

1. Upload file `index.html`, `README.md`, dan `AGENTS.md` ke repository GitHub Anda.
2. Buka menu **Settings** > **Pages** di repository.
3. Pada bagian **Branch**, pilih `main` / `master` lalu klik **Save**.
4. Website akan aktif secara publik dalam beberapa menit.