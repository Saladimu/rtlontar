/**
 * RW 06 Orchestrator (Phase 3)
 *
 * Hub-and-spoke backend for the RW 06 portal. Each RT keeps its own SAPA-RT
 * spreadsheet and Apps Script deployment. This orchestrator stores only the RT
 * registry, users, RW decision/response logs, KPI snapshots, outbox, audit log,
 * and non-secret settings.
 *
 * Security:
 * - The RW browser never calls RT backends directly.
 * - The RW portal/Pages Function calls this service with GATEWAY_SECRET and a
 *   verified user email. Do not accept identity directly from a browser.
 * - Per-RT RW_TOKEN values live in Script Properties as RT_TOKEN_<RTID>.
 */

var CODE_VERSION = 'rw-orchestrator-v1-2026-10-30-06';
var TZ = 'Asia/Jakarta';
var GATEWAY_SECRET_PROP = 'GATEWAY_SECRET';
var BOOTSTRAP_ADMIN_PROP = 'RW_BOOTSTRAP_ADMIN';
var RT_TOKEN_PREFIX = 'RT_TOKEN_';
var SCHEMA_READY_PROP = 'SCHEMA_READY';

var SCHEMA = {
  'RT_Registry': ['RT ID', 'Nama', 'Alamat', 'Endpoint', 'Aktif', 'Backend Version', 'Last Sync', 'Last Error', 'Diperbarui'],
  'Users': ['Email', 'Nama', 'Peran', 'Aktif', 'Dibuat', 'Diperbarui'],
  'Surat_Decision_Log': ['ID', 'Kunci', 'RT ID', 'Surat ID', 'Ref', 'Keputusan', 'Catatan', 'Aktor', 'Waktu', 'Versi', 'Status Kirim'],
  'Lapor_Response_Log': ['ID', 'Kunci', 'RT ID', 'Lapor ID', 'Catatan', 'Status RW', 'Visibilitas', 'Aktor', 'Waktu', 'Timeline ID', 'Status Kirim'],
  'Outbox': ['ID', 'Aksi', 'RT ID', 'Target ID', 'Payload', 'Kunci', 'Status', 'Percobaan', 'Next Retry', 'Last Error', 'Dibuat', 'Diperbarui', 'Hasil'],
  'KPI_Snapshot': ['Waktu', 'RT ID', 'Warga', 'Kas Saldo', 'Surat Menunggu', 'Lapor Terbuka', 'Lapor Eskalasi', 'Status', 'Error', 'Durasi Ms'],
  'Audit_Log': ['ID', 'Waktu', 'Aktor', 'Email', 'Peran', 'Aksi', 'RT ID', 'Target', 'Hasil', 'Detail'],
  'Settings': ['Key', 'Value', 'Keterangan', 'Diperbarui']
};

var SETTINGS_DEFAULTS = {
  'CACHE_TTL_SECONDS': { value: '300', note: 'Umur snapshot KPI sebelum diambil ulang (detik).' },
  'OUTBOX_MAX_ATTEMPTS': { value: '8', note: 'Batas percobaan pengiriman outbox.' },
  'OUTBOX_BASE_DELAY_SECONDS': { value: '60', note: 'Jeda dasar retry outbox (detik, exponential).' },
  'AUDIT_RETENTION_MONTHS': { value: '12', note: 'Retensi login/audit (bulan, 12-36).' },
  'DECISION_RETENTION_MONTHS': { value: '24', note: 'Retensi keputusan/tanggapan (bulan, 12-36).' },
  'SNAPSHOT_RETENTION_MONTHS': { value: '24', note: 'Retensi snapshot KPI (bulan, 12-36).' },
  'RW_MASK_VIEWER': { value: 'true', note: 'Masking NIK/HP/alamat untuk RW Viewer.' },
  'EXPECTED_BACKEND_VERSION': { value: 'publik-v39-2026-10-28', note: 'Versi backend RT yang diharapkan; RT dengan versi lain ditandai mismatch.' },
  'DIGEST_ENABLED': { value: 'false', note: 'Aktifkan digest harian (Phase 4).' },
  'DIGEST_HOUR': { value: '7', note: 'Jam kirim digest (0-23, Asia/Jakarta).' },
  'DIGEST_RECIPIENTS': { value: '', note: 'Penerima digest dipisah koma; kosong berarti semua RW Admin aktif.' }
};

var MAX_RTS = 10;

var READ_SHEETS = ['Data_Warga', 'Iuran_Kas', 'Pengumuman', 'Kegiatan_Warga', 'Pengajuan_Surat', 'Lapor_Aspirasi', 'Lapor_Tindak_Lanjut'];
var SURAT_DECISIONS = ['Disetujui', 'Dikembalikan', 'Ditolak'];
var LAPOR_STATUSES = ['Ditangani RW', 'Selesai RW'];
var LAPOR_VISIBILITIES = ['Publik', 'Internal'];
var USER_ROLES = ['RW Admin', 'RW Viewer'];

// ================= UTILITAS UMUM =================

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fail(code, message) {
  return { result: 'error', code: code, version: CODE_VERSION, message: message };
}

function clean(value, maxLen) {
  var s = (value === undefined || value === null) ? '' : String(value);
  s = s.replace(/\s+/g, ' ').trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function cleanMultiline(value, maxLen) {
  var s = (value === undefined || value === null) ? '' : String(value);
  s = s.replace(/\r\n/g, '\n').trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function toInt(value, fallback) {
  var n = Number(value);
  return isFinite(n) ? Math.floor(n) : fallback;
}

function clamp(value, min, max) {
  var n = toInt(value, min);
  if (n < min) n = min;
  if (n > max) n = max;
  return n;
}

function nowIso() {
  return new Date().toISOString();
}

// Waktu aksi RW disimpan dalam zona Asia/Jakarta (bukan UTC) agar nilai yang
// tertulis di log keputusan/tanggapan dan audit sama dengan jam pengurus.
function nowStamp() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
}

function safeEqual(a, b) {
  var x = String(a === undefined || a === null ? '' : a);
  var y = String(b === undefined || b === null ? '' : b);
  if (x.length !== y.length) return false;
  var diff = 0;
  for (var i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function makeId(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + randomCode(6);
}

function randomCode(len) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// ================= CACHE BACA (CacheService) =================
// Orkestrator memanggil Web App RT (beberapa detik). Cache singkat membuat
// perpindahan menu dan pengguna kedua tidak menunggu fan-out yang sama,
// sementara setiap aksi tulis menaikkan epoch RT sehingga data tidak basi.

var READ_CACHE_SECONDS = 25;

function readCacheGet(key) {
  try {
    if (typeof CacheService === 'undefined') return null;
    var raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function readCachePut(key, value, seconds) {
  try {
    if (typeof CacheService === 'undefined') return;
    CacheService.getScriptCache().put(key, JSON.stringify(value), seconds || READ_CACHE_SECONDS);
  } catch (e) {}
}

var READ_EPOCH_ALL_KEY = 'rw_epoch_all';

function readEpoch(rtId) {
  try {
    if (typeof CacheService === 'undefined') return '0';
    var cache = CacheService.getScriptCache();
    var all = cache.get(READ_EPOCH_ALL_KEY) || '0';
    var own = cache.get('rw_epoch_' + String(rtId).toUpperCase()) || '0';
    return all + '-' + own;
  } catch (e) {
    return '0';
  }
}

// Setiap aksi tulis menaikkan epoch global (dan epoch RT terkait bila ada),
// sehingga cache baca lama tidak pernah dipakai setelah data berubah.
function bumpReadEpoch(rtId) {
  try {
    if (typeof CacheService === 'undefined') return;
    var cache = CacheService.getScriptCache();
    cache.put(READ_EPOCH_ALL_KEY, String((toInt(cache.get(READ_EPOCH_ALL_KEY), 0) || 0) + 1), 3600);
    if (rtId) {
      var key = 'rw_epoch_' + String(rtId).toUpperCase();
      cache.put(key, String((toInt(cache.get(key), 0) || 0) + 1), 3600);
    }
  } catch (e) {}
}

function headerIndex(headers, names) {
  for (var n = 0; n < names.length; n++) {
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).trim().toLowerCase() === String(names[n]).trim().toLowerCase()) return i;
    }
  }
  return -1;
}

function valueAt(row, index) {
  if (index < 0 || index >= row.length) return '';
  return row[index];
}

function isYa(value) {
  return String(value === undefined || value === null ? '' : value).toLowerCase() === 'ya';
}

function isActive(value) {
  if (value === true) return true;
  var s = String(value === undefined || value === null ? '' : value).toLowerCase();
  return s === 'ya' || s === 'true' || s === '1';
}

// ================= SPREADSHEET & SCHEMA =================

function getSs() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeaders(sheet, headers, name) {
  var width = Math.max(headers.length, 1);
  var current = sheet.getRange(1, 1, 1, width).getValues()[0];
  var same = true;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] === undefined || current[i] === null ? '' : current[i]).trim() !== headers[i]) {
      same = false;
      break;
    }
  }
  if (same) return;
  if (sheet.getLastRow() > 1 || String(current.join('')).trim() !== '') {
    if (name === 'RT_Registry' && migrateRegistryAlamat(sheet, current, headers)) return;
    throw new Error('Header sheet ' + name + ' tidak cocok. Periksa migrasi manual.');
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

// Menambahkan kolom `Alamat` ke `RT_Registry` lama tanpa menghapus data.
// Hanya dijalankan bila header lama sama persis dengan skema baru tanpa `Alamat`.
function migrateRegistryAlamat(sheet, current, headers) {
  var targetIndex = headers.indexOf('Alamat');
  if (targetIndex === -1) return false;
  var expected = headers.filter(function (h) { return h !== 'Alamat'; });
  var actual = [];
  for (var i = 0; i < expected.length; i++) {
    actual.push(String(current[i] === undefined || current[i] === null ? '' : current[i]).trim());
  }
  for (var j = 0; j < expected.length; j++) {
    if (actual[j] !== expected[j]) return false;
  }
  sheet.insertColumnBefore(targetIndex + 1);
  sheet.getRange(1, targetIndex + 1).setValue('Alamat');
  return true;
}

// Tanda tangan skema: berubah saat daftar sheet/kolom atau versi kode berubah,
// sehingga pengecekan header tidak perlu membaca semua sheet pada setiap
// permintaan portal (sebelumnya ~9 pembacaan sebelum satu aksi dijalankan).
function schemaSignature() {
  var parts = [CODE_VERSION];
  Object.keys(SCHEMA).forEach(function (name) {
    parts.push(name + ':' + SCHEMA[name].join('|'));
  });
  return parts.join(';');
}

// Cek cepat (metadata saja, tanpa membaca isi sheet) bahwa semua sheet ada.
// Bila ada sheet yang hilang/terhapus, pemeriksaan lengkap dijalankan ulang.
function schemaSheetsPresent(ss) {
  try {
    var present = {};
    ss.getSheets().forEach(function (sheet) { present[sheet.getName()] = true; });
    return Object.keys(SCHEMA).every(function (name) { return present[name]; });
  } catch (e) {
    return false;
  }
}

function ensureSchema() {
  var ss = getSs();
  var props = PropertiesService.getScriptProperties();
  var signature = schemaSignature();
  if (props.getProperty(SCHEMA_READY_PROP) === signature && schemaSheetsPresent(ss)) return ss;
  // Dua eksekusi bersamaan (mis. dua permintaan portal saat deploy baru) bisa
  // sama-sama lolos cek signature lalu menyemai Settings dua kali. Kunci skrip
  // membuat penyemaian berjalan sekali; setelah kunci didapat signature dicek
  // ulang agar eksekusi kedua tidak mengulang pekerjaan.
  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(30000); } catch (e) { locked = false; }
  try {
    if (props.getProperty(SCHEMA_READY_PROP) === signature && schemaSheetsPresent(ss)) return ss;
    Object.keys(SCHEMA).forEach(function (name) {
      var sheet = getSheet(ss, name);
      ensureHeaders(sheet, SCHEMA[name], name);
    });
    seedSettings();
    try { props.setProperty(SCHEMA_READY_PROP, signature); } catch (e) {}
    return ss;
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e) {} }
  }
}

