/* Dibuat otomatis oleh tools/build-demo.js.
   Mock /api sisi browser untuk demo Portal RW. Tidak ada backend. */
(function () {
    var MOCK = {"HEADERS":{"Data_Warga":["Timestamp","Nomor KK","Nama Lengkap","Status","Jenis Kelamin","NIK","Tempat Lahir","Tanggal Lahir","Pendidikan","Pekerjaan","No HP","Status Tempat Tinggal","Alamat/No Rumah","Diarsipkan","ID"],"Iuran_Kas":["Timestamp","Tanggal","Nama Warga","No Rumah","Jenis Transaksi","Jumlah (Rp)","Keterangan","Diarsipkan","Reversal Dari","ID"],"Pengajuan_Surat":["Timestamp","Nama Lengkap Pemohon","NIK","No. HP / WhatsApp","Alamat / No. Rumah","Jenis Surat","Keperluan / Alasan Pengajuan","Status Pengurusan","No. Surat","Catatan Pengurus","Tanggal Selesai","Diarsipkan","Rw Status","Rw Catatan","Rw Oleh","Rw Tanggal","Rw Revisi","Rw Versi","Rw Kunci","ID"],"Lapor_Aspirasi":["Timestamp","No. Pengaduan","Nama Warga","No. HP / WhatsApp","Alamat / No. Rumah","Jenis Pengaduan","Judul Pengaduan","Detail Pengaduan","Lokasi Kejadian","Tanggal Kejadian","Foto / Bukti Pendukung","Harapan / Solusi","Status","Petugas / Pengurus","Catatan Tindak Lanjut","Tanggal Penyelesaian","Diarsipkan","Rw Status","Rw Petugas","Rw Diperbarui","Rw Kunci","ID"],"Lapor_Tindak_Lanjut":["ID","Lapor ID","RT ID","Aktor","Peran","Catatan","Status","Visibilitas","Waktu"]},"RTS":[{"rtId":"RT018","nama":"RT 018 / Lontar","alamat":"Lontar Timur","backendVersion":"publik-v39-2026-10-28","saldoAwal":50000,"rows":{"Data_Warga":[["2026-10-01 10:00","3173010101010001","Siti Aminah","Istri","P","3173010101010002","Jakarta","1991-02-02","S1","Guru","081298765432","Milik","Jl. Mawar 1","Tidak","DW-018-2"],["2026-10-01 10:00","3173010101010001","Budi Santoso","Kepala Keluarga","L","3173010101010001","Jakarta","1990-01-01","SMA","Karyawan","081234567890","Milik","Jl. Mawar 1","Tidak","DW-018-1"],["2026-10-02 10:00","3173010101010003","Agus Salim","Kepala Keluarga","L","3173010101010003","Bekasi","1996-05-12","SMA","Teknisi","081377788899","Kontrak","Jl. Mawar 3","Ya","DW-018-3"]],"Iuran_Kas":[["2026-10-01 10:00","2026-10-01","Budi Santoso","1","Pemasukan",100000,"Iuran Oktober","Tidak","","K-018-1"],["2026-10-02 10:00","2026-10-02","Siti Aminah","2","Pemasukan",100000,"Iuran Oktober","Tidak","","K-018-2"],["2026-10-05 10:00","2026-10-05","Pengurus","-","Pengeluaran",45000,"Lampu jalan","Tidak","","K-018-3"],["2026-10-06 10:00","2026-10-06","Pengurus","-","Reversal Keluar",20000,"Pembatalan iuran","Tidak","K-018-2","K-018-4"]],"Pengajuan_Surat":[["2026-10-20 09:00","Budi Santoso","3173010101010001","081234567890","Jl. Mawar 1","Surat Domisili","Persyaratan sekolah anak","Pending","","","","Tidak","Menunggu","","","",0,1,"","SRT-018-1"],["2026-10-18 09:00","Siti Aminah","3173010101010002","081298765432","Jl. Mawar 2","Surat Usaha","Pengajuan kredit usaha","Selesai","474/018/2026","Disetujui RW","2026-10-19","Tidak","Disetujui","Usaha sudah berjalan.","Bootstrap Admin","2026-10-19 08:00",0,2,"K-SURAT-018-1","SRT-018-2"],["2026-10-15 09:00","Agus Salim","3173010101010003","081377788899","Jl. Mawar 3","Surat Keterangan Tidak Mampu","Bantuan pendidikan","Pending","","","","Tidak","Dikembalikan","Lengkapi surat pengantar RT.","Bootstrap Admin","2026-10-16 09:00",1,2,"K-SURAT-018-2","SRT-018-3"]],"Lapor_Aspirasi":[["2026-10-22 09:00","ADU/2026-012","Budi Santoso","081234567890","Jl. Mawar 1","Lingkungan","Sampah menumpuk","Sampah di depan gang belum diangkut tiga hari.","Gang Mawar","2026-10-21","https://drive.google.com/file/d/1MockFotoADU0181000000000000000000/view","Diangkut rutin","Diterima","","","","Tidak","Perlu Tindak Lanjut","","2026-10-22 10:00","","ADU-018-1"],["2026-10-23 09:00","ADU/2026-013","Siti Aminah","081298765432","Jl. Mawar 2","Keamanan","Lampu penerangan mati","Lampu di pos ronda mati sejak dua hari.","Pos ronda","2026-10-22","","Diperbaiki","Diproses","Sudah dilaporkan ke petugas","","","Tidak","Ditangani RW","Sekretaris RW","2026-10-24 08:00","","ADU-018-2"],["2026-10-24 09:00","ADU/2026-014","Agus Salim","081377788899","Jl. Mawar 3","Sosial","Bantuan warga sakit","Warga lanjut usia membutuhkan bantuan.","Jl. Mawar 3","2026-10-24","","Dana bantuan","Diterima","","","","Tidak","Tidak Perlu","","","","ADU-018-3"]],"Lapor_Tindak_Lanjut":[["TL-018-1","ADU-018-2","RT018","Bootstrap Admin","RW Admin","Sudah dikoordinasikan dengan petugas keamanan.","Ditangani RW","Publik","2026-10-24 08:00"]]}},{"rtId":"RT017","nama":"RT 017 / Lontar","alamat":"Lontar Barat","backendVersion":"publik-v39-2026-10-28","saldoAwal":0,"rows":{"Data_Warga":[["2026-10-01 10:00","3173010202020001","Dewi Lestari","Istri","P","3173010202020002","Jakarta","1990-04-04","SMA","Ibu rumah tangga","081300000002","Milik","Jl. Melati 1","Tidak","DW-017-2"],["2026-10-01 10:00","3173010202020001","Andi Wijaya","Kepala Keluarga","L","3173010202020001","Jakarta","1988-03-03","S1","Wiraswasta","081300000001","Milik","Jl. Melati 1","Tidak","DW-017-1"]],"Iuran_Kas":[["2026-10-01 10:00","2026-10-01","Andi Wijaya","1","Pemasukan",250000,"Iuran Oktober","Tidak","","K-017-1"],["2026-10-08 10:00","2026-10-08","Pengurus","-","Pengeluaran",75000,"Perbaikan gerbang","Tidak","","K-017-2"]],"Pengajuan_Surat":[["2026-10-21 09:00","Andi Wijaya","3173010202020001","081300000001","Jl. Melati 1","Surat Domisili","Pendaftaran sekolah","Pending","","","","Tidak","Menunggu","","","",0,1,"","SRT-017-1"]],"Lapor_Aspirasi":[["2026-10-20 09:00","ADU/2026-010","Dewi Lestari","081300000002","Jl. Melati 2","Lingkungan","Saluran air tersumbat","Air menggenang saat hujan.","Jl. Melati","2026-10-19","https://drive.google.com/uc?export=view&id=1MockFotoBukti000000000000000000000","Dibersihkan","Selesai","Sudah dibersihkan","","2026-10-21","Tidak","Selesai RW","Sekretaris RW","2026-10-21 10:00","","ADU-017-1"]],"Lapor_Tindak_Lanjut":[]}}],"USERS":[{"email":"rw@example.com","nama":"Bootstrap Admin","peran":"RW Admin","aktif":true,"dibuat":"2026-10-01 08:00","diperbarui":"2026-10-01 08:00"},{"email":"viewer@example.com","nama":"RW Viewer","peran":"RW Viewer","aktif":true,"dibuat":"2026-10-02 08:00","diperbarui":"2026-10-02 08:00"},{"email":"sekretaris@example.com","nama":"Sekretaris RW","peran":"RW Viewer","aktif":false,"dibuat":"2026-09-15 08:00","diperbarui":"2026-10-10 08:00"}],"SETTINGS":[["CACHE_TTL_SECONDS","300","Umur snapshot KPI sebelum diambil ulang (detik)."],["OUTBOX_MAX_ATTEMPTS","8","Batas percobaan pengiriman outbox."],["OUTBOX_BASE_DELAY_SECONDS","60","Jeda dasar retry outbox (detik, exponential)."],["AUDIT_RETENTION_MONTHS","12","Retensi login/audit (bulan, 12-36)."],["DECISION_RETENTION_MONTHS","24","Retensi keputusan/tanggapan (bulan, 12-36)."],["SNAPSHOT_RETENTION_MONTHS","24","Retensi snapshot KPI (bulan, 12-36)."],["RW_MASK_VIEWER","true","Masking NIK/HP/alamat untuk RW Viewer."],["EXPECTED_BACKEND_VERSION","publik-v39-2026-10-28","Versi backend RT yang diharapkan; RT dengan versi lain ditandai mismatch."],["DIGEST_ENABLED","false","Aktifkan digest harian (Phase 4)."],["DIGEST_HOUR","7","Jam kirim digest (0-23, Asia/Jakarta)."],["DIGEST_RECIPIENTS","","Penerima digest dipisah koma; kosong berarti semua RW Admin aktif."]],"OUTBOX":[{"ID":"OBX-018-1","Aksi":"rwSuratDecision","RT ID":"RT018","Target ID":"SRT-018-1","Payload":"{\"decision\":\"Disetujui\",\"id\":\"SRT-018-1\"}","Kunci":"surat-SRT-018-1-v1","Status":"Sent","Percobaan":1,"Next Retry":"","Last Error":"","Dibuat":"2026-10-22 10:00","Diperbarui":"2026-10-22 10:01","Hasil":"{\"ok\":true}"},{"ID":"OBX-018-2","Aksi":"rwLaporNote","RT ID":"RT018","Target ID":"ADU-018-2","Payload":"{\"status\":\"Ditangani RW\",\"catatan\":\"Koordinasi petugas\"}","Kunci":"lapor-ADU-018-2-2026-10-24","Status":"Failed","Percobaan":3,"Next Retry":"2026-10-26 10:00","Last Error":"RT tidak merespons dalam 30 detik.","Dibuat":"2026-10-24 08:00","Diperbarui":"2026-10-26 09:05","Hasil":""},{"ID":"OBX-017-1","Aksi":"rwSuratDecision","RT ID":"RT017","Target ID":"SRT-017-1","Payload":"{\"decision\":\"Dikembalikan\",\"id\":\"SRT-017-1\"}","Kunci":"surat-SRT-017-1-v1","Status":"Pending","Percobaan":0,"Next Retry":"2026-10-26 11:00","Last Error":"","Dibuat":"2026-10-26 10:55","Diperbarui":"2026-10-26 10:55","Hasil":""}],"AUDIT":[{"ID":"AUD-1","Waktu":"2026-10-26 10:55","Aktor":"Bootstrap Admin","Email":"rw@example.com","Peran":"RW Admin","Aksi":"surat_decision","RT ID":"RT017","Target":"SRT-017-1","Hasil":"ok","Detail":"Dikembalikan"},{"ID":"AUD-2","Waktu":"2026-10-26 10:40","Aktor":"Bootstrap Admin","Email":"rw@example.com","Peran":"RW Admin","Aksi":"settings_save","RT ID":"","Target":"OUTBOX_MAX_ATTEMPTS","Hasil":"ok","Detail":"8"},{"ID":"AUD-3","Waktu":"2026-10-26 10:20","Aktor":"Bootstrap Admin","Email":"rw@example.com","Peran":"RW Admin","Aksi":"registry_save","RT ID":"RT018","Target":"https://script.google.com/macros/s/RT018/exec","Hasil":"ok","Detail":"aktif"},{"ID":"AUD-4","Waktu":"2026-10-26 09:30","Aktor":"RW Viewer","Email":"viewer@example.com","Peran":"RW Viewer","Aksi":"login","RT ID":"","Target":"","Hasil":"ok","Detail":"Cloudflare Access"},{"ID":"AUD-5","Waktu":"2026-10-26 09:05","Aktor":"Bootstrap Admin","Email":"rw@example.com","Peran":"RW Admin","Aksi":"rt_health","RT ID":"RT018","Target":"","Hasil":"error","Detail":"RT tidak merespons dalam 30 detik."}]};
    var HEADERS = MOCK.HEADERS, RTS = MOCK.RTS, USERS = MOCK.USERS,
        SETTINGS = MOCK.SETTINGS, OUTBOX = MOCK.OUTBOX, AUDIT = MOCK.AUDIT;
    var VERSION = 'rw-orchestrator-v1-2026-10-30-06';
    var MAX_RTS = 10;

    function isArchived(v) {
        const s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
        return s === 'ya' || s === 'yes' || s === 'true' || s === '1' || s === 'arsip';
    }

    function maskValue(value, keep) {
        const s = String(value === null || value === undefined ? '' : value);
        if (!s) return s;
        if (s.length <= keep) return s;
        return '••••••••' + s.slice(-keep);
    }

    function maskRows(sheet, rows, masked) {
        if (!masked) return rows;
        const headers = HEADERS[sheet] || [];
        const idx = (name) => headers.indexOf(name);
        const nik = idx('NIK');
        const hpCandidates = ['No. HP / WhatsApp', 'No HP / WhatsApp', 'No HP'];
        const hp = hpCandidates.reduce((found, name) => found !== -1 ? found : idx(name), -1);
        const alamatCandidates = ['Alamat/No Rumah', 'Alamat / No. Rumah', 'Alamat'];
        const alamat = alamatCandidates.reduce((found, name) => found !== -1 ? found : idx(name), -1);
        return rows.map((row) => {
            const copy = row.slice();
            if (nik !== -1 && copy[nik]) copy[nik] = maskValue(copy[nik], 4);
            if (hp !== -1 && copy[hp]) copy[hp] = maskValue(copy[hp], 4);
            if (alamat !== -1 && copy[alamat]) copy[alamat] = '[disembunyikan]';
            return copy;
        });
    }

    function userFor(email) {
        const e = String(email || '').trim().toLowerCase();
        return USERS.find((u) => u.email === e && u.aktif) || null;
    }

    function rtById(id) {
        return RTS.find((rt) => rt.rtId === id) || null;
    }

    let mockIdSeq = 0;

    function stampNow() {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(new Date());
        const v = {};
        parts.forEach((p) => { v[p.type] = p.value; });
        if (v.hour === '24') v.hour = '00';
        return v.year + '-' + v.month + '-' + v.day + ' ' + v.hour + ':' + v.minute;
    }

    function makeMockId(prefix) {
        mockIdSeq += 1;
        return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + mockIdSeq;
    }

    function writeSuratDecision(body, user) {
        if (user.peran !== 'RW Admin') return { result: 'error', code: 'forbidden', message: 'Hanya RW Admin yang dapat memutuskan surat.' };
        const rt = rtById(String(body.rtId || '').toUpperCase());
        if (!rt) return { result: 'error', code: 'rt_not_found', message: 'RT tidak ditemukan.' };
        const id = String(body.id || body.suratId || '').trim();
        const decision = String(body.decision || '').trim();
        const catatan = String(body.catatan || '').trim();
        const kunci = String(body.kunci || '').trim();
        if (!id) return { result: 'error', code: 'invalid', message: 'ID surat wajib diisi.' };
        if (['Disetujui', 'Dikembalikan', 'Ditolak'].indexOf(decision) === -1) {
            return { result: 'error', code: 'invalid_decision', message: 'Keputusan tidak dikenal.' };
        }
        if (decision !== 'Disetujui' && catatan.length < 3) {
            return { result: 'error', code: 'note_required', message: 'Catatan wajib diisi untuk keputusan negatif.' };
        }
        if (kunci.length < 6) return { result: 'error', code: 'idempotency_required', message: 'Kunci idempotensi minimal 6 karakter.' };
        const rows = rt.rows.Pengajuan_Surat || [];
        const row = rows.find((r) => String(r[19]) === id);
        if (!row) return { result: 'error', code: 'not_found', message: 'Pengajuan tidak ditemukan: ' + id };
        const curStatus = String(row[12] || 'Tidak Perlu');
        const curKunci = String(row[18] || '');
        const curRevisi = Number(row[16] || 0) || 0;
        const curVersi = Number(row[17] || 1) || 1;
        if (curKunci && curKunci === kunci) {
            return { result: 'success', version: VERSION, duplicate: true, kunci: kunci, id: id, rwStatus: curStatus, rwRevisi: curRevisi, rwVersi: curVersi };
        }
        if (curStatus !== 'Menunggu') {
            return { result: 'error', code: 'not_pending', message: 'Pengajuan tidak dalam status Menunggu (saat ini: ' + curStatus + ').' };
        }
        if (body.expectedVersi !== undefined && body.expectedVersi !== null && body.expectedVersi !== '' &&
            Number(body.expectedVersi) !== curVersi) {
            return { result: 'error', code: 'stale', message: 'Pengajuan sudah berubah sejak dibaca. Muat ulang data.' };
        }
        if (decision === 'Dikembalikan' && curRevisi >= 3) {
            return { result: 'error', code: 'max_negative', message: 'Batas 3 revisi sudah tercapai. Gunakan Setujui atau Tolak sebagai keputusan final.' };
        }
        const finalReject = decision === 'Ditolak' && curRevisi >= 3;
        const newRevisi = (decision === 'Disetujui' || finalReject) ? curRevisi : curRevisi + 1;
        const newVersi = curVersi + 1;
        const stamp = stampNow();
        row[12] = decision;
        row[13] = catatan;
        row[14] = user.nama || user.email;
        row[15] = stamp;
        row[16] = newRevisi;
        row[17] = newVersi;
        row[18] = kunci;
        return {
            result: 'success', version: VERSION, kunci: kunci, sent: true, queued: false,
            id: id, rwStatus: decision, rwCatatan: catatan, rwOleh: user.nama || user.email,
            rwTanggal: stamp, rwRevisi: newRevisi, rwVersi: newVersi
        };
    }

    function writeLaporNote(body, user) {
        if (user.peran !== 'RW Admin') return { result: 'error', code: 'forbidden', message: 'Hanya RW Admin yang dapat menanggapi pengaduan.' };
        const rt = rtById(String(body.rtId || '').toUpperCase());
        if (!rt) return { result: 'error', code: 'rt_not_found', message: 'RT tidak ditemukan.' };
        const id = String(body.id || body.laporId || '').trim();
        const catatan = String(body.catatan || '').trim();
        const status = String(body.status || '').trim();
        const visibilitas = String(body.visibilitas || 'Publik').trim();
        const kunci = String(body.kunci || '').trim();
        if (!id) return { result: 'error', code: 'invalid', message: 'ID pengaduan wajib diisi.' };
        if (catatan.length < 3) return { result: 'error', code: 'note_required', message: 'Catatan tindak lanjut wajib diisi minimal 3 karakter.' };
        if (kunci.length < 6) return { result: 'error', code: 'idempotency_required', message: 'Kunci idempotensi minimal 6 karakter.' };
        if (status && ['Ditangani RW', 'Selesai RW'].indexOf(status) === -1) {
            return { result: 'error', code: 'invalid_status', message: 'Status RW harus Ditangani RW atau Selesai RW.' };
        }
        if (['Publik', 'Internal'].indexOf(visibilitas) === -1) {
            return { result: 'error', code: 'invalid_visibility', message: 'Visibilitas harus Publik atau Internal.' };
        }
        const rows = rt.rows.Lapor_Aspirasi || [];
        const row = rows.find((r) => String(r[21]) === id);
        if (!row) return { result: 'error', code: 'not_found', message: 'Pengaduan tidak ditemukan: ' + id };
        const curStatus = String(row[17] || 'Tidak Perlu');
        const curKunci = String(row[20] || '');
        const curDiperbarui = String(row[19] || '');
        if (curKunci && curKunci === kunci) {
            return { result: 'success', version: VERSION, duplicate: true, kunci: kunci, id: id, rwStatus: curStatus, rwDiperbarui: curDiperbarui };
        }
        if (body.expectedDiperbarui !== undefined && body.expectedDiperbarui !== null && body.expectedDiperbarui !== '' &&
            String(body.expectedDiperbarui) !== curDiperbarui) {
            return { result: 'error', code: 'stale', message: 'Pengaduan sudah berubah sejak dibaca. Muat ulang data.' };
        }
        let newStatus = status || curStatus;
        if (!status && (curStatus === 'Tidak Perlu' || curStatus === 'Perlu Tindak Lanjut')) newStatus = 'Ditangani RW';
        const stamp = stampNow();
        row[17] = newStatus;
        row[18] = user.nama || user.email;
        row[19] = stamp;
        row[20] = kunci;
        if (visibilitas === 'Publik') row[14] = catatan;
        const timelineId = makeMockId('TL');
        rt.rows.Lapor_Tindak_Lanjut = rt.rows.Lapor_Tindak_Lanjut || [];
        rt.rows.Lapor_Tindak_Lanjut.push([timelineId, id, rt.rtId, user.nama || user.email, 'RW', catatan, newStatus, visibilitas, stamp]);
        return {
            result: 'success', version: VERSION, kunci: kunci, sent: true, queued: false,
            id: id, timelineId: timelineId, rwStatus: newStatus, rwPetugas: user.nama || user.email,
            rwDiperbarui: stamp, visibilitas: visibilitas
        };
    }

    function listAction(body, user) {
        const rt = rtById(body.rtId);
        if (!rt) return { result: 'error', code: 'not_found', message: 'RT tidak ditemukan.' };
        const sheet = String(body.sheet || '');
        const headers = HEADERS[sheet];
        if (!headers) return { result: 'error', code: 'invalid_sheet', message: 'Sheet tidak diizinkan.' };

        let rows = (rt.rows[sheet] || []).map((row) => row.slice());
        const includeArchived = body.includeArchived === true;
        const arsipIdx = headers.indexOf('Diarsipkan');
        if (!includeArchived && arsipIdx !== -1) {
            rows = rows.filter((row) => !isArchived(row[arsipIdx]));
        }
        if (body.status) {
            const statusIdx = headers.indexOf('Rw Status');
            if (statusIdx !== -1) rows = rows.filter((row) => String(row[statusIdx] || '') === String(body.status));
        }
        if (body.laporId) {
            const refIdx = headers.indexOf('Lapor ID');
            if (refIdx !== -1) rows = rows.filter((row) => String(row[refIdx] || '') === String(body.laporId));
        }

        const limit = Math.max(1, Math.min(2000, Number(body.limit) || 200));
        const offset = Math.max(0, Number(body.offset) || 0);
        const total = rows.length;
        const page = rows.slice(offset, offset + limit);
        const masked = !!user && user.peran === 'RW Viewer';

        const out = {
            result: 'success',
            version: VERSION,
            sheet: sheet,
            headers: headers,
            rows: maskRows(sheet, page, masked),
            total: total,
            offset: offset,
            limit: limit,
            truncated: offset + page.length < total,
            masked: masked,
            rtId: rt.rtId
        };
        if (sheet === 'Iuran_Kas') out.saldoAwal = rt.saldoAwal;
        return out;
    }

    function dashboardAction() {
        const now = new Date().toISOString();
        const expected = expectedBackendVersion();
        const rts = RTS.map((rt) => {
            const wargaRows = rt.rows.Data_Warga || [];
            const kasRows = rt.rows.Iuran_Kas || [];
            const suratRows = rt.rows.Pengajuan_Surat || [];
            const laporRows = rt.rows.Lapor_Aspirasi || [];

            const warga = wargaRows.filter((r) => !isArchived(r[13])).length;
            let masuk = 0;
            let keluar = 0;
            kasRows.forEach((r) => {
                if (isArchived(r[7])) return;
                const jenis = String(r[4] || '').toLowerCase();
                const nominal = Number(r[5]) || 0;
                if (jenis === 'pengeluaran' || jenis === 'reversal keluar') keluar += nominal;
                else masuk += nominal;
            });
            const suratMenunggu = suratRows.filter((r) => !isArchived(r[11]) && String(r[12] || '') === 'Menunggu').length;
            const laporTerbuka = laporRows.filter((r) => !isArchived(r[16]) && String(r[12] || '') !== 'Selesai').length;
            const laporEskalasi = laporRows.filter((r) => !isArchived(r[16]) && String(r[17] || '') === 'Perlu Tindak Lanjut').length;
            return {
                rtId: rt.rtId,
                nama: rt.nama,
                alamat: rt.alamat,
                backendVersion: rt.backendVersion,
                versionMismatch: !!(expected && rt.backendVersion && rt.backendVersion !== expected),
                lastSync: now,
                lastError: '',
                warga: warga,
                kasSaldo: rt.saldoAwal + masuk - keluar,
                suratMenunggu: suratMenunggu,
                laporTerbuka: laporTerbuka,
                laporEskalasi: laporEskalasi,
                status: 'OK',
                error: '',
                ageSeconds: 0,
                stale: false
            };
        });
        const totals = rts.reduce((acc, rt) => {
            acc.warga += rt.warga;
            acc.kasSaldo += rt.kasSaldo;
            acc.suratMenunggu += rt.suratMenunggu;
            acc.laporTerbuka += rt.laporTerbuka;
            acc.laporEskalasi += rt.laporEskalasi;
            return acc;
        }, { warga: 0, kasSaldo: 0, suratMenunggu: 0, laporTerbuka: 0, laporEskalasi: 0 });
        return {
            result: 'success',
            version: VERSION,
            generatedAt: now,
            cacheTtlSeconds: 300,
            lastSync: now,
            expectedVersion: expected,
            totals: totals,
            rts: rts
        };
    }

    const settingState = SETTINGS.map((s) => ({ key: s[0], value: s[1], keterangan: s[2], diperbarui: '2026-10-01 08:00' }));
    const registryState = RTS.map((rt) => ({
        rtId: rt.rtId,
        nama: rt.nama,
        alamat: rt.alamat,
        endpoint: 'https://script.google.com/macros/s/' + rt.rtId + '/exec',
        aktif: true,
        backendVersion: rt.backendVersion,
        lastSync: '2026-10-26 09:00',
        lastError: ''
    }));
    const outboxState = OUTBOX.map((o) => Object.assign({}, o));
    const auditState = AUDIT.map((a) => Object.assign({}, a));

    function settings() {
        return settingState.map((s) => Object.assign({}, s));
    }

    function expectedBackendVersion() {
        const row = settingState.find((s) => s.key === 'EXPECTED_BACKEND_VERSION');
        return row ? String(row.value || '').trim() : '';
    }

    function validateSetting(key, value) {
        const def = settingState.find((s) => s.key === key);
        if (!def) return 'Key pengaturan tidak dikenal: ' + key;
        const numKeys = ['CACHE_TTL_SECONDS', 'OUTBOX_MAX_ATTEMPTS', 'OUTBOX_BASE_DELAY_SECONDS',
            'AUDIT_RETENTION_MONTHS', 'DECISION_RETENTION_MONTHS', 'SNAPSHOT_RETENTION_MONTHS', 'DIGEST_HOUR'];
        if (numKeys.indexOf(key) !== -1) {
            const n = Number(value);
            if (!isFinite(n) || n < 0) return 'Nilai ' + key + ' harus angka >= 0.';
        }
        if (key === 'RW_MASK_VIEWER' || key === 'DIGEST_ENABLED') {
            if (['true', 'false', '1', '0', 'ya', 'tidak'].indexOf(String(value).toLowerCase()) === -1) {
                return 'Nilai ' + key + ' harus true/false.';
            }
        }
        if (key === 'DIGEST_HOUR' && (Number(value) < 0 || Number(value) > 23)) return 'DIGEST_HOUR harus 0-23.';
        if (key === 'EXPECTED_BACKEND_VERSION') {
            const v = String(value === undefined || value === null ? '' : value).trim();
            if (!v) return 'EXPECTED_BACKEND_VERSION wajib diisi (mis. publik-v39-2026-10-28).';
            if (v.length > 80) return 'EXPECTED_BACKEND_VERSION maksimal 80 karakter.';
        }
        if (key === 'DIGEST_RECIPIENTS') {
            const raw = String(value === undefined || value === null ? '' : value).trim();
            if (raw) {
                const bad = raw.split(',').map((x) => x.trim()).find((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
                if (bad) return 'DIGEST_RECIPIENTS harus daftar email dipisah koma: ' + bad;
            }
        }
        return '';
    }

    function digestRecipients() {
        const row = settingState.find((s) => s.key === 'DIGEST_RECIPIENTS');
        const raw = row ? String(row.value || '').trim() : '';
        if (raw) return raw.split(',').map((x) => x.trim()).filter(Boolean);
        return USERS.filter((u) => u.aktif !== false && u.peran === 'RW Admin').map((u) => u.email);
    }

    function digestGroup(value) {
        const n = Math.round(Number(value) || 0);
        return new Intl.NumberFormat('id-ID').format(n);
    }

    function digestPreview() {
        const dash = dashboardAction();
        const stamp = new Date().toISOString();
        const lines = ['Ringkasan Harian RW 06', 'Waktu: ' + stamp + ' (Asia/Jakarta)', ''];
        lines.push('Total ' + dash.rts.length + ' RT: ' + digestGroup(dash.totals.warga) + ' warga, saldo kas Rp ' + digestGroup(dash.totals.kasSaldo) +
            ', ' + digestGroup(dash.totals.suratMenunggu) + ' surat menunggu, ' + digestGroup(dash.totals.laporTerbuka) +
            ' pengaduan terbuka, ' + digestGroup(dash.totals.laporEskalasi) + ' eskalasi.');
        return {
            result: 'success',
            version: VERSION,
            subject: 'Ringkasan Harian RW 06 - ' + stamp.slice(0, 10),
            text: lines.join('\n'),
            html: '<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px">' +
                '<h2 style="margin:0 0 4px;font-size:18px;text-align:center">Ringkasan Harian RW 06</h2>' +
                '<p style="margin:0 0 14px;color:#475569;font-size:12px;text-align:center">' + stamp + ' (Asia/Jakarta)</p>' +
                '<p>' + dash.rts.length + ' RT</p></div>',
            totals: dash.totals,
            stale: dash.rts.filter((r) => r.stale).length,
            generatedAt: stamp,
            recipients: digestRecipients(),
            lastRun: ''
        };
    }

    function pushAudit(user, aksi, rtId, target, hasil, detail) {
        auditState.push({
            'ID': makeMockId('AUD'),
            'Waktu': stampNow(),
            'Aktor': user ? (user.nama || user.email) : 'system',
            'Email': user ? user.email : 'system',
            'Peran': user ? user.peran : 'system',
            'Aksi': aksi,
            'RT ID': rtId || '',
            'Target': target || '',
            'Hasil': hasil || '',
            'Detail': detail === undefined || detail === null ? '' : String(detail).slice(0, 1000)
        });
    }

    function saveUser(body, user) {
        if (user.peran !== 'RW Admin') return { result: 'error', code: 'forbidden', message: 'Hanya RW Admin yang dapat mengubah pengguna.' };
        const email = String(body.userEmail || body.targetEmail || body.email || '').trim().toLowerCase();
        const nama = String(body.nama || '').trim();
        const peran = String(body.peran || '').trim();
        const aktif = body.aktif === undefined ? true : (body.aktif === true || String(body.aktif).toLowerCase() === 'ya' || String(body.aktif) === 'true');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { result: 'error', code: 'invalid_email', message: 'Format email tidak valid.' };
        if (['RW Admin', 'RW Viewer'].indexOf(peran) === -1) return { result: 'error', code: 'invalid_role', message: 'Peran harus RW Admin atau RW Viewer.' };
        if (!nama) return { result: 'error', code: 'invalid', message: 'Nama wajib diisi.' };
        const existing = USERS.find((u) => u.email === email);
        if (existing) {
            const activeAdmins = USERS.filter((u) => u.aktif && u.peran === 'RW Admin');
            const losesAdmin = existing.peran === 'RW Admin' && existing.aktif && (peran !== 'RW Admin' || !aktif);
            if (losesAdmin && activeAdmins.length <= 1) {
                return { result: 'error', code: 'last_admin', message: 'Tidak dapat menonaktifkan/menurunkan RW Admin terakhir.' };
            }
            existing.nama = nama;
            existing.peran = peran;
            existing.aktif = aktif;
            existing.diperbarui = stampNow();
        } else {
            USERS.push({ email, nama, peran, aktif, dibuat: stampNow(), diperbarui: stampNow() });
        }
        pushAudit(user, 'user_save', '', email, 'ok', peran + (aktif ? '' : ' (nonaktif)'));
        return { result: 'success', version: VERSION, users: USERS };
    }

    function saveRegistry(body, user) {
        if (user.peran !== 'RW Admin') return { result: 'error', code: 'forbidden', message: 'Hanya RW Admin yang dapat mengubah registry RT.' };
        const rtId = String(body.rtId || '').trim().toUpperCase();
        const nama = String(body.nama || '').trim();
        const alamat = String(body.alamat || '').trim();
        const endpoint = String(body.endpoint || '').trim();
        const aktif = body.aktif === undefined ? true : (body.aktif === true || String(body.aktif).toLowerCase() === 'ya' || String(body.aktif) === 'true');
        if (!/^RT\d{3}$/.test(rtId)) return { result: 'error', code: 'invalid_rt', message: 'RT ID harus berformat RTNNN, mis. RT018.' };
        if (!nama) return { result: 'error', code: 'invalid', message: 'Nama RT wajib diisi.' };
        if (!/^https:\/\//i.test(endpoint) || !/\/exec(\?|$)/i.test(endpoint)) return { result: 'error', code: 'invalid_endpoint', message: 'Endpoint harus https://.../exec.' };
        if (registryState.some((rt) => rt.rtId !== rtId && rt.endpoint === endpoint)) return { result: 'error', code: 'duplicate_endpoint', message: 'Endpoint sudah dipakai RT lain.' };
        const existing = registryState.find((rt) => rt.rtId === rtId);
        if (!existing && registryState.length >= MAX_RTS) return { result: 'error', code: 'max_rts', message: 'Maksimal ' + MAX_RTS + ' RT dapat terdaftar.' };
        if (existing) {
            existing.nama = nama;
            existing.alamat = alamat;
            existing.endpoint = endpoint;
            existing.aktif = aktif;
        } else {
            registryState.push({ rtId, nama, alamat, endpoint, aktif, backendVersion: '', lastSync: '', lastError: '' });
        }
        pushAudit(user, 'registry_save', rtId, endpoint, 'ok', aktif ? 'aktif' : 'nonaktif');
        return { result: 'success', version: VERSION, rt: registryState.find((rt) => rt.rtId === rtId) };
    }

    function saveSetting(body, user) {
        if (user.peran !== 'RW Admin') return { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' };
        const key = String(body.key || '').trim();
        const value = String(body.value === undefined || body.value === null ? '' : body.value).trim();
        const invalid = validateSetting(key, value);
        if (invalid) return { result: 'error', code: 'invalid_setting', message: invalid };
        const found = settingState.find((s) => s.key === key);
        found.value = value;
        found.diperbarui = stampNow();
        pushAudit(user, 'settings_save', '', key, 'ok', value);
        return { result: 'success', version: VERSION, settings: settings() };
    }

    function outboxRetry(body, user) {
        if (user.peran !== 'RW Admin') return { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' };
        const id = String(body.id || '').trim();
        if (id) {
            const item = outboxState.find((o) => o.ID === id);
            if (!item) return { result: 'error', code: 'outbox_not_found', message: 'Outbox tidak ditemukan.' };
            if (String(item.Status) === 'Sent') return { result: 'success', version: VERSION, retry: { ok: true, sent: true, duplicate: true } };
            item.Status = 'Sent';
            item.Percobaan = Number(item.Percobaan || 0) + 1;
            item['Next Retry'] = '';
            item['Last Error'] = '';
            item.Hasil = '{"ok":true}';
            item.Diperbarui = stampNow();
            pushAudit(user, 'outbox_retry', item['RT ID'], item.ID, 'ok', 'manual');
            return { result: 'success', version: VERSION, retry: { ok: true, sent: true } };
        }
        const limit = Number(body.limit || 20);
        const due = outboxState.filter((o) => String(o.Status) !== 'Sent').slice(0, limit);
        due.forEach((item) => {
            item.Status = 'Sent';
            item.Percobaan = Number(item.Percobaan || 0) + 1;
            item['Next Retry'] = '';
            item['Last Error'] = '';
            item.Hasil = '{"ok":true}';
            item.Diperbarui = stampNow();
        });
        pushAudit(user, 'outbox_process', '', '', 'ok', String(due.length) + ' entri');
        return { result: 'success', version: VERSION, processed: due.length };
    }

    function handleApi(body, headers) {
        const email = String(headers['x-rw-dev-email'] || 'rw@example.com').trim().toLowerCase();
        const user = userFor(email);
        if (!user) {
            return { status: 403, data: { result: 'error', code: 'forbidden', message: 'Email belum terdaftar sebagai pengguna RW.' } };
        }
        const action = String(body.action || '');
        if (action === 'rwSession') {
            return { status: 200, data: { result: 'success', version: VERSION, user: user } };
        }
        if (action === 'rwDashboard' || action === 'rwRefresh') {
            return { status: 200, data: dashboardAction() };
        }
        if (action === 'rwRegistryList') {
            if (user.peran !== 'RW Admin') return { status: 200, data: { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' } };
            return { status: 200, data: { result: 'success', version: VERSION, expectedVersion: expectedBackendVersion(), registry: registryState.map((rt) => Object.assign({}, rt)) } };
        }
        if (action === 'rwRegistrySave') {
            return { status: 200, data: saveRegistry(body, user) };
        }
        if (action === 'rwSettingsGet') {
            return { status: 200, data: { result: 'success', version: VERSION, settings: settings() } };
        }
        if (action === 'rwDigestPreview') {
            if (user.peran !== 'RW Admin') return { status: 200, data: { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' } };
            return { status: 200, data: digestPreview() };
        }
        if (action === 'rwDigestSend') {
            if (user.peran !== 'RW Admin') return { status: 200, data: { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' } };
            const preview = digestPreview();
            pushAudit(user, 'digest_send_manual', '', preview.recipients.join(','), 'ok', preview.subject);
            return { status: 200, data: { result: 'success', version: VERSION, subject: preview.subject, text: preview.text, recipients: preview.recipients, totals: preview.totals, stale: preview.stale, generatedAt: preview.generatedAt } };
        }
        if (action === 'rwUsersList') {
            if (user.peran !== 'RW Admin') return { status: 200, data: { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' } };
            return { status: 200, data: { result: 'success', version: VERSION, users: USERS } };
        }
        if (action === 'rwList') {
            return { status: 200, data: listAction(body, user) };
        }
        if (action === 'rwSuratDecision') {
            return { status: 200, data: writeSuratDecision(body, user) };
        }
        if (action === 'rwLaporNote') {
            return { status: 200, data: writeLaporNote(body, user) };
        }
        if (action === 'rwUsersSave') {
            return { status: 200, data: saveUser(body, user) };
        }
        if (action === 'rwSettingsSave') {
            return { status: 200, data: saveSetting(body, user) };
        }
        if (action === 'rwOutboxList') {
            if (user.peran !== 'RW Admin') return { status: 200, data: { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' } };
            return { status: 200, data: { result: 'success', version: VERSION, outbox: outboxState.map((o) => Object.assign({}, o)) } };
        }
        if (action === 'rwOutboxRetry') {
            return { status: 200, data: outboxRetry(body, user) };
        }
        if (action === 'rwAuditList') {
            if (user.peran !== 'RW Admin') return { status: 200, data: { result: 'error', code: 'forbidden', message: 'Hanya RW Admin.' } };
            const limit = Math.min(Math.max(Number(body.limit || 100), 1), 500);
            return { status: 200, data: { result: 'success', version: VERSION, audit: auditState.slice(-limit).reverse().map((a) => Object.assign({}, a)) } };
        }
        if (action === 'rwRtHealth') {
            const id = String(body.rtId || '').trim().toUpperCase();
            const rt = registryState.find((x) => x.rtId === id);
            if (!rt) return { status: 200, data: { result: 'error', code: 'rt_not_found', message: 'RT tidak ditemukan.' } };
            rt.lastError = '';
            rt.lastSync = stampNow();
            rt.backendVersion = rt.backendVersion || 'publik-v39-2026-10-28';
            pushAudit(user, 'rt_health', id, '', 'ok', rt.backendVersion);
            return { status: 200, data: { result: 'success', version: VERSION, rtId: id, check: { version: rt.backendVersion } } };
        }
        return { status: 200, data: { result: 'error', code: 'not_implemented', message: 'Aksi demo belum tersedia: ' + action } };
    }

    try {
        if (!localStorage.getItem("rw_dev_email")) localStorage.setItem("rw_dev_email", "rw@example.com");
    } catch (e) { /* abaikan */ }

    var originalFetch = window.fetch ? window.fetch.bind(window) : null;
    window.fetch = function (input, init) {
        var url = (typeof input === 'string') ? input : ((input && input.url) || '');
        var pathname = url;
        try { pathname = new URL(url, location.href).pathname; } catch (e) { /* abaikan */ }
        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        if ((pathname === '/api' || /\/api$/.test(pathname)) && method === 'POST') {
            var body = {};
            try { body = JSON.parse((init && init.body) || '{}') || {}; } catch (e) { body = {}; }
            var headers = {};
            var given = (init && init.headers) || {};
            Object.keys(given).forEach(function (k) { headers[String(k).toLowerCase()] = given[k]; });
            var out = handleApi(body, headers);
            return Promise.resolve(new Response(JSON.stringify(out.data), {
                status: out.status,
                headers: { 'content-type': 'application/json; charset=utf-8' }
            }));
        }
        if (originalFetch) return originalFetch(input, init);
        return Promise.reject(new Error('fetch tidak tersedia'));
    };
})();
