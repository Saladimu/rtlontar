// Cloudflare Pages Function: same-origin proxy ke Google Apps Script Web App.
//
// Tujuan: browser cukup memanggil endpoint same-origin "/api" sehingga request
// ke Apps Script dikirim dari sisi server (edge), bukan dari browser. Dengan
// begitu tidak ada lagi skrip/cookie lintas-situs yang bisa diblokir oleh
// Chrome/Safari (third-party cookie, ITP, ekstensi/adblock) yang selama ini
// membuat JSONP gagal dengan pesan "Gagal cek versi backend" / "Gagal memuat
// data dari Google Sheets".
//
// Konfigurasi target: set environment variable APPS_SCRIPT_URL pada project
// Cloudflare Pages (Settings > Environment variables). Bila tidak diset, dipakai
// nilai default di bawah (deployment admin.rt017@gmail.com saat ini).

const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxpKHBNpvDvUzAlKSzRT7eI0QpRsCRN1GabW33IM5V9eKSNH5s_cBFJpqIWlGaYfyRW/exec';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();

  if (method !== 'GET' && method !== 'POST' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const configured = env && env.APPS_SCRIPT_URL ? String(env.APPS_SCRIPT_URL).trim() : '';
  const base = configured || DEFAULT_APPS_SCRIPT_URL;
  const target = base + new URL(request.url).search;

  const init = { method, redirect: 'follow' };
  if (method === 'POST') {
    // Apps Script membaca raw body via e.postData.contents; text/plain menjaga
    // request tetap "simple" tanpa preflight CORS.
    init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
    init.body = await request.text();
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    return new Response(
      JSON.stringify({
        result: 'error',
        code: 'proxy_fetch_failed',
        message: String((err && err.message) || err)
      }),
      {
        status: 502,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      }
    );
  }

  const contentType = upstream.headers.get('content-type') || 'text/plain; charset=utf-8';
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' }
  });
}