// Settings adalah tabel key/value: satu Key hanya boleh punya satu baris.
// Baris duplikat lama (akibat penyemaian bersamaan sebelum ada kunci) dibuang
// dengan mempertahankan kemunculan pertama, sama seperti updateObject.
function dedupeSettings() {
  var sheet = getSheet(getSs(), 'Settings');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0].map(function (h) { return String(h === undefined || h === null ? '' : h).trim(); });
  var keyIndex = headers.indexOf('Key');
  if (keyIndex === -1) return 0;
  var seen = {};
  var remove = [];
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][keyIndex] === undefined || values[i][keyIndex] === null ? '' : values[i][keyIndex]).trim();
    if (!key) continue;
    if (seen[key]) remove.push(i + 1);
    else seen[key] = true;
  }
  for (var r = remove.length - 1; r >= 0; r--) sheet.deleteRow(remove[r]);
  if (remove.length) invalidateTable('Settings');
  return remove.length;
}

function seedSettings() {
  dedupeSettings();
  var existing = readTable('Settings').rows;
  var keys = {};
  existing.forEach(function (r) { keys[String(r['Key'])] = true; });
  Object.keys(SETTINGS_DEFAULTS).forEach(function (key) {
    if (keys[key]) return;
    appendObject('Settings', {
      'Key': key,
      'Value': SETTINGS_DEFAULTS[key].value,
      'Keterangan': SETTINGS_DEFAULTS[key].note,
      'Diperbarui': nowStamp()
    });
  });
}

// Cache per eksekusi: satu permintaan portal sering membaca tabel yang sama
// beberapa kali (Settings, RT_Registry, KPI_Snapshot, Users). Setelah penulisan
// tabel terkait, cache dibuang agar hasilnya tetap konsisten.
var TABLE_CACHE = {};

function invalidateTable(name) {
  if (name) delete TABLE_CACHE[name];
  else TABLE_CACHE = {};
}

function readTable(name) {
  if (TABLE_CACHE[name]) return TABLE_CACHE[name];
  var sheet = getSheet(getSs(), name);
  var values = sheet.getDataRange().getValues();
  var result;
  if (!values.length) {
    result = { headers: SCHEMA[name].slice(), rows: [] };
  } else {
    var headers = values[0].map(function (h) { return String(h === undefined || h === null ? '' : h).trim(); });
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      if (!row.some(function (cell) { return cell !== '' && cell !== null && cell !== undefined; })) continue;
      var obj = {};
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
      rows.push(obj);
    }
    result = { headers: headers, rows: rows };
  }
  TABLE_CACHE[name] = result;
  return result;
}

function appendObject(name, obj) {
  var ss = getSs();
  var sheet = getSheet(ss, name);
  ensureHeaders(sheet, SCHEMA[name], name);
  var row = SCHEMA[name].map(function (header) {
    return obj[header] === undefined || obj[header] === null ? '' : obj[header];
  });
  sheet.appendRow(row);
  invalidateTable(name);
  return row;
}

function updateObject(name, keyHeader, keyValue, changes) {
  var ss = getSs();
  var sheet = getSheet(ss, name);
  ensureHeaders(sheet, SCHEMA[name], name);
  invalidateTable(name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return false;
  var headers = values[0].map(function (h) { return String(h === undefined || h === null ? '' : h).trim(); });
  var keyIndex = headers.indexOf(keyHeader);
  if (keyIndex === -1) return false;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][keyIndex]) !== String(keyValue)) continue;
    Object.keys(changes).forEach(function (key) {
      var idx = headers.indexOf(key);
      if (idx !== -1) sheet.getRange(r + 1, idx + 1).setValue(changes[key]);
    });
    return true;
  }
  return false;
}

function findObject(name, keyHeader, keyValue) {
  var rows = readTable(name).rows;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][keyHeader]) === String(keyValue)) return rows[i];
  }
  return null;
}

// ================= AUTH & USERS =================

function getGatewaySecret() {
  return PropertiesService.getScriptProperties().getProperty(GATEWAY_SECRET_PROP) || '';
}

function getBootstrapAdmin() {
  return clean(PropertiesService.getScriptProperties().getProperty(BOOTSTRAP_ADMIN_PROP), 200).toLowerCase();
}

function getRtToken(rtId) {
  return PropertiesService.getScriptProperties().getProperty(RT_TOKEN_PREFIX + String(rtId).toUpperCase()) || '';
}

function normalizeEmail(value) {
  return clean(value, 200).toLowerCase();
}

function resolveUser(email) {
  var target = normalizeEmail(email);
  // Baca sheet Users sekali saja (sebelumnya dua kali: bootstrap + findObject).
  var rows = readTable('Users').rows;
  var user = null;
  for (var i = 0; i < rows.length; i++) {
    if (normalizeEmail(rows[i]['Email']) === target) { user = rows[i]; break; }
  }
  if (!user && target && target === getBootstrapAdmin()) {
    var hasAdmin = rows.some(function (u) {
      return isActive(u['Aktif']) && String(u['Peran']) === 'RW Admin';
    });
    if (!hasAdmin) {
      appendObject('Users', {
        'Email': target,
        'Nama': 'Bootstrap Admin',
        'Peran': 'RW Admin',
        'Aktif': 'Ya',
        'Dibuat': nowStamp(),
        'Diperbarui': nowStamp()
      });
      user = { 'Email': target, 'Nama': 'Bootstrap Admin', 'Peran': 'RW Admin', 'Aktif': 'Ya' };
    }
  }
  if (!user) return null;
  if (!isActive(user['Aktif'])) return null;
  var role = clean(user['Peran'], 40);
  if (USER_ROLES.indexOf(role) === -1) return null;
  return {
    email: normalizeEmail(user['Email']),
    nama: clean(user['Nama'], 120) || normalizeEmail(user['Email']),
    peran: role,
    masked: role === 'RW Viewer'
  };
}

function requireAdmin(user) {
  return user && user.peran === 'RW Admin';
}

function verifyGateway(data) {
  var expected = getGatewaySecret();
  if (!expected) return fail('gateway_not_configured', 'GATEWAY_SECRET belum diatur di Script Properties.');
  if (!safeEqual(clean(data.gateway, 300), expected)) {
    return fail('gateway_unauthorized', 'Gateway secret tidak valid.');
  }
  return null;
}

// ================= SETTINGS =================

function getSetting(key) {
  var row = findObject('Settings', 'Key', key);
  if (row && String(row['Value']).trim() !== '') return String(row['Value']).trim();
  if (SETTINGS_DEFAULTS[key]) return SETTINGS_DEFAULTS[key].value;
  return '';
}

function getSettingInt(key, fallback) {
  return toInt(getSetting(key), fallback);
}

function getSettingBool(key, fallback) {
  var v = String(getSetting(key)).toLowerCase();
  if (v === 'true' || v === '1' || v === 'ya') return true;
  if (v === 'false' || v === '0' || v === 'tidak') return false;
  return fallback;
}

function listSettings() {
  return readTable('Settings').rows.map(function (r) {
    return {
      key: String(r['Key']),
      value: String(r['Value']),
      keterangan: String(r['Keterangan'] || ''),
      diperbarui: String(r['Diperbarui'] || '')
    };
  });
}

