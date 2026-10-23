# 🏢 SAPA RT - Dashboard RT Tanjung Duren Utara

SAPA (**Sistem Administrasi & Pelayanan Antarwarga**) adalah Sistem Informasi & Dashboard Management RT (Rukun Tetangga) berbasis web yang responsif, modern, dan mudah digunakan. Didesain khusus untuk pengurus dan warga RT di wilayah Tanjung Duren Utara. Sistem ini menggunakan **Google Sheets** sebagai *database* tanpa memerlukan *server/backend* yang rumit.

> 📘 **Baru memakai aplikasi?** Baca **[`panduan.md`](panduan.md)** — panduan pemakaian untuk **Pengurus RT** (dashboard), **warga** (portal publik & pengajuan surat), plus setup awal, pemeliharaan, dan troubleshooting. Dokumen di bawah ini adalah dokumentasi teknis/fitur lengkap.

---

## 🚀 Fitur Utama

- **🖥️ Sembunyikan menu kiri (tampilan penuh):** pada layar desktop, tombol **<<< Sembunyikan menu** (latar gelap) **tepat di atas Ringkasan** menyembunyikan sidebar agar area kerja **lebih lebar (full display)**. Tombol **Tampilkan menu** (ikon panah) tetap di kiri layar untuk membuka kembali. Pilihan terakhir diingat di perangkat. Tidak berlaku di ponsel (menu atas tetap).
- **🔔 Sticky-note record baru:** menu **Pengajuan Surat** dan **Lapor & Aspirasi** menampilkan sticky-note kuning berkedip berisi jumlah record baru yang belum pernah dibuka. Note muncul setelah sinkronisasi data, tersimpan per browser (`rt_seen_surat_ids` / `rt_seen_lapor_ids`), dan hilang saat menu terkait dibuka. Pemuatan pertama hanya menjadi baseline agar data lama tidak dianggap baru.
- **📊 Ringkasan / Dashboard:** Menampilkan statistik **Total Warga** dalam format `jiwa / No. KK unik (KK)` (mis. `12 / 4 (KK)`), saldo kas berjalan, pengumuman, agenda kegiatan, **Pengajuan Surat** (`aktif (Pending)` — arsip tidak dihitung), dan **Lapor & Aspirasi** (`aktif (menunggu)`, yaitu pengaduan diterima/diproses; arsip & selesai tidak dihitung). **Kartu KPI & kartu sorotan dapat diklik** untuk membuka menu terkait (Total Warga → Data Warga, Saldo Kas → Iuran & Kas, Pengumuman → Pengumuman, Agenda/Kegiatan Mendatang → Kegiatan Warga, Pengajuan Surat → Pengajuan Surat, Lapor & Aspirasi → Lapor & Aspirasi).
- **👥 Pendataan Warga:** Pengelolaan data penduduk (Nomor KK, Nama Lengkap, NIK, Tempat & Tanggal Lahir, Status dalam Keluarga & Jenis Kelamin, Pendidikan & Pekerjaan, No. HP, Status Tempat Tinggal, Alamat/No Rumah — sesuai urutan form) dilengkapi kolom **Usia** otomatis (dihitung dari Tanggal Lahir, tidak disimpan ke database). Tabel tampil **ringkas dengan kolom bertumpuk** (mis. "Nama Lengkap / Usia", "NIK / No. HP") sehingga lebih banyak data terlihat tanpa scroll horizontal, dengan fitur pencarian, filter status, **cetak daftar warga** (A4 landscape; urut No. KK dengan Kepala Keluarga di awal tiap KK; arsip ikut tercetak bila **Tampilkan arsip** aktif), **Edit & Arsip** (data warga ditandai arsip, bukan dihapus, sehingga tetap tersimpan & dapat dipulihkan) dengan dialog peringatan in-app yang menampilkan Nama, Nomor KK, dan NIK, serta **proteksi NIK ganda** (satu NIK tidak boleh terdaftar dua kali — dicek saat tambah & edit).
- **🪪 Isi otomatis dari NIK:** saat mengisi **NIK 16 digit** di form Tambah/Edit Warga, kolom **Jenis Kelamin** & **Tanggal Lahir** otomatis terisi dari NIK (laki-laki: digit ke-7/8 = `01-31`; perempuan: `41-71` = `40 + tanggal`; tahun 2 digit ditebak `<= tahun berjalan` → `20YY`, selain itu `19YY`). Memperbaiki digit NIK (mis. salah hari) otomatis memperbarui kembali **Jenis Kelamin**/**Tanggal Lahir** selama kolom tersebut belum diubah manual; isian yang sudah dikoreksi manual **tidak** tertimpa (muncul catatan di bawah kolom NIK), dan tombol **Isi dari NIK** dapat menimpa paksa. Bila NIK 16 digit namun tanggal di dalamnya tidak valid (mis. bulan 13 / 30 Feb), muncul peringatan dan isian tidak diubah. NIK hanya menerima angka (maks. 16 digit).
- **💬 Chat WhatsApp & Telepon dari No. HP (saat Edit):** buka detail record lewat **Edit** untuk menampilkan tombol **Chat WhatsApp** & **Telepon** di bawah kolom No. HP — berlaku pada form **Data Warga** maupun **Pengajuan Surat**. Tombol ini **hanya aktif saat mengedit** record (saat menambah record disembunyikan), dan tautan mengikuti nomor yang sedang tampil — jadi pengurus dapat langsung menghubungi warga tanpa menyalin nomor. Nomor dinormalisasi ke format `62...` (mis. `0812...` → `62812...`); bila nomor belum/kurang valid saat mengedit, muncul petunjuk singkat.
- **🕒 Timestamp pada form Edit Data Warga (tampilan saja):** saat membuka **Edit** warga, di bagian **paling bawah form (setelah Alamat / No. Rumah)** muncul kolom **Timestamp** berisi **waktu pencatatan record** (`dd-Mmm-yyyy HH:mm`, zona **GMT+7**) — bersumber dari **kolom Timestamp** di Sheets. Field ini **hanya tampilan** (bukan input) dan **tidak muncul saat menambah** warga baru. Nilai tidak ikut berubah saat menyunting.
- **🔢 Format No. HP (tampilan):** pada tabel record (**Data Warga** & **Pengajuan Surat**), No. HP ditampilkan berkelompok **3-3-4** agar mudah dibaca, mis. `0812345678` → `081-234-5678` (nomor lebih panjang melanjutkan grup berikutnya). Ini **hanya tampilan** — nilai yang tersimpan di Sheets dan tautan WhatsApp/Telepon tetap memakai digit asli.
- **🔒 Input No. HP hanya angka:** semua kolom **No. HP / WhatsApp** (form Warga & Pengajuan Surat di admin, serta form pengajuan & cek status di Portal Publik) hanya menerima **angka** (maks. 15 digit); huruf dan simbol otomatis dibuang saat diketik/di-tempel, sehingga nomor tidak bisa diisi karakter yang tidak valid.
- **🕘 Riwayat Pengajuan Surat per Warga:** pada kolom **Aksi** tabel **Data Warga** tersedia ikon riwayat (`clock-rotate-left`). Mengekliknya membuka modal berisi **seluruh pengajuan surat milik warga tersebut** — dicocokkan lewat **NIK** (bila salah satu NIK kosong, jatuh ke pencocokan nama) — menampilkan **Tanggal (tanpa jam), No. Surat, Jenis Surat, & Status** (terbaru di atas), beserta nama, NIK tersamar, dan jumlah pengajuan. Bila belum ada pengajuan, muncul pesan bahwa warga ini belum memiliki pengajuan surat. Bersifat **hanya tampilan** (tidak mengubah data).
- **💰 Iuran & Kas RT:** Pencatatan arus kas (Pemasukan & Pengeluaran) beserta akumulasi saldo akhir secara terotomatisasi. **Edit & Batalkan** tersedia (pembatalan membuat entri **Reversal**, bukan menghapus, agar jejak keuangan tetap aman). Nama warga yang dipilih otomatis mengisi **No. Rumah** dari Data Warga, transaksi dengan **nama + jenis + nominal** yang sama memicu **peringatan duplikat** (bisa dilanjutkan atau dibatalkan), dan field **Keterangan** menyediakan saran sekali-klik **"Iuran bulan <Bulan>"** (tetap bisa diketik bebas). Terdapat kartu **Saldo Awal** yang dapat diubah (ikon pensil) — **saldo dasar** sebelum transaksi pertama, disimpan ke backend (Script Property `SALDO_AWAL`) sehingga berlaku lintas perangkat.
- **🧮 Saldo Berjalan (running balance):** **Saldo Awal per periode** = Saldo Awal dasar **+ akumulasi arus kas semua periode sebelumnya**; **Saldo Akhir = Saldo Awal periode + Total Pemasukan − Total Pengeluaran** periode berjalan. Baris ber-`Diarsipkan=Ya` dikecualikan dari perhitungan.
- **🖨️ Cetak Laporan Kas:** ikon **print** di samping judul "Riwayat Transaksi" mencetak **laporan sederhana** (identitas RT, periode, ringkasan Saldo Awal/Pemasukan/Pengeluaran/Saldo Akhir, dan tabel transaksi + totalnya) untuk baris yang sedang tampil (mengikuti periode, pencarian, & filter).
- **↕️ Urutan Riwayat Kas:** tabel **Riwayat Transaksi** selalu diurutkan **terbaru di atas** (tanggal menurun); bila tanggal sama, entri yang **terakhir dicatat** tampil lebih dulu. Urutan ini juga dipakai saat mencetak laporan.
- **🗓️ Filter Periode Kas:** Riwayat transaksi dapat ditampilkan **per bulan** (default), **per tanggal**, atau **semua data**. Kartu ringkasan (Saldo Awal, Total Pemasukan, Total Pengeluaran, Saldo Akhir) mengikuti periode yang dipilih; **Saldo Awal dibawa (carried-forward) dari bulan/tanggal sebelumnya**, sehingga Saldo Akhir tiap periode adalah saldo berjalan yang sebenarnya. Pilihan tersimpan di browser.
- **🗂️ Filter & Cetak Daftar Pengajuan Surat:** Daftar Pengajuan dapat ditampilkan **per bulan** (default), **per tanggal**, atau **semua data** (mengikuti pola Iuran & Kas), dan ikon **print** di samping judul "Daftar Pengajuan" mencetak **laporan sederhana** (identitas RT, periode, ringkasan status, dan tabel pengajuan + jumlahnya) untuk baris yang sedang tampil (mengikuti periode, pencarian, & filter status). **Arsip tidak ikut tercetak** kecuali **Tampilkan arsip** dicentang.
- **📢 Pengumuman RT:** Papan informasi digital resmi untuk menyebarkan imbauan dan berita penting. **Edit & Hapus** tersedia.
- **📅 Kegiatan Warga:** Agenda kerja bakti, posyandu, siskamling, dan acara komunitas RT. **Edit & Hapus** tersedia.
- **🔄 Refresh Data Manual & Notifikasi Versi Baru:** Tombol refresh tersedia di header desktop/mobile. Di sidebar kiri (tepat di bawah indikator status `Google Sheets:`) terdapat tombol **Muat Ulang** yang **tersembunyi secara normal** dan **muncul berkedip hanya bila terdeteksi ada versi/update baru** (mis. `version` pada `config.js` atau `APP_BUILD` pada HTML naik); pada tampilan ponsel, ikon refresh di header juga ikut berkedip. Aplikasi memeriksa versi secara berkala (dan saat tab kembali aktif), sehingga pengurus bisa langsung memuat ulang. Portal publik juga menandai tombol **Muat Ulang** saat ada versi baru. **Demi mencegah beban berlebih, refresh dibatasi maksimal 1x per 3 menit** (batas dibagi bersama `index.html` & `public.html`); bila ditekan terlalu cepat, muncul pesan sisa waktu tunggu.
- **📝 Format Tanggal `dd-mm-yyyy`:** Semua kolom tanggal pada form tambah/edit (Warga, Kas, Pengumuman, Kegiatan) memakai format `dd-mm-yyyy` dengan mask otomatis; nilai kanonik tetap disimpan sebagai `yyyy-MM-dd` di Sheets.
- **🔎 Pencarian & Filter:** Tabel **Data Warga** memakai **kotak pencarian di atas tabel** yang menjangkau seluruh kolom (nama, NIK, No. HP, tempat/tanggal lahir, usia, status, pendidikan, pekerjaan, alamat) plus **filter Status Tempat Tinggal** (Tetap/Kontrak). Tabel **Iuran/Kas** menampilkan satu **baris filter per kolom** tepat di bawah header (Tanggal, Nama, No. Rumah, Jenis, Nominal, Catatan). Pencarian bersifat *contains* (tidak peduli huruf besar/kecil). Jumlah record warga yang ditemukan tampil di samping header **No. KK** dalam tanda kurung, mis. `No. KK (12)`.
- **🔗 Integrasi Google Apps Script:** Pengiriman data form langsung terhubung ke Google Sheets, **sync delete**, dengan *fallback* **localStorage** jika dijalankan tanpa internet/koneksi backend.
- **⚠️ Delete Persistence:** Sistem melacak record yang dihapus agar tidak muncul kembali setelah reload/sync.
- **🔐 Token Admin:** Semua operasi tulis (tambah/edit/hapus) dan baca lengkap wajib menyertakan token rahasia (`ADMIN_TOKEN` di Script Properties). Tanpa token, server menolak permintaan sehingga orang yang hanya tahu URL tidak bisa mengubah data.
- **🛡️ Halaman Admin Terlindungi (Cloudflare Access):** halaman admin (`/` & `/index.html`) hanya bisa dibuka oleh email yang diizinkan melalui login Cloudflare Zero Trust; portal publik tetap terbuka tanpa login. Lihat bagian **Publikasi & Kontrol Akses**.
- **📲 Pasang sebagai Aplikasi (PWA):** halaman admin maupun Portal Publik bisa dipasang ke layar utama Android/iOS atau desktop (masing-masing punya manifest sendiri — `manifest.webmanifest` untuk admin, `manifest-public.webmanifest` untuk publik — plus service worker `sw.js`). Tombol **Pasang Aplikasi** muncul otomatis di sidebar admin dan tombol **Install** di header portal publik saat browser mendukung (Chrome/Edge Android & desktop). Menekan tombol akan membuka **panduan "Pasang Aplikasi"** bergaya seragam dengan aplikasi (kartu langkah untuk **Android**, **iPhone/iPad**, & **Komputer** — kartu perangkat Anda ditandai badge **"Perangkat ini"**), lengkap dengan tips bila opsi pemasangan tidak muncul; bila browser menyediakan dialog native, dialog itulah yang langsung ditampilkan. Setelah dipasang, aplikasi dibuka layar penuh (*standalone*) dan tombol pemasangan disembunyikan. Berkas PWA portal publik (`/manifest-public.webmanifest`, `/sw.js`, `/icon-192.png`) wajib ikut di-bypass Cloudflare Access (lihat **Publikasi & Kontrol Akses**).
- **🕵️ Portal Publik Terisolasi:** `public.html` memakai endpoint `readPublic` yang hanya mengembalikan Pengumuman & Kegiatan ber-`Publik=Ya`; data warga & kas tidak pernah dikirim ke portal publik.
- **🧾 Isi form surat otomatis dari Data Warga (bantu warga):** pada **Layanan Surat**, kolom **NIK (16 digit)** berada di **paling atas**. Begitu NIK valid dimasukkan, sistem mencari NIK di **Data Warga** (`action=lookupWarga`) — bila ketemu, **Nama Lengkap & Alamat/No. Rumah** terisi otomatis **dan terkunci** (hanya tampilan, tidak dapat diubah), sedangkan **No. HP/WhatsApp** ditampilkan **tersamar namun tetap dapat diperiksa/diubah** (mis. `0812••••7890`; ketuk kolom untuk melihat nomor aslinya) — nomor asli tetap dikirim saat submit. Bila NIK **tidak terdaftar**, muncul info bahwa NIK tidak ada di data warga dan form **tetap dapat diisi manual** lalu dikirim.
- **📣 Lapor & Aspirasi (Portal Publik & Admin):** menu baru **di bawah Layanan Surat** pada Portal Publik untuk menyampaikan **pengaduan, keluhan, atau aspirasi** kepada Pengurus RT. Warga memasukkan **No. WhatsApp** yang terdaftar di Data Warga (`action=lookupWargaHp`); **Nama & Alamat** terisi otomatis (hanya-baca). Warga memilih **Jenis Pengaduan** (13 kategori dari `RT_CONFIG.jenisPengaduan`), menulis **Judul** & **Detail**, plus opsional **Lokasi**, **Tanggal Kejadian**, **Foto/Bukti** (dikompres di browser lalu diunggah ke folder Google Drive `Lapor`), dan **Harapan/Solusi**. Setelah terkirim warga menerima **Nomor Pengaduan** (format `ADU/2026-001`) yang dapat dicek statusnya kapan saja. Lihat bagian **Lapor & Aspirasi**.
- **✨ Asisten AI (Opsional, Gemini):** tombol **Saran AI** pada form **Catat/Edit Pengaduan** meminta Gemini merangkum pengaduan, menyarankan **Jenis Pengaduan** & **urgensi**, serta menyusun **draft Catatan Tindak Lanjut** dan **draft balasan WhatsApp** — semuanya berupa draft yang dapat diedit/diterapkan admin (tidak pernah disimpan otomatis). Tombol **Bantu Tulis AI** juga tersedia di form **Pengumuman**, **Agenda Kegiatan**, dan **Pengajuan Surat** untuk merapikan judul/isi/keterangan serta menyusun ringkasan, daftar konfirmasi, catatan pengurus, dan draft balasan warga. Di **Iuran & Kas**, tombol **Ringkas dengan AI** membuat **narasi ringkasan** dari angka yang sudah dihitung sistem (saldo awal, pemasukan, pengeluaran, saldo akhir) untuk periode yang sedang tampil. **API key diisi sendiri oleh admin** di **Pengaturan → AI Assistant (Gemini)**, disimpan **hanya di `localStorage` browser** (`rt_ai_api_key`) dan **tidak pernah dikirim ke Google Sheets**. Yang dikirim ke Gemini hanya **judul, detail, jenis, lokasi, tanggal kejadian, dan harapan** (Lapor), isi form pengumuman/kegiatan, atau **jenis surat/keperluan/status** (Surat); **nama, NIK, No. KK, No. HP, dan alamat lengkap tidak pernah dikirim**. Asisten bersifat opsional (toggle ON/OFF) dan seluruh perhitungan saldo/data tetap deterministik. Lihat bagian **Asisten AI (Opsional, Gemini)**.
- **🌗 Tema Terang/Gelap (Portal Publik):** `public.html` punya tombol tema di header untuk beralih mode terang/gelap. Pilihan disimpan di `localStorage` (`rt_theme`) dan default mengikuti preferensi sistem, tanpa kedipan saat dibuka.
- **🚨 Nomor Siaga Darurat (Portal Publik):** tombol ikon di header `public.html` membuka daftar **Nomor Siaga Darurat Utama** (112, 110, 113, 118/119, 115, 117, 129, 123) lengkap dengan ikon per layanan. Setiap nomor dapat diketuk untuk langsung menelepon (`tel:`).
- **📱 QR Buka Portal (Portal Publik):** mengeklik **logo RT** di header `public.html` (sebelah judul "Portal Publik") membuka jendela berisi gambar **`qr-public.png`** — kode QR untuk membuka Portal Publik lewat ponsel — beserta tautan URL portal (`RT_CONFIG.publicPortalUrl`) yang dapat diketuk langsung. Memudahkan membagikan akses portal antar warga tanpa mengetik alamat.
- **⚡ Akses Cepat (Portal Publik):** panel **Layanan Cepat** berisi dua pasangan ikon besar — **Ajukan Surat / Cek Status** dan **Lapor / Cek Pengaduan** — untuk membuka layanan tanpa menggulir halaman. Panel dan ubinnya mengikuti tema terang/gelap; bila hanya satu layanan aktif, pasangannya melebar penuh, dan **seluruh panel otomatis disembunyikan bila Layanan Surat & Lapor sama-sama OFF**. Tombol header (Tentang, Siaga, tema, Install, Muat Ulang) kini ikon saja dengan target sentuh minimal **44×44 px**, begitu pula tombol panduan, tutup modal, dan aksi foto/salin, sehingga nyaman dipakai di ponsel.
- **🔒 ON/OFF Portal Publik:** Toggle di tab Portal Publik untuk mengaktifkan/menonaktifkan akses warga. Saat OFF, server menolak `readPublic` sehingga data benar-benar tidak bisa diakses (bukan sekadar menyembunyikan tautan).
- **📄 ON/OFF Layanan Surat:** Toggle khusus di tab Portal Publik untuk menyalakan/mematikan menu **Layanan Surat** (pengajuan & cek status) tanpa memengaruhi Pengumuman, Kegiatan, atau Lapor & Aspirasi. Saat OFF, menu disembunyikan dan server menolak `submitSurat`/`checkSurat`/`lookupWarga` (`surat_disabled`).
- **🗓️ "Terakhir diperbarui" dari waktu data (Portal Publik):** label **Terakhir diperbarui:** pada `public.html` menampilkan **tanggal paling baru** berdasarkan **kolom Timestamp** (waktu record dibuat/diubah) dari **Pengumuman & Agenda Kegiatan Warga** yang tampil publik (format `dd-Mmm-yyyy`, waktu dikonversi ke zona **GMT+7**), bukan lagi jam perangkat pengunjung; bila **Pengumuman dan Kegiatan sama-sama belum ada**, ditampilkan **tanggal hari ini (GMT+7)** agar baris tidak kosong.
- **🗓️ "Terakhir diperbarui" (Panel Admin):** label serupa di `index.html` menampilkan **tanggal paling baru** dari **kolom Timestamp** di **seluruh tabel** (Data Warga, Iuran Kas, Pengumuman, Agenda Kegiatan Warga) yang telah disinkronkan ke Google Sheets, dengan konversi ke zona **GMT+7** dan format `dd-Mmm-yyyy`; bila belum ada data ditampilkan `-`.
- **↕️ Urutkan tabel Data Warga (No. KK & Nama Lengkap):** klik judul kolom **No. KK** atau **Nama Lengkap / Usia** untuk mengurutkan. Setiap klik bersiklus **naik (A→Z / terkecil dulu) → turun → tanpa urutan**; ikon panah di header menunjukkan status. Data terarsip tetap dipisah di atas. Pilihan terakhir diingat (tersimpan di perangkat).
- **🔢 Hitungan unik di header Data Warga:** header **No. KK (N)** menampilkan **banyaknya Nomor KK unik** dan header **NIK (N)** menampilkan **banyaknya NIK unik (jiwa)** pada data yang sedang tampil (mengikuti pencarian/filter; arsip ikut terhitung hanya saat "Tampilkan arsip" aktif). NIK kosong tidak dihitung.
- **📱 Tombol Integrasi Google Sheets responsif:** empat tombol di panel **Integrasi Google Sheets** (**Test Connection**, **Load Data from Sheets**, **Check Backend Version**, **Reset Demo Data** (Local)) kini tersusun rapi — **satu kolom penuh di ponsel**, dua kolom di layar lebih besar — dengan ikon dan warna berbeda per fungsi (biru = aksi utama muat data, abu garis = aksi sekunder, merah lembut = reset data lokal).
- **↩️ Tombol "Back" Android menutup modal / kembali tab (bukan keluar aplikasi):** tombol/swipe **Back** di perangkat Android kini memakai History API — menekan Back saat ada modal terbuka akan **menutup modal** itu, di halaman admin Back berikutnya **kembali ke tab sebelumnya**, dan baru keluar saat sudah di tab utama tanpa modal. Berlaku di halaman admin (`index.html`) dan Portal Publik (`public.html`, untuk modal Siaga / Panduan Surat / Tentang).
- **⚡ Loading Cepat:** CSS Tailwind dibangun statis (`tailwind.css`, ~35 KB) alih-alih memuat Play CDN yang berat; ikon & font juga **di-self-host** (subset Font Awesome 6 + Inter) sehingga tidak ada lagi permintaan ke CDN pihak ketiga. Lihat bagian **Performa (Tailwind CSS Statis)**.

---

## 📊 Struktur Google Sheets (Database)

Buat file baru di **Google Sheets**, buat 4 tab/sheet dengan nama exact di bawah ini, lalu salin (*copy*) teks TSV di dalam kotak dan tempel (*paste*) langsung pada sel **A1** di masing-masing tab:

> Kolom **Timestamp** (kolom A) otomatis berformat `dd-mm-yyyy hh:mm` dan mengikuti zona waktu **GMT+7 (Asia/Jakarta)**. Script juga menambahkan satu kolom bantu **`ID`** di ujung kanan secara otomatis (dipakai untuk edit/hapus yang aman, tidak perlu dibuat manual).
>
> Kolom **`Publik`** (khusus Pengumuman & Kegiatan_Warga) menentukan apakah record tampil di Portal Publik: isi `Ya` untuk tampil, `Tidak` untuk sembunyikan. Bisa di-toggle dari aplikasi; baris lama otomatis diisi `Ya`.

### 1. Tab `Data_Warga`
```tsv
Timestamp	Nomor KK	Nama Lengkap	Status	Jenis Kelamin	NIK	Tempat Lahir	Tanggal Lahir	Pendidikan	Pekerjaan	No HP	Status Tempat Tinggal	Alamat/No Rumah	Diarsipkan
```
> Kolom **`Diarsipkan`** menandai data warga yang disembunyikan dari daftar tanpa dihapus: isi `Ya` untuk mengarsipkan, `Tidak`/kosong untuk data aktif. Baris ber-`Diarsipkan=Ya` tidak ditampilkan pada tabel, datalist nama, dashboard, maupun pencarian NIK publik, tetapi **tetap tersimpan** dan dapat dipulihkan lewat tombol **Pulihkan** di aplikasi.

### 2. Tab `Iuran_Kas`
```tsv
Timestamp	Tanggal	Nama Warga	No Rumah	Jenis Transaksi	Jumlah (Rp)	Keterangan	Diarsipkan	Reversal Dari
```

> Kolom **`Diarsipkan`** hanya dipertahankan untuk **kompatibilitas data lama**: baris ber-`Diarsipkan=Ya` disembunyikan dari daftar **dan** tidak dihitung dalam saldo. Fitur arsip kas sudah **dipensiunkan** (pembatalan memakai **Reversal**); untuk memunculkan data lama, ubah kolom ini menjadi `Tidak` langsung di Google Sheets.
>
> Kolom **`Reversal Dari`** menyimpan **ID transaksi asal** untuk entri pembatalan otomatis. Saat pengurus menekan **Batalkan**, aplikasi menambahkan satu baris **Reversal** dengan nominal sama dan arah berlawanan (`Reversal Keluar` untuk pembatalan pemasukan, `Reversal Masuk` untuk pembatalan pengeluaran). Pasangan transaksi asal + Reversal berjumlah **nol**, sehingga saldo kembali seperti semula tanpa menghapus data. Entri Reversal tidak dapat diedit; untuk mengubah transaksi, pulihkan dulu pembatalannya.

### 3. Tab `Pengumuman`
```tsv
Timestamp	Tanggal	Judul Pengumuman	Isi Pengumuman	Kategori	Penanggung Jawab	Publik
```

### 4. Tab `Kegiatan_Warga`
```tsv
Timestamp	Nama Kegiatan	Tanggal Pelaksanaan	Waktu	Lokasi	Penanggung Jawab	Keterangan	Publik
```

### 5. Tab `Lapor_Aspirasi` (dibuat otomatis)

Tab ini **dibuat otomatis** oleh script saat pertama kali dipakai (tidak perlu disalin manual):

```tsv
Timestamp	No. Pengaduan	Nama	No. HP	Alamat	Jenis Pengaduan	Judul	Detail	Lokasi	Tanggal Kejadian	Foto	Harapan	Status	Petugas	Catatan Tindak Lanjut	Tanggal Penyelesaian	Diarsipkan
```

> Kolom **`No. Pengaduan`** memakai format `ADU/2026-001` (diisi otomatis saat pengaduan masuk atau saat admin menambah tanpa nomor). Kolom **`Foto`** berisi tautan Google Drive (folder `Lapor`). Kolom **`Diarsipkan`** menyembunyikan pengaduan tanpa menghapus. Tab ini **tidak pernah** dikirim ke Portal Publik.

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
- ✅ **ON/OFF Portal Publik, Layanan Surat & Lapor/Aspirasi** server-side (`PUBLIC_PORTAL_ENABLED` + `SURAT_ENABLED` + `LAPOR_ENABLED` di Script Properties; aksi `setPortalStatus`, `setSuratStatus` & `setLaporStatus`); saat portal OFF `readPublic` ditolak, saat Surat OFF aksi `submitSurat`/`checkSurat`/`lookupWarga` ditolak (`surat_disabled`) dan menu Surat disembunyikan, saat Lapor OFF aksi `lookupWargaHp`/`checkLapor`/`submitLapor` ditolak (`lapor_disabled`) dan menu Lapor disembunyikan di Portal Publik
- ✅ **Identitas RT terpusat** di `config.js` (ubah info RT di satu tempat)
- ✅ **Fitur Pengajuan Surat (backend v11)** — tab `Pengajuan_Surat` (dibuat otomatis), aksi publik `submitSurat` (tanpa token; validasi NIK 16 digit, honeypot, rate limit 5/jam per NIK), notifikasi email admin (Script Property `ADMIN_EMAIL`), `Status` default `Pending`, **No. Pengajuan konsisten `SRT-<yymmdd>-XXXX`** untuk semua jalur (publik & catat manual admin), serta **panel admin** untuk melihat/mencatat/mengubah status/menghapus & memfilter pengajuan
- ✅ **Kolom baru `Data_Warga`**: `Nomor KK`, `Status`, `Jenis Kelamin`, `Pendidikan`, `Pekerjaan` (urutan: Nomor KK → Nama Lengkap → Status → Jenis Kelamin → NIK → Tempat/Tanggal Lahir → Pendidikan → Pekerjaan → No HP → Status Tinggal → Alamat → Diarsipkan); migrasi otomatis berbasis **nama header** (`migrateDataWargaLayout()`), aman dijalankan berulang
- ✅ **Arsip Data Warga (bukan hapus)** — data warga tidak lagi dihapus permanen; tombol **Arsip** menandai kolom `Diarsipkan=Ya` sehingga baris disembunyikan dari tabel, datalist nama, dashboard, & `lookupWarga` publik, namun **tetap tersimpan**. Toggle **"Tampilkan arsip"** + tombol **Pulihkan** tersedia di tab Data Warga (`backend v16`)
- ✅ **Fitur Lapor & Aspirasi (backend v25)** — tab `Lapor_Aspirasi` (dibuat otomatis), aksi publik `submitLapor` (tanpa token; wajib No. HP terdaftar, honeypot, rate limit 5/jam per no. HP, foto ke Drive), **No. Pengaduan `ADU/<tahun>-NNN`** (otomatis saat submit maupun catat manual admin), **Tanggal Kejadian tidak boleh melebihi hari ini**, notifikasi email admin (menyertakan tautan **"View foto"** bila ada lampiran), aksi baca `lookupWargaHp` (Nama+Alamat saja) & `checkLapor`, serta **panel admin** untuk melihat/mencatat/mengubah status/mengarsipkan pengaduan. Saat mengedit pengaduan, **Nama/No. HP/Alamat dikunci**, begitu pula **Lokasi Kejadian, Tanggal Kejadian, dan Harapan/Solusi** (tidak dapat diubah). Tombol **Lapor & Aspirasi ON/OFF** tersedia di panel Portal Publik
</details>

### Langkah Deployment Web App:
1. Klik tombol **Deploy > New Deployment**.
2. Pilih tipe **Web app**.
3. Atur *Execute as*: **Me** (Email Anda).
4. Atur *Who has access*: **Anyone** (Siapa saja).
5. Klik **Deploy**, lalu salin **Web App URL** yang didapat.
6. Di Apps Script, buka **Project Settings > Script Properties**, tambahkan properti **`ADMIN_TOKEN`** dengan nilai rahasia pilihan Anda. (Opsional) tambahkan **`ADMIN_EMAIL`** berisi email admin — bila diisi, setiap pengajuan surat baru dari portal publik akan dikirimkan notifikasi email. Bila mengisi `ADMIN_EMAIL`, jalankan fungsi **`authorizeMail`** sekali dari editor (Run > Review permissions > Allow) lalu deploy **New version** agar izin email aktif (lihat bagian **Notifikasi Email ke Admin**). Untuk lampiran foto pada **Lapor & Aspirasi**, jalankan juga fungsi **`authorizeDrive`** sekali (izin Google Drive; sekaligus membuat folder `Lapor`).
7. Buka aplikasi web RT, masuk ke tab **Integrasi Google Sheets**, isi **Token Admin** dengan nilai `ADMIN_TOKEN` yang sama lalu klik **Simpan Token**. URL sumber data tidak lagi diisi dari UI — atur lewat **`publicApiUrl` di `config.js`** (dan proxy `/api` bila memakai Cloudflare Pages).

> **Penting:** setiap kali `code.gs` diubah, buat versi baru melalui **Deploy > Manage deployments > Edit (ikon pensil) > Version: New version > Deploy**. Tanpa ini, Web App masih menjalankan kode lama.

### Membaca data dari Google Sheets
Aplikasi akan otomatis memuat data dari Google Sheets saat dibuka (memakai `publicApiUrl` di `config.js`, lewat proxy `/api` bila aktif) menggunakan `doGet` + JSONP. Anda juga dapat menekan tombol **Muat Data dari Sheets** di **Setting → Integrasi Google Sheets** atau **tombol Refresh 🔄** di header untuk menyegarkan data kapan saja.

> **Sumber Data Aktif:** di **Setting → Integrasi Google Sheets** terdapat kartu ringkasan yang menampilkan **Transport**, **Web App URL** yang dipakai, dan **Versi backend** (terisi otomatis setelah sinkronisasi, atau tekan **Cek Versi Backend**). Berguna untuk memastikan aplikasi membaca dari deployment/spreadsheet yang benar. Bagian **AI Assistant (Gemini)** dan **Apps Script setting** bersifat **collapsible** dan **tertutup saat halaman pertama dibuka** agar panel tetap ringkas; klik header untuk membuka.
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

### Edit, Hapus & Arsip Data
Semua modul (Warga, Kas, Pengumuman, Kegiatan) memiliki tombol **Edit** ✏️. Modul **Pengumuman & Kegiatan** juga memiliki tombol **Hapus** 🗑️, sedangkan **Data Warga & Iuran/Kas memakai tombol Arsip** 📦 (bukan hapus).
- **Arsip (Data Warga)**: alih-alih menghapus, data warga **ditandai arsip**, disembunyikan dari tabel/dashboard/datalist, tetapi **tetap tersimpan** di Google Sheets. Saat menekan **Arsipkan**, muncul dialog peringatan in-app berisi Nama, Nomor KK, dan NIK — pilih **Ya, Arsipkan** untuk melanjutkan atau **Batal**. Centang **"Tampilkan arsip"** di atas tabel: data terarsip lalu tampil **terpisah di bagian atas** dengan **latar kuning (amber)** dan judul **"Data Diarsipkan (N)"**, diikuti bagian **"Data Aktif (M)"** — klik **Pulihkan** — muncul dialog konfirmasi in-app berisi Nama, Nomor KK, dan NIK — lalu pilih **Ya, Pulihkan** untuk mengaktifkannya kembali.
- **Arsip (Iuran & Kas) — dipensiunkan:** pembatalan transaksi kini memakai **entri Reversal** (pasangan bernilai nol) agar jejak audit tetap terlihat. Tidak ada lagi tombol atau toggle arsip kas. Baris lama yang masih bertanda `Diarsipkan=Ya` tetap **disembunyikan dan dikecualikan** dari Total Pemasukan/Pengeluaran/Saldo; ubah kolomnya menjadi `Tidak` di Google Sheets bila perlu dimunculkan kembali.
- **Hapus (Pengumuman/Kegiatan)**: menampilkan dialog konfirmasi sebelum data benar-benar dihapus dari Google Sheets.
- **Edit**: Modal akan terbuka dengan data yang sudah terisi, klik simpan untuk menyimpan perubahan.
- **Delete Sync**: Penghapusan dilakukan di Google Sheets dulu, jika gagal data lokal tidak berubah.

### Pencarian & Filter (Cari Data)
Tabel **Data Warga** menyaring lewat **kotak pencarian di atas tabel** yang menjangkau seluruh kolom (Nama, NIK, No. HP, Tempat/Tanggal Lahir, Usia, Status, Pendidikan, Pekerjaan, Alamat) serta **filter Status Tempat Tinggal** (Tetap/Kontrak). Tabel **Iuran & Kas RT** menyaring lewat satu **baris filter per kolom** tepat di bawah header (Tanggal, Nama, No. Rumah, Jenis, Nominal, Catatan). Pencarian bersifat *contains* (mengandung kata kunci, tidak peduli huruf besar/kecil). **Jumlah data warga yang ditemukan** ditampilkan di samping header **No. KK** dalam tanda kurung, contoh `No. KK (12)`, dan ikut berubah mengikuti filter. Untuk **menambah** data, gunakan tombol **Tambah Data Warga** / **Catat Transaksi Kas** (membuka modal).

### Pengajuan Surat (Portal Publik & Admin)

Warga dapat mengajukan surat keterangan/pengantar langsung dari **Portal Publik** (bagian **Layanan Surat**):

- **Ajukan Surat Baru:** kolom pertama adalah **NIK (16 digit)**. Begitu NIK valid dimasukkan, aplikasi mencari NIK tersebut di **data warga** (`action=lookupWarga`): bila **ketemu**, kolom **Nama Lengkap & Alamat/No. Rumah** terisi otomatis **dan terkunci (hanya tampilan — tidak dapat diubah)** beserta keterangan *"Data warga ditemukan: <nama>"*, sedangkan **No. HP/WhatsApp** ditampilkan **tersamar** (contoh `0812••••7890`) **namun tetap dapat diperiksa/diubah** — cukup ketuk kolom untuk menampilkan & mengedit nomor aslinya (mis. bila berbeda dari nomor yang akan dipakai untuk Cek Status); bila diketik tanpa diubah, tampilan kembali tersamar otomatis dan **nilai asli tetap yang dikirim**. Bila **tidak terdaftar**, muncul info *"NIK tidak terdaftar dalam data warga"* dan warga **tetap dapat mengisi seluruh kolom secara manual**. Selanjutnya warga memilih **Jenis Surat** (daftar dari `RT_CONFIG.jenisSurat` di `config.js`) dan menulis **Keperluan**. Sebelum mengirim, bila **NIK + No. HP** yang sama sudah pernah mengajukan **jenis surat yang sama**, form menampilkan panel peringatan berisi **tanggal** & **keperluan** pengajuan sebelumnya; warga **tetap boleh melanjutkan** (tidak diblokir). Setelah terkirim, warga menerima **nomor pengajuan** (contoh `SRT-261006-AB12`) untuk disimpan.
- **Cek Status Pengajuan:** warga dapat memilih **dua cara**: (1) memasukkan **NIK + No. HP/WhatsApp** yang sama seperti saat mengajukan, atau (2) memasukkan **No. Pengajuan** saja (contoh `SRT-261006-AB12`, nomor yang tampil setelah pengajuan terkirim). Keduanya menampilkan status (`Pending` / `Diproses` / `Selesai` / `Ditolak`) beserta catatan pengurus. Pada cara pertama, nomor HP **boleh ditulis dengan awalan `0` maupun `62`** (mis. `081234567890` atau `6281234567890`), berspasi, atau bertanda hubung — sistem menormalkannya otomatis sehingga tetap cocok. Pengajuan yang sudah **diarsipkan** pengurus **tidak lagi ditampilkan**: bila seluruh pengajuan yang cocok telah diarsipkan, muncul keterangan bahwa pengajuan tersebut sudah diarsipkan; bila masih ada yang aktif, hanya pengajuan aktif yang tampil (disertai catatan kecil berapa pengajuan lain yang telah diarsipkan).

Kolom **NIK** pada kedua form hanya menerima angka (maks. 16 digit) dan **divalidasi otomatis mengikuti aturan Data Warga**: mengecek panjang 16 digit, jenis kelamin (digit ke-7/8 `01-31` untuk laki-laki, `41-71` untuk perempuan), bulan (1-12), serta jumlah hari per bulan. Petunjuk muncul di bawah kolom (jumlah digit, **NIK valid**, atau **Harap periksa ulang NIK** bila tanggal di dalam NIK tidak wajar, mis. bulan 13 atau 30 Februari) sehingga salah ketik bisa langsung diperbaiki sebelum dikirim.

Kedua kartu (**Ajukan Surat Baru** & **Cek Status Pengajuan**) dapat dibuka/ditutup (*collapse/toggle*) dengan mengeklik judulnya, sehingga tampilan lebih ringkas di layar kecil. Secara default keduanya **tertutup** saat halaman dibuka; warga mengeklik judul untuk menampilkan formulir.

Di samping judul **Layanan Surat** terdapat **ikon panduan** (`fa-circle-info`). Mengeklik ikon ini membuka jendela **Panduan Layanan Surat** berisi langkah-langkah berurutan (dari mengisi formulir pengajuan, menyimpan nomor pengajuan, hingga cek status dan membaca No. Surat), lengkap dengan tips (NIK & No. HP harus sama persis atau gunakan No. Pengajuan, batas 5 pengajuan/jam, dan keamanan data pribadi). Jendela dapat ditutup lewat tombol X, tombol **Mengerti**, klik latar, atau tombol **Esc**.

Pengamanan server-side: hanya menerima **tambah data** (tidak bisa mengubah/menghapus), memaksa status awal `Pending`, memvalidasi NIK/HP, menyaring bot lewat *honeypot*, dan membatasi **maksimal 5 pengajuan per NIK per jam**. Data tab `Pengajuan_Surat` **tidak pernah** ikut terkirim pada `readPublic`. Pencarian data warga (`lookupWarga`) hanya membuka **Nama, No. HP, & Alamat** satu warga untuk NIK yang dicari (bukan seluruh tabel), mengikuti status ON/OFF portal, dan dibatasi **20 pencarian per NIK per jam**. Cek status dan peringatan pengajuan serupa memakai NIK+HP (atau No. Pengajuan untuk cek status) dan dibatasi **maksimal 30 percobaan per kunci per jam** (ditambah batas global), sehingga data pengajuan tidak mudah di-enumerasi. Peringatan serupa hanya membuka **tanggal & keperluan** milik pengajuan dengan NIK+HP yang cocok, dan mengabaikan baris yang sudah diarsipkan. Nomor HP yang diperoleh dari data warga ditampilkan **tersamar** pada form (tetap dapat diperiksa/diubah warga; nilai tersamar diterjemahkan kembali ke nomor asli saat submit), sedangkan **Nama & Alamat hanya tampil** dan tidak dapat diubah.

Bila Script Property **`ADMIN_EMAIL`** diisi, setiap pengajuan baru akan dikirimi **notifikasi email** ke admin. Bila Portal Publik dimatikan (toggle di halaman admin), form pengajuan & cek status otomatis disembunyikan dan ditolak oleh server.

#### Mengelola Pengajuan di Halaman Admin

Menu **Pengajuan Surat** pada dashboard admin menampilkan seluruh pengajuan (terbaru di atas) beserta kartu ringkasan jumlah per status. Judul kolom dibuat **bertumpuk dua baris** agar ringkas di layar sempit: **Tanggal / No. Pengajuan**, **Nama Pemohon / NIK** (NIK tersamar), **No. HP / Alamat**, lalu **Jenis Surat**, **Keperluan**, **Status**, dan **Aksi**.

- **Isi Manual**: menambah pengajuan secara manual (mis. permohonan langsung/lisan) dengan tombol **Isi Manual**. Isian ditata berurutan: **NIK / No. HP** → **Nama Lengkap Pemohon** → **Alamat / No. Rumah** → **Jenis Surat** → **Keperluan** → **No. Surat** → **Status Pengurusan** → **Catatan Pengurus** → (**No. Pengajuan / Tanggal Pengajuan**, tampil saat mengedit). Kolom **NIK divalidasi** seperti pada Data Warga & Layanan Surat: hanya angka (maks. 16 digit), dicek panjang 16 digit, jenis kelamin (digit ke-7/8), bulan (1-12), dan jumlah hari per bulan. Petunjuk muncul langsung di bawah kolom (**jumlah digit**, **NIK valid**, atau **Harap periksa ulang NIK**); bila NIK valid cocok dengan Data Warga, **Nama Lengkap, No. HP, & Alamat/No. Rumah terisi otomatis** dari data warga tersebut. **Mengganti NIK ke warga lain akan memperbarui ketiga kolom** (tidak menyisakan data pemohon sebelumnya); koreksi manual setelahnya tetap bertahan selama NIK tidak diubah lagi. Bila NIK valid namun **tidak terdaftar**, muncul keterangan bahwa NIK tidak ada di Data Warga dan seluruh kolom diisi **manual**. Simpan akan **ditolak** bila NIK tidak lolos validasi. Bila ada isian yang salah (mis. NIK kurang dari 16 digit), pesan error muncul **di dalam modal** dan field yang bermasalah disorot.
- **No. Pengajuan**: setiap baris menampilkan nomor pengajuan (kolom `ID`, mis. `SRT-261006-AB12`). Nomor ini dibuat dengan format yang **sama** baik untuk pengajuan dari Portal Publik maupun **pencatatan manual admin** (**Isi Manual**), sehingga konsisten dan mudah dicocokkan.
- **No. HP / WhatsApp**: nomor HP pada tabel ditampilkan sebagai **teks biasa** (terformat 3-3-4). Untuk menghubungi pemohon, buka **Edit** — tombol **Chat WhatsApp** (`https://wa.me/...`) & **Telepon** tampil di bawah kolom No. HP pada modal edit (seragam dengan form Data Warga). Nomor dinormalisasi otomatis ke format internasional (`08...` → `628...`, `+62`/spasi/tanda hubung dirapikan). Bila nomor tidak valid/kosong, tombol disembunyikan dan muncul petunjuk singkat.
- **No. Surat**: field pada modal edit (di bawah **Keperluan**, di atas **Status**) untuk mencatat **nomor surat resmi** (mis. `474/017-RT/RW.06/X/2026`). Field ini **wajib diisi saat status diubah menjadi `Selesai`** — baik lewat modal maupun tombol ubah status cepat (yang akan otomatis membuka modal bila nomornya masih kosong). Server juga menolak simpan `Selesai` tanpa No. Surat. Setelah diisi, **No. Surat tampil bertumpuk di bawah Jenis Surat** pada tabel (ditandai ikon) sehingga mudah dipantau, dan nomor ini juga ikut tampil pada hasil **Cek Status** warga dengan sorotan warna terang (kuning/amber) agar mudah terlihat.
- **Edit**: klik baris (atau ikon pensil) untuk membuka modal dan mengubah data, **Status Pengurusan** (`RT_CONFIG.statusSurat`), **No. Surat**, dan **Catatan Pengurus**. Modal juga menampilkan No. Pengajuan & tanggal pengajuan (di bagian bawah form). **NIK & No. HP terkunci (hanya-baca) saat mengedit** karena warga memakai kedua data tersebut untuk **Cek Status** — nilainya tidak boleh berubah agar pencarian status tetap cocok. Kedua kolom tetap dapat diisi saat **Isi Manual** baru.
- **Durasi pengajuan**: di bawah badge **Status** pada tabel tampil lama hari sejak pengajuan (mis. `12 hari`), dihitung dari tanggal pengajuan sampai hari ini untuk status aktif. Saat status diubah menjadi **Selesai** atau **Ditolak**, isian tanggal akhir muncul dengan label **Tanggal Selesai** / **Tanggal Ditolak** (otomatis terisi tanggal hari ini) dan durasi **dibekukan** memakai tanggal tersebut; bila dikembalikan ke status lain, tanggal itu dikosongkan dan hitungan berjalan lagi. Baris `Selesai`/`Ditolak` lama yang belum punya tanggal akhir menampilkan `-` — buka **Edit** untuk melengkapinya.
- **Ubah Status cepat**: ikon putar menggilir status `Pending → Diproses → Selesai → Ditolak → Pending`; saat berubah ke `Selesai`/`Ditolak`, tanggal akhir diisi otomatis (dapat diubah), dan saat kembali ke status aktif tanggal itu dikosongkan.
- **Arsip (bukan hapus)**: ikon **kotak arsip** (`fa-box-archive`) menandai pengajuan sebagai **diarsipkan** melalui dialog seragam **“Arsipkan data?”** (Nama, No. Pengajuan, Jenis Surat → **Ya, Arsipkan**) — data **tidak dihapus permanen**, hanya disembunyikan dari daftar utama **dan** dari kartu ringkasan status. Centang **"Tampilkan arsip"** di toolbar untuk menampilkan pengajuan terarsip **terpisah di bagian ATAS** tabel dengan **latar kuning (amber)** + badge **"Arsip"** serta judul pemisah **"Pengajuan Diarsipkan (N)"** / **"Pengajuan Aktif (M)"**. Ikon **kotak terbuka** (`fa-box-open`) memulihkan pengajuan kembali ke daftar aktif. Status pengurusan (mis. yang sedang diproses) tetap aman karena arsip dipertahankan saat pengajuan diedit. Pengajuan yang diarsipkan **tidak lagi tampil** pada **Cek Status** warga; bila warga memeriksa dan semua pengajuan yang cocok telah diarsipkan, akan muncul keterangan bahwa pengajuan tersebut sudah diarsipkan.
- **Filter & cari**: saring berdasarkan status dan cari berdasarkan no. pengajuan / No. Surat / nama / NIK / jenis surat. NIK disamarkan pada tabel (contoh `3173••••••01`). Tersedia juga **filter periode** di toolbar (kanan atas tabel): **Per Bulan** (default = bulan berjalan), **Per Tanggal**, atau **Semua Data** — mengikuti pola filter Iuran & Kas dan tersimpan di browser. Label di samping judul **Daftar Pengajuan** menampilkan jumlah baris beserta periode aktif.
- **Cetak daftar pengajuan**: ikon **print** (`fa-print`) di samping judul **"Daftar Pengajuan"** membuka jendela cetak berisi **laporan pengajuan surat sederhana**: kop identitas RT, **periode** terpilih, waktu cetak, ringkasan jumlah (Total + per status), dan tabel pengajuan bernomor (Tanggal — **tanggal saja**, Nama Pemohon — **diperlebar**, **NIK / No. HP** — bertumpuk, **Jenis Surat / Keperluan** — bertumpuk, **Status / No. Surat** — bertumpuk dengan nomor surat satu baris penuh; header tabel rata tengah) beserta jumlah di footer. Laporan mengikuti **periode, pencarian, & filter status** yang sedang tampil. Header/footer bawaan browser tidak ikut tercetak.

Semua operasi tulis dari admin memakai **token admin** (`ADMIN_TOKEN`) seperti modul lain.

### Lapor & Aspirasi (Portal Publik & Admin)

Menu **Lapor & Aspirasi** berada **di bawah Layanan Surat** pada Portal Publik. Warga dapat menyampaikan **pengaduan, keluhan, atau aspirasi** kepada Pengurus RT dan memantau status penanganannya.

**Form Lapor / Aspirasi Warga (Portal Publik):**

- **No. WhatsApp (wajib):** hanya nomor yang **terdaftar di Data Warga** yang dapat mengirim. Begitu nomor diketik, sistem mencari (`action=lookupWargaHp`); bila **ketemu**, **Nama Warga** dan **Alamat/Blok/No Rumah** terisi otomatis dan **terkunci (hanya-baca)**; bila **tidak terdaftar** muncul keterangan bahwa nomor belum terdaftar dan form tidak dapat dikirim.
- **Jenis Pengaduan (wajib):** daftar 13 kategori dari `RT_CONFIG.jenisPengaduan` (mis. Lingkungan & Kebersihan, Penerangan Jalan, Saluran Air/Drainase, Jalan & Fasilitas Umum, Keamanan Lingkungan, Sampah, Aspirasi/Saran, Lainnya).
- **Judul Pengaduan (wajib)** dan **Detail Pengaduan (wajib)**.
- **Lokasi Kejadian**, **Tanggal Kejadian**, dan **Harapan/Solusi** bersifat opsional.
- **Foto/Bukti Pendukung (opsional):** hanya berkas gambar (maks. 8 MB); dikompres di browser (sisi terpanjang 1600 px, kualitas 0.7) lalu diunggah ke folder Google Drive **`Lapor`** melalui Apps Script, dan tautannya disimpan di Sheets. Folder `Lapor` **dibuat otomatis** (atau memakai Script Property `LAPOR_FOLDER_ID`) dan dibagikan ke `ADMIN_EMAIL`. Untuk mengaktifkan unggahan, jalankan fungsi **`authorizeDrive`** sekali di editor Apps Script (memberi izin Drive) lalu deploy **New version**. Kegagalan unggah foto **tidak menggagalkan** pengiriman pengaduan.
- **Persetujuan Data** (centang) wajib dicentang.

Setelah terkirim, warga menerima **Nomor Pengaduan** (format **`ADU/2026-001`**) dan pesan terima kasih untuk menyimpannya.

**Cek Status Pengaduan (Portal Publik):** warga memasukkan **No. Pengaduan** untuk melihat **Judul, Jenis, Status, Petugas/Pengurus, Catatan Tindak Lanjut, dan Tanggal Penyelesaian**. Status mengikuti alur **🟡 Diterima → 🔵 Diproses → 🟢 Selesai**. Pengaduan yang sudah **diarsipkan** pengurus tidak lagi ditampilkan (muncul info arsip).

**Pengamanan server-side:** aksi `submitLapor` hanya menerima **tambah data** (tanpa token), memaksa status awal `Diterima`, memvalidasi nomor HP terdaftar, menyaring bot via *honeypot*, dan membatasi **maksimal 5 pengaduan per No. HP per jam** (serta batas global). Pencarian data warga via `lookupWargaHp` hanya membuka **Nama & Alamat** satu warga untuk nomor yang dicari. Tab `Lapor_Aspirasi` **tidak pernah** ikut terkirim pada `readPublic`.

Bila Script Property **`ADMIN_EMAIL`** diisi, setiap pengaduan baru mengirim **notifikasi email** ke pengurus. Bila Portal Publik dimatikan, form lapor & cek status otomatis disembunyikan dan ditolak server. Selain itu, pengurus dapat menyalakan/mematikan khusus fitur **Lapor & Aspirasi** lewat tombol **ON/OFF** di panel **Portal Publik** (aksi `setLaporStatus`, Script Property `LAPOR_ENABLED`): saat non-aktif, menu Lapor disembunyikan dan pengiriman/pencarian ditolak (`lapor_disabled`).

#### Mengelola Lapor & Aspirasi di Halaman Admin

Menu **Lapor & Aspirasi** pada dashboard admin menampilkan seluruh pengaduan (terbaru di atas) beserta kartu ringkasan jumlah per status.

- **Isi Manual:** menambah pengaduan secara manual. Bila **No. Pengaduan** dibiarkan kosong, server **mengisi otomatis** dengan nomor berurutan (format `ADU/<tahun>-NNN`).
- **Edit:** ubah **Status** (`RT_CONFIG.statusPengaduan`), **Petugas/Pengurus**, **Catatan Tindak Lanjut**, dan **Tanggal Penyelesaian**. Mengubah status menjadi `Selesai` menampilkan permintaan **Tanggal Penyelesaian**. Saat mengedit, **Nama Warga, No. HP, dan Alamat dikunci** (hanya-baca) karena identitas berasal dari data warga; **Lokasi Kejadian, Tanggal Kejadian, dan Harapan/Solusi juga dikunci** agar laporan asli tidak berubah. Saat **mencatat manual**, field **Tanggal Kejadian** & **Tanggal Penyelesaian** memakai format `dd-mm-yyyy` yang dapat diketik maupun dipilih dari kalender; **Tanggal Kejadian tidak boleh melebihi hari ini** dan **Tanggal Penyelesaian tidak boleh lebih awal dari Tanggal Kejadian/Timestamp**.
- **Durasi pengaduan:** kolom **Status** di Daftar Pengaduan juga menampilkan **`N hari`** sejak tanggal laporan; status **Selesai** membekukan durasi memakai **Tanggal Penyelesaian**. Pengaduan Selesai lama tanpa tanggal penyelesaian menampilkan `-` dan petunjuk untuk melengkapinya lewat Edit.
- **Saran AI:** tombol **Saran AI** mengisi draft **Catatan Tindak Lanjut** lewat **Pakai**; catatan tersebut ikut tersimpan ke state lokal dan Google Sheets saat **Simpan**, serta tetap tampil saat pengaduan diedit kembali.
- **Ubah Status cepat:** ikon putar menggilir status `Diterima → Diproses → Selesai → Diterima`.
- **Foto bukti:** pratinjau lampiran tampil di modal edit; tautan Google Drive otomatis dialihkan ke endpoint thumbnail (dengan cadangan `lh3`), sementara **Buka foto asli** tetap membuka URL asli.
- **Arsip (bukan hapus):** ikon kotak arsip membuka dialog seragam **“Arsipkan data?”** (Nama, No. Pengaduan, Judul → **Ya, Arsipkan**) lalu menandai pengaduan sebagai arsip (disembunyikan dari daftar & ringkasan status, tetap tersimpan). Centang **"Tampilkan arsip"** untuk menampilkannya **terpisah di ATAS** tabel dengan judul **"Pengaduan Diarsipkan (N)"** / **"Pengaduan Aktif (M)"**; ikon kotak terbuka memulihkan. Pengaduan terarsip tidak lagi tampil pada Cek Status.
- **Filter & cari:** saring **bulan laporan** (`type=month`, kosong = semua bulan), status, dan cari berdasarkan nomor, nama, atau judul pengaduan. Kartu ringkasan status ikut mengikuti bulan yang dipilih; label tabel menampilkan periode aktif (mis. `- Oktober 2026`). Tombol bersihkan filter mengosongkan semuanya; pilihan bulan terakhir diingat di `localStorage`.
- **Cetak:** ikon **print** di samping judul **Daftar Pengaduan** memanggil `printLaporReport()` — laporan A4 landscape berisi kop RT, periode/status/pencarian aktif, ringkasan **Total/Diterima/Diproses/Selesai**, dan tabel pengaduan (Tanggal, No. Pengaduan, Nama/No. HP, **Alamat / Jenis Pengaduan** bertumpuk, Judul/Detail, Status, Petugas/Tanggal Selesai). Maksimal **15 pengaduan per halaman**, header berulang, footer **Page X of Y**; baris arsip ikut tercetak hanya bila **Tampilkan arsip** aktif. Baris cetak diurutkan **kronologis menaik** berdasarkan timestamp laporan (tabel di layar tetap menampilkan yang terbaru di atas).

Semua operasi tulis dari admin memakai **token admin** (`ADMIN_TOKEN`) seperti modul lain.

#### Notifikasi Email ke Admin

Email otomatis dikirim **hanya untuk pengajuan yang masuk dari Portal Publik** (bukan untuk entri manual admin). Cara mengaktifkan:

1. Isi alamat email admin di **dashboard**: buka menu **Settings > Integrasi Google Sheets**, isi kolom **Admin Email (ADMIN_EMAIL)** lalu klik **Save Email**. Nilainya disimpan sebagai Script Property **`ADMIN_EMAIL`** di backend. (Alternatif: tambahkan langsung di **Project Settings > Script Properties** pada Apps Script. Jangan ditulis di dalam `code.gs` — nilainya dibaca dari Script Properties saat runtime.)
2. (Opsional) Tambahkan **`NOTIF_SENDER_NAME`** untuk mengatur **nama pengirim** yang tampil di kotak masuk (default **`Pengajuan surat`**), **`NOTIF_REPLY_TO`** untuk mengatur alamat **Reply-To** (default memakai nilai `ADMIN_EMAIL`, sehingga balasan otomatis mengarah ke admin), dan **`NOTIF_SUBJECT_PREFIX`** untuk mengatur prefiks subjek email (default **`[SAPA-RT]`**). Ketiganya dapat diubah kapan saja tanpa menyentuh kode.
3. Buka editor **Apps Script**, pilih fungsi **`authorizeMail`** pada dropdown lalu klik **Run** > **Review permissions** > **Allow**. Langkah ini memberi izin scope `script.send_mail` (kirim email) pada akun pemilik; tanpa ini, email gagal dengan error *"You do not have permission to call MailApp.sendEmail"*. Setelah itu deploy ulang sebagai **New version**.
4. Uji dari dashboard: buka menu **Settings > Integrasi Google Sheets**, pastikan kolom **Admin Email** terisi, lalu klik **Test Email Admin**. Bila berhasil, email uji terkirim; alamat yang sedang ada di kolom itu dipakai sebagai penerima sekaligus disimpan ke `ADMIN_EMAIL`. Bila kosong/format salah, muncul pesan error yang menjelaskan.

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

### Asisten AI (Opsional, Gemini)

Fitur bantu tulis **khusus admin**, tanpa mengubah backend. Semua panggilan dilakukan **langsung dari browser admin** ke Gemini API memakai **API key milik admin**.

**Mengaktifkan:**
1. Buat API key gratis di **Google AI Studio**.
2. Buka **Pengaturan → AI Assistant (Gemini)**, tempel key, dan klik **Save**.
3. Klik **Test Gemini Connection** untuk memastikan key & model valid (default `gemini-3.5-flash-lite`). Test memakai **key dan model yang sedang tampil di kolom**; klik **Save** bila ingin menyimpannya untuk draft.
4. Nyalakan toggle **Enable AI assistant**. Tombol **Saran AI** (Lapor), **Bantu Tulis AI** (Pengumuman/Kegiatan/Surat), dan ikon **Ringkas dengan AI** (Iuran & Kas) akan muncul.

> **Catatan model:** kolom **Model** bisa diisi langsung atau dipilih dari daftar yang muncul. Model yang bisa dipakai untuk key/project baru:
>
> | Model | Free tier (indikatif) | Catatan |
> |---|---|---|
> | `gemini-3.5-flash-lite` | 15 RPM / 500 RPD | **Default**, paling seimbang untuk pemakaian harian |
> | `gemini-3.1-flash-lite` | 15 RPM / 500 RPD | Alternatif lama, kuota sama |
> | `gemini-3.8-flash` | 5 RPM / 20 RPD | Kualitas terbaik, kuota harian kecil |
> | `gemini-3.7-flash` | 5 RPM / 20 RPD | Generasi sebelumnya |
> | `gemini-3.6-flash` | 5 RPM / 20 RPD | Generasi sebelumnya |
>
> **`gemini-2.5-flash` tidak deprecated**, tetapi aksesnya dibatasi untuk project yang pernah aktif memakainya; key baru ditolak dengan pesan *"no longer available to new users"*. Model `gemini-2.0-flash`/`2.0-flash-lite` dan model agent seperti Computer Use/Deep Research bukan pilihan untuk fitur ini. Bila free tier habis, aktifkan billing atau gunakan model Lite yang RPD-nya lebih besar.

**Cara pakai di Lapor & Aspirasi:** buka **Isi Manual** atau **Edit** pengaduan, isi **Judul** & **Detail** (minimal 3 & 10 karakter), lalu klik **Saran AI**. Panel menampilkan ringkasan, saran jenis + tombol **Terapkan**, urgensi, draft **Catatan Tindak Lanjut** (tombol **Pakai**), dan draft **Balasan untuk Warga** (tombol **Salin**). Tidak ada yang tersimpan otomatis — admin tetap menekan **Simpan**.

**Cara pakai di Pengumuman & Kegiatan:** buka form **Buat/Edit Pengumuman** atau **Tambah/Edit Agenda Kegiatan**, isi dulu bahan singkat (judul/poin untuk pengumuman, nama/poin untuk kegiatan), lalu klik **Bantu Tulis AI**. Panel menampilkan draft yang bisa diedit; klik **Terapkan ke Form** untuk mengisi kolom terkait (termasuk saran **Kategori** pada pengumuman). Tanggal, waktu, lokasi, dan PJ tidak diubah. Tidak ada auto-save.

**Cara pakai di Pengajuan Surat:** buka **Catat/Edit Pengajuan Surat**, pilih **Jenis Surat** dan isi **Keperluan**, lalu klik **Bantu Tulis AI**. Panel menampilkan ringkasan, daftar hal yang perlu dikonfirmasi, draft **Catatan Pengurus** (tombol **Pakai**/**Salin**), dan draft **Balasan WhatsApp** (tombol **Salin**). NIK, nama, No. KK, No. HP, alamat, dan No. Surat **tidak dibaca/dikirim**; status dan nomor surat tidak diubah otomatis.

