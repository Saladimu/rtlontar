/* RW 06 portal. No secrets are stored in the browser. */
(function () {
    'use strict';

    var BUILD = '2026-11-02-06';
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
            kas: { rt: '', from: '', to: '', preset: '', q: '' },
            surat: { rt: '', status: '', from: '', to: '', preset: '', q: '' },
            lapor: { rt: '', status: '', from: '', to: '', preset: '', q: '' },
            audit: { q: '' }
        },
        busy: false,
        actionBusy: false,
        prefetched: false,
        dashboardLoadedAt: 0,
        // Urutan awal: daftar transaksi/surat/pengaduan/audit terbaru di atas,
        // warga tetap memakai kelompok Nomor KK. Klik header untuk mengubah.
        sorts: {
            warga: { key: '', dir: 'asc' },
            kas: { key: 'time', dir: 'desc' },
            surat: { key: 'time', dir: 'desc' },
            lapor: { key: 'time', dir: 'desc' },
            // Audit disajikan orkestrator dari yang terbaru, jadi default
            // kolom ini mengikuti urutan asli tanpa pengurutan ulang.
            audit: { key: '', dir: 'desc' }
        },
        // Pilihan massal surat disimpan per ID agar tidak hilang saat daftar
        // digambar ulang karena pencarian, urutan, atau paginasi.
        bulkSurat: {},
        pages: { warga: 1, kas: 1, surat: 1, lapor: 1, pengguna: 1, registry: 1, pengaturan: 1, outbox: 1, audit: 1 },
        digestText: ''
    };
    var warningState = { onConfirm: null };

    // Tema terang/gelap. Pilihan manual disimpan di localStorage; bila belum
    // pernah memilih, tema mengikuti preferensi sistem. Atribut dipasang di
    // <html> agar seluruh token warna pada styles.css langsung berganti.
    var THEME_KEY = 'rw_theme';
    function storedTheme() {
        try {
            var v = localStorage.getItem(THEME_KEY);
            return v === 'dark' || v === 'light' ? v : '';
        } catch (e) { return ''; }
    }
    function systemTheme() {
        try {
            return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (e) { return 'light'; }
    }
    function currentTheme() { return storedTheme() || systemTheme(); }
    function applyTheme(theme) {
        var dark = theme === 'dark';
        try {
            if (document.documentElement && document.documentElement.setAttribute) {
                document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
            }
        } catch (e) { /* diabaikan */ }
        var btn = $('theme-btn');
        if (btn) {
            btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
            btn.setAttribute('aria-label', dark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
        }
        var icon = $('theme-icon');
        if (icon) icon.className = 'fa-solid ' + (dark ? 'fa-sun' : 'fa-moon');
        var meta = document.querySelector ? document.querySelector('meta[name="theme-color"]') : null;
        if (meta && meta.setAttribute) meta.setAttribute('content', dark ? '#0b1220' : '#0f766e');
        return dark;
    }
    function toggleTheme() {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* diabaikan */ }
        applyTheme(next);
    }

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

    // ================= FOKUS DIALOG =================
    // Drawer dan modal menahan fokus di dalam panelnya, mengembalikan fokus ke
    // elemen pemicu saat ditutup, dan menandai status buka/tutupnya lewat
    // aria-hidden agar pembaca layar tahu dialog mana yang sedang aktif.
    var focusTrap = { element: null, previous: null, handler: null };
    // Baris tabel bukan elemen fokus, jadi document.activeElement sering kali
    // <body> saat drawer dibuka dari klik baris. Simpan pemicu terakhir agar
    // fokus tetap bisa dikembalikan ke tempat yang masuk akal.
    var lastTrigger = null;

    function rememberTrigger(target) {
        if (!target || !target.closest) return;
        var el = target.closest('button, a[href], tr[data-surat], tr[data-lapor], input, select, textarea');
        if (el) lastTrigger = el;
    }

    function focusableIn(root) {
        if (!root || !root.querySelectorAll) return [];
        var selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        return Array.prototype.slice.call(root.querySelectorAll(selector)).filter(function (el) {
            return !el.classList || !el.classList.contains('hidden');
        });
    }

    function trapFocus(root) {
        releaseFocus(true);
        if (!root) return;
        var active = typeof document !== 'undefined' ? document.activeElement : null;
        focusTrap.element = root;
        focusTrap.previous = active && active !== document.body ? active : lastTrigger;
        focusTrap.handler = function (e) {
            if (e.key !== 'Tab' || !focusTrap.element) return;
            var items = focusableIn(focusTrap.element);
            if (!items.length) return;
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', focusTrap.handler);
    }

    function releaseFocus(skipRestore) {
        if (focusTrap.handler) document.removeEventListener('keydown', focusTrap.handler);
        var previous = focusTrap.previous;
        focusTrap.element = null;
        focusTrap.previous = null;
        focusTrap.handler = null;
        // Mengembalikan fokus ke pemicu agar pengguna keyboard tidak kembali ke
        // awal dokumen setelah dialog ditutup.
        if (!skipRestore && previous && previous.focus) {
            try { previous.focus(); } catch (e) { /* diabaikan */ }
        }
        // Baris tabel bukan elemen yang dapat menerima fokus; bila fokus tidak
        // kembali ke pemicu, arahkan ke area konten agar pengguna keyboard
        // tidak terlempar ke awal dokumen.
        if (!skipRestore && typeof document !== 'undefined' && document.activeElement === document.body) {
            var page = $('page');
            if (page && page.focus) {
                try { page.focus(); } catch (e) { /* diabaikan */ }
            }
        }
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
        var cancel2 = $('warning-cancel');
        if (cancel2) {
            cancel2.innerHTML = '<i class="fa-solid ' + (options.cancelIcon || 'fa-xmark') + '"></i> ' +
                esc(options.cancelLabel || 'Batal');
        }
        warningState.onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
        $('modal-warning').classList.remove('hidden');
        $('modal-warning').setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        trapFocus($('modal-warning'));
        var cancel = $('warning-cancel');
        if (cancel && cancel.focus) cancel.focus();
    }

    function closeWarning() {
        warningState.onConfirm = null;
        var modal = $('modal-warning');
        if (modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('modal-open');
        var confirm = $('warning-confirm');
        if (confirm) confirm.disabled = false;
        releaseFocus();
        // Modal bisa dibuka di atas drawer; setelah modal tertutup, drawer
        // kembali memegang fokus sampai ditutup pengguna.
        var drawer = $('drawer');
        if (drawer && !drawer.classList.contains('hidden')) trapFocus(drawer);
    }

    function runWarningConfirm() {
        var callback = warningState.onConfirm;
        closeWarning();
        if (callback) callback();
    }

    // Status jaringan dipakai untuk memberi tahu pengguna bahwa data yang
    // tampil berasal dari cache, bukan dari RT. Selama offline, seluruh daftar
    // tetap dapat dibuka dari cache baca sesi.
    var offlineState = { offline: false };

    function fmtClock(ts) {
        if (!ts) return '';
        try {
            return new Intl.DateTimeFormat('id-ID', {
                timeZone: TZ, hour: '2-digit', minute: '2-digit'
            }).format(new Date(ts));
        } catch (e) { return ''; }
    }

    // Umur tampilan kartu ringkasan. Setelah melewati TTL cache server, nilai
    // yang terlihat mungkin sudah tidak segar, jadi beri penanda kuning.
    function freshnessInfo(ts, ttlMs) {
        if (!ts) return { label: '', stale: false };
        var age = Math.max(0, Date.now() - ts);
        var stale = ttlMs > 0 && age > ttlMs;
        return { label: fmtRelative(ts), stale: stale };
    }

    function kpiFreshness(ts, ttlMs) {
        var info = freshnessInfo(ts, ttlMs);
        if (!info.label) return '';
        return '<span class="kpi-fresh' + (info.stale ? ' stale' : '') + '">' +
            '<span class="kpi-dot" aria-hidden="true"></span>' + esc(info.label) + '</span>';
    }

    function renderOfflineBanner() {
        var el = $('offline-banner');
        if (!el) return;
        if (!offlineState.offline) {
            el.classList.add('hidden');
            return;
        }
        var last = state.dashboardLoadedAt || 0;
        if (!last) {
            var dash = readCache[apiKey('rwDashboard', null)];
            last = dash && dash.at ? dash.at : 0;
        }
        var clock = fmtClock(last);
        var text = clock
            ? 'Anda sedang offline. Menampilkan data terakhir yang tersimpan pukul ' + clock + ' WIB.'
            : 'Anda sedang offline. Menampilkan data terakhir yang tersimpan.';
        var target = $('offline-text');
        if (target) target.textContent = text;
        el.classList.remove('hidden');
    }

    function setOffline(offline) {
        offlineState.offline = !!offline;
        renderOfflineBanner();
    }

    function bindNetworkStatus() {
        if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
            offlineState.offline = true;
        }
        if (typeof addEventListener === 'function') {
            addEventListener('online', function () {
                setOffline(false);
                toast('Kembali online. Memuat data terbaru.', 'success');
                if (state.session) { clearReadCache(); refresh(); }
            });
            addEventListener('offline', function () {
                setOffline(true);
                setSync('Offline', 'warn');
            });
        }
        renderOfflineBanner();
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
    // Dinaikkan setiap clearReadCache(). Respons yang dimulai sebelum
    // pembersihan tidak boleh menulis cache lagi, karena isinya sudah basi
    // (mis. daftar surat sebelum keputusan RW disimpan).
    var cacheGeneration = 0;

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
        cacheGeneration++;
        readCache = {};
        inflight = {};
        clearPersistedCache();
        state.dashboard = null;
        state.dashboardLoadedAt = 0;
        dashboardPromise = null;
    }

    // Umur maksimum entri cache. Setelah TTL, data lama tetap ditampilkan
    // seketika (stale-while-revalidate) lalu diperbarui di latar belakang.
    var READ_CACHE_MAX_MS = 10 * 60 * 1000;

    // Cache baca juga disalin ke sessionStorage supaya perpindahan menu tetap
    // seketika setelah halaman dimuat ulang (F5) atau dibuka dari tautan lain
    // di tab yang sama. Isinya hanya respons baca yang sudah ditampilkan ke
    // pengguna yang sama; entri dibuang saat build berubah, saat menulis data,
    // dan otomatis hilang saat tab ditutup (tidak ada PII yang menetap).
    // Umur maksimum sesi tersimpan yang boleh dipakai untuk menggambar
    // kerangka aplikasi sebelum verifikasi ulang gateway selesai.
    var EARLY_SESSION_MAX_MS = 5 * 60 * 1000;
    var READ_CACHE_PREFIX = 'rw_read_v1:';
    // Batas per entri agar satu daftar besar (mis. 2000 baris) tidak menghabiskan
    // kuota sessionStorage (~5 MB) dan menggagalkan cache entri lain.
    var PERSIST_MAX_BYTES = 262144;
    var PERSIST_ACTIONS = {
        rwSession: true, rwDashboard: true, rwList: true, rwUsersList: true,
        rwRegistryList: true, rwSettingsGet: true, rwAuditList: true, rwOutboxList: true
    };

    function sessionStore() {
        try {
            if (typeof sessionStorage === 'undefined' || !sessionStorage) return null;
            return sessionStorage;
        } catch (e) { return null; }
    }

    function persistEntry(key, entry) {
        var action = String(key).split('|')[0];
        if (!PERSIST_ACTIONS[action]) return;
        var store = sessionStore();
        if (!store) return;
        var raw;
        try {
            raw = JSON.stringify({ v: BUILD, at: entry.at, data: entry.data });
        } catch (e) { return; }
        if (!raw || raw.length > PERSIST_MAX_BYTES) return;
        try {
            store.setItem(READ_CACHE_PREFIX + key, raw);
        } catch (e) {
            // Kuota penuh: buang cache persisten lain lalu coba sekali lagi.
            // Cache memori tetap berjalan apa pun hasilnya.
            clearPersistedCache();
            try { store.setItem(READ_CACHE_PREFIX + key, raw); } catch (e2) {}
        }
    }

    // Muat kembali entri cache dari sesi tab. Entri dari build lain diabaikan
    // agar data lama tidak tampil setelah deploy.
    function hydrateReadCache() {
        var store = sessionStore();
        if (!store) return;
        try {
            var drop = [];
            for (var i = 0; i < store.length; i++) {
                var sk = store.key(i);
                if (!sk || sk.indexOf(READ_CACHE_PREFIX) !== 0) continue;
                var raw = store.getItem(sk);
                var entry = null;
                try { entry = raw ? JSON.parse(raw) : null; } catch (e) { entry = null; }
                var key = sk.slice(READ_CACHE_PREFIX.length);
                var action = key.split('|')[0];
                if (!entry || entry.v !== BUILD || !PERSIST_ACTIONS[action] ||
                    !entry.at || Date.now() - entry.at >= READ_CACHE_MAX_MS) {
                    drop.push(sk);
                    continue;
                }
                readCache[key] = { at: entry.at, data: entry.data };
            }
            drop.forEach(function (sk) { try { store.removeItem(sk); } catch (e) {} });
        } catch (e) {
            // Akses storage gagal: lanjut tanpa cache persisten.
        }
    }

    function clearPersistedCache() {
        var store = sessionStore();
        if (!store) return;
        try {
            var drop = [];
            for (var i = 0; i < store.length; i++) {
                var sk = store.key(i);
                if (sk && sk.indexOf(READ_CACHE_PREFIX) === 0) drop.push(sk);
            }
            drop.forEach(function (sk) { try { store.removeItem(sk); } catch (e) {} });
        } catch (e) {}
    }

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
        var gen = cacheGeneration;
        var promise = apiOnce(action, payload, 1).then(function (data) {
            if (READ_TTL_MS[action] !== 0 && gen === cacheGeneration) {
                readCache[key] = { at: Date.now(), data: data };
                persistEntry(key, readCache[key]);
            }
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
        var gen = cacheGeneration;
        var promise = apiOnce(action, payload, 0).then(function (data) {
            // Pembersihan cache terjadi saat revalidasi berjalan: hasil ini
            // tidak boleh dikembalikan ke cache maupun menggambar ulang.
            if (gen !== cacheGeneration) return data;
            var before = readCache[key] ? JSON.stringify(readCache[key].data) : '';
            readCache[key] = { at: Date.now(), data: data };
            persistEntry(key, readCache[key]);
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
        // Renderer memanggil setSync setelah filter diterapkan, jadi ini titik
        // yang tepat untuk menyelaraskan URL dan memulihkan fokus kotak cari.
        restoreSearchFocus();
        syncHash();
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
        // Judul tab mengikuti halaman aktif agar mudah dibedakan saat banyak
        // tab portal terbuka, dan ikut terbaca pembaca layar.
        try { document.title = meta[0] + ' · RW 06'; } catch (e) {}
        var admin = isAdmin();
        document.querySelectorAll('.nav-item').forEach(function (btn) {
            var page = btn.getAttribute('data-page');
            var active = page === state.page;
            btn.classList.toggle('active', active);
            if (active) btn.setAttribute('aria-current', 'page');
            else btn.removeAttribute('aria-current');
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
        // Sudah ada ringkasan (dari cache memori/sesi): tampilkan seketika dan
        // perbarui di latar belakang. Ini menghapus jeda "Memuat..." saat
        // berpindah menu atau memuat ulang halaman.
        if (state.dashboard && !force) {
            revalidate('rwDashboard', null);
            return Promise.resolve(state.dashboard);
        }
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

    // ================= FILTER PERIODE & CETAK =================
    // Tanggal RT tersimpan ISO (yyyy-mm-dd) atau waktu lokal/UTC. Semua
    // perbandingan periode memakai komponen yyyy-mm-dd agar batas hari tidak
    // bergeser karena zona waktu.
    function toIsoDay(value) {
        if (isBlank(value)) return '';
        var s = String(value);
        var j = jakartaParts(s);
        if (j) return j.year + '-' + j.month + '-' + j.day;
        var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return m[1] + '-' + m[2] + '-' + m[3];
        var dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
        if (dmy) return dmy[3] + '-' + dmy[2] + '-' + dmy[1];
        var d = new Date(s);
        if (!isNaN(d.getTime())) {
            var p = jakartaParts(d.toISOString());
            if (p) return p.year + '-' + p.month + '-' + p.day;
        }
        return '';
    }

    function periodMatch(value, from, to) {
        var day = toIsoDay(value);
        if (!day) return !from && !to;
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
    }

    function periodActive(f) {
        return !!(f && (f.from || f.to));
    }

    // Tanggal "hari ini" menurut Asia/Jakarta, bukan zona waktu perangkat,
    // agar preset periode konsisten dengan tanggal yang dilihat pengurus.
    function jakartaDay(date) {
        try {
            var parts = new Intl.DateTimeFormat('en-GB', {
                timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
            }).formatToParts(date || new Date());
            var out = {};
            parts.forEach(function (p) { out[p.type] = p.value; });
            return out.year + '-' + out.month + '-' + out.day;
        } catch (e) { return ''; }
    }

    function addDays(isoDay, delta) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || ''));
        if (!m) return '';
        var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
        d.setUTCDate(d.getUTCDate() + delta);
        return d.toISOString().slice(0, 10);
    }

    // Preset periode yang paling sering dipakai bagian administrasi. Rentang
    // dihitung dalam komponen tanggal saja agar batas hari tidak bergeser.
    var PERIOD_PRESETS = [
        { value: 'today', label: 'Hari ini' },
        { value: 'last7', label: '7 hari terakhir' },
        { value: 'thismonth', label: 'Bulan ini' },
        { value: 'lastmonth', label: 'Bulan lalu' }
    ];

    function presetRange(preset) {
        var today = jakartaDay(new Date());
        if (!today) return null;
        if (preset === 'today') return { from: today, to: today };
        if (preset === 'last7') return { from: addDays(today, -6), to: today };
        if (preset === 'thismonth') return { from: today.slice(0, 8) + '01', to: today };
        if (preset === 'lastmonth') {
            var m = /^(\d{4})-(\d{2})/.exec(today);
            var first = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 2, 1));
            var last = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 0));
            return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
        }
        return null;
    }

    function presetLabel(preset) {
        for (var i = 0; i < PERIOD_PRESETS.length; i++) {
            if (PERIOD_PRESETS[i].value === preset) return PERIOD_PRESETS[i].label;
        }
        return '';
    }

    function periodLabel(f) {
        if (!periodActive(f)) return 'Semua periode';
        var from = f.from ? fmtDay(f.from) : 'awal';
        var to = f.to ? fmtDay(f.to) : 'sekarang';
        var fast = presetLabel(f && f.preset);
        return (fast ? fast + ' (' : 'Periode ') + from + ' s.d. ' + to + (fast ? ')' : '');
    }

    function periodControls(prefix, f) {
        var options = PERIOD_PRESETS.map(function (p) {
            return '<option value="' + esc(p.value) + '"' + (f.preset === p.value ? ' selected' : '') + '>' + esc(p.label) + '</option>';
        }).join('');
        return '<div class="field"><label for="' + esc(prefix) + '-preset">Periode cepat</label>' +
                '<select class="control" id="' + esc(prefix) + '-preset">' +
                    '<option value=""' + (!f.preset ? ' selected' : '') + '>Rentang manual</option>' +
                    options +
                '</select></div>' +
            '<div class="field"><label for="' + esc(prefix) + '-from">Dari tanggal</label>' +
                '<input type="date" class="control" id="' + esc(prefix) + '-from" value="' + esc(f.from || '') + '"></div>' +
            '<div class="field"><label for="' + esc(prefix) + '-to">Sampai tanggal</label>' +
                '<input type="date" class="control" id="' + esc(prefix) + '-to" value="' + esc(f.to || '') + '"></div>' +
            (periodActive(f)
                ? '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="' + esc(prefix) + '-clear"><i class="fa-solid fa-filter-circle-xmark"></i> Reset periode</button></div>'
                : '');
    }

    // ================= URUTAN KOLOM =================
    // Spesifikasi nilai per kolom yang bisa diurutkan. Tipe `num` membandingkan
    // angka, `time` memakai komponen tanggal ISO agar urutan kronologis benar
    // walau format tampilan berbeda-beda.
    function sortTimeValue(row, keys) {
        for (var i = 0; i < keys.length; i++) {
            var raw = row[keys[i]];
            if (isBlank(raw)) continue;
            var day = toIsoDay(raw);
            if (!day) continue;
            // Jam memakai komponen Asia/Jakarta agar entri pada hari yang sama
            // tetap terurut kronologis, bukan menurut akhiran zona waktu.
            var j = jakartaParts(String(raw));
            var clock = j && j.hour !== undefined ? j.hour + ':' + j.minute : '';
            return day + ' ' + clock;
        }
        return '';
    }

    var SORT_SPECS = {
        warga: {
            nama: { type: 'text', get: function (r) { return r['Nama Lengkap']; } },
            nik: { type: 'text', get: function (r) { return r['NIK']; } },
            hp: { type: 'text', get: function (r) { return r['No HP']; } },
            alamat: { type: 'text', get: function (r) { return r['Alamat/No Rumah']; } },
            status: { type: 'text', get: function (r) { return r['Status']; } },
            pekerjaan: { type: 'text', get: function (r) { return r['Pekerjaan']; } }
        },
        kas: {
            time: { type: 'time', get: function (r) { return sortTimeValue(r, ['Tanggal', 'Timestamp']); } },
            warga: { type: 'text', get: function (r) { return r['Nama Warga']; } },
            jenis: { type: 'text', get: function (r) { return r['Jenis Transaksi']; } },
            nominal: { type: 'num', get: function (r) { return Number(r['Jumlah (Rp)']) || 0; } }
        },
        surat: {
            time: { type: 'time', get: function (r) { return sortTimeValue(r, ['Timestamp', 'Tanggal']); } },
            pemohon: { type: 'text', get: function (r) { return r['Nama Lengkap Pemohon']; } },
            status: { type: 'text', get: function (r) { return r['Rw Status']; } },
            revisi: { type: 'num', get: function (r) { return Number(r['Rw Revisi']) || 0; } }
        },
        lapor: {
            time: { type: 'time', get: function (r) { return sortTimeValue(r, ['Timestamp']); } },
            warga: { type: 'text', get: function (r) { return r['Nama Warga']; } },
            status: { type: 'text', get: function (r) { return r['Rw Status']; } },
            updated: { type: 'time', get: function (r) { return sortTimeValue(r, ['Rw Diperbarui']); } }
        },
        audit: {
            time: { type: 'time', get: function (r) { return sortTimeValue(r, ['Waktu']); } },
            user: { type: 'text', get: function (r) { return r['Aktor']; } },
            aksi: { type: 'text', get: function (r) { return r['Aksi']; } },
            hasil: { type: 'text', get: function (r) { return r['Hasil']; } }
        }
    };

    function defaultSortDir(page, key) {
        var def = (SORT_SPECS[page] || {})[key];
        if (!def) return 'asc';
        return def.type === 'time' || def.type === 'num' ? 'desc' : 'asc';
    }

    function sortRows(rows, page) {
        var spec = state.sorts[page];
        var def = spec && spec.key ? (SORT_SPECS[page] || {})[spec.key] : null;
        if (!def) return (rows || []).slice();
        var dir = spec.dir === 'asc' ? 1 : -1;
        return (rows || []).slice().sort(function (a, b) {
            var va = def.get(a);
            var vb = def.get(b);
            var c;
            if (def.type === 'num') {
                c = (Number(va) || 0) - (Number(vb) || 0);
            } else {
                c = String(va === null || va === undefined ? '' : va)
                    .localeCompare(String(vb === null || vb === undefined ? '' : vb), 'id', { numeric: true });
            }
            return c * dir;
        });
    }

    function sortHeader(page, key, label, sub, numeric) {
        var spec = state.sorts[page] || {};
        var active = spec.key === key;
        var icon = active ? (spec.dir === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short') : 'fa-sort';
        var sortAttr = active ? (spec.dir === 'asc' ? 'ascending' : 'descending') : 'none';
        return '<th class="th-sort' + (active ? ' is-active' : '') + (numeric ? ' num' : '') + '" scope="col" aria-sort="' + sortAttr + '">' +
            '<button type="button" class="th-sort-btn" data-sort-page="' + esc(page) + '" data-sort-key="' + esc(key) + '">' +
                '<span' + (sub ? ' class="th-stack"' : '') + '>' + esc(label) + '</span>' +
                (sub ? '<span class="th-sub">' + esc(sub) + '</span>' : '') +
                '<i class="fa-solid ' + icon + ' th-sort-icon" aria-hidden="true"></i>' +
            '</button></th>';
    }

    // Data Warga hanya menggambar ulang tbody, jadi status header diperbarui
    // langsung di DOM agar panah dan aria-sort selalu mencerminkan urutan aktif.
    function refreshSortHeaders(page) {
        var spec = state.sorts[page] || {};
        document.querySelectorAll('[data-sort-page]').forEach(function (btn) {
            if (btn.getAttribute('data-sort-page') !== page) return;
            var th = btn.parentNode;
            var key = btn.getAttribute('data-sort-key');
            var active = spec.key === key;
            if (th && th.classList) th.classList.toggle('is-active', active);
            if (th && th.setAttribute) {
                th.setAttribute('aria-sort', active ? (spec.dir === 'asc' ? 'ascending' : 'descending') : 'none');
            }
            var icon = btn.querySelector ? btn.querySelector('.th-sort-icon') : null;
            if (icon) {
                icon.className = 'fa-solid th-sort-icon ' +
                    (active ? (spec.dir === 'asc' ? 'fa-arrow-up-short-wide' : 'fa-arrow-down-wide-short') : 'fa-sort');
            }
        });
    }

    function bindSort(page, rerender) {
        document.querySelectorAll('[data-sort-page]').forEach(function (btn) {
            if (btn.getAttribute('data-sort-page') !== page) return;
            btn.addEventListener('click', function () {
                var key = btn.getAttribute('data-sort-key');
                var spec = state.sorts[page] || (state.sorts[page] = { key: key, dir: 'asc' });
                if (spec.key === key) spec.dir = spec.dir === 'asc' ? 'desc' : 'asc';
                else { spec.key = key; spec.dir = defaultSortDir(page, key); }
                state.pages[page] = 1;
                rerender();
                refreshSortHeaders(page);
            });
        });
    }

    // ================= EKSPOR CSV =================
    // CSV memakai baris hasil filter yang sama dengan tabel dan cetak, jadi
    // pengurus tidak perlu menyusun ulang data di Sheets/Excel.
    function csvCell(value) {
        var s = value === null || value === undefined ? '' : String(value);
        // Cegah formula injection: Excel menjalankan sel yang diawali =, +, -,
        // atau @. Awali dengan apostrof agar tetap terbaca sebagai teks.
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/[",\n\r;]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    }

    function buildCsv(headers, rows) {
        var lines = [headers.map(csvCell).join(';')];
        (rows || []).forEach(function (row) {
            lines.push((row || []).map(csvCell).join(';'));
        });
        // BOM + CRLF agar Excel (khususnya versi Windows) membuka UTF-8 dan
        // pemisah titik koma dengan benar tanpa wizard impor.
        return '\ufeff' + lines.join('\r\n') + '\r\n';
    }

    function todayStamp() {
        return jakartaDay(new Date()) || new Date().toISOString().slice(0, 10);
    }

    function downloadCsv(filename, content) {
        try {
            if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
                toast('Browser ini tidak mendukung unduhan CSV.', 'error');
                return false;
            }
            var blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
            toast('CSV ' + filename + ' diunduh.', 'success');
            return true;
        } catch (e) {
            toast('Gagal membuat berkas CSV.', 'error');
            return false;
        }
    }

    function exportWargaCsv(rows, f) {
        var headers = ['No', 'No. KK', 'NIK', 'Nama Lengkap', 'Status', 'No HP', 'Alamat/No Rumah', 'Pekerjaan', 'Pendidikan'];
        var data = sortWargaByKk(rows).map(function (r, i) {
            return [i + 1, kkValue(r), r['NIK'], r['Nama Lengkap'], r['Status'], r['No HP'], r['Alamat/No Rumah'], r['Pekerjaan'], r['Pendidikan']];
        });
        downloadCsv('warga-' + (f.rt || 'rw06') + '-' + todayStamp() + '.csv', buildCsv(headers, data));
    }

    function exportKasCsv(rows, f) {
        var headers = ['Tanggal', 'Nama Warga', 'No Rumah', 'Jenis Transaksi', 'Jumlah (Rp)', 'Keterangan', 'Arsip', 'Reversal Dari'];
        var data = (rows || []).map(function (r) {
            return [
                fmtDay(r['Tanggal'] || r['Timestamp']),
                r['Nama Warga'], r['No Rumah'], r['Jenis Transaksi'],
                Number(r['Jumlah (Rp)']) || 0,
                r['Keterangan'],
                isArchived(r['Diarsipkan']) ? 'Ya' : 'Tidak',
                r['Reversal Dari']
            ];
        });
        downloadCsv('kas-' + (f.rt || 'rw06') + '-' + todayStamp() + '.csv', buildCsv(headers, data));
    }

    function exportSuratCsv(rows, f) {
        var headers = ['Tanggal', 'Nama Pemohon', 'NIK', 'Jenis Surat', 'No. Surat', 'Keperluan', 'Status RT', 'Status RW', 'Revisi', 'Catatan RW', 'Diperbarui'];
        var data = (rows || []).map(function (r) {
            return [
                fmtDay(r['Timestamp']),
                r['Nama Lengkap Pemohon'], r['NIK'], r['Jenis Surat'], r['No. Surat'],
                r['Keperluan / Alasan Pengajuan'], r['Status Pengurusan'], r['Rw Status'],
                Number(r['Rw Revisi']) || 0, r['Rw Catatan'], fmtDay(r['Rw Tanggal'])
            ];
        });
        downloadCsv('surat-' + (f.rt || 'rw06') + '-' + todayStamp() + '.csv', buildCsv(headers, data));
    }

    function exportLaporCsv(rows, f) {
        // Catatan tanggapan RW tersimpan sebagai linimasa di sheet
        // Lapor_Tindak_Lanjut, bukan kolom di Lapor_Aspirasi, jadi CSV memuat
        // catatan RT dan petugas RW yang memang ada pada baris ini.
        var headers = ['Tanggal', 'No. Pengaduan', 'Nama Warga', 'Alamat / No. Rumah', 'Jenis Pengaduan', 'Judul Pengaduan', 'Detail', 'Harapan / Solusi', 'Status RT', 'Catatan RT', 'Status RW', 'Petugas RW', 'Diperbarui'];
        var data = (rows || []).map(function (r) {
            return [
                fmtDay(r['Timestamp']), r['No. Pengaduan'], r['Nama Warga'], r['Alamat / No. Rumah'],
                r['Jenis Pengaduan'], r['Judul Pengaduan'], r['Detail Pengaduan'], r['Harapan / Solusi'],
                r['Status'], r['Catatan Tindak Lanjut'], r['Rw Status'], r['Rw Petugas'],
                fmtDay(r['Rw Diperbarui'])
            ];
        });
        downloadCsv('pengaduan-' + (f.rt || 'rw06') + '-' + todayStamp() + '.csv', buildCsv(headers, data));
    }

    function csvButton(id, label) {
        return '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="' + esc(id) + '">' +
            '<i class="fa-solid fa-file-csv"></i> ' + esc(label || 'Ekspor CSV') + '</button></div>';
    }

    // Kotak cari generik untuk daftar selain Data Warga. Pencarian dilakukan
    // di sisi klien atas data yang sudah diambil, jadi tidak memicu permintaan
    // baru ke orkestrator dan tetap cepat setelah cache hangat.
    function searchControl(id, value, placeholder) {
        return '<div class="field" style="flex:1;min-width:220px"><label for="' + esc(id) + '">Cari</label>' +
            '<span class="search-wrap"><i class="fa-solid fa-magnifying-glass"></i>' +
            '<input class="control" id="' + esc(id) + '" placeholder="' + esc(placeholder) + '" value="' + esc(value || '') + '"></span></div>';
    }

    function filterByQuery(rows, query, fields) {
        var q = String(query || '').trim();
        if (!q) return rows || [];
        return (rows || []).filter(function (row) {
            return fields.some(function (field) {
                return String(row[field] === null || row[field] === undefined ? '' : row[field])
                    .toLowerCase().indexOf(q.toLowerCase()) !== -1;
            });
        });
    }

    // Renderer daftar mengganti seluruh isi #page secara asinkron, jadi kotak
    // cari yang sedang dipakai ikut hancur. Fokus dan posisi kursor dicatat di
    // sini lalu dipulihkan setelah render selesai (lihat setSync) supaya
    // pengguna bisa mengetik lebih dari satu huruf.
    var pendingSearchFocus = null;

    function bindSearch(id, f, rerender) {
        var input = $(id);
        if (!input) return;
        input.addEventListener('input', function (e) {
            f.q = e.target.value;
            state.pages[state.page] = 1;
            pendingSearchFocus = {
                id: id,
                caret: typeof e.target.selectionStart === 'number' ? e.target.selectionStart : String(f.q).length
            };
            rerender();
        });
    }

    function restoreSearchFocus() {
        var pending = pendingSearchFocus;
        if (!pending) return;
        pendingSearchFocus = null;
        var input = $(pending.id);
        if (!input || !input.focus) return;
        try {
            input.focus();
            if (input.setSelectionRange) {
                var pos = typeof pending.caret === 'number' ? pending.caret : String(input.value || '').length;
                input.setSelectionRange(pos, pos);
            }
        } catch (e) { /* diabaikan: fokus bukan hal kritis */ }
    }

    function bindPeriodControls(prefix, f, rerender) {
        var from = $(prefix + '-from');
        var to = $(prefix + '-to');
        var preset = $(prefix + '-preset');
        function apply() {
            f.from = from ? from.value : '';
            f.to = to ? to.value : '';
            // Mengubah tanggal secara manual berarti preset tidak lagi akurat.
            f.preset = '';
            state.pages[state.page] = 1;
            rerender();
        }
        if (from) from.addEventListener('change', apply);
        if (to) to.addEventListener('change', apply);
        if (preset) {
            preset.addEventListener('change', function (e) {
                var value = e.target.value;
                f.preset = value;
                if (value) {
                    var range = presetRange(value);
                    if (range && from) from.value = range.from;
                    if (range && to) to.value = range.to;
                    f.from = range && range.from || '';
                    f.to = range && range.to || '';
                }
                state.pages[state.page] = 1;
                rerender();
            });
        }
        var clear = $(prefix + '-clear');
        if (clear) clear.addEventListener('click', function () {
            f.from = ''; f.to = ''; f.preset = '';
            state.pages[state.page] = 1;
            rerender();
        });
    }

    // Jendela cetak dibuka dari klik pengguna dan langsung memanggil print()
    // setelah dokumen siap sehingga tidak perlu izin script tambahan.
    // `onReady` dijalankan setelah dokumen ditulis dan sebelum print (dipakai
    // untuk paginasi laporan).
    function openPrintHtml(title, html, onReady) {
        var w = window.open('', '_blank');
        if (!w) { toast('Izinkan pop-up untuk mencetak laporan.', 'error'); return false; }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        var doPrint = function () {
            if (typeof onReady === 'function') { try { onReady(w); } catch (e) { /* diabaikan */ } }
            try { w.print(); } catch (e) { /* diabaikan */ }
        };
        if (w.document.readyState === 'complete') setTimeout(doPrint, 250);
        else w.onload = function () { setTimeout(doPrint, 250); };
        return true;
    }

    // Laporan dipaginasi manual. Skrip inline dilarang CSP portal, jadi
    // pengukuran baris dilakukan dari jendela pembuka (dokumen `about:blank`
    // tetap satu origin). Bila DOM asli tidak tersedia, laporan tetap tampil
    // memakai pembagian statis yang sudah tertulis di HTML.
    // Kop berulang di setiap halaman, meta/kartu hanya di halaman pertama,
    // "Hal X/Y" di setiap footer. Orientasi mengikuti format laporan.
    var PRINT_PAGE_ROWS = { portrait: 18, landscape: 12 };
    var PRINT_FIRST_PAGE_RESERVE = 3;
    var PRINT_MAX_ROWS = { portrait: 60, landscape: 40 };
    function paginatePrintWindow(w, opts) {
        var staticHtml = null, pagesEl = null, doc = null;
        try {
            doc = w && w.document;
            if (!doc || typeof doc.getElementById !== 'function') return false;
            var srcBody = doc.getElementById('src-body');
            var srcHead = doc.getElementById('src-head');
            pagesEl = doc.getElementById('pages');
            var headTplEl = doc.getElementById('tpl-head');
            var metaTplEl = doc.getElementById('tpl-meta');
            var footTplEl = doc.getElementById('tpl-foot');
            if (!srcBody || !srcHead || !pagesEl || !headTplEl || !footTplEl) return false;
            var rows = Array.prototype.slice.call(srcBody.rows);
            if (!rows.length) return false;
            var rowH = rows.map(function (r) { return r.getBoundingClientRect().height; });
            var headH = srcHead.getBoundingClientRect().height;
            if (!(headH > 0) || !(rowH[0] > 0)) return false;
            var headTpl = headTplEl.innerHTML;
            var metaTpl = metaTplEl ? metaTplEl.innerHTML : '';
            var footTpl = footTplEl.innerHTML;
            var theadHtml = srcHead.innerHTML;
            var perPage = opts.maxRows || 0;
            staticHtml = pagesEl.innerHTML;
            // Halaman diukur dalam keadaan terpasang (bukan fragment) agar
            // clientHeight memakai A4 asli. Bila gagal, laporan statis dipulihkan.
            pagesEl.innerHTML = '';
            var idx = 0, total = 0;
            while (idx < rows.length) {
                var page = doc.createElement('div');
                page.className = 'page';
                var inner = doc.createElement('div');
                inner.className = 'inner';
                var top = doc.createElement('div');
                top.innerHTML = headTpl;
                inner.appendChild(top);
                if (total === 0 && metaTpl) {
                    var meta = doc.createElement('div');
                    meta.innerHTML = metaTpl;
                    inner.appendChild(meta);
                }
                var table = doc.createElement('table');
                table.innerHTML = '<thead>' + theadHtml + '</thead><tbody></tbody>';
                inner.appendChild(table);
                var foot = doc.createElement('div');
                foot.className = 'pf';
                foot.innerHTML = footTpl;
                inner.appendChild(foot);
                page.appendChild(inner);
                pagesEl.appendChild(page);
                var avail = inner.clientHeight
                    - top.getBoundingClientRect().height
                    - foot.getBoundingClientRect().height - 14;
                if (!(avail > headH + 40)) { pagesEl.innerHTML = staticHtml; return false; }
                var used = headH, added = 0;
                var tb = table.tBodies[0];
                while (idx < rows.length && (!perPage || added < perPage)) {
                    var h = rowH[idx];
                    if (added > 0 && used + h > avail) break;
                    tb.appendChild(rows[idx].cloneNode(true));
                    used += h; idx++; added++;
                }
                total++;
                if (added === 0) { pagesEl.innerHTML = staticHtml; return false; }
            }
            if (!total) { pagesEl.innerHTML = staticHtml; return false; }
            var pages = pagesEl.children;
            for (var i = 0; i < pages.length; i++) {
                var pn = pages[i].querySelector('.pn');
                if (pn) pn.textContent = 'Hal ' + (i + 1) + '/' + pages.length;
            }
            var src = doc.getElementById('source');
            if (src && src.parentNode) src.parentNode.removeChild(src);
            return true;
        } catch (e) {
            if (pagesEl && staticHtml !== null) { try { pagesEl.innerHTML = staticHtml; } catch (err) { /* diabaikan */ } }
            return false;
        }
    }

    function openPagedReport(opts) {
        var landscape = opts.orientation === 'landscape';
        var pageSize = landscape ? 'A4 landscape' : 'A4 portrait';
        var pageW = landscape ? 297 : 210;
        var pageH = landscape ? 210 : 297;
        var staticPerPage = opts.rowsPerPage || (landscape ? PRINT_PAGE_ROWS.landscape : PRINT_PAGE_ROWS.portrait);
        var perPage = opts.maxRows || (landscape ? PRINT_MAX_ROWS.landscape : PRINT_MAX_ROWS.portrait);
        var headHtml = '<div class="head"><h1>' + esc(opts.title) + '</h1>' +
            (opts.subtitle ? '<p class="sub">' + esc(opts.subtitle) + '</p>' : '') +
            '<p class="sub">RW 06 · Portal Pengurus</p></div>';
        var metaHtml = '<div class="meta"><span>' + esc(opts.meta || '') + '</span>' +
            '<span>Dicetak: ' + esc(fmtStamp(new Date().toISOString())) + '</span></div>' +
            (opts.cardsHtml || '');
        var footLeft = esc(opts.footerLeft || '');
        var dataRows = (opts.rows && opts.rows.length)
            ? opts.rows.slice()
            : ['<tr><td colspan="' + (opts.colCount || 1) + '">' + esc(opts.emptyText || 'Tidak ada data.') + '</td></tr>'];

        // Pembagian statis: dipakai apa adanya bila pengukuran DOM tidak
        // tersedia, dan tetap menjadi isi awal sebelum paginasi halus.
        var chunks = [], idx = 0;
        while (idx < dataRows.length) {
            var cap = chunks.length === 0
                ? Math.max(4, staticPerPage - PRINT_FIRST_PAGE_RESERVE)
                : staticPerPage;
            chunks.push(dataRows.slice(idx, idx + cap));
            idx += cap;
        }
        if (!chunks.length) chunks.push(dataRows);
        var total = chunks.length;
        var pagesHtml = chunks.map(function (chunk, i) {
            return '<div class="page"><div class="inner">' + headHtml +
                (i === 0 ? metaHtml : '') +
                '<table><thead>' + opts.theadHtml + '</thead><tbody>' + chunk.join('') + '</tbody></table>' +
                '<div class="pf"><span>' + footLeft + '</span><span class="pn">Hal ' + (i + 1) + '/' + total + '</span></div>' +
                '</div></div>';
        }).join('');
        var styles = '<style>' +
            '*{box-sizing:border-box}' +
            'body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;background:#fff;font-size:11px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
            '.page{width:' + pageW + 'mm;height:' + pageH + 'mm;padding:12mm;overflow:hidden;page-break-after:always}' +
            '.page:last-child{page-break-after:auto}' +
            '.inner{display:flex;flex-direction:column;height:100%}' +
            '.head{border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px}' +
            '.head h1{margin:0;font-size:17px;text-align:center}' +
            '.head .sub{margin:2px 0;font-size:11px;color:#334155;text-align:center}' +
            '.meta{display:flex;justify-content:space-between;margin:2px 0 10px;font-size:11px;color:#334155}' +
            '.cards{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}' +
            '.card{flex:1 1 22%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 9px}' +
            '.card .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}' +
            '.card .val{font-size:13px;font-weight:700;margin-top:2px}' +
            'table{width:100%;border-collapse:collapse}' +
            'th,td{border:1px solid #cbd5e1;padding:5px 7px;vertical-align:top}' +
            'th{background:#f1f5f9;text-align:center;vertical-align:middle;font-size:10px}' +
            'td.r{text-align:right}td.c,th.c{text-align:center}td.nw,th.nw{white-space:nowrap}' +
            'tr.tr-total td{font-weight:700;background:#f8fafc}' +
            'tr.tr-kk td{background:#f8fafc}tr.tr-kk td:nth-child(4){font-weight:700}' +
            '.pf{margin-top:auto;padding-top:6px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:9px;color:#64748b}' +
            '.src{position:absolute;left:-10000px;top:0;width:' + (pageW - 24) + 'mm}' +
            '@page{size:' + pageSize + ';margin:0}' +
            '</style>';
        var html = '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">' +
            '<title>' + esc(opts.docTitle || opts.title) + '</title>' + styles + '</head><body>' +
            '<div id="source" class="src"><table><thead id="src-head">' + opts.theadHtml +
            '</thead><tbody id="src-body">' + dataRows.join('') + '</tbody></table></div>' +
            '<template id="tpl-head">' + headHtml + '</template>' +
            '<template id="tpl-meta">' + metaHtml + '</template>' +
            '<template id="tpl-foot"><span>' + footLeft + '</span><span class="pn"></span></template>' +
            '<div id="pages">' + pagesHtml + '</div>' +
            '</body></html>';
        return openPrintHtml(opts.docTitle || opts.title, html, function (w) {
            paginatePrintWindow(w, { maxRows: perPage });
        });
    }

    function isKasOut(jenis) {
        var s = String(jenis || '').toLowerCase();
        return s === 'pengeluaran' || s === 'reversal keluar';
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
            { action: 'rwList', payload: { rtId: rtId, sheet: 'Data_Warga', limit: 2000, offset: 0, includeArchived: false } },
            { action: 'rwList', payload: { rtId: rtId, sheet: 'Pengajuan_Surat', limit: 2000, offset: 0, includeArchived: false } },
            { action: 'rwList', payload: { rtId: rtId, sheet: 'Lapor_Aspirasi', limit: 2000, offset: 0, includeArchived: false } },
            { action: 'rwList', payload: { rtId: rtId, sheet: 'Iuran_Kas', limit: 2000, offset: 0, includeArchived: true } }
        ];
        // Halaman administrasi hanya untuk RW Admin dan tidak ter-prefetch
        // sebelumnya, sehingga menu itu paling terasa "Memuat...". Ambil juga
        // di latar belakang (setelah daftar utama) agar klik menu langsung tampil.
        if (isAdmin()) {
            jobs.push({ action: 'rwUsersList', payload: null });
            jobs.push({ action: 'rwRegistryList', payload: null });
            jobs.push({ action: 'rwSettingsGet', payload: null });
            jobs.push({ action: 'rwOutboxList', payload: null });
            jobs.push({ action: 'rwAuditList', payload: { limit: 200 } });
        }
        jobs.forEach(function (job, i) {
            setTimeout(function () {
                if (apiPeek(job.action, job.payload)) return;
                api(job.action, job.payload).catch(function () {});
            }, 100 + i * 120);
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
                ['kpi-warga', 'Warga aktif', fmtInt(t.warga), 'jiwa', 'fa-users', '', { page: 'warga' }],
                ['kpi-kas', 'Saldo kas', fmtMoney(t.kasSaldo), 'gabungan semua RT', 'fa-wallet', 'money', { page: 'kas' }],
                ['kpi-surat', 'Surat menunggu', fmtInt(t.suratMenunggu), 'perlu keputusan RW', 'fa-file-signature', '', { page: 'surat' }],
                ['kpi-lapor', 'Pengaduan terbuka', fmtInt(t.laporTerbuka), 'belum selesai', 'fa-comment-dots', '', { page: 'lapor' }],
                ['kpi-eskalasi', 'Eskalasi RW', fmtInt(t.laporEskalasi), 'menunggu tindak lanjut', 'fa-paper-plane', '', { page: 'lapor', status: 'Perlu Tindak Lanjut' }]
            ];
            var ttl = Number(d.cacheTtlSeconds || 0) * 1000;
            var fresh = kpiFreshness(state.dashboardLoadedAt || d.generatedAt, ttl);
            var kpi = cards.map(function (c) {
                return '<button type="button" class="kpi-card kpi-link" id="' + esc(c[0]) + '" data-kpi-page="' + esc(c[6].page) + '"' +
                    (c[6].status ? ' data-kpi-status="' + esc(c[6].status) + '"' : '') +
                    ' title="Buka rincian ' + esc(c[1].toLowerCase()) + '">' +
                    '<span class="kpi-head"><span class="kpi-label">' + esc(c[1]) + '</span><span class="kpi-icon"><i class="fa-solid ' + c[4] + '"></i></span></span>' +
                    '<span class="kpi-value ' + c[5] + '">' + c[2] + '</span>' +
                    '<span class="kpi-note">' + esc(c[3]) + '<i class="fa-solid fa-arrow-right kpi-go"></i></span>' +
                    fresh + '</button>';
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
                        '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="warga-print"><i class="fa-solid fa-print"></i> Cetak laporan</button></div>' +
                        csvButton('warga-csv') +
                        (isAdmin() ? '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="warga-dup"><i class="fa-solid fa-clone"></i> Cek NIK ganda</button></div>' : '') +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>' + esc(f.rt) + '</h2><p id="warga-count">' + fmtInt(res.total) + ' warga aktif</p></div></div>' +
                    '<div class="card-hint"><i class="fa-solid fa-clock-rotate-left"></i> Klik <strong>Riwayat</strong> pada baris warga untuk melihat pengajuan surat dan pengaduan warga tersebut.</div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr>' +
                        sortHeader('warga', 'nama', 'Warga') +
                        sortHeader('warga', 'nik', 'NIK') +
                        sortHeader('warga', 'hp', 'No HP') +
                        sortHeader('warga', 'alamat', 'Alamat') +
                        sortHeader('warga', 'status', 'Status') +
                        sortHeader('warga', 'pekerjaan', 'Pekerjaan') +
                        '<th>Riwayat</th></tr></thead>' +
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
                bindSort('warga', paintWarga);
                $('warga-print').addEventListener('click', function () {
                    printWargaReport(filteredWarga(), { rt: f.rt, query: f.q });
                });
                $('warga-csv').addEventListener('click', function () {
                    exportWargaCsv(filteredWarga(), f);
                });
                var dupBtn = $('warga-dup');
                if (dupBtn) dupBtn.addEventListener('click', function () { openNikDuplicates(); });
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function filteredWarga() {
        var data = state.warga;
        if (!data) return [];
        var f = state.filters.warga;
        var q = String(f.q || '').trim().toLowerCase();
        var rows = q ? data.rows.filter(function (r) {
            return [r['Nama Lengkap'], r['Nomor KK'], r['NIK'], r['No HP'], r['Alamat/No Rumah'], r['Pekerjaan']]
                .some(function (v) { return String(v || '').toLowerCase().indexOf(q) !== -1; });
        }) : data.rows;
        // Tanpa kolom terpilih, pertahankan urutan resmi per Nomor KK.
        var spec = state.sorts.warga;
        return spec && spec.key ? sortRows(rows, 'warga') : sortWargaByKk(rows);
    }

    function isKepalaKeluarga(r) {
        return String(r && r['Status'] || '').trim().toLowerCase() === 'kepala keluarga';
    }

    // Urutan resmi laporan warga: Nomor KK menaik (numerik), lalu
    // Kepala Keluarga di awal tiap KK, anggota menyusul menurut nama.
    // KK kosong diletakkan di akhir. Dipakai tabel layar dan laporan cetak
    // agar yang tercetak sama dengan yang terlihat.
    function compareNomorKk(a, b) {
        var digits = /^\d+$/;
        if (digits.test(a) && digits.test(b)) {
            if (a.length !== b.length) return a.length - b.length;
        }
        return a < b ? -1 : (a > b ? 1 : 0);
    }

    function kkValue(r) {
        var v = r ? r['Nomor KK'] : '';
        return String(v === null || v === undefined ? '' : v).trim();
    }

    function sortWargaByKk(rows) {
        return (rows || []).slice().sort(function (a, b) {
            var ka = kkValue(a);
            var kb = kkValue(b);
            if (!ka || !kb) {
                if (!ka && kb) return 1;
                if (ka && !kb) return -1;
            } else {
                var c = compareNomorKk(ka, kb);
                if (c !== 0) return c;
            }
            var ra = isKepalaKeluarga(a) ? 0 : 1;
            var rb = isKepalaKeluarga(b) ? 0 : 1;
            if (ra !== rb) return ra - rb;
            var na = String(a && a['Nama Lengkap'] || '');
            var nb = String(b && b['Nama Lengkap'] || '');
            return na < nb ? -1 : (na > nb ? 1 : 0);
        });
    }

    function paintWarga() {
        var data = state.warga;
        if (!data) return;
        var f = state.filters.warga;
        var filtered = filteredWarga();
        var sliced = pageSlice(filtered, 'warga');
        var body = sliced.rows.map(function (r) {
            var kepala = isKepalaKeluarga(r);
            var rowId = String(r['ID'] || '');
            return '<tr' + (kepala ? ' class="kk-head"' : '') + '>' +
                '<td><span class="cell-main">' + esc(r['Nama Lengkap'] || '-') + '</span><span class="cell-sub">KK ' + esc(kkValue(r) || '-') + (kepala ? ' · kepala keluarga' : '') + '</span></td>' +
                '<td class="nowrap">' + esc(r['NIK'] || '-') + '</td>' +
                '<td class="nowrap">' + esc(r['No HP'] || '-') + '</td>' +
                '<td>' + esc(r['Alamat/No Rumah'] || '-') + '</td>' +
                '<td>' + esc(r['Status'] || '-') + '</td>' +
                '<td><span class="cell-main">' + esc(r['Pekerjaan'] || '-') + '</span><span class="cell-sub">' + esc(r['Pendidikan'] || '-') + '</span></td>' +
                '<td class="nowrap">' + (rowId
                    ? '<button type="button" class="btn btn-ghost btn-sm" id="warga-hist-' + esc(rowId) + '" data-warga-hist="' + esc(rowId) + '" title="Riwayat pengajuan surat dan pengaduan"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat</button>'
                    : '<span class="cell-sub">-</span>') + '</td>' +
                '</tr>';
        }).join('');
        var tbody = $('warga-body');
        if (tbody) tbody.innerHTML = body || '<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-users"></i><p>Tidak ada warga yang cocok.</p></div></td></tr>';
        bindWargaHistory(sliced.rows);
        var pager = $('warga-pager');
        if (pager) pager.innerHTML = pagerHtml('warga', sliced);
        bindPager('warga', paintWarga);
        var count = $('warga-count');
        if (count) count.textContent = fmtInt(filtered.length) + ' dari ' + fmtInt(data.res.total) + ' warga aktif';
    }

    // Riwayat per warga: pengajuan surat dan pengaduan dicocokkan lewat NIK
    // (digit saja). Bila NIK kosong/tersamar sehingga tidak bisa dipakai,
    // pencocokan jatuh ke nama yang dinormalkan. Hanya baca, tidak menulis.
    function wargaNikKey(value) {
        return String(value === null || value === undefined ? '' : value).replace(/\D/g, '');
    }

    function wargaNameKey(value) {
        return String(value === null || value === undefined ? '' : value).trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function belongsToWarga(warga, record) {
        var wNik = wargaNikKey(warga['NIK']);
        var rNik = wargaNikKey(record && record['NIK']);
        // NIK tersamar untuk RW Viewer hanya menyisakan 4 digit terakhir, yang
        // terlalu pendek untuk pencocokan aman; dalam kondisi itu (atau NIK
        // kosong) pencocokan jatuh ke nama.
        if (wNik.length >= 8 && rNik.length >= 8) return wNik === rNik;
        var wName = wargaNameKey(warga['Nama Lengkap']);
        var rName = wargaNameKey(record && record['Nama Lengkap Pemohon'] !== undefined
            ? record['Nama Lengkap Pemohon'] : record && record['Nama Warga']);
        return !!(wName && rName && wName === rName);
    }

    function wargaHistoryHtml(warga, suratRows, laporRows, failedSheets) {
        var surat = (suratRows || []).filter(function (r) { return belongsToWarga(warga, r); })
            .sort(function (a, b) { return String(b['Timestamp'] || '').localeCompare(String(a['Timestamp'] || '')); });
        var lapor = (laporRows || []).filter(function (r) { return belongsToWarga(warga, r); })
            .sort(function (a, b) { return String(b['Timestamp'] || '').localeCompare(String(a['Timestamp'] || '')); });

        var suratHtml;
        if (!surat.length) {
            suratHtml = '<div class="empty" style="padding:18px 0"><i class="fa-solid fa-file-signature"></i><p>Belum ada pengajuan surat untuk warga ini.</p></div>';
        } else {
            suratHtml = '<div class="table-wrap"><table>' +
                '<thead><tr><th>Tanggal</th><th>Jenis surat / No. Surat</th><th>Status RT</th><th>Status RW</th><th>Aksi</th></tr></thead><tbody>' +
                surat.map(function (r) {
                    return '<tr class="clickable" data-hist-surat="' + esc(r['ID'] || '') + '">' +
                        '<td class="nowrap">' + fmtDay(r['Timestamp']) + '</td>' +
                        '<td><span class="cell-main">' + esc(r['Jenis Surat'] || '-') + '</span><span class="cell-sub">' + esc(r['No. Surat'] || 'Belum bernomor') + '</span></td>' +
                        '<td>' + rtSuratBadge(r['Status Pengurusan']) + '</td>' +
                        '<td>' + rwSuratBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap"><button type="button" class="btn btn-ghost btn-sm" data-hist-open-surat="' + esc(r['ID'] || '') + '"><i class="fa-solid fa-up-right-from-square"></i> Buka</button></td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table></div>';
        }

        var laporHtml;
        if (!lapor.length) {
            laporHtml = '<div class="empty" style="padding:18px 0"><i class="fa-solid fa-comment-dots"></i><p>Belum ada pengaduan dari warga ini.</p></div>';
        } else {
            laporHtml = '<div class="table-wrap"><table>' +
                '<thead><tr><th>Tanggal / nomor</th><th>Pengaduan</th><th>Status RT</th><th>Status RW</th><th>Aksi</th></tr></thead><tbody>' +
                lapor.map(function (r) {
                    return '<tr class="clickable" data-hist-lapor="' + esc(r['ID'] || '') + '">' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDay(r['Timestamp']) + '</span><span class="cell-sub">' + esc(r['No. Pengaduan'] || '-') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Judul Pengaduan'] || '-') + '</span><span class="cell-sub">' + esc(r['Jenis Pengaduan'] || '') + '</span></td>' +
                        '<td>' + rtLaporBadge(r['Status']) + '</td>' +
                        '<td>' + rwLaporBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap"><button type="button" class="btn btn-ghost btn-sm" data-hist-open-lapor="' + esc(r['ID'] || '') + '"><i class="fa-solid fa-up-right-from-square"></i> Buka</button></td>' +
                        '</tr>';
                }).join('') +
                '</tbody></table></div>';
        }

        var failure = (failedSheets || []).length
            ? '<div class="notice notice-warn"><i class="fa-solid fa-triangle-exclamation"></i><div>Riwayat ' +
                esc(failedSheets.join(' dan ')) + ' tidak dapat dimuat dari RT ini. Coba lagi atau periksa kesehatan RT.</div></div>'
            : '';
        return failure + '<div class="drawer-section tint tint-brand"><h3>Warga</h3><dl class="detail-list">' +
            detailRow('Nama', esc(warga['Nama Lengkap'] || '-')) +
            detailRow('NIK', esc(warga['NIK'] || '-')) +
            detailRow('No. KK', esc(kkValue(warga) || '-')) +
            detailRow('Status', esc(warga['Status'] || '-')) +
            detailRow('Alamat', esc(warga['Alamat/No Rumah'] || '-')) +
            '</dl></div>' +
            '<div class="drawer-section tint tint-blue"><h3>Riwayat pengajuan surat · ' + fmtInt(surat.length) + '</h3>' + suratHtml + '</div>' +
            '<div class="drawer-section tint tint-amber"><h3>Riwayat pengaduan · ' + fmtInt(lapor.length) + '</h3>' + laporHtml + '</div>' +
            '<p class="cell-sub" style="margin:0"><i class="fa-solid fa-circle-info"></i> Klik baris atau tombol <strong>Buka</strong> untuk melihat detail. Riwayat ini hanya untuk peninjauan; portal RW tidak mengubah data warga maupun pengajuan (FR-WRG-03).</p>';
    }

    function openWargaHistory(warga, rtId) {
        if (!warga) return;
        var title = warga['Nama Lengkap'] || 'Riwayat warga';
        openDrawer('Riwayat warga · ' + (rtId || '-'), title,
            '<div class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i>Memuat riwayat...</div>');
        var failed = [];
        var suratReq = api('rwList', { rtId: rtId, sheet: 'Pengajuan_Surat', limit: 2000, offset: 0, includeArchived: false })
            .then(function (res) { return rowsToObjects(res.headers, res.rows); },
                function () { failed.push('pengajuan surat'); return []; });
        var laporReq = api('rwList', { rtId: rtId, sheet: 'Lapor_Aspirasi', limit: 2000, offset: 0, includeArchived: false })
            .then(function (res) { return rowsToObjects(res.headers, res.rows); },
                function () { failed.push('pengaduan'); return []; });
        Promise.all([suratReq, laporReq]).then(function (results) {
            var body = $('drawer-body');
            if (!body) return;
            body.innerHTML = wargaHistoryHtml(warga, results[0], results[1], failed);
            bindWargaHistoryOpen(warga, rtId, results[0], results[1]);
        }).catch(function (err) {
            var body = $('drawer-body');
            if (body) body.innerHTML = '<div class="notice notice-error"><i class="fa-solid fa-circle-exclamation"></i><div>' +
                esc((err && err.message) || 'Gagal memuat riwayat warga.') + '</div></div>';
        });
    }

    // Baris riwayat dapat diklik untuk membuka detail aslinya (drawer surat atau
    // pengaduan). Tombol "Kembali" pada detail mengembalikan pengguna ke panel
    // riwayat warga yang sama.
    function bindWargaHistoryOpen(warga, rtId, suratRows, laporRows) {
        var back = function () { openWargaHistory(warga, rtId); };

        function findById(list, id) {
            return (list || []).find(function (r) { return String(r['ID']) === String(id); });
        }

        function bindPair(buttonAttr, rowAttr, rows, open) {
            ['[' + buttonAttr + ']', '[' + rowAttr + ']'].forEach(function (selector) {
                document.querySelectorAll(selector).forEach(function (node) {
                    if (node.getAttribute('data-hist-bound')) return;
                    node.setAttribute('data-hist-bound', '1');
                    node.addEventListener('click', function (e) {
                        if (e && e.stopPropagation) e.stopPropagation();
                        var record = findById(rows, node.getAttribute(buttonAttr) || node.getAttribute(rowAttr));
                        if (record) open(record);
                    });
                });
            });
        }

        bindPair('data-hist-open-surat', 'data-hist-surat', suratRows, function (record) {
            openSurat(record, rtId, back);
        });
        bindPair('data-hist-open-lapor', 'data-hist-lapor', laporRows, function (record) {
            openLapor(record, rtId, back);
        });
    }

    function bindWargaHistory(rows) {
        var rtId = state.filters.warga.rt;
        document.querySelectorAll('[data-warga-hist]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (e && e.stopPropagation) e.stopPropagation();
                var id = btn.getAttribute('data-warga-hist');
                var warga = (rows || state.warga && state.warga.rows || []).find(function (r) {
                    return String(r['ID']) === String(id);
                });
                if (warga) openWargaHistory(warga, rtId);
            });
        });
    }

    function printWargaReport(rows, meta) {
        // Urutan resmi: No. KK menaik, Kepala Keluarga di awal tiap KK.
        var sorted = sortWargaByKk(rows);
        var totalKK = {};
        sorted.forEach(function (r) { var kk = kkValue(r); if (kk) totalKK[kk] = true; });
        var totalKepala = sorted.filter(isKepalaKeluarga).length;
        var tableRows = sorted.map(function (r, idx) {
            var kepala = isKepalaKeluarga(r);
            var nama = esc(r['Nama Lengkap'] || '-');
            return '<tr' + (kepala ? ' class="tr-kk"' : '') + '>' +
                '<td class="c">' + (idx + 1) + '</td>' +
                '<td class="nw">' + esc(kkValue(r) || '-') + '</td>' +
                '<td class="nw">' + esc(r['NIK'] || '-') + '</td>' +
                '<td>' + (kepala ? '<strong>' + nama + '</strong>' : nama) + '</td>' +
                '<td class="c">' + esc(r['Status'] || '-') + '</td>' +
                '<td class="nw">' + esc(r['No HP'] || '-') + '</td>' +
                '<td>' + esc(r['Alamat/No Rumah'] || '-') + '</td>' +
                '<td>' + esc(r['Pekerjaan'] || '-') + '<br><span style="color:var(--muted);font-size:10px">' + esc(r['Pendidikan'] || '-') + '</span></td>' +
                '</tr>';
        });
        var headerLabel = meta.query ? 'Pencarian: ' + meta.query : 'Semua warga aktif';
        openPagedReport({
            title: 'Laporan Data Warga',
            subtitle: rtLabel(meta.rt),
            meta: headerLabel,
            docTitle: 'Laporan Data Warga - ' + rtLabel(meta.rt),
            orientation: 'landscape',
            colCount: 8,
            emptyText: 'Tidak ada warga pada filter ini.',
            cardsHtml: '<div class="cards">' +
                '<div class="card"><div class="lbl">Total KK</div><div class="val">' + fmtInt(Object.keys(totalKK).length) + '</div></div>' +
                '<div class="card"><div class="lbl">Total warga</div><div class="val">' + fmtInt(sorted.length) + '</div></div>' +
                '<div class="card"><div class="lbl">Kepala keluarga</div><div class="val">' + fmtInt(totalKepala) + '</div></div>' +
                '<div class="card"><div class="lbl">Anggota</div><div class="val">' + fmtInt(sorted.length - totalKepala) + '</div></div>' +
                '</div>',
            theadHtml: '<tr>' +
                '<th class="c" style="width:26px">No</th><th class="nw" style="width:92px">No. KK</th>' +
                '<th class="nw" style="width:92px">NIK</th><th>Nama lengkap</th>' +
                '<th class="c" style="width:74px">Status</th><th class="nw" style="width:74px">No HP</th>' +
                '<th>Alamat</th><th>Pekerjaan / pendidikan</th>' +
                '</tr>',
            rows: tableRows,
            footerLeft: 'RW 06 Portal Pengurus · Jumlah: ' + fmtInt(sorted.length) + ' jiwa · ' +
                fmtInt(Object.keys(totalKK).length) + ' KK' + (meta.query ? ' · cari: ' + meta.query : '')
        });
    }

    // FR-WRG-05: NIK ganda dilaporkan, bukan digabung otomatis. Pemindaian
    // memakai NIK apa adanya dari setiap RT aktif; data tidak pernah ditulis
    // balik ke RT mana pun.
    function nikDigits(value) {
        return String(value === null || value === undefined ? '' : value).replace(/\D/g, '');
    }

    function collectNikGroups(rtRows) {
        var groups = {};
        rtRows.forEach(function (entry) {
            (entry.rows || []).forEach(function (r) {
                var nik = nikDigits(r['NIK']);
                if (!nik) return;
                if (!groups[nik]) groups[nik] = [];
                groups[nik].push({
                    rtId: entry.rtId,
                    nama: r['Nama Lengkap'] || '-',
                    kk: r['Nomor KK'] || '-',
                    nik: r['NIK'] || '-',
                    hp: r['No HP'] || '-',
                    alamat: r['Alamat/No Rumah'] || '-',
                    status: r['Status'] || '-',
                    pekerjaan: r['Pekerjaan'] || '-',
                    id: r['ID'] || '-'
                });
            });
        });
        return Object.keys(groups).sort().map(function (nik) {
            var list = groups[nik];
            var rts = {};
            list.forEach(function (e) { rts[e.rtId] = true; });
            return { nik: nik, rows: list, rts: Object.keys(rts) };
        }).filter(function (g) { return g.rows.length > 1; }).sort(function (a, b) {
            if (b.rts.length !== a.rts.length) return b.rts.length - a.rts.length;
            return b.rows.length - a.rows.length;
        });
    }

    function nikDuplicateHtml(groups, masked, scanned) {
        if (!groups.length) {
            return '<div class="notice notice-ok"><i class="fa-solid fa-circle-check"></i><div>Tidak ditemukan NIK ganda pada ' + fmtInt(scanned) + ' RT yang dipindai.</div></div>';
        }
        var cross = groups.filter(function (g) { return g.rts.length > 1; }).length;
        var blocks = groups.map(function (g) {
            var rows = g.rows.map(function (e) {
                return '<tr>' +
                    '<td class="nowrap">' + esc(e.rtId) + '</td>' +
                    '<td><span class="cell-main">' + esc(e.nama) + '</span><span class="cell-sub">KK ' + esc(e.kk) + '</span></td>' +
                    '<td class="nowrap">' + esc(e.nik) + '</td>' +
                    '<td>' + esc(e.alamat) + '</td>' +
                    '<td class="nowrap">' + esc(e.status) + '</td>' +
                    '<td class="nowrap"><span class="cell-sub">' + esc(e.id) + '</span></td>' +
                    '</tr>';
            }).join('');
            return '<section class="drawer-section">' +
                '<h3>NIK ' + esc(g.nik) + ' · ' + fmtInt(g.rows.length) + ' baris · ' + (g.rts.length > 1 ? 'lintas RT' : 'satu RT') + '</h3>' +
                '<div class="table-wrap"><table>' +
                '<thead><tr><th>RT</th><th>Warga</th><th>NIK</th><th>Alamat</th><th>Status</th><th>ID</th></tr></thead>' +
                '<tbody>' + rows + '</tbody></table></div>' +
                '</section>';
        }).join('');
        return '<div class="notice notice-warn"><i class="fa-solid fa-triangle-exclamation"></i><div>' +
            fmtInt(groups.length) + ' NIK ganda (' + fmtInt(cross) + ' lintas RT). Tinjau manual di RT masing-masing; sistem tidak menggabungkan data otomatis.' +
            (masked ? ' Nilai NIK dimasking untuk RW Viewer sehingga hasil pemeriksaan bisa kurang akurat.' : '') +
            '</div></div>' + blocks;
    }

    function openNikDuplicates() {
        var rts = (state.dashboard && state.dashboard.rts) || [];
        if (!rts.length) { toast('Belum ada RT aktif.', 'error'); return; }
        openDrawer('Pemeriksaan data', 'NIK ganda', '<div class="loading-row"><i class="fa-solid fa-circle-notch fa-spin"></i>Memindai ' + fmtInt(rts.length) + ' RT...</div>');
        var jobs = rts.map(function (rt) {
            return api('rwList', { rtId: rt.rtId, sheet: 'Data_Warga', limit: 2000, offset: 0, includeArchived: false })
                .then(function (res) { return { rtId: rt.rtId, rows: rowsToObjects(res.headers, res.rows), masked: !!res.masked }; },
                    function () { return { rtId: rt.rtId, rows: [], failed: true }; });
        });
        Promise.all(jobs).then(function (results) {
            var masked = results.some(function (r) { return r.masked; });
            var failed = results.filter(function (r) { return r.failed; }).map(function (r) { return r.rtId; });
            var groups = collectNikGroups(results);
            var html = (failed.length
                ? '<div class="notice notice-warn"><i class="fa-solid fa-triangle-exclamation"></i><div>RT berikut tidak dapat dipindai: <strong>' + esc(failed.join(', ')) + '</strong>. Hasil mungkin belum lengkap.</div></div>'
                : '') + nikDuplicateHtml(groups, masked, results.length) +
                '<div class="action-buttons"><button type="button" class="btn btn-ghost" id="warga-dup-print"><i class="fa-solid fa-print"></i> Cetak daftar NIK ganda</button></div>';
            $('drawer-body').innerHTML = html;
            var printBtn = $('warga-dup-print');
            if (printBtn) printBtn.addEventListener('click', function () { printNikDuplicateReport(groups); });
        }).catch(function (err) {
            $('drawer-body').innerHTML = '<div class="notice notice-warn"><i class="fa-solid fa-triangle-exclamation"></i><div>' + esc(err.message || 'Gagal memindai NIK ganda.') + '</div></div>';
        });
    }

    function printNikDuplicateReport(groups) {
        var rows = [];
        groups.forEach(function (g) {
            g.rows.forEach(function (e, idx) {
                rows.push('<tr>' +
                    '<td class="nw">' + (idx === 0 ? esc(g.nik) : '') + '</td>' +
                    '<td class="nw">' + esc(e.rtId) + '</td>' +
                    '<td>' + esc(e.nama) + '<br><span style="color:var(--muted);font-size:10px">KK ' + esc(e.kk) + '</span></td>' +
                    '<td>' + esc(e.alamat) + '</td>' +
                    '<td class="c">' + esc(e.status) + '</td>' +
                    '<td class="c">' + (idx === 0 ? fmtInt(g.rows.length) + ' baris / ' + fmtInt(g.rts.length) + ' RT' : '') + '</td>' +
                    '</tr>');
            });
        });
        openPagedReport({
            title: 'Laporan NIK Ganda',
            subtitle: 'RW 06 · seluruh RT',
            meta: fmtInt(groups.length) + ' NIK ganda · tinjau manual, tidak digabung otomatis',
            docTitle: 'Laporan NIK Ganda - RW 06',
            orientation: 'portrait',
            colCount: 6,
            emptyText: 'Tidak ditemukan NIK ganda.',
            theadHtml: '<tr>' +
                '<th class="nw" style="width:104px">NIK</th><th class="nw" style="width:52px">RT</th>' +
                '<th>Warga / KK</th><th>Alamat</th><th class="c" style="width:70px">Status</th><th class="c" style="width:86px">Kemunculan</th>' +
                '</tr>',
            rows: rows,
            footerLeft: 'RW 06 Portal Pengurus · ' + fmtInt(groups.length) + ' NIK ganda'
        });
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
                var allRows = rowsToObjects(res.headers, res.rows);
                var saldoAwal = Number(res.saldoAwal) || 0;
                allRows.sort(function (a, b) {
                    var da = String(a['Tanggal'] || a['Timestamp'] || '');
                    var db = String(b['Tanggal'] || b['Timestamp'] || '');
                    return db.localeCompare(da);
                });
                var hasPeriod = periodActive(f);
                var rows = allRows.filter(function (r) {
                    return !hasPeriod || periodMatch(r['Tanggal'] || r['Timestamp'], f.from, f.to);
                });
                rows = filterByQuery(rows, f.q, ['Nama Warga', 'No Rumah', 'Jenis Transaksi', 'Keterangan']);
                rows = sortRows(rows, 'kas');
                // Saldo saat ini selalu dari seluruh transaksi aktif; kartu
                // periode menghitung arus pada rentang yang dipilih saja.
                var totalMasuk = 0, totalKeluar = 0, aktif = 0;
                var periodMasuk = 0, periodKeluar = 0, opening = saldoAwal, periodCount = 0;
                allRows.forEach(function (r) {
                    if (isArchived(r['Diarsipkan'])) return;
                    aktif++;
                    var nominal = Number(r['Jumlah (Rp)']) || 0;
                    var out = isKasOut(r['Jenis Transaksi']);
                    if (out) totalKeluar += nominal; else totalMasuk += nominal;
                    var day = toIsoDay(r['Tanggal'] || r['Timestamp']);
                    if (hasPeriod) {
                        if (f.from && day && day < f.from) {
                            opening += out ? -nominal : nominal;
                        } else if (periodMatch(r['Tanggal'] || r['Timestamp'], f.from, f.to)) {
                            periodCount++;
                            if (out) periodKeluar += nominal; else periodMasuk += nominal;
                        }
                    } else {
                        periodCount++;
                        if (out) periodKeluar += nominal; else periodMasuk += nominal;
                    }
                });
                var saldo = saldoAwal + totalMasuk - totalKeluar;
                var closing = opening + periodMasuk - periodKeluar;
                var sliced = pageSlice(rows, 'kas');
                var body = sliced.rows.map(function (r) {
                    var archived = isArchived(r['Diarsipkan']);
                    var reversal = !isBlank(r['Reversal Dari']);
                    var jenis = String(r['Jenis Transaksi'] || '');
                    var isOut = isKasOut(jenis);
                    return '<tr' + (archived ? ' style="opacity:.55"' : '') + '>' +
                        '<td class="nowrap"><span class="cell-main">' + fmtDay(r['Tanggal'] || r['Timestamp']) + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Warga'] || '-') + '</span><span class="cell-sub">Rumah ' + esc(r['No Rumah'] || '-') + '</span></td>' +
                        '<td>' + esc(jenis || '-') + (reversal ? ' ' + badge('Reversal', 'badge-blue') : '') + (archived ? ' ' + badge('Arsip', 'badge-neutral') : '') + '</td>' +
                        '<td class="num" style="color:' + (isOut ? '#be123c' : '#047857') + '">' + (isOut ? '-' : '+') + ' ' + fmtMoney(r['Jumlah (Rp)']) + '</td>' +
                        '<td>' + esc(r['Keterangan'] || '-') + '</td>' +
                        '</tr>';
                }).join('');
                var periodNote = hasPeriod ? periodLabel(f) : 'seluruh transaksi aktif';
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="kas-rt">' + rtOptions(f.rt) + '</select></div>' +
                        searchControl('kas-q', f.q, 'Nama warga, rumah, atau keterangan') +
                        periodControls('kas', f) +
                        '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="kas-print"><i class="fa-solid fa-print"></i> Cetak laporan</button></div>' +
                        csvButton('kas-csv') +
                    '</div>' +
                    '<div class="grid kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Saldo saat ini</span><span class="kpi-icon"><i class="fa-solid fa-wallet"></i></span></div><p class="kpi-value money">' + fmtMoney(saldo) + '</p><p class="kpi-note">' + fmtInt(aktif) + ' transaksi aktif</p></article>' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Saldo awal periode</span></div><p class="kpi-value money">' + fmtMoney(opening) + '</p><p class="kpi-note">' + esc(periodNote) + '</p></article>' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Pemasukan</span></div><p class="kpi-value money" style="color:var(--green)">' + fmtMoney(periodMasuk) + '</p><p class="kpi-note">' + fmtInt(periodCount) + ' transaksi pada periode</p></article>' +
                        '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Pengeluaran</span></div><p class="kpi-value money" style="color:var(--danger)">' + fmtMoney(periodKeluar) + '</p><p class="kpi-note">Saldo akhir periode ' + fmtMoney(closing) + '</p></article>' +
                    '</div><div style="height:16px"></div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Riwayat transaksi</h2><p>Urut tanggal terbaru · ' + esc(periodLabel(f)) + (f.q ? ' · cari "' + esc(f.q) + '"' : '') + ' · arsip tidak dihitung</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr>' +
                        sortHeader('kas', 'time', 'Tanggal') +
                        sortHeader('kas', 'warga', 'Warga') +
                        sortHeader('kas', 'jenis', 'Jenis') +
                        sortHeader('kas', 'nominal', 'Nominal', '', true) +
                        '<th>Keterangan</th></tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="5"><div class="empty"><i class="fa-solid fa-wallet"></i><p>Belum ada transaksi pada periode ini.</p></div></td></tr>') + '</tbody></table></div></div>' +
                    pagerHtml('kas', sliced) + '</section>';
                $('kas-rt').addEventListener('change', function (e) { f.rt = e.target.value; state.pages.kas = 1; renderKas(); });
                bindSearch('kas-q', f, renderKas);
                bindSort('kas', renderKas);
                bindPeriodControls('kas', f, renderKas);
                bindPager('kas', renderKas);
                $('kas-print').addEventListener('click', function () {
                    printKasReport(rows, { rt: f.rt, period: periodLabel(f), opening: opening, masuk: periodMasuk, keluar: periodKeluar, closing: closing });
                });
                $('kas-csv').addEventListener('click', function () {
                    exportKasCsv(rows, f);
                });
                setSync('Data ' + f.rt, 'ok');
            });
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    function printKasReport(rows, meta) {
        var totalMasuk = 0, totalKeluar = 0;
        rows.forEach(function (r) {
            if (isArchived(r['Diarsipkan'])) return;
            var nominal = Number(r['Jumlah (Rp)']) || 0;
            if (isKasOut(r['Jenis Transaksi'])) totalKeluar += nominal; else totalMasuk += nominal;
        });
        var tableRows = rows.map(function (r, idx) {
            var isOut = isKasOut(r['Jenis Transaksi']);
            var archived = isArchived(r['Diarsipkan']);
            return '<tr>' +
                '<td class="c">' + (idx + 1) + '</td>' +
                '<td class="nw">' + esc(fmtDay(r['Tanggal'] || r['Timestamp'])) + '</td>' +
                '<td>' + esc(r['Nama Warga'] || '-') + (archived ? ' <span style="font-size:9px;background:var(--amber-soft);color:var(--amber);border-radius:4px;padding:0 4px">Arsip</span>' : '') + '</td>' +
                '<td class="c">' + esc(r['No Rumah'] || '-') + '</td>' +
                '<td class="c">' + esc(r['Jenis Transaksi'] || '-') + '</td>' +
                '<td class="r">' + esc(fmtMoney(r['Jumlah (Rp)'])) + '</td>' +
                '<td>' + esc(r['Keterangan'] || '-') + '</td>' +
                '</tr>';
        });
        if (rows.length) {
            tableRows.push('<tr class="tr-total"><td colspan="5" class="r">Total pemasukan</td><td class="r">' + esc(fmtMoney(totalMasuk)) + '</td><td></td></tr>');
            tableRows.push('<tr class="tr-total"><td colspan="5" class="r">Total pengeluaran</td><td class="r">' + esc(fmtMoney(totalKeluar)) + '</td><td></td></tr>');
            tableRows.push('<tr class="tr-total"><td colspan="5" class="r">Saldo akhir periode</td><td class="r">' + esc(fmtMoney(meta.closing)) + '</td><td></td></tr>');
        }
        openPagedReport({
            title: 'Laporan Iuran & Kas',
            subtitle: rtLabel(meta.rt),
            meta: meta.period,
            docTitle: 'Laporan Iuran & Kas - ' + rtLabel(meta.rt),
            orientation: 'landscape',
            colCount: 7,
            emptyText: 'Tidak ada transaksi pada periode ini.',
            cardsHtml: '<div class="cards">' +
                '<div class="card"><div class="lbl">Saldo awal periode</div><div class="val">' + esc(fmtMoney(meta.opening)) + '</div></div>' +
                '<div class="card"><div class="lbl">Pemasukan</div><div class="val">' + esc(fmtMoney(meta.masuk)) + '</div></div>' +
                '<div class="card"><div class="lbl">Pengeluaran</div><div class="val">' + esc(fmtMoney(meta.keluar)) + '</div></div>' +
                '<div class="card"><div class="lbl">Saldo akhir periode</div><div class="val">' + esc(fmtMoney(meta.closing)) + '</div></div>' +
                '</div>',
            theadHtml: '<tr>' +
                '<th class="c" style="width:32px">No</th><th class="nw" style="width:88px">Tanggal</th><th>Nama warga</th>' +
                '<th class="c" style="width:60px">Rumah</th><th class="c" style="width:96px">Jenis</th>' +
                '<th class="r" style="width:100px">Jumlah</th><th>Catatan</th>' +
                '</tr>',
            rows: tableRows,
            footerLeft: 'RW 06 Portal Pengurus · Jumlah baris: ' + fmtInt(rows.length) + (meta.period ? ' · ' + meta.period : '')
        });
    }

    function printSuratReport(rows, meta) {
        var counts = {};
        rows.forEach(function (r) {
            var s = String(r['Rw Status'] || 'Tidak Perlu');
            counts[s] = (counts[s] || 0) + 1;
        });
        var cards = ['Menunggu', 'Disetujui', 'Dikembalikan', 'Ditolak', 'Tidak Perlu'].map(function (k) {
            return '<div class="card"><div class="lbl">' + esc(k) + '</div><div class="val">' + fmtInt(counts[k] || 0) + '</div></div>';
        }).join('');
        var tableRows = rows.map(function (r, idx) {
            return '<tr>' +
                '<td class="c">' + (idx + 1) + '</td>' +
                '<td class="nw">' + esc(fmtDay(r['Timestamp'])) + '</td>' +
                '<td>' + esc(r['Nama Lengkap Pemohon'] || '-') + '<br><span style="color:var(--muted);font-size:10px">' + esc(r['NIK'] || '-') + '</span></td>' +
                '<td>' + esc(r['Jenis Surat'] || '-') + '<br><span style="color:var(--muted);font-size:10px">' + esc(r['No. Surat'] || 'Belum bernomor') + '</span></td>' +
                '<td class="c">' + esc(r['Status Pengurusan'] || '-') + '</td>' +
                '<td class="c">' + esc(r['Rw Status'] || '-') + '</td>' +
                '<td class="c">' + esc(fmtInt(r['Rw Revisi'] || 0)) + 'x</td>' +
                '</tr>';
        });
        openPagedReport({
            title: 'Laporan Pengajuan Surat',
            subtitle: rtLabel(meta.rt),
            meta: meta.period + ' · ' + 'Status RW: ' + meta.status,
            docTitle: 'Laporan Pengajuan Surat - ' + rtLabel(meta.rt),
            orientation: 'portrait',
            colCount: 7,
            emptyText: 'Tidak ada pengajuan pada filter ini.',
            cardsHtml: '<div class="cards">' + cards + '</div>',
            theadHtml: '<tr>' +
                '<th class="c" style="width:30px">No</th><th class="nw" style="width:80px">Tanggal</th>' +
                '<th>Pemohon</th><th>Jenis surat</th>' +
                '<th class="c" style="width:78px">Status RT</th><th class="c" style="width:88px">Status RW</th><th class="c" style="width:48px">Revisi</th>' +
                '</tr>',
            rows: tableRows,
            footerLeft: 'RW 06 Portal Pengurus · Jumlah baris: ' + fmtInt(rows.length) + (meta.period ? ' · ' + meta.period : '')
        });
    }

    function printLaporReport(rows, meta) {
        var counts = {};
        rows.forEach(function (r) {
            var s = String(r['Rw Status'] || 'Tidak Perlu');
            counts[s] = (counts[s] || 0) + 1;
        });
        var cards = ['Perlu Tindak Lanjut', 'Ditangani RW', 'Selesai RW', 'Tidak Perlu'].map(function (k) {
            return '<div class="card"><div class="lbl">' + esc(k) + '</div><div class="val">' + fmtInt(counts[k] || 0) + '</div></div>';
        }).join('');
        var tableRows = rows.map(function (r, idx) {
            return '<tr>' +
                '<td class="c">' + (idx + 1) + '</td>' +
                '<td class="nw">' + esc(fmtDay(r['Timestamp'])) + '<br><span style="color:var(--muted);font-size:10px">' + esc(r['No. Pengaduan'] || '-') + '</span></td>' +
                '<td>' + esc(r['Nama Warga'] || '-') + '<br><span style="color:var(--muted);font-size:10px">' + esc(r['Alamat / No. Rumah'] || '-') + '</span></td>' +
                '<td>' + esc(r['Judul Pengaduan'] || '-') + '<br><span style="color:var(--muted);font-size:10px">' + esc(r['Jenis Pengaduan'] || '-') + '</span></td>' +
                '<td class="c">' + esc(r['Status'] || '-') + '</td>' +
                '<td class="c">' + esc(r['Rw Status'] || '-') + '</td>' +
                '</tr>';
        });
        openPagedReport({
            title: 'Laporan Pengaduan Warga',
            subtitle: rtLabel(meta.rt),
            meta: meta.period + ' · ' + 'Status RW: ' + meta.status,
            docTitle: 'Laporan Pengaduan - ' + rtLabel(meta.rt),
            orientation: 'portrait',
            colCount: 6,
            emptyText: 'Tidak ada pengaduan pada filter ini.',
            cardsHtml: '<div class="cards">' + cards + '</div>',
            theadHtml: '<tr>' +
                '<th class="c" style="width:30px">No</th><th class="nw" style="width:96px">Tanggal / nomor</th>' +
                '<th>Warga</th><th>Pengaduan</th>' +
                '<th class="c" style="width:72px">Status RT</th><th class="c" style="width:92px">Status RW</th>' +
                '</tr>',
            rows: tableRows,
            footerLeft: 'RW 06 Portal Pengurus · Jumlah baris: ' + fmtInt(rows.length) + (meta.period ? ' · ' + meta.period : '')
        });
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
                var allRows = sortByTimeDesc(rowsToObjects(res.headers, res.rows), 'Timestamp');
                var rows = allRows.filter(function (r) { return periodMatch(r['Timestamp'], f.from, f.to); });
                rows = filterByQuery(rows, f.q, ['Nama Lengkap Pemohon', 'NIK', 'Jenis Surat', 'No. Surat', 'Keperluan / Alasan Pengajuan', 'Status Pengurusan', 'Rw Status']);
                rows = sortRows(rows, 'surat');
                var sliced = pageSlice(rows, 'surat');
                var canBulk = isAdmin();
                if (canBulk) pruneBulkSurat(rows);
                var selected = bulkSuratIds();
                var body = sliced.rows.map(function (r) {
                    var pending = String(r['Rw Status']) === 'Menunggu';
                    var checked = pending && state.bulkSurat[String(r['ID'])];
                    return '<tr class="clickable" data-surat="' + esc(r['ID']) + '">' +
                        (canBulk
                            ? '<td class="nowrap">' + (pending
                                ? '<input type="checkbox" class="row-check" data-bulk-surat="' + esc(r['ID']) + '"' + (checked ? ' checked' : '') + ' aria-label="Pilih pengajuan ' + esc(r['Nama Lengkap Pemohon'] || '-') + '">'
                                : '<span class="cell-sub">-</span>') + '</td>'
                            : '') +
                        '<td class="nowrap"><span class="cell-main">' + fmtDay(r['Timestamp']) + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Nama Lengkap Pemohon'] || '-') + '</span><span class="cell-sub">' + esc(r['NIK'] || '-') + '</span></td>' +
                        '<td><span class="cell-main">' + esc(r['Jenis Surat'] || '-') + '</span><span class="cell-sub">' + esc(r['No. Surat'] || 'Belum bernomor') + '</span></td>' +
                        '<td>' + rtSuratBadge(r['Status Pengurusan']) + '</td>' +
                        '<td>' + rwSuratBadge(r['Rw Status']) + '</td>' +
                        '<td class="nowrap">' + fmtInt(r['Rw Revisi'] || 0) + ' kali</td>' +
                        '</tr>';
                }).join('');
                var bulkBar = canBulk
                    ? '<div class="bulk-bar" id="surat-bulk-bar">' +
                        '<span class="bulk-count" id="surat-bulk-count">' + fmtInt(selected.length) + ' dipilih</span>' +
                        '<button type="button" class="btn btn-ghost btn-sm" id="surat-bulk-all"><i class="fa-solid fa-check-double"></i> Pilih semua Menunggu</button>' +
                        '<button type="button" class="btn btn-ghost btn-sm" id="surat-bulk-clear"><i class="fa-solid fa-xmark"></i> Bersihkan</button>' +
                        '<button type="button" class="btn btn-primary btn-sm" id="surat-bulk-approve"' + (selected.length ? '' : ' disabled') + '><i class="fa-solid fa-circle-check"></i> Setujui pilihan</button>' +
                    '</div>'
                    : '';
                $('page').innerHTML =
                    '<div class="toolbar">' +
                        '<div class="field"><label>RT</label><select class="control" id="surat-rt">' + rtOptions(f.rt) + '</select></div>' +
                        '<div class="field"><label>Status RW</label><select class="control" id="surat-status">' + statusOptions(f.status, ['', 'Menunggu', 'Disetujui', 'Dikembalikan', 'Ditolak', 'Tidak Perlu'], 'Semua status') + '</select></div>' +
                        searchControl('surat-q', f.q, 'Nama, NIK, jenis, atau nomor surat') +
                        periodControls('surat', f) +
                        '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="surat-print"><i class="fa-solid fa-print"></i> Cetak laporan</button></div>' +
                        csvButton('surat-csv') +
                    '</div>' + bulkBar + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Pengajuan surat</h2><p>' + fmtInt(rows.length) + ' pengajuan · ' + esc(periodLabel(f)) + (f.q ? ' · cari "' + esc(f.q) + '"' : '') + ' · klik baris untuk detail</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr>' +
                        (canBulk ? '<th class="bulk-col"><span class="sr-only">Pilih</span></th>' : '') +
                        sortHeader('surat', 'time', 'Tanggal') +
                        sortHeader('surat', 'pemohon', 'Pemohon', 'NIK') +
                        '<th><span class="th-stack">Jenis surat</span><span class="th-sub">No. Surat</span></th>' +
                        '<th>Status RT</th>' +
                        sortHeader('surat', 'status', 'Status RW') +
                        sortHeader('surat', 'revisi', 'Revisi', '', true) +
                    '</tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="' + (canBulk ? 7 : 6) + '"><div class="empty"><i class="fa-solid fa-file-signature"></i><p>Tidak ada pengajuan pada filter ini.</p></div></td></tr>') + '</tbody></table></div></div>' +
                    pagerHtml('surat', sliced) + '</section>';
                $('surat-rt').addEventListener('change', function (e) { f.rt = e.target.value; state.pages.surat = 1; renderSurat(); });
                $('surat-status').addEventListener('change', function (e) { f.status = e.target.value; state.pages.surat = 1; renderSurat(); });
                bindSearch('surat-q', f, renderSurat);
                bindSort('surat', renderSurat);
                bindPeriodControls('surat', f, renderSurat);
                bindPager('surat', renderSurat);
                $('surat-print').addEventListener('click', function () {
                    printSuratReport(rows, { rt: f.rt, period: periodLabel(f), status: f.status || 'Semua status' });
                });
                $('surat-csv').addEventListener('click', function () {
                    exportSuratCsv(rows, f);
                });
                document.querySelectorAll('[data-surat]').forEach(function (tr) {
                    tr.addEventListener('click', function () {
                        var id = tr.getAttribute('data-surat');
                        var row = rows.find(function (r) { return String(r['ID']) === String(id); });
                        if (row) openSurat(row);
                    });
                });
                bindBulkSurat(rows, f.rt);
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
                var allRows = sortByTimeDesc(rowsToObjects(res.headers, res.rows), 'Timestamp');
                var rows = allRows.filter(function (r) { return periodMatch(r['Timestamp'], f.from, f.to); });
                rows = filterByQuery(rows, f.q, ['Nama Warga', 'No. Pengaduan', 'Judul Pengaduan', 'Jenis Pengaduan', 'Detail Pengaduan', 'Alamat / No. Rumah', 'Status', 'Rw Status']);
                rows = sortRows(rows, 'lapor');
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
                        searchControl('lapor-q', f.q, 'Warga, nomor, atau judul pengaduan') +
                        periodControls('lapor', f) +
                        '<div class="field"><label>&nbsp;</label><button type="button" class="btn btn-ghost" id="lapor-print"><i class="fa-solid fa-print"></i> Cetak laporan</button></div>' +
                        csvButton('lapor-csv') +
                    '</div>' + listNotice(res) +
                    '<section class="card"><div class="card-head"><div><h2>Pengaduan warga</h2><p>' + fmtInt(rows.length) + ' pengaduan · ' + esc(periodLabel(f)) + (f.q ? ' · cari "' + esc(f.q) + '"' : '') + ' · klik baris untuk detail</p></div></div>' +
                    '<div class="card-body flush"><div class="table-wrap"><table>' +
                    '<thead><tr>' +
                        sortHeader('lapor', 'time', 'Tanggal / nomor') +
                        sortHeader('lapor', 'warga', 'Warga') +
                        '<th>Pengaduan</th><th>Status RT</th>' +
                        sortHeader('lapor', 'status', 'Status RW') +
                        sortHeader('lapor', 'updated', 'Diperbarui') +
                    '</tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-comment-dots"></i><p>Tidak ada pengaduan pada filter ini.</p></div></td></tr>') + '</tbody></table></div></div>' +
                    pagerHtml('lapor', sliced) + '</section>';
                $('lapor-rt').addEventListener('change', function (e) { f.rt = e.target.value; state.pages.lapor = 1; renderLapor(); });
                $('lapor-status').addEventListener('change', function (e) { f.status = e.target.value; state.pages.lapor = 1; renderLapor(); });
                bindSearch('lapor-q', f, renderLapor);
                bindSort('lapor', renderLapor);
                bindPeriodControls('lapor', f, renderLapor);
                bindPager('lapor', renderLapor);
                $('lapor-print').addEventListener('click', function () {
                    printLaporReport(rows, { rt: f.rt, period: periodLabel(f), status: f.status || 'Semua status' });
                });
                $('lapor-csv').addEventListener('click', function () {
                    exportLaporCsv(rows, f);
                });
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

    // Tautan kembali dipakai saat detail dibuka dari panel riwayat warga,
    // supaya pengguna dapat kembali ke riwayat tanpa kehilangan konteks.
    function drawerBackLink(back) {
        if (typeof back !== 'function') return '';
        return '<div class="drawer-back"><button type="button" class="btn btn-ghost btn-sm" id="drawer-back">' +
            '<i class="fa-solid fa-arrow-left"></i> Kembali ke riwayat warga</button></div>';
    }

    function bindDrawerBack(back) {
        if (typeof back !== 'function') return;
        var btn = $('drawer-back');
        if (btn) btn.addEventListener('click', function () { back(); });
    }

    function openDrawer(eyebrow, title, html) {
        $('drawer-eyebrow').textContent = eyebrow;
        $('drawer-title').textContent = title;
        $('drawer-body').innerHTML = html;
        $('drawer').classList.remove('hidden');
        $('drawer').setAttribute('aria-hidden', 'false');
        document.body.classList.add('drawer-open');
        trapFocus($('drawer'));
        // Fokus awal ke tombol tutup di header (bukan backdrop) agar Escape/Tab
        // langsung bekerja dan pembaca layar mengumumkan judul dialog.
        var close = $('drawer').querySelector ? $('drawer').querySelector('.drawer-head [data-close-drawer]') : null;
        if (close && close.focus) close.focus();
    }
    function closeDrawer() {
        var drawer = $('drawer');
        if (!drawer || drawer.classList.contains('hidden')) return;
        drawer.classList.add('hidden');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('drawer-open');
        releaseFocus();
    }

    // ================= KEPUTUSAN MASSAL SURAT =================
    // Hanya pengajuan berstatus Menunggu yang bisa dipilih. Setiap baris tetap
    // membawa `Rw Versi` masing-masing sehingga pengaman idempotensi dan
    // deteksi perubahan bersamaan sama persis dengan keputusan satu per satu.
    function bulkSuratIds() {
        return Object.keys(state.bulkSurat).filter(function (id) { return state.bulkSurat[id]; });
    }

    function clearBulkSurat() {
        state.bulkSurat = {};
    }

    // Pilihan lama yang tidak lagi ada di daftar dibuang agar penghitung tidak
    // menyebut pengajuan yang sudah tidak terlihat (mis. setelah ganti RT).
    function pruneBulkSurat(rows) {
        var present = {};
        (rows || []).forEach(function (r) { present[String(r['ID'])] = true; });
        Object.keys(state.bulkSurat).forEach(function (id) {
            if (!present[id]) delete state.bulkSurat[id];
        });
    }

    function toggleBulkSurat(id, checked) {
        if (!id) return;
        if (checked) state.bulkSurat[id] = true;
        else delete state.bulkSurat[id];
    }

    function bulkEligible(rows) {
        return (rows || []).filter(function (r) { return String(r['Rw Status']) === 'Menunggu'; });
    }

    function submitBulkSurat(rows, rtId) {
        if (state.actionBusy) return;
        var ids = bulkSuratIds();
        var chosen = (rows || []).filter(function (r) { return ids.indexOf(String(r['ID'])) !== -1; });
        if (!chosen.length) { toast('Pilih minimal satu pengajuan.', 'error'); return; }
        var notPending = chosen.filter(function (r) { return String(r['Rw Status']) !== 'Menunggu'; });
        if (notPending.length) {
            toast('Sebagian pengajuan sudah tidak menunggu. Muat ulang daftar lalu pilih lagi.', 'error');
            return;
        }
        var message = '<p>Setujui <strong>' + fmtInt(chosen.length) + '</strong> pengajuan surat sekaligus?</p>' +
            '<div class="warning-summary">' +
            chosen.slice(0, 8).map(function (r) {
                return '<p>' + esc(r['Nama Lengkap Pemohon'] || '-') + ' · ' + esc(r['Jenis Surat'] || '-') + '</p>';
            }).join('') +
            (chosen.length > 8 ? '<p>dan ' + fmtInt(chosen.length - 8) + ' pengajuan lain.</p>' : '') +
            '</div>' +
            '<p class="modal-note">Semua keputusan dikirim ke ' + esc(rtLabel(rtId)) + ' dan dicatat di audit. Bila satu pengajuan sudah berubah, pengajuan itu dilewati dan sisanya tetap diproses.</p>';
        openWarning({
            eyebrow: 'Keputusan massal',
            title: 'Setujui pengajuan terpilih?',
            message: message,
            tone: 'primary',
            icon: 'fa-circle-check',
            confirmIcon: 'fa-circle-check',
            confirmLabel: 'Ya, Setujui ' + fmtInt(chosen.length),
            onConfirm: function () { performBulkSurat(chosen, rtId); }
        });
    }

    function performBulkSurat(chosen, rtId) {
        state.actionBusy = true;
        var done = 0, queued = 0, skipped = 0, failed = 0;
        var index = 0;
        function next() {
            if (index >= chosen.length) {
                state.actionBusy = false;
                clearBulkSurat();
                clearReadCache();
                renderers[state.page]();
                var parts = [fmtInt(done + queued) + ' disetujui'];
                if (queued) parts.push(fmtInt(queued) + ' menunggu kirim ulang');
                if (skipped) parts.push(fmtInt(skipped) + ' dilewati');
                if (failed) parts.push(fmtInt(failed) + ' gagal');
                toast(parts.join(' · ') + '.', failed ? 'error' : 'success');
                return;
            }
            var r = chosen[index++];
            var versi = Number(r['Rw Versi'] || 1) || 1;
            api('rwSuratDecision', {
                rtId: rtId,
                id: r['ID'],
                decision: 'Disetujui',
                catatan: '',
                expectedVersi: versi,
                kunci: makeKunci('SRT-BULK', [rtId, r['ID'], versi, 'Disetujui'])
            }).then(function (res) {
                // `queued` berarti keputusan sudah tersimpan dan akan dicoba
                // ulang otomatis, jadi tetap dihitung sebagai disetujui.
                if (res && res.queued) queued++;
                else done++;
            }).catch(function (err) {
                var code = String((err && err.code) || '');
                if (code === 'stale' || code === 'not_pending' || code === 'max_negative') skipped++;
                else failed++;
            }).then(next);
        }
        next();
    }

    function updateBulkBar(rows) {
        var ids = bulkSuratIds();
        var count = $('surat-bulk-count');
        if (count) count.textContent = fmtInt(ids.length) + ' dipilih';
        var approve = $('surat-bulk-approve');
        if (approve) approve.disabled = !ids.length || state.actionBusy;
    }

    function bindBulkSurat(rows, rtId) {
        if (!isAdmin()) return;
        document.querySelectorAll('[data-bulk-surat]').forEach(function (box) {
            box.addEventListener('click', function (e) { e.stopPropagation(); });
            box.addEventListener('change', function (e) {
                toggleBulkSurat(e.target.getAttribute('data-bulk-surat'), e.target.checked);
                updateBulkBar(rows);
            });
        });
        var all = $('surat-bulk-all');
        if (all) all.addEventListener('click', function () {
            // Hanya baris Menunggu pada tampilan saat ini yang dipilih agar
            // keputusan massal tidak menyentuh pengajuan yang sudah final.
            bulkEligible(rows).forEach(function (r) { state.bulkSurat[String(r['ID'])] = true; });
            renderers[state.page]();
        });
        var clear = $('surat-bulk-clear');
        if (clear) clear.addEventListener('click', function () {
            clearBulkSurat();
            renderers[state.page]();
        });
        var approve = $('surat-bulk-approve');
        if (approve) approve.addEventListener('click', function () { submitBulkSurat(rows, rtId); });
        updateBulkBar(rows);
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

    function openSurat(r, rtOverride, back) {
        var rtId = rtOverride || state.filters.surat.rt;
        var html = drawerBackLink(back) +
            '<div class="drawer-section tint tint-brand"><h3>Pemohon</h3><dl class="detail-list">' +
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
        bindDrawerBack(back);
    }

    function openLapor(r, rtOverride, back) {
        var laporId = r['ID'];
        var rtId = rtOverride || state.filters.lapor.rt;
        var foto = laporFotoBlock(r['Foto / Bukti Pendukung']);
        openDrawer('Pengaduan · ' + (r['No. Pengaduan'] || laporId || ''), r['Judul Pengaduan'] || 'Detail pengaduan',
            drawerBackLink(back) +
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
        bindDrawerBack(back);
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
                    '<td>' + (rt.lastError ? '<span class="cell-sub" style="color:var(--danger)">' + esc(rt.lastError) + '</span>' : '<span class="cell-sub">-</span>') + '</td>' +
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

    function digestPanel() {
        return '<section class="card" style="margin-bottom:16px"><div class="card-head"><div><h2>Digest harian</h2>' +
            '<p>Ringkasan KPI seluruh RT dikirim ke email RW Admin pada jam yang diatur.</p></div>' +
            '<div class="spacer"></div>' +
            '<button type="button" class="btn btn-ghost" id="digest-preview"><i class="fa-solid fa-eye"></i> Pratinjau</button> ' +
            '<button type="button" class="btn btn-primary" id="digest-send"><i class="fa-solid fa-paper-plane"></i> Kirim sekarang</button>' +
            '</div><div class="card-body" id="digest-body"><p class="form-hint">Aktifkan <strong>DIGEST_ENABLED</strong>, atur <strong>DIGEST_HOUR</strong>, dan isi <strong>DIGEST_RECIPIENTS</strong> (kosong berarti semua RW Admin aktif). Pratinjau tidak mengirim email.</p></div></section>';
    }

    // Salin teks digest agar pengguna bisa menempelkannya ke WhatsApp setelah
    // pengiriman manual. Clipboard API dipakai bila tersedia; bila tidak (mis.
    // konteks non-secure), dipakai textarea sementara + execCommand.
    function copyDigestText(text, button) {
        var value = String(text || '');
        if (!value) { toast('Tidak ada teks digest untuk disalin.', 'error'); return; }
        function done(ok) {
            if (button) button.disabled = false;
            toast(ok ? 'Teks digest disalin. Tempel ke WhatsApp bila perlu.' : 'Gagal menyalin. Pilih teks lalu salin manual.',
                ok ? 'success' : 'error');
        }
        function legacyCopy() {
            try {
                var area = document.createElement('textarea');
                area.value = value;
                area.setAttribute('readonly', '');
                area.style.position = 'fixed';
                area.style.top = '-1000px';
                document.body.appendChild(area);
                area.select();
                var ok = document.execCommand && document.execCommand('copy');
                document.body.removeChild(area);
                done(!!ok);
            } catch (err) {
                done(false);
            }
        }
        var clip = (typeof navigator !== 'undefined' && navigator && navigator.clipboard) ? navigator.clipboard : null;
        if (clip && typeof clip.writeText === 'function') {
            clip.writeText(value).then(function () { done(true); },
                function () { if (typeof document.createElement === 'function') legacyCopy(); else done(false); });
            return;
        }
        if (typeof document.createElement === 'function') legacyCopy();
        else done(false);
    }

    function bindDigestCopy() {
        var btn = $('digest-copy');
        if (!btn) return;
        btn.addEventListener('click', function () {
            btn.disabled = true;
            copyDigestText(state.digestText, btn);
        });
    }

    function renderDigestResult(res) {
        var body = $('digest-body');
        if (!body) return;
        var recipients = res.recipients || [];
        var totals = res.totals || {};
        state.digestText = res.text || '';
        body.innerHTML =
            '<div class="notice notice-info" style="margin-top:0"><i class="fa-solid fa-envelope-circle-check"></i><div>' +
                '<strong>' + esc(res.subject || 'Ringkasan Harian RW 06') + '</strong><br>' +
                'Penerima: ' + (recipients.length ? esc(recipients.join(', ')) : '<em>belum ada</em>') +
                (res.lastRun ? ' · terakhir terkirim ' + esc(res.lastRun) : '') +
            '</div></div>' +
            (state.digestText
                ? '<div class="digest-actions"><button type="button" class="btn btn-ghost" id="digest-copy"><i class="fa-solid fa-copy"></i> Salin teks untuk WhatsApp</button>' +
                  '<span class="cell-sub">Menyalin teks yang sama dengan isi email.</span></div>'
                : '') +
            '<div class="grid kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">' +
                '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Warga</span></div><p class="kpi-value">' + fmtInt(totals.warga) + '</p></article>' +
                '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Saldo kas</span></div><p class="kpi-value money">' + fmtMoney(totals.kasSaldo) + '</p></article>' +
                '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Surat menunggu</span></div><p class="kpi-value">' + fmtInt(totals.suratMenunggu) + '</p></article>' +
                '<article class="kpi-card"><div class="kpi-head"><span class="kpi-label">Eskalasi</span></div><p class="kpi-value">' + fmtInt(totals.laporEskalasi) + '</p></article>' +
            '</div>' +
            '<pre class="digest-preview">' + esc(res.text || '') + '</pre>';
        bindDigestCopy();
    }

    function bindDigest() {
        var preview = $('digest-preview');
        if (preview) {
            preview.addEventListener('click', function () {
                preview.disabled = true;
                api('rwDigestPreview', null, { fresh: true }).then(function (res) {
                    renderDigestResult(res);
                    setSync('Digest pratinjau', 'ok');
                }).catch(function (err) {
                    toast(err.message || 'Gagal membuat pratinjau digest.', 'error');
                }).then(function () { preview.disabled = false; });
            });
        }
        var send = $('digest-send');
        if (send) {
            send.addEventListener('click', function () {
                openWarning({
                    eyebrow: 'Konfirmasi kirim',
                    title: 'Kirim digest harian sekarang?',
                    message: 'Ringkasan KPI seluruh RT akan dikirim ke email penerima digest. Tindakan ini dicatat di audit.',
                    tone: 'primary',
                    icon: 'fa-paper-plane',
                    confirmIcon: 'fa-paper-plane',
                    confirmLabel: 'Ya, kirim',
                    onConfirm: function () {
                        send.disabled = true;
                        api('rwDigestSend', null, { fresh: true }).then(function (res) {
                            clearReadCache();
                            renderDigestResult(res);
                            toast('Digest terkirim ke ' + (res.recipients || []).length + ' penerima.', 'success');
                            // Setelah kirim manual, tawarkan salinan teks agar bisa
                            // ditempel ke WhatsApp tanpa membuka email.
                            openWarning({
                                eyebrow: 'Digest terkirim',
                                title: 'Salin teks untuk WhatsApp?',
                                message: 'Email sudah dikirim ke ' + esc((res.recipients || []).join(', ') || '-') +
                                    '.<br>Anda juga bisa menyalin teks yang sama untuk ditempel ke grup WhatsApp.',
                                tone: 'primary',
                                icon: 'fa-envelope-circle-check',
                                confirmIcon: 'fa-copy',
                                confirmLabel: 'Salin teks',
                                cancelIcon: 'fa-xmark',
                                cancelLabel: 'Tutup',
                                onConfirm: function () { copyDigestText(state.digestText, null); }
                            });
                        }).catch(function (err) {
                            toast(err.message || 'Gagal mengirim digest.', 'error');
                        }).then(function () { send.disabled = false; });
                    }
                });
            });
        }
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
                digestPanel() +
                '<section class="card"><div class="card-head"><div><h2>Pengaturan sistem</h2><p>Tanpa deploy ulang portal.</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr><th>Parameter</th><th>Nilai</th><th>Diperbarui</th><th>Aksi</th></tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="4"><div class="empty"><i class="fa-solid fa-sliders"></i><p>Belum ada pengaturan.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('pengaturan', sliced) + '</section>';
            bindPager('pengaturan', renderers.pengaturan);
            bindDigest();
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
            var fa = state.filters.audit;
            var allRows = res.audit || [];
            var rows = filterByQuery(allRows, fa.q, ['Aktor', 'Email', 'Aksi', 'RT ID', 'Target', 'Hasil', 'Detail']);
            rows = sortRows(rows, 'audit');
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
                '<div class="toolbar">' +
                    searchControl('audit-q', fa.q, 'User, aksi, RT, atau detail') +
                    '<span class="cell-sub" style="align-self:center">' + fmtInt(rows.length) + ' dari ' + fmtInt(allRows.length) + ' entri · retensi audit 12 bulan</span>' +
                '</div>' +
                '<section class="card"><div class="card-head"><div><h2>Audit log</h2><p>Login, keputusan, tanggapan, registry, dan pengaturan.' + (fa.q ? ' · cari "' + esc(fa.q) + '"' : '') + '</p></div></div>' +
                '<div class="card-body flush"><div class="table-wrap"><table>' +
                '<thead><tr>' +
                    sortHeader('audit', 'time', 'Waktu') +
                    sortHeader('audit', 'user', 'User') +
                    sortHeader('audit', 'aksi', 'Aksi') +
                    '<th>RT / target</th>' +
                    sortHeader('audit', 'hasil', 'Hasil') +
                    '<th>Detail</th>' +
                '</tr></thead>' +
                '<tbody>' + (body || '<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-list-check"></i><p>Belum ada entri audit.</p></div></td></tr>') + '</tbody></table></div></div>' +
                pagerHtml('audit', sliced) + '</section>';
            bindSearch('audit-q', fa, renderers.audit);
            bindSort('audit', renderers.audit);
            bindPager('audit', renderers.audit);
            setSync('Audit', 'ok');
        }).catch(function (err) { pageError(err); setSync('Gagal memuat', 'error'); });
    }

    var renderers = { dashboard: renderDashboard, warga: renderWarga, kas: renderKas, surat: renderSurat, lapor: renderLapor, pengguna: renderPengguna, registry: renderRegistry, pengaturan: renderPengaturan, outbox: renderOutbox, audit: renderAudit };

    function navigate(page) {
        pendingSearchFocus = null;
        if (!renderers[page]) page = 'dashboard';
        if (isAdminPage(page) && !isAdmin()) page = 'dashboard';
        state.page = page;
        // Klik menu selalu menutup drawer, termasuk saat halaman tidak berubah.
        closeDrawer();
        syncHash();
        renderChrome();
        renderers[page]();
    }

    // Filter yang ikut disimpan di URL agar tautan dapat dibagikan dan F5
    // kembali ke tampilan yang sama. Hanya field yang aman (tanpa data warga)
    // yang masuk; drawer dan pencarian warga tidak ikut agar URL tetap pendek.
    var HASH_FIELDS = {
        // Pencarian warga sengaja tidak masuk URL: query bisa memuat nama/NIK.
        warga: ['rt'],
        kas: ['rt', 'from', 'to', 'preset', 'q'],
        surat: ['rt', 'status', 'from', 'to', 'preset', 'q'],
        lapor: ['rt', 'status', 'from', 'to', 'preset', 'q'],
        audit: ['q']
    };

    function buildHash() {
        var page = state.page || 'dashboard';
        var fields = HASH_FIELDS[page];
        var parts = [];
        var f = fields ? (state.filters[page] || {}) : {};
        (fields || []).forEach(function (name) {
            // Saat preset aktif, tanggal tidak perlu ditulis: preset dihitung
            // ulang saat tautan dibuka sehingga label "Hari ini" tetap benar
            // meski dibuka pada hari berikutnya.
            if (f.preset && (name === 'from' || name === 'to')) return;
            var value = f[name];
            if (!isBlank(value)) parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));
        });
        // Ringkasan tanpa filter adalah tampilan bawaan; biarkan URL tetap
        // bersih agar tidak menambah hash yang tidak perlu.
        if (page === 'dashboard' && !parts.length) return '';
        return '#/' + page + (parts.length ? '?' + parts.join('&') : '');
    }

    function syncHash() {
        if (typeof history === 'undefined' || !history.replaceState) return;
        try {
            var next = buildHash();
            if (next === String(location.hash || '')) return;
            history.replaceState(null, '', next || location.pathname || './');
        } catch (e) { /* diabaikan: URL bukan hal kritis */ }
    }

    function parseHash() {
        var raw = String((typeof location !== 'undefined' && location.hash) || '');
        if (raw.indexOf('#/') !== 0) return null;
        var rest = raw.slice(2);
        var qIndex = rest.indexOf('?');
        var page = qIndex === -1 ? rest : rest.slice(0, qIndex);
        page = page.replace(/\/+$/, '');
        if (!page) return { page: 'dashboard', params: {} };
        var params = {};
        if (qIndex !== -1) {
            try {
                new URLSearchParams(rest.slice(qIndex + 1)).forEach(function (value, key) {
                    if (key) params[key] = value;
                });
            } catch (e) { /* abaikan parameter rusak */ }
        }
        return { page: page, params: params };
    }

    function applyRoute(route) {
        if (!route) return false;
        pendingSearchFocus = null;
        var page = renderers[route.page] ? route.page : 'dashboard';
        if (isAdminPage(page) && !isAdmin()) return false;
        var fields = HASH_FIELDS[page] || [];
        var f = state.filters[page];
        if (f) {
            fields.forEach(function (name) {
                f[name] = Object.prototype.hasOwnProperty.call(route.params, name) ? route.params[name] : '';
            });
            // Tautan yang hanya membawa preset tetap menghasilkan rentang yang
            // benar, sehingga label dan filter konsisten setelah muat ulang.
            if (f.preset && (!f.from || !f.to)) {
                var range = presetRange(f.preset);
                if (range) { f.from = range.from; f.to = range.to; }
            }
        }
        var pageChanged = state.page !== page;
        state.page = page;
        if (pageChanged) closeDrawer();
        renderChrome();
        renderers[page]();
        // Rapikan tautan: buang parameter tak dikenal dan hash Ringkasan kosong.
        syncHash();
        return true;
    }

    function applyHash() {
        var route = parseHash();
        if (!route) return false;
        return applyRoute(route);
    }

    function refresh() {
        if (state.busy) return;
        state.busy = true;
        var btn = $('refresh-btn');
        if (btn) btn.disabled = true;
        setSync('Menyegarkan', '');
        var gen = cacheGeneration;
        api('rwRefresh').then(function (res) {
            // rwRefresh sudah mengembalikan dashboard terbaru; pakai langsung agar
            // tidak ada fan-out kedua yang memperlambat dan memicu timeout.
            if (res && res.rts) {
                state.dashboard = res;
                state.dashboardLoadedAt = Date.now();
                // Simpan juga sebagai cache baca agar perpindahan menu dan
                // pemuatan ulang berikutnya langsung memakai ringkasan ini.
                // Lewati bila aksi tulis terjadi selama refresh berjalan:
                // cache sudah dibersihkan dan ringkasan ini sudah basi.
                if (gen === cacheGeneration) {
                    var dashKey = apiKey('rwDashboard', null);
                    readCache[dashKey] = { at: Date.now(), data: res };
                    persistEntry(dashKey, readCache[dashKey]);
                }
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
        applyTheme(currentTheme());
        var themeBtn = $('theme-btn');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
        // Saat belum ada pilihan manual, ikuti perubahan preferensi sistem.
        try {
            if (typeof matchMedia === 'function') {
                var mq = matchMedia('(prefers-color-scheme: dark)');
                if (mq && mq.addEventListener) mq.addEventListener('change', function () {
                    if (!storedTheme()) applyTheme(systemTheme());
                });
            }
        } catch (e) { /* diabaikan */ }
        bindNetworkStatus();
        if (typeof addEventListener === 'function') {
            addEventListener('hashchange', function () {
                // Tautan yang tidak diizinkan (mis. admin untuk Viewer) tidak
                // mengubah halaman; rapikan kembali URL ke tampilan aktif.
                if (!applyHash()) syncHash();
            });
        }
        $('access-retry').addEventListener('click', function () { location.reload(); });
        $('menu-btn').addEventListener('click', function () {
            $('sidebar').classList.add('open');
            $('menu-btn').setAttribute('aria-expanded', 'true');
        });
        $('sidebar-close').addEventListener('click', function () {
            $('sidebar').classList.remove('open');
            $('menu-btn').setAttribute('aria-expanded', 'false');
        });
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
                $('menu-btn').setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('click', function (e) {
            rememberTrigger(e.target);
            var retry = e.target.closest('[data-retry]');
            if (retry) { renderers[state.page](); }
        });
        var page = $('page');
        page.addEventListener('click', function (e) {
            var kpi = e.target.closest('[data-kpi-page]');
            if (kpi) {
                var target = kpi.getAttribute('data-kpi-page');
                var status = kpi.getAttribute('data-kpi-status');
                if (state.filters[target] && 'status' in state.filters[target]) {
                    state.filters[target].status = status || '';
                    state.pages[target] = 1;
                }
                navigate(target);
                return;
            }
            var rtRow = e.target.closest('tr[data-rt]');
            if (rtRow) {
                state.filters.warga.rt = rtRow.getAttribute('data-rt');
                navigate('warga');
            }
        });
    }

    function boot() {
        applyTheme(currentTheme());
        hydrateReadCache();
        // Ringkasan dari cache sesi dipakai lebih dulu agar menu langsung bisa
        // dibuka (default RT sudah diketahui) sebelum jaringan menjawab. Di sini
        // TTL singkat rwDashboard sengaja dilewati (masih dalam batas
        // READ_CACHE_MAX_MS): data lama tetap ditampilkan seketika lalu
        // divalidasi ulang di latar belakang oleh ensureDashboard().
        var cachedDash = readCache[apiKey('rwDashboard', null)];
        if (cachedDash && !state.dashboard &&
            Date.now() - cachedDash.at < READ_CACHE_MAX_MS) {
            state.dashboard = cachedDash.data;
            state.dashboardLoadedAt = cachedDash.at;
        }
        bindGlobal();
        $('build-info').textContent = 'Portal build ' + BUILD;
        // Sesi yang sudah diverifikasi gateway di tab ini boleh dipakai untuk
        // menggambar kerangka seketika; verifikasi ulang tetap berjalan dan
        // mengganti layar dengan pesan akses bila ternyata ditolak.
        var cachedSession = readCache[apiKey('rwSession', null)];
        var earlyShown = false;
        // Batas khusus sesi: lebih pendek daripada cache data, karena kerangka
        // aplikasi hanya boleh tampil seketika bila sesi yang tersimpan masih
        // baru. Verifikasi ulang tetap berjalan dan akan menutupnya bila ditolak.
        if (cachedSession && cachedDash &&
            Date.now() - cachedSession.at < EARLY_SESSION_MAX_MS) {
            state.session = cachedSession.data;
            earlyShown = true;
            showApp();
            renderChrome();
            startRoute();
        }
        // Ringkasan RT tidak bergantung pada data sesi (identitas sudah diverifikasi
        // gateway), jadi permintaannya dimulai bersamaan dengan rwSession. Satu
        // round-trip lebih cepat dan hasilnya masuk ke cache/dedupe `api()`,
        // sehingga renderDashboard tinggal memakainya.
        if (!earlyShown) api('rwDashboard').catch(function () {});
        // {fresh:true} wajib: sesi yang dihidrasi dari sessionStorage tidak boleh
        // menjawab verifikasi, kalau tidak akun yang sudah dicabut tetap lolos.
        api('rwSession', null, { fresh: true }).then(function (res) {
            state.session = res;
            if (!earlyShown) {
                showApp();
                renderChrome();
                startRoute();
            } else {
                renderChrome();
            }
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

    // Halaman awal: hormati deep link bila ada, jika tidak kembali ke
    // Ringkasan. applyHash() sudah memvalidasi peran admin dan filter.
    function startRoute() {
        if (!applyHash()) navigate('dashboard');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