function validateSetting(key, value) {
  if (!SETTINGS_DEFAULTS[key]) return 'Key pengaturan tidak dikenal: ' + key;
  var numKeys = ['CACHE_TTL_SECONDS', 'OUTBOX_MAX_ATTEMPTS', 'OUTBOX_BASE_DELAY_SECONDS',
    'AUDIT_RETENTION_MONTHS', 'DECISION_RETENTION_MONTHS', 'SNAPSHOT_RETENTION_MONTHS', 'DIGEST_HOUR'];
  if (numKeys.indexOf(key) !== -1) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 'Nilai ' + key + ' harus angka >= 0.';
  }
  if (key === 'RW_MASK_VIEWER' || key === 'DIGEST_ENABLED') {
    var s = String(value).toLowerCase();
    if (['true', 'false', '1', '0', 'ya', 'tidak'].indexOf(s) === -1) return 'Nilai ' + key + ' harus true/false.';
  }
  if (key === 'DIGEST_HOUR' && (Number(value) < 0 || Number(value) > 23)) return 'DIGEST_HOUR harus 0-23.';
  if (key === 'EXPECTED_BACKEND_VERSION') {
    var v = String(value === undefined || value === null ? '' : value).trim();
    if (!v) return 'EXPECTED_BACKEND_VERSION wajib diisi (mis. publik-v39-2026-10-28).';
    if (v.length > 80) return 'EXPECTED_BACKEND_VERSION maksimal 80 karakter.';
  }
  if (key === 'DIGEST_RECIPIENTS') {
    var raw = String(value === undefined || value === null ? '' : value).trim();
    if (raw) {
      var parts = raw.split(',');
      for (var ri = 0; ri < parts.length; ri++) {
        var addr = String(parts[ri]).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
          return 'DIGEST_RECIPIENTS harus daftar email dipisah koma: ' + addr;
        }
      }
    }
  }
  return '';
}

// ================= AUDIT =================

// Audit login dibatasi sekali per 10 menit per pengguna. Portal memanggil
// rwSession setiap kali halaman dimuat ulang, dan menulis satu baris Audit_Log
// pada setiap pemuatan membuat boot terasa lebih lambat daripada SAPA RT.
var LOGIN_AUDIT_SECONDS = 600;

function auditLogin(user) {
  var email = user ? normalizeEmail(user.email) : '';
  if (!email) return;
  var key = 'rw_login_' + email;
  try {
    if (typeof CacheService !== 'undefined') {
      var cache = CacheService.getScriptCache();
      if (cache.get(key)) return;
      cache.put(key, '1', LOGIN_AUDIT_SECONDS);
    }
  } catch (e) {}
  audit(user, 'login', '', '', 'ok', '');
}

function audit(user, action, rtId, target, hasil, detail) {
  try {
    appendObject('Audit_Log', {
      'ID': makeId('AUD'),
      'Waktu': nowStamp(),
      'Aktor': user ? (user.nama || user.email) : 'system',
      'Email': user ? user.email : 'system',
      'Peran': user ? user.peran : 'system',
      'Aksi': action,
      'RT ID': rtId || '',
      'Target': target || '',
      'Hasil': hasil || '',
      'Detail': detail === undefined || detail === null ? '' : String(detail).slice(0, 1000)
    });
  } catch (e) {
    // Audit tidak boleh menggagalkan aksi utama.
  }
}

// ================= RT REGISTRY =================

function listRegistry() {
  return readTable('RT_Registry').rows.map(function (r) {
    return {
      rtId: clean(r['RT ID'], 20).toUpperCase(),
      nama: clean(r['Nama'], 120),
      alamat: clean(r['Alamat'], 200),
      endpoint: clean(r['Endpoint'], 500),
      aktif: isActive(r['Aktif']),
      backendVersion: clean(r['Backend Version'], 80),
      lastSync: clean(r['Last Sync'], 40),
      lastError: clean(r['Last Error'], 500)
    };
  });
}

function activeRegistry() {
  return listRegistry().filter(function (rt) { return rt.aktif; });
}

function findRt(rtId) {
  var id = clean(rtId, 20).toUpperCase();
  var list = listRegistry();
  for (var i = 0; i < list.length; i++) if (list[i].rtId === id) return list[i];
  return null;
}

function isValidRtId(rtId) {
  return /^RT\d{3}$/.test(rtId);
}

function isValidEndpoint(url) {
  if (!/^https:\/\//i.test(url)) return false;
  if (!/\/exec(\?|$)/i.test(url)) return false;
  return true;
}

function saveRegistry(user, data) {
  if (!requireAdmin(user)) return fail('forbidden', 'Hanya RW Admin yang dapat mengubah registry RT.');
  var rtId = clean(data.rtId, 20).toUpperCase();
  var nama = clean(data.nama, 120);
  var alamat = clean(data.alamat, 200);
  var endpoint = clean(data.endpoint, 500);
  var aktif = data.aktif === undefined ? true : (data.aktif === true || String(data.aktif).toLowerCase() === 'ya' || String(data.aktif) === 'true');
  if (!isValidRtId(rtId)) return fail('invalid_rt', 'RT ID harus berformat RTNNN, mis. RT018.');
  if (!nama) return fail('invalid', 'Nama RT wajib diisi.');
  if (!isValidEndpoint(endpoint)) return fail('invalid_endpoint', 'Endpoint harus https://.../exec.');
  var existing = findRt(rtId);
  if (!existing && listRegistry().length >= MAX_RTS) {
    return fail('max_rts', 'Maksimal ' + MAX_RTS + ' RT dapat terdaftar.');
  }
  var dup = listRegistry().filter(function (rt) { return rt.rtId !== rtId && rt.endpoint === endpoint; });
  if (dup.length) return fail('duplicate_endpoint', 'Endpoint sudah dipakai RT lain.');
  var now = nowStamp();
  if (existing) {
    updateObject('RT_Registry', 'RT ID', rtId, {
      'Nama': nama,
      'Alamat': alamat,
      'Endpoint': endpoint,
      'Aktif': aktif ? 'Ya' : 'Tidak',
      'Diperbarui': now
    });
  } else {
    appendObject('RT_Registry', {
      'RT ID': rtId,
      'Nama': nama,
      'Alamat': alamat,
      'Endpoint': endpoint,
      'Aktif': aktif ? 'Ya' : 'Tidak',
      'Backend Version': '',
      'Last Sync': '',
      'Last Error': '',
      'Diperbarui': now
    });
  }
  bumpReadEpoch(rtId);
  audit(user, 'registry_save', rtId, endpoint, 'ok', aktif ? 'aktif' : 'nonaktif');
  return { result: 'success', version: CODE_VERSION, rt: findRt(rtId) };
}

function updateRegistryRuntime(rtId, changes) {
  var payload = {};
  Object.keys(changes).forEach(function (k) { payload[k] = changes[k]; });
  payload['Diperbarui'] = nowStamp();
  updateObject('RT_Registry', 'RT ID', rtId, payload);
}

// ================= PENGADUAN / USERS =================

function listUsers() {
  return readTable('Users').rows.map(function (r) {
    return {
      email: normalizeEmail(r['Email']),
      nama: clean(r['Nama'], 120),
      peran: clean(r['Peran'], 40),
      aktif: isActive(r['Aktif']),
      dibuat: clean(r['Dibuat'], 40),
      diperbarui: clean(r['Diperbarui'], 40)
    };
  });
}

function saveUser(user, data) {
  if (!requireAdmin(user)) return fail('forbidden', 'Hanya RW Admin yang dapat mengubah pengguna.');
  var email = normalizeEmail(data.userEmail || data.targetEmail || data.email);
  var nama = clean(data.nama, 120);
  var peran = clean(data.peran, 40);
  var aktif = data.aktif === undefined ? true : (data.aktif === true || String(data.aktif).toLowerCase() === 'ya' || String(data.aktif) === 'true');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('invalid_email', 'Format email tidak valid.');
  if (USER_ROLES.indexOf(peran) === -1) return fail('invalid_role', 'Peran harus RW Admin atau RW Viewer.');
  var existing = findObject('Users', 'Email', email);
  if (existing) {
    var users = listUsers();
    var activeAdmins = users.filter(function (u) { return u.aktif && u.peran === 'RW Admin'; });
    var losesAdmin = String(existing['Peran']) === 'RW Admin' && isActive(existing['Aktif']) &&
      (peran !== 'RW Admin' || !aktif);
    if (losesAdmin && activeAdmins.length <= 1) {
      return fail('last_admin', 'Tidak dapat menonaktifkan/menurunkan RW Admin terakhir.');
    }
    updateObject('Users', 'Email', email, {
      'Nama': nama,
      'Peran': peran,
      'Aktif': aktif ? 'Ya' : 'Tidak',
      'Diperbarui': nowStamp()
    });
  } else {
    appendObject('Users', {
      'Email': email,
      'Nama': nama,
      'Peran': peran,
      'Aktif': aktif ? 'Ya' : 'Tidak',
      'Dibuat': nowStamp(),
      'Diperbarui': nowStamp()
    });
  }
  bumpReadEpoch('');
  audit(user, 'user_save', '', email, 'ok', peran + (aktif ? '' : ' (nonaktif)'));
  return { result: 'success', version: CODE_VERSION, users: listUsers() };
}

// ================= RT CALLS =================

function rtRequest(rt, action, payload) {
  var token = getRtToken(rt.rtId);
  if (!token) {
    var tokenErr = new Error('RW_TOKEN untuk ' + rt.rtId + ' belum diatur (Script Property ' + RT_TOKEN_PREFIX + rt.rtId + ').');
    tokenErr.code = 'rt_token_missing';
    throw tokenErr;
  }
  var body = {};
  Object.keys(payload || {}).forEach(function (k) { body[k] = payload[k]; });
  body.action = action;
  body.token = token;
  return {
    method: 'post',
    contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
    followRedirects: true
  };
}

function parseRtResponse(rt, res) {
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('HTTP ' + code + ' dari ' + rt.rtId + ': ' + String(text).slice(0, 300));
  }
  var json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error('Respons bukan JSON dari ' + rt.rtId + ': ' + String(text).slice(0, 200));
  }
  if (json && json.result === 'error') {
    var err = new Error(json.message || 'RT menolak permintaan.');
    err.code = json.code || 'rt_error';
    err.rtResponse = json;
    throw err;
  }
  return json;
}

function callRt(rt, action, payload) {
  return parseRtResponse(rt, UrlFetchApp.fetch(rt.endpoint, rtRequest(rt, action, payload)));
}

// ================= KPI / CACHE =================

function emptySnapshot(rtId, status, error, durationMs) {
  return {
    waktu: nowIso(),
    rtId: rtId,
    warga: 0,
    kasSaldo: 0,
    suratMenunggu: 0,
    laporTerbuka: 0,
    laporEskalasi: 0,
    status: status || 'OK',
    error: error || '',
    durasiMs: durationMs || 0
  };
}