**Cara pakai di Iuran & Kas:** pilih periode (Bulan/Tanggal/Semua) seperti biasa, lalu klik ikon **Ringkas dengan AI** di samping tombol cetak. Panel menampilkan **Saldo Awal, Pemasukan, Pengeluaran, dan Saldo Akhir** beserta **narasi** yang bisa disalin. AI **tidak menghitung ulang** dan **tidak mengubah data**; semua angka berasal dari sistem. Nama warga, No. Rumah, dan keterangan transaksi **tidak dikirim**.

**Privasi & keamanan:**
- API key disimpan **hanya di `localStorage`** browser admin (`rt_ai_api_key`, `rt_ai_model`, `rt_ai_enabled`); **tidak** pernah ditulis ke Google Sheets, log, atau dikirim ke backend RT.
- Data yang dikirim ke Gemini: **jenis, judul, detail, lokasi, tanggal kejadian, harapan** (Lapor), isi form **pengumuman/kegiatan**, **jenis surat, keperluan, status** (Surat), atau **angka rekap kas** (Iuran & Kas). **Nama warga, NIK, No. KK, No. HP, alamat lengkap, serta keterangan transaksi kas tidak dikirim.**
- Hasil AI adalah **draft**. Sistem tidak mengubah status, menyimpan, atau menghitung saldo secara otomatis.
- Prompt menandai teks admin/warga sebagai **data**, bukan instruksi, untuk mengurangi risiko *prompt injection*.
- Bila key tidak ada, fitur nonaktif, atau koneksi gagal, form tetap berfungsi normal (AI hanya lapisan bantuan).

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

