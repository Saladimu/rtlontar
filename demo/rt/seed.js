/* Dibuat otomatis oleh tools/build-demo.js - data contoh mode lokal.
   Hanya mengisi sekali; perubahan pengguna tidak ditimpa saat muat ulang. */
(function () {
    var SEED_VERSION = "demo-2026-11-06";
    var seed = {
    "warga": [
        {
            "_id": "DW-018-2",
            "timestamp": "2026-10-01 10:00",
            "nomorKK": "3173010101010001",
            "nama": "Siti Aminah",
            "status": "Istri",
            "jenisKelamin": "P",
            "nik": "3173010101010002",
            "tempat": "Jakarta",
            "tanggalLahir": "1991-02-02",
            "pendidikan": "S1",
            "pekerjaan": "Guru",
            "hp": "081298765432",
            "statusTinggal": "Milik",
            "alamat": "Jl. Mawar 1",
            "arsip": "Tidak"
        },
        {
            "_id": "DW-018-1",
            "timestamp": "2026-10-01 10:00",
            "nomorKK": "3173010101010001",
            "nama": "Budi Santoso",
            "status": "Kepala Keluarga",
            "jenisKelamin": "L",
            "nik": "3173010101010001",
            "tempat": "Jakarta",
            "tanggalLahir": "1990-01-01",
            "pendidikan": "SMA",
            "pekerjaan": "Karyawan",
            "hp": "081234567890",
            "statusTinggal": "Milik",
            "alamat": "Jl. Mawar 1",
            "arsip": "Tidak"
        },
        {
            "_id": "DW-018-3",
            "timestamp": "2026-10-02 10:00",
            "nomorKK": "3173010101010003",
            "nama": "Agus Salim",
            "status": "Kepala Keluarga",
            "jenisKelamin": "L",
            "nik": "3173010101010003",
            "tempat": "Bekasi",
            "tanggalLahir": "1996-05-12",
            "pendidikan": "SMA",
            "pekerjaan": "Teknisi",
            "hp": "081377788899",
            "statusTinggal": "Kontrak",
            "alamat": "Jl. Mawar 3",
            "arsip": "Ya"
        }
    ],
    "kas": [
        {
            "_id": "K-018-1",
            "timestamp": "2026-10-01 10:00",
            "tanggal": "2026-10-01",
            "nama": "Budi Santoso",
            "noRumah": "1",
            "jenis": "Pemasukan",
            "jumlah": 100000,
            "keterangan": "Iuran Oktober",
            "arsip": "Tidak",
            "reversalDari": ""
        },
        {
            "_id": "K-018-2",
            "timestamp": "2026-10-02 10:00",
            "tanggal": "2026-10-02",
            "nama": "Siti Aminah",
            "noRumah": "2",
            "jenis": "Pemasukan",
            "jumlah": 100000,
            "keterangan": "Iuran Oktober",
            "arsip": "Tidak",
            "reversalDari": ""
        },
        {
            "_id": "K-018-3",
            "timestamp": "2026-10-05 10:00",
            "tanggal": "2026-10-05",
            "nama": "Pengurus",
            "noRumah": "-",
            "jenis": "Pengeluaran",
            "jumlah": 45000,
            "keterangan": "Lampu jalan",
            "arsip": "Tidak",
            "reversalDari": ""
        },
        {
            "_id": "K-018-4",
            "timestamp": "2026-10-06 10:00",
            "tanggal": "2026-10-06",
            "nama": "Pengurus",
            "noRumah": "-",
            "jenis": "Reversal Keluar",
            "jumlah": 20000,
            "keterangan": "Pembatalan iuran",
            "arsip": "Tidak",
            "reversalDari": "K-018-2"
        }
    ],
    "pengumuman": [
        {
            "_id": "PEN-018-1",
            "timestamp": "2026-11-01T02:00:00.000Z",
            "tanggal": "2026-11-01",
            "judul": "Kerja Bakti Bulan November",
            "isi": "Kerja bakti membersihkan saluran air akan dilaksanakan Minggu pagi. Mohon membawa peralatan kebersihan.",
            "kategori": "Kegiatan",
            "pj": "Ketua RT 018",
            "publik": "Ya"
        },
        {
            "_id": "PEN-018-2",
            "timestamp": "2026-11-02T02:00:00.000Z",
            "tanggal": "2026-11-02",
            "judul": "Pembayaran Iuran Kas",
            "isi": "Iuran kas bulan November dapat dibayarkan kepada Bendahara RT paling lambat tanggal 25.",
            "kategori": "Keuangan",
            "pj": "Bendahara RT 018",
            "publik": "Ya"
        }
    ],
    "kegiatan": [
        {
            "_id": "KEG-018-1",
            "timestamp": "2026-11-02T02:00:00.000Z",
            "namaKegiatan": "Kerja Bakti Lingkungan",
            "tanggal": "2026-11-09",
            "waktu": "07:00",
            "lokasi": "Depan Pos Ronda",
            "pj": "Ketua RT 018",
            "keterangan": "Membawa cangkul dan sapu lidi",
            "publik": "Ya"
        },
        {
            "_id": "KEG-018-2",
            "timestamp": "2026-11-02T02:00:00.000Z",
            "namaKegiatan": "Posyandu Balita",
            "tanggal": "2026-11-15",
            "waktu": "08:00",
            "lokasi": "Balai Warga",
            "pj": "Kader Posyandu",
            "keterangan": "Pemeriksaan rutin bulanan",
            "publik": "Ya"
        }
    ],
    "surat": [
        {
            "_id": "SRT-018-1",
            "waktu": "2026-10-20 09:00",
            "nama": "Budi Santoso",
            "nik": "3173010101010001",
            "noHp": "081234567890",
            "alamat": "Jl. Mawar 1",
            "jenisSurat": "Surat Domisili",
            "keperluan": "Persyaratan sekolah anak",
            "status": "Pending",
            "noSurat": "",
            "catatan": "",
            "tanggalSelesai": "",
            "arsip": "Tidak",
            "rwStatus": "Menunggu",
            "rwCatatan": "",
            "rwOleh": "",
            "rwTanggal": "",
            "rwRevisi": 0,
            "rwVersi": 1
        },
        {
            "_id": "SRT-018-2",
            "waktu": "2026-10-18 09:00",
            "nama": "Siti Aminah",
            "nik": "3173010101010002",
            "noHp": "081298765432",
            "alamat": "Jl. Mawar 2",
            "jenisSurat": "Surat Usaha",
            "keperluan": "Pengajuan kredit usaha",
            "status": "Selesai",
            "noSurat": "474/018/2026",
            "catatan": "Disetujui RW",
            "tanggalSelesai": "2026-10-19",
            "arsip": "Tidak",
            "rwStatus": "Disetujui",
            "rwCatatan": "Usaha sudah berjalan.",
            "rwOleh": "Bootstrap Admin",
            "rwTanggal": "2026-10-19 08:00",
            "rwRevisi": 0,
            "rwVersi": 2
        },
        {
            "_id": "SRT-018-3",
            "waktu": "2026-10-15 09:00",
            "nama": "Agus Salim",
            "nik": "3173010101010003",
            "noHp": "081377788899",
            "alamat": "Jl. Mawar 3",
            "jenisSurat": "Surat Keterangan Tidak Mampu",
            "keperluan": "Bantuan pendidikan",
            "status": "Pending",
            "noSurat": "",
            "catatan": "",
            "tanggalSelesai": "",
            "arsip": "Tidak",
            "rwStatus": "Dikembalikan",
            "rwCatatan": "Lengkapi surat pengantar RT.",
            "rwOleh": "Bootstrap Admin",
            "rwTanggal": "2026-10-16 09:00",
            "rwRevisi": 1,
            "rwVersi": 2
        }
    ],
    "lapor": [
        {
            "_id": "ADU-018-1",
            "waktu": "2026-10-22 09:00",
            "noPengaduan": "ADU/2026-012",
            "nama": "Budi Santoso",
            "noHp": "081234567890",
            "alamat": "Jl. Mawar 1",
            "jenisPengaduan": "Lingkungan",
            "judul": "Sampah menumpuk",
            "detail": "Sampah di depan gang belum diangkut tiga hari.",
            "lokasi": "Gang Mawar",
            "tanggalKejadian": "2026-10-21",
            "foto": "https://drive.google.com/file/d/1MockFotoADU0181000000000000000000/view",
            "harapan": "Diangkut rutin",
            "status": "Diterima",
            "petugas": "",
            "catatan": "",
            "tanggalSelesai": "",
            "arsip": "Tidak",
            "rwStatus": "Perlu Tindak Lanjut",
            "rwPetugas": "",
            "rwDiperbarui": "2026-10-22 10:00"
        },
        {
            "_id": "ADU-018-2",
            "waktu": "2026-10-23 09:00",
            "noPengaduan": "ADU/2026-013",
            "nama": "Siti Aminah",
            "noHp": "081298765432",
            "alamat": "Jl. Mawar 2",
            "jenisPengaduan": "Keamanan",
            "judul": "Lampu penerangan mati",
            "detail": "Lampu di pos ronda mati sejak dua hari.",
            "lokasi": "Pos ronda",
            "tanggalKejadian": "2026-10-22",
            "foto": "",
            "harapan": "Diperbaiki",
            "status": "Diproses",
            "petugas": "Sudah dilaporkan ke petugas",
            "catatan": "",
            "tanggalSelesai": "",
            "arsip": "Tidak",
            "rwStatus": "Ditangani RW",
            "rwPetugas": "Sekretaris RW",
            "rwDiperbarui": "2026-10-24 08:00"
        },
        {
            "_id": "ADU-018-3",
            "waktu": "2026-10-24 09:00",
            "noPengaduan": "ADU/2026-014",
            "nama": "Agus Salim",
            "noHp": "081377788899",
            "alamat": "Jl. Mawar 3",
            "jenisPengaduan": "Sosial",
            "judul": "Bantuan warga sakit",
            "detail": "Warga lanjut usia membutuhkan bantuan.",
            "lokasi": "Jl. Mawar 3",
            "tanggalKejadian": "2026-10-24",
            "foto": "",
            "harapan": "Dana bantuan",
            "status": "Diterima",
            "petugas": "",
            "catatan": "",
            "tanggalSelesai": "",
            "arsip": "Tidak",
            "rwStatus": "Tidak Perlu",
            "rwPetugas": "",
            "rwDiperbarui": ""
        }
    ],
    "saldoAwal": 50000
};
    try {
        if (localStorage.getItem("rt_demo_seed") === SEED_VERSION) return;
        localStorage.setItem("rt_data_version", "clean-2026-10-04");
        localStorage.setItem("rt_warga", JSON.stringify(seed.warga));
        localStorage.setItem("rt_kas", JSON.stringify(seed.kas));
        localStorage.setItem("rt_pengumuman", JSON.stringify(seed.pengumuman));
        localStorage.setItem("rt_kegiatan", JSON.stringify(seed.kegiatan));
        localStorage.setItem("rt_surat", JSON.stringify(seed.surat));
        localStorage.setItem("rt_lapor", JSON.stringify(seed.lapor));
        localStorage.setItem("rt_saldo_awal", String(seed.saldoAwal));
        localStorage.setItem("rt_surat_view_mode", "all");
        localStorage.setItem("rt_kas_view_mode", "all");
        localStorage.setItem("rt_lapor_filter_month", "");
        localStorage.setItem("rt_show_archived_warga", "0");
        localStorage.setItem("rt_show_archived_surat", "0");
        localStorage.setItem("rt_show_archived_lapor", "0");
        localStorage.setItem("rt_demo_seed", SEED_VERSION);
    } catch (e) { /* localStorage tidak tersedia */ }

    function addDemoBadge() {
        if (document.getElementById("demo-badge")) return;
        var a = document.createElement("a");
        a.id = "demo-badge";
        a.href = "../index.html";
        a.textContent = "Demo - kembali ke pilihan";
        a.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;" +
            "background:#0f172a;color:#fff;font:600 12px/1 Inter,system-ui,sans-serif;" +
            "padding:9px 12px;border-radius:999px;text-decoration:none;opacity:.85;" +
            "box-shadow:0 6px 18px rgba(15,23,42,.28)";
        document.body.appendChild(a);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addDemoBadge);
    else addDemoBadge();
})();
