#!/usr/bin/env node
// Membangun folder `demo/` statis dari sumber aplikasi.
//
// Demo berisi dua aplikasi yang berjalan tanpa backend:
//   1. demo/rt  - Admin SAPA-RT dalam mode lokal (localStorage), data contoh
//                 di-seed otomatis dari rw/tools/mock-data.js.
//   2. demo/rw  - Portal RW dengan `/api` di-mock di sisi browser
//                 (mock-api.js mem-patch window.fetch).
//   3. demo/index.html - halaman pemilih demo.
//
// Tidak ada permintaan ke Google Sheets / gateway produksi. Jalankan ulang
// setiap kali sumber berubah:
//
//   node tools/build-demo.js

const fs = require('fs');
const path = require('path');
const mock = require('../rw/tools/mock-data');

const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(ROOT, 'demo');

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, content) {
    const file = path.join(DEMO, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

function copy(rel, destRel) {
    const from = path.join(ROOT, rel);
    const to = path.join(DEMO, destRel || rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.cpSync(from, to, { recursive: true });
}

function mustReplace(text, from, to, label) {
    if (text.indexOf(from) === -1) throw new Error('Penanda tidak ditemukan: ' + label);
    return text.split(from).join(to);
}

// ---------------------------------------------------------------- RT seed
const RT = mock.RTS.find(function (rt) { return rt.rtId === 'RT018'; }) || mock.RTS[0];
const RT_NUMBER = String(RT.rtId).replace(/^RT/, '');
const rows = RT.rows || {};

function mapWarga(r) {
    return {
        _id: r[r.length - 1], timestamp: r[0], nomorKK: r[1], nama: r[2], status: r[3],
        jenisKelamin: r[4], nik: r[5], tempat: r[6], tanggalLahir: r[7], pendidikan: r[8],
        pekerjaan: r[9], hp: r[10], statusTinggal: r[11], alamat: r[12], arsip: r[13]
    };
}

function mapKas(r) {
    return {
        _id: r[r.length - 1], timestamp: r[0], tanggal: r[1], nama: r[2], noRumah: r[3],
        jenis: r[4], jumlah: r[5], keterangan: r[6], arsip: r[7],
        reversalDari: r.length > 9 ? (r[8] || '') : ''
    };
}

function mapSurat(r) {
    return {
        _id: r[r.length - 1], waktu: r[0], nama: r[1], nik: r[2], noHp: r[3], alamat: r[4],
        jenisSurat: r[5], keperluan: r[6], status: r[7] || 'Pending', noSurat: r[8],
        catatan: r[9], tanggalSelesai: r[10], arsip: r[11],
        rwStatus: r[12] || 'Tidak Perlu', rwCatatan: r[13] || '', rwOleh: r[14] || '',
        rwTanggal: r[15] || '', rwRevisi: Number(r[16]) || 0, rwVersi: Number(r[17]) || 1
    };
}

function mapLapor(r) {
    return {
        _id: r[r.length - 1], waktu: r[0], noPengaduan: r[1], nama: r[2], noHp: r[3], alamat: r[4],
        jenisPengaduan: r[5], judul: r[6], detail: r[7], lokasi: r[8], tanggalKejadian: r[9],
        foto: r[10], harapan: r[11], status: r[12] || 'Diterima', petugas: r[13],
        catatan: r[14], tanggalSelesai: r[15], arsip: r[16],
        rwStatus: r[17] || 'Tidak Perlu', rwPetugas: r[18] || '', rwDiperbarui: r[19] || ''
    };
}

const seed = {
    warga: (rows.Data_Warga || []).map(mapWarga),
    kas: (rows.Iuran_Kas || []).map(mapKas),
    pengumuman: [
        { _id: 'PEN-018-1', timestamp: '2026-11-01T02:00:00.000Z', tanggal: '2026-11-01', judul: 'Kerja Bakti Bulan November', isi: 'Kerja bakti membersihkan saluran air akan dilaksanakan Minggu pagi. Mohon membawa peralatan kebersihan.', kategori: 'Kegiatan', pj: 'Ketua RT 018', publik: 'Ya' },
        { _id: 'PEN-018-2', timestamp: '2026-11-02T02:00:00.000Z', tanggal: '2026-11-02', judul: 'Pembayaran Iuran Kas', isi: 'Iuran kas bulan November dapat dibayarkan kepada Bendahara RT paling lambat tanggal 25.', kategori: 'Keuangan', pj: 'Bendahara RT 018', publik: 'Ya' }
    ],
    kegiatan: [
        { _id: 'KEG-018-1', timestamp: '2026-11-02T02:00:00.000Z', namaKegiatan: 'Kerja Bakti Lingkungan', tanggal: '2026-11-09', waktu: '07:00', lokasi: 'Depan Pos Ronda', pj: 'Ketua RT 018', keterangan: 'Membawa cangkul dan sapu lidi', publik: 'Ya' },
        { _id: 'KEG-018-2', timestamp: '2026-11-02T02:00:00.000Z', namaKegiatan: 'Posyandu Balita', tanggal: '2026-11-15', waktu: '08:00', lokasi: 'Balai Warga', pj: 'Kader Posyandu', keterangan: 'Pemeriksaan rutin bulanan', publik: 'Ya' }
    ],
    surat: (rows.Pengajuan_Surat || []).map(mapSurat),
    lapor: (rows.Lapor_Aspirasi || []).map(mapLapor),
    saldoAwal: Number(RT.saldoAwal) || 0
};

const SEED_VERSION = 'demo-2026-11-06';
const seedJs = '/* Dibuat otomatis oleh tools/build-demo.js - data contoh mode lokal.\n' +
    '   Hanya mengisi sekali; perubahan pengguna tidak ditimpa saat muat ulang. */\n' +
    '(function () {\n' +
    '    var SEED_VERSION = "' + SEED_VERSION + '";\n' +
    '    var seed = ' + JSON.stringify(seed, null, 4) + ';\n' +
    '    try {\n' +
    '        if (localStorage.getItem("rt_demo_seed") === SEED_VERSION) return;\n' +
    '        localStorage.setItem("rt_data_version", "clean-2026-10-04");\n' +
    '        localStorage.setItem("rt_warga", JSON.stringify(seed.warga));\n' +
    '        localStorage.setItem("rt_kas", JSON.stringify(seed.kas));\n' +
    '        localStorage.setItem("rt_pengumuman", JSON.stringify(seed.pengumuman));\n' +
    '        localStorage.setItem("rt_kegiatan", JSON.stringify(seed.kegiatan));\n' +
    '        localStorage.setItem("rt_surat", JSON.stringify(seed.surat));\n' +
    '        localStorage.setItem("rt_lapor", JSON.stringify(seed.lapor));\n' +
    '        localStorage.setItem("rt_saldo_awal", String(seed.saldoAwal));\n' +
    '        localStorage.setItem("rt_surat_view_mode", "all");\n' +
    '        localStorage.setItem("rt_kas_view_mode", "all");\n' +
    '        localStorage.setItem("rt_lapor_filter_month", "");\n' +
    '        localStorage.setItem("rt_show_archived_warga", "0");\n' +
    '        localStorage.setItem("rt_show_archived_surat", "0");\n' +
    '        localStorage.setItem("rt_show_archived_lapor", "0");\n' +
    '        localStorage.setItem("rt_demo_seed", SEED_VERSION);\n' +
    '    } catch (e) { /* localStorage tidak tersedia */ }\n' +
    '\n' +
    '    function addDemoBadge() {\n' +
    '        if (document.getElementById("demo-badge")) return;\n' +
    '        var a = document.createElement("a");\n' +
    '        a.id = "demo-badge";\n' +
    '        a.href = "../index.html";\n' +
    '        a.textContent = "Demo - kembali ke pilihan";\n' +
    '        a.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;" +\n' +
    '            "background:#0f172a;color:#fff;font:600 12px/1 Inter,system-ui,sans-serif;" +\n' +
    '            "padding:9px 12px;border-radius:999px;text-decoration:none;opacity:.85;" +\n' +
    '            "box-shadow:0 6px 18px rgba(15,23,42,.28)";\n' +
    '        document.body.appendChild(a);\n' +
    '    }\n' +
    '    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addDemoBadge);\n' +
    '    else addDemoBadge();\n' +
    '})();\n';

// ---------------------------------------------------------------- RT HTML
function buildRt() {
    let html = read('index.html');

    html = mustReplace(html,
        "        if ('serviceWorker' in navigator) {\n" +
        "            window.addEventListener('load', function () {\n" +
        "                navigator.serviceWorker.register('sw.js').catch(function () {});\n" +
        "            });\n" +
        "        }\n",
        "        // Demo statis: service worker dinonaktifkan agar tidak meng-cache demo.\n",
        'service worker');

    html = mustReplace(html,
        '                if (apiBases().length) flushOutbox();\n                startUpdateWatcher();',
        '                if (apiBases().length) flushOutbox();\n                // Demo statis: pemantau versi dinonaktifkan.',
        'startUpdateWatcher');

    html = mustReplace(html,
        '    <!-- ================= JAVASCRIPT APP LOGIC ================= -->',
        '    <script src="seed.js"></script>\n' +
        '    <!-- ================= JAVASCRIPT APP LOGIC ================= -->',
        'seed script');

    write('rt/index.html', html);
    write('rt/seed.js', seedJs);

    // config.js demo: mode lokal tanpa endpoint produksi.
    let cfg = read('config.js');
    cfg = cfg.replace(/publicApiUrl:\s*'[^']*'/, "publicApiUrl: ''");
    cfg = cfg.replace(/apiBase:\s*'[^']*'/, "apiBase: ''");
    cfg = cfg.replace(/publicPortalUrl:\s*'[^']*'/, "publicPortalUrl: ''");
    cfg = cfg.replace(/^\s*rt:\s*'[^']*'/m, "    rt: '" + RT_NUMBER + "'");
    cfg = cfg.replace(/^\s*alamatrt:\s*'[^']*'/m, "    alamatrt: '" + String(RT.alamat || ('Lontar ' + RT_NUMBER)).replace(/'/g, "\\'") + "'");
    write('rt/config.js', cfg);

    ['tailwind.css', 'fonts.css', 'favicon.ico', 'rt-icon.png', 'icon-192.png',
        'apple-touch-icon.png', 'manifest.webmanifest', 'fonts'].forEach(function (asset) {
        copy(asset, 'rt/' + asset);
    });
}

// ---------------------------------------------------------------- RW mock
function buildMockApi() {
    const serverSrc = read('rw/tools/mock-server.js');
    const start = serverSrc.indexOf('function isArchived(v)');
    const end = serverSrc.indexOf('function sendJson(res, status, data)');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('Gagal mengekstrak fungsi mock dari rw/tools/mock-server.js');
    }
    const browserSafe = serverSrc.slice(start, end).trim();

    const data = {
        HEADERS: mock.HEADERS,
        RTS: mock.RTS,
        USERS: mock.USERS,
        SETTINGS: mock.SETTINGS,
        OUTBOX: mock.OUTBOX,
        AUDIT: mock.AUDIT
    };

    const js = '/* Dibuat otomatis oleh tools/build-demo.js.\n' +
        '   Mock /api sisi browser untuk demo Portal RW. Tidak ada backend. */\n' +
        '(function () {\n' +
        '    var MOCK = ' + JSON.stringify(data) + ';\n' +
        '    var HEADERS = MOCK.HEADERS, RTS = MOCK.RTS, USERS = MOCK.USERS,\n' +
        '        SETTINGS = MOCK.SETTINGS, OUTBOX = MOCK.OUTBOX, AUDIT = MOCK.AUDIT;\n' +
        "    var VERSION = 'rw-orchestrator-v1-2026-10-30-06';\n" +
        '    var MAX_RTS = 10;\n\n' +
        browserSafe.split('\n').map(function (line) { return line ? '    ' + line : line; }).join('\n') + '\n\n' +
        '    try {\n' +
        '        if (!localStorage.getItem("rw_dev_email")) localStorage.setItem("rw_dev_email", "rw@example.com");\n' +
        '    } catch (e) { /* abaikan */ }\n\n' +
        '    var originalFetch = window.fetch ? window.fetch.bind(window) : null;\n' +
        '    window.fetch = function (input, init) {\n' +
        "        var url = (typeof input === 'string') ? input : ((input && input.url) || '');\n" +
        '        var pathname = url;\n' +
        "        try { pathname = new URL(url, location.href).pathname; } catch (e) { /* abaikan */ }\n" +
        "        var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();\n" +
        "        if ((pathname === '/api' || /\\/api$/.test(pathname)) && method === 'POST') {\n" +
        '            var body = {};\n' +
        "            try { body = JSON.parse((init && init.body) || '{}') || {}; } catch (e) { body = {}; }\n" +
        '            var headers = {};\n' +
        '            var given = (init && init.headers) || {};\n' +
        '            Object.keys(given).forEach(function (k) { headers[String(k).toLowerCase()] = given[k]; });\n' +
        '            var out = handleApi(body, headers);\n' +
        '            return Promise.resolve(new Response(JSON.stringify(out.data), {\n' +
        '                status: out.status,\n' +
        "                headers: { 'content-type': 'application/json; charset=utf-8' }\n" +
        '            }));\n' +
        '        }\n' +
        '        if (originalFetch) return originalFetch(input, init);\n' +
        "        return Promise.reject(new Error('fetch tidak tersedia'));\n" +
        '    };\n' +
        '})();\n';

    write('rw/mock-api.js', js);
}

function buildRw() {
    let html = read('rw/index.html');
    html = mustReplace(html,
        '    <script src="app.js" defer></script>',
        '    <script src="mock-api.js"></script>\n    <script src="app.js" defer></script>\n' +
        '    <script>\n' +
        '        window.addEventListener("DOMContentLoaded", function () {\n' +
        '            var a = document.createElement("a");\n' +
        '            a.href = "../index.html";\n' +
        '            a.textContent = "Demo - kembali ke pilihan";\n' +
        '            a.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;" +\n' +
        '                "background:#0f172a;color:#fff;font:600 12px/1 Inter,system-ui,sans-serif;" +\n' +
        '                "padding:9px 12px;border-radius:999px;text-decoration:none;opacity:.85;" +\n' +
        '                "box-shadow:0 6px 18px rgba(15,23,42,.28)";\n' +
        '            document.body.appendChild(a);\n' +
        '        });\n' +
        '    </script>',
        'rw mock script');
    html = html.replace(
        '<a class="btn btn-ghost" href="/cdn-cgi/access/logout"><i class="fa-solid fa-arrow-right"></i> Keluar</a>',
        '<a class="btn btn-ghost" href="index.html"><i class="fa-solid fa-arrow-right"></i> Kembali</a>'
    );
    write('rw/index.html', html);
    write('rw/version.json', JSON.stringify({ build: 'demo', service: 'rw06-portal-demo' }, null, 2) + '\n');

    ['app.js', 'styles.css', 'tailwind.css', 'fonts.css', 'theme.js', 'favicon.ico',
        'apple-touch-icon.png', 'logo-192.webp', 'logo-192.png', 'logo-512.webp',
        'logo-512.png', 'manifest.webmanifest', 'fonts'].forEach(function (asset) {
        copy('rw/' + asset, 'rw/' + asset);
    });

    buildMockApi();
}

// ---------------------------------------------------------------- landing
function buildLanding() {
    const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SAPA RT - Demo Aplikasi</title>
    <link rel="icon" type="image/png" href="rt/favicon.ico">
    <link rel="stylesheet" href="rt/fonts.css">
    <link rel="stylesheet" href="rt/tailwind.css">
    <style>
        body { font-family: 'Inter', system-ui, sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">
    <main class="max-w-5xl mx-auto px-6 py-12">
        <header class="text-center mb-10">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 text-white mb-4">
                <i class="fa-solid fa-house-crack text-2xl"></i>
            </div>
            <h1 class="text-3xl font-bold text-slate-900">SAPA RT - Demo Aplikasi</h1>
            <p class="text-slate-500 mt-2">Demo statis tanpa backend. Semua data contoh hanya tersimpan di browser Anda.</p>
        </header>

        <div class="grid gap-6 md:grid-cols-2">
            <a href="rt/" class="block bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
                        <i class="fa-solid fa-desktop text-lg"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-slate-900">Admin RT</h2>
                        <p class="text-xs text-slate-500">Mode lokal (localStorage)</p>
                    </div>
                </div>
                <p class="text-sm text-slate-600">Kelola data warga, iuran kas, pengumuman, kegiatan, pengajuan surat, dan pengaduan. Perubahan hanya tersimpan di browser ini.</p>
                <span class="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-cyan-700">
                    <i class="fa-solid fa-arrow-right"></i> Buka Admin RT
                </span>
            </a>

            <a href="rw/" class="block bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-11 h-11 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                        <i class="fa-solid fa-users text-lg"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-bold text-slate-900">Portal RW</h2>
                        <p class="text-xs text-slate-500">Mock /api di browser</p>
                    </div>
                </div>
                <p class="text-sm text-slate-600">Ringkasan RT, keputusan surat, tanggapan pengaduan, pengguna, registry, pengaturan, outbox, dan audit dengan data contoh.</p>
                <span class="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-teal-700">
                    <i class="fa-solid fa-arrow-right"></i> Buka Portal RW
                </span>
            </a>
        </div>

        <div class="mt-8 bg-white rounded-2xl border border-slate-200 p-6">
            <h2 class="text-sm font-bold text-slate-900 mb-2"><i class="fa-solid fa-circle-info mr-2 text-slate-400"></i>Akun demo Portal RW</h2>
            <ul class="text-sm text-slate-600 space-y-1">
                <li><b>RW Admin:</b> rw@example.com &mdash; dapat menyetujui surat dan menanggapi pengaduan.</li>
                <li><b>RW Viewer:</b> viewer@example.com &mdash; hanya baca, data sensitif disamarkan.</li>
                <li>Ganti akun dengan menambahkan <code class="bg-slate-100 px-1 rounded">?devEmail=viewer@example.com</code> pada URL Portal RW.</li>
            </ul>
            <p class="text-xs text-slate-400 mt-3">Data admin RT dapat dikosongkan lewat menu Integrasi Google Sheets &rarr; Reset Demo Data (Local).</p>
        </div>
    </main>
</body>
</html>
`;
    write('index.html', html);
}

buildRt();
buildRw();
buildLanding();
console.log('Demo dibangun di ' + path.relative(ROOT, DEMO) + '/');
