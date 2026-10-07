# 🏢 Dashboard RT Tanjung Duren Utara

Sistem Informasi & Dashboard Management RT (Rukun Tetangga) berbasis web yang responsif, modern, dan mudah digunakan. Didesain khusus untuk pengurus dan warga RT di wilayah Tanjung Duren Utara. Sistem ini menggunakan **Google Sheets** sebagai *database* tanpa memerlukan *server/backend* yang rumit.

---

## 🚀 Fitur Utama

- **📊 Ringkasan / Dashboard:** Menampilkan statistik total warga, saldo kas berjalan, pengumuman terbaru, dan kegiatan mendatang.
- **👥 Pendataan Warga:** Pengelolaan data penduduk (Nomor KK, Nama Lengkap, Status dalam Keluarga, Jenis Kelamin, NIK, Tempat & Tanggal Lahir, Pendidikan, Pekerjaan, No. HP, Status Tempat Tinggal, Alamat/No Rumah) dilengkapi kolom **Usia** otomatis (dihitung dari Tanggal Lahir, tidak disimpan ke database), fitur pencarian, filter, **Edit & Hapus** dengan warning dialog.
- **💰 Iuran & Kas RT:** Pencatatan arus kas (Pemasukan & Pengeluaran) beserta akumulasi saldo akhir secara terotomatisasi. **Edit & Hapus** tersedia.
- **🗓️ Filter Periode Kas:** Riwayat transaksi dapat ditampilkan **per bulan** (default), **per tanggal**, atau **semua data**. Kartu ringkasan (Total Pemasukan, Total Pengeluaran, Saldo Akhir) mengikuti periode yang dipilih. Pilihan tersimpan di browser.
- **📢 Pengumuman RT:** Papan informasi digital resmi untuk menyebarkan imbauan dan berita penting. **Edit & Hapus** tersedia.
- **📅 Kegiatan Warga:** Agenda kerja bakti, posyandu, siskamling, dan acara komunitas RT. **Edit & Hapus** tersedia.
- **🔄 Refresh Data Manual:** Tombol refresh di header desktop/mobile untuk memuat ulang data dari Google Sheets kapan saja.
- **📝 Format Tanggal `dd-mm-yyyy`:** Semua kolom tanggal pada form tambah/edit (Warga, Kas, Pengumuman, Kegiatan) memakai format `dd-mm-yyyy` dengan mask otomatis; nilai kanonik tetap disimpan sebagai `yyyy-MM-dd` di Sheets.
- **🔎 Filter per Kolom:** Tabel Data Warga & Iuran/Kas menampilkan satu baris filter tepat di bawah header tabel. Isi kata kunci pada kolom yang diinginkan (mis. Nama, NIK, Alamat, Jenis) untuk menyaring baris secara langsung; filter gabungan antar kolom dan dengan kotak pencarian di atas tabel. Tombol ikon corong pada kolom Aksi membersihkan semua filter.
- **🔗 Integrasi Google Apps Script:** Pengiriman data form langsung terhubung ke Google Sheets, **sync delete**, dengan *fallback* **localStorage** jika dijalankan tanpa internet/koneksi backend.
- **⚠️ Delete Persistence:** Sistem melacak record yang dihapus agar tidak muncul kembali setelah reload/sync.
- **🔐 Token Admin:** Semua operasi tulis (tambah/edit/hapus) dan baca lengkap wajib menyertakan token rahasia (`ADMIN_TOKEN` di Script Properties). Tanpa token, server menolak permintaan sehingga orang yang hanya tahu URL tidak bisa mengubah data.
- **🛡️ Halaman Admin Terlindungi (Cloudflare Access):** halaman admin (`/` & `/index.html`) hanya bisa dibuka oleh email yang diizinkan melalui login Cloudflare Zero Trust; portal publik tetap terbuka tanpa login. Lihat bagian **Publikasi & Kontrol Akses**.
- **🕵️ Portal Publik Terisolasi:** `public.html` memakai endpoint `readPublic` yang hanya mengembalikan Pengumuman & Kegiatan ber-`Publik=Ya`; data warga & kas tidak pernah dikirim ke portal publik.
- **🌗 Tema Terang/Gelap (Portal Publik):** `public.html` punya tombol tema di header untuk beralih mode terang/gelap. Pilihan disimpan di `localStorage` (`rt_theme`) dan default mengikuti preferensi sistem, tanpa kedipan saat dibuka.
- **🚨 Nomor Siaga Darurat (Portal Publik):** tombol ikon di header `public.html` membuka daftar **Nomor Siaga Darurat Utama** (112, 110, 113, 118/119, 115, 117, 129, 123) lengkap dengan ikon per layanan. Setiap nomor dapat diketuk untuk langsung menelepon (`tel:`).
- **🔒 ON/OFF Portal Publik:** Toggle di tab Portal Publik untuk mengaktifkan/menonaktifkan akses warga. Saat OFF, server menolak `readPublic` sehingga data benar-benar tidak bisa diakses (bukan sekadar menyembunyikan tautan).

