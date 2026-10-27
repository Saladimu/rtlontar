// Data demo untuk portal RW lokal. Tidak dipakai di produksi.
const HEADERS = {
    Data_Warga: ['Timestamp', 'Nomor KK', 'Nama Lengkap', 'Status', 'Jenis Kelamin', 'NIK', 'Tempat Lahir', 'Tanggal Lahir', 'Pendidikan', 'Pekerjaan', 'No HP', 'Status Tempat Tinggal', 'Alamat/No Rumah', 'Diarsipkan', 'ID'],
    Iuran_Kas: ['Timestamp', 'Tanggal', 'Nama Warga', 'No Rumah', 'Jenis Transaksi', 'Jumlah (Rp)', 'Keterangan', 'Diarsipkan', 'Reversal Dari', 'ID'],
    Pengajuan_Surat: ['Timestamp', 'Nama Lengkap Pemohon', 'NIK', 'No. HP / WhatsApp', 'Alamat / No. Rumah', 'Jenis Surat', 'Keperluan / Alasan Pengajuan', 'Status Pengurusan', 'No. Surat', 'Catatan Pengurus', 'Tanggal Selesai', 'Diarsipkan', 'Rw Status', 'Rw Catatan', 'Rw Oleh', 'Rw Tanggal', 'Rw Revisi', 'Rw Versi', 'Rw Kunci', 'ID'],
    Lapor_Aspirasi: ['Timestamp', 'No. Pengaduan', 'Nama Warga', 'No. HP / WhatsApp', 'Alamat / No. Rumah', 'Jenis Pengaduan', 'Judul Pengaduan', 'Detail Pengaduan', 'Lokasi Kejadian', 'Tanggal Kejadian', 'Foto / Bukti Pendukung', 'Harapan / Solusi', 'Status', 'Petugas / Pengurus', 'Catatan Tindak Lanjut', 'Tanggal Penyelesaian', 'Diarsipkan', 'Rw Status', 'Rw Petugas', 'Rw Diperbarui', 'Rw Kunci', 'ID'],
    Lapor_Tindak_Lanjut: ['ID', 'Lapor ID', 'RT ID', 'Aktor', 'Peran', 'Catatan', 'Status', 'Visibilitas', 'Waktu']
};