function snapshotFromRow(row) {
  return {
    waktu: clean(row['Waktu'], 40),
    rtId: clean(row['RT ID'], 20).toUpperCase(),
    warga: toInt(row['Warga'], 0),
    kasSaldo: Number(row['Kas Saldo']) || 0,
    suratMenunggu: toInt(row['Surat Menunggu'], 0),
    laporTerbuka: toInt(row['Lapor Terbuka'], 0),
    laporEskalasi: toInt(row['Lapor Eskalasi'], 0),
    status: clean(row['Status'], 20) || 'OK',
    error: clean(row['Error'], 500),
    durasiMs: toInt(row['Durasi Ms'], 0)
  };
}

// Ambil snapshot terbaru untuk banyak RT dalam satu penelusuran sheet.
// Sebelumnya latestSnapshot() dipanggil per RT; tabel KPI_Snapshot menyimpan
// riwayat 24 bulan sehingga biayanya tumbuh seiring jumlah RT dan waktu.
function latestSnapshots(rtIds) {
  var want = {};
  var filter = false;
  (rtIds || []).forEach(function (id) { want[String(id).toUpperCase()] = true; filter = true; });
  var rows = readTable('KPI_Snapshot').rows;
  var found = {};
  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i]['RT ID']).toUpperCase();
    if (!id || (filter && !want[id])) continue;
    if (!found[id] || String(rows[i]['Waktu']) > String(found[id]['Waktu'])) found[id] = rows[i];
  }
  var out = {};
  Object.keys(found).forEach(function (key) { out[key] = snapshotFromRow(found[key]); });
  return out;
}

function latestSnapshot(rtId) {
  var all = latestSnapshots([rtId]);
  return all[String(rtId).toUpperCase()] || null;
}

function saveSnapshot(snap) {
  appendObject('KPI_Snapshot', {
    'Waktu': snap.waktu,
    'RT ID': snap.rtId,
    'Warga': snap.warga,
    'Kas Saldo': snap.kasSaldo,
    'Surat Menunggu': snap.suratMenunggu,
    'Lapor Terbuka': snap.laporTerbuka,
    'Lapor Eskalasi': snap.laporEskalasi,
    'Status': snap.status,
    'Error': snap.error,
    'Durasi Ms': snap.durasiMs
  });
}

function computeKasSaldo(headers, rows, saldoAwal) {
  var idxJenis = headerIndex(headers, ['Jenis Transaksi', 'Jenis']);
  var idxJumlah = headerIndex(headers, ['Jumlah (Rp)', 'Jumlah']);
  var idxArsip = headerIndex(headers, ['Diarsipkan']);
  var total = Number(saldoAwal) || 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (idxArsip >= 0 && isYa(row[idxArsip])) continue;
    var jenis = String(valueAt(row, idxJenis)).toLowerCase();
    var amount = Number(valueAt(row, idxJumlah)) || 0;
    if (jenis === 'pengeluaran' || jenis === 'reversal keluar') total -= amount;
    else if (jenis === 'pemasukan' || jenis === 'reversal masuk') total += amount;
  }
  return total;
}

function countResidents(headers, rows) {
  var idxArsip = headerIndex(headers, ['Diarsipkan']);
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    if (idxArsip >= 0 && isYa(rows[i][idxArsip])) continue;
    count++;
  }
  return count;
}

function countComplaints(headers, rows) {
  var idxStatus = headerIndex(headers, ['Status']);
  var idxRw = headerIndex(headers, ['Rw Status']);
  var idxArsip = headerIndex(headers, ['Diarsipkan']);
  var open = 0;
  var escalated = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (idxArsip >= 0 && isYa(row[idxArsip])) continue;
    var status = String(valueAt(row, idxStatus)).toLowerCase();
    if (status !== 'selesai') open++;
    var rw = String(valueAt(row, idxRw));
    if (rw === 'Perlu Tindak Lanjut' || rw === 'Ditangani RW') escalated++;
  }
  return { open: open, escalated: escalated };
}

function completeRtRows(rt, first, sheet) {
  var out = { headers: first.headers || [], rows: first.rows || [], saldoAwal: first.saldoAwal };
  if (!first.truncated || out.rows.length === 0) return out;
  var offset = out.rows.length;
  for (var page = 0; page < 49; page++) {
    var res = callRt(rt, 'rwRead', { sheet: sheet, limit: 2000, offset: offset });
    out.headers = res.headers || out.headers;
    var more = res.rows || [];
    out.rows = out.rows.concat(more);
    if (res.saldoAwal !== undefined && res.saldoAwal !== null && res.saldoAwal !== '') out.saldoAwal = Number(res.saldoAwal) || 0;
    if (!res.truncated || more.length === 0) break;
    offset += more.length;
  }
  return out;
}

var RT_KPI_CALL_COUNT = 4;
var RT_ERROR_RETRY_SECONDS = 30;

// Empat panggilan per RT: versi backend sudah ikut pada setiap respons rwRead,
// sehingga rwCheck tidak perlu dipanggil terpisah (memangkas satu round-trip
// Apps Script per RT pada setiap pemuatan dashboard yang dingin).
function rtKpiCalls(rt) {
  return [
    { rt: rt, action: 'rwRead', payload: { sheet: 'Data_Warga', limit: 2000, offset: 0 } },
    { rt: rt, action: 'rwRead', payload: { sheet: 'Iuran_Kas', limit: 2000, offset: 0 } },
    { rt: rt, action: 'rwRead', payload: { sheet: 'Pengajuan_Surat', status: 'Menunggu', limit: 1, offset: 0 } },
    { rt: rt, action: 'rwRead', payload: { sheet: 'Lapor_Aspirasi', limit: 2000, offset: 0 } }
  ];
}

// Jalankan semua permintaan KPI dalam satu fetchAll (paralel). Hasil per entri
// dikembalikan sebagai { ok, data | error } agar satu RT bermasalah tidak
// menggagalkan RT lain.
function callRtEntries(entries) {
  var results = [];
  if (typeof UrlFetchApp.fetchAll !== 'function') {
    entries.forEach(function (entry, i) {
      try { results[i] = { ok: true, data: callRt(entry.rt, entry.action, entry.payload) }; }
      catch (e) { results[i] = { ok: false, error: e }; }
    });
    return results;
  }
  var prepared = [];
  entries.forEach(function (entry, i) {
    try {
      var req = rtRequest(entry.rt, entry.action, entry.payload);
      req.url = entry.rt.endpoint;
      prepared.push({ index: i, req: req });
    } catch (e) {
      results[i] = { ok: false, error: e };
    }
  });
  var responses;
  try {
    responses = UrlFetchApp.fetchAll(prepared.map(function (p) { return p.req; }));
  } catch (e) {
    // fetchAll gagal total (mis. satu URL tidak valid): ulangi per entri agar
    // hanya RT yang benar-benar bermasalah yang ditandai Error.
    entries.forEach(function (entry, i) {
      if (results[i]) return;
      try { results[i] = { ok: true, data: callRt(entry.rt, entry.action, entry.payload) }; }
      catch (err) { results[i] = { ok: false, error: err }; }
    });
    return results;
  }
  prepared.forEach(function (p, idx) {
    try { results[p.index] = { ok: true, data: parseRtResponse(entries[p.index].rt, responses[idx]) }; }
    catch (err) { results[p.index] = { ok: false, error: err }; }
  });
  return results;
}

function rtErrorSnapshot(rt, err, started) {
  var errorSnap = emptySnapshot(rt.rtId, 'Error', String(err && err.message ? err.message : err), Date.now() - started);
  saveSnapshot(errorSnap);
  updateRegistryRuntime(rt.rtId, { 'Last Error': errorSnap.error, 'Last Sync': nowIso() });
  return errorSnap;
}

function rtSnapshotFromPages(rt, pages, started) {
  // Versi backend dikirim pada setiap respons rwRead; pakai halaman pertama
  // sehingga rwCheck tidak lagi dibutuhkan pada jalur dashboard.
  var check = pages[0];
  var warga = completeRtRows(rt, pages[0], 'Data_Warga');
  var kas = completeRtRows(rt, pages[1], 'Iuran_Kas');
  var surat = pages[2];
  var lapor = completeRtRows(rt, pages[3], 'Lapor_Aspirasi');
  var complaintCounts = countComplaints(lapor.headers, lapor.rows);
  var snap = {
    waktu: nowIso(),
    rtId: rt.rtId,
    warga: countResidents(warga.headers, warga.rows),
    kasSaldo: computeKasSaldo(kas.headers, kas.rows, kas.saldoAwal),
    suratMenunggu: toInt(surat.total, 0),
    laporTerbuka: complaintCounts.open,
    laporEskalasi: complaintCounts.escalated,
    status: 'OK',
    error: '',
    durasiMs: Date.now() - started
  };
  saveSnapshot(snap);
  updateRegistryRuntime(rt.rtId, {
    'Backend Version': clean(check.version, 80),
    'Last Sync': snap.waktu,
    'Last Error': ''
  });
  return snap;
}

// Ambil KPI untuk beberapa RT sekaligus. Semua permintaan KPI (RT_KPI_CALL_COUNT
// per RT) dikirim dalam satu fetchAll sehingga total waktu mendekati RT paling lambat,
// bukan jumlah seluruh RT. Ini mencegah dashboard melewati batas waktu gateway
// pada percobaan pertama (gejala "harus refresh 2-3 kali").
function refreshRts(rtList) {
  var started = Date.now();
  if (!rtList || !rtList.length) return [];
  var entries = [];
  rtList.forEach(function (rt) { entries = entries.concat(rtKpiCalls(rt)); });
  var results = callRtEntries(entries);
  return rtList.map(function (rt, rtIndex) {
    var pages = results.slice(rtIndex * RT_KPI_CALL_COUNT, (rtIndex + 1) * RT_KPI_CALL_COUNT);
    var failure = null;
    pages.forEach(function (r) { if (!failure && r && !r.ok) failure = r.error || new Error('RT tidak merespons.'); });
    if (failure || pages.length !== RT_KPI_CALL_COUNT) return rtErrorSnapshot(rt, failure, started);
    try {
      return rtSnapshotFromPages(rt, pages.map(function (r) { return r.data; }), started);
    } catch (e) {
      return rtErrorSnapshot(rt, e, started);
    }
  });
}


