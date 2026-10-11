# 🏢 SAPA RT - Dashboard RT Tanjung Duren Utara

SAPA (**Sistem Administrasi & Pelayanan Antarwarga**) adalah Sistem Informasi & Dashboard Management RT (Rukun Tetangga) berbasis web yang responsif, modern, dan mudah digunakan. Didesain khusus untuk pengurus dan warga RT di wilayah Tanjung Duren Utara. Sistem ini menggunakan **Google Sheets** sebagai *database* tanpa memerlukan *server/backend* yang rumit.

---

## 🚀 Fitur Utama

- **📊 Ringkasan / Dashboard:** Menampilkan statistik **Total Warga** dalam format `jiwa / No. KK unik (KK)` (mis. `12 / 4 (KK)`), saldo kas berjalan, pengumuman terbaru, dan kegiatan mendatang.
- **👥 Pendataan Warga:** Pengelolaan data penduduk (Nomor KK, Nama Lengkap, NIK, Tempat & Tanggal Lahir, Status dalam Keluarga & Jenis Kelamin, Pendidikan & Pekerjaan, No. HP, Status Tempat Tinggal, Alamat/No Rumah — sesuai urutan form) dilengkapi kolom **Usia** otomatis (dihitung dari Tanggal Lahir, tidak disimpan ke database). Tabel tampil **ringkas dengan kolom bertumpuk** (mis. "Nama Lengkap / Usia", "NIK / No. HP") sehingga lebih banyak data terlihat tanpa scroll horizontal, dengan fitur pencarian, filter status, **Edit & Hapus** dengan warning dialog.
- **🪪 Isi otomatis dari NIK:** saat mengisi **NIK 16 digit** di form Tambah/Edit Warga, kolom **Jenis Kelamin** & **Tanggal Lahir** otomatis terisi dari NIK (laki-laki: digit ke-7/8 = `01-31`; perempuan: `41-71` = `40 + tanggal`; tahun 2 digit ditebak `<= tahun berjalan` → `20YY`, selain itu `19YY`). Memperbaiki digit NIK (mis. salah hari) otomatis memperbarui kembali **Jenis Kelamin**/**Tanggal Lahir** selama kolom tersebut belum diubah manual; isian yang sudah dikoreksi manual **tidak** tertimpa (muncul catatan di bawah kolom NIK), dan tombol **Isi dari NIK** dapat menimpa paksa. Bila NIK 16 digit namun tanggal di dalamnya tidak valid (mis. bulan 13 / 30 Feb), muncul peringatan dan isian tidak diubah. NIK hanya menerima angka (maks. 16 digit).
- **💬 Chat WhatsApp & Telepon dari No. HP (saat Edit):** buka detail record lewat **Edit** untuk menampilkan tombol **Chat WhatsApp** & **Telepon** di bawah kolom No. HP — berlaku pada form **Data Warga** maupun **Pengajuan Surat**. Tombol ini **hanya aktif saat mengedit** record (saat menambah record disembunyikan), dan tautan mengikuti nomor yang sedang tampil — jadi pengurus dapat langsung menghubungi warga tanpa menyalin nomor. Nomor dinormalisasi ke format `62...` (mis. `0812...` → `62812...`); bila nomor belum/kurang valid saat mengedit, muncul petunjuk singkat.
- **🔢 Format No. HP (tampilan):** pada tabel record (**Data Warga** & **Pengajuan Surat**), No. HP ditampilkan berkelompok **3-3-4** agar mudah dibaca, mis. `0812345678` → `081-234-5678` (nomor lebih panjang melanjutkan grup berikutnya). Ini **hanya tampilan** — nilai yang tersimpan di Sheets dan tautan WhatsApp/Telepon tetap memakai digit asli.
- **🔒 Input No. HP hanya angka:** semua kolom **No. HP / WhatsApp** (form Warga & Pengajuan Surat di admin, serta form pengajuan & cek status di Portal Publik) hanya menerima **angka** (maks. 15 digit); huruf dan simbol otomatis dibuang saat diketik/di-tempel, sehingga nomor tidak bisa diisi karakter yang tidak valid.
- **💰 Iuran & Kas RT:** Pencatatan arus kas (Pemasukan & Pengeluaran) beserta akumulasi saldo akhir secara terotomatisasi. **Edit & Hapus** tersedia.
- **🗓️ Filter Periode Kas:** Riwayat transaksi dapat ditampilkan **per bulan** (default), **per tanggal**, atau **semua data**. Kartu ringkasan (Total Pemasukan, Total Pengeluaran, Saldo Akhir) mengikuti periode yang dipilih. Pilihan tersimpan di browser.
- **📢 Pengumuman RT:** Papan informasi digital resmi untuk menyebarkan imbauan dan berita penting. **Edit & Hapus** tersedia.
- **📅 Kegiatan Warga:** Agenda kerja bakti, posyandu, siskamling, dan acara komunitas RT. **Edit & Hapus** tersedia.
- **🔄 Refresh Data Manual & Notifikasi Versi Baru:** Tombol refresh tersedia di header desktop/mobile. Di sidebar kiri (tepat di bawah indikator status `Google Sheets:`) terdapat tombol **Muat Ulang** yang **tersembunyi secara normal** dan **muncul berkedip hanya bila terdeteksi ada versi/update baru** (mis. `version` pada `config.js` atau `APP_BUILD` pada HTML naik); pada tampilan ponsel, ikon refresh di header juga ikut berkedip. Aplikasi memeriksa versi secara berkala (dan saat tab kembali aktif), sehingga pengurus bisa langsung memuat ulang. Portal publik juga menandai tombol **Muat Ulang** saat ada versi baru.
- **📝 Format Tanggal `dd-mm-yyyy`:** Semua kolom tanggal pada form tambah/edit (Warga, Kas, Pengumuman, Kegiatan) memakai format `dd-mm-yyyy` dengan mask otomatis; nilai kanonik tetap disimpan sebagai `yyyy-MM-dd` di Sheets.
- **🔎 Pencarian & Filter:** Tabel **Data Warga** memakai **kotak pencarian di atas tabel** yang menjangkau seluruh kolom (nama, NIK, No. HP, tempat/tanggal lahir, usia, status, pendidikan, pekerjaan, alamat) plus **filter Status Tempat Tinggal** (Tetap/Kontrak). Tabel **Iuran/Kas** menampilkan satu **baris filter per kolom** tepat di bawah header (Tanggal, Nama, No. Rumah, Jenis, Nominal, Catatan). Pencarian bersifat *contains* (tidak peduli huruf besar/kecil). Jumlah record warga yang ditemukan tampil di samping header **No. KK** dalam tanda kurung, mis. `No. KK (12)`.
- **🔗 Integrasi Google Apps Script:** Pengiriman data form langsung terhubung ke Google Sheets, **sync delete**, dengan *fallback* **localStorage** jika dijalankan tanpa internet/koneksi backend.
- **⚠️ Delete Persistence:** Sistem melacak record yang dihapus agar tidak muncul kembali setelah reload/sync.
- **🔐 Token Admin:** Semua operasi tulis (tambah/edit/hapus) dan baca lengkap wajib menyertakan token rahasia (`ADMIN_TOKEN` di Script Properties). Tanpa token, server menolak permintaan sehingga orang yang hanya tahu URL tidak bisa mengubah data.
- **🛡️ Halaman Admin Terlindungi (Cloudflare Access):** halaman admin (`/` & `/index.html`) hanya bisa dibuka oleh email yang diizinkan melalui login Cloudflare Zero Trust; portal publik tetap terbuka tanpa login. Lihat bagian **Publikasi & Kontrol Akses**.
- **📲 Pasang sebagai Aplikasi (PWA):** halaman admin maupun Portal Publik bisa dipasang ke layar utama Android/iOS atau desktop (masing-masing punya manifest sendiri — `manifest.webmanifest` untuk admin, `manifest-public.webmanifest` untuk publik — plus service worker `sw.js`). Tombol **Pasang Aplikasi** muncul otomatis di sidebar admin dan tombol **Pasang** di header portal publik saat browser mendukung (Chrome/Edge Android & desktop); di iPhone/iPad tombol menampilkan petunjuk **Bagikan (Share) → Tambahkan ke Layar Utama**. Setelah dipasang, aplikasi dibuka layar penuh (*standalone*). Berkas PWA portal publik (`/manifest-public.webmanifest`, `/sw.js`, `/icon-192.png`) wajib ikut di-bypass Cloudflare Access (lihat **Publikasi & Kontrol Akses**).
- **🕵️ Portal Publik Terisolasi:** `public.html` memakai endpoint `readPublic` yang hanya mengembalikan Pengumuman & Kegiatan ber-`Publik=Ya`; data warga & kas tidak pernah dikirim ke portal publik.
- **🧾 Isi form surat otomatis dari Data Warga (bantu warga):** pada **Layanan Surat**, kolom **NIK (16 digit)** berada di **paling atas**. Begitu NIK valid dimasukkan, sistem mencari NIK di **Data Warga** (`action=lookupWarga`) — bila ketemu, **Nama Lengkap & Alamat/No. Rumah** terisi otomatis **dan terkunci** (hanya tampilan, tidak dapat diubah), sedangkan **No. HP/WhatsApp** ditampilkan **tersamar namun tetap dapat diperiksa/diubah** (mis. `0812••••7890`; ketuk kolom untuk melihat nomor aslinya) — nomor asli tetap dikirim saat submit. Bila NIK **tidak terdaftar**, muncul info bahwa NIK tidak ada di data warga dan form **tetap dapat diisi manual** lalu dikirim.
- **🌗 Tema Terang/Gelap (Portal Publik):** `public.html` punya tombol tema di header untuk beralih mode terang/gelap. Pilihan disimpan di `localStorage` (`rt_theme`) dan default mengikuti preferensi sistem, tanpa kedipan saat dibuka.
- **🚨 Nomor Siaga Darurat (Portal Publik):** tombol ikon di header `public.html` membuka daftar **Nomor Siaga Darurat Utama** (112, 110, 113, 118/119, 115, 117, 129, 123) lengkap dengan ikon per layanan. Setiap nomor dapat diketuk untuk langsung menelepon (`tel:`).
- **🔒 ON/OFF Portal Publik:** Toggle di tab Portal Publik untuk mengaktifkan/menonaktifkan akses warga. Saat OFF, server menolak `readPublic` sehingga data benar-benar tidak bisa diakses (bukan sekadar menyembunyikan tautan).
- **🗓️ "Terakhir diperbarui" dari tanggal data (Portal Publik):** label **Terakhir diperbarui:** pada `public.html` kini menampilkan **tanggal paling baru** dari **Pengumuman & Agenda Kegiatan Warga** yang tampil publik (format `dd-Mmm-yyyy`), bukan lagi jam perangkat pengunjung; bila belum ada data ditampilkan `-`.
- **↩️ Tombol "Back" Android menutup modal / kembali tab (bukan keluar aplikasi):** tombol/swipe **Back** di perangkat Android kini memakai History API — menekan Back saat ada modal terbuka akan **menutup modal** itu, di halaman admin Back berikutnya **kembali ke tab sebelumnya**, dan baru keluar saat sudah di tab utama tanpa modal. Berlaku di halaman admin (`index.html`) dan Portal Publik (`public.html`, untuk modal Siaga / Panduan Surat / Tentang).
- **⚡ Loading Cepat:** CSS Tailwind dibangun statis (`tailwind.css`, ~35 KB) alih-alih memuat Play CDN yang berat, plus `preconnect` ke font/CDN/endpoint data. Lihat bagian **Performa (Tailwind CSS Statis)**.

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
5. Salin Web App URL, lalu isi ke `publicApiUrl` pada `config.js` (lihat bagian **Konfigurasi Terpusat**)
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
- ✅ **Fitur Pengajuan Surat (backend v11)** — tab `Pengajuan_Surat` (dibuat otomatis), aksi publik `submitSurat` (tanpa token; validasi NIK 16 digit, honeypot, rate limit 5/jam per NIK), notifikasi email admin (Script Property `ADMIN_EMAIL`), `Status` default `Pending`, **No. Pengajuan konsisten `SRT-<yymmdd>-XXXX`** untuk semua jalur (publik & catat manual admin), serta **panel admin** untuk melihat/mencatat/mengubah status/menghapus & memfilter pengajuan
- ✅ **Kolom baru `Data_Warga`**: `Nomor KK`, `Status`, `Jenis Kelamin`, `Pendidikan`, `Pekerjaan` (urutan: Nomor KK → Nama Lengkap → Status → Jenis Kelamin → NIK → Tempat/Tanggal Lahir → Pendidikan → Pekerjaan → No HP → Status Tinggal → Alamat); migrasi otomatis berbasis **nama header** (`migrateDataWargaLayout()`), aman dijalankan berulang
</details>

### Langkah Deployment Web App:
1. Klik tombol **Deploy > New Deployment**.
2. Pilih tipe **Web app**.
3. Atur *Execute as*: **Me** (Email Anda).
4. Atur *Who has access*: **Anyone** (Siapa saja).
5. Klik **Deploy**, lalu salin **Web App URL** yang didapat.
6. Di Apps Script, buka **Project Settings > Script Properties**, tambahkan properti **`ADMIN_TOKEN`** dengan nilai rahasia pilihan Anda. (Opsional) tambahkan **`ADMIN_EMAIL`** berisi email admin — bila diisi, setiap pengajuan surat baru dari portal publik akan dikirimkan notifikasi email. Bila mengisi `ADMIN_EMAIL`, jalankan fungsi **`authorizeMail`** sekali dari editor (Run > Review permissions > Allow) lalu deploy **New version** agar izin email aktif (lihat bagian **Notifikasi Email ke Admin**).
7. Buka aplikasi web RT, masuk ke tab **Integrasi Google Sheets**, isi **Token Admin** dengan nilai `ADMIN_TOKEN` yang sama lalu klik **Simpan Token**. URL sumber data tidak lagi diisi dari UI — atur lewat **`publicApiUrl` di `config.js`** (dan proxy `/api` bila memakai Cloudflare Pages).

> **Penting:** setiap kali `code.gs` diubah, buat versi baru melalui **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. Tanpa ini, Web App masih menjalankan kode lama.

### Membaca data dari Google Sheets
Aplikasi akan otomatis memuat data dari Google Sheets saat dibuka (memakai `publicApiUrl` di `config.js`, lewat proxy `/api` bila aktif) menggunakan `doGet` + JSONP. Anda juga dapat menekan tombol **Muat Data dari Sheets** di **Setting → Integrasi Google Sheets** atau **tombol Refresh 🔄** di header untuk menyegarkan data kapan saja.

> **Sumber Data Aktif:** di **Setting → Integrasi Google Sheets** terdapat kartu ringkasan yang menampilkan **Transport**, **Web App URL** yang dipakai, dan **Versi backend** (terisi otomatis setelah sinkronisasi, atau tekan **Cek Versi Backend**). Berguna untuk memastikan aplikasi membaca dari deployment/spreadsheet yang benar.
>
> Dua endpoint berasal dari `config.js`: **proxy** dari `apiBase` (mis. `/api`) dan **langsung/direct** dari `publicApiUrl` (URL Web App `.../exec`). Keduanya menuju Web App Apps Script yang sama; proxy dicoba lebih dulu.
>
> Semua nilai **Transport** yang mungkin muncul:
>
> | Nilai Transport | Arti |
> |---|---|
> | `Proxy /api (active) · fallback: direct` | Proxy `/api` berhasil & sedang dipakai; URL langsung (`publicApiUrl`) tersedia sebagai cadangan. |
> | `Proxy /api (active)` | Proxy `/api` berhasil & dipakai; tidak ada URL langsung ( `publicApiUrl` kosong). |
> | `Direct to Apps Script (active)` | Proxy `/api` gagal/tidak tersedia, sehingga otomatis jatuh ke URL langsung (`publicApiUrl`). |
> | `Proxy /api (fallback: direct)` | Belum ada permintaan sukses; proxy `/api` dikonfigurasi dengan cadangan langsung. |
> | `Proxy /api` | Belum tersambung; hanya proxy ( `apiBase` ) yang dikonfigurasi. |
> | `Direct to Apps Script` | Belum tersambung; hanya URL langsung ( `publicApiUrl` ) yang dikonfigurasi. |
> | `Not configured (local mode)` | `apiBase` & `publicApiUrl` sama-sama kosong; aplikasi berjalan dalam mode lokal (localStorage). |

### Edit & Delete Data
Semua modul (Warga, Kas, Pengumuman, Kegiatan) sekarang memiliki tombol **Edit** ✏️ dan **Hapus** 🗑️ di setiap record.
- **Hapus**: Data warga akan menampilkan warning dialog detail sebelum dihapus.
- **Edit**: Modal akan terbuka dengan data yang sudah terisi, klik simpan untuk menyimpan perubahan.
- **Delete Sync**: Penghapusan dilakukan di Google Sheets dulu, jika gagal data lokal tidak berubah.

### Pencarian & Filter (Cari Data)
Tabel **Data Warga** menyaring lewat **kotak pencarian di atas tabel** yang menjangkau seluruh kolom (Nama, NIK, No. HP, Tempat/Tanggal Lahir, Usia, Status, Pendidikan, Pekerjaan, Alamat) serta **filter Status Tempat Tinggal** (Tetap/Kontrak). Tabel **Iuran & Kas RT** menyaring lewat satu **baris filter per kolom** tepat di bawah header (Tanggal, Nama, No. Rumah, Jenis, Nominal, Catatan). Pencarian bersifat *contains* (mengandung kata kunci, tidak peduli huruf besar/kecil). **Jumlah data warga yang ditemukan** ditampilkan di samping header **No. KK** dalam tanda kurung, contoh `No. KK (12)`, dan ikut berubah mengikuti filter. Untuk **menambah** data, gunakan tombol **Tambah Data Warga** / **Catat Transaksi Kas** (membuka modal).

### Pengajuan Surat (Portal Publik & Admin)

Warga dapat mengajukan surat keterangan/pengantar langsung dari **Portal Publik** (bagian **Layanan Surat**):

- **Ajukan Surat Baru:** kolom pertama adalah **NIK (16 digit)**. Begitu NIK valid dimasukkan, aplikasi mencari NIK tersebut di **data warga** (`action=lookupWarga`): bila **ketemu**, kolom **Nama Lengkap & Alamat/No. Rumah** terisi otomatis **dan terkunci (hanya tampilan — tidak dapat diubah)** beserta keterangan *"Data warga ditemukan: <nama>"*, sedangkan **No. HP/WhatsApp** ditampilkan **tersamar** (contoh `0812••••7890`) **namun tetap dapat diperiksa/diubah** — cukup ketuk kolom untuk menampilkan & mengedit nomor aslinya (mis. bila berbeda dari nomor yang akan dipakai untuk Cek Status); bila diketik tanpa diubah, tampilan kembali tersamar otomatis dan **nilai asli tetap yang dikirim**. Bila **tidak terdaftar**, muncul info *"NIK tidak terdaftar dalam data warga"* dan warga **tetap dapat mengisi seluruh kolom secara manual**. Selanjutnya warga memilih **Jenis Surat** (daftar dari `RT_CONFIG.jenisSurat` di `config.js`) dan menulis **Keperluan**. Setelah terkirim, warga menerima **nomor pengajuan** (contoh `SRT-261006-AB12`) untuk disimpan.
- **Cek Status Pengajuan:** warga memasukkan **NIK + No. HP/WhatsApp** yang sama seperti saat mengajukan untuk melihat status (`Pending` / `Diproses` / `Selesai` / `Ditolak`) beserta catatan pengurus. Nomor HP **boleh ditulis dengan awalan `0` maupun `62`** (mis. `081234567890` atau `6281234567890`), berspasi, atau bertanda hubung — sistem menormalkannya otomatis sehingga tetap cocok.

Kolom **NIK** pada kedua form hanya menerima angka (maks. 16 digit) dan **divalidasi otomatis mengikuti aturan Data Warga**: mengecek panjang 16 digit, jenis kelamin (digit ke-7/8 `01-31` untuk laki-laki, `41-71` untuk perempuan), bulan (1-12), serta jumlah hari per bulan. Petunjuk muncul di bawah kolom (jumlah digit, **NIK valid**, atau **Harap periksa ulang NIK** bila tanggal di dalam NIK tidak wajar, mis. bulan 13 atau 30 Februari) sehingga salah ketik bisa langsung diperbaiki sebelum dikirim.

Kedua kartu (**Ajukan Surat Baru** & **Cek Status Pengajuan**) dapat dibuka/ditutup (*collapse/toggle*) dengan mengeklik judulnya, sehingga tampilan lebih ringkas di layar kecil. Secara default keduanya **tertutup** saat halaman dibuka; warga mengeklik judul untuk menampilkan formulir.

Di samping judul **Layanan Surat** terdapat **ikon panduan** (`fa-circle-info`). Mengeklik ikon ini membuka jendela **Panduan Layanan Surat** berisi langkah-langkah berurutan (dari mengisi formulir pengajuan, menyimpan nomor pengajuan, hingga cek status dan membaca No. Surat), lengkap dengan tips (NIK & No. HP harus sama persis, batas 5 pengajuan/jam, dan keamanan data pribadi). Jendela dapat ditutup lewat tombol X, tombol **Mengerti**, klik latar, atau tombol **Esc**.

Pengamanan server-side: hanya menerima **tambah data** (tidak bisa mengubah/menghapus), memaksa status awal `Pending`, memvalidasi NIK/HP, menyaring bot lewat *honeypot*, dan membatasi **maksimal 5 pengajuan per NIK per jam**. Data tab `Pengajuan_Surat` **tidak pernah** ikut terkirim pada `readPublic`. Pencarian data warga (`lookupWarga`) hanya membuka **Nama, No. HP, & Alamat** satu warga untuk NIK yang dicari (bukan seluruh tabel), mengikuti status ON/OFF portal, dan dibatasi **20 pencarian per NIK per jam**. Nomor HP yang diperoleh dari data warga ditampilkan **tersamar** pada form (tetap dapat diperiksa/diubah warga; nilai tersamar diterjemahkan kembali ke nomor asli saat submit), sedangkan **Nama & Alamat hanya tampil** dan tidak dapat diubah.

Bila Script Property **`ADMIN_EMAIL`** diisi, setiap pengajuan baru akan dikirimi **notifikasi email** ke admin. Bila Portal Publik dimatikan (toggle di halaman admin), form pengajuan & cek status otomatis disembunyikan dan ditolak oleh server.

#### Mengelola Pengajuan di Halaman Admin

Menu **Pengajuan Surat** pada dashboard admin menampilkan seluruh pengajuan (terbaru di atas) beserta kartu ringkasan jumlah per status:

- **Catat Pengajuan**: menambah pengajuan secara manual (mis. permohonan langsung/lisan) dengan tombol **Catat Pengajuan**. Bila ada isian yang salah (mis. NIK kurang dari 16 digit), pesan error muncul **di dalam modal** dan field yang bermasalah disorot.
- **No. Pengajuan**: setiap baris menampilkan nomor pengajuan (kolom `ID`, mis. `SRT-261006-AB12`). Nomor ini dibuat dengan format yang **sama** baik untuk pengajuan dari Portal Publik maupun **pencatatan manual admin** (`Catat Pengajuan`), sehingga konsisten dan mudah dicocokkan.
- **No. HP / WhatsApp**: nomor HP pada tabel ditampilkan sebagai **teks biasa** (terformat 3-3-4). Untuk menghubungi pemohon, buka **Edit** — tombol **Chat WhatsApp** (`https://wa.me/...`) & **Telepon** tampil di bawah kolom No. HP pada modal edit (seragam dengan form Data Warga). Nomor dinormalisasi otomatis ke format internasional (`08...` → `628...`, `+62`/spasi/tanda hubung dirapikan). Bila nomor tidak valid/kosong, tombol disembunyikan dan muncul petunjuk singkat.
- **No. Surat**: field baru **di bawah No. Pengajuan** pada modal edit untuk mencatat **nomor surat resmi** (mis. `474/017-RT/RW.06/X/2026`). Field ini **wajib diisi saat status diubah menjadi `Selesai`** — baik lewat modal maupun tombol ubah status cepat (yang akan otomatis membuka modal bila nomornya masih kosong). Server juga menolak simpan `Selesai` tanpa No. Surat. Setelah diisi, **No. Surat tampil bertumpuk di bawah Jenis Surat** pada tabel (ditandai ikon) sehingga mudah dipantau, dan nomor ini juga ikut tampil pada hasil **Cek Status** warga dengan sorotan warna terang (kuning/amber) agar mudah terlihat.
- **Edit**: klik baris (atau ikon pensil) untuk membuka modal dan mengubah data, **Status Pengurusan** (`RT_CONFIG.statusSurat`), **No. Surat**, dan **Catatan Pengurus**. Modal juga menampilkan No. Pengajuan & tanggal pengajuan. **NIK & No. HP terkunci (hanya-baca) saat mengedit** karena warga memakai kedua data tersebut untuk **Cek Status** — nilainya tidak boleh berubah agar pencarian status tetap cocok. Kedua kolom tetap dapat diisi saat **Catat Pengajuan** baru.
- **Ubah Status cepat**: ikon putar menggilir status `Pending → Diproses → Selesai → Ditolak → Pending`.
- **Hapus**: ikon tempat sampah (dengan konfirmasi).
- **Filter & cari**: saring berdasarkan status dan cari berdasarkan no. pengajuan / No. Surat / nama / NIK / jenis surat. NIK disamarkan pada tabel (contoh `3173••••••01`).

Semua operasi tulis dari admin memakai **token admin** (`ADMIN_TOKEN`) seperti modul lain.

#### Notifikasi Email ke Admin

Email otomatis dikirim **hanya untuk pengajuan yang masuk dari Portal Publik** (bukan untuk entri manual admin). Cara mengaktifkan:

1. Buka **Project Settings > Script Properties** pada Apps Script, tambahkan properti **`ADMIN_EMAIL`** berisi alamat email admin. (Jangan ditulis di dalam `code.gs` — nilainya dibaca dari Script Properties saat runtime.)
2. (Opsional) Tambahkan **`NOTIF_SENDER_NAME`** untuk mengatur **nama pengirim** yang tampil di kotak masuk (default **`Pengajuan surat`**), **`NOTIF_REPLY_TO`** untuk mengatur alamat **Reply-To** (default memakai nilai `ADMIN_EMAIL`, sehingga balasan otomatis mengarah ke admin), dan **`NOTIF_SUBJECT_PREFIX`** untuk mengatur prefiks subjek email (default **`[SAPA-RT]`**). Ketiganya dapat diubah kapan saja tanpa menyentuh kode.
3. Buka editor **Apps Script**, pilih fungsi **`authorizeMail`** pada dropdown lalu klik **Run** > **Review permissions** > **Allow**. Langkah ini memberi izin scope `script.send_mail` (kirim email) pada akun pemilik; tanpa ini, email gagal dengan error *"You do not have permission to call MailApp.sendEmail"*. Setelah itu deploy ulang sebagai **New version**.
4. Uji dari dashboard: buka menu **Pengajuan Surat** lalu klik **Tes Email Admin**. Bila berhasil, email uji terkirim; bila `ADMIN_EMAIL` belum diatur, muncul pesan error yang menjelaskan.

Untuk menguji alur lengkap, kirim pengajuan dari Portal Publik menggunakan NIK & No. HP asli; email notifikasi akan dikirim ke `ADMIN_EMAIL`.

> **Siapa pengirimnya?** Email dikirim oleh `MailApp` atas nama **akun Google pemilik/pendeploy Apps Script** (*Execute as: Me*), bukan oleh warga dan bukan dari server email terpisah. Alamat **From** selalu alamat akun tersebut; `NOTIF_SENDER_NAME` hanya mengubah **nama tampilan**, dan `NOTIF_REPLY_TO` mengatur ke mana balasan diarahkan. Pengiriman memakai kuota email akun Google tersebut (Gmail pribadi ±100 penerima/hari, Google Workspace ±1.500/hari).

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

Semua identitas RT (nama aplikasi & nama panjang, nomor RT/RW, kelurahan, kecamatan, kota, alamat kawasan, tahun footer, contoh alamat) diatur di satu file: **`config.js`**. Ubah nilai di dalam objek `RT_CONFIG`, lalu simpan — perubahan otomatis berlaku di `index.html` dan `public.html`.

```js
window.RT_CONFIG = {
    // Naikkan versi ini setiap kali mengubah config.js (mis. '2', '3', ...).
    // Halaman akan membandingkannya dan hard-refresh otomatis bila berbeda.
    version: '7',
    appName: 'SAPA RT',
    appLongName: 'Sistem Administrasi & Pelayanan Antarwarga',
    // Versi rilis yang tampil di footer (mis. 'v1.0.0', 'v1.2.0'). Ini label
    // rilis untuk manusia — berbeda dari `version` (penanda sinkronisasi config)
    // dan `APP_BUILD` (penanda build HTML). Naikkan saat ada rilis penting.
    appVersion: 'v1.0.0',
    rt: '017',
    rw: '06',
    kelurahan: 'Tanjung Duren Utara',
    kecamatan: 'Grogol Petamburan',
    kota: 'Jakarta Barat',
    provinsi: 'DKI Jakarta',
    // Nama kawasan / jalan tempat RT (hanya untuk tampilan).
    alamatrt: 'Lontar Barat',
    tahun: new Date().getFullYear(),
    alamatContoh: 'Jl. Lontar Barat No. 06',
    lokasiContoh: 'Depan lapangan',

    // URL Web App Google Apps Script (berakhiran /exec) untuk Portal Publik.
    // Dipakai sebagai jalur cadangan (fallback) bila proxy same-origin tidak aktif.
    publicApiUrl: 'https://script.google.com/macros/s/xxxx/exec',

    // Path proxy same-origin (Cloudflare Pages Function) ke Apps Script.
    // Default '/api' mengarah ke functions/api/[[path]].js. Halaman memanggil
    // endpoint same-origin ini lebih dulu, lalu otomatis jatuh ke publicApiUrl
    // bila proxy tidak tersedia. Kosongkan ('') untuk selalu memakai publicApiUrl.
    apiBase: '/api',

    // URL halaman Portal Publik yang dibagikan ke warga.
    // Satu domain dengan admin; admin dikunci Cloudflare Access pada path
    // "/" & "/index.html", sedangkan "/public" + aset publik di-bypass.
    // Kosongkan ('') untuk memakai public.html.
    publicPortalUrl: 'https://sapa-rt017.pages.dev/public',

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

> **Portal Publik tanpa URL panjang:** isi `publicApiUrl` dengan URL Web App Anda. Setelah itu tautan yang dibagikan ke warga cukup **`public.html`** (URL Apps Script tidak tampil di address bar). Isi juga `publicPortalUrl` dengan URL portal publik Anda (mis. `https://sapa-rt017.pages.dev/public`) agar tautan & tombol "Buka Portal" di menu admin mengarah ke sana. `public.html` tetap mendukung `?url=...` sebagai fallback bila `publicApiUrl` masih kosong. `config.js` dimuat dengan cache-bust dan tombol **Muat Ulang** melakukan *hard refresh*, sehingga perubahan config selalu terbaru. Pemuatan config juga menunggu (*readiness gate*) agar tidak ada kedipan "belum dikonfigurasi".

> **Proxy same-origin (anti-blokir perangkat):** aplikasi memanggil endpoint same-origin `apiBase` (`/api`) lebih dulu, yang diteruskan ke Apps Script oleh **Cloudflare Pages Function** (`functions/api/[[path]].js`). Dengan begitu browser tidak lagi memanggil `script.google.com` secara lintas situs, sehingga JSONP tidak lagi gagal karena *third-party cookie* / ITP / ekstensi adblock (yang dulu memunculkan pesan "Gagal cek versi backend" atau "Gagal memuat data dari Google Sheets" di sebagian perangkat Android). Bila proxy tidak tersedia (mis. dibuka langsung dari file lokal), aplikasi otomatis jatuh ke `publicApiUrl` (jalur langsung). Target Apps Script proxy dapat diubah lewat *environment variable* **`APPS_SCRIPT_URL`** di project Cloudflare Pages (Settings → Environment variables); bila tidak diset, dipakai URL default di dalam file function. Untuk membuka Portal Publik cukup jalan lewat domain yang sama (proxy ikut berlaku). Path `/api` **wajib di-bypass** Cloudflare Access agar portal publik bisa memuat data (lihat **Publikasi & Kontrol Akses**); keamanan data tetap dijaga `ADMIN_TOKEN`.


> **Auto hard refresh (versi config):** setiap kali mengubah `config.js`, naikkan `version` **dan** samakan `EXPECTED_CONFIG_VERSION` di `index.html` & `public.html`. Bila browser masih memegang HTML lama (versi tak cocok), halaman otomatis melakukan *hard refresh* sekali agar HTML & config sinkron; ada pengaman anti-loop, jadi tidak akan reload berulang. Selain itu, selama halaman admin terbuka, versi dipantau berkala: bila ada versi lebih baru, tombol **Muat Ulang** di sidebar **muncul berkedip** untuk di-klik pengurus.

> **Kesadaran versi aplikasi (HTML):** agar perubahan `index.html`/`public.html` **saja** (walau `config.js` tidak berubah) juga memunculkan penanda "Muat Ulang" bagi pengguna yang masih membuka halaman lama, naikkan konstanta **`APP_BUILD`** pada file HTML yang berubah **dan** nilai yang sesuai (`index`/`public`) di berkas kecil **`version.json`** setiap kali deploy (bump hanya yang diubah, agar halaman lain tidak diberi notifikasi palsu). Aplikasi memeriksa dua sinyal sekaligus — versi `config.js` dan `APP_BUILD` dari `version.json` — saat halaman dimuat, lalu tiap 60 detik dan saat tab kembali aktif. Pemeriksaan memakai `cache: 'no-cache'` sehingga server membalas **304 (tanpa body)** bila berkas tidak berubah (tidak lagi mengunduh seluruh HTML tiap menit). Di `index.html` tombol **Muat Ulang** di sidebar muncul berkedip; di `public.html` tombol **Muat Ulang** di header ikut berkedip (label "Versi Baru") tanpa memaksa reload, agar warga yang sedang mengisi form tidak terganggu.

> **Versi rilis di footer (`appVersion`):** teks footer copyright menampilkan versi rilis (mis. `© 2026 SAPA RT - Portal Publik · v1.0.0`). Ubah `appVersion` di `config.js` saat ada rilis penting (tidak wajib tiap deploy). Arahkan kursor ke teks footer untuk melihat **detail build** (tooltip: `Build <APP_BUILD> · config v<version> · backend <CODE_VERSION>`) — berguna saat melaporkan masalah. Tiga penanda versi yang berbeda: `appVersion` (label rilis, tampil di footer), `version` (sinkronisasi `config.js` → memicu hard refresh), dan `APP_BUILD` (memicu penanda "Muat Ulang" saat HTML berubah).

> Pastikan file `config.js` ikut diunggah saat publikasi.

---

## 🎬 Mode Demo (Offline)

Untuk memperagakan aplikasi ke pengguna **tanpa** menghubungkan ke Google Sheets, **kosongkan `publicApiUrl` dan `apiBase` di `config.js`**. Aplikasi otomatis berjalan dalam **mode lokal**:

- Semua data (warga, iuran, pengumuman, kegiatan, pengajuan) yang Anda tambah/edit/hapus hanya tersimpan di `localStorage` **browser itu**, tidak dikirim ke server.
- Cocok untuk demo fitur admin (CRUD, pencarian, filter, paginasi, dashboard).
- Portal publik (`/public`) **tidak** menampilkan data mode lokal — portal publik hanya membaca dari Google Sheets. Jadi jadikan demo **khusus offline** (tidak menyentuh Portal Publik).
- Setelah demo selesai, klik **Reset Data Demo (Lokal)** di menu **Integrasi Google Sheets** untuk mengosongkan data & tampilan. Tombol ini menghapus `appState` + cache `localStorage` (`rt_warga`, `rt_kas`, `rt_pengumuman`, `rt_kegiatan`, `rt_surat`, dan penanda `rt_local_deletes_*`) serta menggambar ulang semua panel menjadi kosong. **Data di Google Sheets tidak pernah terhapus** oleh tombol ini.
- Token admin dan tema **tidak** ikut dihapus, sehingga penyiapan koneksi tetap utuh.

> Ringkasnya: `publicApiUrl`/`apiBase` kosong = mode demo lokal; **Reset Data Demo (Lokal)** = bersihkan hasil demo. Menyimpan/menghapus ke Sheets hanya terjadi bila sumber data (`config.js`) + token admin diisi.

---

## ⚡ Performa (Tailwind CSS Statis)

Aplikasi **tidak lagi memakai Tailwind Play CDN** (`cdn.tailwindcss.com`). Dulu CDN tersebut mengunduh *engine* Tailwind (ratusan KB) secara *blocking* lalu men-*generate* CSS di browser saat halaman dibuka, sehingga terasa lambat. Sekarang CSS Tailwind sudah **dibangun lebih dulu** menjadi satu berkas statis kecil (`tailwind.css`, ~35 KB) yang langsung dipakai halaman admin & portal publik.

Berkas terkait:

- `tailwind.config.js` — konfigurasi (tema, warna, `darkMode: 'class'`).
- `tailwind.input.css` — sumber (`@tailwind base/components/utilities`).
- `tailwind.css` — **hasil build** yang di-*load* oleh `index.html` & `public.html`.

> **Setelah menambah/mengubah kelas Tailwind** di `index.html` atau `public.html`, jalankan ulang build lalu unggah `tailwind.css`:

```bash
npx tailwindcss@3 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
```

Halaman juga memakai `preconnect` ke Google Fonts, cdnjs, dan `script.google.com`/`script.googleusercontent.com` (endpoint data) agar koneksi awal lebih cepat.

### Optimasi jaringan

- **Ikon WhatsApp pakai SVG inline** (bukan Font Awesome Brands), sehingga browser tidak lagi mengunduh `fa-brands-400.woff2` (~108 KB) hanya untuk satu ikon.
- **Pemeriksaan update hemat kuota:** versi build HTML dibaca dari **`version.json`** yang kecil (dengan `cache: 'no-cache'` → respons **304 tanpa body** bila tidak berubah), bukan mengunduh ulang seluruh `index.html` tiap 60 detik.
- **Caching aset (`_headers`):** berkas **`_headers`** (Cloudflare Pages) memberi `Cache-Control` lama (7 hari) untuk ikon statis ber-cache-buster (`rt-icon.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon.ico`), dan `must-revalidate` untuk `/config.js`, `/version.json`, `/sw.js` agar deteksi versi tetap akurat.
- **Ikon dioptimalkan** (palet 256 warna): `rt-icon.png` 190 KB → 27 KB, `icon-192.png` 44 KB → 8 KB, `apple-touch-icon.png` 40 KB → 8 KB, `favicon.ico` 17 KB → 8 KB (multi-ukuran 16/32/48/64).

---

## 🌐 Publikasi & Kontrol Akses (Cloudflare Pages + Access)

Aplikasi dipublikasikan melalui **Cloudflare Pages** (project dari repository ini), mis. `https://sapa-rt017.pages.dev`:

| URL | Konten | Akses |
|-----|--------|-------|
| `/` dan `/index.html` | Halaman **admin** | **Login Cloudflare Access** (hanya email yang diizinkan) |
| `/public` dan `/public.html` | Portal publik warga | Terbuka (tanpa login) |
| `/api` (proxy same-origin ke Apps Script) | Data portal publik & operasi admin | Terbuka (tanpa login); data tetap dijaga token `ADMIN_TOKEN` |
| `/config.js`, `/version.json`, `/rt-icon.png`, `/icon-192.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`, `/manifest-public.webmanifest`, `/sw.js` | Aset pendukung + berkas PWA portal publik | Terbuka (tanpa login) |

> **GitHub Pages dimatikan** agar halaman admin tidak bisa diakses lewat `saladimu.github.io`. Portal publik dan admin berbagi satu domain (`sapa-rt017.pages.dev`); bagikan ke warga cukup `https://sapa-rt017.pages.dev/public` (tanpa ekstensi `.html`). Tidak perlu domain/wrapper tambahan — keamanan admin bersumber dari Cloudflare Access pada path `/` & `/index.html`.

> **Penting (proxy `/api`):** karena portal publik (`/public`) mengakses data lewat jalur same-origin `/api`, path `/api` **harus ikut di-bypass** Cloudflare Access. Tanpa bypass, request data dari portal publik akan tertahan halaman login Access. Ini aman karena `/api` hanya jembatan ke Apps Script dan operasi sensitif tetap divalidasi oleh `ADMIN_TOKEN` di backend.

### Menyiapkan Cloudflare Zero Trust (sekali saja)

1. Buka `one.dash.cloudflare.com`, buat *team name* bila belum ada.
2. **Integrations → Identity providers → Add new identity provider → One-time PIN** (kode dikirim ke email, tanpa setup). Tambahkan juga **Google** bila perlu.

   > **Penting:** organisasi Zero Trust **baru** hanya punya *identity provider* **Cloudflare** secara default, dan **One-time PIN tidak lagi aktif otomatis**. Halaman lama **Settings → Authentication → Login methods** sudah tidak ada. Jika One-time PIN belum ditambahkan di sini, halaman login hanya menampilkan tombol **"Sign in with: Cloudflare"** (tanpa kolom email), sehingga menambahkan email ke policy tidak akan berpengaruh.
3. **Access controls → Applications → Add an application → Self-hosted**, buat **dua** aplikasi (biarkan **Accept all available identity providers** tetap aktif di tab *Authentication*):

   **a. `RT Admin`** (melindungi admin)
   - Public hostname: `sapa-rt017.pages.dev` — Path `/`
   - Tambah hostname kedua: `sapa-rt017.pages.dev` — Path `/index.html`
   - Policy: Action **Allow**, Include → **Emails** → email admin. Session duration mis. `24 hours`.

   **b. `RT Public Assets`** (mengecualikan aset publik)
   - Public hostname: `sapa-rt017.pages.dev` — Path `/public`
   - Tambah hostname: Path `/public.html`, `/api`, `/config.js`, `/version.json`, `/rt-icon.png`, `/icon-192.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`, `/manifest-public.webmanifest`, `/sw.js`
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
5. Pengguna membuka `https://sapa-rt017.pages.dev/` di jendela *incognito* → masukkan email → klik **Send login code** → masukkan kode PIN dari email → dashboard admin terbuka.

### Masa berlaku sesi & mencabut akses

Login **bukan sekali pakai**. Setelah PIN dimasukkan, Cloudflare Access menerbitkan *session cookie* yang berlaku selama **Session Duration** aplikasi:

- Selama sesi masih aktif, membuka `https://sapa-rt017.pages.dev/` kembali akan **langsung masuk tanpa email/PIN** (SSO).
- Setelah sesi kedaluwarsa, pengguna diminta email + PIN lagi. (PIN-nya sendiri tetap sekali pakai; yang berulang adalah sesinya.)
- **Session Duration** diatur di Zero Trust → **Access controls → Applications → `RT Admin` → Edit → Details → Session Duration** (default umumnya `24 hours`).
- Terpisah dari itu, **token admin** (`ADMIN_TOKEN`) disimpan di `localStorage` browser dan tetap ada sampai dibersihkan — jadi dashboard tidak meminta token setiap kali.

**Mencabut akses pengguna:**

1. Hapus email dari policy **RT Admins** → **Save**. Ini mencegah login **baru**, tetapi pengguna yang sedang login **tetap bisa masuk sampai sesinya kedaluwarsa**.
2. Untuk memblokir **seketika**, buka Zero Trust → **Access controls → Active sessions** → cari sesi pengguna → **Revoke**.

> **Jika `public.html` kembali meminta login:** pastikan path **`/public`** sudah terdaftar di aplikasi *Bypass* **`RT Public Assets`**.

### ✅ Checklist setiap kali deploy (frontend)

Sebelum push/unggah ke Cloudflare Pages, naikkan penanda versi yang sesuai agar pengguna yang masih membuka halaman lama otomatis diberi penanda **"Muat Ulang"** (lihat **Kesadaran versi aplikasi** di atas):

| Yang berubah | Yang wajib dinaikkan | Di mana |
|--------------|----------------------|---------|
| `config.js` (identitas, `jenisSurat`, `publicApiUrl`, `apiBase`, dll.) | `RT_CONFIG.version` **dan** `EXPECTED_CONFIG_VERSION` | `config.js`, `index.html`, `public.html` |
| Rilis penting (label versi rilis) | `RT_CONFIG.appVersion` (opsional) | `config.js` |
| `index.html` / `public.html` (tampilan, fitur, kelas CSS) | **`APP_BUILD`** **dan** nilai terkait di `version.json` | file HTML yang diubah, `version.json` |
| `code.gs` (backend Apps Script) | `CODE_VERSION` **dan** `EXPECTED_BACKEND_VERSION`, lalu **redeploy New version** | `Apps Script/code.gs`, `index.html` |
| Kelas Tailwind baru/berubah | (build ulang) `tailwind.css` | lihat **Performa** di atas |

> Deteksi update memeriksa **dua sinyal**: versi `config.js` dan `APP_BUILD` (dibaca dari `version.json` kecil — bukan lagi mengunduh seluruh HTML, agar hemat kuota). Karena itu, mengubah `index.html`/`public.html` tanpa menaikkan `APP_BUILD` **dan** `version.json` yang sesuai **tidak** akan memunculkan tombol **Muat Ulang** pada pengguna yang membuka halaman lama. `version.json` memuat kunci `index` (untuk halaman admin) dan `public` (untuk portal publik). Di portal publik penanda hanya berkedip (label **"Versi Baru"**) tanpa reload paksa, agar warga yang sedang mengisi form tidak terganggu.

> **Catatan keamanan (berlapis):** proteksi halaman admin ada di Cloudflare Access; proteksi data tetap ada di token backend (`ADMIN_TOKEN`). Data warga/kas tidak pernah dikirim ke portal publik berkat endpoint `readPublic`, dan toggle **Portal Publik ON/OFF** ditegakkan di sisi server.
