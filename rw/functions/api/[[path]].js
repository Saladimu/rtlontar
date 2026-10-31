// Cloudflare Pages Function: RW 06 gateway.
//
// Browser -> same-origin /api -> this function -> RW orchestrator Apps Script.
// The function verifies Cloudflare Access, injects the server-side gateway
// secret and the verified email, and never exposes either to the browser.
//
// Required environment variables (Pages project):
//   ORCHESTRATOR_URL       RW orchestrator Web App /exec URL
//   GATEWAY_SECRET         same value as the orchestrator script property
//   CF_ACCESS_TEAM_DOMAIN  e.g. rw06.cloudflareaccess.com
//   CF_ACCESS_AUD          Cloudflare Access application audience tag
//   DEV_MODE               "true" only for local/preview testing
//   DEV_USER_EMAIL         fallback email used only when DEV_MODE=true

const ACTIONS = new Set([
    'rwSession',
    'rwDashboard',
    'rwRefresh',
    'rwRegistryList',
    'rwRegistrySave',
    'rwUsersList',
    'rwUsersSave',
    'rwSettingsGet',
    'rwSettingsSave',
    'rwList',
    'rwSuratDecision',
    'rwLaporNote',
    'rwOutboxList',
    'rwOutboxRetry',
    'rwAuditList',
    'rwRtHealth',
    'rwDigestPreview',
    'rwDigestSend'
]);

const MAX_BODY_BYTES = 262144;
const FETCH_TIMEOUT_MS = 20000;

let jwksCache = { url: '', keys: null, expiresAt: 0 };
// Waktu (epoch ms) pengambilan ulang paksa terakhir. Token dengan `kid` palsu
// tidak boleh membuat gateway membanjiri endpoint JWKS Cloudflare.
let jwksForcedAt = 0;
const JWKS_FORCE_COOLDOWN_MS = 60000;

function json(body, status) {
    return new Response(JSON.stringify(body), {
        status: status || 200,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store'
        }
    });
}

function fail(code, message, status) {
    return json({ result: 'error', code: code, message: message }, status || 400);
}

function base64UrlToBytes(value) {
    const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function decodeJsonPart(value) {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

function readCookie(request, name) {
    const cookie = request.headers.get('cookie') || '';
    const parts = cookie.split(';');
    for (const part of parts) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return '';
}

async function loadJwks(url, force) {
    const now = Date.now();
    if (!force && jwksCache.url === url && jwksCache.keys && jwksCache.expiresAt > now) return jwksCache.keys;
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error('JWKS HTTP ' + res.status + ' (' + url + ')');
    const data = await res.json();
    const keys = Array.isArray(data.keys) ? data.keys : [];
    if (!keys.length) throw new Error('JWKS kosong');
    jwksCache = { url: url, keys: keys, expiresAt: now + 5 * 60 * 1000 };
    if (force) jwksForcedAt = now;
    return keys;
}

async function verifyAccessJwt(token, env) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('JWT tidak valid');

    const header = decodeJsonPart(parts[0]);
    const payload = decodeJsonPart(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) throw new Error('Algoritma JWT tidak didukung');

    const teamHost = String(env.CF_ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!teamHost) throw new Error('CF_ACCESS_TEAM_DOMAIN belum diatur');
    const audience = String(env.CF_ACCESS_AUD || '').split(',').map(function (v) { return v.trim(); }).filter(Boolean);
    if (!audience.length) throw new Error('CF_ACCESS_AUD belum diatur');

    let keys = await loadJwks('https://' + teamHost + '/cdn-cgi/access/certs');
    let jwk = keys.find(function (k) { return k.kid === header.kid; });
    if (!jwk && Date.now() - jwksForcedAt > JWKS_FORCE_COOLDOWN_MS) {
        // Cloudflare dapat merotasi signing key kapan saja. Cache JWKS berumur 5
        // menit, jadi tanpa pengambilan ulang semua pengguna akan ditolak sampai
        // cache kedaluwarsa. Ambil ulang sekali (force) sebelum menyerah, dengan
        // jeda 60 detik agar `kid` palsu tidak membanjiri endpoint JWKS.
        keys = await loadJwks('https://' + teamHost + '/cdn-cgi/access/certs', true);
        jwk = keys.find(function (k) { return k.kid === header.kid; });
    }
    if (!jwk) throw new Error('Kunci JWT tidak ditemukan');

    const key = await crypto.subtle.importKey(
        'jwk',
        { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
    );
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlToBytes(parts[2]), signed);
    if (!valid) throw new Error('Tanda tangan JWT tidak valid');

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('JWT kedaluwarsa');
    if (typeof payload.nbf === 'number' && payload.nbf > now + 30) throw new Error('JWT belum berlaku');
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.some(function (v) { return audience.indexOf(v) !== -1; })) throw new Error('Audience JWT tidak cocok');
    const issuers = ['https://' + teamHost, 'https://' + teamHost + '/'];
    if (issuers.indexOf(String(payload.iss || '')) === -1) throw new Error('Issuer JWT tidak cocok');
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email || email.indexOf('@') === -1) throw new Error('Email pada JWT tidak tersedia');
    return email;
}