## 🖥️ Pratinjau Lokal (Mock Backend, Tanpa Menyentuh Produksi)

Untuk menguji aplikasi **lengkap dengan sinkronisasi data** di komputer tanpa mengubah data di Google Sheets, tersedia **mock backend** lokal (`tools/mock-server.js`). Server ini menggantikan peran Cloudflare Pages: menyajikan berkas statis (`/`, `/public`) **dan** menangani endpoint same-origin `/api` persis seperti kontrak Google Apps Script.

```bash
# Jalankan pratinjau lokal (default http://localhost:8000)
node tools/mock-server.js

# Ganti port bila perlu
PORT=8080 node tools/mock-server.js

# Tulis ulang data contoh (mulai dari nol)
node tools/mock-server.js --reset
```

- Data disimpan di `tools/mock-data.json` (dibuat otomatis; berkas ini **tidak** ikut di-commit — lihat `.gitignore`).
- Karena `/api` dilayani penuh oleh server lokal, **tidak ada** permintaan keluar ke `script.google.com`. Google Sheets dan situs produksi **tidak tersentuh sama sekali**.
- Endpoint yang didukung: `version`, `read`, `readPublic`, `checkSurat`, `lookupWarga`, `lookupWargaHp`, `checkLapor`, `sendTestEmail`, `delete` (GET), serta `add` / `update` / `delete` / `setPortalStatus` / `setSuratStatus` / `setLaporStatus` / `setAdminEmail` / `setSaldoAwal` / `submitSurat` / `submitLapor` (POST).
- Token admin boleh diisi apa saja (mock tidak menyimpan rahasia). Portal publik, arsip warga, dan format No. Surat (`SRT-<yymmdd>-XXXX`) juga disimulasikan agar perilaku mendekati produksi.