function secondsSince(iso) {
  if (!iso) return Number.MAX_VALUE;
  var t = new Date(iso).getTime();
  if (!isFinite(t)) return Number.MAX_VALUE;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

function expectedBackendVersion() {
  return clean(getSetting('EXPECTED_BACKEND_VERSION'), 80);
}

function handleDashboard(user, data) {
  ensureSchema();
  var ttl = getSettingInt('CACHE_TTL_SECONDS', 300);
  var expectedVersion = expectedBackendVersion();
  var force = data.forceRefresh === true || String(data.forceRefresh) === 'true';
  if (force && !requireAdmin(user)) force = false;
  var target = clean(data.rtId, 20).toUpperCase();
  var list = activeRegistry();
  if (target) list = list.filter(function (rt) { return rt.rtId === target; });
  var result = [];
  var totals = { warga: 0, kasSaldo: 0, suratMenunggu: 0, laporTerbuka: 0, laporEskalasi: 0 };
  var lastSync = '';

  // Tentukan dulu RT mana yang perlu diambil ulang, lalu jalankan semuanya
  // paralel agar total latensi mengikuti RT paling lambat (bukan jumlah RT).
  // RT yang baru saja gagal diberi jeda singkat sebelum dicoba lagi agar satu
  // RT bermasalah tidak memperlambat setiap pemuatan dashboard berikutnya.
  var prevs = latestSnapshots(list.map(function (rt) { return rt.rtId; }));
  var pending = [];
  list.forEach(function (rt) {
    var prev = prevs[rt.rtId] || null;
    var age = prev ? secondsSince(prev.waktu) : Number.MAX_VALUE;
    var need = !prev || (prev.status === 'OK' ? age > ttl : age > RT_ERROR_RETRY_SECONDS);
    if (force || need) pending.push(rt);
  });
  var refreshed = {};
  if (pending.length) {
    refreshRts(pending).forEach(function (snap) { refreshed[snap.rtId] = snap; });
    // Ambil ulang registry agar backendVersion/Last Sync yang baru tersaji
    // (updateRegistryRuntime sudah membuang cache tabel RT_Registry).
    var runtime = {};
    listRegistry().forEach(function (r) { runtime[r.rtId] = r; });
    list = list.map(function (rt) { return runtime[rt.rtId] || rt; });
  }

  list.forEach(function (rt) {
    var prev = prevs[rt.rtId];
    var snap = refreshed[rt.rtId] || prev;
    if (snap && snap.status !== 'OK' && prev && prev.status === 'OK') {
      snap = {
        waktu: prev.waktu,
        rtId: prev.rtId,
        warga: prev.warga,
        kasSaldo: prev.kasSaldo,
        suratMenunggu: prev.suratMenunggu,
        laporTerbuka: prev.laporTerbuka,
        laporEskalasi: prev.laporEskalasi,
        status: 'Stale',
        error: String(snap.error || 'Gagal memperbarui'),
        durasiMs: snap.durasiMs
      };
    }
    var stale = snap.status !== 'OK' || secondsSince(snap.waktu) > ttl;
    result.push({
      rtId: rt.rtId,
      nama: rt.nama,
      alamat: rt.alamat,
      endpoint: rt.endpoint,
      backendVersion: rt.backendVersion,
      expectedVersion: expectedVersion,
      versionMismatch: !!(expectedVersion && rt.backendVersion && rt.backendVersion !== expectedVersion),
      lastSync: rt.lastSync,
      lastError: rt.lastError,
      warga: snap.warga,
      kasSaldo: snap.kasSaldo,
      suratMenunggu: snap.suratMenunggu,
      laporTerbuka: snap.laporTerbuka,
      laporEskalasi: snap.laporEskalasi,
      status: snap.status,
      error: snap.error,
      ageSeconds: secondsSince(snap.waktu),
      stale: stale
    });
    if (snap.waktu > lastSync) lastSync = snap.waktu;
  });

  // Aggregate only snapshots that have data; stale/error rows keep last-known values.
  result.forEach(function (row) {
    totals.warga += row.warga || 0;
    totals.kasSaldo += row.kasSaldo || 0;
    totals.suratMenunggu += row.suratMenunggu || 0;
    totals.laporTerbuka += row.laporTerbuka || 0;
    totals.laporEskalasi += row.laporEskalasi || 0;
  });

  return {
    result: 'success',
    version: CODE_VERSION,
    generatedAt: nowIso(),
    cacheTtlSeconds: ttl,
    expectedVersion: expectedVersion,
    lastSync: lastSync,
    totals: totals,
    rts: result
  };
}

// ================= PROXY READ & MASKING =================

function maskRows(headers, rows) {
  var idxNik = headerIndex(headers, ['NIK']);
  var idxHp = headerIndex(headers, ['No. HP / WhatsApp', 'No. HP']);
  var idxAlamat = headerIndex(headers, ['Alamat/No Rumah', 'Alamat / No. Rumah', 'Alamat']);
  return rows.map(function (row) {
    var out = row.slice();
    if (idxNik >= 0) out[idxNik] = maskDigits(out[idxNik]);
    if (idxHp >= 0) out[idxHp] = maskDigits(out[idxHp]);
    if (idxAlamat >= 0) out[idxAlamat] = '[disembunyikan]';
    return out;
  });
}

function maskDigits(value) {
  var s = String(value === undefined || value === null ? '' : value);
  if (!s) return '';
  var digits = s.replace(/\D/g, '');
  if (!digits) return '[disembunyikan]';
  var last4 = digits.slice(-4);
  return '••••••••' + last4;
}

function handleList(user, data) {
  ensureSchema();
  var rtId = clean(data.rtId, 20).toUpperCase();
  var sheet = clean(data.sheet, 60);
  if (!rtId) return fail('invalid', 'RT ID wajib diisi.');
  if (READ_SHEETS.indexOf(sheet) === -1) return fail('invalid_sheet', 'Sheet tidak diizinkan: ' + sheet);
  var rt = findRt(rtId);
  if (!rt || !rt.aktif) return fail('rt_not_found', 'RT tidak ditemukan atau nonaktif: ' + rtId);
  var payload = {
    sheet: sheet,
    includeArchived: data.includeArchived === true || String(data.includeArchived) === 'true',
    limit: clamp(data.limit === undefined ? 200 : data.limit, 1, 2000),
    offset: clamp(data.offset === undefined ? 0 : data.offset, 0, 1000000)
  };
  if (data.status) payload.status = clean(data.status, 40);
  if (data.laporId) payload.laporId = clean(data.laporId, 60);
  var masked = user.masked && getSettingBool('RW_MASK_VIEWER', true);
  // Key memuat peran (masking), epoch RT, dan seluruh filter. Cache hanya
  // dipakai untuk baca; aksi tulis menaikkan epoch sehingga entri lama tidak
  // pernah menyajikan status yang sudah berubah.
  var cacheKey = 'rw_list_' + (masked ? 'v' : 'a') + '_' + rtId + '_' + readEpoch(rtId) + '_' +
    sheet + '_' + payload.includeArchived + '_' + payload.limit + '_' + payload.offset + '_' +
    (payload.status || '') + '_' + (payload.laporId || '');
  var cached = readCacheGet(cacheKey);
  if (cached) {
    cached.masked = masked;
    cached.rtId = rtId;
    return cached;
  }
  var res = callRt(rt, 'rwRead', payload);
  if (masked) res.rows = maskRows(res.headers || [], res.rows || []);
  res.masked = masked;
  res.rtId = rtId;
  readCachePut(cacheKey, res);
  // Bacaan tidak dicatat per baris: audit tetap mencatat login, keputusan,
  // tanggapan, registry, dan pengaturan (sesuai BRD FR-ADM-04). Menghindari
  // satu penulisan sheet pada setiap perpindahan menu membuat portal responsif.
  return res;
}

// ================= OUTBOX =================

function makeOutbox(action, rtId, targetId, payload, kunci) {
  var now = nowIso();
  var id = makeId('OUT');
  appendObject('Outbox', {
    'ID': id,
    'Aksi': action,
    'RT ID': rtId,
    'Target ID': targetId,
    'Payload': JSON.stringify(payload),
    'Kunci': kunci,
    'Status': 'Pending',
    'Percobaan': 0,
    'Next Retry': now,
    'Last Error': '',
    'Dibuat': now,
    'Diperbarui': now,
    'Hasil': ''
  });
  return id;
}

function getOutbox(id) {
  return findObject('Outbox', 'ID', id);
}

function updateOutbox(id, changes) {
  var payload = {};
  Object.keys(changes).forEach(function (k) { payload[k] = changes[k]; });
  payload['Diperbarui'] = nowIso();
  updateObject('Outbox', 'ID', id, payload);
}

function syncLogStatus(action, kunci, status) {
  var sheet = action === 'rwSuratDecision' ? 'Surat_Decision_Log' : 'Lapor_Response_Log';
  updateObject(sheet, 'Kunci', kunci, { 'Status Kirim': status });
}

function isPermanentError(code) {
  return ['stale', 'not_pending', 'max_negative', 'not_found', 'invalid', 'invalid_decision',
    'note_required', 'actor_required', 'idempotency_required', 'invalid_visibility',
    'invalid_status', 'not_returned', 'rw_unauthorized', 'unauthorized', 'surat_disabled',
    'lapor_disabled', 'rt_token_missing', 'invalid_endpoint'].indexOf(String(code)) !== -1;
}

function outboxDelaySeconds(attempts) {
  var base = getSettingInt('OUTBOX_BASE_DELAY_SECONDS', 60);
  var n = Math.min(attempts, 10);
  return Math.min(base * Math.pow(2, Math.max(0, n - 1)), 3600);
}

function deliverOutbox(outboxId) {
  var out = getOutbox(outboxId);
  if (!out) return { ok: false, code: 'outbox_not_found', message: 'Outbox tidak ditemukan.' };
  if (String(out['Status']) === 'Sent') return { ok: true, sent: true, duplicate: true };
  var rtId = clean(out['RT ID'], 20).toUpperCase();
  var action = clean(out['Aksi'], 60);
  var rt = findRt(rtId);
  if (!rt || !rt.aktif) {
    var msg = 'RT tidak ditemukan/nonaktif: ' + rtId;
    updateOutbox(outboxId, { 'Status': 'Failed', 'Last Error': msg });
    syncLogStatus(action, out['Kunci'], 'Failed');
    return { ok: false, code: 'rt_not_found', message: msg };
  }
  var payload;
  try {
    payload = JSON.parse(String(out['Payload'] || '{}'));
  } catch (e) {
    updateOutbox(outboxId, { 'Status': 'Failed', 'Last Error': 'Payload JSON rusak.' });
    syncLogStatus(action, out['Kunci'], 'Failed');
    return { ok: false, code: 'invalid_payload', message: 'Payload outbox rusak.' };
  }
  var attempts = toInt(out['Percobaan'], 0) + 1;
  try {
    var res = callRt(rt, action, payload);
    updateOutbox(outboxId, {
      'Status': 'Sent',
      'Percobaan': attempts,
      'Next Retry': '',
      'Last Error': '',
      'Hasil': JSON.stringify({ result: res.result, id: res.id, timelineId: res.timelineId || '', rwStatus: res.rwStatus || '', duplicate: !!res.duplicate })
    });
    syncLogStatus(action, out['Kunci'], 'Sent');
    audit(null, 'outbox_sent', rtId, out['Target ID'], 'ok', action + ' attempts=' + attempts);
    return { ok: true, sent: true, response: res, attempts: attempts };
  } catch (e) {
    var code = e && e.code ? e.code : 'network_error';
    var permanent = isPermanentError(code);
    var maxAttempts = getSettingInt('OUTBOX_MAX_ATTEMPTS', 8);
    var finalFail = permanent || attempts >= maxAttempts;
    var status = finalFail ? 'Failed' : 'Retry';
    var next = finalFail ? '' : new Date(Date.now() + outboxDelaySeconds(attempts) * 1000).toISOString();
    updateOutbox(outboxId, {
      'Status': status,
      'Percobaan': attempts,
      'Next Retry': next,
      'Last Error': String(e && e.message ? e.message : e).slice(0, 500)
    });
    syncLogStatus(action, out['Kunci'], status);
    audit(null, 'outbox_error', rtId, out['Target ID'], code, String(e && e.message ? e.message : e));
    return { ok: false, code: code, message: String(e && e.message ? e.message : e), attempts: attempts, retryable: !finalFail, nextRetry: next };
  }
}

function processOutbox(limit) {
  var max = clamp(limit === undefined ? 20 : limit, 1, 100);
  var rows = readTable('Outbox').rows;
  var now = nowIso();
  var processed = 0;
  var sent = 0;
  var failed = 0;
  for (var i = 0; i < rows.length && processed < max; i++) {
    var row = rows[i];
    var status = String(row['Status']);
    if (status !== 'Pending' && status !== 'Retry') continue;
    var next = String(row['Next Retry'] || '');
    if (next && next > now) continue;
    processed++;
    var result = deliverOutbox(String(row['ID']));
    if (result.ok) sent++;
    else if (!result.retryable) failed++;
  }
  return { result: 'success', version: CODE_VERSION, processed: processed, sent: sent, failed: failed };
}

// ================= SURAT DECISION =================

function findLogByKey(name, kunci) {
  var rows = readTable(name).rows;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['Kunci']) === String(kunci)) return rows[i];
  }
  return null;
}

