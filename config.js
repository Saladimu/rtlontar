/* ============================================================
   KONFIGURASI IDENTITAS SISTEM RT
   ------------------------------------------------------------
   Ubah HANYA nilai di dalam RT_CONFIG di bawah ini untuk
   menyesuaikan informasi RT pada seluruh aplikasi
   (index.html dan public.html).

   Semua teks di halaman (judul, header, footer, sub-judul, dan
   placeholder form) diisi otomatis dari konfigurasi ini melalui
   atribut data-rt / data-rt-placeholder.
   ============================================================ */
window.RT_CONFIG = {
    // Versi konfigurasi. Naikkan (mis. '2', '3', ...) setiap kali mengubah config.js.
    // Halaman membandingkannya dengan EXPECTED_CONFIG_VERSION (ada di index.html &
    // public.html) dan melakukan hard refresh otomatis bila berbeda, sehingga HTML
    // yang masih tersimpan di cache browser ikut diperbarui (sekali saja, ada guard).
    version: '3',
    appName: 'Sistem',
    rt: '017',
    rw: '06',
    kelurahan: 'Lontar Barat',
    kecamatan: 'Grogol Petamburan',
    kota: 'Jakarta Barat',
    provinsi: 'DKI Jakarta',
    tahun: new Date().getFullYear(),
    alamatContoh: 'Jl. Lontar Barat No. 06',
    lokasiContoh: 'Depan lapangan',

    // URL Web App Google Apps Script untuk Portal Publik (endpoint readPublic).
    // Salin URL Web App (yang berakhiran /exec) di sini agar public.html dapat
    // diakses cukup lewat "public.html" tanpa parameter ?url=...
    // Kosongkan ('') untuk memakai parameter ?url=... (kompatibilitas lama).
    publicApiUrl: 'https://script.google.com/macros/s/AKfycbwOHCJ8GT8FUhWFx5yQ9YvAp9_EqVnIbihyl-n1MUl7yb0YBwX6OUQS4osfrFS7L9cE/exec',

    // URL halaman Portal Publik yang dibagikan ke warga (opsional). Bila diisi,
    // tautan & tombol "Buka Portal" pada menu Portal Publik memakai URL ini
    // (mis. domain kustom Cloudflare Pages yang menyembunyikan public.html).
    // Kosongkan ('') untuk memakai public.html lokal (atau ?url=... bila publicApiUrl kosong).
    publicPortalUrl: 'https://rt017.pages.dev/'
};

(function () {
    var c = window.RT_CONFIG;

    function rtShort() { return 'RT ' + c.rt + '/RW ' + c.rw; }
    function rtFull() { return 'RT ' + c.rt + ' / RW ' + c.rw + ' ' + c.kelurahan; }
    function wilayah() { return 'Kelurahan ' + c.kelurahan + ', Kec. ' + c.kecamatan; }
    function copyright() { return '\u00A9 ' + c.tahun + ' ' + rtFull(); }

    // Nilai untuk setiap atribut data-rt.
    var values = {
        appName: c.appName,
        appNameRt: c.appName + ' ' + rtShort(),
        dashboardTitle: 'Ringkasan ' + c.appName,
        headerName: 'RT ' + c.kelurahan,
        rtShort: rtShort(),
        rtFull: rtFull(),
        kelurahan: c.kelurahan,
        wilayah: wilayah(),
        wargaSubtitle: 'Pendataan warga ' + c.kelurahan,
        pengumumanSubtitle: 'Papan informasi resmi RT ' + c.kelurahan,
        publicSubtitle: 'Portal Informasi Publik - ' + rtShort(),
        footerAdmin: copyright(),
        footerPublic: copyright() + ' - Portal Publik',
        titleAdmin: 'Dashboard ' + rtShort() + ' - ' + c.kelurahan,
        titlePublic: 'Portal Publik - ' + rtFull()
    };

    // Nilai untuk setiap atribut data-rt-placeholder.
    var placeholders = {
        alamat: c.alamatContoh,
        pj: 'Ketua RT ' + c.rt,
        lokasi: c.lokasiContoh + ' ' + c.rt
    };

    function apply() {
        document.querySelectorAll('[data-rt]').forEach(function (el) {
            var val = values[el.getAttribute('data-rt')];
            if (val !== undefined && val !== null) el.textContent = val;
        });
        document.querySelectorAll('[data-rt-placeholder]').forEach(function (el) {
            var val = placeholders[el.getAttribute('data-rt-placeholder')];
            if (val) el.setAttribute('placeholder', val);
        });
    }

    window.RT = { config: c, rtShort: rtShort, rtFull: rtFull, wilayah: wilayah, apply: apply };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }
})();