const RT018 = {
    rtId: 'RT018',
    nama: 'RT 018 / Lontar',
    alamat: 'Lontar Timur',
    backendVersion: 'publik-v38-2026-10-26',
    saldoAwal: 50000,
    rows: {
        Data_Warga: [
            ['2026-10-01 10:00', '3173010101010001', 'Budi Santoso', 'Menikah', 'L', '3173010101010001', 'Jakarta', '1990-01-01', 'SMA', 'Karyawan', '081234567890', 'Milik', 'Jl. Mawar 1', 'Tidak', 'DW-018-1'],
            ['2026-10-01 10:00', '3173010101010002', 'Siti Aminah', 'Menikah', 'P', '3173010101010002', 'Jakarta', '1991-02-02', 'S1', 'Guru', '081298765432', 'Milik', 'Jl. Mawar 2', 'Tidak', 'DW-018-2'],
            ['2026-10-02 10:00', '3173010101010003', 'Agus Salim', 'Belum Menikah', 'L', '3173010101010003', 'Bekasi', '1996-05-12', 'SMA', 'Teknisi', '081377788899', 'Kontrak', 'Jl. Mawar 3', 'Ya', 'DW-018-3']
        ],
        Iuran_Kas: [
            ['2026-10-01 10:00', '2026-10-01', 'Budi Santoso', '1', 'Pemasukan', 100000, 'Iuran Oktober', 'Tidak', '', 'K-018-1'],
            ['2026-10-02 10:00', '2026-10-02', 'Siti Aminah', '2', 'Pemasukan', 100000, 'Iuran Oktober', 'Tidak', '', 'K-018-2'],
            ['2026-10-05 10:00', '2026-10-05', 'Pengurus', '-', 'Pengeluaran', 45000, 'Lampu jalan', 'Tidak', '', 'K-018-3'],
            ['2026-10-06 10:00', '2026-10-06', 'Pengurus', '-', 'Reversal Keluar', 20000, 'Pembatalan iuran', 'Tidak', 'K-018-2', 'K-018-4']
        ],
        Pengajuan_Surat: [
            ['2026-10-20 09:00', 'Budi Santoso', '3173010101010001', '081234567890', 'Jl. Mawar 1', 'Surat Domisili', 'Persyaratan sekolah anak', 'Pending', '', '', '', 'Tidak', 'Menunggu', '', '', '', 0, 1, '', 'SRT-018-1'],
            ['2026-10-18 09:00', 'Siti Aminah', '3173010101010002', '081298765432', 'Jl. Mawar 2', 'Surat Usaha', 'Pengajuan kredit usaha', 'Selesai', '474/018/2026', 'Disetujui RW', '2026-10-19', 'Tidak', 'Disetujui', 'Usaha sudah berjalan.', 'rw@example.com', '2026-10-19 08:00', 0, 2, 'K-SURAT-018-1', 'SRT-018-2'],
            ['2026-10-15 09:00', 'Agus Salim', '3173010101010003', '081377788899', 'Jl. Mawar 3', 'Surat Keterangan Tidak Mampu', 'Bantuan pendidikan', 'Pending', '', '', '', 'Tidak', 'Dikembalikan', 'Lengkapi surat pengantar RT.', 'rw@example.com', '2026-10-16 09:00', 1, 2, 'K-SURAT-018-2', 'SRT-018-3']
        ],
        Lapor_Aspirasi: [
            ['2026-10-22 09:00', 'ADU/2026-012', 'Budi Santoso', '081234567890', 'Jl. Mawar 1', 'Lingkungan', 'Sampah menumpuk', 'Sampah di depan gang belum diangkut tiga hari.', 'Gang Mawar', '2026-10-21', '', 'Diangkut rutin', 'Diterima', '', '', '', 'Tidak', 'Perlu Tindak Lanjut', '', '2026-10-22 10:00', '', 'ADU-018-1'],
            ['2026-10-23 09:00', 'ADU/2026-013', 'Siti Aminah', '081298765432', 'Jl. Mawar 2', 'Keamanan', 'Lampu penerangan mati', 'Lampu di pos ronda mati sejak dua hari.', 'Pos ronda', '2026-10-22', '', 'Diperbaiki', 'Diproses', 'Sudah dilaporkan ke petugas', '', '', 'Tidak', 'Ditangani RW', 'Sekretaris RW', '2026-10-24 08:00', '', 'ADU-018-2'],
            ['2026-10-24 09:00', 'ADU/2026-014', 'Agus Salim', '081377788899', 'Jl. Mawar 3', 'Sosial', 'Bantuan warga sakit', 'Warga lanjut usia membutuhkan bantuan.', 'Jl. Mawar 3', '2026-10-24', '', 'Dana bantuan', 'Diterima', '', '', '', 'Tidak', 'Tidak Perlu', '', '', '', 'ADU-018-3']
        ],
        Lapor_Tindak_Lanjut: [
            ['TL-018-1', 'ADU-018-2', 'RT018', 'rw@example.com', 'RW Admin', 'Sudah dikoordinasikan dengan petugas keamanan.', 'Ditangani RW', 'Publik', '2026-10-24 08:00']
        ]
    }
};