function handleSuratDecision(user, data) {
  if (!requireAdmin(user)) return fail('forbidden', 'Hanya RW Admin yang dapat memutuskan surat.');
  ensureSchema();
  var rtId = clean(data.rtId, 20).toUpperCase();
  var id = clean(data.id || data.suratId, 60);
  var decision = clean(data.decision, 30);
  var catatan = cleanMultiline(data.catatan, 1000);
  var kunci = clean(data.kunci, 120) || makeId('SRT');
  var expectedVersi = data.expectedVersi;
  if (!rtId) return fail('invalid', 'RT ID wajib diisi.');
  if (!id) return fail('invalid', 'ID surat wajib diisi.');
  if (SURAT_DECISIONS.indexOf(decision) === -1) return fail('invalid_decision', 'Keputusan harus Disetujui, Dikembalikan, atau Ditolak.');
  if (decision !== 'Disetujui' && catatan.length < 3) return fail('note_required', 'Catatan wajib diisi untuk keputusan negatif.');
  if (kunci.length < 6) return fail('idempotency_required', 'Kunci idempotensi minimal 6 karakter.');
  var rt = findRt(rtId);
  if (!rt || !rt.aktif) return fail('rt_not_found', 'RT tidak ditemukan atau nonaktif: ' + rtId);
  var duplicate = findLogByKey('Surat_Decision_Log', kunci);
  if (duplicate) {
    return { result: 'success', version: CODE_VERSION, duplicate: true, kunci: kunci, status: duplicate['Status Kirim'], id: duplicate['Surat ID'] };
  }
  var payload = {
    id: id,
    decision: decision,
    catatan: catatan,
    aktor: user.nama || user.email,
    kunci: kunci
  };
  if (expectedVersi !== undefined && expectedVersi !== null && expectedVersi !== '') payload.expectedVersi = expectedVersi;
  var logId = makeId('SD');
  appendObject('Surat_Decision_Log', {
    'ID': logId,
    'Kunci': kunci,
    'RT ID': rtId,
    'Surat ID': id,
    'Ref': clean(data.ref, 60),
    'Keputusan': decision,
    'Catatan': catatan,
    'Aktor': user.nama || user.email,
    'Waktu': nowStamp(),
    'Versi': expectedVersi === undefined || expectedVersi === null ? '' : expectedVersi,
    'Status Kirim': 'Pending'
  });
  var outboxId = makeOutbox('rwSuratDecision', rtId, id, payload, kunci);
  bumpReadEpoch(rtId);
  audit(user, 'surat_decision', rtId, id, decision, kunci);
  var delivered = deliverOutbox(outboxId);
  if (!delivered.ok && !delivered.retryable) {
    return {
      result: 'error',
      code: delivered.code,
      version: CODE_VERSION,
      message: delivered.message,
      kunci: kunci,
      outboxId: outboxId,
      retryable: false
    };
  }
  return {
    result: 'success',
    version: CODE_VERSION,
    kunci: kunci,
    outboxId: outboxId,
    sent: !!delivered.ok,
    queued: !delivered.ok,
    retryable: delivered.ok ? false : !!delivered.retryable,
    nextRetry: delivered.nextRetry || '',
    id: id,
    rwStatus: delivered.ok && delivered.response ? delivered.response.rwStatus : decision,
    response: delivered.ok ? delivered.response : null
  };
}

// ================= LAPOR RESPONSE =================

function handleLaporNote(user, data) {
  if (!requireAdmin(user)) return fail('forbidden', 'Hanya RW Admin yang dapat menanggapi pengaduan.');
  ensureSchema();
  var rtId = clean(data.rtId, 20).toUpperCase();
  var id = clean(data.id || data.laporId, 60);
  var catatan = cleanMultiline(data.catatan, 1000);
  var kunci = clean(data.kunci, 120) || makeId('LPR');
  var status = clean(data.status, 40);
  var visibilitas = clean(data.visibilitas, 20) || 'Publik';
  var expectedDiperbarui = data.expectedDiperbarui;
  if (!rtId) return fail('invalid', 'RT ID wajib diisi.');
  if (!id) return fail('invalid', 'ID pengaduan wajib diisi.');
  if (catatan.length < 3) return fail('note_required', 'Catatan tindak lanjut wajib diisi (minimal 3 karakter).');
  if (kunci.length < 6) return fail('idempotency_required', 'Kunci idempotensi minimal 6 karakter.');
  if (status && LAPOR_STATUSES.indexOf(status) === -1) return fail('invalid_status', 'Status RW harus Ditangani RW atau Selesai RW.');
  if (LAPOR_VISIBILITIES.indexOf(visibilitas) === -1) return fail('invalid_visibility', 'Visibilitas harus Publik atau Internal.');
  var rt = findRt(rtId);
  if (!rt || !rt.aktif) return fail('rt_not_found', 'RT tidak ditemukan atau nonaktif: ' + rtId);
  var duplicate = findLogByKey('Lapor_Response_Log', kunci);
  if (duplicate) {
    return { result: 'success', version: CODE_VERSION, duplicate: true, kunci: kunci, status: duplicate['Status Kirim'], id: duplicate['Lapor ID'] };
  }
  var payload = {
    id: id,
    catatan: catatan,
    aktor: user.nama || user.email,
    kunci: kunci,
    visibilitas: visibilitas
  };
  if (status) payload.status = status;
  if (expectedDiperbarui !== undefined && expectedDiperbarui !== null && expectedDiperbarui !== '') {
    payload.expectedDiperbarui = expectedDiperbarui;
  }
  var logId = makeId('LR');
  appendObject('Lapor_Response_Log', {
    'ID': logId,
    'Kunci': kunci,
    'RT ID': rtId,
    'Lapor ID': id,
    'Catatan': catatan,
    'Status RW': status,
    'Visibilitas': visibilitas,
    'Aktor': user.nama || user.email,
    'Waktu': nowStamp(),
    'Timeline ID': '',
    'Status Kirim': 'Pending'
  });
  var outboxId = makeOutbox('rwLaporNote', rtId, id, payload, kunci);
  bumpReadEpoch(rtId);
  audit(user, 'lapor_response', rtId, id, visibilitas, kunci);
  var delivered = deliverOutbox(outboxId);
  if (delivered.ok && delivered.response && delivered.response.timelineId) {
    updateObject('Lapor_Response_Log', 'Kunci', kunci, { 'Timeline ID': delivered.response.timelineId });
  }
  if (!delivered.ok && !delivered.retryable) {
    return {
      result: 'error',
      code: delivered.code,
      version: CODE_VERSION,
      message: delivered.message,
      kunci: kunci,
      outboxId: outboxId,
      retryable: false
    };
  }
  return {
    result: 'success',
    version: CODE_VERSION,
    kunci: kunci,
    outboxId: outboxId,
    sent: !!delivered.ok,
    queued: !delivered.ok,
    retryable: delivered.ok ? false : !!delivered.retryable,
    nextRetry: delivered.nextRetry || '',
    id: id,
    rwStatus: delivered.ok && delivered.response ? delivered.response.rwStatus : status,
    timelineId: delivered.ok && delivered.response ? delivered.response.timelineId : '',
    response: delivered.ok ? delivered.response : null
  };
}