> Selama pratinjau lokal berjalan, **semua** perubahan data hanya tersimpan di `tools/mock-data.json`. Menghapus/mengedit berkas itu hanya memengaruhi data lokal, bukan produksi.

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

Halaman hanya memakai `preconnect` ke `script.google.com`/`script.googleusercontent.com` (endpoint data). Ikon & font sudah **self-hosted**, jadi tidak ada koneksi ke CDN ikon/font.

### Font & ikon self-hosted (tanpa CDN)

Dulu halaman memuat **Font Awesome 6 dari cdnjs** (~102 KB CSS) dan **Inter dari Google Fonts** (CSS + berkas font) sebagai *render-blocking* di `<head>`. Sekarang keduanya **di-host lokal** dan hanya memuat yang dipakai:

- **Font Awesome 6 (subset):** dari 87+ ikon yang dipakai, dibuat subset webfont (`fonts/fa-solid.woff2` ~9 KB, `fa-regular.woff2` ~3 KB, `fa-brands.woff2` ~1 KB) + aturan gaya ringkas di **`fonts.css`** (~5 KB). Total turun dari ~283 KB berkas FA menjadi ~13 KB.
- **Inter (subset variabel):** hanya glyph Latin, sumbu bobot dipangkas ke **400–700** (bobot 300 tidak dipakai) → `fonts/inter-latin.woff2` ~36 KB. Didefinisikan `font-display: swap`, dan `inter-latin.woff2` + `fa-solid.woff2` di-`preload`.