const RT017 = {
    rtId: 'RT017',
    nama: 'RT 017 / Lontar',
    alamat: 'Lontar Barat',
    backendVersion: 'publik-v38-2026-10-26',
    saldoAwal: 0,
    rows: {
        Data_Warga: [
            ['2026-10-01 10:00', '3173010202020001', 'Andi Wijaya', 'Menikah', 'L', '3173010202020001', 'Jakarta', '1988-03-03', 'S1', 'Wiraswasta', '081300000001', 'Milik', 'Jl. Melati 1', 'Tidak', 'DW-017-1'],
            ['2026-10-01 10:00', '3173010202020002', 'Dewi Lestari', 'Menikah', 'P', '3173010202020002', 'Jakarta', '1990-04-04', 'SMA', 'Ibu rumah tangga', '081300000002', 'Milik', 'Jl. Melati 2', 'Tidak', 'DW-017-2']
        ],
        Iuran_Kas: [
            ['2026-10-01 10:00', '2026-10-01', 'Andi Wijaya', '1', 'Pemasukan', 250000, 'Iuran Oktober', 'Tidak', '', 'K-017-1'],
            ['2026-10-08 10:00', '2026-10-08', 'Pengurus', '-', 'Pengeluaran', 75000, 'Perbaikan gerbang', 'Tidak', '', 'K-017-2']
        ],
        Pengajuan_Surat: [
            ['2026-10-21 09:00', 'Andi Wijaya', '3173010202020001', '081300000001', 'Jl. Melati 1', 'Surat Domisili', 'Pendaftaran sekolah', 'Pending', '', '', '', 'Tidak', 'Menunggu', '', '', '', 0, 1, '', 'SRT-017-1']
        ],
        Lapor_Aspirasi: [
            ['2026-10-20 09:00', 'ADU/2026-010', 'Dewi Lestari', '081300000002', 'Jl. Melati 2', 'Lingkungan', 'Saluran air tersumbat', 'Air menggenang saat hujan.', 'Jl. Melati', '2026-10-19', '', 'Dibersihkan', 'Selesai', 'Sudah dibersihkan', '', '2026-10-21', 'Tidak', 'Selesai RW', 'Sekretaris RW', '2026-10-21 10:00', '', 'ADU-017-1']
        ],
        Lapor_Tindak_Lanjut: []
    }
};

const USERS = [
    { email: 'rw@example.com', nama: 'Bootstrap Admin', peran: 'RW Admin', aktif: true, dibuat: '2026-10-01 08:00', diperbarui: '2026-10-01 08:00' },
    { email: 'viewer@example.com', nama: 'RW Viewer', peran: 'RW Viewer', aktif: true, dibuat: '2026-10-02 08:00', diperbarui: '2026-10-02 08:00' },
    { email: 'sekretaris@example.com', nama: 'Sekretaris RW', peran: 'RW Viewer', aktif: false, dibuat: '2026-09-15 08:00', diperbarui: '2026-10-10 08:00' }
];

const SETTINGS = [
    ['CACHE_TTL_SECONDS', '300', 'Umur snapshot KPI sebelum diambil ulang (detik).'],
    ['OUTBOX_MAX_ATTEMPTS', '8', 'Batas percobaan pengiriman outbox.'],
    ['OUTBOX_BASE_DELAY_SECONDS', '60', 'Jeda dasar retry outbox (detik, exponential).'],
    ['AUDIT_RETENTION_MONTHS', '12', 'Retensi login/audit (bulan, 12-36).'],
    ['DECISION_RETENTION_MONTHS', '24', 'Retensi keputusan/tanggapan (bulan, 12-36).'],
    ['SNAPSHOT_RETENTION_MONTHS', '24', 'Retensi snapshot KPI (bulan, 12-36).'],
    ['RW_MASK_VIEWER', 'true', 'Masking NIK/HP/alamat untuk RW Viewer.'],
    ['DIGEST_ENABLED', 'false', 'Aktifkan digest harian (Phase 4).'],
    ['DIGEST_HOUR', '7', 'Jam kirim digest (0-23, Asia/Jakarta).']
];