// ================= RETENTION =================

function pruneByMonths(name, timeHeader, months) {
  var sheet = getSheet(getSs(), name);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  var headers = values[0].map(function (h) { return String(h === undefined || h === null ? '' : h).trim(); });
  var idx = headers.indexOf(timeHeader);
  if (idx === -1) return 0;
  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Math.max(1, Math.min(36, Number(months) || 12)));
  var remove = [];
  for (var i = 1; i < values.length; i++) {
    var t = new Date(String(values[i][idx])).getTime();
    if (isFinite(t) && t < cutoff.getTime()) remove.push(i + 1);
  }
  for (var r = remove.length - 1; r >= 0; r--) sheet.deleteRow(remove[r]);
  return remove.length;
}

function cleanupRetention() {
  ensureSchema();
  var auditMonths = getSettingInt('AUDIT_RETENTION_MONTHS', 12);
  var decisionMonths = getSettingInt('DECISION_RETENTION_MONTHS', 24);
  var snapshotMonths = getSettingInt('SNAPSHOT_RETENTION_MONTHS', 24);
  return {
    result: 'success',
    version: CODE_VERSION,
    audit: pruneByMonths('Audit_Log', 'Waktu', auditMonths),
    decisions: pruneByMonths('Surat_Decision_Log', 'Waktu', decisionMonths),
    responses: pruneByMonths('Lapor_Response_Log', 'Waktu', decisionMonths),
    snapshots: pruneByMonths('KPI_Snapshot', 'Waktu', snapshotMonths)
  };
}

// ================= DIGEST HARIAN =================
// Digest dibangun dari snapshot KPI terakhir (tanpa fan-out ke RT) agar
// tidak menambah beban Apps Script RT. Pengaturan DIGEST_ENABLED,
// DIGEST_HOUR, dan DIGEST_RECIPIENTS dibaca setiap kali, sehingga perubahan
// berlaku tanpa redeploy portal. Trigger hanya berjalan sekali sehari pada
// jam yang dikonfigurasi.

function digestRecipients() {
  var raw = clean(getSetting('DIGEST_RECIPIENTS'), 500);
  var list = [];
  if (raw) {
    raw.split(',').forEach(function (part) {
      var addr = normalizeEmail(part);
      if (addr) list.push(addr);
    });
  } else {
    listUsers().forEach(function (u) {
      if (u.aktif && u.peran === 'RW Admin') list.push(u.email);
    });
  }
  var seen = {};
  return list.filter(function (email) {
    if (!email || seen[email]) return false;
    seen[email] = true;
    return true;
  });
}

// Angka digest memakai pemisah ribuan gaya Indonesia (titik), sama dengan
// portal (Intl id-ID), agar nominal besar mudah dibaca di email dan WhatsApp.
function digestGroup(value) {
  var n = Math.round(Number(value) || 0);
  var neg = n < 0;
  var s = String(Math.abs(n));
  var out = '';
  while (s.length > 3) {
    out = '.' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  return (neg ? '-' : '') + s + out;
}

function digestMoney(value) {
  return 'Rp ' + digestGroup(value);
}

function digestEsc(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildDigest() {
  ensureSchema();
  var rts = activeRegistry();
  var snaps = latestSnapshots(rts.map(function (rt) { return rt.rtId; }));
  var totals = { warga: 0, kasSaldo: 0, suratMenunggu: 0, laporTerbuka: 0, laporEskalasi: 0 };
  var attention = [];
  var stale = 0;
  var rows = rts.map(function (rt) {
    var snap = snaps[rt.rtId] || null;
    var row = {
      rtId: rt.rtId,
      nama: rt.nama,
      warga: snap ? snap.warga : 0,
      kasSaldo: snap ? snap.kasSaldo : 0,
      suratMenunggu: snap ? snap.suratMenunggu : 0,
      laporTerbuka: snap ? snap.laporTerbuka : 0,
      laporEskalasi: snap ? snap.laporEskalasi : 0,
      status: snap ? snap.status : 'Belum ada snapshot',
      waktu: snap ? snap.waktu : ''
    };
    totals.warga += row.warga;
    totals.kasSaldo += row.kasSaldo;
    totals.suratMenunggu += row.suratMenunggu;
    totals.laporTerbuka += row.laporTerbuka;
    totals.laporEskalasi += row.laporEskalasi;
    if (row.status !== 'OK') stale++;
    if (row.suratMenunggu > 0 || row.laporEskalasi > 0 || row.status !== 'OK') attention.push(row);
    return row;
  });
  var stamp = nowStamp();
  var subject = 'Ringkasan Harian RW 06 - ' + stamp.slice(0, 10);
  var lines = [];
  lines.push('Ringkasan Harian RW 06');
  lines.push('Waktu: ' + stamp + ' (Asia/Jakarta)');
  lines.push('');
  lines.push('Total ' + rows.length + ' RT: ' + digestGroup(totals.warga) + ' warga, saldo kas ' + digestMoney(totals.kasSaldo) +
    ', ' + digestGroup(totals.suratMenunggu) + ' surat menunggu, ' + digestGroup(totals.laporTerbuka) + ' pengaduan terbuka, ' +
    digestGroup(totals.laporEskalasi) + ' eskalasi.');
  lines.push('');
  rows.forEach(function (r) {
    lines.push(r.rtId + ' (' + (r.nama || '-') + '): ' + digestGroup(r.warga) + ' warga, kas ' + digestMoney(r.kasSaldo) +
      ', surat ' + digestGroup(r.suratMenunggu) + ', pengaduan ' + digestGroup(r.laporTerbuka) + ', eskalasi ' + digestGroup(r.laporEskalasi) +
      ', status ' + r.status);
  });
  if (attention.length) {
    lines.push('');
    lines.push('Perlu perhatian:');
    attention.forEach(function (r) {
      var parts = [];
      if (r.suratMenunggu > 0) parts.push(digestGroup(r.suratMenunggu) + ' surat menunggu');
      if (r.laporEskalasi > 0) parts.push(digestGroup(r.laporEskalasi) + ' eskalasi');
      if (r.status !== 'OK') parts.push('status ' + r.status);
      lines.push('- ' + r.rtId + ': ' + parts.join(', '));
    });
  }
  lines.push('');
  lines.push('Buka portal RW 06 untuk detail dan tindakan.');

  var tableRows = rows.map(function (r) {
    return '<tr>' +
      '<td>' + digestEsc(r.rtId) + '<br><span style="color:#64748b;font-size:11px">' + digestEsc(r.nama || '') + '</span></td>' +
      '<td style="text-align:right">' + digestEsc(digestGroup(r.warga)) + '</td>' +
      '<td style="text-align:right">' + digestEsc(digestMoney(r.kasSaldo)) + '</td>' +
      '<td style="text-align:right">' + digestEsc(digestGroup(r.suratMenunggu)) + '</td>' +
      '<td style="text-align:right">' + digestEsc(digestGroup(r.laporTerbuka)) + '</td>' +
      '<td style="text-align:right">' + digestEsc(digestGroup(r.laporEskalasi)) + '</td>' +
      '<td style="text-align:center">' + digestEsc(r.status) + '</td>' +
      '</tr>';
  }).join('');

  var attentionHtml = attention.length
    ? '<h3 style="margin:18px 0 6px;font-size:14px">Perlu perhatian</h3><ul style="margin:0;padding-left:20px">' +
      attention.map(function (r) {
        var parts = [];
        if (r.suratMenunggu > 0) parts.push(digestGroup(r.suratMenunggu) + ' surat menunggu');
        if (r.laporEskalasi > 0) parts.push(digestGroup(r.laporEskalasi) + ' eskalasi');
        if (r.status !== 'OK') parts.push('status ' + r.status);
        return '<li><strong>' + digestEsc(r.rtId) + '</strong>: ' + digestEsc(parts.join(', ')) + '</li>';
      }).join('') + '</ul>'
    : '<p style="margin:18px 0 0;color:#047857">Tidak ada antrean yang perlu perhatian.</p>';

  var html = '<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:720px">' +
    '<h2 style="margin:0 0 4px;font-size:18px;text-align:center">Ringkasan Harian RW 06</h2>' +
    '<p style="margin:0 0 14px;color:#475569;font-size:12px;text-align:center">' + digestEsc(stamp) + ' (Asia/Jakarta)</p>' +
    '<p style="margin:0 0 6px">Total <strong>' + digestEsc(rows.length) + ' RT</strong>: ' +
      digestEsc(digestGroup(totals.warga)) + ' warga, saldo kas <strong>' + digestEsc(digestMoney(totals.kasSaldo)) + '</strong>, ' +
      digestEsc(digestGroup(totals.suratMenunggu)) + ' surat menunggu, ' + digestEsc(digestGroup(totals.laporTerbuka)) + ' pengaduan terbuka, ' +
      digestEsc(digestGroup(totals.laporEskalasi)) + ' eskalasi.</p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px">' +
    '<thead><tr style="background:#f1f5f9;text-align:left">' +
      '<th style="border:1px solid #cbd5e1;padding:6px">RT</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px;text-align:right">Warga</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px;text-align:right">Saldo kas</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px;text-align:right">Surat</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px;text-align:right">Pengaduan</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px;text-align:right">Eskalasi</th>' +
      '<th style="border:1px solid #cbd5e1;padding:6px;text-align:center">Status</th>' +
    '</tr></thead><tbody>' + (tableRows || '<tr><td colspan="7" style="border:1px solid #cbd5e1;padding:6px">Belum ada RT aktif.</td></tr>') + '</tbody></table>' +
    attentionHtml +
    '<p style="margin:18px 0 0;color:#64748b;font-size:11px">Buka portal RW 06 untuk detail dan tindakan.</p>' +
    '</div>';

  return {
    generatedAt: stamp,
    subject: subject,
    text: lines.join('\n'),
    html: html,
    totals: totals,
    stale: stale,
    rts: rows,
    attention: attention
  };
}

function saveDigestLastRun(stamp) {
  try {
    PropertiesService.getScriptProperties().setProperty('LAST_DIGEST_STAMP', String(stamp || ''));
  } catch (e) {}
}

function digestLastRun() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('LAST_DIGEST_STAMP') || '');
  } catch (e) {
    return '';
  }
}