Berkas terkait: `fonts.css` (induk `@font-face` + kelas ikon FA yang dipakai) dan folder `fonts/`. **Saat mengganti isi berkas font**, naikkan `?v=` pada `fonts.css`, `<link rel="preload">`, dan `sw.js`; `fonts.css` sendiri selalu revalidasi.

### Optimasi jaringan

- **Ikon & font self-hosted (tanpa CDN):** Font Awesome 6 di-subset ke ikon yang benar-benar dipakai (`fonts/fa-*.woff2`, total ~13 KB) dan Inter di-subset Latin/bobot 400–700 (`fonts/inter-latin.woff2` ~36 KB), dimuat lewat `fonts.css` same-origin. Tidak ada lagi koneksi ke `cdnjs.cloudflare.com` / `fonts.googleapis.com`.
- **Pemeriksaan update hemat kuota:** versi build HTML dibaca dari **`version.json`** yang kecil (dengan `cache: 'no-cache'` → respons **304 tanpa body** bila tidak berubah), bukan mengunduh ulang seluruh `index.html` tiap 60 detik.
- **Caching aset (`_headers`):** berkas **`_headers`** (Cloudflare Pages) memberi `Cache-Control` lama (7 hari) untuk ikon statis ber-cache-buster (`rt-icon.png`, `icon-192.png`, `apple-touch-icon.png`, `favicon.ico`) dan untuk `/fonts/*`, serta `must-revalidate` untuk `/config.js`, `/version.json`, `/sw.js`, dan `/fonts.css` agar deteksi versi tetap akurat.
- **Gambar dioptimalkan & anti-CLS:** semua `<img>` memakai `width`/`height` + `decoding="async"`, gambar QR `loading="lazy"`. Ukuran berkas: `qr-public.png` 49,5 KB → 17,3 KB (QR tetap valid), `rt-icon.png` 26 KB → 24 KB, `icon-192.png` 8,3 KB → 8 KB, `apple-touch-icon.png` 7,8 KB → 7,5 KB. Tautan ikon diberi cache-buster `?v=`.

