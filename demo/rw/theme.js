/* Terapkan tema sebelum CSS dimuat agar tidak ada kedipan terang. */
(function () {
    'use strict';
    var theme = '';
    try {
        var saved = localStorage.getItem('rw_theme');
        if (saved === 'dark' || saved === 'light') theme = saved;
    } catch (e) { /* diabaikan */ }
    if (!theme) {
        try {
            theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (e) { theme = 'light'; }
    }
    try {
        document.documentElement.setAttribute('data-theme', theme);
    } catch (e) { /* diabaikan */ }
})();
