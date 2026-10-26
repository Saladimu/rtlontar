#!/usr/bin/env node
// Local preview server for /rw. Serves the static portal and a mocked /api.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { HEADERS, RTS, USERS } = require('./mock-data');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8001);
const VERSION = 'rw-orchestrator-v1-2026-10-26';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
};

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
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
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
    row[14] = user.email;
    row[15] = stamp;
    row[16] = newRevisi;
    row[17] = newVersi;
    row[18] = kunci;
    return {
        result: 'success', version: VERSION, kunci: kunci, sent: true, queued: false,
        id: id, rwStatus: decision, rwCatatan: catatan, rwOleh: user.email,
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
    row[18] = user.email;
    row[19] = stamp;
    row[20] = kunci;
    if (visibilitas === 'Publik') row[14] = catatan;
    const timelineId = makeMockId('TL');
    rt.rows.Lapor_Tindak_Lanjut = rt.rows.Lapor_Tindak_Lanjut || [];
    rt.rows.Lapor_Tindak_Lanjut.push([timelineId, id, rt.rtId, user.email, 'RW', catatan, newStatus, visibilitas, stamp]);
    return {
        result: 'success', version: VERSION, kunci: kunci, sent: true, queued: false,
        id: id, timelineId: timelineId, rwStatus: newStatus, rwPetugas: user.email,
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
        totals: totals,
        rts: rts
    };
}

function settings() {
    return [
        ['CACHE_TTL_SECONDS', '300', 'Umur snapshot KPI sebelum diambil ulang (detik).'],
        ['OUTBOX_MAX_ATTEMPTS', '8', 'Batas percobaan pengiriman outbox.'],
        ['OUTBOX_BASE_DELAY_SECONDS', '60', 'Jeda dasar retry outbox (detik, exponential).'],
        ['AUDIT_RETENTION_MONTHS', '12', 'Retensi login/audit (bulan, 12-36).'],
        ['DECISION_RETENTION_MONTHS', '24', 'Retensi keputusan/tanggapan (bulan, 12-36).'],
        ['SNAPSHOT_RETENTION_MONTHS', '24', 'Retensi snapshot KPI (bulan, 12-36).'],
        ['RW_MASK_VIEWER', 'true', 'Masking NIK/HP/alamat untuk RW Viewer.'],
        ['DIGEST_ENABLED', 'false', 'Aktifkan digest harian (Phase 4).'],
        ['DIGEST_HOUR', '7', 'Jam kirim digest (0-23, Asia/Jakarta).']
    ].map((s) => ({ key: s[0], value: s[1], keterangan: s[2], diperbarui: new Date().toISOString() }));
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
        return {
            status: 200,
            data: {
                result: 'success', version: VERSION,
                registry: RTS.map((rt) => ({ rtId: rt.rtId, nama: rt.nama, alamat: rt.alamat, endpoint: 'https://script.google.com/macros/s/' + rt.rtId + '/exec', aktif: true, backendVersion: rt.backendVersion, lastSync: new Date().toISOString(), lastError: '' }))
            }
        };
    }
    if (action === 'rwSettingsGet') {
        return { status: 200, data: { result: 'success', version: VERSION, settings: settings() } };
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
    if (action === 'rwOutboxList') {
        return { status: 200, data: { result: 'success', version: VERSION, outbox: [] } };
    }
    if (action === 'rwAuditList') {
        return { status: 200, data: { result: 'success', version: VERSION, audit: [] } };
    }
    if (action === 'rwRtHealth') {
        const rt = rtById(body.rtId);
        return { status: 200, data: rt ? { result: 'success', version: VERSION, rt: { rtId: rt.rtId, status: 'OK', backendVersion: rt.backendVersion } } : { result: 'error', code: 'not_found', message: 'RT tidak ditemukan.' } };
    }
    return { status: 200, data: { result: 'error', code: 'not_implemented', message: 'Aksi demo belum tersedia: ' + action } };
}

function sendJson(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'content-length': Buffer.byteLength(body)
    });
    res.end(body);
}

function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.resolve(ROOT, '.' + rel);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
        res.writeHead(403); res.end('Forbidden'); return;
    }
    fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, {
            'content-type': MIME[ext] || 'application/octet-stream',
            'cache-control': 'no-store',
            'content-length': stat.size
        });
        fs.createReadStream(file).pipe(res);
    });
}

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api')) {
        sendJson(res, 200, {
            result: 'success', service: 'rw06-mock', version: VERSION,
            configured: { orchestrator: true, gatewaySecret: true, access: true, devMode: true }
        });
        return;
    }
    if (url.pathname === '/api') {
        if (req.method !== 'POST') { sendJson(res, 405, { result: 'error', code: 'method_not_allowed', message: 'Gunakan POST.' }); return; }
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
            let body;
            try { body = raw ? JSON.parse(raw) : {}; } catch (e) {
                sendJson(res, 400, { result: 'error', code: 'invalid_json', message: 'Body bukan JSON.' });
                return;
            }
            const result = handleApi(body, req.headers);
            sendJson(res, result.status, result.data);
        });
        return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405); res.end('Method not allowed'); return;
    }
    serveStatic(req, res, url.pathname);
});

if (require.main === module) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log('[rw-mock] Portal RW local preview: http://localhost:' + PORT);
        console.log('[rw-mock] Akun demo: rw@example.com (RW Admin), viewer@example.com (RW Viewer)');
        console.log('[rw-mock] Ganti akun: http://localhost:' + PORT + '/?devEmail=viewer@example.com');
    });
}

module.exports = { handleApi, listAction, dashboardAction, settings, server };
