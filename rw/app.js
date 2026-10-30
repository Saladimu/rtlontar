/* RW 06 portal. No secrets are stored in the browser. */
(function () {
    'use strict';

    var BUILD = '2026-10-30-01';
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var TZ = 'Asia/Jakarta';
    var PAGE_META = {
        dashboard: ['Ringkasan', 'Kondisi terkini seluruh RT'],
        warga: ['Data Warga', 'Daftar warga per RT'],
        kas: ['Kas RT', 'Saldo dan riwayat transaksi per RT'],
        surat: ['Pengajuan Surat', 'Antrean dan keputusan RW'],
        lapor: ['Pengaduan', 'Tindak lanjut RW atas aspirasi warga'],
        pengguna: ['Pengguna RW', 'Akses portal dan peran pengurus'],
        registry: ['Registry RT', 'Daftar RT, alamat, dan endpoint'],
        pengaturan: ['Pengaturan', 'Parameter operasional sistem'],
        outbox: ['Outbox', 'Antrean pengiriman ke RT'],
        audit: ['Audit', 'Riwayat tindakan pengurus RW']
    };
    var PAGE_SIZE = 10;

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
        prefetched: false,
        dashboardLoadedAt: 0,
        pages: { warga: 1, kas: 1, surat: 1, lapor: 1, pengguna: 1, registry: 1, pengaturan: 1, outbox: 1, audit: 1 }
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
    // Nilai waktu dari orkestrator disimpan sebagai ISO/UTC, sedangkan RT
    // menyimpan waktu lokal Asia/Jakarta. Keduanya dinormalkan ke GMT+7 agar
    // Audit, Pengaturan, Pengguna RW, surat, dan pengaduan menampilkan jam yang
    // sama dengan yang dilihat pengurus.
    function jakartaParts(value) {
        var s = String(value);
        if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) || !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return null;
        var d = new Date(s);
        if (isNaN(d.getTime())) return null;
        try {
            var parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false
            }).formatToParts(d);
            var out = {};
            parts.forEach(function (p) { out[p.type] = p.value; });
            if (out.hour === '24') out.hour = '00';
            return out;
        } catch (e) {
            return null;
        }
    }
    function fmtStamp(value) {
        if (isBlank(value)) return '-';
        var s = String(value);
        var j = jakartaParts(s);
        if (j) {
            var t = j.year + '-' + j.month + '-' + j.day;
            if (j.hour !== undefined) t += ' ' + j.hour + ':' + j.minute;
            return t.slice(8, 10) + '-' + MONTHS[Number(t.slice(5, 7)) - 1] + '-' + t.slice(0, 4) + t.slice(10);
        }
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
        if (!m) return esc(s);
        var out = m[3] + '-' + MONTHS[Number(m[2]) - 1] + '-' + m[1];
        if (m[4]) out += ' ' + m[4] + (m[5] ? ':' + m[5] : '');
        return out;
    }
    function fmtDate(value) {
        return fmtStamp(value);
    }
    // Tanggal saja (DD-Mmm-YYYY) untuk kolom daftar surat, pengaduan, dan kas.
    function fmtDay(value) {
        var full = fmtStamp(value);
        return /^\d{2}-[A-Z][a-z]{2}-\d{4}/.test(full) ? full.slice(0, 11) : full;
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

    var API_TIMEOUT_MS = 25000;
    var READ_ACTIONS = {
        rwSession: true, rwDashboard: true, rwList: true, rwAuditList: true, rwOutboxList: true,
        rwUsersList: true, rwRegistryList: true, rwSettingsGet: true, rwRtHealth: true
    };
    // Baca data disimpan sebentar di memori agar berpindah menu tidak selalu
    // menunggu orkestrator + Web App RT. Tombol Segarkan (rwRefresh) dan aksi
    // tulis membersihkan cache ini, jadi data tetap bisa dipaksa terbaru.
    var READ_TTL_MS = {
        rwList: 60000,
        rwUsersList: 60000,
        rwRegistryList: 60000,
        rwSettingsGet: 60000,
        rwAuditList: 20000,
        rwOutboxList: 20000,
        rwRtHealth: 0
    };
    var readCache = {};
    var inflight = {};

    function apiKey(action, payload) {
        return action + '|' + JSON.stringify(payload || {});
    }

    function cacheLookup(action, payload) {
        var entry = readCache[apiKey(action, payload)];
        if (!entry) return null;
        var ttl = READ_TTL_MS[action];
        if (ttl === undefined) ttl = 30000;
        if (ttl <= 0 || Date.now() - entry.at > ttl) return null;
        return entry.data;
    }

    // Apakah data masih tersedia di cache (termasuk yang sudah lewat TTL)?
    // Dipakai hanya untuk memutuskan perlu menampilkan indikator memuat.
    function apiPeek(action, payload) {
        if (cacheLookup(action, payload)) return true;
        var entry = readCache[apiKey(action, payload)];
        if (!entry || READ_TTL_MS[action] === 0) return false;
        return Date.now() - entry.at < READ_CACHE_MAX_MS;
    }

    function clearReadCache() {
        readCache = {};
        state.dashboard = null;
        state.dashboardLoadedAt = 0;
        dashboardPromise = null;
    }

    // Umur maksimum entri cache. Setelah TTL, data lama tetap ditampilkan
    // seketika (stale-while-revalidate) lalu diperbarui di latar belakang.
    var READ_CACHE_MAX_MS = 10 * 60 * 1000;

    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    function isRetryableReadError(err) {
        var code = String((err && err.code) || '');
        return code === 'network' || code === 'timeout' || code === 'upstream_unreachable' ||
            code === 'upstream_error' || code === 'upstream_invalid' || /^http_5\d\d$/.test(code);
    }

    // Gabungkan permintaan baca identik yang berjalan bersamaan agar satu klik
    // tidak memicu dashboard/list berkali-kali saat pengguna berpindah cepat.
    // Opsi { fresh: true } melewati cache memori (dipakai saat data wajib baru).
    function api(action, payload, options) {
        if (!READ_ACTIONS[action]) return apiOnce(action, payload, 0);
        var opts = options || {};
        var key = apiKey(action, payload);
        if (!opts.fresh) {
            var cached = cacheLookup(action, payload);
            if (cached) return Promise.resolve(cached);
            // Data lama (masih dalam batas maksimum) langsung dipakai agar
            // perpindahan menu tidak menunggu jaringan; pembaruan berjalan
            // di latar belakang dan halaman aktif digambar ulang bila berubah.
            var stale = readCache[key];
            var reusable = stale && READ_TTL_MS[action] !== 0 &&
                Date.now() - stale.at < READ_CACHE_MAX_MS;
            if (reusable) {
                revalidate(action, payload);
                return Promise.resolve(stale.data);
            }
        }
        if (inflight[key]) return inflight[key];
        var promise = apiOnce(action, payload, 1).then(function (data) {
            if (READ_TTL_MS[action] !== 0) readCache[key] = { at: Date.now(), data: data };
            return data;
        });
        inflight[key] = promise;
        var clear = function () { if (inflight[key] === promise) delete inflight[key]; };
        promise.then(clear, clear);
        return promise;
    }

    // Ambil ulang satu permintaan baca di latar belakang. Bila hasilnya
    // berbeda, halaman yang sedang tampil digambar ulang memakai cache baru
    // (render berikutnya membaca cache sehingga tidak memicu permintaan lain).
    function revalidate(action, payload) {
        var key = apiKey(action, payload);
        if (inflight[key]) return inflight[key];
        var promise = apiOnce(action, payload, 0).then(function (data) {
            var before = readCache[key] ? JSON.stringify(readCache[key].data) : '';
            readCache[key] = { at: Date.now(), data: data };
            if (action === 'rwDashboard') {
                state.dashboard = data;
                state.dashboardLoadedAt = Date.now();
            }
            if (JSON.stringify(data) !== before) {
                var renderer = renderers[state.page];
                if (renderer) renderer();
            }
            return data;
        }, function () {
            // Gagal memperbarui di latar belakang: data lama tetap dipakai.
        });
        inflight[key] = promise;
        var clear = function () { if (inflight[key] === promise) delete inflight[key]; };
        promise.then(clear, clear);
        return promise;
    }

    function apiOnce(action, payload, retriesLeft) {
        var headers = { 'Content-Type': 'application/json' };
        var devEmail = getDevEmail();
        if (devEmail) headers['X-RW-Dev-Email'] = devEmail;
        var body = Object.assign({ action: action }, payload || {});
        var options = { method: 'POST', headers: headers, body: JSON.stringify(body) };
        var timer = null;
        var controller = null;
        if (typeof AbortController !== 'undefined') {
            controller = new AbortController();
            options.signal = controller.signal;
            timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
        }
        function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
        return Promise.resolve()
            .then(function () { return fetch('/api', options); })
            .then(function (res) {
                return res.text().then(function (text) {
                    clearTimer();
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
                }, function (err) { clearTimer(); throw err; });
            })
            .catch(function (err) {
                clearTimer();
                if (err && err.name === 'AbortError') {
                    var timeoutErr = new Error('Gateway RW tidak merespons dalam ' + Math.round(API_TIMEOUT_MS / 1000) + ' detik.');
                    timeoutErr.code = 'timeout';
                    err = timeoutErr;
                } else if (err && !err.code && String(err.message || '') === 'Failed to fetch') {
                    var netErr = new Error('Tidak dapat menghubungi gateway RW.');
                    netErr.code = 'network';
                    err = netErr;
                } else if (err && !err.code && /network|fetch|load failed/i.test(String(err.message || ''))) {
                    var netErr2 = new Error('Tidak dapat menghubungi gateway RW.');
                    netErr2.code = 'network';
                    err = netErr2;
                }
                if (retriesLeft > 0 && isRetryableReadError(err)) {
                    return delay(500).then(function () { return apiOnce(action, payload, retriesLeft - 1); });
                }
                if (!err.code) err.code = 'network';
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
        $('build-info').textContent = 'Portal build ' + BUILD + ' · ' + (state.session && state.session.version ? state.session.version : 'sistem');
    }

    function renderChrome() {
        var meta = PAGE_META[state.page] || PAGE_META.dashboard;
        $('page-title').textContent = meta[0];
        $('page-subtitle').textContent = meta[1];
        var admin = isAdmin();
        document.querySelectorAll('.nav-item').forEach(function (btn) {
            var page = btn.getAttribute('data-page');
            btn.classList.toggle('active', page === state.page);
            if (isAdminPage(page)) {
                btn.disabled = !admin;
                btn.setAttribute('aria-disabled', admin ? 'false' : 'true');
                if (admin) btn.removeAttribute('title');
                else btn.setAttribute('title', 'Hanya RW Admin');
            }
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

    var dashboardPromise = null;

    // Untuk halaman daftar, dashboard yang sudah ada cukup dipakai agar
    // perpindahan menu tidak menunggu pembaruan ringkasan. Hanya bila belum
    // pernah ada data sama sekali kita menunggu permintaan dashboard.
    function readyDashboard() {
        if (state.dashboard) return Promise.resolve(state.dashboard);
        return ensureDashboard();
    }

    function ensureDashboard(force) {
        var fresh = state.dashboard && (Date.now() - state.dashboardLoadedAt < 60000);
        if (state.dashboard && fresh && !force) return Promise.resolve(state.dashboard);
        if (dashboardPromise) return dashboardPromise;
        dashboardPromise = api('rwDashboard', null, { fresh: !!force }).then(function (res) {
            dashboardPromise = null;
            state.dashboard = res;
            state.dashboardLoadedAt = Date.now();
            return res;
        }, function (err) {
            dashboardPromise = null;
            throw err;
        });
        return dashboardPromise;
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

    function sortByTimeDesc(rows, field) {
        var key = field || 'Timestamp';
        return rows.slice().sort(function (a, b) {
            return String(b[key] || '').localeCompare(String(a[key] || ''));
        });
    }

    // Potong daftar panjang menjadi 10 baris per layar dan sediakan navigasi
    // halaman. Data tetap diambil sekali agar filter/pencarian tidak memicu
    // permintaan baru ke orkestrator.
    function pageSlice(rows, key) {
        var list = rows || [];
        var pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        var current = Math.min(Math.max(Number(state.pages[key]) || 1, 1), pages);
        state.pages[key] = current;
        var start = (current - 1) * PAGE_SIZE;
        return {
            rows: list.slice(start, start + PAGE_SIZE),
            total: list.length,
            page: current,
            pages: pages,
            start: list.length ? start + 1 : 0,
            end: Math.min(start + PAGE_SIZE, list.length)
        };
    }

    // Muat data halaman utama di latar belakang sekali setelah dashboard siap,
    // sehingga klik menu pertama langsung tampil dari cache memori. Prefetch
    // sengaja menunggu dashboard agar tidak berebut kuota Apps Script RT:
    // dashboard lebih dulu selesai, baru daftar diambil satu per satu.
    function prefetchPages() {
        if (!state.session) return;
        var rtId = defaultRt();
        if (!rtId) {
            // dashboard belum ada: tunggu sekali, lalu pakai RT pertama.
            readyDashboard().then(function () {
                if (state.session && !state.prefetched) {
                    state.prefetched = true;
                    prefetchPages();
                }
            }, function () {});
            return;
        }
        state.prefetched = true;
        var jobs = [
            { rtId: rtId, sheet: 'Data_Warga', limit: 2000, offset: 0, includeArchived: false },
            { rtId: rtId, sheet: 'Pengajuan_Surat', limit: 2000, offset: 0, includeArchived: false },
            { rtId: rtId, sheet: 'Lapor_Aspirasi', limit: 2000, offset: 0, includeArchived: false },
            { rtId: rtId, sheet: 'Iuran_Kas', limit: 2000, offset: 0, includeArchived: true }
        ];
        jobs.forEach(function (payload, i) {
            setTimeout(function () {
                if (apiPeek('rwList', payload)) return;
                api('rwList', payload).catch(function () {});
            }, 300 + i * 400);
        });
    }

    function pagerHtml(key, sliced) {
        if (!sliced || sliced.total <= PAGE_SIZE) {
            return sliced && sliced.total
                ? '<div class="pager"><span class="pager-info">Menampilkan ' + fmtInt(sliced.total) + ' data</span></div>'
                : '';
        }
        var prevDisabled = sliced.page <= 1 ? ' disabled' : '';
        var nextDisabled = sliced.page >= sliced.pages ? ' disabled' : '';
        return '<div class="pager">' +
            '<span class="pager-info">Menampilkan ' + fmtInt(sliced.start) + '\u2013' + fmtInt(sliced.end) +
                ' dari ' + fmtInt(sliced.total) + '</span>' +
            '<div class="pager-actions">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-page-prev="' + esc(key) + '"' + prevDisabled + '><i class="fa-solid fa-chevron-left"></i> Sebelumnya</button>' +
                '<span class="pager-page">Halaman ' + fmtInt(sliced.page) + ' / ' + fmtInt(sliced.pages) + '</span>' +
                '<button type="button" class="btn btn-ghost btn-sm" data-page-next="' + esc(key) + '"' + nextDisabled + '>Berikutnya <i class="fa-solid fa-chevron-right"></i></button>' +
            '</div></div>';
    }

    function bindPager(key, rerender) {
        document.querySelectorAll('[data-page-prev]').forEach(function (btn) {
            if (btn.getAttribute('data-page-prev') !== key) return;
            btn.addEventListener('click', function () {
                state.pages[key] = Math.max(1, (Number(state.pages[key]) || 1) - 1);
                rerender();
            });
        });
        document.querySelectorAll('[data-page-next]').forEach(function (btn) {
            if (btn.getAttribute('data-page-next') !== key) return;
            btn.addEventListener('click', function () {
                state.pages[key] = (Number(state.pages[key]) || 1) + 1;
                rerender();
            });
        });
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
        if (!state.dashboard) pageLoading('Memuat ringkasan...');
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
                    '<td><span class="cell-main">' + esc(rt.rtId) + '</span><span class="cell-sub">' + esc(rt.alamat || rt.nama || '') + '</span></td>' +
                    '<td class="num">' + fmtInt(rt.warga) + '</td>' +
                    '<td class="num">' + fmtMoney(rt.kasSaldo) + '</td>' +
                    '<td class="num">' + fmtInt(rt.suratMenunggu) + '</td>' +
                    '<td class="num">' + fmtInt(rt.laporTerbuka) + '</td>' +
                    '<td class="num">' + fmtInt(rt.laporEskalasi) + '</td>' +
                    '<td>' + healthBadge(rt) + '</td>' +
                    '<td class="nowrap"><span class="cell-main">' + esc(rt.backendVersion || '-') + '</span><span class="cell-sub">' + fmtRelative(rt.lastSync) + '</span>' +
                        (rt.versionMismatch ? '<span class="cell-sub cell-warn"><i class="fa-solid fa-code-branch"></i> Versi beda</span>' : '') + '</td>' +
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
                    '<thead><tr><th>RT</th><th class="num">Warga</th><th class="num">Saldo kas</th><th class="num">Surat</th><th class="num">Pengaduan</th><th class="num">Eskalasi</th><th>Status</th><th>Backend / sinkron</th></tr></thead>' +
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
        readyDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-users"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            var payload = { rtId: f.rt, sheet: 'Data_Warga', limit: 2000, offset: 0, includeArchived: false };
            if (!apiPeek('rwList', payload)) pageLoading('Memuat data warga...');
            return api('rwList', payload).then(function (res) {
                state.warga = { rows: rowsToObjects(res.headers, res.rows), res: res };
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="warga-rt">' + rtOptions(f.rt) + '</select></div>' +
                        '<div class="field" style="flex:1"><label>Cari</label><span class="search-wrap"><i class="fa-solid fa-magnifying-glass"></i><input class="control" id="warga-q" placeholder="Nama, NIK, KK, HP, atau alamat" value="' + esc(f.q) + '"></span></div>' +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>' + esc(f.rt) + '</h2><p id="warga-count">' + fmtInt(res.total) + ' warga aktif</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>Warga</th><th>NIK</th><th>No HP</th><th>Alamat</th><th>Status</th><th>Pekerjaan</th></tr></thead>' +
                    '<tbody id="warga-body"></tbody></table></div></div>' +
                    '<div id="warga-pager"></div></section>';
                paintWarga();
                $('warga-rt').addEventListener('change', function (e) {
                    f.rt = e.target.value; f.q = ''; state.pages.warga = 1; renderWarga();
                });
                $('warga-q').addEventListener('input', function (e) {
                    f.q = e.target.value;
                    state.pages.warga = 1;
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
        var sliced = pageSlice(filtered, 'warga');
        var body = sliced.rows.map(function (r) {
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
        var pager = $('warga-pager');
        if (pager) pager.innerHTML = pagerHtml('warga', sliced);
        bindPager('warga', paintWarga);
        var count = $('warga-count');
        if (count) count.textContent = fmtInt(filtered.length) + ' dari ' + fmtInt(data.res.total) + ' warga aktif';
    }

    function renderKas() {
        var f = state.filters.kas;
        readyDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-wallet"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            var payload = { rtId: f.rt, sheet: 'Iuran_Kas', limit: 2000, offset: 0, includeArchived: true };
            if (!apiPeek('rwList', payload)) pageLoading('Memuat data kas...');
            return api('rwList', payload).then(function (res) {
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
                var sliced = pageSlice(rows, 'kas');
                var body = sliced.rows.map(function (r) {
                    var archived = isArchived(r['Diarsipkan']);
                    var reversal = !isBlank(r['Reversal Dari']);
                    var jenis = String(r['Jenis Transaksi'] || '');
                    var isOut = jenis.toLowerCase() === 'pengeluaran' || jenis.toLowerCase() === 'reversal keluar';
                    return '<tr' + (archived ? ' style="opacity:.55"' : '') + '>' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDay(r['Tanggal'] || r['Timestamp']) + '</span></td>' +
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
                    '<tbody>' + (body || '<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-wallet"></i><p>Belum ada transaksi.</p></div></td></tr>') + '</tbody></table></div></div>' +
                    pagerHtml('kas', sliced) + '</section>';
                $('kas-rt').addEventListener('change', function (e) { f.rt = e.target.value; state.pages.kas = 1; renderKas(); });
                bindPager('kas', renderKas);
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function renderSurat() {
        var f = state.filters.surat;
        readyDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-file-signature"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            var payload = { rtId: f.rt, sheet: 'Pengajuan_Surat', limit: 2000, offset: 0, includeArchived: false };
            if (f.status) payload.status = f.status;
            if (!apiPeek('rwList', payload)) pageLoading('Memuat pengajuan surat...');
            return api('rwList', payload).then(function (res) {
                var rows = sortByTimeDesc(rowsToObjects(res.headers, res.rows), 'Timestamp');
                var sliced = pageSlice(rows, 'surat');
                var body = sliced.rows.map(function (r) {
                    return '<tr class="clickable" data-surat="' + esc(r['ID']) + '">' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDay(r['Timestamp']) + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Lengkap Pemohon'] || '-') + '</span><span class="cell-sub">' + esc(r['NIK'] || '-') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Jenis Surat'] || '-') + '</span><span class="cell-sub">' + esc(r['No. Surat'] || 'Belum bernomor') + '</span></td>' +
                        '<td>' + rtSuratBadge(r['Status Pengurusan']) + '</td>' +
                        '<td>' + rwSuratBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap">' + fmtInt(r['Rw Revisi'] || 0) + ' kali</td>' +
                        '</tr>';
                }).join('');
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="surat-rt">' + rtOptions(f.rt) + '</select></div>' +
                        '<div class="field"><label>Status RW</label><select class="control" id="surat-status">' + statusOptions(f.status, ['', 'Menunggu', 'Disetujui', 'Dikembalikan', 'Ditolak', 'Tidak Perlu'], 'Semua status') + '</select></div>' +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Pengajuan surat</h2><p>' + fmtInt(res.total) + ' pengajuan · klik baris untuk detail</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr><th>Tanggal</th><th><span class="th-stack">Pemohon</span><span class="th-sub">NIK</span></th><th><span class="th-stack">Jenis surat</span><span class="th-sub">No. Surat</span></th><th>Status RT</th><th>Status RW</th><th>Revisi</th></tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-file-signature"></i><p>Tidak ada pengajuan pada filter ini.</p></div></td></tr>') + '</tbody></table></div></div>' +
                    pagerHtml('surat', sliced) + '</section>';
                $('surat-rt').addEventListener('change', function (e) { f.rt = e.target.value; state.pages.surat = 1; renderSurat(); });
                $('surat-status').addEventListener('change', function (e) { f.status = e.target.value; state.pages.surat = 1; renderSurat(); });
                bindPager('surat', renderSurat);
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
        readyDashboard().then(function () {
            if (!f.rt) f.rt = defaultRt();
            if (!f.rt) {
                $('page').innerHTML = '<div class="card"><div class="empty"><i class="fa-solid fa-comment-dots"></i><p>Belum ada RT aktif.</p></div></div>';
                return;
            }
            var payload = { rtId: f.rt, sheet: 'Lapor_Aspirasi', limit: 2000, offset: 0, includeArchived: false };
            if (f.status) payload.status = f.status;
            if (!apiPeek('rwList', payload)) pageLoading('Memuat pengaduan...');
            return api('rwList', payload).then(function (res) {
                var rows = sortByTimeDesc(rowsToObjects(res.headers, res.rows), 'Timestamp');
                var sliced = pageSlice(rows, 'lapor');
                var body = sliced.rows.map(function (r) {
                    return '<tr class="clickable" data-lapor="' + esc(r['ID']) + '">' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDay(r['Timestamp']) + '</span><span class="cell-sub">' + esc(r['No. Pengaduan'] || '') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Warga'] || '-') + '</span><span class="cell-sub">' + esc(r['Alamat / No. Rumah'] || '') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Judul Pengaduan'] || '-') + '</span><span class="cell-sub">' + esc(r['Jenis Pengaduan'] || '') + '</span></td>' +
                        '<td>' + rtLaporBadge(r['Status']) + '</td>' +
                        '<td>' + rwLaporBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap">' + fmtDay(r['Rw Diperbarui']) + '</td>' +
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
                    '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-comment-dots"></i><p>Tidak ada pengaduan pada filter ini.</p></div></td></tr>') + '</tbody></table></div></div>' +
                    pagerHtml('lapor', sliced) + '</section>';
                $('lapor-rt').addEventListener('change', function (e) { f.rt = e.target.value; state.pages.lapor = 1; renderLapor(); });
                $('lapor-status').addEventListener('change', function (e) { f.status = e.target.value; state.pages.lapor = 1; renderLapor(); });
                bindPager('lapor', renderLapor);
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

    function isAdminPage(page) {
        return ['pengguna', 'registry', 'pengaturan', 'outbox', 'audit'].indexOf(page) !== -1;
    }

    function adminOnlyNotice(title) {
        return '<div class="card"><div class="empty">' +
            '<i class="fa-solid fa-lock"></i>' +
            '<p><strong>' + esc(title) + '</strong> hanya dapat diakses RW Admin.</p>' +
            '</div></div>';
    }

    function fmtBool(v) {
        var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
        return (s === 'true' || s === '1' || s === 'ya');
    }

    function statusBadge(status) {
        var s = String(status || '');
        if (s === 'Sent') return badge(s, 'badge-green', 'fa-circle-check');
        if (s === 'Failed') return badge(s, 'badge-red', 'fa-circle-exclamation');
        if (s === 'Pending') return badge(s, 'badge-amber', 'fa-hourglass-half');
        return badge(s || '-', 'badge-neutral', 'fa-circle-info');
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
            return '<div class="drawer-section tint tint-slate"><h3>Tindakan RW</h3>' +
                '<div class="notice notice-info" style="margin:0"><i class="fa-solid fa-eye"></i><div>Anda masuk sebagai <strong>RW Viewer</strong>. Keputusan surat hanya dapat dilakukan RW Admin.</div></div></div>';
        }
        if (status !== 'Menunggu') {
            return '<div class="drawer-section tint tint-slate"><h3>Tindakan RW</h3>' +
                '<div class="notice notice-info" style="margin:0"><i class="fa-solid fa-circle-info"></i><div>Tidak ada keputusan yang menunggu. Status RW saat ini <strong>' + esc(status) + '</strong>.</div></div></div>';
        }
        var maxed = revisi >= 3;
        return '<div class="drawer-section action-panel tint tint-amber">' +
            '<h3>Tindakan RW</h3>' +
            '<p class="action-current">' + esc(rtLabel(rtId)) + ' · revisi ' + fmtInt(revisi) + ' kali · versi data ' + fmtInt(versi) + '</p>' +
            '<div class="field"><label for="surat-catatan">Catatan keputusan</label>' +
            '<textarea id="surat-catatan" class="control textarea" maxlength="1000" rows="4" placeholder="Wajib untuk Dikembalikan atau Ditolak"></textarea>' +
            '<p class="form-hint">Catatan minimal 3 karakter untuk keputusan negatif. Keputusan dikirim ke RT tujuan.</p></div>' +
            '<div class="action-buttons">' +
            '<button type="button" class="btn btn-primary" id="surat-approve"><i class="fa-solid fa-circle-check"></i> Setujui</button>' +
            '<button type="button" class="btn btn-blue" id="surat-return"' + (maxed ? ' disabled title="Batas 3 revisi tercapai"' : '') + '><i class="fa-solid fa-arrow-right"></i> Kembalikan</button>' +
            '<button type="button" class="btn btn-danger" id="surat-reject"><i class="fa-solid fa-circle-exclamation"></i> Tolak</button>' +
            '</div>' +
            (maxed ? '<p class="form-hint" style="margin-top:8px">Batas 3 revisi sudah tercapai. Kembalikan tidak tersedia; gunakan Setujui atau Tolak sebagai keputusan final.</p>' : '') +
            '</div>';
    }

    function setSuratActionBusy(r, busy) {
        var approve = $('surat-approve');
        if (approve) approve.disabled = busy;
        var maxed = (Number(r['Rw Revisi'] || 0) || 0) >= 3;
        var returnBtn = $('surat-return');
        if (returnBtn) returnBtn.disabled = busy || maxed;
        var rejectBtn = $('surat-reject');
        if (rejectBtn) rejectBtn.disabled = busy;
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
        if (decision === 'Dikembalikan' && revisi >= 3) {
            toast('Batas 3 revisi sudah tercapai. Gunakan Setujui atau Tolak sebagai keputusan final.', 'error');
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
                : decision === 'Ditolak' && revisi >= 3
                    ? 'RT akan menerima catatan. Karena batas 3 revisi sudah tercapai, keputusan ini bersifat final.'
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
            clearReadCache();
            renderers[state.page]();
            toast(res && res.queued
                ? 'Keputusan tersimpan. Pengiriman ke RT akan dicoba ulang otomatis.'
                : 'Keputusan berhasil dikirim ke RT.', 'success');
        }).catch(function (err) {
            state.actionBusy = false;
            setSuratActionBusy(r, false);
            if (err.code === 'stale' || err.code === 'not_pending' || err.code === 'max_negative') {
                closeDrawer();
                clearReadCache();
                renderers[state.page]();
                toast(err.message || 'Data sudah berubah. Daftar dimuat ulang.', 'error');
                return;
            }
            if (isAmbiguousWriteError(err)) {
                closeDrawer();
                clearReadCache();
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
            return '<div class="drawer-section tint tint-slate"><h3>Tindakan RW</h3>' +
                '<div class="notice notice-info" style="margin:0"><i class="fa-solid fa-eye"></i><div>Anda masuk sebagai <strong>RW Viewer</strong>. Tanggapan pengaduan hanya dapat dikirim RW Admin.</div></div></div>';
        }
        var suggested = (status === 'Tidak Perlu' || status === 'Perlu Tindak Lanjut') ? 'Ditangani RW' : '';
        return '<div class="drawer-section action-panel tint tint-blue">' +
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
            clearReadCache();
            renderers[state.page]();
            toast(res && res.queued
                ? 'Tanggapan tersimpan. Pengiriman ke RT akan dicoba ulang otomatis.'
                : 'Tanggapan RW berhasil dikirim.', 'success');
        }).catch(function (err) {
            state.actionBusy = false;
            if (btn) btn.disabled = false;
            if (err.code === 'stale') {
                closeDrawer();
                clearReadCache();
                renderers[state.page]();
                toast(err.message || 'Pengaduan sudah berubah. Daftar dimuat ulang.', 'error');
                return;
            }
            if (isAmbiguousWriteError(err)) {
                closeDrawer();
                clearReadCache();
                renderers[state.page]();
                toast('Koneksi ke gateway terputus. Data dimuat ulang; periksa riwayat sebelum mengirim ulang.', 'error');
                return;
            }
            toast(err.message || 'Tanggapan gagal dikirim.', 'error');
        });
    }

    function laporFotoDriveId(url) {
        var u = String(url || '');
        if (!/drive\.google\.com/i.test(u)) return '';
        var byPath = u.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
        if (byPath) return byPath[1];
        var byQuery = u.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
        return byQuery ? byQuery[1] : '';
    }

    function laporFotoPreviewSources(url) {
        var u = String(url || '').trim();
        var sources = [];
        var id = laporFotoDriveId(u);
        if (id) {
            sources.push('https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w1000');
            sources.push('https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w1000');
        }
        if (/^https?:\/\//i.test(u)) sources.push(u);
        return sources;
    }

    function laporFotoBlock(url) {
        var u = String(url || '').trim();
        var safe = /^https?:\/\//i.test(u) ? u : '';
        var sources = safe ? laporFotoPreviewSources(safe) : [];
        if (!sources.length) return { html: '', sources: [] };
        var html = '<div class="drawer-photo">' +
            '<img id="lapor-foto-img" src="' + esc(sources[0]) + '" alt="Foto bukti pengaduan" width="320" height="240" ' +
            'decoding="async" loading="lazy" referrerpolicy="no-referrer">' +
            '<a class="photo-link" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' +
            '<i class="fa-solid fa-arrow-up-right-from-square"></i>Buka foto asli</a>' +
            '</div>';
        return { html: html, sources: sources };
    }

    function bindLaporFoto(sources) {
        var img = $('lapor-foto-img');
        if (!img) return;
        var list = Array.isArray(sources) ? sources : [];
        img.setAttribute('data-sources', list.join('|'));
        img.setAttribute('data-attempt', '0');
        img.addEventListener('error', function () {
            var attempt = Number(img.getAttribute('data-attempt') || 0) + 1;
            if (attempt < list.length) {
                img.setAttribute('data-attempt', String(attempt));
                img.src = list[attempt];
                return;
            }
            if (img.parentNode && img.parentNode.removeChild) img.parentNode.removeChild(img);
        });
    }

    function openSurat(r) {
        var rtId = state.filters.surat.rt;
        var html = '<div class="drawer-section tint tint-brand"><h3>Pemohon</h3><dl class="detail-list">' +
            detailRow('Nama', esc(r['Nama Lengkap Pemohon'])) +
            detailRow('NIK', esc(r['NIK'])) +
            detailRow('No. HP', esc(r['No. HP / WhatsApp'])) +
            detailRow('Alamat', esc(r['Alamat / No. Rumah'])) +
            '</dl></div>' +
            '<div class="drawer-section tint tint-blue"><h3>Pengajuan</h3><dl class="detail-list">' +
            detailRow('Jenis surat', esc(r['Jenis Surat'])) +
            detailRow('Keperluan', esc(r['Keperluan / Alasan Pengajuan'])) +
            detailRow('Status RT', rtSuratBadge(r['Status Pengurusan'])) +
            detailRow('No. surat', esc(r['No. Surat'] || '-')) +
            detailRow('Tanggal selesai', fmtDate(r['Tanggal Selesai'])) +
            detailRow('Catatan RT', esc(r['Catatan Pengurus'] || '-')) +
            '</dl></div>' +
            '<div class="drawer-section tint tint-amber"><h3>Keputusan RW</h3><dl class="detail-list">' +
            detailRow('Status RW', rwSuratBadge(r['Rw Status'])) +
            detailRow('Catatan RW', esc(r['Rw Catatan'] || '-')) +
            detailRow('Oleh', esc(r['Rw Oleh'] || '-')) +
            detailRow('Tanggal', fmtDate(r['Rw Tanggal'])) +
            detailRow('Revisi', esc((Number(r['Rw Revisi'] || 0) || 0) + ' kali')) +
            detailRow('Versi data', esc(r['Rw Versi'] || 1)) +
            '</dl></div>' +
            suratActionPanel(r, rtId);
        openDrawer('Pengajuan surat · ' + (r['ID'] || ''), r['Jenis Surat'] || 'Detail pengajuan', html);
        bindSuratActions(r, rtId);
    }

    function openLapor(r) {
        var laporId = r['ID'];
        var rtId = state.filters.lapor.rt;
        var foto = laporFotoBlock(r['Foto / Bukti Pendukung']);
        openDrawer('Pengaduan · ' + (r['No. Pengaduan'] || laporId || ''), r['Judul Pengaduan'] || 'Detail pengaduan',
            '<div class="drawer-section tint tint-brand"><h3>Pengaduan</h3><dl class="detail-list">' +
            detailRow('No. pengaduan', esc(r['No. Pengaduan'])) +
            detailRow('Warga', esc(r['Nama Warga'])) +
            detailRow('No. HP', esc(r['No. HP / WhatsApp'])) +
            detailRow('Alamat', esc(r['Alamat / No. Rumah'])) +
            detailRow('Jenis', esc(r['Jenis Pengaduan'])) +
            detailRow('Lokasi', esc(r['Lokasi Kejadian'] || '-')) +
            detailRow('Tanggal kejadian', fmtDate(r['Tanggal Kejadian'])) +
            detailRow('Detail', esc(r['Detail Pengaduan'] || '-')) +
            detailRow('Harapan', esc(r['Harapan / Solusi'] || '-')) +
            '</dl>' + foto.html + '</div>' +
            '<div class="drawer-section tint tint-blue"><h3>Status</h3><dl class="detail-list">' +
            detailRow('Status RT', rtLaporBadge(r['Status'])) +
            detailRow('Catatan RT', esc(r['Catatan Tindak Lanjut'] || '-')) +
            detailRow('Status RW', rwLaporBadge(r['Rw Status'])) +
            detailRow('Petugas RW', esc(r['Rw Petugas'] || '-')) +
            detailRow('Diperbarui', fmtDate(r['Rw Diperbarui'])) +
            '</dl></div>' +
            laporActionPanel(r) +
            '<div class="drawer-section tint tint-green"><h3>Riwayat tindak lanjut RW</h3><div id="lapor-timeline" class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i>Memuat riwayat...</div></div>');
        bindLaporFoto(foto.sources);
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

    function renderPengguna() {
        if (!isAdmin()) { $('page').innerHTML = adminOnlyNotice('Pengguna RW'); return; }
        if (!apiPeek('rwUsersList')) pageLoading('Memuat pengguna RW...');
        api('rwUsersList').then(function (res) {
            var users = res.users || [];
            var sliced = pageSlice(users, 'pengguna');
            var body = sliced.rows.map(function (u) {
                return '<tr>' +
                    '<td><span class="cell-main">' + esc(u.nama || '-') + '</span><span class="cell-sub">' + esc(u.email) + '</span></td>' +
                    '<td>' + badge(u.peran || '-', u.peran === 'RW Admin' ? 'badge-blue' : 'badge-neutral', u.peran === 'RW Admin' ? 'fa-user-gear' : 'fa-eye') + '</td>' +
                    '<td>' + (u.aktif ? badge('Aktif', 'badge-green', 'fa-circle-check') : badge('Nonaktif', 'badge-neutral', 'fa-user')) + '</td>' +
                    '<td class="nowrap">' + fmtStamp(u.diperbarui) + '</td>' +
                    '<td class="nowrap"><button type="button" class="btn btn-ghost" data-user-edit="' + esc(u.email) + '"><i class="fa-solid fa-pen-to-square"></i> Ubah</button></td>' +
                    '</tr>';
            }).join('');
            $('page').innerHTML =
                '<div class="toolbar">' +
                    '<button type="button" class="btn btn-primary" id="user-add"><i class="fa-solid fa-user-plus"></i> Tambah pengguna</button>' +
                    '<span class="cell-sub">' + fmtInt(users.length) + ' pengguna terdaftar</span>' +
                '</div>' +
                '<section class="card"><div class="card-head"><div><h2>Pengguna RW</h2><p>Hanya RW Admin yang dapat mengelola akses portal.</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr><th>Nama / email</th><th>Peran</th><th>Status</th><th>Diperbarui</th><th>Aksi</th></tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-user-gear"></i><p>Belum ada pengguna.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('pengguna', sliced) + '</section>';
            $('user-add').addEventListener('click', function () { openUserForm(null, users); });
            bindPager('pengguna', renderers.pengguna);
            document.querySelectorAll('[data-user-edit]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var email = btn.getAttribute('data-user-edit');
                    var found = users.find(function (u) { return u.email === email; });
                    openUserForm(found || null, users);
                });
            });
            setSync('Pengguna RW', 'ok');
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function openUserForm(user, users) {
        var isNew = !user;
        var email = user ? user.email : '';
        var nama = user ? user.nama : '';
        var peran = user ? user.peran : 'RW Viewer';
        var aktif = user ? !!user.aktif : true;
        openDrawer(isNew ? 'Pengguna baru' : 'Ubah pengguna', isNew ? 'Tambah pengguna RW' : (nama || email),
            '<div class="drawer-section"><div class="form-grid">' +
                '<div class="field"><label>Email</label><input class="control" id="user-email" type="email" value="' + esc(email) + '"' + (isNew ? '' : ' readonly') + '></div>' +
                '<div class="field"><label>Nama</label><input class="control" id="user-nama" value="' + esc(nama) + '"></div>' +
                '<div class="field"><label>Peran</label><select class="control" id="user-peran">' +
                    '<option value="RW Admin"' + (peran === 'RW Admin' ? ' selected' : '') + '>RW Admin</option>' +
                    '<option value="RW Viewer"' + (peran === 'RW Viewer' ? ' selected' : '') + '>RW Viewer</option>' +
                '</select></div>' +
                '<div class="field"><label>Status</label><select class="control" id="user-aktif">' +
                    '<option value="true"' + (aktif ? ' selected' : '') + '>Aktif</option>' +
                    '<option value="false"' + (aktif ? '' : ' selected') + '>Nonaktif</option>' +
                '</select></div>' +
            '</div>' +
            '<p class="form-hint">Email harus sama dengan identitas Google yang terverifikasi Cloudflare Access. Minimal satu RW Admin aktif harus tetap ada.</p></div>' +
            '<div class="action-buttons"><button type="button" class="btn btn-primary" id="user-save"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div>');
        $('user-save').addEventListener('click', function () {
            var data = {
                userEmail: $('user-email').value.trim().toLowerCase(),
                nama: $('user-nama').value.trim(),
                peran: $('user-peran').value,
                aktif: $('user-aktif').value === 'true'
            };
            if (!data.userEmail) { toast('Email wajib diisi.', 'error'); return; }
            if (!data.nama) { toast('Nama wajib diisi.', 'error'); return; }
            var dirty = isNew || data.nama !== nama || data.peran !== peran || data.aktif !== aktif;
            if (!dirty) { closeDrawer(); return; }
            var losesAdmin = !isNew && user.peran === 'RW Admin' && user.aktif && (data.peran !== 'RW Admin' || !data.aktif);
            if (losesAdmin) {
                var admins = (users || []).filter(function (u) { return u.aktif && u.peran === 'RW Admin'; });
                if (admins.length <= 1) { toast('Tidak dapat menonaktifkan/menurunkan RW Admin terakhir.', 'error'); return; }
                openWarning({
                    eyebrow: 'Konfirmasi peran',
                    title: 'Turunkan akses RW Admin?',
                    message: 'Pengguna <b>' + esc(data.userEmail) + '</b> akan kehilangan hak menyetujui surat dan menanggapi pengaduan.',
                    tone: 'danger',
                    icon: 'fa-user-gear',
                    confirmIcon: 'fa-user-gear',
                    confirmLabel: 'Ya, ubah akses',
                    onConfirm: function () { saveUser(data); }
                });
                return;
            }
            saveUser(data);
        });
    }

    function saveUser(data) {
        api('rwUsersSave', data).then(function () {
            closeDrawer();
            clearReadCache();
            renderers.pengguna();
            toast('Pengguna ' + data.userEmail + ' disimpan.', 'success');
        }).catch(function (err) { toast(err.message || 'Gagal menyimpan pengguna.', 'error'); });
    }

    function renderRegistry() {
        if (!isAdmin()) { $('page').innerHTML = adminOnlyNotice('Registry RT'); return; }
        if (!apiPeek('rwRegistryList')) pageLoading('Memuat registry RT...');
        api('rwRegistryList').then(function (res) {
            var rows = res.registry || [];
            var expected = String(res.expectedVersion || '').trim();
            var sliced = pageSlice(rows, 'registry');
            var body = sliced.rows.map(function (rt) {
                var mismatch = !!(expected && rt.backendVersion && rt.backendVersion !== expected);
                return '<tr>' +
                    '<td><span class="cell-main">' + esc(rt.rtId) + '</span><span class="cell-sub">' + esc(rt.alamat || '-') + '</span></td>' +
                    '<td><span class="cell-main">' + esc(rt.nama || '-') + '</span></td>' +
                    '<td>' + (rt.aktif ? badge('Aktif', 'badge-green', 'fa-circle-check') : badge('Nonaktif', 'badge-neutral', 'fa-plug-circle-check')) + '</td>' +
                    '<td class="nowrap"><span class="cell-main">' + esc(rt.backendVersion || '-') + '</span><span class="cell-sub">' + fmtRelative(rt.lastSync) + '</span>' +
                        (mismatch ? '<span class="cell-sub cell-warn"><i class="fa-solid fa-code-branch"></i> diharapkan ' + esc(expected) + '</span>' : '') + '</td>' +
                    '<td>' + (rt.lastError ? '<span class="cell-sub" style="color:#be123c">' + esc(rt.lastError) + '</span>' : '<span class="cell-sub">-</span>') + '</td>' +
                    '<td class="nowrap">' +
                        '<button type="button" class="btn btn-ghost" data-rt-edit="' + esc(rt.rtId) + '"><i class="fa-solid fa-pen-to-square"></i> Ubah</button> ' +
                        '<button type="button" class="btn btn-ghost" data-rt-health="' + esc(rt.rtId) + '"><i class="fa-solid fa-plug-circle-check"></i> Cek</button>' +
                    '</td>' +
                    '</tr>';
            }).join('');
            $('page').innerHTML =
                '<div class="toolbar">' +
                    '<button type="button" class="btn btn-primary" id="rt-add"><i class="fa-solid fa-plus-circle"></i> Tambah RT</button>' +
                    '<span class="cell-sub">Maksimal 10 RT · token RT disimpan di Script Properties sistem</span>' +
                '</div>' +
                '<section class="card"><div class="card-head"><div><h2>Registry RT</h2><p>Alamat dan endpoint dipakai dashboard serta fan-out data.</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr><th>RT / alamat</th><th>Nama</th><th>Aktif</th><th>Backend / sinkron</th><th>Error terakhir</th><th>Aksi</th></tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-server"></i><p>Belum ada RT terdaftar.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('registry', sliced) + '</section>';
            $('rt-add').addEventListener('click', function () { openRegistryForm(null); });
            bindPager('registry', renderers.registry);
            document.querySelectorAll('[data-rt-edit]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-rt-edit');
                    openRegistryForm(rows.find(function (rt) { return rt.rtId === id; }) || null);
                });
            });
            document.querySelectorAll('[data-rt-health]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-rt-health');
                    btn.disabled = true;
                    api('rwRtHealth', { rtId: id }).then(function (check) {
                        btn.disabled = false;
                        toast('RT ' + id + ' sehat' + (check && check.check && check.check.version ? ' · ' + check.check.version : '') + '.', 'success');
                        renderers.registry();
                    }).catch(function (err) {
                        btn.disabled = false;
                        toast(err.message || ('RT ' + id + ' tidak dapat dihubungi.'), 'error');
                        renderers.registry();
                    });
                });
            });
            setSync('Registry RT', 'ok');
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function openRegistryForm(rt) {
        var isNew = !rt;
        var v = rt || { rtId: '', nama: '', alamat: '', endpoint: '', aktif: true };
        openDrawer(isNew ? 'RT baru' : 'Ubah RT', isNew ? 'Tambah RT' : (v.rtId + ' · ' + (v.nama || '')),
            '<div class="drawer-section"><div class="form-grid">' +
                '<div class="field"><label>RT ID</label><input class="control" id="rt-id" value="' + esc(v.rtId) + '" placeholder="RT019"' + (isNew ? '' : ' readonly') + '></div>' +
                '<div class="field"><label>Nama</label><input class="control" id="rt-nama" value="' + esc(v.nama) + '" placeholder="RT 019 / Lontar"></div>' +
                '<div class="field"><label>Alamat</label><input class="control" id="rt-alamat" value="' + esc(v.alamat || '') + '" placeholder="Lontar Barat"></div>' +
                '<div class="field"><label>Status</label><select class="control" id="rt-aktif">' +
                    '<option value="true"' + (v.aktif ? ' selected' : '') + '>Aktif</option>' +
                    '<option value="false"' + (v.aktif ? '' : ' selected') + '>Nonaktif</option>' +
                '</select></div>' +
                '<div class="field" style="grid-column:1/-1"><label>Endpoint Web App</label><input class="control" id="rt-endpoint" value="' + esc(v.endpoint) + '" placeholder="https://script.google.com/macros/s/.../exec"></div>' +
            '</div>' +
            '<p class="form-hint">Endpoint wajib <code>https://.../exec</code> dan tidak boleh dipakai RT lain. Alamat tampil pada dashboard sebagai baris kedua kolom RT. Token akses diatur di Script Property <code>RT_TOKEN_&lt;RTID&gt;</code>.</p></div>' +
            '<div class="action-buttons"><button type="button" class="btn btn-primary" id="rt-save"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></div>');
        $('rt-save').addEventListener('click', function () {
            var data = {
                rtId: $('rt-id').value.trim().toUpperCase(),
                nama: $('rt-nama').value.trim(),
                alamat: $('rt-alamat').value.trim(),
                endpoint: $('rt-endpoint').value.trim(),
                aktif: $('rt-aktif').value === 'true'
            };
            if (!/^RT\d{3}$/.test(data.rtId)) { toast('RT ID harus berformat RTNNN, mis. RT019.', 'error'); return; }
            if (!data.nama) { toast('Nama RT wajib diisi.', 'error'); return; }
            if (!/^https:\/\/.+\/exec(\?|$)/.test(data.endpoint)) { toast('Endpoint harus https://.../exec.', 'error'); return; }
            if (!isNew && v.aktif && !data.aktif) {
                openWarning({
                    eyebrow: 'Konfirmasi status RT',
                    title: 'Nonaktifkan ' + data.rtId + '?',
                    message: 'RT nonaktif tidak lagi muncul di dashboard dan tidak dapat dibaca melalui portal RW.',
                    tone: 'danger',
                    icon: 'fa-plug-circle-check',
                    confirmIcon: 'fa-plug-circle-check',
                    confirmLabel: 'Ya, nonaktifkan',
                    onConfirm: function () { saveRegistry(data); }
                });
                return;
            }
            saveRegistry(data);
        });
    }

    function saveRegistry(data) {
        api('rwRegistrySave', data).then(function () {
            closeDrawer();
            clearReadCache();
            renderers.registry();
            toast('RT ' + data.rtId + ' disimpan.', 'success');
        }).catch(function (err) { toast(err.message || 'Gagal menyimpan RT.', 'error'); });
    }

    function renderPengaturan() {
        if (!isAdmin()) { $('page').innerHTML = adminOnlyNotice('Pengaturan'); return; }
        if (!apiPeek('rwSettingsGet')) pageLoading('Memuat pengaturan...');
        api('rwSettingsGet').then(function (res) {
            var items = res.settings || [];
            var sliced = pageSlice(items, 'pengaturan');
            var body = sliced.rows.map(function (s) {
                var bool = s.key === 'RW_MASK_VIEWER' || s.key === 'DIGEST_ENABLED';
                var input = bool
                    ? '<select class="control" data-setting="' + esc(s.key) + '"><option value="true"' + (fmtBool(s.value) ? ' selected' : '') + '>true</option><option value="false"' + (fmtBool(s.value) ? '' : ' selected') + '>false</option></select>'
                    : '<input class="control" data-setting="' + esc(s.key) + '" value="' + esc(s.value) + '">';
                return '<tr>' +
                    '<td><span class="cell-main">' + esc(s.key) + '</span><span class="cell-sub">' + esc(s.keterangan || '-') + '</span></td>' +
                    '<td style="min-width:180px">' + input + '</td>' +
                    '<td class="nowrap">' + fmtStamp(s.diperbarui) + '</td>' +
                    '<td class="nowrap"><button type="button" class="btn btn-ghost" data-setting-save="' + esc(s.key) + '"><i class="fa-solid fa-floppy-disk"></i> Simpan</button></td>' +
                    '</tr>';
            }).join('');
            $('page').innerHTML =
                '<div class="notice notice-info"><i class="fa-solid fa-circle-info"></i><div>Perubahan berlaku pada permintaan berikutnya. Retensi audit 12 bulan, keputusan/tanggapan dan snapshot 24 bulan.</div></div>' +
                '<section class="card"><div class="card-head"><div><h2>Pengaturan sistem</h2><p>Tanpa deploy ulang portal.</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr><th>Parameter</th><th>Nilai</th><th>Diperbarui</th><th>Aksi</th></tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="4"><div class="empty"><i class="fa-solid fa-sliders"></i><p>Belum ada pengaturan.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('pengaturan', sliced) + '</section>';
            bindPager('pengaturan', renderers.pengaturan);
            document.querySelectorAll('[data-setting-save]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var key = btn.getAttribute('data-setting-save');
                    var input = document.querySelector('[data-setting="' + key + '"]');
                    if (!input) return;
                    var value = String(input.value).trim();
                    btn.disabled = true;
                    api('rwSettingsSave', { key: key, value: value }).then(function () {
                        clearReadCache();
                        toast(key + ' disimpan.', 'success');
                        renderers.pengaturan();
                    }).catch(function (err) {
                        btn.disabled = false;
                        toast(err.message || 'Gagal menyimpan pengaturan.', 'error');
                    });
                });
            });
            setSync('Pengaturan', 'ok');
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function renderOutbox() {
        if (!isAdmin()) { $('page').innerHTML = adminOnlyNotice('Outbox'); return; }
        if (!apiPeek('rwOutboxList')) pageLoading('Memuat outbox...');
        api('rwOutboxList').then(function (res) {
            var rows = (res.outbox || []).slice().reverse();
            var sliced = pageSlice(rows, 'outbox');
            var body = sliced.rows.map(function (o) {
                return '<tr>' +
                    '<td><span class="cell-main">' + esc(o.Aksi || '-') + '</span><span class="cell-sub">' + esc(o.ID || '') + '</span></td>' +
                    '<td>' + esc(o['RT ID'] || '-') + '</td>' +
                    '<td><span class="cell-main">' + esc(o['Target ID'] || '-') + '</span><span class="cell-sub">Percobaan ' + fmtInt(o.Percobaan || 0) + '</span></td>' +
                    '<td>' + statusBadge(o.Status) + '</td>' +
                    '<td class="nowrap"><span class="cell-main">' + fmtRelative(o['Next Retry']) + '</span><span class="cell-sub">' + esc(o['Last Error'] || '-') + '</span></td>' +
                    '<td class="nowrap"><button type="button" class="btn btn-ghost" data-outbox-retry="' + esc(o.ID) + '"' + (String(o.Status) === 'Sent' ? ' disabled' : '') + '><i class="fa-solid fa-rotate-right"></i> Kirim</button></td>' +
                    '</tr>';
            }).join('');
            var pending = (res.outbox || []).filter(function (o) { return String(o.Status) !== 'Sent'; }).length;
            $('page').innerHTML =
                '<div class="toolbar">' +
                    '<button type="button" class="btn btn-primary" id="outbox-process"><i class="fa-solid fa-paper-plane"></i> Proses antrean</button>' +
                    '<span class="cell-sub">' + fmtInt(pending) + ' belum terkirim · ' + fmtInt((res.outbox || []).length) + ' total</span>' +
                '</div>' +
                '<section class="card"><div class="card-head"><div><h2>Outbox</h2><p>Keputusan/tanggapan yang menunggu pengiriman ulang ke RT.</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr><th>Aksi / ID</th><th>RT</th><th>Target</th><th>Status</th><th>Jadwal / error</th><th>Aksi</th></tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-inbox"></i><p>Outbox kosong.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('outbox', sliced) + '</section>';
            bindPager('outbox', renderers.outbox);
            $('outbox-process').addEventListener('click', function () {
                openWarning({
                    eyebrow: 'Konfirmasi pengiriman',
                    title: 'Proses antrean outbox?',
                    message: 'Orkestrator akan mencoba mengirim semua entri yang sudah jatuh tempo ke RT tujuan.',
                    icon: 'fa-paper-plane',
                    confirmIcon: 'fa-paper-plane',
                    confirmLabel: 'Ya, proses',
                    onConfirm: function () {
                        api('rwOutboxRetry', { limit: 50 }).then(function (r) {
                            clearReadCache();
                            toast('Antrean diproses: ' + fmtInt(r.processed || 0) + ' entri.', 'success');
                            renderers.outbox();
                        }).catch(function (err) { toast(err.message || 'Gagal memproses outbox.', 'error'); });
                    }
                });
            });
            document.querySelectorAll('[data-outbox-retry]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-outbox-retry');
                    openWarning({
                        eyebrow: 'Konfirmasi kirim ulang',
                        title: 'Kirim ulang entri ini?',
                        message: 'Entri <b>' + esc(id) + '</b> akan dikirim ke RT tujuan sekarang.',
                        icon: 'fa-rotate-right',
                        confirmIcon: 'fa-paper-plane',
                        confirmLabel: 'Ya, kirim',
                        onConfirm: function () {
                            api('rwOutboxRetry', { id: id }).then(function (r) {
                                clearReadCache();
                                toast(r && r.retry && r.retry.duplicate ? 'Entri sudah terkirim sebelumnya.' : 'Entri berhasil dikirim.', 'success');
                                renderers.outbox();
                            }).catch(function (err) { toast(err.message || 'Gagal mengirim entri.', 'error'); });
                        }
                    });
                });
            });
            setSync('Outbox', 'ok');
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function renderAudit() {
        if (!isAdmin()) { $('page').innerHTML = adminOnlyNotice('Audit'); return; }
        if (!apiPeek('rwAuditList', { limit: 200 })) pageLoading('Memuat audit...');
        api('rwAuditList', { limit: 200 }).then(function (res) {
            var rows = res.audit || [];
            var sliced = pageSlice(rows, 'audit');
            var body = sliced.rows.map(function (a) {
                return '<tr>' +
                    '<td class="nowrap">' + fmtStamp(a.Waktu) + '</td>' +
                    '<td><span class="cell-main">' + esc(a.Aktor || '-') + '</span><span class="cell-sub">' + esc(a.Email || '') + '</span></td>' +
                    '<td>' + badge(a.Aksi || '-', 'badge-neutral', 'fa-list-check') + '</td>' +
                    '<td><span class="cell-main">' + esc(a['RT ID'] || '-') + '</span><span class="cell-sub">' + esc(a.Target || '') + '</span></td>' +
                    '<td>' + (a.Hasil === 'ok' ? badge('ok', 'badge-green', 'fa-circle-check') : badge(a.Hasil || '-', 'badge-red', 'fa-circle-exclamation')) + '</td>' +
                    '<td class="cell-sub">' + esc(a.Detail || '-') + '</td>' +
                    '</tr>';
            }).join('');
            $('page').innerHTML =
                '<div class="toolbar"><span class="cell-sub">' + fmtInt(rows.length) + ' entri terakhir · retensi audit 12 bulan</span></div>' +
                '<section class="card"><div class="card-head"><div><h2>Audit log</h2><p>Login, keputusan, tanggapan, registry, dan pengaturan.</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>RT / target</th><th>Hasil</th><th>Detail</th></tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-list-check"></i><p>Belum ada entri audit.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('audit', sliced) + '</section>';
            bindPager('audit', renderers.audit);
            setSync('Audit', 'ok');
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    var renderers = { dashboard: renderDashboard, warga: renderWarga, kas: renderKas, surat: renderSurat, lapor: renderLapor, pengguna: renderPengguna, registry: renderRegistry, pengaturan: renderPengaturan, outbox: renderOutbox, audit: renderAudit };

    function navigate(page) {
        if (!renderers[page]) page = 'dashboard';
        if (isAdminPage(page) && !isAdmin()) page = 'dashboard';
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
        api('rwRefresh').then(function (res) {
            // rwRefresh sudah mengembalikan dashboard terbaru; pakai langsung agar
            // tidak ada fan-out kedua yang memperlambat dan memicu timeout.
            if (res && res.rts) {
                state.dashboard = res;
                state.dashboardLoadedAt = Date.now();
            } else {
                clearReadCache();
                return ensureDashboard(true);
            }
        }).then(function () {
            renderers[state.page]();
            prefetchPages();
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
            btn.addEventListener('click', function () {
                if (btn.disabled) return;
                navigate(btn.getAttribute('data-page'));
            });
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
        // Ringkasan RT tidak bergantung pada data sesi (identitas sudah diverifikasi
        // gateway), jadi permintaannya dimulai bersamaan dengan rwSession. Satu
        // round-trip lebih cepat dan hasilnya masuk ke cache/dedupe `api()`,
        // sehingga renderDashboard tinggal memakainya.
        api('rwDashboard').catch(function () {});
        api('rwSession').then(function (res) {
            state.session = res;
            showApp();
            renderChrome();
            navigate('dashboard');
            prefetchPages();
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