### Keandalan penyimpanan & koneksi

- **Verifikasi tulis (anti "sukses palsu"):** saat memakai proxy same-origin (`/api`), hasil simpan **dibaca dari respons backend** dan baru dianggap sukses bila `{"result":"success"}`. Bila proxy gagal menjangkau Apps Script (`proxy_fetch_failed`/respons tak terduga), permintaan otomatis dicoba ke URL Apps Script langsung.
- **Fallback antar sumber:** pembacaan & penulisan mencoba **proxy dulu**, lalu URL langsung bila proxy gagal/timeout (tiap sumber punya batas waktu sendiri, tidak lagi bergantung pada satu sumber).
- **Anti klik ganda:** permintaan tulis identik yang masih diproses diabaikan agar tidak menghasilkan baris dobel.
- **Sadar offline:** indikator header berubah menjadi **Offline** saat perangkat tanpa internet; Portal Publik menampilkan banner offline. Begitu kembali online, data disinkronkan ulang otomatis.
- **Tombol "Cek Koneksi"** melakukan pemeriksaan versi backend nyata (`action=version`), bukan sekadar mengirim uji kosong.
- Bila token admin salah/kadaluarsa saat menyimpan, aplikasi langsung mengarahkan ke **Pengaturan → Token Admin**.
- **Antrean tulis (outbox):** perubahan yang gagal karena **koneksi** (bukan validasi/token) disimpan di browser (`rt_outbox`) dan **dikirim ulang otomatis** saat kembali online (event `online`, saat data berhasil dimuat, dan berkala tiap 60 dtk). Indikator **Pending sync** + tombol **Coba sekarang** muncul di **Pengaturan → Active Data Source**. Duplikat dicegah karena backend **mengabaikan `add` dengan ID yang sudah ada** (idempoten) — sehingga pengiriman ulang aman.
- **Kerangka aplikasi offline (PWA):** service worker (`sw.js`) menyimpan **app-shell statis** (HTML, CSS, ikon, manifest, `config.js`) agar aplikasi tetap terbuka tanpa internet. **Respons API (`/api`) & Apps Script tidak pernah di-cache**; `config.js` & `version.json` selalu **network-first** supaya deteksi versi tetap akurat.