---

## 📊 Struktur Google Sheets (Database)

Buat file baru di **Google Sheets**, buat 4 tab/sheet dengan nama exact di bawah ini, lalu salin (*copy*) teks TSV di dalam kotak dan tempel (*paste*) langsung pada sel **A1** di masing-masing tab:

> Kolom **Timestamp** (kolom A) otomatis berformat `dd-mm-yyyy hh:mm` dan mengikuti zona waktu **GMT+7 (Asia/Jakarta)**. Script juga menambahkan satu kolom bantu **`ID`** di ujung kanan secara otomatis (dipakai untuk edit/hapus yang aman, tidak perlu dibuat manual).
>
> Kolom **`Publik`** (khusus Pengumuman & Kegiatan_Warga) menentukan apakah record tampil di Portal Publik: isi `Ya` untuk tampil, `Tidak` untuk sembunyikan. Bisa di-toggle dari aplikasi; baris lama otomatis diisi `Ya`.

### 1. Tab `Data_Warga`
```tsv
Timestamp	Nomor KK	Nama Lengkap	Status	Jenis Kelamin	NIK	Tempat Lahir	Tanggal Lahir	Pendidikan	Pekerjaan	No HP	Status Tempat Tinggal	Alamat/No Rumah
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
- ✅ **Fitur Pengajuan Surat (backend v9)** — tab `Pengajuan_Surat` (dibuat otomatis), aksi publik `submitSurat` (tanpa token; validasi NIK 16 digit, honeypot, rate limit 5/jam per NIK), notifikasi email admin (Script Property `ADMIN_EMAIL`), `Status` default `Pending`, serta **panel admin** untuk melihat/mencatat/mengubah status/menghapus & memfilter pengajuan
- ✅ **Kolom baru `Data_Warga`**: `Nomor KK`, `Status`, `Jenis Kelamin`, `Pendidikan`, `Pekerjaan` (urutan: Nomor KK → Nama Lengkap → Status → Jenis Kelamin → NIK → Tempat/Tanggal Lahir → Pendidikan → Pekerjaan → No HP → Status Tinggal → Alamat); migrasi otomatis berbasis **nama header** (`migrateDataWargaLayout()`), aman dijalankan berulang
</details>

### Langkah Deployment Web App:
1. Klik tombol **Deploy > New Deployment**.
2. Pilih tipe **Web app**.
3. Atur *Execute as*: **Me** (Email Anda).
4. Atur *Who has access*: **Anyone** (Siapa saja).
5. Klik **Deploy**, lalu salin **Web App URL** yang didapat.
6. Di Apps Script, buka **Project Settings > Script Properties**, tambahkan properti **`ADMIN_TOKEN`** dengan nilai rahasia pilihan Anda. (Opsional) tambahkan **`ADMIN_EMAIL`** berisi email admin — bila diisi, setiap pengajuan surat baru dari portal publik akan dikirimkan notifikasi email. Bila mengisi `ADMIN_EMAIL`, jalankan fungsi **`authorizeMail`** sekali dari editor (Run > Review permissions > Allow) lalu deploy **New version** agar izin email aktif (lihat bagian **Notifikasi Email ke Admin**).
7. Buka aplikasi web RT, masuk ke tab **Koneksi App Script**, tempelkan URL tersebut, isi **Token Admin** dengan nilai `ADMIN_TOKEN` yang sama, lalu klik **Simpan Token** (dan **Simpan URL Koneksi**).

> **Penting:** setiap kali `code.gs` diubah, buat versi baru melalui **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. Tanpa ini, Web App masih menjalankan kode lama.

### Membaca data dari Google Sheets
Aplikasi akan otomatis memuat data dari Google Sheets saat dibuka (bila Web App URL sudah tersimpan) menggunakan `doGet` + JSONP. Anda juga dapat menekan tombol **Muat Data dari Sheets** di tab **Koneksi App Script** atau **tombol Refresh 🔄** di header untuk menyegarkan data kapan saja.

### Edit & Delete Data
Semua modul (Warga, Kas, Pengumuman, Kegiatan) sekarang memiliki tombol **Edit** ✏️ dan **Hapus** 🗑️ di setiap record.
- **Hapus**: Data warga akan menampilkan warning dialog detail sebelum dihapus.
- **Edit**: Modal akan terbuka dengan data yang sudah terisi, klik simpan untuk menyimpan perubahan.
- **Delete Sync**: Penghapusan dilakukan di Google Sheets dulu, jika gagal data lokal tidak berubah.

### Filter per Kolom (Cari Data)
Tabel **Data Warga** dan **Iuran & Kas RT** memiliki satu **baris filter** tepat di bawah header tabel. Ketik kata kunci pada kolom yang diinginkan (mis. Nama, NIK, Tempat Lahir, Status, Alamat untuk Warga; Tanggal, Nama, No. Rumah, Jenis, Nominal, Catatan untuk Kas) untuk menyaring baris secara langsung. Filter bersifat *contains* (mengandung kata kunci, tidak peduli huruf besar/kecil) dan dapat **digabung** antar kolom maupun dengan kotak pencarian di atas tabel. Klik ikon corong di kolom Aksi untuk **membersihkan semua filter**. Untuk **menambah** data, gunakan tombol **Tambah Data Warga** / **Catat Transaksi Kas** (membuka modal).

### Pengajuan Surat (Portal Publik & Admin)

Warga dapat mengajukan surat keterangan/pengantar langsung dari **Portal Publik** (bagian **Layanan Surat**):

- **Ajukan Surat Baru:** warga mengisi Nama Lengkap, NIK (16 digit), No. HP/WhatsApp, Alamat/No. Rumah, Jenis Surat (daftar dari `RT_CONFIG.jenisSurat` di `config.js`), dan Keperluan. Setelah terkirim, warga menerima **nomor pengajuan** (contoh `SRT-261006-AB12`) untuk disimpan.
- **Cek Status Pengajuan:** warga memasukkan **NIK + No. HP/WhatsApp** yang sama seperti saat mengajukan untuk melihat status (`Pending` / `Diproses` / `Selesai` / `Ditolak`) beserta catatan pengurus.

Kedua kartu (**Ajukan Surat Baru** & **Cek Status Pengajuan**) dapat dibuka/ditutup (*collapse/toggle*) dengan mengeklik judulnya, sehingga tampilan lebih ringkas di layar kecil. Secara default keduanya **tertutup** saat halaman dibuka; warga mengeklik judul untuk menampilkan formulir.

Di samping judul **Layanan Surat** terdapat **ikon panduan** (`fa-circle-info`). Mengeklik ikon ini membuka jendela **Panduan Layanan Surat** berisi langkah-langkah berurutan (dari mengisi formulir pengajuan, menyimpan nomor pengajuan, hingga cek status dan membaca No. Surat), lengkap dengan tips (NIK & No. HP harus sama persis, batas 5 pengajuan/jam, dan keamanan data pribadi). Jendela dapat ditutup lewat tombol X, tombol **Mengerti**, klik latar, atau tombol **Esc**.

Pengamanan server-side: hanya menerima **tambah data** (tidak bisa mengubah/menghapus), memaksa status awal `Pending`, memvalidasi NIK/HP, menyaring bot lewat *honeypot*, dan membatasi **maksimal 5 pengajuan per NIK per jam**. Data tab `Pengajuan_Surat` **tidak pernah** ikut terkirim pada `readPublic`.

Bila Script Property **`ADMIN_EMAIL`** diisi, setiap pengajuan baru akan dikirimi **notifikasi email** ke admin. Bila Portal Publik dimatikan (toggle di halaman admin), form pengajuan & cek status otomatis disembunyikan dan ditolak oleh server.

#### Mengelola Pengajuan di Halaman Admin

Menu **Pengajuan Surat** pada dashboard admin menampilkan seluruh pengajuan (terbaru di atas) beserta kartu ringkasan jumlah per status:

- **Catat Pengajuan**: menambah pengajuan secara manual (mis. permohonan langsung/lisan) dengan tombol **Catat Pengajuan**. Bila ada isian yang salah (mis. NIK kurang dari 16 digit), pesan error muncul **di dalam modal** dan field yang bermasalah disorot.
- **No. Pengajuan**: setiap baris menampilkan nomor pengajuan (kolom `ID`, mis. `SRT-261006-AB12`) — nomor yang sama yang diterima warga saat mengajukan, sehingga mudah dicocokkan.
- **No. Surat**: field baru **di bawah No. Pengajuan** pada modal edit untuk mencatat **nomor surat resmi** (mis. `474/017-RT/RW.06/X/2026`). Field ini **wajib diisi saat status diubah menjadi `Selesai`** — baik lewat modal maupun tombol ubah status cepat (yang akan otomatis membuka modal bila nomornya masih kosong). Server juga menolak simpan `Selesai` tanpa No. Surat. Nomor ini ikut tampil pada hasil **Cek Status** warga dengan sorotan warna terang (kuning/amber) agar mudah terlihat.
- **Edit**: klik baris (atau ikon pensil) untuk membuka modal dan mengubah data, **Status Pengurusan** (`RT_CONFIG.statusSurat`), **No. Surat**, dan **Catatan Pengurus**. Modal juga menampilkan No. Pengajuan & tanggal pengajuan.
- **Ubah Status cepat**: ikon putar menggilir status `Pending → Diproses → Selesai → Ditolak → Pending`.
- **Hapus**: ikon tempat sampah (dengan konfirmasi).
- **Filter & cari**: saring berdasarkan status dan cari berdasarkan no. pengajuan / No. Surat / nama / NIK / jenis surat. NIK disamarkan pada tabel (contoh `3173••••••01`).

Semua operasi tulis dari admin memakai **token admin** (`ADMIN_TOKEN`) seperti modul lain.

#### Notifikasi Email ke Admin

Email otomatis dikirim **hanya untuk pengajuan yang masuk dari Portal Publik** (bukan untuk entri manual admin). Cara mengaktifkan:

1. Buka **Project Settings > Script Properties** pada Apps Script, tambahkan properti **`ADMIN_EMAIL`** berisi alamat email admin. (Jangan ditulis di dalam `code.gs` — nilainya dibaca dari Script Properties saat runtime.)
2. Buka editor **Apps Script**, pilih fungsi **`authorizeMail`** pada dropdown lalu klik **Run** > **Review permissions** > **Allow**. Langkah ini memberi izin scope `script.send_mail` (kirim email) pada akun pemilik; tanpa ini, email gagal dengan error *"You do not have permission to call MailApp.sendEmail"*. Setelah itu deploy ulang sebagai **New version**.
3. Uji dari dashboard: buka menu **Pengajuan Surat** lalu klik **Tes Email Admin**. Bila berhasil, email uji terkirim; bila `ADMIN_EMAIL` belum diatur, muncul pesan error yang menjelaskan.

Untuk menguji alur lengkap, kirim pengajuan dari Portal Publik menggunakan NIK & No. HP asli; email notifikasi akan dikirim ke `ADMIN_EMAIL`.

> **Catatan penting:** Web App dijalankan **sebagai pemilik skrip** (*Execute as: Me*). Karena itu, akun yang menekan **Allow** saat langkah 2 harus **akun yang sama** dengan pemilik/pendeploy Apps Script. Bila berbeda, pengiriman email tetap gagal meski sudah diizinkan.
>
> **Mengatasi error "You do not have permission to call MailApp.sendEmail":**
> 1. Pastikan perubahan terbaru sudah disimpan (**Ctrl+S**).
> 2. Pilih fungsi **`authorizeMail`** pada dropdown di editor Apps Script, klik **Run**, lalu **Review permissions > pilih akun > Allow**.
> 3. **Manage deployments > ikon pensil (Edit) > Version: New version > Deploy**.
> 4. Ulangi **Tes Email Admin** di dashboard.
>
> Pesan ini juga muncul langsung di dashboard sebagai kode `mail_scope_denied` bila tombol **Tes Email Admin** diklik sebelum izin diberikan.

### Nomor Siaga Darurat (Portal Publik)

Tombol ikon telepon di header `public.html` membuka daftar **Nomor Siaga Darurat Utama**. Setiap entri punya ikon sesuai layanan dan dapat diketuk untuk langsung menelepon (`tel:`):

| Nomor | Layanan | Ikon |
|-------|---------|------|
| 112 | Panggilan darurat terintegrasi (bebas pulsa) | `fa-tower-broadcast` |
| 110 | Kepolisian (Polri) | `fa-shield-halved` |
| 113 | Pemadam Kebakaran | `fa-fire-extinguisher` |
| 118 / 119 | Ambulans dan darurat medis | `fa-truck-medical` |
| 115 | Basarnas / SAR | `fa-life-ring` |
| 117 | Badan Nasional Penanggulangan Bencana (BNPB) | `fa-house-crack` |
| 129 | Posko Bencana Alam | `fa-tent` |
| 123 | Perusahaan Listrik Negara (PLN) - gangguan listrik | `fa-bolt` |

Modal ditutup lewat tombol silang, klik area latar, atau tombol `Esc`. Data ini statis di `public.html` (tidak bergantung backend) sehingga tetap tersedia meski koneksi bermasalah.

---

## 🧩 Mengubah Informasi RT

Semua identitas RT (nama, nomor RT/RW, kelurahan, kecamatan, kota, tahun footer, contoh alamat) diatur di satu file: **`config.js`**. Ubah nilai di dalam objek `RT_CONFIG`, lalu simpan — perubahan otomatis berlaku di `index.html` dan `public.html`.

```js
window.RT_CONFIG = {
    // Naikkan versi ini setiap kali mengubah config.js (mis. '2', '3', ...).
    // Halaman akan membandingkannya dan hard-refresh otomatis bila berbeda.
    version: '4',
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
    publicPortalUrl: 'https://rt017.pages.dev/',

    // Daftar pilihan "Jenis Surat" untuk fitur Pengajuan Surat (dipakai
    // form warga di public.html & panel admin di index.html). Ubah sesuai
    // kebutuhan, lalu naikkan `version` di atas.
    jenisSurat: [
        'Surat Pengantar KTP-el',
        'Surat Pengantar Kartu Keluarga (KK)',
        'Surat Pengantar Pindah Keluar',
        'Surat Pengantar Kedatangan Warga',
        'Surat Pengantar Akta Kelahiran',
        'Surat Keterangan Kematian',
        'Surat Keterangan Tidak Mampu (SKTM)',
        'Surat Keterangan Domisili (Perorangan)',
        'Surat Keterangan Domisili Usaha',
        'Surat Keterangan Belum Menikah / Pengantar Nikah',
        'Surat Pengantar SKCK',
        'Surat Keterangan Izin Keramaian / Acara Warga',
        'Lainnya'
    ],

    // Status pengurusan surat (diubah pengurus di halaman admin).
    statusSurat: ['Pending', 'Diproses', 'Selesai', 'Ditolak']
};
```

> **Portal Publik tanpa URL panjang:** isi `publicApiUrl` dengan URL Web App Anda. Setelah itu tautan yang dibagikan ke warga cukup **`public.html`** (URL Apps Script tidak tampil di address bar). Bila Anda memakai domain kustom (mis. Cloudflare Pages), isi juga `publicPortalUrl` dengan URL tersebut agar tautan & tombol "Buka Portal" di menu admin mengarah ke sana. `public.html` tetap mendukung `?url=...` sebagai fallback bila `publicApiUrl` masih kosong. `config.js` dimuat dengan cache-bust dan tombol **Muat Ulang** melakukan *hard refresh*, sehingga perubahan config selalu terbaru. Pemuatan config juga menunggu (*readiness gate*) agar tidak ada kedipan "belum dikonfigurasi".

> **Auto hard refresh (versi config):** setiap kali mengubah `config.js`, naikkan `version` **dan** samakan `EXPECTED_CONFIG_VERSION` di `index.html` & `public.html`. Bila browser masih memegang HTML lama (versi tak cocok), halaman otomatis melakukan *hard refresh* sekali agar HTML & config sinkron; ada pengaman anti-loop, jadi tidak akan reload berulang.

> Pastikan file `config.js` ikut diunggah saat publikasi.

---

## 🌐 Publikasi & Kontrol Akses (Cloudflare Pages + Access)

Aplikasi dipublikasikan melalui **Cloudflare Pages** (project dari repository ini), mis. `https://rtlontar.pages.dev`:

| URL | Konten | Akses |
|-----|--------|-------|
| `/` dan `/index.html` | Halaman **admin** | **Login Cloudflare Access** (hanya email yang diizinkan) |
| `/public` dan `/public.html` | Portal publik warga | Terbuka (tanpa login) |
| `/config.js`, `/rt-icon.png` | Aset pendukung | Terbuka (tanpa login) |

> **GitHub Pages dimatikan** agar halaman admin tidak bisa diakses lewat `saladimu.github.io`. Bagikan portal publik hanya lewat `https://rtlontar.pages.dev/public` (tanpa ekstensi `.html`). Wrapper `rt017.pages.dev` mengarah ke URL tersebut.

### Menyiapkan Cloudflare Zero Trust (sekali saja)

1. Buka `one.dash.cloudflare.com`, buat *team name* bila belum ada.
2. **Integrations → Identity providers → Add new identity provider → One-time PIN** (kode dikirim ke email, tanpa setup). Tambahkan juga **Google** bila perlu.

   > **Penting:** organisasi Zero Trust **baru** hanya punya *identity provider* **Cloudflare** secara default, dan **One-time PIN tidak lagi aktif otomatis**. Halaman lama **Settings → Authentication → Login methods** sudah tidak ada. Jika One-time PIN belum ditambahkan di sini, halaman login hanya menampilkan tombol **"Sign in with: Cloudflare"** (tanpa kolom email), sehingga menambahkan email ke policy tidak akan berpengaruh.
