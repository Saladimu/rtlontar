/* RW 06 portal. No secrets are stored in the browser. */
(function () {
    'use strict';

    var BUILD = '2026-10-26-03';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var PAGE_META = {
        dashboard: ['Ringkasan', 'Kondisi terkini seluruh RT'],
        warga: ['Data Warga', 'Daftar warga per RT (baca saja)'],
        kas: ['Kas RT', 'Saldo dan riwayat transaksi per RT'],
        surat: ['Pengajuan Surat', 'Antrean dan keputusan RW'],
        lapor: ['Pengaduan', 'Tindak lanjut RW atas aspirasi warga']
    };

    var state = {
        page: 'dashboard',
        session: null,
        dashboard: null,
        filters: {
            warga: { rt: '', q: '' },
            kas: { rt: '' },
            surat: { rt: '', status: '' },
            lapor: { rt: '', status: '' }
        },
        busy: false,
        actionBusy: false,
        dashboardLoadedAt: 0
    };
    var warningState = { onConfirm: null };

    function $(id) { return document.getElementById(id); }
    function esc(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function isBlank(v) { return v === null || v === undefined || String(v).trim() === ''; }
    function escLines(value) {
        return esc(value).replace(/\r?\n/g, '<br>');
    }
    function isAdmin() {
        return !!(state.session && state.session.user && state.session.user.peran === 'RW Admin');
    }
    function hashText(text) {
        var h = 2166136261;
        var s = String(text || '');
        for (var i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(36);
    }
    function makeKunci(prefix, parts) {
        var base = (parts || []).map(function (p) {
            return String(p === null || p === undefined ? '' : p);
        }).join('|');
        return prefix + '-' + hashText(base) + '-' + base.length;
    }
    function isAmbiguousWriteError(err) {
        var code = String((err && err.code) || '');
        return code === 'network' || code === 'upstream_unreachable' || code === 'upstream_error' ||
            code === 'upstream_invalid' || /^http_5\d\d$/.test(code);
    }
    function rtLabel(rtId) {
        var rts = (state.dashboard && state.dashboard.rts) || [];
        var found = rts.find(function (rt) { return rt.rtId === rtId; });
        return found && found.nama ? rtId + ' · ' + found.nama : (rtId || 'RT');
    }
    function isArchived(v) {
        var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
        return s === 'ya' || s === 'yes' || s === 'true' || s === '1' || s === 'arsip';
    }
    function fmtInt(n) {
        var v = Number(n);
        if (!isFinite(v)) v = 0;
        return new Intl.NumberFormat('id-ID').format(Math.round(v));
    }
    function fmtMoney(n) {
        var v = Number(n);
        if (!isFinite(v)) v = 0;
        return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(v));
    }
    function fmtDate(value) {
        if (isBlank(value)) return '-';
        var s = String(value);
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})?/);
        if (!m) return esc(s);
        var out = m[3] + '-' + MONTHS[Number(m[2]) - 1] + '-' + m[1];
        if (m[4]) out += ' ' + m[4];
        return out;
    }
    function fmtRelative(value) {
        if (isBlank(value)) return '-';
        var d = new Date(value);
        if (isNaN(d.getTime())) return fmtDate(value);
        var diff = Math.round((d.getTime() - Date.now()) / 1000);
        var abs = Math.abs(diff);
        try {
            var rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
            if (abs < 60) return rtf.format(diff, 'second');
            if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
            if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
            return rtf.format(Math.round(diff / 86400), 'day');
        } catch (e) {
            return fmtDate(value);
        }
    }
    function badge(text, cls, icon) {
        return '<span class="badge ' + cls + '">' +
            (icon ? '<i class="fa-solid ' + icon + '"></i>' : '') + esc(text) + '</span>';
    }
    function rwSuratBadge(status) {
        var s = String(status || 'Tidak Perlu');
        if (s === 'Disetujui') return badge(s, 'badge-green', 'fa-circle-check');
        if (s === 'Menunggu') return badge(s, 'badge-amber', 'fa-hourglass-half');
        if (s === 'Dikembalikan') return badge(s, 'badge-blue', 'fa-arrow-right');
        if (s === 'Ditolak') return badge(s, 'badge-red', 'fa-circle-exclamation');
        return badge(s, 'badge-neutral', 'fa-circle-info');
    }
    function rwLaporBadge(status) {
        var s = String(status || 'Tidak Perlu');
        if (s === 'Selesai RW') return badge(s, 'badge-green', 'fa-circle-check');
        if (s === 'Ditangani RW') return badge(s, 'badge-blue', 'fa-user-gear');
        if (s === 'Perlu Tindak Lanjut') return badge(s, 'badge-amber', 'fa-hourglass-half');
        return badge(s, 'badge-neutral', 'fa-circle-info');
    }
    function rtSuratBadge(status) {
        var s = String(status || 'Pending');
        if (s === 'Selesai') return badge(s, 'badge-green', 'fa-circle-check');
        if (s === 'Diproses') return badge(s, 'badge-blue', 'fa-clock-rotate-left');
        if (s === 'Ditolak') return badge(s, 'badge-red', 'fa-circle-exclamation');
        return badge(s, 'badge-amber', 'fa-hourglass-half');
    }
    function rtLaporBadge(status) {
        var s = String(status || 'Diterima');
        if (s === 'Selesai') return badge(s, 'badge-green', 'fa-circle-check');
        if (s === 'Diproses') return badge(s, 'badge-amber', 'fa-clock-rotate-left');
        return badge(s, 'badge-blue', 'fa-inbox');
    }
    function healthBadge(rt) {
        if (rt && rt.stale) return badge('Stale', 'badge-amber', 'fa-triangle-exclamation');
        if (rt && rt.status === 'Error') return badge('Error', 'badge-red', 'fa-circle-exclamation');
        if (rt && rt.status === 'OK') return badge('OK', 'badge-green', 'fa-circle-check');
        return badge(rt && rt.status ? rt.status : 'Tidak diketahui', 'badge-neutral', 'fa-circle-info');
    }

    function toast(message, type) {
        var el = $('toast');
        var icon = $('toast-icon');
        $('toast-text').textContent = message;
        el.classList.remove('hidden', 'error', 'success');
        if (type === 'error') el.classList.add('error');
        if (type === 'success') el.classList.add('success');
        icon.className = 'fa-solid ' + (type === 'error' ? 'fa-circle-exclamation' : type === 'success' ? 'fa-circle-check' : 'fa-circle-info');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { el.classList.add('hidden'); }, type === 'error' ? 7000 : 4000);
    }

    function openWarning(opts) {
        var options = opts || {};
        var tone = options.tone || 'primary';
        var iconClass = tone === 'danger' ? 'danger' : tone === 'blue' ? 'blue' : 'primary';
        var buttonClass = tone === 'danger' ? 'btn-danger' : tone === 'blue' ? 'btn-blue' : 'btn-primary';
        $('warning-eyebrow').textContent = options.eyebrow || 'Konfirmasi tindakan';
        $('warning-title').textContent = options.title || 'Konfirmasi';
        $('warning-message').innerHTML = options.message || '';
        $('warning-icon').className = 'modal-icon ' + iconClass;
        $('warning-icon').innerHTML = '<i class="fa-solid ' + (options.icon || 'fa-triangle-exclamation') + '"></i>';
        $('warning-confirm').className = 'btn ' + buttonClass;
        $('warning-confirm').innerHTML = '<i class="fa-solid ' + (options.confirmIcon || 'fa-circle-check') + '"></i> ' +
            esc(options.confirmLabel || 'Ya, Lanjutkan');
        $('warning-confirm').disabled = false;
        warningState.onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
        $('modal-warning').classList.remove('hidden');
        document.body.classList.add('modal-open');
        var cancel = $('warning-cancel');
        if (cancel && cancel.focus) cancel.focus();
    }

    function closeWarning() {
        warningState.onConfirm = null;
        var modal = $('modal-warning');
        if (modal) modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        var confirm = $('warning-confirm');
        if (confirm) confirm.disabled = false;
    }

    function runWarningConfirm() {
        var callback = warningState.onConfirm;
        closeWarning();
        if (callback) callback();
    }

    function getDevEmail() {
        try {
            var q = new URLSearchParams(location.search);
            if (q.get('devEmail')) localStorage.setItem('rw_dev_email', q.get('devEmail'));
            return localStorage.getItem('rw_dev_email') || '';
        } catch (e) { return ''; }
    }

    function api(action, payload) {
        var headers = { 'Content-Type': 'application/json' };
        var devEmail = getDevEmail();
        if (devEmail) headers['X-RW-Dev-Email'] = devEmail;
        var body = Object.assign({ action: action }, payload || {});
        return fetch('/api', { method: 'POST', headers: headers, body: JSON.stringify(body) })
            .then(function (res) {
                return res.text().then(function (text) {
                    var data;
                    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
                    if (!res.ok) {
                        var err = new Error(data.message || ('Permintaan gagal (' + res.status + ').'));
                        err.code = data.code || 'http_' + res.status;
                        err.status = res.status;
                        throw err;
                    }
                    if (data.result === 'error') {
                        var err2 = new Error(data.message || 'Permintaan ditolak.');
                        err2.code = data.code || 'error';
                        throw err2;
                    }
                    return data;
                });
            }, function () {
                var err = new Error('Tidak dapat menghubungi gateway RW.');
                err.code = 'network';
                throw err;
            });
    }

    function setSync(label, cls) {
        var el = $('sync-pill');
        if (!el) return;
        el.className = 'sync-pill' + (cls ? ' ' + cls : '');
        el.innerHTML = '<i class="fa-solid ' + (cls === 'error' ? 'fa-circle-exclamation' : cls === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-notch') + '"></i><span>' + esc(label) + '</span>';
    }

    function showAccess(message) {
        $('boot').classList.add('hidden');
        $('app').classList.add('hidden');
        $('access').classList.remove('hidden');
        $('access-message').textContent = message || 'Portal RW hanya dapat dibuka oleh pengguna yang terdaftar.';
    }

    function showApp() {
        $('boot').classList.add('hidden');
        $('access').classList.add('hidden');
        $('app').classList.remove('hidden');
    }

    function renderSession() {
        var user = state.session && state.session.user ? state.session.user : {};
        $('session-name').textContent = user.nama || user.email || '-';
        $('session-email').textContent = user.email || '-';
        $('session-role').textContent = user.peran || '-';
        $('session-avatar').innerHTML = '<i class="fa-solid ' + (user.peran === 'RW Viewer' ? 'fa-eye' : 'fa-user-gear') + '"></i>';
        $('build-info').textContent = 'Portal build ' + BUILD + ' · ' + (state.session && state.session.version ? state.session.version : 'orkestrator');
    }

    function renderChrome() {
        var meta = PAGE_META[state.page] || PAGE_META.dashboard;
        $('page-title').textContent = meta[0];
        $('page-subtitle').textContent = meta[1];
        document.querySelectorAll('.nav-item').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-page') === state.page);
        });
        renderSession();
        document.body.classList.remove('drawer-open');
        $('sidebar').classList.remove('open');
    }

    function pageLoading(label) {
        $('page').innerHTML = '<div class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i>' + esc(label || 'Memuat data...') + '</div>';
    }
    function pageError(err) {
        $('page').innerHTML = '<div class="card"><div class="empty">' +
            '<i class="fa-solid fa-triangle-exclamation"></i>' +
            '<p>' + esc((err && err.message) || 'Gagal memuat data.') + '</p>' +
            '<p style="margin-top:10px"><button type="button" class="btn btn-ghost" data-retry><i class="fa-solid fa-arrows-rotate"></i> Coba lagi</button></p>' +
            '</div></div>';
    }

    function ensureDashboard(force) {
        var fresh = state.dashboard && (Date.now() - state.dashboardLoadedAt < 60000);
        if (state.dashboard && fresh && !force) return Promise.resolve(state.dashboard);
        return api('rwDashboard').then(function (res) {
            state.dashboard = res;
            state.dashboardLoadedAt = Date.now();
            return res;
        });
    }

    function rtOptions(selected) {
        var rts = (state.dashboard && state.dashboard.rts) || [];
        if (!rts.length) return '<option value="">Tidak ada RT aktif</option>';
        return rts.map(function (rt) {
            return '<option value="' + esc(rt.rtId) + '"' + (rt.rtId === selected ? ' selected' : '') + '>' +
                esc(rt.rtId) + (rt.nama ? ' · ' + esc(rt.nama) : '') + '</option>';
        }).join('');
    }

    function defaultRt() {
        var rts = (state.dashboard && state.dashboard.rts) || [];
        return rts.length ? rts[0].rtId : '';
    }

    function rowsToObjects(headers, rows) {
        var out = [];
        (rows || []).forEach(function (row) {
            var obj = {};
            (headers || []).forEach(function (h, i) { obj[h] = row[i]; });
            out.push(obj);
        });
        return out;
    }

    function listNotice(res) {
        var html = '';
        if (res && res.masked) {
            html += '<div class="notice notice-info"><i class="fa-solid fa-eye"></i><div>Anda masuk sebagai <strong>RW Viewer</strong>. NIK/HP hanya 4 digit terakhir dan alamat disembunyikan.</div></div>';
        }
        if (res && res.truncated) {
            html += '<div class="notice notice-warn"><i class="fa-solid fa-triangle-exclamation"></i><div>Menampilkan ' + fmtInt((res.rows || []).length) + ' dari ' + fmtInt(res.total) + ' baris. Persempit filter untuk melihat data lain.</div></div>';
        }
        return html;
    }

    function renderDashboard() {
        pageLoading('Memuat ringkasan...');
        ensureDashboard().then(function (d) {
            var t = d.totals || {};
            var cards = [
                ['Warga aktif', fmtInt(t.warga), 'jiwa', 'fa-users', ''],
                ['Saldo kas', fmtMoney(t.kasSaldo), 'gabungan semua RT', 'fa-wallet', 'money'],
                ['Surat menunggu', fmtInt(t.suratMenunggu), 'perlu keputusan RW', 'fa-file-signature', ''],
                ['Pengaduan terbuka', fmtInt(t.laporTerbuka), 'belum selesai', 'fa-comment-dots', ''],
                ['Eskalasi RW', fmtInt(t.laporEskalasi), 'menunggu tindak lanjut', 'fa-paper-plane', '']
            ];
            var kpi = cards.map(function (c) {
                return '<article class="kpi-card">' +
                    '<div class="kpi-head"><span class="kpi-label">' + esc(c[0]) + '</span><span class="kpi-icon"><i class="fa-solid ' + c[3] + '"></i></span></div>' +
                    '<p class="kpi-value ' + c[4] + '">' + c[1] + '</p>' +
                    '<p class="kpi-note">' + esc(c[2]) + '</p></article>';
            }).join('');

            var rows = (d.rts || []).map(function (rt) {
                return '<tr class="clickable" data-rt="' + esc(rt.rtId) + '">' +
                    '<td><span class="cell-main">' + esc(rt.rtId) + '</span><span class="cell-sub">' + esc(rt.nama || '') + '</span></td>' +
                    '<td class="num">' + fmtInt(rt.warga) + '</td>' +
                    '<td class="num">' + fmtMoney(rt.kasSaldo) + '</td>' +
                    '<td class="num">' + fmtInt(rt.suratMenunggu) + '</td>' +
                    '<td class="num">' + fmtInt(rt.laporTerbuka) + '</td>' +
                    '<td class="num">' + fmtInt(rt.laporEskalasi) + '</td>' +
                    '<td>' + healthBadge(rt) + '</td>' +
                    '<td class="nowrap"><span class="cell-main">' + esc(rt.backendVersion || '-') + '</span><span class="cell-sub">' + fmtRelative(rt.lastSync) + '</span></td>' +
                    '</tr>';
            }).join('');

            var stale = (d.rts || []).filter(function (rt) { return rt.stale || rt.status === 'Error'; });
            var warning = stale.length
                ? '<div class="notice notice-warn"><i class="fa-solid fa-triangle-exclamation"></i><div>' + stale.length + ' RT menampilkan data stale/error. Nilai terakhir tetap ditampilkan; periksa koneksi atau token RT.</div></div>'
                : '';

            $('page').innerHTML =
                '<div class="grid kpi-grid">' + kpi + '</div>' +
                '<div style="height:16px"></div>' + warning +
                '<section class="card">' +
                    '<div class="card-head"><div><h2>Status RT</h2><p>Diperbarui ' + fmtRelative(d.generatedAt) + ' · cache ' + fmtInt(d.cacheTtlSeconds) + ' detik</p></div>' +
                    '<div class="spacer"></div>' +
                    '<span class="sync-pill ' + (stale.length ? 'warn' : 'ok') + '"><i class="fa-solid ' + (stale.length ? 'fa-triangle-exclamation' : 'fa-circle-check') + '"></i><span>' + (stale.length ? 'Sebagian stale' : 'Semua RT aktif') + '</span></span>' +
                    '</div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>RT</th><th class="num">Warga</th><th class="num">Saldo kas</th><th class="num">Surat</th><th class="num">Pengaduan</th><th class="num">Eskalasi</th><th>Kesehatan</th><th>Backend / sinkron</th></tr></thead>' +
                    '<tbody>' + (rows || '<tr><td colspan="8"><div class="empty"><i class="fa-solid fa-server"></i><p>Belum ada RT terdaftar.</p></div></td></tr>') + '</tbody></table></div></div>' +
                '</section>';
            setSync(stale.length ? 'Sebagian stale' : 'Tersinkron', stale.length ? 'warn' : 'ok');
            state.dashboardLoadedAt = Date.now();
        }).catch(function (err) {
            pageError(err);
            setSync('Gagal memuat', 'error');
        });
    }

    function renderWarga() {
        var f = state.filters.warga;
        pageLoading('Memuat data warga...');
        ensureDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-users"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            return api('rwList', { rtId: f.rt, sheet: 'Data_Warga', limit: 2000, offset: 0, includeArchived: false }).then(function (res) {
                state.warga = { rows: rowsToObjects(res.headers, res.rows), res: res };
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="warga-rt">' + rtOptions(f.rt) + '</select></div>' +
                        '<div class="field" style="flex:1"><label>Cari</label><span class="search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input class="control" id="warga-q" placeholder="Nama, NIK, KK, HP, atau alamat" value="' + esc(f.q) + '"></span></div>' +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>' + esc(f.rt) + '</h2><p id="warga-count">' + fmtInt(res.total) + ' warga aktif</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>Warga</th><th>NIK</th><th>No HP</th><th>Alamat</th><th>Status</th><th>Pekerjaan</th></tr></thead>' +
                    '<tbody id="warga-body"></tbody></table></div></div></section>';
                paintWarga();
                $('warga-rt').addEventListener('change', function (e) {
                    f.rt = e.target.value; f.q = ''; renderWarga();
                });
                $('warga-q').addEventListener('input', function (e) {
                    f.q = e.target.value;
                    paintWarga();
                });
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function paintWarga() {
        var data = state.warga;
        if (!data) return;
        var f = state.filters.warga;
        var q = String(f.q || '').trim().toLowerCase();
        var filtered = q ? data.rows.filter(function (r) {
            return [r['Nama Lengkap'], r['Nomor KK'], r['NIK'], r['No HP'], r['Alamat/No Rumah'], r['Pekerjaan']]
                .some(function (v) { return String(v || '').toLowerCase().indexOf(q) !== -1; });
        }) : data.rows;
        var body = filtered.map(function (r) {
            return '<tr>' +
                '<td><span class="cell-main">' + esc(r['Nama Lengkap'] || '-') + '</span><span class="cell-sub">KK ' + esc(r['Nomor KK'] || '-') + '</span></td>' +
                '<td class="nowrap">' + esc(r['NIK'] || '-') + '</td>' +
                '<td class="nowrap">' + esc(r['No HP'] || '-') + '</td>' +
                '<td>' + esc(r['Alamat/No Rumah'] || '-') + '</td>' +
                '<td>' + esc(r['Status'] || '-') + '</td>' +
                '<td><span class="cell-main">' + esc(r['Pekerjaan'] || '-') + '</span><span class="cell-sub">' + esc(r['Pendidikan'] || '-') + '</span></td>' +
                '</tr>';
        }).join('');
        var tbody = $('warga-body');
        if (tbody) tbody.innerHTML = body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-users"></i><p>Tidak ada warga yang cocok.</p></div></td></tr>';
        var count = $('warga-count');
        if (count) count.textContent = fmtInt(filtered.length) + ' dari ' + fmtInt(data.res.total) + ' warga aktif';
    }

    function renderKas() {
        var f = state.filters.kas;
        pageLoading('Memuat data kas...');
        ensureDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-wallet"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            return api('rwList', { rtId: f.rt, sheet: 'Iuran_Kas', limit: 2000, offset: 0, includeArchived: true }).then(function (res) {
                var rows = rowsToObjects(res.headers, res.rows);
                var masuk = 0, keluar = 0, aktif = 0;
                rows.forEach(function (r) {
                    if (isArchived(r['Diarsipkan'])) return;
                    aktif++;
                    var jenis = String(r['Jenis Transaksi'] || '').toLowerCase();
                    var nominal = Number(r['Jumlah (Rp)']) || 0;
                    if (jenis === 'pengeluaran' || jenis === 'reversal keluar') keluar += nominal;
                    else masuk += nominal;
                });
                var saldo = (Number(res.saldoAwal) || 0) + masuk - keluar;
                rows.sort(function (a, b) {
                    var da = String(a['Tanggal'] || a['Timestamp'] || '');
                    var db = String(b['Tanggal'] || b['Timestamp'] || '');
                    return db.localeCompare(da);
                });
                var body = rows.map(function (r) {
                    var archived = isArchived(r['Diarsipkan']);
                    var reversal = !isBlank(r['Reversal Dari']);
                    var jenis = String(r['Jenis Transaksi'] || '');
                    var isOut = jenis.toLowerCase() === 'pengeluaran' || jenis.toLowerCase() === 'reversal keluar';
                    return '<tr' + (archived ? ' style="opacity:.55"' : '') + '>' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDate(r['Tanggal'] || r['Timestamp']) + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Warga'] || '-') + '</span><span class="cell-sub">Rumah ' + esc(r['No Rumah'] || '-') + '</span></td>' +
                        '<td>' + esc(jenis || '-') + (reversal ? ' ' + badge('Reversal', 'badge-blue') : '') + (archived ? ' ' + badge('Arsip', 'badge-neutral') : '') + '</td>' +
                        '<td class="num" style="color:' + (isOut ? '#be123c' : '#047857') + '">' + (isOut ? '-' : '+') + ' ' + fmtMoney(r['Jumlah (Rp)']) + '</td>' +
                        '<td>' + esc(r['Keterangan'] || '-') + '</td>' +
                        '</tr>';
                }).join('');
                $('page').innerHTML =
                    '<div class="toolbar"><div class="field"><label>RT</label><select class="control" id="kas-rt">' + rtOptions(f.rt) + '</select></div></div>' +
                    '<div class="grid kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Saldo saat ini</span><span class="kpi-icon"><i class="fa-solid fa-wallet"></i></span></div><p class="kpi-value money">' + fmtMoney(saldo) + '</p><p class="kpi-note">' + fmtInt(aktif) + ' transaksi aktif</p></article>' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Saldo awal</span></div><p class="kpi-value money">' + fmtMoney(res.saldoAwal) + '</p><p class="kpi-note">dasar perhitungan</p></article>' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Pemasukan</span></div><p class="kpi-value money" style="color:#047857">' + fmtMoney(masuk) + '</p><p class="kpi-note">termasuk reversal masuk</p></article>' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Pengeluaran</span></div><p class="kpi-value money" style="color:#be123c">' + fmtMoney(keluar) + '</p><p class="kpi-note">termasuk reversal keluar</p></article>' +
                    '</div><div style="height:16px"></div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Riwayat transaksi</h2><p>Urut tanggal terbaru · arsip tidak dihitung</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>Tanggal</th><th>Warga</th><th>Jenis</th><th class="num">Nominal</th><th>Keterangan</th></tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-wallet"></i><p>Belum ada transaksi.</p></div></td></tr>') + '</tbody></table></div></div></section>';
                $('kas-rt').addEventListener('change', function (e) { f.rt = e.target.value; renderKas(); });
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function renderSurat() {
        var f = state.filters.surat;
        pageLoading('Memuat pengajuan surat...');
        ensureDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-file-signature"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            var payload = { rtId: f.rt, sheet: 'Pengajuan_Surat', limit: 2000, offset: 0, includeArchived: false };
            if (f.status) payload.status = f.status;
            return api('rwList', payload).then(function (res) {
                var rows = rowsToObjects(res.headers, res.rows);
                var body = rows.map(function (r) {
                    return '<tr class="clickable" data-surat="' + esc(r['ID']) + '">' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDate(r['Timestamp']) + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Lengkap Pemohon'] || '-') + '</span><span class="cell-sub">NIK ' + esc(r['NIK'] || '-') + '</span></td>' +
                        '<td>' + esc(r['Jenis Surat'] || '-') + '</td>' +
                        '<td>' + rtSuratBadge(r['Status Pengurusan']) + '</td>' +
                        '<td>' + rwSuratBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap">' + esc(r['No. Surat'] || '-') + '</td>' +
                        '</tr>';
                }).join('');
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="surat-rt">' + rtOptions(f.rt) + '</select></div>' +
                        '<div class="field"><label>Status RW</label><select class="control" id="surat-status">' + statusOptions(f.status, ['', 'Menunggu', 'Disetujui', 'Dikembalikan', 'Ditolak', 'Tidak Perlu'], 'Semua status') + '</select></div>' +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Pengajuan surat</h2><p>' + fmtInt(res.total) + ' pengajuan · klik baris untuk detail</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>Tanggal</th><th>Pemohon</th><th>Jenis surat</th><th>Status RT</th><th>Status RW</th><th>No. surat</th></tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-file-signature"></i><p>Tidak ada pengajuan pada filter ini.</p></div></td></tr>') + '</tbody></table></div></div></section>';
                $('surat-rt').addEventListener('change', function (e) { f.rt = e.target.value; renderSurat(); });
                $('surat-status').addEventListener('change', function (e) { f.status = e.target.value; renderSurat(); });
                document.querySelectorAll('[data-surat]').forEach(function (tr) {
                    tr.addEventListener('click', function () {
                        var id = tr.getAttribute('data-surat');
                        var row = rows.find(function (r) { return String(r['ID']) === String(id); });
                        if (row) openSurat(row);
                    });
                });
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function renderLapor() {
        var f = state.filters.lapor;
        pageLoading('Memuat pengaduan...');
        ensureDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-comment-dots"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            var payload = { rtId: f.rt, sheet: 'Lapor_Aspirasi', limit: 2000, offset: 0, includeArchived: false };
            if (f.status) payload.status = f.status;
            return api('rwList', payload).then(function (res) {
                var rows = rowsToObjects(res.headers, res.rows);
                var body = rows.map(function (r) {
                    return '<tr class="clickable" data-lapor="' + esc(r['ID']) + '">' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDate(r['Timestamp']) + '</span><span class="cell-sub">' + esc(r['No. Pengaduan'] || '') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Warga'] || '-') + '</span><span class="cell-sub">' + esc(r['Alamat / No. Rumah'] || '') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Judul Pengaduan'] || '-') + '</span><span class="cell-sub">' + esc(r['Jenis Pengaduan'] || '') + '</span></td>' +
                        '<td>' + rtLaporBadge(r['Status']) + '</td>' +
                        '<td>' + rwLaporBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap">' + fmtDate(r['Rw Diperbarui']) + '</td>' +
                        '</tr>';
                }).join('');
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="lapor-rt">' + rtOptions(f.rt) + '</select></div>' +
                        '<div class="field"><label>Status RW</label><select class="control" id="lapor-status">' + statusOptions(f.status, ['', 'Perlu Tindak Lanjut', 'Ditangani RW', 'Selesai RW', 'Tidak Perlu'], 'Semua status') + '</select></div>' +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Pengaduan warga</h2><p>' + fmtInt(res.total) + ' pengaduan · klik baris untuk detail</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>Tanggal / nomor</th><th>Warga</th><th>Pengaduan</th><th>Status RT</th><th>Status RW</th><th>Diperbarui</th></tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-comment-dots"></i><p>Tidak ada pengaduan pada filter ini.</p></div></td></tr>') + '</tbody></table></div></div></section>';
                $('lapor-rt').addEventListener('change', function (e) { f.rt = e.target.value; renderLapor(); });
                $('lapor-status').addEventListener('change', function (e) { f.status = e.target.value; renderLapor(); });
                document.querySelectorAll('[data-lapor]').forEach(function (tr) {
                    tr.addEventListener('click', function () {
                        var id = tr.getAttribute('data-lapor');
                        var row = rows.find(function (r) { return String(r['ID']) === String(id); });
                        if (row) openLapor(row);
                    });
                });
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function statusOptions(selected, values, allLabel) {
        return values.map(function (v) {
            return '<option value="' + esc(v) + '"' + (String(selected || '') === v ? ' selected' : '') + '>' + esc(v || allLabel) + '</option>';
        }).join('');
    }

    function detailRow(label, value) {
        return '<div class="detail-row"><dt>' + esc(label) + '</dt><dd>' + (value === undefined || value === null || value === '' ? '-' : value) + '</dd></div>';
    }

    function openDrawer(eyebrow, title, html) {
        $('drawer-eyebrow').textContent = eyebrow;
        $('drawer-title').textContent = title;
        $('drawer-body').innerHTML = html;
        $('drawer').classList.remove('hidden');
        document.body.classList.add('drawer-open');
    }
    function closeDrawer() {
        $('drawer').classList.add('hidden');
        document.body.classList.remove('drawer-open');
    }

    function suratActionPanel(r, rtId) {
        var status = String(r['Rw Status'] || 'Tidak Perlu');
        var revisi = Number(r['Rw Revisi'] || 0) || 0;
        var versi = Number(r['Rw Versi'] || 1) || 1;
        if (!isAdmin()) {
            return '<div class="drawer-section"><h3>Tindakan RW</h3>' +
                '<div class="notice notice-info" style="margin:0"><i class="fa-solid fa-eye"></i><div>Anda masuk sebagai <strong>RW Viewer</strong>. Keputusan surat hanya dapat dilakukan RW Admin.</div></div></div>';
        }
        if (status !== 'Menunggu') {
            return '<div class="drawer-section"><h3>Tindakan RW</h3>' +
                '<div class="notice notice-info" style="margin:0"><i class="fa-solid fa-circle-info"></i><div>Tidak ada keputusan yang menunggu. Status RW saat ini <strong>' + esc(status) + '</strong>.</div></div></div>';
        }
        var maxNeg = revisi >= 3;
        return '<div class="drawer-section action-panel">' +
            '<h3>Tindakan RW</h3>' +
            '<p class="action-current">' + esc(rtLabel(rtId)) + ' · revisi negatif ' + fmtInt(revisi) + ' dari 3 · versi data ' + fmtInt(versi) + '</p>' +
            '<div class="field"><label for="surat-catatan">Catatan keputusan</label>' +
            '<textarea id="surat-catatan" class="control textarea" maxlength="1000" rows="4" placeholder="Wajib untuk Dikembalikan atau Ditolak"></textarea>' +
            '<p class="form-hint">Catatan minimal 3 karakter untuk keputusan negatif. Keputusan dikirim ke RT tujuan.</p></div>' +
            '<div class="action-buttons">' +
            '<button type="button" class="btn btn-primary" id="surat-approve"><i class="fa-solid fa-circle-check"></i> Setujui</button>' +
            '<button type="button" class="btn btn-blue" id="surat-return"' + (maxNeg ? ' disabled title="Batas 3 keputusan negatif tercapai"' : '') + '><i class="fa-solid fa-arrow-right"></i> Kembalikan</button>' +
            '<button type="button" class="btn btn-danger" id="surat-reject"' + (maxNeg ? ' disabled title="Batas 3 keputusan negatif tercapai"' : '') + '><i class="fa-solid fa-circle-exclamation"></i> Tolak</button>' +
            '</div>' +
            (maxNeg ? '<p class="form-hint" style="margin-top:8px">Batas 3 keputusan negatif sudah tercapai. Hanya persetujuan yang tersedia.</p>' : '') +
            '</div>';
    }

    function setSuratActionBusy(r, busy) {
        var approve = $('surat-approve');
        if (approve) approve.disabled = busy;
        var maxNeg = (Number(r['Rw Revisi'] || 0) || 0) >= 3;
        ['surat-return', 'surat-reject'].forEach(function (id) {
            var btn = $(id);
            if (btn) btn.disabled = busy || maxNeg;
        });
    }

    function bindSuratActions(r, rtId) {
        if (!isAdmin()) return;
        [['surat-approve', 'Disetujui'], ['surat-return', 'Dikembalikan'], ['surat-reject', 'Ditolak']].forEach(function (pair) {
            var btn = $(pair[0]);
            if (!btn || btn.disabled) return;
            btn.addEventListener('click', function () { submitSuratDecision(r, rtId, pair[1]); });
        });
    }

    function submitSuratDecision(r, rtId, decision) {
        if (state.actionBusy) return;
        var noteEl = $('surat-catatan');
        var note = noteEl ? String(noteEl.value || '').trim() : '';
        var revisi = Number(r['Rw Revisi'] || 0) || 0;
        if (decision !== 'Disetujui' && note.length < 3) {
            toast('Catatan wajib diisi minimal 3 karakter untuk keputusan ' + decision + '.', 'error');
            if (noteEl && noteEl.focus) noteEl.focus();
            return;
        }
        if (decision !== 'Disetujui' && revisi >= 3) {
            toast('Batas 3 keputusan negatif sudah tercapai.', 'error');
            return;
        }
        var tone = decision === 'Disetujui' ? 'primary' : decision === 'Dikembalikan' ? 'blue' : 'danger';
        var icon = decision === 'Disetujui' ? 'fa-circle-check' : decision === 'Dikembalikan' ? 'fa-arrow-right' : 'fa-circle-exclamation';
        var message = '<p><strong>' + esc(r['Nama Lengkap Pemohon'] || '-') + '</strong> · ' + esc(r['Jenis Surat'] || '-') + '</p>' +
            '<div class="warning-summary">' +
                '<p>Keputusan: <strong>' + esc(decision) + '</strong></p>' +
                '<p>Catatan: ' + (note ? escLines(note) : '-') + '</p>' +
                '<p>RT: ' + esc(rtLabel(rtId)) + '</p>' +
            '</div>' +
            '<p class="modal-note">' + (decision === 'Disetujui'
                ? 'Pengajuan akan disetujui dan dapat diselesaikan oleh RT.'
                : 'RT akan menerima catatan dan dapat memperbaiki lalu mengajukan ulang.') + '</p>';
        openWarning({
            eyebrow: 'Keputusan pengajuan surat',
            title: decision === 'Disetujui' ? 'Setujui pengajuan surat?' : decision === 'Dikembalikan' ? 'Kembalikan pengajuan surat?' : 'Tolak pengajuan surat?',
            message: message,
            tone: tone,
            icon: icon,
            confirmIcon: icon,
            confirmLabel: decision === 'Disetujui' ? 'Ya, Setujui' : decision === 'Dikembalikan' ? 'Ya, Kembalikan' : 'Ya, Tolak',
            onConfirm: function () { performSuratDecision(r, rtId, decision, note); }
        });
    }

    function performSuratDecision(r, rtId, decision, note) {
        state.actionBusy = true;
        setSuratActionBusy(r, true);
        var versi = Number(r['Rw Versi'] || 1) || 1;
        var kunci = makeKunci('SRT', [rtId, r['ID'], versi, decision, note]);
        api('rwSuratDecision', {
            rtId: rtId,
            id: r['ID'],
            decision: decision,
            catatan: note,
            expectedVersi: versi,
            kunci: kunci
        }).then(function (res) {
            state.actionBusy = false;
            closeDrawer();
            state.dashboard = null;
            state.dashboardLoadedAt = 0;
            renderers[state.page]();
            toast(res && res.queued
                ? 'Keputusan tersimpan. Pengiriman ke RT akan dicoba ulang otomatis.'
                : 'Keputusan berhasil dikirim ke RT.', 'success');
        }).catch(function (err) {
            state.actionBusy = false;
            setSuratActionBusy(r, false);
            if (err.code === 'stale' || err.code === 'not_pending') {
                closeDrawer();
                state.dashboard = null;
                state.dashboardLoadedAt = 0;
                renderers[state.page]();
                toast(err.message || 'Data sudah berubah. Daftar dimuat ulang.', 'error');
                return;
            }
            if (isAmbiguousWriteError(err)) {
                closeDrawer();
                state.dashboard = null;
                state.dashboardLoadedAt = 0;
                renderers[state.page]();
                toast('Koneksi ke gateway terputus. Data dimuat ulang; periksa status sebelum mencoba lagi.', 'error');
                return;
            }
            toast(err.message || 'Keputusan gagal dikirim.', 'error');
        });
    }

    function laporActionPanel(r) {
        var status = String(r['Rw Status'] || 'Tidak Perlu');
        if (!isAdmin()) {
            return '<div class="drawer-section"><h3>Tindakan RW</h3>' +
                '<div class="notice notice-info" style="margin:0"><i class="fa-solid fa-eye"></i><div>Anda masuk sebagai <strong>RW Viewer</strong>. Tanggapan pengaduan hanya dapat dikirim RW Admin.</div></div></div>';
        }
        var suggested = (status === 'Tidak Perlu' || status === 'Perlu Tindak Lanjut') ? 'Ditangani RW' : '';
        return '<div class="drawer-section action-panel">' +
            '<h3>Tindakan RW</h3>' +
            '<p class="action-current">Status saat ini: ' + rwLaporBadge(status) + '</p>' +
            '<div class="form-grid">' +
                '<div class="field"><label for="lapor-action-status">Status setelah tanggapan</label>' +
                '<select id="lapor-action-status" class="control">' +
                    '<option value="">Pertahankan status</option>' +
                    '<option value="Ditangani RW"' + (suggested === 'Ditangani RW' ? ' selected' : '') + '>Ditangani RW</option>' +
                    '<option value="Selesai RW">Selesai RW</option>' +
                '</select></div>' +
                '<div class="field"><label for="lapor-visibility">Visibilitas</label>' +
                '<select id="lapor-visibility" class="control">' +
                    '<option value="Publik">Publik</option>' +
                    '<option value="Internal">Internal</option>' +
                '</select><p class="form-hint">Internal hanya terlihat pengurus RW.</p></div>' +
            '</div>' +
            '<div class="field"><label for="lapor-catatan">Catatan tindak lanjut</label>' +
            '<textarea id="lapor-catatan" class="control textarea" maxlength="1000" rows="4" placeholder="Tuliskan tindak lanjut RW..."></textarea>' +
            '<p class="form-hint">Wajib minimal 3 karakter. Tanggapan Publik juga tampil di portal warga.</p></div>' +
            '<div class="action-buttons"><button type="button" class="btn btn-primary" id="lapor-submit"><i class="fa-solid fa-paper-plane"></i> Kirim tanggapan</button></div>' +
            '</div>';
    }

    function bindLaporActions(r, rtId) {
        var btn = $('lapor-submit');
        if (!btn) return;
        btn.addEventListener('click', function () { submitLaporNote(r, rtId); });
    }

    function submitLaporNote(r, rtId) {
        if (state.actionBusy) return;
        var noteEl = $('lapor-catatan');
        var statusEl = $('lapor-action-status');
        var visEl = $('lapor-visibility');
        var note = noteEl ? String(noteEl.value || '').trim() : '';
        var status = statusEl ? String(statusEl.value || '') : '';
        var visibilitas = visEl ? String(visEl.value || 'Publik') : 'Publik';
        if (note.length < 3) {
            toast('Catatan tindak lanjut wajib diisi minimal 3 karakter.', 'error');
            if (noteEl && noteEl.focus) noteEl.focus();
            return;
        }
        var current = String(r['Rw Status'] || 'Tidak Perlu');
        var next = status || ((current === 'Tidak Perlu' || current === 'Perlu Tindak Lanjut') ? 'Ditangani RW' : current);
        var statusLabel = status || ((current === 'Tidak Perlu' || current === 'Perlu Tindak Lanjut') ? 'Ditangani RW (otomatis)' : 'Tetap ' + current);
        openWarning({
            eyebrow: 'Tanggapan pengaduan',
            title: 'Kirim tanggapan RW?',
            message: '<p><strong>' + esc(r['Nama Warga'] || '-') + '</strong> · ' + esc(r['Judul Pengaduan'] || '-') + '</p>' +
                '<div class="warning-summary">' +
                    '<p>Status: ' + esc(current) + ' → <strong>' + esc(statusLabel) + '</strong></p>' +
                    '<p>Visibilitas: <strong>' + esc(visibilitas) + '</strong></p>' +
                    '<p>Catatan: ' + escLines(note) + '</p>' +
                    '<p>RT: ' + esc(rtLabel(rtId)) + '</p>' +
                '</div>' +
                '<p class="modal-note">' + (visibilitas === 'Publik'
                    ? 'Tanggapan Publik akan terlihat pada status pengaduan warga.'
                    : 'Tanggapan Internal hanya tersimpan untuk pengurus RW.') + '</p>',
            tone: status === 'Selesai RW' ? 'primary' : 'blue',
            icon: 'fa-paper-plane',
            confirmIcon: 'fa-paper-plane',
            confirmLabel: 'Ya, Kirim',
            onConfirm: function () { performLaporNote(r, rtId, note, status, visibilitas); }
        });
    }

    function performLaporNote(r, rtId, note, status, visibilitas) {
        state.actionBusy = true;
        var btn = $('lapor-submit');
        if (btn) btn.disabled = true;
        var expected = r['Rw Diperbarui'];
        var payload = {
            rtId: rtId,
            id: r['ID'],
            catatan: note,
            visibilitas: visibilitas,
            kunci: makeKunci('LPR', [rtId, r['ID'], expected, status, visibilitas, note])
        };
        if (status) payload.status = status;
        if (!isBlank(expected)) payload.expectedDiperbarui = expected;
        api('rwLaporNote', payload).then(function (res) {
            state.actionBusy = false;
            closeDrawer();
            state.dashboard = null;
            state.dashboardLoadedAt = 0;
            renderers[state.page]();
            toast(res && res.queued
                ? 'Tanggapan tersimpan. Pengiriman ke RT akan dicoba ulang otomatis.'
                : 'Tanggapan RW berhasil dikirim.', 'success');
        }).catch(function (err) {
            state.actionBusy = false;
            if (btn) btn.disabled = false;
            if (err.code === 'stale') {
                closeDrawer();
                state.dashboard = null;
                state.dashboardLoadedAt = 0;
                renderers[state.page]();
                toast(err.message || 'Pengaduan sudah berubah. Daftar dimuat ulang.', 'error');
                return;
            }
            if (isAmbiguousWriteError(err)) {
                closeDrawer();
                state.dashboard = null;
                state.dashboardLoadedAt = 0;
                renderers[state.page]();
                toast('Koneksi ke gateway terputus. Data dimuat ulang; periksa riwayat sebelum mengirim ulang.', 'error');
                return;
            }
            toast(err.message || 'Tanggapan gagal dikirim.', 'error');
        });
    }

    function openSurat(r) {
        var rtId = state.filters.surat.rt;
        var html = '<div class="drawer-section"><h3>Pemohon</h3><dl class="detail-list">' +
            detailRow('Nama', esc(r['Nama Lengkap Pemohon'])) +
            detailRow('NIK', esc(r['NIK'])) +
            detailRow('No. HP', esc(r['No. HP / WhatsApp'])) +
            detailRow('Alamat', esc(r['Alamat / No. Rumah'])) +
            '</dl></div>' +
            '<div class="drawer-section"><h3>Pengajuan</h3><dl class="detail-list">' +
            detailRow('Jenis surat', esc(r['Jenis Surat'])) +
            detailRow('Keperluan', esc(r['Keperluan / Alasan Pengajuan'])) +
            detailRow('Status RT', rtSuratBadge(r['Status Pengurusan'])) +
            detailRow('No. surat', esc(r['No. Surat'] || '-')) +
            detailRow('Tanggal selesai', fmtDate(r['Tanggal Selesai'])) +
            detailRow('Catatan RT', esc(r['Catatan Pengurus'] || '-')) +
            '</dl></div>' +
            '<div class="drawer-section"><h3>Keputusan RW</h3><dl class="detail-list">' +
            detailRow('Status RW', rwSuratBadge(r['Rw Status'])) +
            detailRow('Catatan RW', esc(r['Rw Catatan'] || '-')) +
            detailRow('Oleh', esc(r['Rw Oleh'] || '-')) +
            detailRow('Tanggal', fmtDate(r['Rw Tanggal'])) +
            detailRow('Revisi / versi', esc((r['Rw Revisi'] || 0) + ' / ' + (r['Rw Versi'] || 1))) +
            '</dl></div>' +
            suratActionPanel(r, rtId);
        openDrawer('Pengajuan surat · ' + (r['ID'] || ''), r['Jenis Surat'] || 'Detail pengajuan', html);
        bindSuratActions(r, rtId);
    }

    function openLapor(r) {
        var laporId = r['ID'];
        var rtId = state.filters.lapor.rt;
        openDrawer('Pengaduan · ' + (r['No. Pengaduan'] || laporId || ''), r['Judul Pengaduan'] || 'Detail pengaduan',
            '<div class="drawer-section"><h3>Pengaduan</h3><dl class="detail-list">' +
            detailRow('No. pengaduan', esc(r['No. Pengaduan'])) +
            detailRow('Warga', esc(r['Nama Warga'])) +
            detailRow('No. HP', esc(r['No. HP / WhatsApp'])) +
            detailRow('Alamat', esc(r['Alamat / No. Rumah'])) +
            detailRow('Jenis', esc(r['Jenis Pengaduan'])) +
            detailRow('Lokasi', esc(r['Lokasi Kejadian'] || '-')) +
            detailRow('Tanggal kejadian', fmtDate(r['Tanggal Kejadian'])) +
            detailRow('Detail', esc(r['Detail Pengaduan'] || '-')) +
            detailRow('Harapan', esc(r['Harapan / Solusi'] || '-')) +
            '</dl></div>' +
            '<div class="drawer-section"><h3>Status</h3><dl class="detail-list">' +
            detailRow('Status RT', rtLaporBadge(r['Status'])) +
            detailRow('Catatan RT', esc(r['Catatan Tindak Lanjut'] || '-')) +
            detailRow('Status RW', rwLaporBadge(r['Rw Status'])) +
            detailRow('Petugas RW', esc(r['Rw Petugas'] || '-')) +
            detailRow('Diperbarui', fmtDate(r['Rw Diperbarui'])) +
            '</dl></div>' +
            laporActionPanel(r) +
            '<div class="drawer-section"><h3>Riwayat tindak lanjut RW</h3><div id="lapor-timeline" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i>Memuat riwayat...</div></div>');
        bindLaporActions(r, rtId);
        if (!laporId) {
            $('lapor-timeline').innerHTML = '<div class="empty"><i class="fa-solid fa-clock-rotate-left"></i><p>Riwayat tidak tersedia.</p></div>';
            return;
        }
        api('rwList', { rtId: rtId, sheet: 'Lapor_Tindak_Lanjut', laporId: laporId, limit: 200, offset: 0 }).then(function (res) {
            var items = rowsToObjects(res.headers, res.rows);
            var el = $('lapor-timeline');
            if (!el) return;
            if (!items.length) {
                el.innerHTML = '<div class="empty"><i class="fa-solid fa-clock-rotate-left"></i><p>Belum ada tanggapan RW.</p></div>';
                return;
            }
            el.innerHTML = '<div class="timeline">' + items.map(function (it) {
                var vis = String(it['Visibilitas'] || '');
                var visBadge = vis === 'Internal' ? badge('Internal', 'badge-neutral', 'fa-lock') : badge('Publik', 'badge-blue', 'fa-globe');
                return '<article class="timeline-item">' +
                    '<p class="timeline-meta">' + fmtDate(it['Waktu']) + ' · ' + esc(it['Aktor'] || '-') + ' · ' + esc(it['Peran'] || '-') + ' ' + visBadge + '</p>' +
                    '<p class="timeline-text">' + esc(it['Catatan'] || '-') + '</p>' +
                    '<p class="timeline-meta" style="margin-top:4px">Status: ' + esc(it['Status'] || '-') + '</p>' +
                    '</article>';
            }).join('') + '</div>';
        }).catch(function (err) {
            var el = $('lapor-timeline');
            if (el) el.innerHTML = '<div class="notice notice-error"><i class="fa-solid fa-circle-exclamation"></i><div>' + esc(err.message || 'Gagal memuat riwayat.') + '</div></div>';
        });
    }

    var renderers = { dashboard: renderDashboard, warga: renderWarga, kas: renderKas, surat: renderSurat, lapor: renderLapor };

    function navigate(page) {
        if (!renderers[page]) page = 'dashboard';
        state.page = page;
        closeDrawer();
        renderChrome();
        renderers[page]();
    }

    function refresh() {
        if (state.busy) return;
        state.busy = true;
        var btn = $('refresh-btn');
        if (btn) btn.disabled = true;
        setSync('Menyegarkan', '');
        api('rwRefresh').then(function () {
            state.dashboard = null;
            state.dashboardLoadedAt = 0;
            return ensureDashboard(true);
        }).then(function () {
            renderers[state.page]();
            toast('Data RW berhasil disegarkan.', 'success');
        }).catch(function (err) {
            toast(err.message || 'Gagal menyegarkan data.', 'error');
            setSync('Gagal menyegarkan', 'error');
        }).then(function () {
            state.busy = false;
            if (btn) btn.disabled = false;
        });
    }

    function bindGlobal() {
        document.querySelectorAll('.nav-item').forEach(function (btn) {
            btn.addEventListener('click', function () { navigate(btn.getAttribute('data-page')); });
        });
        $('refresh-btn').addEventListener('click', refresh);
        $('access-retry').addEventListener('click', function () { location.reload(); });
        $('menu-btn').addEventListener('click', function () { $('sidebar').classList.add('open'); });
        $('sidebar-close').addEventListener('click', function () { $('sidebar').classList.remove('open'); });
        $('toast-close').addEventListener('click', function () { $('toast').classList.add('hidden'); });
        var warningCancel = $('warning-cancel');
        if (warningCancel) warningCancel.addEventListener('click', closeWarning);
        var warningClose = $('warning-close');
        if (warningClose) warningClose.addEventListener('click', closeWarning);
        var warningBackdrop = $('warning-backdrop');
        if (warningBackdrop) warningBackdrop.addEventListener('click', closeWarning);
        var warningConfirm = $('warning-confirm');
        if (warningConfirm) warningConfirm.addEventListener('click', runWarningConfirm);
        document.querySelectorAll('[data-close-drawer]').forEach(function (el) {
            el.addEventListener('click', closeDrawer);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var modal = $('modal-warning');
                if (modal && !modal.classList.contains('hidden')) { closeWarning(); return; }
                closeDrawer();
                $('sidebar').classList.remove('open');
            }
        });
        document.addEventListener('click', function (e) {
            var retry = e.target.closest('[data-retry]');
            if (retry) { renderers[state.page](); }
        });
        var page = $('page');
        page.addEventListener('click', function (e) {
            var rtRow = e.target.closest('tr[data-rt]');
            if (rtRow) {
                state.filters.warga.rt = rtRow.getAttribute('data-rt');
                navigate('warga');
            }
        });
    }

    function boot() {
        bindGlobal();
        $('build-info').textContent = 'Portal build ' + BUILD;
        api('rwSession').then(function (res) {
            state.session = res;
            showApp();
            renderChrome();
            navigate('dashboard');
        }).catch(function (err) {
            if (err.code === 'unauthorized') {
                showAccess('Verifikasi Cloudflare Access gagal (' + (err.message || 'JWT tidak valid') + '). Periksa CF_ACCESS_TEAM_DOMAIN dan CF_ACCESS_AUD pada environment gateway, lalu deploy ulang.');
            } else if (err.code === 'forbidden') {
                showAccess('Akun ' + (getDevEmail() || 'Anda') + ' belum terdaftar sebagai pengguna RW. ' + (err.message || ''));
            } else {
                showAccess(err.message || 'Gagal memeriksa akses ke portal RW.');
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