const OUTBOX = [
    {
        'ID': 'OBX-018-1', 'Aksi': 'rwSuratDecision', 'RT ID': 'RT018', 'Target ID': 'SRT-018-1',
        'Payload': '{"decision":"Disetujui","id":"SRT-018-1"}', 'Kunci': 'surat-SRT-018-1-v1',
        'Status': 'Sent', 'Percobaan': 1, 'Next Retry': '', 'Last Error': '',
        'Dibuat': '2026-10-22 10:00', 'Diperbarui': '2026-10-22 10:01', 'Hasil': '{"ok":true}'
    },
    {
        'ID': 'OBX-018-2', 'Aksi': 'rwLaporNote', 'RT ID': 'RT018', 'Target ID': 'ADU-018-2',
        'Payload': '{"status":"Ditangani RW","catatan":"Koordinasi petugas"}', 'Kunci': 'lapor-ADU-018-2-2026-10-24',
        'Status': 'Failed', 'Percobaan': 3, 'Next Retry': '2026-10-26 10:00',
        'Last Error': 'RT tidak merespons dalam 30 detik.', 'Dibuat': '2026-10-24 08:00',
        'Diperbarui': '2026-10-26 09:05', 'Hasil': ''
    },
    {
        'ID': 'OBX-017-1', 'Aksi': 'rwSuratDecision', 'RT ID': 'RT017', 'Target ID': 'SRT-017-1',
        'Payload': '{"decision":"Dikembalikan","id":"SRT-017-1"}', 'Kunci': 'surat-SRT-017-1-v1',
        'Status': 'Pending', 'Percobaan': 0, 'Next Retry': '2026-10-26 11:00', 'Last Error': '',
        'Dibuat': '2026-10-26 10:55', 'Diperbarui': '2026-10-26 10:55', 'Hasil': ''
    }
];

const AUDIT = [
    {
        'ID': 'AUD-1', 'Waktu': '2026-10-26 10:55', 'Aktor': 'Bootstrap Admin', 'Email': 'rw@example.com',
        'Peran': 'RW Admin', 'Aksi': 'surat_decision', 'RT ID': 'RT017', 'Target': 'SRT-017-1',
        'Hasil': 'ok', 'Detail': 'Dikembalikan'
    },
    {
        'ID': 'AUD-2', 'Waktu': '2026-10-26 10:40', 'Aktor': 'Bootstrap Admin', 'Email': 'rw@example.com',
        'Peran': 'RW Admin', 'Aksi': 'settings_save', 'RT ID': '', 'Target': 'OUTBOX_MAX_ATTEMPTS',
        'Hasil': 'ok', 'Detail': '8'
    },
    {
        'ID': 'AUD-3', 'Waktu': '2026-10-26 10:20', 'Aktor': 'Bootstrap Admin', 'Email': 'rw@example.com',
        'Peran': 'RW Admin', 'Aksi': 'registry_save', 'RT ID': 'RT018', 'Target': 'https://script.google.com/macros/s/RT018/exec',
        'Hasil': 'ok', 'Detail': 'aktif'
    },
    {
        'ID': 'AUD-4', 'Waktu': '2026-10-26 09:30', 'Aktor': 'RW Viewer', 'Email': 'viewer@example.com',
        'Peran': 'RW Viewer', 'Aksi': 'login', 'RT ID': '', 'Target': '', 'Hasil': 'ok', 'Detail': 'Cloudflare Access'
    },
    {
        'ID': 'AUD-5', 'Waktu': '2026-10-26 09:05', 'Aktor': 'Bootstrap Admin', 'Email': 'rw@example.com',
        'Peran': 'RW Admin', 'Aksi': 'rt_health', 'RT ID': 'RT018', 'Target': '',
        'Hasil': 'error', 'Detail': 'RT tidak merespons dalam 30 detik.'
    }
];

module.exports = { HEADERS, RTS: [RT018, RT017], USERS, SETTINGS, OUTBOX, AUDIT };