3. **Access controls → Applications → Add an application → Self-hosted**, buat **dua** aplikasi (biarkan **Accept all available identity providers** tetap aktif di tab *Authentication*):

   **a. `RT Admin`** (melindungi admin)
   - Public hostname: `rtlontar.pages.dev` — Path `/`
   - Tambah hostname kedua: `rtlontar.pages.dev` — Path `/index.html`
   - Policy: Action **Allow**, Include → **Emails** → email admin. Session duration mis. `24 hours`.

   **b. `RT Public Assets`** (mengecualikan aset publik)
   - Public hostname: `rtlontar.pages.dev` — Path `/public`
   - Tambah hostname: Path `/public.html`, `/config.js`, `/rt-icon.png`
   - Policy: Action **Bypass**, Include → **Everyone**.

4. **Simpan.** Perubahan berlaku langsung, tanpa redeploy.

> **Penting:** Cloudflare Pages mengalihkan `/public.html` → `/public` (HTTP 308). Karena itu path **`/public`** wajib ikut di-bypass, bukan hanya `/public.html`. Namun **jangan** bypass path `/` atau `/index.html`.

### Menambah pengguna yang boleh mengakses admin

1. Zero Trust → **Access controls → Applications → `RT Admin` → Edit** (bagian *Policies*).
2. Buka policy **RT Admins** → **Include → Add a rule**.
3. Pilih selector:
   - **Emails** → tulis email pengguna (beberapa email dipisah koma) — harus sama dengan email yang dipakai untuk login.
   - **Emails ending in** → `@domain.com` untuk seluruh domain (mis. Google Workspace).
   - **Access Groups** → grup reusable yang dibuat di **Access controls → Access groups**.
