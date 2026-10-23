# 📘 Panduan Pengguna SAPA RT

Dokumen ini adalah **buku petunjuk pemakaian** aplikasi SAPA RT (Sistem Administrasi & Pelayanan Antarwarga) untuk **RT 017 / RW 06, Kelurahan Tanjung Duren Utara**. Dokumen ini dibagi menjadi tiga bagian sesuai siapa yang membacanya:

| Anda adalah | Mulai dari | Isinya |
|---|---|---|
| **Pengurus RT** (operator sehari-hari) | [Bagian 1](#bagian-1-panduan-pengurus-rt) | Cara memakai dashboard: data warga, kas, pengumuman, kegiatan, pengajuan surat, portal publik. |
| **Warga** | [Bagian 2](#bagian-2-panduan-warga) | Cara membuka portal, membaca pengumuman, mengajukan surat, dan cek status pengajuan. |
| **Pengurus RT** (yang mengurus sistem) | [Bagian 3](#bagian-3-setup-awal-dan-pemeliharaan) | Setup awal (Google Sheets, Apps Script, Cloudflare), pemeliharaan, backup, dan troubleshooting. |

> Dokumen teknis yang lebih dalam tersedia di [`readme.md`](readme.md) (gambaran fitur & publikasi), [`Apps Script/readme.md`](Apps%20Script/readme.md) (backend & API), dan [`agents.md`](agents.md) (arsitektur untuk pengembang).

### Alamat aplikasi

| Halaman | Alamat (contoh) | Siapa yang memakai | Perlu login? |
|---|---|---|---|
| **Dashboard admin** | `https://sapa-rt017.pages.dev/` | Pengurus RT yang email-nya terdaftar | ✅ Ya — login Cloudflare Access (email + kode PIN) |
| **Portal publik warga** | `https://sapa-rt017.pages.dev/public` | Semua warga | ❌ Tidak |

> Alamat di atas mengikuti pengaturan RT. Bila RT Anda memakai domain lain, ganti nilai `publicPortalUrl` di `config.js` (lihat [Bagian 3](#tautkan-aplikasi-ke-backend)). Tautan portal untuk warga **cukup satu**: bagikan `.../public` atau kode QR-nya.

### Daftar isi

- **Bagian 1 — Pengurus RT:** [Masuk](#masuk-ke-dashboard-admin) · [Tampilan admin](#mengenal-tampilan-admin) · [Ringkasan](#ringkasan-dashboard) · [Data Warga](#data-warga) · [Iuran & Kas](#iuran-dan-kas-rt) · [Pengumuman](#pengumuman) · [Kegiatan](#kegiatan-warga) · [Pengajuan Surat](#pengajuan-surat) · [Lapor & Aspirasi](#lapor-dan-aspirasi) · [Portal Publik](#portal-publik-menyalakan-dan-mematikan) · [Setting](#setting-integrasi-google-sheets) · [Rutinitas](#rutinitas-pengurus-rt)
- **Bagian 2 — Warga:** [Buka portal](#cara-membuka-portal-publik) · [Pengumuman & agenda](#melihat-pengumuman-dan-agenda) · [Ajukan surat](#mengajukan-surat) · [Lapor & aspirasi](#menyampaikan-lapor-dan-aspirasi) · [Cek status](#cek-status-pengajuan-surat) · [Tema & offline](#tema-muat-ulang-dan-mode-offline) · [Nomor darurat](#nomor-siaga-darurat) · [Pasang di HP](#pasang-aplikasi-di-hp) · [FAQ](#pertanyaan-yang-sering-ditanyakan-warga)
- **Bagian 3 — Setup & pemeliharaan:** [Persiapan](#yang-perlu-disiapkan) · [Google Sheets](#siapkan-google-sheets) · [Apps Script](#pasang-apps-script-dan-deploy-web-app) · [Script Properties](#script-properties) · [config.js](#tautkan-aplikasi-ke-backend) · [Cloudflare Pages](#publikasikan-ke-cloudflare-pages) · [Cloudflare Access](#kunci-halaman-admin-dengan-cloudflare-access) · [Checklist deploy](#checklist-setiap-perubahan) · [Backup](#backup-dan-pemulihan-data) · [Troubleshooting](#troubleshooting)

---

# Bagian 1: Panduan Pengurus RT

Panduan ini untuk **Ketua RT, Sekretaris, Bendahara, dan pengurus lain** yang memakai dashboard admin. Tidak perlu keahlian teknis — semua pekerjaan dilakukan lewat menu dan tombol di layar.

## Masuk ke Dashboard Admin

1. Buka alamat dashboard admin di browser (Chrome/Edge/Safari), mis. `https://sapa-rt017.pages.dev/`.
2. Muncul halaman login **Cloudflare Access**. Tulis **email** Anda yang sudah didaftarkan pengurus, lalu klik **Send login code**.
3. Buka kotak masuk email tersebut, salin **kode PIN**, tempel di halaman login, lalu lanjut.
4. Dashboard SAPA RT terbuka.

Catatan penting:

- **Login bukan sekali pakai.** Setelah PIN dimasukkan, browser menyimpan sesi (umumnya 24 jam). Selama sesi masih aktif, membuka alamat admin langsung masuk tanpa minta PIN lagi.
- Bila **email Anda belum terdaftar**, hubungi pengurus yang mengurus sistem untuk menambahkan email Anda (caranya di [Bagian 3](#menambah-pengurus-dan-mencabut-akses)).
- Bila dashboard terbuka tetapi muncul pesan **“Token admin belum diatur/tidak valid”**, isi token di menu **Setting → Integrasi Google Sheets** (lihat [Setting](#setting-integrasi-google-sheets)).
- **Jangan bagikan PIN atau membuka dashboard di perangkat orang lain.** Data warga (NIK, no. HP, alamat) bersifat rahasia.

## Mengenal Tampilan Admin

**Menu di sisi kiri (atau menu ☰ di HP):**

| Menu | Kegunaan |
|---|---|
| **Ringkasan** | Statistik warga, saldo kas, pengumuman terbaru, kegiatan mendatang. |
| **Data Warga** | Pendataan penduduk: tambah, edit, arsip, cari/filter, riwayat surat per warga. |
| **Iuran & Kas RT** | Catat pemasukan/pengeluaran dan lihat saldo kas. |
| **Pengumuman** | Terbitkan papan informasi RT. |
| **Kegiatan Warga** | Agenda kerja bakti, posyandu, siskamling, dll. |
| **Pengajuan Surat** | Kelola permohonan surat dari warga (dan pencatatan manual). Sticky-note **“N baru”** yang berkedip menandai pengajuan yang belum pernah dibuka. |
| **Lapor & Aspirasi** | Kelola pengaduan/aspirasi warga (proses, arsip, cari). Sticky-note **“N baru”** yang berkedip menandai laporan yang belum pernah dibuka. |
| **Portal Publik** | Nyalakan/matikan akses portal untuk warga. |
| **Setting → Integrasi Google Sheets** | Token admin, email notifikasi, tes koneksi, muat data. |
| **Setting → Pasang Aplikasi** | Panduan memasang aplikasi ke layar utama HP/komputer. |
| **Setting → Tentang Aplikasi** | Profil aplikasi, visi & misi RT. |

**Bagian atas layar:**

- **Indikator koneksi** (di sidebar, di bawah logo — teks `Google Sheets:`):
  - **Connected** (hijau) = aplikasi tersambung ke Google Sheets, data tersimpan di server.
  - **Local Only** (kuning) = belum tersambung ke server; perubahan hanya tersimpan di browser ini.
  - **Offline** (merah) = perangkat tidak ada internet.
- **Tombol 🔄 Muat Ulang** — menyegarkan aplikasi (hard refresh). Ada di header desktop, header HP, dan sidebar. **Dibatasi maksimal 1x per 3 menit**; bila ditekan terlalu cepat, muncul pesan sisa waktu tunggu.
- **Tombol “Versi Baru — Muat Ulang”** — muncul **berkedip** hanya bila ada versi aplikasi terbaru. Aplikasi memeriksa versi secara berkala, jadi Anda tidak perlu memeriksa manual — cukup klik saat tombolnya muncul.
- **Terakhir diperbarui** — waktu data terakhir dimuat dari server.

> **Tips HP:** buka dashboard lalu pilih **Setting → Pasang Aplikasi** agar SAPA RT menjadi ikon di layar utama (tampil layar penuh, tanpa address bar).

## Ringkasan Dashboard

Menu **Ringkasan** menampilkan gambaran singkat RT:

- **Total Warga** — ditulis dalam format `jiwa / No. KK` mis. `48 / 14 (KK)`; angka di belakang adalah jumlah **Nomor KK unik**.
- **Saldo Kas RT** — saldo kas berjalan.
- **Pengumuman** — jumlah pengumuman yang tampil.
- **Agenda Kegiatan** — jumlah jadwal kegiatan mendatang.
- **Pengumuman Terbaru** dan **Kegiatan Mendatang** — masing-masing dengan tombol **Lihat Semua** untuk langsung pindah ke menunya.

## Data Warga

### Menambah warga baru

1. Buka menu **Data Warga** → tombol **Tambah Data Warga**.
2. Isi formulir sesuai urutan. Tanda `*` berarti wajib:
   - **Nomor KK (Kartu Keluarga)** — opsional, tetapi sangat disarankan agar statistik KK akurat.
   - **Nama Lengkap** \*
   - **NIK** — opsional, hanya boleh angka, maksimum 16 digit.
   - **Tempat Lahir** dan **Tanggal Lahir** (format `dd-mm-yyyy`, ada pemilih tanggal saat kolom diklik).
   - **Status dalam Keluarga** — Kepala Keluarga, Suami/Istri, Anak, Menantu, Cucu, Orang tua, Mertua, Family lain, Pembantu, Lainnya.
   - **Jenis Kelamin** — Laki-laki / Perempuan.
   - **Pendidikan** dan **Pekerjaan** — teks bebas.
   - **No. HP / WhatsApp** \* — hanya angka; huruf/simbol otomatis dibuang.
   - **Status Tempat Tinggal** \* — Tetap / Kontrak.
   - **Alamat / No. Rumah** \*
3. Klik **Simpan Warga**. Bila berhasil muncul notifikasi, dan data langsung tampil di tabel.

### Mencetak daftar warga

- Klik ikon **print** di samping judul **Data Warga** untuk membuka jendela cetak **Daftar Data Warga** (A4 landscape).
- Laporan mengikuti **pencarian** dan **filter status tempat tinggal** yang aktif. Bila **Tampilkan arsip** dicentang, data arsip **ikut tercetak** (baris berlatar kuning dan berlabel **Arsip**); bila tidak dicentang, hanya data aktif yang dicetak.
- Baris diurutkan berdasarkan **No. KK** menaik; pada setiap KK, **Kepala Keluarga** selalu tampil paling atas, diikuti anggota sesuai urutan data. KK yang kosong diletakkan di akhir.
- Ringkasan di atas tabel: **Total KK**, **Total Warga**, **Kepala Keluarga**, dan **Anggota**.

### Isi otomatis dari NIK (menghemat waktu)

- Begitu **NIK 16 digit** yang valid diketik, kolom **Jenis Kelamin** dan **Tanggal Lahir** terisi otomatis dari angka di dalam NIK.
- Bila Anda memperbaiki NIK, kedua kolom itu ikut diperbarui **selama belum Anda ubah manual**. Isian yang sudah dikoreksi manual tidak akan tertimpa (muncul catatan kecil di bawah kolom NIK).
- Tombol **Isi dari NIK** memaksa pengisian ulang dari NIK.
- Bila tanggal di dalam NIK tidak wajar (mis. bulan 13 atau 30 Februari), muncul peringatan dan isian tidak diubah.

### NIK tidak boleh ganda

Satu NIK hanya boleh terdaftar satu kali. Bila NIK sudah ada, sistem menolak dan menampilkan nama pemilik NIK tersebut. Periksa dulu apakah warga itu sudah pernah didata (termasuk data yang diarsipkan — lihat di bawah).

### Melihat, mencari, dan mengurutkan

- **Kotak pencarian** di atas tabel menjangkau seluruh kolom: nama, NIK, No. HP, tempat/tanggal lahir, usia, status, pendidikan, pekerjaan, dan alamat.
- **Filter Status** (Tetap/Kontrak) di samping kotak pencarian.
- **Klik judul kolom No. KK atau Nama Lengkap** untuk mengurutkan (naik → turun → kembali tanpa urutan).
- Jumlah data yang sedang tampil tertulis di samping judul kolom **No. KK**, mis. `No. KK (14)`.
- Tabel dibuat **ringkas dua baris per kolom** (mis. “Nama Lengkap / Usia”, “NIK / No. HP”) supaya tidak perlu banyak menggeser layar.
- Nomor HP ditampilkan berkelompok 3-3-4 (mis. `081-234-5678`) **hanya untuk tampilan**; nomor yang tersimpan tetap digit asli.
- Ada paginasi di bawah tabel bila datanya banyak.

### Mengedit dan menghubungi warga

- Klik baris atau ikon ✏️ untuk **Edit**.
- Saat mengedit, di bawah kolom No. HP muncul tombol **Chat WhatsApp** dan **Telepon** — praktis untuk menagih iuran atau menanyakan kelengkapan data. Nomor otomatis dinormalisasi (`0812...` menjadi `62812...`). Tombol ini muncul **hanya saat mengedit**, bukan saat menambah data baru.

### Arsip, bukan hapus

Data warga **tidak pernah dihapus permanen**:

1. Klik ikon **📦 Arsipkan** pada baris warga. Muncul dialog peringatan berisi **Nama, Nomor KK, dan NIK** — klik **Ya, Arsipkan** untuk melanjutkan (atau **Batal**).
2. Data hilang dari daftar utama, dashboard, dan pencarian — tetapi **tetap tersimpan** di Google Sheets.
3. Untuk melihatnya, centang **Tampilkan arsip** di atas tabel. Data terarsip tampil **di bagian atas** dengan **latar kuning** dan judul **“Data Diarsipkan (N)”**, diikuti **“Data Aktif (M)”**.
4. Klik ikon **📤 Pulihkan**. Muncul dialog konfirmasi berisi **Nama, Nomor KK, dan NIK** — klik **Ya, Pulihkan** untuk mengembalikan warga ke daftar aktif.

Gunakan arsip untuk warga yang pindah, meninggal, atau kontraknya berakhir — riwayatnya tetap tersimpan untuk keperluan administrasi.

### Riwayat pengajuan surat per warga

Di kolom **Aksi** ada ikon **🕘 (riwayat)**. Klik untuk melihat **seluruh pengajuan surat warga tersebut** (dicocokkan melalui NIK; bila NIK kosong, lewat nama): tanggal, No. Surat, jenis surat, dan statusnya — terbaru di atas. Berguna saat warga bertanya “surat saya sudah jadi belum?”.

## Iuran dan Kas RT

### Mencatat transaksi

1. Buka menu **Iuran & Kas RT** → tombol **Catat Transaksi Kas**.
2. Isi:
   - **Tanggal Transaksi** \* — format `dd-mm-yyyy` (klik kolom untuk memilih dari kalender).
   - **Jenis Transaksi** \* — **Pemasukan (Iuran / Donasi)** atau **Pengeluaran (Operasional / Kebersihan)**.
   - **Nama Warga / Pembayar** \* — mulai mengetik, muncul daftar **Kepala Keluarga** dari Data Warga (untuk pengeluaran, tulis keterangan mis. “Biaya kebersihan”). Nama lain tetap bisa **diketik manual**, mis. nama anggota keluarga atau keterangan pengeluaran. Memilih/mengetik nama warga yang terdaftar otomatis mengisi **No. Rumah**. Bila salah pilih, klik ikon **x** di kanan field untuk mengosongkan **nama & No. Rumah** sekaligus.
   - **No. Rumah** — mis. `12B` (terisi otomatis bila nama warga dipilih).
   - **Jumlah Nominal (Rp)** \* — angka saja, tanpa titik/koma, harus **lebih dari 0**.
   - **Keterangan / Catatan** — klik saran **“Iuran bulan <Bulan>”** (mengikuti bulan berjalan) untuk mengisi cepat, lalu ubah bila perlu — atau langsung ketik catatan bebas, mis. “Iuran kebersihan Oktober”.
3. Klik **Simpan Transaksi**. Bila **nama warga, jenis transaksi, dan nominal** sama dengan transaksi yang sudah ada, muncul peringatan **“Transaksi serupa sudah ada”** — pilih **Ya, Simpan** untuk tetap mencatat (mis. pembayaran ganda yang sah) atau **Batal** untuk memeriksa kembali isian. Baris arsip, entri Reversal, dan record yang sedang diedit tidak dianggap duplikat.
4. Untuk memperbaiki salah ketik, gunakan ikon ✏️ **Edit**. Untuk membatalkan transaksi, gunakan ikon 🔄 **Batalkan** pada baris transaksi.

### Membatalkan transaksi (Reversal)

Pembatalan **tidak menghapus** data. Saat Anda menekan ikon 🔄 **Batalkan**, sistem otomatis menambahkan **satu entri Reversal** dengan nominal yang sama tetapi arah berlawanan:

- Transaksi **pemasukan** → entri **Reversal Keluar** (mengurangi saldo).
- Transaksi **pengeluaran** → entri **Reversal Masuk** (menambah saldo).

Pasangan **transaksi asli + Reversal** selalu berjumlah **nol**, sehingga saldo kembali seperti sebelum transaksi dicatat. Transaksi asli tetap tampil dengan badge **“Dibatalkan”**, dan entri Reversal diberi badge **“Reversal”**. Keduanya memakai **latar amber yang sama** dengan aksen garis di sisi kiri sehingga pasangannya mudah dikenali saat memeriksa riwayat. Keduanya tetap muncul di laporan/cetak agar jejak audit terlihat; kolom **Total Pemasukan** dan **Total Pengeluaran** memuat keduanya (selisihnya nol).

- **Salah membatalkan?** Klik ikon 🔄 **Pulihkan** pada baris yang berbadge “Dibatalkan”. Entri Reversal akan dihapus dan transaksi asli kembali dihitung.
- **Entri Reversal tidak bisa diedit.** Untuk mengubah transaksi, pulihkan dulu pembatalannya, edit, lalu batalkan lagi bila perlu.
- Tanggal entri Reversal mengikuti tanggal transaksi asli (agar pasangan tetap berada di periode laporan yang sama). Waktu pembuatan tetap tercatat di kolom **Timestamp** pada Google Sheets.

### Mengatur Saldo Awal

1. Buka menu **Iuran & Kas RT** → pada kartu **Saldo Awal** (paling kiri) klik ikon ✏️ **pensil**.
2. Isi **Saldo Awal (Rp)** — **saldo dasar sebelum transaksi pertama** mulai dicatat (mis. saldo sisa tahun lalu). Nilai harus angka `>= 0`.
3. Klik **Simpan**. Nilai disimpan ke backend (Script Property `SALDO_AWAL`) sehingga berlaku di semua perangkat.

**Saldo berjalan (running balance):** kartu **Saldo Awal** menampilkan saldo **ditambah akumulasi arus kas periode-periode sebelumnya** untuk periode yang sedang dipilih (Per Bulan/Per Tanggal); pada **Semua Data** ia sama dengan saldo dasar. **Saldo Akhir = Saldo Awal periode + Total Pemasukan − Total Pengeluaran.**

### Membaca dan menyaring laporan kas

- Empat kartu ringkasan di atas tabel: **Saldo Awal**, **Total Pemasukan**, **Total Pengeluaran**, dan **Saldo Akhir**.
- Pilihan periode di kanan atas tabel: **Per Bulan** (default), **Per Tanggal**, atau **Semua Data**. Kartu ringkasan **ikut berubah** mengikuti periode yang dipilih — jadi laporan bulanan tinggal memilih bulannya saja. Pilihan ini tersimpan di browser Anda.
- **Baris filter per kolom** tepat di bawah judul kolom (Tanggal, Nama, No. Rumah, Jenis, Nominal, Catatan) untuk menyaring sangat spesifik. Tombol **🚫 filter** mengosongkan semua filter sekaligus.
- Kotak **Cari transaksi** untuk pencarian cepat.
- Riwayat selalu diurutkan **terbaru di atas** (tanggal menurun). Bila tanggalnya sama, entri yang **terakhir dicatat** tampil lebih dulu — termasuk entri Reversal — sehingga aksi terbaru mudah terlihat. Urutan ini juga dipakai pada hasil **cetak**.
- Transaksi lama yang masih bertanda **`Diarsipkan=Ya`** otomatis disembunyikan dan tidak dihitung dalam saldo. Fitur arsip kas sudah **tidak dipakai lagi**; untuk memunculkan data lama tersebut, ubah kolom **`Diarsipkan`** menjadi `Tidak` langsung di Google Sheets. Untuk transaksi yang **dibatalkan**, gunakan badge **Dibatalkan** + ikon **Pulihkan** (menghapus entri Reversal).
- Ikon **print** (🖨️) di samping judul **Riwayat Transaksi** membuka jendela cetak berisi **laporan kas sederhana**: identitas RT, periode terpilih, ringkasan Saldo Awal/Pemasukan/Pengeluaran/Saldo Akhir, serta tabel transaksi + totalnya. Laporan mengikuti **periode, pencarian, dan filter** yang sedang aktif — jadi cetak dulu setelah menyaring bila ingin laporan spesifik, lalu pilih printer atau **Simpan sebagai PDF**. Header/footer bawaan browser (URL, tanggal, dan nomor halaman) tidak ikut tercetak.

**Contoh pemakaian:** tutup buku bulanan = pilih **Per Bulan** → pilih bulan berjalan → catat **Total Pemasukan** dan **Total Pengeluaran** → laporkan di pengumuman/rapat RT.

## Pengumuman

1. Buka menu **Pengumuman** → tombol **Buat Pengumuman Baru**.
2. Isi:
   - **Tanggal** \* (`dd-mm-yyyy`)
   - **Judul Pengumuman** \*
   - **Kategori** \* — Informasi Umum, Penting/Mendesak, Keuangan, atau Kegiatan.
   - **Isi Pengumuman** \*
   - **Penanggung Jawab / Pengurus** \*
   - Centang **“Tampilkan di Portal Publik (bisa dilihat warga)”** — biarkan tercentang bila pengumuman memang untuk warga.
3. Klik **Terbitkan**.

Mengelola pengumuman yang sudah ada:

- Ikon 👁️ **Sembunyikan / Tampilkan** — menyembunyikan pengumuman dari portal warga tanpa menghapusnya.
- Ikon ✏️ **Edit** — memperbaiki isi/judul.
- Ikon 🗑️ **Hapus** — menghapus permanen (dengan konfirmasi). Bila hanya ingin menonaktifkan, pakai **Sembunyikan** saja.

## Kegiatan Warga

1. Buka menu **Kegiatan Warga** → tombol **Tambah Agenda Kegiatan**.
2. Isi **Nama Kegiatan** \*, **Tanggal** \* (`dd-mm-yyyy`), **Waktu** \*, **Lokasi** \*, **Penanggung Jawab** \*, **Keterangan / Perlengkapan** (mis. “Membawa cangkir dan sapu lidi”), lalu centang **Tampilkan di Portal Publik** bila perlu diketahui warga.
3. Klik **Simpan Agenda**.

Sama seperti pengumuman, tiap baris punya tombol **Tampilkan/Sembunyikan**, **Edit**, dan **Hapus**. Kegiatan yang akan datang otomatis muncul di **Ringkasan** (Kegiatan Mendatang) dan di portal warga dengan penanda sisa hari.

## Pengajuan Surat

Menu ini adalah “meja pelayanan” pengurus untuk permohonan surat pengantar/keterangan warga.

### Alur singkat

```
Warga mengisi formulir di portal publik  →  status Pending
        ↓
Pengurus verifikasi & proses              →  status Diproses
        ↓
Surat ditandatangani, nomor surat dicatat →  status Selesai
        ↓
Warga cek status di portal & mengambil surat
        ↓
(Bila tidak memenuhi syarat)              →  status Ditolak + catatan alasan
```

### Daftar pengajuan

- Empat kartu ringkasan di atas tabel menunjukkan jumlah pengajuan per status: **Pending, Diproses, Selesai, Ditolak** (seluruh pengajuan aktif, tidak terpengaruh periode).
- Tabel terbaru di atas, dengan kolom **Tanggal / No. Pengajuan**, **Nama Pemohon / NIK** (NIK disamarkan, mis. `3173••••••01`), **No. HP / Alamat**, **Jenis Surat**, **Keperluan**, **Status**, dan **Aksi**.
- Di bawah badge **Status** tampil **durasi** lamanya pengajuan, mis. `12 hari`. Untuk status **Pending/Diproses** hitungan berjalan sampai hari ini; saat status **Selesai** atau **Ditolak**, durasi **berhenti** pada tanggal akhir yang dicatat.
- Saat mengubah status menjadi **Selesai** atau **Ditolak**, kolom **Tanggal Selesai** / **Tanggal Ditolak** muncul dan otomatis terisi tanggal hari ini — ubah bila tanggal sebenarnya berbeda. Bila status dikembalikan ke status aktif, tanggal itu dikosongkan. Pengajuan **Selesai/Ditolak** lama yang belum punya tanggal akhir menampilkan `-`; buka **Edit** untuk mengisinya.
- **Filter periode** di kanan atas tabel: **Per Bulan** (default = bulan berjalan), **Per Tanggal**, atau **Semua Data** (pola sama dengan Iuran & Kas). Pilihan tersimpan di browser. Label di samping judul **Daftar Pengajuan** menampilkan jumlah baris + periode aktif.
- **Filter** berdasarkan status dan **kotak cari** (nama, NIK, jenis surat, no. pengajuan, atau No. Surat).
- **Cetak daftar:** ikon **print** (🖨️) di samping judul **Daftar Pengajuan** membuka jendela cetak berisi **laporan pengajuan sederhana** (kop RT, periode, waktu cetak, ringkasan jumlah per status, dan tabel pengajuan + jumlahnya). Laporan mengikuti **periode, pencarian, & filter status** yang sedang tampil, lalu pilih printer atau **Simpan sebagai PDF**. Header/footer bawaan browser tidak ikut tercetak. **Arsip tidak ikut tercetak** kecuali **Tampilkan arsip** dicentang.
- Centang **Tampilkan arsip** bila ingin melihat pengajuan yang sudah diarsipkan.

### Mencatat pengajuan manual (Isi Manual)

Untuk permohonan yang disampaikan lisan/datang langsung:

1. Klik **Isi Manual**.
2. Masukkan **NIK** lebih dahulu. Bila NIK valid **dan terdaftar**, kolom **Nama Lengkap, No. HP, dan Alamat** terisi otomatis. Mengganti NIK akan memperbarui ketiganya.
3. Lengkapi **Jenis Surat**, **Keperluan**, **No. Surat** (bila sudah ada), **Status Pengurusan**, dan **Catatan Pengurus**.
4. Klik **Simpan Pengajuan**. Nomor pengajuan dibuat otomatis dengan format yang sama seperti pengajuan warga (mis. `SRT-261006-AB12`).

> NIK divalidasi ketat (16 digit, jenis kelamin, bulan, dan jumlah hari). Bila tidak lolos, muncul pesan error di dalam modal dan kolom yang bermasalah disorot.

### Memproses pengajuan

- **Ubah status cepat:** klik ikon 🔄 untuk menggilir status `Pending → Diproses → Selesai → Ditolak → Pending`.
- **Edit (klik baris atau ikon ✏️):** ubah **Status Pengurusan**, **No. Surat**, dan **Catatan Pengurus**. Kolom **Catatan Pengurus** kini selebar form dan berupa kotak teks beberapa baris yang bisa ditarik lebih tinggi, sehingga catatan panjang mudah dibaca dan ditulis. Di modal ini juga terlihat **No. Pengajuan** dan **tanggal pengajuan**.
  - **NIK & No. HP terkunci saat mengedit** — keduanya dipakai warga untuk cek status, jadi tidak boleh berubah. (Saat **Isi Manual** baru, kedua kolom ini masih bisa diisi.)
  - **No. Surat wajib diisi ketika status diubah menjadi `Selesai`.** Bila nomor masih kosong, sistem otomatis membuka modal untuk memintanya; server juga menolak menyimpan status `Selesai` tanpa nomor surat.
  - **Catatan Pengurus** sangat dianjurkan saat menolak/meminta kelengkapan, mis. “KTP belum dilampirkan”.
- **Hubungi pemohon:** saat mengedit, di bawah kolom No. HP muncul tombol **Chat WhatsApp** dan **Telepon**.
- **Arsip (bukan hapus):** ikon 📦 membuka dialog peringatan seragam **“Arsipkan data?”** berisi **Nama, No. Pengajuan, dan Jenis Surat**; klik **Ya, Arsipkan** untuk melanjutkan. Pengajuan terarsip tidak ikut hitungan kartu status, tampil terpisah di bagian atas tabel dengan latar kuning dan badge **“Arsip”**, serta bisa dipulihkan dengan ikon 📤. **Warga tetap bisa memeriksa status pengajuan yang diarsipkan.**

### No. Surat dan hasil untuk warga

- Setelah **No. Surat** diisi, nomornya tampil **di bawah Jenis Surat** pada tabel (dengan ikon) supaya mudah dipantau.
- Warga melihat No. Surat tersebut pada hasil **Cek Status**, disorot warna kuning — beri tahu warga bahwa surat sudah bisa diambil.

### Notifikasi email (bila diaktifkan)

Bila pengurus sudah mengisi **Admin Email** di Setting, setiap pengajuan **baru dari portal publik** akan mengirim email notifikasi ke alamat itu (pengajuan yang dicatat manual tidak mengirim email). Cara mengaktifkan/mengujinya ada di [Setting](#setting-integrasi-google-sheets) dan [Script Properties](#script-properties).

## Lapor dan Aspirasi

Menu **Lapor & Aspirasi** menampung **pengaduan, keluhan, dan aspirasi** warga — misalnya sampah menumpuk, lampu jalan mati, atau usulan kegiatan. Warga mengirimnya dari Portal Publik; pengurus memprosesnya di sini.

### Daftar pengaduan

- Baris terbaru tampil di atas. Setiap baris memperlihatkan **No. Pengaduan** (format `ADU/2026-001`), tanggal, nama & No. HP warga, jenis, judul, status, dan aksi. Di bawah badge status tampil **durasi `N hari`** sejak tanggal pengaduan; untuk status **Selesai** hitungan dibekukan sampai **Tanggal Penyelesaian** (sama seperti Daftar Pengajuan).
- **Kartu ringkasan status** di atas tabel: jumlah **Diterima**, **Diproses**, dan **Selesai**.
- **Filter bulan**, **filter status**, dan **kotak pencarian** (nomor, nama, atau judul) membantu menemukan pengaduan tertentu. Kolom bulan boleh dikosongkan untuk menampilkan semua bulan; kartu ringkasan status dan label daftar ikut menyesuaikan bulan yang dipilih.
- **Cetak daftar:** klik ikon **print** di samping judul **Daftar Pengaduan** untuk mencetak daftar sesuai filter aktif (A4 landscape, maksimal 15 baris per halaman, nomor halaman di footer). Hasil cetak diurutkan **dari tanggal paling lama ke terbaru**.

### Memproses pengaduan

1. Klik baris (atau ikon pensil) untuk membuka **Edit**.
2. Ubah **Status** mengikuti alur **Diterima → Diproses → Selesai**. Saat memilih **Selesai**, isi **Tanggal Penyelesaian** (format **dd-mm-yyyy**, mis. `14-10-2026`). **Tanggal Kejadian** pada form edit juga memakai format **dd-mm-yyyy**. Tanggal dapat **diketik langsung** pada fieldnya, atau dipilih lewat kalender saat field diklik. **Tanggal Kejadian tidak boleh melebihi hari ini**, dan **Tanggal Penyelesaian tidak boleh lebih awal** dari **Tanggal Kejadian** maupun **tanggal laporan** (Timestamp) — sistem akan menolak bila terbalik.
3. Isi **Petugas/Pengurus** yang menangani dan **Catatan Tindak Lanjut** untuk warga. Saat mengedit, **Nama Warga, No. HP, dan Alamat dikunci** karena berasal dari data warga; **Lokasi Kejadian, Tanggal Kejadian, dan Harapan / Solusi juga dikunci** agar isi laporan asli warga tidak berubah. Lampiran **Foto / Bukti Pendukung** warga tampil sebagai **pratinjau** — tautannya **dikunci** (tidak dapat diubah) dan bisa dibuka ukuran asli lewat tombol **“Buka foto asli”**.
4. Klik **Simpan**. Ikon **ubah status cepat** (putar) juga bisa dipakai untuk menggilir status tanpa membuka modal.

### Mencatat pengaduan manual

Untuk pengaduan yang diterima lisan/lewat telepon, klik **Isi Manual**. Bila **No. Pengaduan** dibiarkan kosong, sistem mengisinya otomatis berurutan.

### Foto bukti pendukung

Saat mengedit pengaduan, **Foto / Bukti Pendukung** menampilkan pratinjau gambar. Untuk lampiran Google Drive, aplikasi otomatis memakai tautan thumbnail Drive agar gambar tetap tampil di dalam aplikasi; klik **Buka foto asli** untuk membuka berkas aslinya di tab baru.

### Arsip, bukan hapus

Pengaduan yang sudah tuntas bisa **diarsipkan** (ikon kotak arsip). Dialog **“Arsipkan data?”** yang sama menampilkan **Nama, No. Pengaduan, dan Judul** sebelum Anda menekan **Ya, Arsipkan**; data tetap tersimpan, hanya disembunyikan dari daftar & ringkasan. Centang **“Tampilkan arsip”** untuk melihatnya **terpisah di atas** tabel; klik ikon kotak terbuka untuk **memulihkan**. Pengaduan terarsip tidak lagi muncul pada **Cek Status Pengaduan** warga.

### Notifikasi email

Sama seperti Pengajuan Surat, bila **Admin Email** diisi di Setting, setiap pengaduan baru dari portal mengirim email notifikasi ke pengurus. Bila warga melampirkan foto, email memuat baris **"Bukti pendukung : View foto"** dengan tautan **View foto** ke lampiran di Google Drive.

### Bantuan AI (opsional)

Pengurus bisa meminta bantuan **Gemini** untuk merangkum pengaduan, menyiapkan draft balasan, merapikan **Pengumuman**/**Agenda Kegiatan**, serta meninjau **Pengajuan Surat** dan merangkum **Iuran & Kas**. Fitur ini **opsional** dan tidak mengubah data secara otomatis.

1. Buka **Setting → Integrasi Google Sheets**, lalu pada kartu **AI Assistant (Gemini)** tempel **API key** Gemini (buat gratis di Google AI Studio), klik **Save**, dan **Test Gemini Connection**.
2. Nyalakan **Enable AI assistant**. Tombol **Saran AI** (pengaduan), **Bantu Tulis AI** (pengumuman/kegiatan/surat), dan ikon **Ringkas dengan AI** (Iuran & Kas) akan muncul. Pada kolom **Model**, pilih dari daftar; default **`gemini-3.5-flash-lite`** (kuota harian lebih besar). Untuk kualitas lebih tinggi, pilih **`gemini-3.8-flash`** (kuota harian lebih kecil). **Test Gemini Connection** memakai key/model yang sedang tampil; klik **Save** setelahnya agar dipakai untuk draft.
3. Buka **Lapor & Aspirasi → Isi Manual** atau **Edit**, isi **Judul** & **Detail**, lalu klik **Saran AI**.
4. Periksa panel saran: ringkasan, **Jenis Pengaduan** (klik **Terapkan**), **urgensi**, **draft Catatan Tindak Lanjut** (klik **Pakai**), dan **draft Balasan untuk Warga** (klik **Salin**).
5. Edit bila perlu, lalu **Simpan** seperti biasa. Catatan yang diisi lewat **Pakai** ikut tersimpan dan tetap tampil saat pengaduan dibuka kembali.

Untuk **Pengumuman/Kegiatan**: isi dulu bahan singkat (judul/poin atau nama/poin), klik **Bantu Tulis AI**, periksa draft, lalu klik **Terapkan ke Form**. Tanggal, waktu, lokasi, dan PJ tetap diisi manual.

Untuk **Pengajuan Surat**: buka **Catat/Edit Pengajuan Surat**, pilih **Jenis Surat** dan isi **Keperluan**, klik **Bantu Tulis AI**. Panel menampilkan ringkasan, daftar hal yang perlu dikonfirmasi, draft **Catatan Pengurus** (bisa **Pakai**/**Salin**), dan draft **Balasan WhatsApp** (bisa **Salin**). NIK, nama, No. KK, No. HP, alamat, dan No. Surat tidak dibaca/dikirim.

Untuk **Iuran & Kas**: pilih periode seperti biasa, lalu klik ikon **Ringkas dengan AI** di samping tombol cetak. Panel menampilkan **Saldo Awal, Pemasukan, Pengeluaran, Saldo Akhir**, dan **narasi** yang bisa disalin. Angka **dihitung oleh sistem**; AI tidak menghitung ulang dan tidak mengubah data. Nama warga, No. Rumah, dan keterangan transaksi tidak dikirim.

> **Jika muncul "model is no longer available to new users":** pilih model lain dari daftar (mis. **`gemini-3.5-flash-lite`**), klik **Save**, lalu **Test Gemini Connection**. `gemini-2.5-flash` masih dilayani untuk project lama, tetapi tidak untuk key baru.

Catatan privasi: API key hanya tersimpan di browser pengurus. Yang dikirim ke Gemini hanya isi form yang relevan — pada pengaduan: **jenis, judul, detail, lokasi, tanggal kejadian, dan harapan**; pada surat: **jenis surat, keperluan, dan status**; pada kas: **angka rekap** saja. **Nama, NIK, No. KK, No. HP, alamat lengkap, No. Surat, serta keterangan transaksi kas tidak dikirim.** Semua hasil AI berupa draft dan tidak pernah disimpan otomatis.

## Portal Publik: Menyalakan dan Mematikan

Menu **Portal Publik** mengatur halaman yang dilihat warga.

- **Toggle Portal Publik** dengan badge **AKTIF** / non-aktif:
  - **AKTIF** — warga bisa membuka portal, membaca pengumuman/kegiatan, mengajukan surat, dan menyampaikan **Lapor & Aspirasi**.
  - **non-aktif** — server menolak permintaan portal, form pengajuan surat, lapor/aspirasi & cek status otomatis disembunyikan. Data benar-benar tidak bisa diakses, bukan sekadar tautannya disembunyikan.
- **Toggle Layanan Surat** dengan badge **AKTIF** / non-aktif — mengatur khusus menu pengajuan & cek status surat:
  - **AKTIF** — form pengajuan surat & cek status tersedia untuk warga.
  - **non-aktif** — menu Layanan Surat disembunyikan dari Portal Publik dan server menolak pengiriman/pencarian (`surat_disabled`). Pengumuman, kegiatan, dan Lapor & Aspirasi tetap berjalan normal.
- **Toggle Lapor & Aspirasi** dengan badge **AKTIF** / non-aktif — mengatur khusus fitur pengaduan/aspirasi:
  - **AKTIF** — form lapor/aspirasi & cek status tersedia untuk warga.
  - **non-aktif** — menu Lapor & Aspirasi disembunyikan dari Portal Publik dan server menolak pengiriman/pencarian (`lapor_disabled`). Pengumuman, kegiatan, dan layanan surat tetap berjalan normal.
- **Buka Portal** — membuka portal publik di tab baru untuk memeriksa tampilannya.
- Ringkasan **“Apa yang Bisa Dilihat Warga?”** (dapat dibuka/ditutup dengan mengklik judulnya):
  - **Bisa dilihat:** Pengumuman RT, Agenda Kegiatan Warga, informasi resmi RT, form pengajuan surat, form lapor/aspirasi, & cek status.
  - **Tidak bisa dilihat:** data pribadi warga, rekening/kas RT, data pengaduan/surat warga lain, tombol tambah/edit/hapus.
- Hanya pengumuman & kegiatan yang ditandai **Publik** yang tampil. Gunakan ikon 👁️ pada kartu untuk menampilkan/menyembunyikan.

> **Kapan portal dimatikan?** Misalnya saat migrasi data atau ada gangguan. Ingat: saat OFF, warga **tidak bisa mengajukan surat** maupun **mengirim lapor/aspirasi**.

## Setting: Integrasi Google Sheets

Menu **Setting → Integrasi Google Sheets**. Halaman ini untuk memastikan aplikasi tersambung ke database yang benar. Bagian **AI Assistant (Gemini)** dan **Apps Script setting** dapat dilipat; keduanya **tertutup secara default** — klik judulnya untuk membuka.

- **Active Data Source** — informasi penting saat melaporkan masalah:
  - **Transport:** jalur yang sedang dipakai (mis. `Proxy /api (active) · fallback: direct`).
  - **Web App URL:** alamat backend Apps Script yang dituju.
  - **Backend version:** versi kode backend (`CODE_VERSION`) yang sedang berjalan.
- **Admin Token (`ADMIN_TOKEN`)** — wajib untuk menyimpan/mengubah/menghapus data. Tempel token rahasia RT, lalu klik **Save Token**. Bila token salah/kosong, server menolak permintaan dan muncul pesan kesalahan.
- **Admin Email (`ADMIN_EMAIL`)** — alamat penerima notifikasi pengajuan surat. Klik **Save Email**, lalu **Test Email Admin** untuk memastikan pengiriman berhasil.
- **Test Connection** — memeriksa koneksi ke backend secara nyata.
- **Load Data from Sheets** — memuat ulang data dari Google Sheets (sama dengan tombol 🔄 di header).
- **Check Backend Version** — memastikan backend sudah memakai versi terbaru.
- **AI Assistant (Gemini)** — opsional. Tempel **API key** Gemini milik pengurus, klik **Save**, lalu **Test Gemini Connection**. Key hanya disimpan di browser ini (tidak dikirim ke Google Sheets). Nyalakan **Enable AI assistant** untuk memunculkan tombol **Saran AI** di form pengaduan dan **Bantu Tulis AI** di form pengumuman/kegiatan/surat. Lihat bagian **Bantuan AI**.
- **Reset Demo Data (Local)** — **hanya** menghapus data demo yang tersimpan di browser ini. **Tidak** menghapus apa pun di Google Sheets. Aman digunakan setelah sesi demo/pelatihan.
- **Demo Mode (Offline)** — penjelasan mode tanpa server. Bila `publicApiUrl` dan `apiBase` di `config.js` dikosongkan, aplikasi berjalan lokal (semua data hanya di browser) — berguna untuk pelatihan pengurus tanpa menyentuh data asli.

## Rutinitas Pengurus RT

**Harian / beberapa kali sehari**

- [ ] Buka dashboard (atau cek notifikasi email) dan lihat **Pengajuan Surat** ber-status **Pending**.
- [ ] Proses pengajuan: ubah ke **Diproses**, hubungi warga bila ada yang kurang, catat di **Catatan Pengurus**.
- [ ] Setelah surat ditandatangani, isi **No. Surat** dan ubah status ke **Selesai**.
- [ ] Cek menu **Lapor & Aspirasi**: tindak lanjuti pengaduan ber-status **Diterima/Diproses**, isi **Petugas** & **Catatan Tindak Lanjut**, lalu arsipkan yang sudah **Selesai**.

**Mingguan**

- [ ] Perbarui **Data Warga** bila ada warga baru/pindah (pakai **Arsip** untuk yang sudah tidak tinggal).
- [ ] Terbitkan **Pengumuman** untuk kegiatan atau imbauan minggu ini.
- [ ] Perbarui **Kegiatan Warga** (kerja bakti, posyandu, siskamling).

**Bulanan**

- [ ] Catat semua iuran dan pengeluaran di **Iuran & Kas RT**.
- [ ] Pilih periode **Per Bulan**, catat **Total Pemasukan**, **Total Pengeluaran**, dan **Saldo Akhir** untuk laporan rapat.
- [ ] Arsipkan pengajuan surat yang sudah lama selesai agar tabel tetap ringkas.
- [ ] Buat salinan cadangan Google Sheets (lihat [Backup](#backup-dan-pemulihan-data)).

---

# Bagian 2: Panduan Warga

Bagian ini untuk **seluruh warga RT**. Portal dibuka lewat browser — tidak ada kata sandi dan tidak wajib menginstal apa pun (bila ingin lebih praktis, portal bisa dipasang ke layar utama HP seperti aplikasi; lihat [Pasang Aplikasi di HP](#pasang-aplikasi-di-hp)).

## Cara Membuka Portal Publik

Ada empat cara:

1. **Klik tautan yang dibagikan pengurus** — biasanya berbentuk `https://sapa-rt017.pages.dev/public`.
2. **Pindai kode QR** — kode QR portal tertempel di papan pengumuman/pos ronda, dan juga bisa dibuka dari portal: **klik logo RT** di pojok kiri atas untuk menampilkan kode QR yang dapat dipindai langsung dari ponsel orang lain.
3. **Pakai Layanan Cepat** — di bagian atas portal ada dua pasangan ikon besar: **Ajukan Surat / Cek Status** dan **Lapor / Cek Pengaduan**. Ketuk salah satu untuk langsung menuju layanan yang dituju. Bila hanya satu layanan yang dibuka admin, pasangannya melebar penuh; bila **Layanan Surat dan Lapor sama-sama OFF**, panel ini tidak ditampilkan. Ikon-ikon di header juga berukuran besar agar mudah ditekan di ponsel. Tampilan panel mengikuti tema terang/gelap yang dipilih.
4. **Simpan sebagai aplikasi** di layar utama ponsel (lihat [Pasang Aplikasi di HP](#pasang-aplikasi-di-hp)) agar mudah dibuka kembali.

Portal dapat dibuka dari ponsel maupun komputer. Isinya sama.

## Melihat Pengumuman dan Agenda

- Bagian **Pengumuman** menampilkan papan informasi resmi RT: imbauan, informasi keuangan, dan kabar penting. Setiap pengumuman punya judul, tanggal, kategori, dan keterangan penanggung jawab.
- Bagian **Agenda Kegiatan** menampilkan jadwal kegiatan warga (kerja bakti, posyandu, siskamling, acara komunitas) lengkap dengan tanggal, waktu, lokasi, penanggung jawab, dan keterangan perlengkapan. Kegiatan yang sudah dekat diberi penanda sisa hari.
- Label **Terakhir diperbarui** di atas daftar menunjukkan kapan data terakhir diambil dari server RT.
- Tombol **Muat Ulang** di header untuk mengambil kabar terbaru. Bila pengurus baru memperbarui data, tombol ini akan **berkedip dengan label “Versi Baru”** — klik kapan pun Anda siap (tidak akan mengganggu isian form yang sedang Anda tulis).

## Mengajukan Surat

Layanan ini menggantikan cara lama “minta surat ke rumah Pak RT”. Formulirnya ada di bagian **Layanan Surat**; kartu **Ajukan Surat Baru** harus **diklik dahulu** untuk membuka formulir.

1. **Klik judul “Ajukan Surat Baru”** untuk membuka formulir.
2. **Isi NIK (16 digit) lebih dulu.** Bila NIK Anda sudah terdaftar di data warga:
   - **Nama Lengkap** dan **Alamat / No. Rumah** terisi otomatis dan **terkunci** (hanya tampilan, tidak bisa diubah) — jadi tidak mungkin salah tulis.
   - **No. HP / WhatsApp** terisi **tersamar** (mis. `0812••••7890`). Ketuk kolom itu untuk memeriksa/memperbaiki nomor Anda; nomor asli yang tersimpan tetap yang dikirim.
   - Bila NIK **belum terdaftar**, akan muncul keterangan; Anda **tetap bisa mengisi** nama, alamat, dan nomor secara manual lalu mengirim pengajuan.
3. Pilih **Jenis Surat** (mis. Surat Pengantar KTP-el, SKTM, Domisili, SKCK, dan lainnya).
4. Tulis **Keperluan / Alasan Pengajuan** — mis. “untuk perpanjangan KTP-el”.
5. Bila **NIK + No. HP** Anda sudah pernah mengajukan **jenis surat yang sama**, muncul panel kuning berisi **tanggal** dan **keperluan** pengajuan sebelumnya. Ini hanya **peringatan** — Anda **tetap boleh melanjutkan** bila memang perlu mengajukan lagi.
6. Klik **Kirim Pengajuan**.
7. **Catat Nomor Pengajuan** yang muncul, mis. `SRT-261006-AB12`. Nomor ini bukti pengajuan Anda — simpan (screenshot atau catat di HP).

Yang perlu diketahui:

- Status awal setiap pengajuan adalah **Pending**; pengurus akan mengubahnya menjadi **Diproses**, lalu **Selesai** (surat sudah jadi) atau **Ditolak** (beserta alasannya).
- Batas aman pemakaian: maksimal **5 pengajuan per NIK per jam**. Bila Anda mendapat pesan batas tercapai, tunggu satu jam atau hubungi pengurus.
- Tulis **satu keperluan per pengajuan** supaya pengurus mudah memproses.
- Butuh panduan di tempat? Klik ikon **ⓘ** di samping judul **Layanan Surat** — muncul jendela **Panduan Layanan Surat** berisi langkah-langkah yang sama.

## Menyampaikan Lapor dan Aspirasi

Menu **Lapor & Aspirasi** ada **di bawah Layanan Surat** pada Portal Publik. Gunakan untuk menyampaikan **pengaduan, keluhan, atau aspirasi** — misalnya sampah menumpuk, lampu jalan mati, saluran air tersumbat, atau usulan perbaikan fasilitas. Kartunya **diklik dahulu** untuk membuka formulir.

1. **Klik judul “Lapor / Aspirasi Warga”** untuk membuka formulir.
2. **Isi No. WhatsApp lebih dulu.** Hanya nomor yang **terdaftar di data warga** yang bisa mengirim:
   - Bila nomor terdaftar, **Nama Warga** dan **Alamat / Blok / No Rumah** terisi otomatis dan **terkunci** (hanya tampilan).
   - Bila nomor belum terdaftar, muncul keterangan — hubungi pengurus RT untuk didaftarkan agar bisa mengirim.
3. Pilih **Jenis Pengaduan** (mis. Lingkungan & Kebersihan, Penerangan Jalan, Saluran Air/Drainase, Keamanan Lingkungan, Sampah, Aspirasi/Saran, dan lainnya).
4. Tulis **Judul Pengaduan** dan **Detail** kejadian selengkap mungkin.
5. (Opsional) Isi **Lokasi Kejadian**, **Tanggal Kejadian** (format **dd-mm-yyyy**, mis. `14-10-2026`; bisa juga dipilih lewat kalender), dan **Harapan / Solusi**.
6. (Opsional) Lampirkan **Foto/Bukti Pendukung** (gambar, maks. 8 MB) — foto otomatis dikompres sebelum diunggah.
7. Centang **persetujuan penggunaan data**, lalu klik **Kirim**.
8. **Catat Nomor Pengaduan** yang muncul, mis. `ADU/2026-001` — gunakan tombol **Salin** di sebelah nomor untuk menyalinnya. Nomor ini dipakai untuk memantau status.

**Cek Status Pengaduan:** klik judul **“Cek Status Pengaduan”** di bawahnya, masukkan **No. Pengaduan**, lalu klik **Cek**. Anda akan melihat status (**Diterima / Diproses / Selesai**), petugas yang menangani, catatan tindak lanjut, dan tanggal penyelesaian (bila sudah selesai). Nomor pengaduan pada hasil juga bisa **disalin**.

Yang perlu diketahui:

- Status awal pengaduan adalah **Diterima**; pengurus akan mengembangkannya menjadi **Diproses** lalu **Selesai**.
- Batas aman pemakaian: maksimal **5 pengaduan per nomor per jam**.
- Satu pengaduan untuk satu masalah agar mudah ditindaklanjuti.

## Cek Status Pengajuan Surat

1. Di bagian **Layanan Surat**, klik judul **“Cek Status Pengajuan”** untuk membuka panelnya.
2. Pilih salah satu cara:
   - **NIK + No. HP / WhatsApp** — masukkan data yang **sama persis** dengan yang dipakai saat mengajukan. Nomor HP boleh ditulis dengan awalan `0` maupun `62`, boleh berspasi atau bertanda hubung — sistem menormalkannya otomatis (mis. `0812-3456-7890` = `6281234567890`).
   - **No. Pengajuan** — masukkan nomor yang tampil setelah pengajuan terkirim (contoh `SRT-261006-AB12`). Nomor ini adalah kunci akses, jadi simpan dengan baik.
3. Klik **Cek Status**.

Hasilnya menampilkan status terbaru dan catatan pengurus:

| Status | Artinya |
|---|---|
| **Pending** | Pengajuan sudah masuk, belum diproses pengurus. |
| **Diproses** | Sedang diverifikasi/dibuat oleh pengurus. |
| **Selesai** | Surat sudah jadi. **No. Surat** resmi ditampilkan (disorot kuning) — catat lalu ambil surat ke pengurus RT. |
| **Ditolak** | Pengajuan tidak dapat diproses; baca **catatan pengurus** untuk alasannya (mis. data belum lengkap). |

Pengajuan yang sudah ditandai arsip oleh pengurus **tetap bisa** Anda periksa lewat menu ini.

## Tema, Muat Ulang, dan Mode Offline

- **Tema terang/gelap:** tombol 🌙/☀️ di header untuk berganti tampilan. Pilihan Anda tersimpan sendiri dan tetap dipakai saat portal dibuka lagi.
- **Muat Ulang:** tombol di header untuk mengambil data terbaru. Berkedip bila ada versi baru — tidak memaksa, jadi tidak akan menghapus isian form Anda.
- **Mode offline:** bila ponsel tidak ada internet, muncul banner merah **“Anda sedang offline. Data mungkin belum terbaru.”** Sambungkan kembali ke internet lalu muat ulang.
- **Tentang Aplikasi:** tombol ⓘ di header berisi penjelasan singkat aplikasi.

## Nomor Siaga Darurat

Tombol merah 📞 di header membuka daftar **Nomor Siaga Darurat Utama**. Ketuk nomor untuk langsung menelepon:

| Nomor | Layanan |
|---|---|
| **112** | Panggilan darurat terintegrasi (bebas pulsa) |
| **110** | Kepolisian (Polri) |
| **113** | Pemadam Kebakaran |
| **118 / 119** | Ambulans dan darurat medis |
| **115** | Basarnas / SAR |
| **117** | Badan Nasional Penanggulangan Bencana (BNPB) |
| **129** | Posko Bencana Alam |
| **123** | PLN — gangguan listrik |

Daftar ini tersimpan di dalam aplikasi sehingga **tetap bisa dibuka meski koneksi bermasalah**. Saat keadaan darurat: tetap tenang dan sebutkan **lokasi dengan jelas** (nama jalan, nomor rumah, patokan).

## Pasang Aplikasi di HP

Portal bisa dipasang seperti aplikasi biasa (tidak perlu Play Store/App Store):

- **Android (Chrome/Edge):** buka portal → ketuk tombol **Install** di header (atau menu ⋮ → **Tambahkan ke layar Utama / Instal aplikasi**) → konfirmasi.
- **iPhone/iPad (Safari):** buka portal → tombol **Bagikan** → **Tambahkan ke Layar Utama** → **Tambah**.
- **Komputer (Chrome/Edge):** buka portal → klik ikon **Install** di address bar atau tombol **Install** di header.

Setelah dipasang, aplikasi terbuka **layar penuh** dari ikon di layar utama. Bila tombol Install tidak muncul, klik **Install** di header untuk membuka panduan bergambar — kartu perangkat Anda ditandai badge **“Perangkat ini”**. Langkah yang sama berlaku untuk dashboard pengurus.

## Pertanyaan yang Sering Ditanyakan Warga

**NIK saya dibilang tidak terdaftar. Bagaimana?**
Tetap lanjutkan pengisian secara manual dan kirim pengajuan; beri tahu pengurus agar data warga Anda dilengkapi. Nama & alamat yang terisi otomatis akan aktif setelah NIK Anda terdaftar.

**Pengajuan saya tidak muncul saat cek status.**
Pastikan **NIK dan No. HP sama persis** dengan saat mengajukan, atau gunakan **No. Pengajuan** yang Anda simpan. Bila nomor HP Anda sempat berubah, hubungi pengurus (hanya pengurus yang dapat memperbaiki data pengajuan).

**Muncul pesan batas pengajuan.**
Maksimal **5 pengajuan per NIK per jam**. Tunggu sekitar satu jam, atau hubungi pengurus bila memang mendesak.

**Sudah lama, kok statusnya “Pending” terus?**
Hubungi pengurus RT melalui WhatsApp. Anda juga bisa memeriksa ulang status lain kali; catatan pengurus akan muncul di hasil cek status.

**Apakah data saya aman?**
Ya. Portal publik **tidak pernah** menampilkan daftar data warga maupun kas RT. Data warga hanya diambil **satu per satu** saat Anda memasukkan NIK pada form pengajuan — itu pun hanya nama, alamat, dan nomor HP tersamar. Hasil **Cek Status** hanya menampilkan pengajuan yang cocok dengan NIK & No. HP, atau No. Pengajuan, yang Anda masukkan. Pemakaian pencarian dibatasi per jam, dan No. Pengajuan tidak mudah ditebak.

**Portal bilang dinonaktifkan.**
Pengurus sedang mematikan akses portal (mis. saat pembaruan data). Coba lagi nanti atau hubungi pengurus.

**Mau mengurus surat tapi tidak bisa mengisi sendiri.**
Minta pengurus mencatatnya lewat menu **Isi Manual** di dashboard — hasilnya tetap masuk daftar pengajuan dengan nomor yang sama dan bisa Anda cek statusnya.

---

# Bagian 3: Setup Awal dan Pemeliharaan

Bagian ini untuk pengurus RT yang memegang **akses teknis**: menyiapkan sistem, mempublikasikan, menambah pengurus lain, dan memperbaiki masalah. Kerjakan **sekali** pada awal, lalu hanya sesekali saat ada pembaruan.

## Yang Perlu Disiapkan

| Kebutuhan | Untuk apa | Biaya |
|---|---|---|
| Akun **Google** | Google Sheets sebagai database + Google Apps Script sebagai backend | Gratis |
| Akun **Cloudflare** | Hosting (Cloudflare Pages) + kunci login admin (Zero Trust/Access) | Gratis |
| Akun **GitHub** | Menyimpan source code dan memicu deploy otomatis ke Cloudflare Pages | Gratis |
| **1 akun Google khusus RT** | Disarankan: semua berkas milik RT, tidak bergantung pada akun pribadi | Gratis |

> **Penting:** backend dijalankan *“Execute as: Me”* — yaitu **akun Google yang memilikinya**. Gunakan akun RT yang akan bertahan lama, karena alamat pengirim email notifikasi dan kuota pengiriman mengikuti akun tersebut.

## Siapkan Google Sheets

1. Buat file baru di **Google Sheets** dan beri nama, mis. `SAPA RT 017 - Database`.
2. Buat 5 tab dengan nama **persis** seperti ini:
   - `Data_Warga`
   - `Iuran_Kas`
   - `Pengumuman`
   - `Kegiatan_Warga`
   - `Pengajuan_Surat` (dibuat otomatis saat pertama dipakai bila belum ada)
3. **Header boleh ditempel manual atau dibiarkan** — backend membuat/memperbaiki tab dan judul kolom secara otomatis, termasuk kolom bantu `ID`, kolom `Publik`, kolom `Diarsipkan`, dan kolom `Reversal Dari`.

Judul kolom yang dipakai:

| Tab | Kolom |
|---|---|
| `Data_Warga` | Timestamp · Nomor KK · Nama Lengkap · Status · Jenis Kelamin · NIK · Tempat Lahir · Tanggal Lahir · Pendidikan · Pekerjaan · No HP · Status Tempat Tinggal · Alamat/No Rumah · Diarsipkan · ID |
| `Iuran_Kas` | Timestamp · Tanggal · Nama Warga · No Rumah · Jenis Transaksi · Jumlah (Rp) · Keterangan · Diarsipkan · Reversal Dari · ID |
| `Pengumuman` | Timestamp · Tanggal · Judul Pengumuman · Isi Pengumuman · Kategori · Penanggung Jawab · Publik · ID |
| `Kegiatan_Warga` | Timestamp · Nama Kegiatan · Tanggal Pelaksanaan · Waktu · Lokasi · Penanggung Jawab · Keterangan · Publik · ID |
| `Pengajuan_Surat` | Dibuat otomatis oleh backend (Tanggal, No. Pengajuan, NIK, Nama, No. HP, Alamat, Jenis Surat, Keperluan, Status, No. Surat, Catatan, **Tanggal Selesai**, Diarsipkan, dll.) |
| `Lapor_Aspirasi` | Dibuat otomatis oleh backend (No. Pengaduan, Nama, No. HP, Alamat, Jenis Pengaduan, Judul, Detail, Lokasi, Tanggal Kejadian, Foto, Harapan, Status, Petugas, Catatan Tindak Lanjut, Tanggal Penyelesaian, Diarsipkan, dll.) |

> **Kolom `Publik`** mengatur apakah data tampil di portal warga (`Ya`/`Tidak`). **Kolom `Diarsipkan`** mengatur data yang disembunyikan tanpa dihapus (`Ya`/`Tidak`); pada `Iuran_Kas` kolom ini hanya dipertahankan untuk **data lama** (tidak ada lagi tombol arsip — pembatalan memakai Reversal). **Kolom `Reversal Dari`** menyimpan ID transaksi asal untuk entri pembatalan otomatis (pasangan Reversal) di `Iuran_Kas`.

## Pasang Apps Script dan Deploy Web App

1. Dari Google Sheets: menu **Ekstensi → Apps Script**.
2. Hapus isi editor, lalu **tempelkan seluruh isi** berkas [`Apps Script/code.gs`](Apps%20Script/code.gs).
3. Simpan (Ctrl/Cmd + S).
4. Klik **Deploy → New deployment**.
   - Type: **Web app**
   - Description: mis. `SAPA RT 017 produksi`
   - **Execute as: Me (email Anda)**
   - **Who has access: Anyone**
5. Klik **Deploy**, lalu **salin Web App URL** (berakhiran `/exec`) dan simpan — URL ini dipakai di dua tempat (lihat langkah berikutnya).
6. **Setiap kali `code.gs` diubah**, wajib deploy ulang: **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**. Tanpa ini, web app masih menjalankan kode lama.

## Script Properties

Buka **Project Settings → Script Properties** di Apps Script dan tambahkan:

| Properti | Wajib | Isi |
|---|---|---|
| `ADMIN_TOKEN` | ✅ | Kata sandi rahasia RT (mis. `rt017-rahasia-2026`). Dipakai aplikasi untuk semua operasi tulis. **Jangan ditulis di dalam kode.** |
| `ADMIN_EMAIL` | Opsional | Alamat email penerima notifikasi pengajuan surat **dan** pengaduan Lapor & Aspirasi baru. |
| `NOTIF_SENDER_NAME` | Opsional | Nama pengirim yang tampil di kotak masuk (default `Pengajuan surat`). |
| `NOTIF_REPLY_TO` | Opsional | Alamat balasan (default `ADMIN_EMAIL`). |
| `NOTIF_SUBJECT_PREFIX` | Opsional | Prefiks subjek email (default `[SAPA-RT]`). |
| `LAPOR_FOLDER_ID` | Opsional | ID folder Google Drive untuk menyimpan foto pengaduan. Bila kosong, backend mencari/membuat folder bernama `Lapor`. |
| `SURAT_ENABLED` | Opsional | `true`/`false` untuk menyalakan/mematikan fitur **Layanan Surat** (default **aktif** bila tidak diisi). Biasanya diubah dari toggle **Layanan Surat** di panel Portal Publik (aksi `setSuratStatus`). |
| `LAPOR_ENABLED` | Opsional | `true`/`false` untuk menyalakan/mematikan fitur **Lapor & Aspirasi** (default **aktif** bila tidak diisi). Nilai ini biasanya diubah dari tombol **ON/OFF** di panel Portal Publik, tidak perlu diedit manual. |

Bila baru mengaktifkan email, jalankan izin sekali: pilih fungsi **`authorizeMail`** pada dropdown editor Apps Script → **Run** → **Review permissions** → **Allow** → lalu deploy **New version**.

Untuk fitur **Lapor & Aspirasi** dengan lampiran foto, jalankan sekali fungsi **`authorizeDrive`** (dropdown editor → **Run** → **Review permissions** → **Allow**) agar izin Google Drive diberikan; fungsi ini sekaligus membuat folder **`Lapor`** di Drive dan membagikannya ke `ADMIN_EMAIL`. Tanpa langkah ini, foto lampiran tidak tersimpan (pengaduan tetap masuk tanpa foto). Setelah itu deploy ulang sebagai **New version**.

> Kuota email mengikuti akun Google pemilik: Gmail pribadi ±100 penerima/hari, Google Workspace ±1.500/hari. Email dikirim **atas nama akun pemilik skrip**, bukan atas nama warga.

## Tautkan Aplikasi ke Backend

Semua pengaturan tampilan dan alamat backend ada di satu berkas: **`config.js`**.

```js
window.RT_CONFIG = {
    version: '9',                 // naikkan setiap kali config.js diubah
    appVersion: 'v1.0.0',         // label versi rilis di footer (opsional)
    rt: '017', rw: '06',
    kelurahan: 'Tanjung Duren Utara',
    kecamatan: 'Grogol Petamburan',
    kota: 'Jakarta Barat',
    provinsi: 'DKI Jakarta',
    alamatrt: 'Lontar Barat',

    publicApiUrl: 'https://script.google.com/macros/s/xxxx/exec', // Web App URL
    apiBase: '/api',                                              // proxy same-origin
    publicPortalUrl: 'https://sapa-rt017.pages.dev/public',       // tautan untuk warga

    jenisSurat: [ /* daftar jenis surat */ ],
    statusSurat: ['Pending', 'Diproses', 'Selesai', 'Ditolak']
};
```

Yang perlu Anda perhatikan:

- **`publicApiUrl`** — tempel **Web App URL** dari langkah deploy.
- **`apiBase`** — biarkan `'/api'` bila memakai Cloudflare Pages (disarankan). Aplikasi memakai proxy ini lebih dulu agar tidak diblokir kebijakan privasi browser; bila proxy tidak tersedia, aplikasi otomatis beralih ke `publicApiUrl`.
- **`publicPortalUrl`** — tautan portal yang dibagikan ke warga (muncul di tombol **Buka Portal**).
- **`jenisSurat`** — sesuaikan pilihan surat dengan kebutuhan RT.
- **`version`** — **wajib dinaikkan** setiap kali `config.js` diubah (lihat [Checklist](#checklist-setiap-perubahan)).
- Ingin **mode demo tanpa server**? Kosongkan `publicApiUrl` dan `apiBase` — aplikasi berjalan di browser saja.

Setelah mengubah `config.js`, isi **Token Admin** di dashboard: menu **Setting → Integrasi Google Sheets** → kolom Admin Token → **Save Token**. Nilainya harus **sama** dengan `ADMIN_TOKEN` di Script Properties.

## Publikasikan ke Cloudflare Pages

1. Masukkan repository ini ke akun GitHub Anda (bila belum).
2. Buka dashboard Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, pilih repository ini.
3. Biarkan pengaturan build default (situs statis, tanpa perintah build). Setiap `git push` akan otomatis memublikasikan ulang.
4. (Disarankan) Di **Settings → Environment variables**, tambahkan **`APPS_SCRIPT_URL`** berisi Web App URL (`.../exec`) agar proxy `/api` menuju backend RT Anda.
5. Buka alamat `*.pages.dev` yang diberikan:
   - `/` → dashboard admin
   - `/public` → portal publik warga
   - `/api` → proxy ke Apps Script (dipakai kedua halaman)

Berkas `_headers` sudah mengatur masa cache: ikon boleh di-cache lama, sedangkan `config.js`, `version.json`, dan `sw.js` selalu divalidasi ulang agar penanda “Versi Baru” akurat.

## Kunci Halaman Admin dengan Cloudflare Access

Portal warga harus terbuka, tetapi dashboard admin harus terkunci. Caranya memakai **Cloudflare Zero Trust**.

1. Buka `one.dash.cloudflare.com` dan buat *team name* bila belum ada.
2. **Integrations → Identity providers → Add new identity provider → One-time PIN** (login lewat kode yang dikirim ke email, tanpa setup tambahan). Tambahkan juga **Google** bila ingin login sekali klik.
   > Organisasi Zero Trust baru kadang hanya punya provider **Cloudflare**, sehingga halaman login tidak menampilkan kolom email. Bila itu terjadi, tambahkan **One-time PIN** seperti di atas.
3. **Access controls → Applications → Add an application → Self-hosted**, buat **dua** aplikasi:

   **a. `RT Admin`** — melindungi dashboard
   - Hostname: `sapa-rt017.pages.dev` — Path `/`
   - Tambah hostname kedua: Path `/index.html`
   - Policy: **Allow**, Include → **Emails** → daftar email pengurus. Session duration mis. `24 hours`.

   **b. `RT Public Assets`** — membebaskan berkas publik
   - Hostname & Path: `/public`, `/public.html`, `/api`, `/config.js`, `/version.json`, `/rt-icon.png`, `/icon-192.png`, `/favicon.ico`, `/apple-touch-icon.png`, `/tailwind.css`, `/fonts.css`, `/fonts/*`, `/manifest-public.webmanifest`, `/sw.js`, `/qr-public.png`
   - Policy: **Bypass**, Include → **Everyone**.

4. Simpan. Perubahan berlaku seketika tanpa perlu deploy ulang.

> **Jangan** bypass path `/` atau `/index.html` — itu pintu admin Anda. Dan **jangan lupa** bypass **`/public`** (tanpa `.html`), karena Cloudflare Pages mengalihkan `/public.html` → `/public`; bila terlewat, warga akan diminta login.
>
> **Ikon tidak muncul di perangkat baru?** Pastikan **`/fonts.css`** dan **`/fonts/*`** juga di-bypass. Tanpa keduanya, halaman publik tetap terbuka tetapi font ikon self-hosted ikut dialihkan ke halaman login Access, sehingga semua ikon kosong.
>
> **Keamanan berlapis:** halaman admin dijaga Cloudflare Access, sedangkan datanya dijaga `ADMIN_TOKEN`. Data warga/kas tidak pernah dikirim ke portal publik.

## Menambah Pengurus dan Mencabut Akses

**Menambah pengurus:**

1. Zero Trust → **Access controls → Applications → `RT Admin` → Edit** (bagian *Policies*).
2. Buka policy → **Include → Add a rule** → **Emails** → tulis email pengurus (beberapa email dipisah koma).
3. **Save**. Pengurus membuka alamat admin di jendela *incognito* → masukkan email → **Send login code** → masukkan PIN dari email.

**Masa berlaku sesi:** login bersifat *sesi*, bukan sekali pakai. Selama *Session Duration* (mis. 24 jam) belum habis, pengurus tidak diminta PIN lagi. Atur di **Applications → `RT Admin` → Edit → Details → Session Duration**.

**Mencabut akses:**

1. Hapus email dari policy → **Save** (login baru langsung diblokir; sesi yang masih berjalan tetap aktif sampai kedaluwarsa).
2. Untuk memblokir seketika: **Access controls → Active sessions** → cari sesi pengurus tersebut → **Revoke**.

**Mengganti token admin:** ubah `ADMIN_TOKEN` di Script Properties, lalu minta semua pengurus memperbarui **Token Admin** di dashboard. Cara cepat memaksa semua orang keluar: ganti token sekaligus cabut sesi Access.

## Checklist Setiap Perubahan

Naikkan penanda versi yang sesuai **sebelum** push, agar pengguna yang masih membuka halaman lama otomatis diberi tombol **“Muat Ulang”**:

| Yang diubah | Yang wajib dinaikkan | Berkas |
|---|---|---|
| `config.js` (identitas RT, `jenisSurat`, `publicApiUrl`, dll.) | `RT_CONFIG.version` **dan** `EXPECTED_CONFIG_VERSION` | `config.js`, `index.html`, `public.html` |
| Rilis penting (label versi) | `RT_CONFIG.appVersion` (opsional) | `config.js` |
| `index.html` / `public.html` | `APP_BUILD` **dan** kunci terkait (`index`/`public`) | HTML yang diubah + `version.json` |
| `code.gs` (backend) | `CODE_VERSION` **dan** `EXPECTED_BACKEND_VERSION`, lalu **redeploy New version** | `Apps Script/code.gs`, `index.html` |
| Kelas Tailwind baru | build ulang `tailwind.css` | lihat perintah di `readme.md` |

Perintah build ulang CSS (bila tampilan diubah):

```bash
npx tailwindcss@3 -c tailwind.config.js -i tailwind.input.css -o tailwind.css --minify
```

## Backup dan Pemulihan Data

Data RT ada sepenuhnya di Google Sheets, sehingga pencadangan sangat mudah:

**Backup otomatis (sudah ada):**

- Google Sheets menyimpan **riwayat versi**. Buka **File → Version history → See version history** untuk melihat/mengembalikan kondisi sebelumnya.
- Penghapusan data di aplikasi umumnya bersifat **arsip** atau **pembatalan (Reversal)**, bukan hapus permanen — jadi kesalahan bisa dipulihkan sendiri lewat tombol **Pulihkan**.

**Backup manual (disarankan tiap bulan):**

1. Buka Google Sheets → **File → Make a copy** → beri nama mis. `Backup SAPA RT 017 - Okt 2026`.
2. Simpan salinan di folder Google Drive RT, bukan di Drive pribadi.
3. Bila ingin format berkas: **File → Download → Microsoft Excel (.xlsx)** atau CSV per tab.

**Restore:**

- Untuk mengembalikan beberapa baris yang salah: ambil dari hasil *Make a copy* lalu tempel kembali ke tab yang sesuai. Jangan mengubah nama tab/kolom.
- Untuk mengembalikan seluruh berkas: buka salinan → klik **Load Data from Sheets** di dashboard untuk memastikan data terbaca.

> **Jangan pernah** menghapus/mengganti nama tab atau memindahkan kolom `ID` — kolom itu kunci edit/hapus yang aman.

## Mode Demo dan Pratinjau Lokal

**Demo tanpa menyentuh data asli (di browser pengurus):** kosongkan `publicApiUrl` dan `apiBase` di `config.js`, lalu semua yang diketik hanya tersimpan di browser tersebut. Setelah demo, klik **Reset Demo Data (Local)** di Setting. Data di Google Sheets tidak pernah terhapus oleh tombol ini.

**Pratinjau lokal penuh (di komputer, memakai backend tiruan):**

```bash
node tools/mock-server.js          # buka http://localhost:8000
PORT=8080 node tools/mock-server.js  # ganti port
node tools/mock-server.js --reset    # tulis ulang data contoh
```

Server ini menyajikan halaman admin & portal publik sekaligus meniru seluruh endpoint Apps Script, jadi pengurus bisa berlatih **tambah/edit/hapus** tanpa risiko. Semua perubahan hanya tersimpan di `tools/mock-data.json` (tidak ikut di-commit).

## Troubleshooting

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Muncul pesan **“Token admin belum diatur/tidak valid”** saat menyimpan | Token di browser berbeda dengan `ADMIN_TOKEN` | Setting → Integrasi Google Sheets → isi **Admin Token** yang benar → **Save Token** |
| Notifikasi **“Gagal memuat data dari Google Sheets”** | Koneksi internet bermasalah, proxy `/api` tidak aktif, atau `publicApiUrl` salah | Cek indikator koneksi; klik **Test Connection**; pastikan `publicApiUrl` berakhir `/exec`; lihat **Transport** di Setting |
| Status koneksi **Local Only** | `publicApiUrl` dan `apiBase` kosong di `config.js`, atau config gagal dimuat | Pastikan `config.js` terunggah dan `publicApiUrl`/`apiBase` terisi |
| Perubahan tidak tersimpan / hilang setelah reload | Token salah, atau aplikasi sedang mode Local Only | Betulkan token; cek **Transport** & **Backend version** di Setting |
| Tabel berstatus **Offline** | Perangkat kehilangan internet | Sambungkan kembali; data akan disinkronkan otomatis (muncul notifikasi “Kembali online”) |
| Tombol **“Versi Baru”** tidak pernah muncul padahal sudah deploy | `APP_BUILD`/`version.json` (atau `RT_CONFIG.version`) tidak dinaikkan | Ikuti [Checklist](#checklist-setiap-perubahan), lalu **hard refresh** sekali |
| Backend masih perilaku lama setelah `code.gs` diubah | Belum redeploy versi baru | **Manage deployments → Edit → New version → Deploy**; cek di Setting → **Check Backend Version** |
| Email notifikasi tidak terkirim | Izin email belum diberikan, `ADMIN_EMAIL` kosong, atau deployment belum versi baru | Jalankan fungsi **`authorizeMail`** → **Allow** → deploy **New version** → klik **Test Email Admin** |
| Pesan **`mail_scope_denied`** | Izin `send_mail` belum diberikan pada akun pemilik | Sama seperti di atas (harus akun pemilik/pendeploy yang menekan **Allow**) |
| **Portal warga meminta login Cloudflare** | Path `/public` belum masuk daftar *bypass* | Tambahkan `/public` (dan `/public.html`) pada aplikasi `RT Public Assets` |
| Portal menampilkan **“Portal publik dinonaktifkan”** | Toggle Portal Publik sedang OFF | Menu **Portal Publik** → nyalakan kembali |
| Pengumuman/kegiatan tidak muncul di portal | Belum ditandai **Publik**, atau portal OFF | Klik ikon 👁️ pada kartu (atau centang “Tampilkan di Portal Publik” saat menyunting) |
| Warga tidak menemukan pengajuannya di **Cek Status** | NIK/No. HP berbeda saat mengajukan | Pengurus membuka **Edit** pengajuan; NIK & No. HP memang terkunci. Bila perlu perbaikan, catat pengajuan baru/Isi Manual dengan data yang benar |
| Status **Selesai** tidak bisa disimpan | **No. Surat** belum diisi | Isi No. Surat pada modal (server menolak `Selesai` tanpa nomor surat) |
| Warga kena batas pengajuan | Batas aman 5 pengajuan per NIK per jam (global 60/jam) | Tunggu satu jam, atau catat manual lewat **Isi Manual** bila mendesak |
| Foto lampiran laporan **tidak muncul di Drive** | Izin Google Drive belum diberikan, atau folder `Lapor` belum ada | Jalankan fungsi **`authorizeDrive`** di editor Apps Script → **Allow** → deploy **New version**. Folder `Lapor` dibuat otomatis (dan dibagikan ke `ADMIN_EMAIL`). Bisa juga set Script Property `LAPOR_FOLDER_ID` ke folder yang sudah ada |
| Data tetap ada padahal sudah “dihapus” | Data warga & pengajuan memang **diarsipkan**, bukan dihapus | Centang **Tampilkan arsip**, lalu gunakan **Pulihkan** bila salah arsip |
| Dashboard lambat / data lama | Cache browser | Klik tombol 🔄 **Muat Ulang** (hard refresh) |
| Nomor HP muncul aneh di tabel | Itu format tampilan 3-3-4 | Normal — nilai tersimpan tetap digit asli |

**Saat meminta bantuan:** arahkan kursor ke teks versi di footer — muncul tooltip berisi `Build <APP_BUILD> · config v<version> · backend <CODE_VERSION>`. Sebutkan tiga angka itu beserta screenshot pesan kesalahan; ini mempercepat diagnosis.

## Keamanan dan Privasi Data

- **Berlapis dua:** Cloudflare Access melindungi halaman admin; `ADMIN_TOKEN` melindungi operasi data di backend. Keduanya harus dijaga.
- **Portal publik hanya membaca** Pengumuman & Kegiatan yang ditandai `Publik=Ya`. Data warga, kas, dan pengajuan surat **tidak pernah** dikirim ke portal.
- Warga **tidak bisa** mengubah/menghapus apa pun — form publik hanya bisa menambah pengajuan, statusnya dipaksa `Pending`, dan dilindungi *honeypot* anti-bot serta batas laju.
- NIK pada tabel admin & pengajuan **disamarkan**, nomor HP di form warga **tersamar**, dan pencarian data warga hanya membuka **satu** warga sesuai NIK yang diketik (dibatasi 20 pencarian/NIK/jam).
- **Jangan** menulis token, PIN, atau tautan admin di grup WhatsApp/papan pengumuman. Bagikan hanya pengumuman, agenda, dan tautan **portal publik**.
- **Jangan** menaruh data pribadi berlebihan di kolom bebas (Catatan/Keterangan) bila tidak diperlukan — data itu tersimpan jangka panjang di Sheets.
- Bila perangkat pengurus dipakai bersama, **selalu klik keluar** dari akun Cloudflare (atau pakai jendela *incognito*), dan jangan centang “simpan kata sandi” pada perangkat umum.
- Bila ada pengurus yang sudah tidak bertugas: cabut emailnya dari policy `RT Admin` **dan** **Revoke** sesi aktifnya.

---

# Lampiran

## A. Istilah

| Istilah | Arti |
|---|---|
| **SAPA RT** | Nama aplikasi: Sistem Administrasi & Pelayanan Antarwarga. |
| **Dashboard admin** | Halaman pengurus (`/`), butuh login. |
| **Portal publik** | Halaman warga (`/public`), tanpa login. |
| **Apps Script** | Layanan Google yang menjadi “mesin” aplikasi dan menyimpan data ke Google Sheets. |
| **Web App URL** | Alamat backend (`.../exec`) yang ditulis di `publicApiUrl`. |
| **`ADMIN_TOKEN`** | Kata sandi rahasia untuk operasi tulis/edit/hapus. |
| **Cloudflare Access** | Sistem login email + PIN untuk membuka dashboard admin. |
| **No. Pengajuan** | Kode bukti pengajuan warga, mis. `SRT-261006-AB12`. |
| **No. Surat** | Nomor surat resmi RT (mis. `474/017-RT/RW.06/X/2026`), diisi saat status `Selesai`. |
| **No. Pengaduan** | Kode bukti lapor/aspirasi warga, mis. `ADU/2026-001`. |
| **Arsip** | Menyembunyikan data dari daftar tanpa menghapusnya. |
| **Reversal** | Entri pembatalan otomatis dengan nominal sama dan arah berlawanan; pasangan transaksi asli + Reversal berjumlah nol. |
| **PWA** | Cara memasang aplikasi ke layar utama HP/komputer. |

## B. Berkas Terkait dalam Repository

| Berkas | Isi |
|---|---|
| `config.js` | Identitas RT, alamat backend, daftar jenis surat & status. |
| `index.html` | Dashboard admin. |
| `public.html` | Portal publik warga. |
| `Apps Script/code.gs` | Kode backend (tempel ke Apps Script). |
| `Apps Script/readme.md` | Dokumentasi backend, endpoint API, dan troubleshooting teknis. |
| `functions/api/[[path]].js` | Proxy same-origin `/api` (Cloudflare Pages Function). |
| `readme.md` | Gambaran fitur, struktur database, publikasi, dan kontrol akses. |
| `agents.md` | Arsitektur dan kontrak data untuk pengembang. |
| `tools/mock-server.js` | Server pratinjau lokal untuk pelatihan tanpa menyentuh data asli. |
| `panduan.md` | **Dokumen ini.** |

## C. Membagikan Dokumen Ini

- **Untuk warga:** cukup bagikan tautan portal (`.../public`) dan [Bagian 2](#bagian-2-panduan-warga) dokumen ini. Bila ingin versi cetak, buka dokumen ini di GitHub → menu **Raw**/**Print** atau salin ke Google Docs lalu cetak.
- **Untuk pengurus baru:** berikan dokumen ini secara utuh plus **token admin** dan tautan dashboard melalui jalur yang aman (bukan grup terbuka). Arahkan mereka memulai dari [Bagian 1](#bagian-1-panduan-pengurus-rt).

---

*Dokumen ini disusun untuk RT 017 / RW 06, Kelurahan Tanjung Duren Utara, Kecamatan Grogol Petamburan, Jakarta Barat. Sesuaikan contoh nama, alamat, dan domain bila RT Anda berbeda.*