// force=true dipakai aksi manual rwDigestSend; trigger memakai force=false
// sehingga DIGEST_ENABLED diperiksa. Trigger berjalan tiap jam dan hanya
// mengirim bila jam lokal sama dengan DIGEST_HOUR dan belum terkirim hari ini.
function sendDailyDigest(force) {
  ensureSchema();
  if (!force && !getSettingBool('DIGEST_ENABLED', false)) {
    return { result: 'skipped', code: 'digest_disabled', message: 'Digest harian nonaktif.' };
  }
  var hour = getSettingInt('DIGEST_HOUR', 7);
  if (!force) {
    var nowHour = Number(Utilities.formatDate(new Date(), TZ, 'H'));
    if (nowHour !== hour) {
      return { result: 'skipped', code: 'digest_not_due', message: 'Bukan jam digest (' + hour + ':00).' };
    }
    var today = nowStamp().slice(0, 10);
    if (digestLastRun() === today) {
      return { result: 'skipped', code: 'digest_already_sent', message: 'Digest hari ini sudah dikirim.' };
    }
  }
  var recipients = digestRecipients();
  if (!recipients.length) {
    return { result: 'error', code: 'digest_no_recipients', message: 'Tidak ada penerima digest (isi DIGEST_RECIPIENTS atau tambah RW Admin aktif).' };
  }
  var digest = buildDigest();
  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: digest.subject,
      body: digest.text,
      htmlBody: digest.html
    });
  } catch (err) {
    audit(null, 'digest_send', '', recipients.join(','), 'Failed', String(err && err.message || err));
    return fail('digest_send_failed', 'Gagal mengirim digest: ' + String(err && err.message || err));
  }
  saveDigestLastRun(digest.generatedAt.slice(0, 10));
  audit(null, 'digest_send', '', recipients.join(','), 'ok', digest.subject);
  // text ikut dikirim agar portal bisa menawarkan "Salin teks" untuk
  // ditempel ke WhatsApp setelah pengiriman manual.
  return {
    result: 'success',
    version: CODE_VERSION,
    subject: digest.subject,
    text: digest.text,
    recipients: recipients,
    totals: digest.totals,
    stale: digest.stale,
    generatedAt: digest.generatedAt
  };
}

function digestTrigger() {
  return sendDailyDigest(false);
}

// ================= ENTRY POINTS =================

function doGet(e) {
  var action = e && e.parameter ? clean(e.parameter.action, 40) : '';
  if (!action || action === 'version' || action === 'health') {
    return respond({
      result: 'success',
      service: 'RW 06 Orchestrator',
      version: CODE_VERSION,
      message: 'Gunakan POST dengan GATEWAY_SECRET untuk aksi data.'
    });
  }
  return respond(fail('not_found', 'Aksi GET tidak didukung: ' + action));
}

function doPost(e) {
  var data;
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    if (!raw) return respond(fail('invalid_json', 'Body kosong.'));
    data = JSON.parse(raw);
  } catch (err) {
    return respond(fail('invalid_json', 'Body bukan JSON yang valid.'));
  }
  var action = clean(data.action, 60);
  if (!action) return respond(fail('invalid_action', 'action wajib diisi.'));

  var gatewayError = verifyGateway(data);
  if (gatewayError) return respond(gatewayError);

  try {
    ensureSchema();
    var email = normalizeEmail(data.email);
    if (!email) return respond(fail('email_required', 'Email pengguna wajib dikirim oleh gateway.'));
    var user = resolveUser(email);
    if (!user) return respond(fail('unauthorized_user', 'Email tidak terdaftar atau nonaktif di Users.'));

    if (action === 'rwSession') {
      auditLogin(user);
      return respond({ result: 'success', version: CODE_VERSION, user: user });
    }
    if (action === 'rwDashboard') return respond(handleDashboard(user, data));
    if (action === 'rwRegistryList') return respond({ result: 'success', version: CODE_VERSION, expectedVersion: expectedBackendVersion(), registry: listRegistry() });
    if (action === 'rwRegistrySave') return respond(saveRegistry(user, data));
    if (action === 'rwUsersList') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      return respond({ result: 'success', version: CODE_VERSION, users: listUsers() });
    }
    if (action === 'rwUsersSave') return respond(saveUser(user, data));
    if (action === 'rwDigestPreview') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      var preview = buildDigest();
      return respond({ result: 'success', version: CODE_VERSION, subject: preview.subject, text: preview.text, html: preview.html, totals: preview.totals, stale: preview.stale, generatedAt: preview.generatedAt, recipients: digestRecipients(), lastRun: digestLastRun() });
    }
    if (action === 'rwDigestSend') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      var digestResult = sendDailyDigest(true);
      if (digestResult.result === 'success') {
        audit(user, 'digest_send_manual', '', (digestResult.recipients || []).join(','), 'ok', digestResult.subject);
      }
      return respond(digestResult);
    }
    if (action === 'rwSettingsGet') return respond({ result: 'success', version: CODE_VERSION, settings: listSettings() });
    if (action === 'rwSettingsSave') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      var key = clean(data.key, 60);
      var value = clean(data.value, 200);
      var invalid = validateSetting(key, value);
      if (invalid) return respond(fail('invalid_setting', invalid));
      var found = findObject('Settings', 'Key', key);
      if (found) updateObject('Settings', 'Key', key, { 'Value': value, 'Diperbarui': nowStamp() });
      else appendObject('Settings', { 'Key': key, 'Value': value, 'Keterangan': '', 'Diperbarui': nowStamp() });
      bumpReadEpoch('');
      audit(user, 'settings_save', '', key, 'ok', value);
      return respond({ result: 'success', version: CODE_VERSION, settings: listSettings() });
    }
    if (action === 'rwList') return respond(handleList(user, data));
    if (action === 'rwSuratDecision') return respond(handleSuratDecision(user, data));
    if (action === 'rwLaporNote') return respond(handleLaporNote(user, data));
    if (action === 'rwOutboxList') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      return respond({ result: 'success', version: CODE_VERSION, outbox: readTable('Outbox').rows });
    }
    if (action === 'rwOutboxRetry') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      var outboxId = clean(data.id, 60);
      if (outboxId) {
        var current = getOutbox(outboxId);
        if (!current) return respond(fail('outbox_not_found', 'Outbox tidak ditemukan.'));
        if (String(current['Status']) === 'Sent') {
          return respond({ result: 'success', version: CODE_VERSION, retry: { ok: true, sent: true, duplicate: true } });
        }
        updateOutbox(outboxId, { 'Status': 'Pending', 'Next Retry': nowIso() });
        var retried = deliverOutbox(outboxId);
        bumpReadEpoch(current['RT ID']);
        return respond({ result: 'success', version: CODE_VERSION, retry: retried });
      }
      var processedAll = processOutbox(data.limit);
      bumpReadEpoch('');
      return respond(processedAll);
    }
    if (action === 'rwRefresh') {
      return respond(handleDashboard(user, { rtId: data.rtId, forceRefresh: true }));
    }
    if (action === 'rwAuditList') {
      if (!requireAdmin(user)) return respond(fail('forbidden', 'Hanya RW Admin.'));
      var limit = clamp(data.limit === undefined ? 100 : data.limit, 1, 500);
      var auditRows = readTable('Audit_Log').rows.slice(-limit).reverse();
      return respond({ result: 'success', version: CODE_VERSION, audit: auditRows });
    }
    if (action === 'rwRtHealth') {
      var rtId = clean(data.rtId, 20).toUpperCase();
      var rt = findRt(rtId);
      if (!rt) return respond(fail('rt_not_found', 'RT tidak ditemukan: ' + rtId));
      try {
        var check = callRt(rt, 'rwCheck', {});
        updateRegistryRuntime(rtId, { 'Backend Version': clean(check.version, 80), 'Last Error': '' });
        audit(user, 'rt_health', rtId, '', 'ok', check.version || '');
        return respond({ result: 'success', version: CODE_VERSION, rtId: rtId, check: check });
      } catch (healthErr) {
        updateRegistryRuntime(rtId, { 'Last Error': String(healthErr.message || healthErr).slice(0, 500) });
        audit(user, 'rt_health', rtId, '', 'error', String(healthErr.message || healthErr));
        return respond(fail(healthErr.code || 'rt_unreachable', String(healthErr.message || healthErr)));
      }
    }
    return respond(fail('invalid_action', 'Aksi tidak dikenal: ' + action));
  } catch (error) {
    return respond(fail('server_error', String(error && error.message ? error.message : error)));
  }
}

// Jalankan sekali dari editor Apps Script setelah mengatur Script Properties.
function setupOrchestrator() {
  ensureSchema();
  return {
    result: 'success',
    version: CODE_VERSION,
    sheets: Object.keys(SCHEMA),
    settings: listSettings()
  };
}

function processOutboxTrigger() {
  processOutbox(50);
}

// Pasang trigger retry dan retensi. Jalankan sekali dari editor.
function installTriggers() {
  var handlers = ['processOutboxTrigger', 'cleanupRetention', 'digestTrigger'];
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (handlers.indexOf(existing[i].getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(existing[i]);
  }
  ScriptApp.newTrigger('processOutboxTrigger').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('cleanupRetention').timeBased().everyDays(1).atHour(2).create();
  // Trigger digest tiap jam; sendDailyDigest() hanya mengirim saat jam lokal
  // sama dengan DIGEST_HOUR dan belum dikirim hari itu.
  ScriptApp.newTrigger('digestTrigger').timeBased().everyHours(1).create();
  return { result: 'success', version: CODE_VERSION, triggers: handlers };
}