function resolveEmail(request, env) {
    const devMode = String(env.DEV_MODE || '').toLowerCase() === 'true';
    if (devMode) {
        const host = new URL(request.url).hostname.toLowerCase();
        const localHost = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
        if (!localHost) throw new Error('DEV_MODE hanya diizinkan untuk localhost');
        const email = String(request.headers.get('x-rw-dev-email') || env.DEV_USER_EMAIL || '').trim().toLowerCase();
        if (!email || email.indexOf('@') === -1) throw new Error('DEV_MODE aktif tetapi DEV_USER_EMAIL belum diatur');
        return Promise.resolve(email);
    }
    const token = request.headers.get('cf-access-jwt-assertion') || readCookie(request, 'CF_Authorization');
    if (!token) return Promise.reject(new Error('Sesi Cloudflare Access tidak ditemukan'));
    return verifyAccessJwt(token, env);
}

export async function onRequest(context) {
    const { request, env } = context;
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: { 'allow': 'GET, POST, OPTIONS', 'cache-control': 'no-store' }
        });
    }

    if (method === 'GET') {
        if (url.pathname === '/api/health' || url.pathname === '/api') {
            return json({
                result: 'success',
                service: 'rw06-gateway',
                version: 'rw-gateway-v1-2026-10-31',
                configured: {
                    orchestrator: !!String(env.ORCHESTRATOR_URL || '').trim(),
                    gatewaySecret: String(env.GATEWAY_SECRET || '').length >= 16,
                    access: !!String(env.CF_ACCESS_TEAM_DOMAIN || '').trim() && !!String(env.CF_ACCESS_AUD || '').trim(),
                    devMode: String(env.DEV_MODE || '').toLowerCase() === 'true'
                }
            });
        }
        return fail('method_not_allowed', 'Gunakan POST untuk aksi portal RW.', 405);
    }

    if (method !== 'POST') {
        return fail('method_not_allowed', 'Metode tidak didukung.', 405);
    }

    const fetchSite = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
        return fail('cross_site_request', 'Permintaan lintas situs ditolak.', 403);
    }
    const contentType = String(request.headers.get('content-type') || '');
    if (!/^application\/json\b/i.test(contentType)) {
        return fail('invalid_content_type', 'Gunakan Content-Type application/json.', 415);
    }
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_BODY_BYTES) {
        return fail('payload_too_large', 'Permintaan terlalu besar.', 413);
    }

    const orchestratorUrl = String(env.ORCHESTRATOR_URL || '').trim();
    const gatewaySecret = String(env.GATEWAY_SECRET || '');
    if (!orchestratorUrl) return fail('gateway_not_configured', 'ORCHESTRATOR_URL belum diatur pada gateway.', 500);
    if (gatewaySecret.length < 16) return fail('gateway_not_configured', 'GATEWAY_SECRET gateway belum diatur dengan benar.', 500);

    let email;
    try {
        email = await resolveEmail(request, env);
    } catch (err) {
        return fail('unauthorized', String((err && err.message) || 'Akses ditolak.'), 401);
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail('payload_too_large', 'Permintaan terlalu besar.', 413);

    let body;
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        return fail('invalid_json', 'Body permintaan bukan JSON yang valid.', 400);
    }

    const action = String(body.action || '').trim();
    if (!action || !/^rw[A-Za-z]+$/.test(action) || !ACTIONS.has(action)) {
        return fail('invalid_action', 'Aksi portal RW tidak dikenal.', 400);
    }

    const outbound = Object.assign({}, body);
    delete outbound.gateway;
    delete outbound.email;
    outbound.action = action;
    outbound.gateway = gatewaySecret;
    outbound.email = email;

    let upstream;
    try {
        upstream = await fetch(orchestratorUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'content-type': 'text/plain;charset=utf-8', 'accept': 'application/json' },
            body: JSON.stringify(outbound),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
    } catch (err) {
        return fail('upstream_unreachable', 'Orkestrator RW tidak dapat dihubungi.', 502);
    }

    const upstreamText = await upstream.text();
    let data;
    try {
        data = upstreamText ? JSON.parse(upstreamText) : {};
    } catch (err) {
        return fail('upstream_invalid', 'Orkestrator RW mengembalikan respons yang tidak valid.', 502);
    }

    if (!upstream.ok && !data.code) {
        return fail('upstream_error', 'Orkestrator RW mengembalikan HTTP ' + upstream.status + '.', 502);
    }
    return json(data, 200);
}