> **Catatan deploy backend:** fitur antrean aman di atas menyertakan perubahan `code.gs` (`CODE_VERSION` → **`publik-v19-2026-10-12`**, idempotensi `add`). Deploy ulang Apps Script sebagai **New version** agar penanda versi cocok.

---

## 🌐 Publikasi & Kontrol Akses (Cloudflare Pages + Access)

Aplikasi dipublikasikan melalui **Cloudflare Pages** (project dari repository ini), mis. `https://sapa-rt017.pages.dev`:

| URL | Konten | Akses |
|-----|--------|-------|
| `/` dan `/index.html` | Halaman **admin** | **Login Cloudflare Access** (hanya email yang diizinkan) |
| `/public` dan `/public.html` | Portal publik warga | Terbuka (tanpa login) |
| `/api` (proxy same-origin ke Apps Script) | Data portal publik & operasi admin | Terbuka (tanpa login); data tetap dijaga token `ADMIN_TOKEN` |
| `/config.js`, `/version.json`, `/rt-icon.png`, `/icon-192.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`, `/fonts.css`, `/fonts/*`, `/manifest-public.webmanifest`, `/sw.js`, `/qr-public.png` | Aset pendukung, font self-hosted, + berkas PWA portal publik | Terbuka (tanpa login) |

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
   - Tambah hostname: Path `/public.html`, `/api`, `/config.js`, `/version.json`, `/rt-icon.png`, `/icon-192.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`, `/fonts.css`, `/fonts/*`, `/manifest-public.webmanifest`, `/sw.js`, `/qr-public.png`
   - Policy: Action **Bypass**, Include → **Everyone**.