4. **Save** — akses berlaku seketika.
5. Pengguna membuka `https://rtlontar.pages.dev/` di jendela *incognito* → masukkan email → klik **Send login code** → masukkan kode PIN dari email → dashboard admin terbuka.

### Masa berlaku sesi & mencabut akses

Login **bukan sekali pakai**. Setelah PIN dimasukkan, Cloudflare Access menerbitkan *session cookie* yang berlaku selama **Session Duration** aplikasi:

- Selama sesi masih aktif, membuka `https://rtlontar.pages.dev/` kembali akan **langsung masuk tanpa email/PIN** (SSO).
- Setelah sesi kedaluwarsa, pengguna diminta email + PIN lagi. (PIN-nya sendiri tetap sekali pakai; yang berulang adalah sesinya.)
- **Session Duration** diatur di Zero Trust → **Access controls → Applications → `RT Admin` → Edit → Details → Session Duration** (default umumnya `24 hours`).
- Terpisah dari itu, **token admin** (`ADMIN_TOKEN`) disimpan di `localStorage` browser dan tetap ada sampai dibersihkan — jadi dashboard tidak meminta token setiap kali.

**Mencabut akses pengguna:**

1. Hapus email dari policy **RT Admins** → **Save**. Ini mencegah login **baru**, tetapi pengguna yang sedang login **tetap bisa masuk sampai sesinya kedaluwarsa**.
2. Untuk memblokir **seketika**, buka Zero Trust → **Access controls → Active sessions** → cari sesi pengguna → **Revoke**.

> **Jika `public.html` kembali meminta login:** pastikan path **`/public`** sudah terdaftar di aplikasi *Bypass* **`RT Public Assets`**.

> **Catatan keamanan (berlapis):** proteksi halaman admin ada di Cloudflare Access; proteksi data tetap ada di token backend (`ADMIN_TOKEN`). Data warga/kas tidak pernah dikirim ke portal publik berkat endpoint `readPublic`, dan toggle **Portal Publik ON/OFF** ditegakkan di sisi server.