4. **Simpan.** Perubahan berlaku langsung, tanpa redeploy.

> **Penting:** Cloudflare Pages mengalihkan `/public.html` → `/public` (HTTP 308). Karena itu path **`/public`** wajib ikut di-bypass, bukan hanya `/public.html`. Namun **jangan** bypass path `/` atau `/index.html`.
>
> **Penting (ikon/font):** `fonts.css` dan seluruh isi `/fonts/*` juga wajib di-bypass. Bila keduanya masih dilindungi Access, halaman portal publik tetap terbuka tetapi **semua ikon Font Awesome dan font Inter gagal dimuat**; gejala ini paling terlihat di perangkat/browser baru yang belum punya cookie login Access.

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

> **Performa gambar:** semua `<img>` memakai atribut `width`/`height` (mencegah layout bergeser saat memuat) + `decoding="async"`; gambar QR dimuat `loading="lazy"`. Aset `qr-public.png`, `rt-icon.png`, `icon-192.png`, dan `apple-touch-icon.png` sudah dikompres (QR dari ~50 KB menjadi ~17 KB, tetap dapat dipindai). Bila mengganti berkas gambar, naikkan query `?v=` pada tautan ikon agar cache browser terbarui.

> **Catatan keamanan (berlapis):** proteksi halaman admin ada di Cloudflare Access; proteksi data tetap ada di token backend (`ADMIN_TOKEN`). Data warga/kas tidak pernah dikirim ke portal publik berkat endpoint `readPublic`, dan toggle **Portal Publik ON/OFF** ditegakkan di sisi server. Selain itu, seluruh teks yang berasal dari Google Sheets **di-escape** sebelum ditampilkan (Pengumuman/Kegiatan di Portal Publik, kartu Ringkasan di admin) sehingga karakter `<`/`&` tidak dapat menyuntikkan markup.
