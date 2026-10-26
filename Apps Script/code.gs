var CODE_VERSION = "publik-v38-2026-10-26";

// Semua Timestamp disimpan sebagai Date asli, ditampilkan dd-mm-yyyy hh:mm (GMT+7).
// CATATAN: pada Utilities.formatDate (Java) bulan = 'MM' & jam 24 = 'HH'; pada
// number format Google Sheets bulan tetap 'mm' (dibedakan dari menit oleh posisi).
var TZ = "Asia/Jakarta";
var TS_FORMAT = "dd-mm-yyyy hh:mm";

// Jumlah kolom data (termasuk kolom A Timestamp), TIDAK termasuk kolom bantu "ID".
var EXPECTED_FIELDS = {
  "Data_Warga": 14,     // A Timestamp + 13 field (termasuk kolom "Diarsipkan")
  "Iuran_Kas": 9,       // A Timestamp + 8 field (termasuk Diarsipkan & Reversal Dari)
  "Pengumuman": 7,      // A Timestamp + 6 field (termasuk Publik)
  "Kegiatan_Warga": 8,  // A Timestamp + 7 field (termasuk Publik)
  "Pengajuan_Surat": 19, // A Timestamp + 18 field (termasuk 7 field alur RW)
  "Lapor_Aspirasi": 21  // A Timestamp + 20 field (termasuk 4 field alur RW)
};

// Header lengkap yang diharapkan (data + kolom bantu ID di paling kanan).
var DESIRED_HEADERS = {
  "Data_Warga": ["Timestamp", "Nomor KK", "Nama Lengkap", "Status", "Jenis Kelamin", "NIK", "Tempat Lahir", "Tanggal Lahir", "Pendidikan", "Pekerjaan", "No HP", "Status Tempat Tinggal", "Alamat/No Rumah", "Diarsipkan", "ID"],
  "Iuran_Kas": ["Timestamp", "Tanggal", "Nama Warga", "No Rumah", "Jenis Transaksi", "Jumlah (Rp)", "Keterangan", "Diarsipkan", "Reversal Dari", "ID"],
  "Pengumuman": ["Timestamp", "Tanggal", "Judul Pengumuman", "Isi Pengumuman", "Kategori", "Penanggung Jawab", "Publik", "ID"],
  "Kegiatan_Warga": ["Timestamp", "Nama Kegiatan", "Tanggal Pelaksanaan", "Waktu", "Lokasi", "Penanggung Jawab", "Keterangan", "Publik", "ID"],
  "Pengajuan_Surat": ["Timestamp", "Nama Lengkap Pemohon", "NIK", "No. HP / WhatsApp", "Alamat / No. Rumah", "Jenis Surat", "Keperluan / Alasan Pengajuan", "Status Pengurusan", "No. Surat", "Catatan Pengurus", "Tanggal Selesai", "Diarsipkan", "Rw Status", "Rw Catatan", "Rw Oleh", "Rw Tanggal", "Rw Revisi", "Rw Versi", "Rw Kunci", "ID"],
  "Lapor_Aspirasi": ["Timestamp", "No. Pengaduan", "Nama Warga", "No. HP / WhatsApp", "Alamat / No. Rumah", "Jenis Pengaduan", "Judul Pengaduan", "Detail Pengaduan", "Lokasi Kejadian", "Tanggal Kejadian", "Foto / Bukti Pendukung", "Harapan / Solusi", "Status", "Petugas / Pengurus", "Catatan Tindak Lanjut", "Tanggal Penyelesaian", "Diarsipkan", "Rw Status", "Rw Petugas", "Rw Diperbarui", "Rw Kunci", "ID"],
  "Lapor_Tindak_Lanjut": ["ID", "Lapor ID", "RT ID", "Aktor", "Peran", "Catatan", "Status", "Visibilitas", "Waktu"]
};

// Nilai default kolom Publik untuk baris lama saat migrasi.
var PUBLIK_DEFAULT = "Ya";

// 0-based index kolom "Publik" di dalam array baris (sebelum kolom bantu ID).
var PUBLIK_INDEX = {
  "Pengumuman": 6,
  "Kegiatan_Warga": 7
};

// ================= ALUR PERSETUJUAN RW 06 =================
// Indeks kolom 0-based (sebelum kolom bantu ID).
var SURAT_RW_STATUS_COL = 12;
var SURAT_RW_CATATAN_COL = 13;
var SURAT_RW_OLEH_COL = 14;
var SURAT_RW_TANGGAL_COL = 15;
var SURAT_RW_REVISI_COL = 16;
var SURAT_RW_VERSI_COL = 17;
var SURAT_RW_KUNCI_COL = 18;

var LAPOR_RW_STATUS_COL = 17;
var LAPOR_RW_PETUGAS_COL = 18;
var LAPOR_RW_DIPERBARUI_COL = 19;
var LAPOR_RW_KUNCI_COL = 20;

var SURAT_RW_STATUSES = ['Tidak Perlu', 'Menunggu', 'Disetujui', 'Dikembalikan', 'Ditolak'];
var LAPOR_RW_STATUSES = ['Tidak Perlu', 'Perlu Tindak Lanjut', 'Ditangani RW', 'Selesai RW'];
var RW_DECISIONS = ['Disetujui', 'Dikembalikan', 'Ditolak'];
var SURAT_RW_MAX_REVISI = 3;
var RW_TOKEN_PROP = 'RW_TOKEN';
var RT_ID_PROP = 'RT_ID';
var RW_SCHEMA_FLAG_PROP = 'RW_SCHEMA_MIGRATED';
var RW_READ_SHEETS = ['Data_Warga', 'Iuran_Kas', 'Pengumuman', 'Kegiatan_Warga', 'Pengajuan_Surat', 'Lapor_Aspirasi', 'Lapor_Tindak_Lanjut'];

// ================= NOTIFIKASI EMAIL (dapat diubah lewat Script Properties) =================
// Nama pengirim (From display name) notifikasi email pengajuan surat.
// Ubah via Script Property "NOTIF_SENDER_NAME" (lihat readme).
var NOTIF_SENDER_NAME_DEFAULT = "Pengajuan surat";

// Ambil nama pengirim notifikasi; fallback ke default bila properti kosong.
function getNotifSenderName() {
  var v = PropertiesService.getScriptProperties().getProperty('NOTIF_SENDER_NAME');
  v = (v == null) ? '' : String(v).trim();
  return v || NOTIF_SENDER_NAME_DEFAULT;
}

// Prefiks subjek email notifikasi pengajuan surat.
// Ubah via Script Property "NOTIF_SUBJECT_PREFIX"; fallback ke default.
var NOTIF_SUBJECT_PREFIX_DEFAULT = "[SAPA-RT]";

function getNotifSubjectPrefix() {
  var v = PropertiesService.getScriptProperties().getProperty('NOTIF_SUBJECT_PREFIX');
  v = (v == null) ? '' : String(v).trim();
  return v || NOTIF_SUBJECT_PREFIX_DEFAULT;
}

// Ambil alamat Reply-To notifikasi; bila Script Property "NOTIF_REPLY_TO" kosong,
// memakai alamat penerima (ADMIN_EMAIL) sebagai default.
function getNotifReplyTo(adminEmail) {
  var v = PropertiesService.getScriptProperties().getProperty('NOTIF_REPLY_TO');
  v = (v == null) ? '' : String(v).trim();
  return v || adminEmail || '';
}

// Susun opsi MailApp.sendEmail dengan nama pengirim & Reply-To terparameter.
// htmlBody opsional: bila diisi, email dikirim sebagai HTML (body tetap dipakai
// sebagai fallback teks biasa).
function buildNotifMailOptions(to, subject, body, htmlBody) {
  var opts = {
    to: to,
    subject: subject,
    body: body,
    name: getNotifSenderName()
  };
  if (htmlBody) opts.htmlBody = htmlBody;
  var replyTo = getNotifReplyTo(to);
  if (replyTo) opts.replyTo = replyTo;
  return opts;
}

// Escape teks agar aman dipakai di dalam body HTML notifikasi.
function escapeNotifHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bangun body HTML dari daftar baris teks; baris kontrol `linkLine` diganti
// menjadi tautan <a> ke `linkUrl` dengan teks `linkText`.
function buildNotifHtmlLines(lines, linkLine, linkUrl, linkText) {
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    if (linkLine && ln === linkLine) {
      out.push(escapeNotifHtml(ln.slice(0, ln.length - linkUrl.length)) +
        '<a href="' + escapeNotifHtml(linkUrl) + '">' + escapeNotifHtml(linkText || linkUrl) + '</a>');
    } else {
      out.push(escapeNotifHtml(ln));
    }
  }
  return out.join('<br>');
}

// ================= KEAMANAN / TOKEN ADMIN =================
// Token admin disimpan di Script Properties: Project Settings > Script Properties,
// key "ADMIN_TOKEN". Semua operasi tulis (add/update/delete) dan baca lengkap
// WAJIB menyertakan token ini. Portal publik memakai action=readPublic (tanpa token)
// yang hanya mengembalikan Pengumuman & Kegiatan ber-Publik "Ya".
function getAdminToken() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '';
}

// Alamat email admin (Script Property "ADMIN_EMAIL"): penerima notifikasi
// pengajuan surat. Dibaca untuk ditampilkan & diubah dari panel Pengaturan.
function getAdminEmail() {
  var v = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  return (v == null) ? '' : String(v).trim();
}

// Validasi sederhana format alamat email (cukup untuk mencegah salah ketik).
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v == null ? '' : v).trim());
}

// ================= SALDO AWAL KAS (Script Property "SALDO_AWAL") =================
// Saldo pembukaan kas RT yang menjadi nilai dasar perhitungan saldo akhir:
//   Saldo Akhir = Saldo Awal + Total Pemasukan - Total Pengeluaran.
// Dibaca untuk ditampilkan & diubah dari panel Iuran & Kas.
var SALDO_AWAL_PROP = 'SALDO_AWAL';

function getSaldoAwal() {
  var v = PropertiesService.getScriptProperties().getProperty(SALDO_AWAL_PROP);
  var n = Number(v);
  return (isFinite(n) && n >= 0) ? n : 0;
}

// Aksi admin (token): simpan Saldo Awal ke Script Property SALDO_AWAL.
function handleSetSaldoAwal(data) {
  var raw = (data && data.saldoAwal != null) ? data.saldoAwal : '';
  var n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  if (!isFinite(n) || n < 0) {
    return { "result": "error", "code": "invalid", "message": "Saldo awal harus berupa angka >= 0." };
  }
  n = Math.round(n);
  PropertiesService.getScriptProperties().setProperty(SALDO_AWAL_PROP, String(n));
  return { "result": "success", "saldoAwal": n, "message": "Saldo awal disimpan." };
}

// Perbandingan string konstan (tidak membocorkan panjang/posisi karakter).
function safeEqual(a, b) {
  a = String(a === undefined || a === null ? '' : a);
  b = String(b === undefined || b === null ? '' : b);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// True bila token yang dikirim cocok dengan ADMIN_TOKEN yang tersimpan.
// Bila ADMIN_TOKEN belum diatur, SEMUA operasi terproteksi ditolak.
function isAuthorized(token) {
  var expected = getAdminToken();
  if (!expected) return false;
  return safeEqual(token, expected);
}

function unauthorized() {
  return {
    "result": "error",
    "code": "unauthorized",
    "message": "Token admin tidak valid atau belum diatur (Script Properties: ADMIN_TOKEN)."
  };
}

// ================= TOKEN & IDENTITAS RW =================
// Token khusus aksi RW (terpisah dari ADMIN_TOKEN). Diatur di Script Properties
// key "RW_TOKEN" dan hanya disimpan di server orkestrator RW.
function getRwToken() {
  return PropertiesService.getScriptProperties().getProperty(RW_TOKEN_PROP) || '';
}

function isRwAuthorized(token) {
  var expected = getRwToken();
  if (!expected) return false;
  return safeEqual(token, expected);
}

function rwUnauthorized() {
  return {
    "result": "error",
    "code": "rw_unauthorized",
    "version": CODE_VERSION,
    "message": "Token RW tidak valid atau belum diatur (Script Properties: RW_TOKEN)."
  };
}

// ID RT untuk kolom "RT ID" pada Lapor_Tindak_Lanjut (opsional, key "RT_ID").
function getRtId() {
  var v = PropertiesService.getScriptProperties().getProperty(RT_ID_PROP);
  return cleanStr(v, 40);
}

function normalizeSuratRwStatus(value, fallback) {
  var s = cleanStr(value, 40);
  return SURAT_RW_STATUSES.indexOf(s) === -1 ? (fallback || 'Tidak Perlu') : s;
}

function normalizeLaporRwStatus(value, fallback) {
  var s = cleanStr(value, 40);
  return LAPOR_RW_STATUSES.indexOf(s) === -1 ? (fallback || 'Tidak Perlu') : s;
}

function intAtLeast(value, min) {
  var n = Number(value);
  if (!isFinite(n)) return min;
  n = Math.floor(n);
  return n < min ? min : n;
}

function rwStamp(date) {
  return Utilities.formatDate(date || new Date(), TZ, 'yyyy-MM-dd HH:mm');
}

function rwError(code, message) {
  return { "result": "error", "code": code, "version": CODE_VERSION, "message": message };
}

// ================= STATUS PORTAL PUBLIK =================
// Flag ON/OFF portal publik disimpan di Script Properties: key "PUBLIC_PORTAL_ENABLED".
// Bila "false", action=readPublic ditolak sehingga data tidak bisa diakses publik.
// Bila properti belum diatur, portal dianggap AKTIF (default).
var PORTAL_PROP = 'PUBLIC_PORTAL_ENABLED';

function isPortalEnabled() {
  var v = PropertiesService.getScriptProperties().getProperty(PORTAL_PROP);
  if (v === null || v === undefined || v === '') return true;
  return String(v).trim().toLowerCase() !== 'false';
}

function setPortalEnabled(enabled) {
  PropertiesService.getScriptProperties().setProperty(PORTAL_PROP, enabled ? 'true' : 'false');
  return isPortalEnabled();
}

// ================= STATUS FITUR LAPOR & ASPIRASI =================
// Flag ON/OFF fitur "Lapor & Aspirasi" di portal publik, terpisah dari portal utama.
// Disimpan di Script Properties key "LAPOR_ENABLED". Bila "false", aksi publik
// submitLapor/lookupWargaHp/checkLapor ditolak. Bila belum diatur, dianggap AKTIF.
var LAPOR_PROP = 'LAPOR_ENABLED';

function isLaporEnabled() {
  var v = PropertiesService.getScriptProperties().getProperty(LAPOR_PROP);
  if (v === null || v === undefined || v === '') return true;
  return String(v).trim().toLowerCase() !== 'false';
}

function setLaporEnabled(enabled) {
  PropertiesService.getScriptProperties().setProperty(LAPOR_PROP, enabled ? 'true' : 'false');
  return isLaporEnabled();
}

// ================= STATUS FITUR LAYANAN SURAT =================
// Flag ON/OFF fitur "Layanan Surat" di portal publik, terpisah dari portal utama
// dan dari Lapor & Aspirasi. Disimpan di Script Properties key "SURAT_ENABLED".
// Bila "false", aksi publik submitSurat/checkSurat/lookupWarga ditolak.
var SURAT_PROP = 'SURAT_ENABLED';

function isSuratEnabled() {
  var v = PropertiesService.getScriptProperties().getProperty(SURAT_PROP);
  if (v === null || v === undefined || v === '') return true;
  return String(v).trim().toLowerCase() !== 'false';
}

function setSuratEnabled(enabled) {
  PropertiesService.getScriptProperties().setProperty(SURAT_PROP, enabled ? 'true' : 'false');
  return isSuratEnabled();
}

// True bila nilai Publik berarti tampil di portal publik.
function isPublik(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'ya' || s === 'yes' || s === 'true' || s === '1' || s === 'publik';
}

// Normalisasi nilai Publik ke "Ya" / "Tidak". Default "Ya" bila kosong.
function normalizePublik(v) {
  if (v === undefined || v === null || v === '') return PUBLIK_DEFAULT;
  return isPublik(v) ? 'Ya' : 'Tidak';
}

// True bila nilai Diarsipkan menandai baris warga diarsipkan (disembunyikan).
function isArsip(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  var s = String(v).trim().toLowerCase();
  return s === 'ya' || s === 'yes' || s === 'true' || s === '1' || s === 'arsip';
}

// Normalisasi nilai Diarsipkan ke "Ya" / "Tidak". Default "Tidak" (aktif).
function normalizeArsip(v) {
  return isArsip(v) ? 'Ya' : 'Tidak';
}

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var payload;

  // Handle delete action via GET (for JSONP support)
  if (params.action === 'delete') {
    payload = handleDelete(params);
  } else if (params.action === 'read') {
    // Baca LENGKAP (Data_Warga, Iuran_Kas, dst.) -> hanya untuk admin (butuh token).
    payload = isAuthorized(params.token) ? readAllSheets() : unauthorized();
  } else if (params.action === 'readPublic') {
    // Baca publik: hanya Pengumuman & Kegiatan ber-Publik "Ya", tanpa token.
    payload = readPublicSheets();
  } else if (params.action === 'checkSurat') {
    // Cek status pengajuan surat oleh warga: cocokkan NIK + No. HP. Tanpa token.
    payload = handleCheckSurat(params);
  } else if (params.action === 'checkSuratDuplicate') {
    // Peringatan pengajuan serupa (NIK + HP + jenis surat). Tanpa token.
    payload = handleCheckSuratDuplicate(params);
  } else if (params.action === 'lookupWarga') {
    // Cari profil warga berdasarkan NIK (bantu isi form surat). Tanpa token.
    payload = handleLookupWarga(params);
  } else if (params.action === 'lookupWargaHp') {
    // Cari profil warga berdasarkan No. HP/WhatsApp (bantu isi form Lapor & Aspirasi). Tanpa token.
    payload = handleLookupWargaHp(params);
  } else if (params.action === 'checkLapor') {
    // Cek status pengaduan oleh warga dengan No. Pengaduan. Tanpa token.
    payload = handleCheckLapor(params);
  } else if (params.action === 'checkLaporDuplicate') {
    // Peringatan pengaduan serupa (No. HP + jenis) pada hari yang sama. Tanpa token.
    payload = handleCheckLaporDuplicate(params);
  } else if (params.action === 'sendTestEmail') {
    // Kirim email uji notifikasi (butuh token admin). Bila params.email diisi,
    // alamat itu dipakai sebagai penerima sekaligus disimpan ke ADMIN_EMAIL.
    payload = isAuthorized(params.token) ? handleSendTestEmail(params) : unauthorized();
  } else if (params.action === 'version') {
    payload = { "result": "success", "version": CODE_VERSION };
  } else {
    payload = { "result": "success", "message": "Web App aktif", "version": CODE_VERSION };
  }

  // Dukungan JSONP untuk membaca data lintas-domain tanpa masalah CORS.
  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return respond(payload);
}

// Handle delete request (JSONP / GET)
function handleDelete(params) {
  var sheetName = params.sheetName;
  var id = params.id;

  if (!sheetName || !EXPECTED_FIELDS[sheetName] || id === undefined || id === null || id === '') {
    return { "result": "error", "message": "Parameter tidak valid" };
  }

  if (!isAuthorized(params.token)) {
    return unauthorized();
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { "result": "error", "message": "Sheet tidak ditemukan: " + sheetName };
  }

  var row = findRowById(sheet, sheetName, id);
  if (row === -1) {
    return { "result": "error", "message": "ID tidak ditemukan: " + id };
  }

  sheet.deleteRow(row);

  return { "result": "success", "message": "Row deleted from " + sheetName };
}

// Migrasi layout: sisipkan kolom "Publik" bila sheet pernah pakai layout lama
// (ID sudah ada, tapi kolom Publik belum). Aman dijalankan berulang.
function migrateLayout(sheet, name) {
  var desired = DESIRED_HEADERS[name];
  if (!desired) return;

  // Sheet yang layoutnya bisa berubah (mis. menyisipkan kolom baru di tengah):
  // susun ulang berdasarkan NAMA header. Aman & idempoten.
  if (name === 'Data_Warga' || name === 'Pengajuan_Surat' || name === 'Iuran_Kas' || name === 'Lapor_Aspirasi') {
    migrateLayoutByName(sheet, desired);
    return;
  }

  var publIndex = desired.indexOf('Publik'); // 0-based, -1 jika sheet ini tidak punya Publik
  if (publIndex === -1) return;

  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) lastCol = 1;
  var width = Math.max(lastCol, desired.length);
  var header = sheet.getRange(1, 1, 1, width).getValues()[0];
  if (header.indexOf('Publik') !== -1) return; // sudah dimigrasi

  if (header.join('').trim() === '') return; // sheet kosong, header diurus pemanggil
  if (header.indexOf('ID') === -1) {
    // Belum ada kolom ID (layout awal) -> cukup tulis header Publik.
    sheet.getRange(1, publIndex + 1).setValue('Publik');
    return;
  }

  // Legacy: kolom ID sudah ada tepat setelah field terakhir -> sisipkan Publik sebelum ID.
  sheet.insertColumnBefore(publIndex + 1);
  sheet.getRange(1, publIndex + 1).setValue('Publik');

  var dataRows = sheet.getLastRow() - 1;
  if (dataRows > 0) {
    var fill = [];
    for (var i = 0; i < dataRows; i++) fill.push([PUBLIK_DEFAULT]);
    sheet.getRange(2, publIndex + 1, dataRows, 1).setValues(fill);
  }
}

// Migrasi layout berbasis NAMA header (dipakai Data_Warga & Pengajuan_Surat).
// Pemetaan dilakukan BERDASARKAN NAMA header, bukan posisi, sehingga aman untuk
// berbagai layout lama (termasuk saat kolom baru disisipkan di tengah, mis.
// "No. Surat"). Aman dijalankan berulang: bila header sudah sesuai, fungsi
// langsung keluar tanpa menulis apa pun.
function migrateLayoutByName(sheet, desired) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) lastCol = 1;
  var lastRow = sheet.getLastRow();
  var width = Math.max(lastCol, desired.length);

  var header = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h === null || h === undefined ? '' : h).trim();
  });
  if (header.join('').trim() === '') return; // sheet kosong, header diurus pemanggil

  // Cek apakah header (kolom data) sudah sama persis dengan yang diharapkan.
  var same = true;
  for (var i = 0; i < desired.length; i++) {
    if (String(header[i] || '') !== String(desired[i])) { same = false; break; }
  }
  if (same) return; // sudah layout terbaru

  // Peta nama header lama -> indeks kolom (0-based).
  var indexOf = {};
  for (var c = 0; c < header.length; c++) {
    if (header[c] && indexOf[header[c]] === undefined) indexOf[header[c]] = c;
  }

  // Susun ulang data lama mengikuti urutan header baru.
  var rows = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
    rows = values.map(function (row) {
      return desired.map(function (name) {
        var idx = indexOf[name];
        return (idx === undefined) ? '' : row[idx];
      });
    });
  }

  // Tulis ulang seluruh sheet agar urutan kolom konsisten.
  var matrix = [desired.slice()].concat(rows);
  sheet.clearContents();
  sheet.getRange(1, 1, matrix.length, desired.length).setValues(matrix);
}

// Pastikan timezone spreadsheet = GMT+7, kolom Timestamp berformat dd-mm-yyyy hh:mm,
// header kolom bantu "ID" sudah ada, dan kolom "Publik" termigrasi.
function ensureSpreadsheetFormat(ss, sheet, name) {
  if (ss.getSpreadsheetTimeZone() !== TZ) {
    ss.setSpreadsheetTimeZone(TZ);
  }
  migrateLayout(sheet, name);
  var expected = EXPECTED_FIELDS[name];
  if (expected) {
    var h = sheet.getRange(1, expected + 1).getValue();
    if (String(h) !== 'ID') sheet.getRange(1, expected + 1).setValue('ID');
  }
  var last = sheet.getLastRow();
  if (last >= 2) {
    if (sheet.getRange(2, 1).getNumberFormat() !== TS_FORMAT) {
      sheet.getRange(2, 1, last - 1, 1).setNumberFormat(TS_FORMAT);
    }
  }
}

// Perbaiki nilai Rw Status pengaduan yang tidak dikenal (mis. ID baris lama
// yang tertulis karena layout sheet belum termigrasi). Header diverifikasi
// lebih dulu agar kolom ID tidak pernah tertimpa.
function healInvalidLaporRwStatus(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return;
  var idCol = EXPECTED_FIELDS['Lapor_Aspirasi'] + 1;
  if (sheet.getLastColumn() < idCol) return;
  var statusHeader = String(sheet.getRange(1, LAPOR_RW_STATUS_COL + 1).getValue() || '').trim();
  var idHeader = String(sheet.getRange(1, idCol).getValue() || '').trim();
  if (statusHeader !== 'Rw Status' || idHeader !== 'ID') return;

  var range = sheet.getRange(2, LAPOR_RW_STATUS_COL + 1, sheet.getLastRow() - 1, 1);
  var values = range.getValues();
  var changed = false;
  for (var i = 0; i < values.length; i++) {
    var raw = values[i][0];
    var normalized = normalizeLaporRwStatus(raw, 'Tidak Perlu');
    if (String(raw === null || raw === undefined ? '' : raw) !== normalized) {
      values[i][0] = normalized;
      changed = true;
    }
  }
  if (changed) range.setValues(values);

  // Versi lama sempat menulis timestamp ke kolom Rw Petugas saat eskalasi.
  if (String(sheet.getRange(1, LAPOR_RW_PETUGAS_COL + 1).getValue() || '').trim() === 'Rw Petugas') {
    var pRange = sheet.getRange(2, LAPOR_RW_PETUGAS_COL + 1, sheet.getLastRow() - 1, 1);
    var pValues = pRange.getValues();
    var stampRe = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;
    var pChanged = false;
    for (var j = 0; j < pValues.length; j++) {
      if (stampRe.test(String(pValues[j][0] === null || pValues[j][0] === undefined ? '' : pValues[j][0]))) {
        pValues[j][0] = '';
        pChanged = true;
      }
    }
    if (pChanged) pRange.setValues(pValues);
  }
}

// Pastikan setiap baris punya ID stabil di kolom bantu terakhir.
// Mengembalikan array data rows (tanpa header), dengan ID di elemen terakhir.
function ensureIds(sheet, name) {
  var expected = EXPECTED_FIELDS[name];
  if (!expected) return [];

  var last = sheet.getLastRow();
  if (last < 1) return [];

  var values = sheet.getDataRange().getValues();
  var idCol = expected; // 0-based index kolom ID (tepat setelah field terakhir)
  var header = values[0] || [];

  if (String(header[idCol] === undefined ? '' : header[idCol]) !== 'ID') {
    sheet.getRange(1, idCol + 1).setValue('ID');
  }

  var rows = values.slice(1);
  var ids = [];
  var changed = false;

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var cur = row[idCol];
    if (cur === undefined || cur === null || cur === '') {
      cur = 'id-' + Date.now() + '-' + (i + 1) + '-' + Math.random().toString(36).slice(2, 7);
      row[idCol] = cur;
      changed = true;
    }
    ids.push([String(cur)]);
  }

  if (changed && rows.length > 0) {
    sheet.getRange(2, idCol + 1, rows.length, 1).setValues(ids);
  }

  return rows;
}

// Cari nomor baris spreadsheet (1-based, termasuk header) berdasarkan ID stabil.
// Mengembalikan -1 jika tidak ditemukan.
function findRowById(sheet, name, id) {
  var expected = EXPECTED_FIELDS[name];
  if (!expected || id === undefined || id === null || id === '') return -1;

  var last = sheet.getLastRow();
  if (last < 2) return -1;

  var ids = sheet.getRange(2, expected + 1, last - 1, 1).getValues();
  var target = String(id);
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === target) return i + 2;
  }
  return -1;
}

// Ambil sheet berdasarkan nama; bila belum ada tetapi termasuk skema yang
// dikenal (DESIRED_HEADERS), buat otomatis beserta baris header-nya.
// Mengembalikan null untuk nama sheet yang tidak dikenal.
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  var headers = DESIRED_HEADERS[name];
  if (!headers) return null;

  if (typeof ss.insertSheet !== 'function') return null; // lingkungan tanpa insertSheet (mis. uji)

  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

// Format kolom tanggal/waktu yang masih berupa objek Date dari Sheets.
function formatSheetRows(rows, fmt) {
  fmt = fmt || {};
  return rows.map(function (row) {
    return row.map(function (cell, col) {
      if (cell instanceof Date && fmt[col]) {
        return Utilities.formatDate(cell, TZ, fmt[col]);
      }
      return cell;
    });
  });
}

// Format tanggal untuk tabel publik (0-based index kolom).
var PUBLIC_FORMATS = {
  "Pengumuman": { 1: "yyyy-MM-dd" },
  "Kegiatan_Warga": { 2: "yyyy-MM-dd", 3: "HH:mm" }
};

function readAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var names = ["Data_Warga", "Iuran_Kas", "Pengumuman", "Kegiatan_Warga", "Pengajuan_Surat", "Lapor_Aspirasi"];
  var formats = {
    "Data_Warga": { 7: "yyyy-MM-dd" },
    "Iuran_Kas": { 1: "yyyy-MM-dd" },
    "Pengumuman": { 1: "yyyy-MM-dd" },
    "Kegiatan_Warga": { 2: "yyyy-MM-dd", 3: "HH:mm" },
    "Pengajuan_Surat": { 0: "yyyy-MM-dd HH:mm", 10: "yyyy-MM-dd", 15: "yyyy-MM-dd HH:mm" },
    "Lapor_Aspirasi": { 0: "yyyy-MM-dd HH:mm", 9: "yyyy-MM-dd", 15: "yyyy-MM-dd", 19: "yyyy-MM-dd HH:mm" }
  };
  var data = {};

  names.forEach(function (name) {
    var sheet = getOrCreateSheet(ss, name);
    if (!sheet) {
      data[name] = [];
      return;
    }

    ensureSpreadsheetFormat(ss, sheet, name);
    if (name === 'Lapor_Aspirasi') healInvalidLaporRwStatus(sheet);
    var rows = ensureIds(sheet, name);

    data[name] = formatSheetRows(rows, formats[name]);
  });

  return { "result": "success", "version": CODE_VERSION, "portalEnabled": isPortalEnabled(), "laporEnabled": isLaporEnabled(), "suratEnabled": isSuratEnabled(), "adminEmail": getAdminEmail(), "saldoAwal": getSaldoAwal(), "data": data };
}

// Baca hanya data yang boleh tampil di portal publik:
// Pengumuman & Kegiatan_Warga yang kolom Publik-nya "Ya".
// Data_Warga, Iuran_Kas, & Pengajuan_Surat TIDAK pernah dikembalikan,
// sehingga data privat tidak bocor.
// Bila portal dinonaktifkan admin, tidak ada data yang dikembalikan.
function readPublicSheets() {
  if (!isPortalEnabled()) {
    return {
      "result": "error",
      "code": "portal_disabled",
      "version": CODE_VERSION,
      "message": "Portal publik sedang dinonaktifkan oleh admin."
    };
  }

  // Baca HANYA dua sheet publik. Jangan panggil readAllSheets(): itu membaca
  // Data_Warga/Iuran_Kas/surat/lapor dan menulis ID bila kosong, sehingga
  // portal publik menjadi lambat dan melakukan kerja tulis yang tidak perlu.
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = { "Pengumuman": [], "Kegiatan_Warga": [] };

  ["Pengumuman", "Kegiatan_Warga"].forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return;
    var idx = PUBLIK_INDEX[name];
    var rows = values.slice(1).filter(function (row) {
      return row.some(function (cell) { return cell !== '' && cell !== null && cell !== undefined; });
    });
    data[name] = formatSheetRows(rows, PUBLIC_FORMATS[name]).filter(function (row) {
      return isPublik(row[idx]);
    });
  });

  return { "result": "success", "version": CODE_VERSION, "portalEnabled": true, "laporEnabled": isLaporEnabled(), "suratEnabled": isSuratEnabled(), "data": data };
}

// ================= MIGRASI SKEMA RW 06 =================
// Migrasi berbasis nama header: menambah kolom RW sebelum kolom bantu ID dan
// menandai surat/pengaduan lama sebagai "Tidak Perlu" (riwayat). Dijalankan
// sekali per spreadsheet (Script Property RW_SCHEMA_MIGRATED), aman diulang.
function markBlankRwStatus(sheet, headerName, fallback) {
  var last = sheet.getLastRow();
  if (last < 2) return;
  var width = sheet.getLastColumn();
  if (width < 1) return;
  var header = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) {
    return String(h === null || h === undefined ? '' : h).trim();
  });
  var idx = header.indexOf(headerName);
  if (idx === -1) return;
  var values = sheet.getRange(2, idx + 1, last - 1, 1).getValues();
  var out = [];
  var changed = false;
  for (var i = 0; i < values.length; i++) {
    var cur = values[i][0];
    if (cur === '' || cur === null || cur === undefined) {
      out.push([fallback]);
      changed = true;
    } else {
      out.push([cur]);
    }
  }
  if (changed) sheet.getRange(2, idx + 1, out.length, 1).setValues(out);
}

function ensureRwSchema(ss) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(RW_SCHEMA_FLAG_PROP) === 'true') return false;

  ['Pengajuan_Surat', 'Lapor_Aspirasi'].forEach(function (name) {
    var sheet = getOrCreateSheet(ss, name);
    if (!sheet) return;
    ensureSpreadsheetFormat(ss, sheet, name);
    markBlankRwStatus(sheet, 'Rw Status', 'Tidak Perlu');
  });

  getOrCreateSheet(ss, 'Lapor_Tindak_Lanjut');
  props.setProperty(RW_SCHEMA_FLAG_PROP, 'true');
  return true;
}

function ensureTimelineSheet(sheet) {
  if (!sheet) return false;
  var header = sheet.getRange(1, 1, 1, 9).getValues()[0];
  if (String(header[0] === undefined || header[0] === null ? '' : header[0]).trim() !== 'ID') {
    sheet.getRange(1, 1, 1, 9).setValues([DESIRED_HEADERS['Lapor_Tindak_Lanjut']]);
  }
  return true;
}

function appendLaporTimeline(ss, laporId, aktor, peran, catatan, status, visibilitas, waktu) {
  var sheet = getOrCreateSheet(ss, 'Lapor_Tindak_Lanjut');
  if (!ensureTimelineSheet(sheet)) return null;
  var id = 'TL-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + randomCode4();
  sheet.appendRow([
    id, laporId, getRtId(), aktor, peran, catatan, status, visibilitas, waktu || rwStamp()
  ]);
  return id;
}

function rwTimeCell(v) {
  if (v instanceof Date) return rwStamp(v);
  return cleanStr(v, 40);
}

// ================= ENDPOINT RW (token RW) =================
var RW_FORMATS = {
  "Data_Warga": { 7: "yyyy-MM-dd" },
  "Iuran_Kas": { 1: "yyyy-MM-dd" },
  "Pengumuman": { 1: "yyyy-MM-dd" },
  "Kegiatan_Warga": { 2: "yyyy-MM-dd", 3: "HH:mm" },
  "Pengajuan_Surat": { 0: "yyyy-MM-dd HH:mm", 10: "yyyy-MM-dd", 15: "yyyy-MM-dd HH:mm" },
  "Lapor_Aspirasi": { 0: "yyyy-MM-dd HH:mm", 9: "yyyy-MM-dd", 15: "yyyy-MM-dd", 19: "yyyy-MM-dd HH:mm" },
  "Lapor_Tindak_Lanjut": { 8: "yyyy-MM-dd HH:mm" }
};

function readRwSheet(ss, sheetName, includeArchived, statusFilter, laporIdFilter, limit, offset) {
  var formats = RW_FORMATS[sheetName] || {};
  var rows = [];
  var headers = DESIRED_HEADERS[sheetName] || [];

  if (sheetName === 'Lapor_Tindak_Lanjut') {
    var tl = ss.getSheetByName('Lapor_Tindak_Lanjut');
    if (tl && ensureTimelineSheet(tl) && tl.getLastRow() >= 2) {
      rows = tl.getDataRange().getValues().slice(1);
    }
  } else {
    var sheet = getOrCreateSheet(ss, sheetName);
    if (sheet) {
      ensureSpreadsheetFormat(ss, sheet, sheetName);
      if (sheetName === 'Lapor_Aspirasi') healInvalidLaporRwStatus(sheet);
      rows = ensureIds(sheet, sheetName);
    }
  }

  rows = formatSheetRows(rows, formats);
  var filtered = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (sheetName === 'Pengajuan_Surat' && !includeArchived && isArsip(row[11])) continue;
    if (sheetName === 'Lapor_Aspirasi' && !includeArchived && isArsip(row[16])) continue;
    if (statusFilter) {
      var st = (sheetName === 'Pengajuan_Surat') ? row[SURAT_RW_STATUS_COL]
        : (sheetName === 'Lapor_Aspirasi') ? row[LAPOR_RW_STATUS_COL] : '';
      if (String(st === null || st === undefined ? '' : st) !== statusFilter) continue;
    }
    if (laporIdFilter && sheetName === 'Lapor_Tindak_Lanjut') {
      if (String(row[1] === null || row[1] === undefined ? '' : row[1]) !== laporIdFilter) continue;
    }
    filtered.push(row);
  }

  var total = filtered.length;
  var start = offset > 0 ? offset : 0;
  var page = filtered.slice(start, start + limit);
  return { "headers": headers, "rows": page, "total": total, "offset": start, "limit": limit, "truncated": start + page.length < total };
}

function handleRwRead(data) {
  var sheetName = cleanStr(data.sheet, 60);
  if (RW_READ_SHEETS.indexOf(sheetName) === -1) {
    return rwError('invalid_sheet', 'Sheet tidak diizinkan untuk RW: ' + sheetName);
  }
  var includeArchived = (data.includeArchived === true || String(data.includeArchived) === 'true');
  var statusFilter = cleanStr(data.status, 40);
  var laporIdFilter = cleanStr(data.laporId, 60);
  var limit = (data.limit === undefined || data.limit === null || data.limit === '') ? 500 : intAtLeast(data.limit, 1);
  if (limit > 2000) limit = 2000;
  var offset = (data.offset === undefined || data.offset === null || data.offset === '') ? 0 : intAtLeast(data.offset, 0);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var page = readRwSheet(ss, sheetName, includeArchived, statusFilter, laporIdFilter, limit, offset);
  page.result = 'success';
  page.version = CODE_VERSION;
  page.sheet = sheetName;
  // Saldo awal dibutuhkan orkestrator RW untuk menghitung saldo kas yang benar.
  if (sheetName === 'Iuran_Kas') page.saldoAwal = getSaldoAwal();
  return page;
}

function suratRwSnapshot(row) {
  return {
    "id": String(row[EXPECTED_FIELDS['Pengajuan_Surat']] === undefined ? '' : row[EXPECTED_FIELDS['Pengajuan_Surat']]),
    "rwStatus": normalizeSuratRwStatus(row[SURAT_RW_STATUS_COL], 'Tidak Perlu'),
    "rwCatatan": cleanStr(row[SURAT_RW_CATATAN_COL], 1000),
    "rwOleh": cleanStr(row[SURAT_RW_OLEH_COL], 200),
    "rwTanggal": rwTimeCell(row[SURAT_RW_TANGGAL_COL]),
    "rwRevisi": intAtLeast(row[SURAT_RW_REVISI_COL], 0),
    "rwVersi": intAtLeast(row[SURAT_RW_VERSI_COL], 1)
  };
}

function handleRwSuratDecision(data) {
  var id = cleanStr(data.id, 60);
  var decision = cleanStr(data.decision, 30);
  var catatan = cleanStr(data.catatan, 1000);
  var aktor = cleanStr(data.aktor, 200);
  var kunci = cleanStr(data.kunci, 120);
  if (!id) return rwError('invalid', 'ID pengajuan wajib diisi.');
  if (RW_DECISIONS.indexOf(decision) === -1) return rwError('invalid_decision', 'Keputusan RW tidak dikenal.');
  if (decision !== 'Disetujui' && catatan.length < 3) {
    return rwError('note_required', 'Catatan wajib diisi untuk keputusan ' + decision + '.');
  }
  if (!aktor) return rwError('actor_required', 'Aktor (email/nama) RW wajib diisi.');
  if (kunci.length < 6) return rwError('idempotency_required', 'Kunci idempotensi wajib diisi (minimal 6 karakter).');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var sheet = ss.getSheetByName('Pengajuan_Surat');
  if (!sheet) return rwError('not_found', 'Sheet Pengajuan_Surat tidak ditemukan.');
  ensureSpreadsheetFormat(ss, sheet, 'Pengajuan_Surat');
  ensureIds(sheet, 'Pengajuan_Surat');
  var rowNum = findRowById(sheet, 'Pengajuan_Surat', id);
  if (rowNum === -1) return rwError('not_found', 'Pengajuan tidak ditemukan: ' + id);

  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(20000); } catch (e) { locked = false; }
  try {
    var row = sheet.getRange(rowNum, 1, 1, EXPECTED_FIELDS['Pengajuan_Surat'] + 1).getValues()[0];
    var snapshot = suratRwSnapshot(row);
    var curStatus = snapshot.rwStatus;
    var curRevisi = snapshot.rwRevisi;
    var curVersi = snapshot.rwVersi;
    var curKunci = cleanStr(row[SURAT_RW_KUNCI_COL], 120);

    if (curKunci && curKunci === kunci) {
      snapshot.duplicate = true;
      snapshot.result = 'success';
      snapshot.version = CODE_VERSION;
      return snapshot;
    }
    if (curStatus !== 'Menunggu') {
      return rwError('not_pending', 'Pengajuan tidak dalam status Menunggu (saat ini: ' + curStatus + ').');
    }
    if (data.expectedVersi !== undefined && data.expectedVersi !== null && data.expectedVersi !== '' &&
        Number(data.expectedVersi) !== curVersi) {
      return rwError('stale', 'Pengajuan sudah berubah sejak dibaca. Muat ulang data sebelum memutuskan.');
    }
    // Batas 3 revisi hanya menutup opsi Kembalikan. Keputusan Tolak tetap
    // tersedia sebagai keputusan final agar permintaan dapat ditutup tanpa
    // membuat pengajuan baru.
    if (decision === 'Dikembalikan' && curRevisi >= SURAT_RW_MAX_REVISI) {
      return rwError('max_negative', 'Batas ' + SURAT_RW_MAX_REVISI + ' revisi sudah tercapai. Gunakan Setujui atau Tolak sebagai keputusan final.');
    }

    var now = new Date();
    var finalReject = decision === 'Ditolak' && curRevisi >= SURAT_RW_MAX_REVISI;
    var newRevisi = (decision === 'Disetujui' || finalReject) ? curRevisi : curRevisi + 1;
    var newVersi = curVersi + 1;
    sheet.getRange(rowNum, SURAT_RW_STATUS_COL + 1, 1, 7).setValues([[
      decision,
      catatan,
      aktor,
      rwStamp(now),
      newRevisi,
      newVersi,
      kunci
    ]]);

    return {
      "result": "success",
      "version": CODE_VERSION,
      "id": id,
      "rwStatus": decision,
      "rwCatatan": catatan,
      "rwOleh": aktor,
      "rwTanggal": rwStamp(now),
      "rwRevisi": newRevisi,
      "rwVersi": newVersi
    };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e2) { /* abaikan */ } }
  }
}

function laporRwSnapshot(row) {
  return {
    "id": String(row[EXPECTED_FIELDS['Lapor_Aspirasi']] === undefined ? '' : row[EXPECTED_FIELDS['Lapor_Aspirasi']]),
    "rwStatus": normalizeLaporRwStatus(row[LAPOR_RW_STATUS_COL], 'Tidak Perlu'),
    "rwPetugas": cleanStr(row[LAPOR_RW_PETUGAS_COL], 100),
    "rwDiperbarui": rwTimeCell(row[LAPOR_RW_DIPERBARUI_COL])
  };
}

function handleRwLaporNote(data) {
  var id = cleanStr(data.id, 60);
  var catatan = cleanStr(data.catatan, 1000);
  var aktor = cleanStr(data.aktor, 200);
  var kunci = cleanStr(data.kunci, 120);
  var visibilitas = cleanStr(data.visibilitas, 20) || 'Publik';
  var status = cleanStr(data.status, 40);
  if (!id) return rwError('invalid', 'ID pengaduan wajib diisi.');
  if (catatan.length < 3) return rwError('note_required', 'Catatan tindak lanjut wajib diisi (minimal 3 karakter).');
  if (!aktor) return rwError('actor_required', 'Aktor (email/nama) RW wajib diisi.');
  if (kunci.length < 6) return rwError('idempotency_required', 'Kunci idempotensi wajib diisi (minimal 6 karakter).');
  if (visibilitas !== 'Publik' && visibilitas !== 'Internal') {
    return rwError('invalid_visibility', 'Visibilitas harus Publik atau Internal.');
  }
  if (status && ['Ditangani RW', 'Selesai RW'].indexOf(status) === -1) {
    return rwError('invalid_status', 'Status RW harus Ditangani RW atau Selesai RW.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var sheet = ss.getSheetByName('Lapor_Aspirasi');
  if (!sheet) return rwError('not_found', 'Sheet Lapor_Aspirasi tidak ditemukan.');
  ensureSpreadsheetFormat(ss, sheet, 'Lapor_Aspirasi');
  ensureIds(sheet, 'Lapor_Aspirasi');
  var rowNum = findRowById(sheet, 'Lapor_Aspirasi', id);
  if (rowNum === -1) return rwError('not_found', 'Pengaduan tidak ditemukan: ' + id);

  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(20000); } catch (e) { locked = false; }
  try {
    var row = sheet.getRange(rowNum, 1, 1, EXPECTED_FIELDS['Lapor_Aspirasi'] + 1).getValues()[0];
    var snapshot = laporRwSnapshot(row);
    var curKunci = cleanStr(row[LAPOR_RW_KUNCI_COL], 120);
    if (curKunci && curKunci === kunci) {
      snapshot.duplicate = true;
      snapshot.result = 'success';
      snapshot.version = CODE_VERSION;
      return snapshot;
    }
    if (data.expectedDiperbarui !== undefined && data.expectedDiperbarui !== null && data.expectedDiperbarui !== '' &&
        String(data.expectedDiperbarui) !== String(snapshot.rwDiperbarui)) {
      return rwError('stale', 'Pengaduan sudah berubah sejak dibaca. Muat ulang data sebelum mengirim tanggapan.');
    }

    var newStatus = status || snapshot.rwStatus;
    if (!status) {
      if (snapshot.rwStatus === 'Tidak Perlu' || snapshot.rwStatus === 'Perlu Tindak Lanjut') newStatus = 'Ditangani RW';
    }
    var now = new Date();
    var stamp = rwStamp(now);

    sheet.getRange(rowNum, LAPOR_RW_STATUS_COL + 1, 1, 4).setValues([[
      newStatus, aktor, stamp, kunci
    ]]);
    if (visibilitas === 'Publik') {
      // Backward compatibility: portal publik membaca kolom Catatan Tindak Lanjut.
      sheet.getRange(rowNum, 15).setValue(catatan);
    }

    var timelineId = appendLaporTimeline(ss, id, aktor, 'RW', catatan, newStatus, visibilitas, stamp);

    return {
      "result": "success",
      "version": CODE_VERSION,
      "id": id,
      "timelineId": timelineId,
      "rwStatus": newStatus,
      "rwPetugas": aktor,
      "rwDiperbarui": stamp,
      "visibilitas": visibilitas
    };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e2) { /* abaikan */ } }
  }
}

function handleRwCheck() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var migrated = false;
  try {
    ensureRwSchema(ss);
    migrated = PropertiesService.getScriptProperties().getProperty(RW_SCHEMA_FLAG_PROP) === 'true';
  } catch (e) { migrated = false; }
  return {
    "result": "success",
    "version": CODE_VERSION,
    "rtId": getRtId(),
    "rwTokenConfigured": !!getRwToken(),
    "schemaMigrated": migrated,
    "capabilities": ['rwRead', 'rwSuratDecision', 'rwLaporNote', 'rwCheck'],
    "suratMaxRevisi": SURAT_RW_MAX_REVISI,
    "sheets": RW_READ_SHEETS.slice()
  };
}

// Aksi admin RT: tandai pengaduan perlu tindak lanjut RW.
function handleLaporEscalate(data) {
  if (!isAuthorized(data.token)) return unauthorized();
  var id = cleanStr(data.id, 60);
  if (!id) return { "result": "error", "code": "invalid", "message": 'ID pengaduan wajib diisi.' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var sheet = ss.getSheetByName('Lapor_Aspirasi');
  if (!sheet) return { "result": "error", "code": "not_found", "message": 'Sheet Lapor_Aspirasi tidak ditemukan.' };
  ensureSpreadsheetFormat(ss, sheet, 'Lapor_Aspirasi');
  var rowNum = findRowById(sheet, 'Lapor_Aspirasi', id);
  if (rowNum === -1) return { "result": "error", "code": "not_found", "message": 'Pengaduan tidak ditemukan: ' + id };

  var row = sheet.getRange(rowNum, 1, 1, EXPECTED_FIELDS['Lapor_Aspirasi'] + 1).getValues()[0];
  var cur = normalizeLaporRwStatus(row[LAPOR_RW_STATUS_COL], 'Tidak Perlu');
  if (cur !== 'Tidak Perlu') {
    return { "result": "success", "id": id, "rwStatus": cur, "duplicate": true };
  }
  var stamp = rwStamp();
  sheet.getRange(rowNum, LAPOR_RW_STATUS_COL + 1, 1, 4).setValues([['Perlu Tindak Lanjut', '', stamp, '']]);
  return { "result": "success", "id": id, "rwStatus": 'Perlu Tindak Lanjut', "rwDiperbarui": stamp };
}

// Aksi admin RT: ajukan kembali surat yang Dikembalikan/Ditolak setelah direvisi.
function handleResubmitSurat(data) {
  if (!isAuthorized(data.token)) return unauthorized();
  var id = cleanStr(data.id, 60);
  if (!id) return { "result": "error", "code": "invalid", "message": 'ID pengajuan wajib diisi.' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var sheet = ss.getSheetByName('Pengajuan_Surat');
  if (!sheet) return { "result": "error", "code": "not_found", "message": 'Sheet Pengajuan_Surat tidak ditemukan.' };
  ensureSpreadsheetFormat(ss, sheet, 'Pengajuan_Surat');
  var rowNum = findRowById(sheet, 'Pengajuan_Surat', id);
  if (rowNum === -1) return { "result": "error", "code": "not_found", "message": 'Pengajuan tidak ditemukan: ' + id };

  var row = sheet.getRange(rowNum, 1, 1, EXPECTED_FIELDS['Pengajuan_Surat'] + 1).getValues()[0];
  var cur = normalizeSuratRwStatus(row[SURAT_RW_STATUS_COL], 'Tidak Perlu');
  var revisi = intAtLeast(row[SURAT_RW_REVISI_COL], 0);
  var versi = intAtLeast(row[SURAT_RW_VERSI_COL], 1);
  if (cur === 'Menunggu') {
    return { "result": "success", "id": id, "rwStatus": 'Menunggu', "duplicate": true };
  }
  if (cur !== 'Dikembalikan' && cur !== 'Ditolak') {
    return { "result": "error", "code": "not_returned", "message": 'Pengajuan tidak berstatus Dikembalikan/Ditolak (saat ini: ' + cur + ').' };
  }
  // Setelah revisi ketiga (Dikembalikan), RT tetap boleh mengajukan ulang
  // sekali agar RW memberi keputusan final (Setujui/Tolak). Ditolak pada
  // revisi maksimum bersifat final dan tidak dapat diajukan ulang.
  if (cur === 'Ditolak' && revisi >= SURAT_RW_MAX_REVISI) {
    return { "result": "error", "code": "max_negative", "message": 'Pengajuan sudah ditolak final setelah ' + SURAT_RW_MAX_REVISI + ' revisi. Buat pengajuan baru bila masih diperlukan.' };
  }
  sheet.getRange(rowNum, SURAT_RW_STATUS_COL + 1, 1, 1).setValue('Menunggu');
  sheet.getRange(rowNum, SURAT_RW_VERSI_COL + 1, 1, 1).setValue(versi + 1);
  sheet.getRange(rowNum, SURAT_RW_KUNCI_COL + 1, 1, 1).setValue('');
  return { "result": "success", "id": id, "rwStatus": 'Menunggu', "rwRevisi": revisi, "rwVersi": versi + 1 };
}

function doPost(e) {
  try {
    var raw = null;
    if (e && e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    } else if (e && e.postData && e.postData.contents) {
      raw = e.postData.contents;
    }

    if (!raw) {
      return respond({ "result": "error", "message": "Body kosong / tidak terbaca" });
    }

    var data = JSON.parse(raw);

    // ===== Aksi RW 06 (token RW, terpisah dari ADMIN_TOKEN) =====
    if (data.action === 'rwCheck' || data.action === 'rwRead' ||
        data.action === 'rwSuratDecision' || data.action === 'rwLaporNote') {
      if (!isRwAuthorized(data.token)) return respond(rwUnauthorized());
      if (data.action === 'rwCheck') return respond(handleRwCheck());
      if (data.action === 'rwRead') return respond(handleRwRead(data));
      if (data.action === 'rwSuratDecision') return respond(handleRwSuratDecision(data));
      return respond(handleRwLaporNote(data));
    }

    // Aksi admin RT: eskalasi pengaduan ke RW & ajukan ulang surat yang dikembalikan.
    if (data.action === 'laporEscalate') return respond(handleLaporEscalate(data));
    if (data.action === 'resubmitSurat') return respond(handleResubmitSurat(data));

    // Aksi khusus: mengubah status ON/OFF portal publik (butuh token admin).
    if (data.action === 'setPortalStatus') {
      if (!isAuthorized(data.token)) {
        return respond(unauthorized());
      }
      var enabled = setPortalEnabled(data.enabled === true || String(data.enabled) === 'true');
      return respond({ "result": "success", "portalEnabled": enabled });
    }

    // Aksi khusus: mengubah status ON/OFF fitur Lapor & Aspirasi (butuh token admin).
    if (data.action === 'setLaporStatus') {
      if (!isAuthorized(data.token)) {
        return respond(unauthorized());
      }
      var laporOn = setLaporEnabled(data.enabled === true || String(data.enabled) === 'true');
      return respond({ "result": "success", "laporEnabled": laporOn });
    }

    // Aksi khusus: mengubah status ON/OFF fitur Layanan Surat (butuh token admin).
    if (data.action === 'setSuratStatus') {
      if (!isAuthorized(data.token)) {
        return respond(unauthorized());
      }
      var suratOn = setSuratEnabled(data.enabled === true || String(data.enabled) === 'true');
      return respond({ "result": "success", "suratEnabled": suratOn });
    }

    // Aksi khusus: mengubah alamat email admin (ADMIN_EMAIL, butuh token admin).
    if (data.action === 'setAdminEmail') {
      if (!isAuthorized(data.token)) {
        return respond(unauthorized());
      }
      return respond(handleSetAdminEmail(data));
    }

    // Aksi khusus: mengubah Saldo Awal kas (SALDO_AWAL, butuh token admin).
    if (data.action === 'setSaldoAwal') {
      if (!isAuthorized(data.token)) {
        return respond(unauthorized());
      }
      return respond(handleSetSaldoAwal(data));
    }

    // Aksi publik: kirim pengajuan surat (TANPA token, hanya menambah baris baru).
    if (data.action === 'submitSurat') {
      return respond(handleSubmitSurat(data));
    }

    // Aksi publik: kirim laporan / aspirasi (TANPA token, hanya menambah baris baru).
    if (data.action === 'submitLapor') {
      return respond(handleSubmitLapor(data));
    }

    var sheetName = data.sheetName;
    if (!EXPECTED_FIELDS[sheetName]) {
      return respond({ "result": "error", "message": "sheetName tidak dikenal: " + sheetName });
    }

    // Semua operasi tulis (add/update/delete) wajib menyertakan token admin.
    if (!isAuthorized(data.token)) {
      return respond(unauthorized());
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureRwSchema(ss);
    var sheet = getOrCreateSheet(ss, sheetName);

    if (!sheet) {
      return respond({ "result": "error", "message": "Sheet tidak ditemukan" });
    }

    ensureSpreadsheetFormat(ss, sheet, sheetName);

    // UPDATE: perbarui baris yang sudah ada berdasarkan ID stabil (JANGAN tambah baris baru).
    if (data.action === "update") {
      var updRow = findRowById(sheet, sheetName, data.id);
      if (updRow === -1) {
        return respond({ "result": "error", "message": "ID tidak ditemukan: " + data.id });
      }
      var existingRow = sheet.getRange(updRow, 1, 1, EXPECTED_FIELDS[sheetName] + 1).getValues()[0];
      // Kolom RW hanya boleh diubah oleh endpoint RW (atau aksi eskalasi/ajukan ulang).
      // Saat admin RT menyimpan, nilai RW yang ada dipertahankan.
      if (sheetName === 'Pengajuan_Surat') {
        mergeSuratRwForAdminUpdate(data, existingRow);
      } else if (sheetName === 'Lapor_Aspirasi') {
        mergeLaporRwForAdminUpdate(data, existingRow);
      }
      var suratErrMsg = suratSaveError(sheetName, data,
        sheetName === 'Pengajuan_Surat' ? existingRow[SURAT_RW_STATUS_COL] : null);
      if (suratErrMsg) {
        return respond({ "result": "error", "code": "invalid", "message": suratErrMsg });
      }
      var existingTs = existingRow[0]; // pertahankan Timestamp asli
      var existingId = existingRow[EXPECTED_FIELDS[sheetName]]; // pertahankan ID
      var updRowData = buildRowData(sheetName, data, existingTs, existingId);
      sheet.getRange(updRow, 1, 1, updRowData.length).setValues([updRowData]);
      sheet.getRange(updRow, 1).setNumberFormat(TS_FORMAT);
      return respond({ "result": "success", "message": "Row updated" });
    }

    // ADD: baris baru selalu masuk antrean RW (surat: Menunggu, pengaduan: Tidak Perlu).
    if (sheetName === 'Pengajuan_Surat' || sheetName === 'Lapor_Aspirasi') {
      data.rwStatus = (sheetName === 'Pengajuan_Surat') ? 'Menunggu' : 'Tidak Perlu';
      var addSuratErr = suratSaveError(sheetName, data, data.rwStatus);
      if (addSuratErr) {
        return respond({ "result": "error", "code": "invalid", "message": addSuratErr });
      }
    }

    // DELETE: hapus baris berdasarkan ID stabil.
    if (data.action === "delete") {
      var delRow = findRowById(sheet, sheetName, data.id);
      if (delRow === -1) {
        return respond({ "result": "error", "message": "ID tidak ditemukan: " + data.id });
      }
      sheet.deleteRow(delRow);
      return respond({ "result": "success", "message": "Row deleted" });
    }

    // ADD: tambahkan baris baru. Timestamp = waktu server (GMT+7), ID dari frontend bila ada.
    // Untuk Pengajuan_Surat, bawaan ID memakai format No. Pengajuan (SRT-...).
    var addId = data.id ? String(data.id)
      : (sheetName === "Pengajuan_Surat" ? makeSuratId()
      : (sheetName === "Lapor_Aspirasi" ? ('ADU-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + randomCode4())
      : ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))));
    // Idempotensi: bila ID dari frontend sudah ada (mis. pengiriman ulang setelah koneksi
    // putus lewat antrean/outbox), JANGAN tambah baris duplikat — cukup laporkan sukses.
    if (data.id && findRowById(sheet, sheetName, addId) !== -1) {
      return respond({ "result": "success", "id": addId, "duplicate": true });
    }
    // Lapor_Aspirasi: lengkapi No. Pengaduan berurutan bila admin mencatat manual tanpa nomor.
    if (sheetName === "Lapor_Aspirasi" && !cleanStr(data.noPengaduan, 40)) {
      data.noPengaduan = makeNomorPengaduan(sheet);
    }
    var rowData = buildRowData(sheetName, data, new Date(), addId);
    sheet.appendRow(rowData);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat(TS_FORMAT);

    return respond({ "result": "success", "id": addId });

  } catch (error) {
    return respond({ "result": "error", "message": error.toString() });
  }
}

function buildRowData(sheetName, data, timestamp, id) {
  var rowData = [timestamp || new Date()];

  if (sheetName === "Data_Warga") {
    rowData.push(
      data.nomorKK, data.nama, data.status, data.jenisKelamin, data.nik,
      data.tempat, data.tanggalLahir, data.pendidikan, data.pekerjaan,
      data.noHp, data.statusTinggal, data.alamat, normalizeArsip(data.arsip)
    );
  } else if (sheetName === "Iuran_Kas") {
    rowData.push(data.tanggal, data.nama, data.noRumah, data.jenis, data.jumlah, data.keterangan, normalizeArsip(data.arsip), cleanStr(data.reversalDari, 120));
  } else if (sheetName === "Pengumuman") {
    rowData.push(data.tanggal, data.judul, data.isi, data.kategori, data.pj, normalizePublik(data.publik));
  } else if (sheetName === "Kegiatan_Warga") {
    rowData.push(data.namaKegiatan, data.tanggal, data.waktu, data.lokasi, data.pj, data.keterangan, normalizePublik(data.publik));
  } else if (sheetName === "Pengajuan_Surat") {
    rowData.push(
      data.nama, data.nik, data.noHp, data.alamat,
      data.jenisSurat, data.keperluan,
      data.status || "Pending", data.noSurat || "", data.catatan || "",
      data.tanggalSelesai || "", normalizeArsip(data.arsip),
      normalizeSuratRwStatus(data.rwStatus, 'Menunggu'),
      cleanStr(data.rwCatatan, 1000),
      cleanStr(data.rwOleh, 200),
      rwTimeCell(data.rwTanggal),
      intAtLeast(data.rwRevisi, 0),
      intAtLeast(data.rwVersi, 1),
      cleanStr(data.rwKunci, 120)
    );
  } else if (sheetName === "Lapor_Aspirasi") {
    rowData.push(
      data.noPengaduan, data.nama, data.noHp, data.alamat,
      data.jenisPengaduan, data.judul, data.detail,
      data.lokasi || "", data.tanggalKejadian || "", data.foto || "",
      data.harapan || "",
      data.status || "Diterima", data.petugas || "", data.catatanTindakLanjut || "",
      data.tanggalPenyelesaian || "", normalizeArsip(data.arsip),
      normalizeLaporRwStatus(data.rwStatus, 'Tidak Perlu'),
      cleanStr(data.rwPetugas, 100),
      rwTimeCell(data.rwDiperbarui),
      cleanStr(data.rwKunci, 120)
    );
  } else {
    return null;
  }

  rowData.push(id || (sheetName === 'Pengajuan_Surat' ? makeSuratId() : ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))));
  return rowData;
}

// Pertahankan kolom RW saat admin RT menyimpan surat. Bila isi pengajuan
// berubah, versi dinaikkan agar keputusan RW yang dibuat dari data lama ditolak.
function mergeSuratRwForAdminUpdate(data, existingRow) {
  data.rwStatus = normalizeSuratRwStatus(existingRow[SURAT_RW_STATUS_COL], 'Tidak Perlu');
  data.rwCatatan = existingRow[SURAT_RW_CATATAN_COL] || '';
  data.rwOleh = existingRow[SURAT_RW_OLEH_COL] || '';
  data.rwTanggal = existingRow[SURAT_RW_TANGGAL_COL] || '';
  data.rwRevisi = intAtLeast(existingRow[SURAT_RW_REVISI_COL], 0);
  data.rwVersi = intAtLeast(existingRow[SURAT_RW_VERSI_COL], 1);
  data.rwKunci = existingRow[SURAT_RW_KUNCI_COL] || '';

  var fields = [['nama', 1], ['nik', 2], ['noHp', 3], ['alamat', 4], ['jenisSurat', 5], ['keperluan', 6]];
  var changed = false;
  for (var i = 0; i < fields.length; i++) {
    var incoming = (data[fields[i][0]] === undefined || data[fields[i][0]] === null) ? '' : String(data[fields[i][0]]);
    var current = (existingRow[fields[i][1]] === undefined || existingRow[fields[i][1]] === null) ? '' : String(existingRow[fields[i][1]]);
    if (incoming !== current) { changed = true; break; }
  }
  if (!changed) return;

  data.rwVersi += 1;
  if (data.rwStatus === 'Disetujui') {
    data.rwStatus = 'Menunggu';
    data.rwKunci = '';
  }
}

// Pertahankan kolom RW saat admin RT menyimpan pengaduan.
function mergeLaporRwForAdminUpdate(data, existingRow) {
  data.rwStatus = normalizeLaporRwStatus(existingRow[LAPOR_RW_STATUS_COL], 'Tidak Perlu');
  data.rwPetugas = existingRow[LAPOR_RW_PETUGAS_COL] || '';
  data.rwDiperbarui = existingRow[LAPOR_RW_DIPERBARUI_COL] || '';
  data.rwKunci = existingRow[LAPOR_RW_KUNCI_COL] || '';
}

// ===== Pengajuan Surat (intake publik) =====================================

// Aturan bisnis Pengajuan_Surat untuk jalur admin (add/update): status "Selesai"
// dan No. Surat hanya boleh diisi setelah RW menyetujui (atau surat lama yang
// ditandai "Tidak Perlu"). Mengembalikan pesan error atau null bila valid.
function suratSaveError(sheetName, data, rwStatus) {
  if (sheetName !== 'Pengajuan_Surat') return null;
  var status = String(data.status === undefined || data.status === null || data.status === '' ? 'Pending' : data.status);
  var noSurat = cleanStr(data.noSurat, 100);
  var rw = normalizeSuratRwStatus(rwStatus === undefined ? data.rwStatus : rwStatus, 'Menunggu');
  if (rw !== 'Disetujui' && rw !== 'Tidak Perlu') {
    if (noSurat) {
      return 'No. Surat hanya dapat diisi setelah RW menyetujui pengajuan.';
    }
    if (status === 'Selesai') {
      return 'Status Selesai hanya dapat diatur setelah RW menyetujui pengajuan.';
    }
  }
  if (status === 'Selesai' && !noSurat) {
    return 'No. Surat resmi wajib diisi sebelum menandai status Selesai.';
  }
  return null;
}


// Batas ringan anti-abuse: maksimum per-NIK & global per jam.
var SURAT_RATE_WINDOW_MS = 60 * 60 * 1000;
var SURAT_RATE_MAX_PER_NIK = 5;
var SURAT_RATE_MAX_GLOBAL = 60;

// Rapikan string: paksa ke String, buang spasi berlebih, batasi panjang.
function cleanStr(value, maxLen) {
  var s = (value === undefined || value === null) ? '' : String(value);
  s = s.replace(/\s+/g, ' ').trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function suratError(code, message) {
  return { "result": "error", "code": code, "version": CODE_VERSION, "message": message };
}

// Terima ref dari warga hanya bila formatnya aman, agar tidak merusak kolom ID.
// Bentuk kanonik No. Pengajuan: tanpa spasi, huruf besar, hanya A-Z/0-9/-.
// Dipakai saat menyimpan maupun mencari agar ref lama/ketikan warga tetap cocok.
function normalizeSuratRef(value) {
  return cleanStr(value, 60).replace(/[\s\u2010-\u2015\u2212]+/g, '').toUpperCase();
}

function sanitizeSuratRef(value) {
  var s = normalizeSuratRef(value);
  if (!s) return null;
  return /^[A-Z0-9-]{6,40}$/.test(s) ? s : null;
}

function randomCode4() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var out = '';
  for (var i = 0; i < 4; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

// Nomor pengajuan surat sekaligus ID baris Pengajuan_Surat: SRT-<yymmdd>-<4 karakter>.
// Dipakai untuk SEMUA jalur pencatatan surat (publik & admin) agar format konsisten.
function makeSuratId() {
  return 'SRT-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + randomCode4();
}

// Rate limit sederhana berbasis Script Property (tanpa IP, jadi per-NIK + global).
function checkAndRecordSuratRate(nik) {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var data;
  try {
    var raw = props.getProperty('SURAT_RATE');
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  if (!data || typeof data !== 'object') data = {};

  function prune(arr) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      if (now - arr[i] < SURAT_RATE_WINDOW_MS) out.push(arr[i]);
    }
    return out;
  }

  var global = prune(data._global);
  if (global.length >= SURAT_RATE_MAX_GLOBAL) return false;

  var key = 'nik:' + nik;
  var list = prune(data[key]);
  if (list.length >= SURAT_RATE_MAX_PER_NIK) return false;

  list.push(now);
  global.push(now);
  data[key] = list;
  data._global = global;
  props.setProperty('SURAT_RATE', JSON.stringify(data));
  return true;
}

// Kirim email notifikasi ke admin. TIDAK pernah menggagalkan penyimpanan.
function notifyAdminNewSurat(r) {
  try {
    var to = getAdminEmail();
    if (!to) return;
    var ts = Utilities.formatDate(new Date(), TZ, 'dd-MM-yyyy HH:mm');
    var subject = getNotifSubjectPrefix() + ' Pengajuan Surat Baru: ' + r.jenisSurat + ' - ' + r.nama;
    var lines = [
      'Pengajuan surat baru masuk melalui Portal Publik.',
      '',
      'Waktu       : ' + ts,
      'Nama        : ' + r.nama,
      'NIK         : ' + r.nik,
      'No. HP/WA   : ' + r.noHp,
      'Alamat      : ' + r.alamat,
      'Jenis Surat : ' + r.jenisSurat,
      'Keperluan   : ' + r.keperluan,
      '',
      'Buka panel "Pengajuan Surat" di dashboard admin untuk memproses.'
    ];
    MailApp.sendEmail(buildNotifMailOptions(to, subject, lines.join('\n')));
  } catch (err) {
    // sengaja diabaikan: kegagalan email tidak boleh membatalkan pengajuan
    console.log('notifyAdminNewSurat gagal: ' + err);
  }
}

// Aksi admin (token): simpan alamat email admin ke Script Property ADMIN_EMAIL.
function handleSetAdminEmail(data) {
  var email = (data && data.email != null) ? String(data.email).trim() : '';
  if (!email) {
    return { "result": "error", "code": "invalid_email", "message": "Alamat email admin tidak boleh kosong." };
  }
  if (!isValidEmail(email)) {
    return { "result": "error", "code": "invalid_email", "message": "Format email tidak valid: " + email };
  }
  PropertiesService.getScriptProperties().setProperty('ADMIN_EMAIL', email);
  return { "result": "success", "adminEmail": email, "message": "Email admin disimpan: " + email + "." };
}

// Aksi admin (token): kirim email uji ke ADMIN_EMAIL untuk memverifikasi
// konfigurasi notifikasi. Bila params.email diisi, alamat itu yang dipakai
// sebagai penerima (sekaligus disimpan sebagai ADMIN_EMAIL). Mengembalikan
// pesan error yang jelas bila belum diatur.
function handleSendTestEmail(params) {
  var props = PropertiesService.getScriptProperties();
  var override = (params && params.email != null) ? String(params.email).trim() : '';
  var to = override || props.getProperty('ADMIN_EMAIL');
  if (!to) {
    return {
      "result": "error",
      "code": "no_admin_email",
      "message": "Email admin belum diatur. Isi kolom Admin Email (ADMIN_EMAIL) di panel Pengaturan, atau tambahkan Script Property ADMIN_EMAIL, lalu coba lagi."
    };
  }
  if (!isValidEmail(to)) {
    return { "result": "error", "code": "invalid_email", "message": "Format email tidak valid: " + to };
  }
  if (override) props.setProperty('ADMIN_EMAIL', to);
  try {
    var ts = Utilities.formatDate(new Date(), TZ, 'dd-MM-yyyy HH:mm');
    MailApp.sendEmail(buildNotifMailOptions(
      to,
      getNotifSubjectPrefix() + ' Tes Notifikasi Email Pengajuan Surat',
      'Ini email uji dari dashboard RT.\n\nBila Anda menerima email ini, notifikasi pengajuan surat sudah aktif.\nWaktu: ' + ts
    ));
    return { "result": "success", "to": to, "message": 'Email uji terkirim ke ' + to + '.' };
  } catch (err) {
    var detail = String(err);
    if (/permission to call MailApp|script\.send_mail|authorization is required|not have permission/i.test(detail)) {
      return {
        "result": "error",
        "code": "mail_scope_denied",
        "message": 'Izin kirim email belum diberikan ke skrip. Buka editor Apps Script, pilih fungsi authorizeMail lalu klik Run > Review permissions > Allow, kemudian deploy ulang sebagai New version. Detail: ' + detail
      };
    }
    return { "result": "error", "code": "email_failed", "message": 'Gagal mengirim email: ' + detail };
  }
}

// Jalankan SEKALI dari editor Apps Script (pilih fungsi ini di dropdown lalu
// klik Run) untuk memicu dialog izin scope "script.send_mail" pada akun pemilik.
// Diperlukan sebelum web app dapat mengirim email.
function authorizeMail() {
  var quota = MailApp.getRemainingDailyQuota();
  Logger.log('Izin email OK. Sisa kuota email hari ini: ' + quota);
}

// Jalankan SEKALI dari editor Apps Script (pilih fungsi ini di dropdown lalu
// klik Run) untuk memicu dialog izin scope Google Drive pada akun pemilik.
// Diperlukan agar foto bukti Lapor & Aspirasi dapat disimpan ke Drive.
// Mengembalikan folder "Lapor" (dibuat bila belum ada) sekaligus memicu izin.
function authorizeDrive() {
  var folder = getLaporFolder();
  if (folder) {
    Logger.log('Izin Drive OK. Folder "Lapor": ' + folder.getName() + ' (' + folder.getId() + ')');
  } else {
    Logger.log('Izin Drive diberikan, tetapi folder "Lapor" belum dapat dibuat. Periksa akses Drive.');
  }
  return folder ? folder.getId() : '';
}

// Format nilai Timestamp sheet menjadi "dd-mm-yyyy HH:mm" untuk respons publik.
// Java SimpleDateFormat: 'MM' = bulan (bukan 'mm' yang berarti menit).
function formatTimestampCell(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd-MM-yyyy HH:mm');
  return (v === undefined || v === null) ? '' : String(v);
}

// Rate limit khusus pencarian status surat (anti-enumerasi).
var SURAT_CHECK_MAX_PER_KEY = 30;
var SURAT_CHECK_MAX_GLOBAL = 300;

function checkAndRecordSuratCheckRate(key) {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var data;
  try {
    var raw = props.getProperty('SURAT_CHECK_RATE');
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  if (!data || typeof data !== 'object') data = {};

  function prune(arr) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      if (now - arr[i] < SURAT_RATE_WINDOW_MS) out.push(arr[i]);
    }
    return out;
  }

  var global = prune(data._global);
  if (global.length >= SURAT_CHECK_MAX_GLOBAL) return false;

  var k = 'key:' + key;
  var list = prune(data[k]);
  if (list.length >= SURAT_CHECK_MAX_PER_KEY) return false;

  list.push(now);
  global.push(now);
  data[k] = list;
  data._global = global;
  props.setProperty('SURAT_CHECK_RATE', JSON.stringify(data));
  return true;
}

// Handler aksi publik `checkSurat`: warga cek status dengan NIK + No. HP,
// atau dengan No. Pengajuan (ref) saja. Hanya field non-sensitif yang dikembalikan.
// Indeks kolom Pengajuan_Surat (termasuk kolom A Timestamp): 11 = Diarsipkan.
// 10 = Tanggal Selesai (dipakai menghitung durasi berhenti saat status Selesai).
var PENGAJUAN_SURAT_COL_ARSIP = 11;
// Normalisasi nomor HP Indonesia menjadi format internasional "62..." agar
// variasi penulisan ("0812...", "62812...", "+62 812...", "812...") saling cocok.
function normalizeSuratHp(value) {
  var d = String(value === undefined || value === null ? '' : value).replace(/\D/g, '');
  if (!d) return '';
  if (d.charAt(0) === '0') return '62' + d.substring(1);
  if (d.charAt(0) === '8') return '62' + d;
  return d;
}

function handleCheckSurat(params) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isSuratEnabled()) {
    return suratError('surat_disabled', 'Fitur Layanan Surat sedang dinonaktifkan oleh admin.');
  }

  // Mode 1: No. Pengajuan (ref) saja. Ref berfungsi sebagai kunci akses.
  var ref = normalizeSuratRef(params.ref);
  var byRef = !!ref;
  var nik = '';
  var hpNorm = '';

  if (byRef) {
    if (!/^[A-Z0-9-]{6,40}$/.test(ref)) {
      return suratError('invalid', 'Masukkan No. Pengajuan yang valid.');
    }
    if (!checkAndRecordSuratCheckRate('ref:' + ref)) {
      return suratError('rate_limited', 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.');
    }
  } else {
    // Mode 2: NIK + No. HP (keduanya harus cocok).
    nik = cleanStr(params.nik, 40).replace(/\D/g, '');
    var hpRaw = (params.hp !== undefined && params.hp !== null) ? params.hp : params.noHp;
    var hp = cleanStr(hpRaw, 30).replace(/\D/g, '');

    if (!/^\d{16}$/.test(nik) || hp.length < 9) {
      return suratError('invalid', 'Masukkan NIK (16 digit) dan No. HP/WhatsApp yang valid.');
    }

    // Normalisasi nomor HP agar "0812...", "62812...", "+62 812...", dsb. saling cocok.
    hpNorm = normalizeSuratHp(hp);

    if (!checkAndRecordSuratCheckRate(nik + '|' + hpNorm)) {
      return suratError('rate_limited', 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.');
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pengajuan_Surat');
  var results = [];
  var archivedCount = 0; // pengajuan yang cocok tapi sudah diarsipkan (disembunyikan)

  if (sheet) {
    ensureSpreadsheetFormat(ss, sheet, 'Pengajuan_Surat');
    var rows = ensureIds(sheet, 'Pengajuan_Surat');
    var idCol = EXPECTED_FIELDS['Pengajuan_Surat'];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rawRowRef = row[idCol] !== undefined ? row[idCol] : row[row.length - 1];
      var rowRef = normalizeSuratRef(rawRowRef);
      var matches = byRef
        ? (rowRef === ref)
        : (String(row[2] === undefined || row[2] === null ? '' : row[2]).replace(/\D/g, '') === nik &&
           normalizeSuratHp(String(row[3] === undefined || row[3] === null ? '' : row[3])) === hpNorm);
      if (matches) {
        // Pengajuan yang sudah diarsipkan tidak lagi dapat diambil publik;
        // cukup dihitung agar frontend bisa memberi tahu bahwa sudah diarsipkan.
        if (isArsip(row[PENGAJUAN_SURAT_COL_ARSIP])) { archivedCount++; continue; }
        results.push({
          "ref": rowRef,
          "tanggal": formatTimestampCell(row[0]),
          "jenisSurat": cleanStr(row[5], 120),
          "status": cleanStr(row[7], 20) || 'Pending',
          "noSurat": cleanStr(row[8], 100),
          "catatan": cleanStr(row[9], 500),
          "revisi": intAtLeast(row[SURAT_RW_REVISI_COL], 0)
        });
      }
    }
  }

  results.reverse(); // terbaru lebih dahulu

  return { "result": "success", "version": CODE_VERSION, "count": results.length, "archived": archivedCount, "data": results };
}

// ================= PERINGATAN PENGAJUAN SERUPA =================
// Sebelum mengirim, form publik memberi tahu bila NIK + No. HP yang sama sudah
// pernah mengajukan surat dengan jenis yang sama. Hanya menampilkan tanggal &
// keperluan milik pengajuan itu sendiri (diautentikasi NIK + No. HP), dan
// pengajuan yang sudah diarsipkan tidak ikut diperingatkan. Tidak memblokir.
function handleCheckSuratDuplicate(params) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isSuratEnabled()) {
    return suratError('surat_disabled', 'Fitur Layanan Surat sedang dinonaktifkan oleh admin.');
  }

  var nik = cleanStr(params.nik, 40).replace(/\D/g, '');
  var hpRaw = (params.hp !== undefined && params.hp !== null) ? params.hp : params.noHp;
  var hp = cleanStr(hpRaw, 30).replace(/\D/g, '');
  var jenisSurat = cleanStr(params.jenisSurat, 120);

  if (!/^\d{16}$/.test(nik) || hp.length < 9) {
    return suratError('invalid', 'Masukkan NIK (16 digit) dan No. HP/WhatsApp yang valid.');
  }
  if (!jenisSurat) {
    return suratError('invalid', 'Pilih jenis surat terlebih dahulu.');
  }

  var hpNorm = normalizeSuratHp(hp);
  if (!checkAndRecordSuratCheckRate('dup:' + nik + '|' + hpNorm)) {
    return suratError('rate_limited', 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pengajuan_Surat');
  var results = [];
  var total = 0;
  var jenisKey = jenisSurat.toLowerCase();

  if (sheet) {
    ensureSpreadsheetFormat(ss, sheet, 'Pengajuan_Surat');
    var rows = ensureIds(sheet, 'Pengajuan_Surat');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (isArsip(row[PENGAJUAN_SURAT_COL_ARSIP])) continue;
      var rNik = String(row[2] === undefined || row[2] === null ? '' : row[2]).replace(/\D/g, '');
      if (rNik !== nik) continue;
      if (normalizeSuratHp(String(row[3] === undefined || row[3] === null ? '' : row[3])) !== hpNorm) continue;
      if (cleanStr(row[5], 120).toLowerCase() !== jenisKey) continue;
      total++;
      results.push({
        "tanggal": formatTimestampCell(row[0]),
        "keperluan": cleanStr(row[6], 800)
      });
    }
  }

  results.reverse();
  results = results.slice(0, 5);

  return { "result": "success", "version": CODE_VERSION, "count": total, "data": results };
}

// ================= LOOKUP WARGA (bantu isi form surat) =================
// Cari SATU warga berdasarkan NIK (16 digit) persis, untuk mengisi otomatis
// Nama, No. HP, & Alamat pada form pengajuan surat portal publik. Bukan untuk
// membaca seluruh data warga: hanya 3 field itu yang dikembalikan. Tetap
// ter-gate oleh status portal + rate-limited untuk mencegah enumerasi NIK.
// Indeks kolom Data_Warga (termasuk kolom A Timestamp):
//   2 = Nama Lengkap, 5 = NIK, 10 = No HP, 12 = Alamat/No Rumah, 13 = Diarsipkan.
var WARGA_COL_NAMA = 2;
var WARGA_COL_NIK = 5;
var WARGA_COL_HP = 10;
var WARGA_COL_ALAMAT = 12;
var WARGA_COL_ARSIP = 13;

var WARGA_LOOKUP_MAX_PER_KEY = 20;
var WARGA_LOOKUP_MAX_GLOBAL = 200;

function checkAndRecordWargaLookupRate(key) {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var data;
  try {
    var raw = props.getProperty('WARGA_LOOKUP_RATE');
    data = raw ? JSON.parse(raw) : {};
  } catch (e) {
    data = {};
  }
  if (!data || typeof data !== 'object') data = {};

  function prune(arr) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      if (now - arr[i] < SURAT_RATE_WINDOW_MS) out.push(arr[i]);
    }
    return out;
  }

  var global = prune(data._global);
  if (global.length >= WARGA_LOOKUP_MAX_GLOBAL) return false;

  var k = 'key:' + key;
  var list = prune(data[k]);
  if (list.length >= WARGA_LOOKUP_MAX_PER_KEY) return false;

  list.push(now);
  global.push(now);
  data[k] = list;
  data._global = global;
  props.setProperty('WARGA_LOOKUP_RATE', JSON.stringify(data));
  return true;
}

// Handler aksi publik `lookupWarga`: cocokkan NIK persis.
// Ketemu  -> { result:"success", found:true,  nama, noHp, alamat }
// Tidak    -> { result:"success", found:false }
// Warga TETAP boleh mengisi form manual walau NIK tidak terdaftar.
function handleLookupWarga(params) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isSuratEnabled()) {
    return suratError('surat_disabled', 'Fitur Layanan Surat sedang dinonaktifkan oleh admin.');
  }

  var nik = cleanStr(params.nik, 40).replace(/\D/g, '');
  if (!/^\d{16}$/.test(nik)) {
    // Bukan NIK valid -> anggap "tidak ditemukan" (bukan error), agar frontend
    // cukup menampilkan info tanpa memblokir pengisian manual.
    return { "result": "success", "version": CODE_VERSION, "found": false, "code": "invalid_nik" };
  }

  if (!checkAndRecordWargaLookupRate(nik)) {
    return suratError('rate_limited', 'Terlalu banyak pencarian. Silakan coba lagi beberapa saat lagi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Data_Warga');
  var found = null;

  if (sheet) {
    ensureSpreadsheetFormat(ss, sheet, 'Data_Warga');
    var rows = ensureIds(sheet, 'Data_Warga');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (isArsip(row[WARGA_COL_ARSIP])) continue; // lewati warga yang diarsipkan
      var rNik = String(row[WARGA_COL_NIK] === undefined || row[WARGA_COL_NIK] === null ? '' : row[WARGA_COL_NIK]).replace(/\D/g, '');
      if (rNik === nik) {
        found = {
          "nama": cleanStr(row[WARGA_COL_NAMA], 100),
          "noHp": cleanStr(row[WARGA_COL_HP], 30),
          "alamat": cleanStr(row[WARGA_COL_ALAMAT], 200)
        };
        break;
      }
    }
  }

  if (!found) {
    return { "result": "success", "version": CODE_VERSION, "found": false };
  }

  return {
    "result": "success",
    "version": CODE_VERSION,
    "found": true,
    "nama": found.nama,
    "noHp": found.noHp,
    "alamat": found.alamat
  };
}

// Handler aksi publik `submitSurat`: validasi, rate limit, simpan, notifikasi.
function handleSubmitSurat(data) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isSuratEnabled()) {
    return suratError('surat_disabled', 'Fitur Layanan Surat sedang dinonaktifkan oleh admin.');
  }

  // Honeypot: field tersembunyi yang hanya diisi bot. Pura-pura sukses.
  if (cleanStr(data.website, 100)) {
    return { "result": "success", "id": 'ok', "message": 'Pengajuan terkirim.' };
  }

  var nama = cleanStr(data.nama, 100);
  var nik = cleanStr(data.nik, 40).replace(/\D/g, '');
  var noHpRaw = cleanStr(data.noHp, 30);
  var noHp = noHpRaw.replace(/[^\d+]/g, '');
  var alamat = cleanStr(data.alamat, 200);
  var jenisSurat = cleanStr(data.jenisSurat, 120);
  var keperluan = cleanStr(data.keperluan, 800);

  if (nama.length < 3) return suratError('invalid', 'Nama lengkap wajib diisi (minimal 3 karakter).');
  if (!/^\d{16}$/.test(nik)) return suratError('invalid', 'NIK harus 16 digit angka.');
  var hpDigits = noHp.replace(/\D/g, '');
  if (hpDigits.length < 9 || hpDigits.length > 15) {
    return suratError('invalid', 'Nomor HP/WhatsApp tidak valid.');
  }
  if (!alamat) return suratError('invalid', 'Alamat / No. Rumah wajib diisi.');
  if (!jenisSurat) return suratError('invalid', 'Jenis Surat wajib dipilih.');
  if (keperluan.length < 3) return suratError('invalid', 'Keperluan / alasan pengajuan wajib diisi (minimal 3 karakter).');

  if (!checkAndRecordSuratRate(nik)) {
    return suratError('rate_limited', 'Terlalu banyak pengajuan. Silakan coba lagi beberapa saat lagi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var sheet = getOrCreateSheet(ss, 'Pengajuan_Surat');
  if (!sheet) return suratError('server', 'Sheet Pengajuan_Surat tidak tersedia.');

  ensureSpreadsheetFormat(ss, sheet, 'Pengajuan_Surat');

  // ID: pakai ref warga bila aman & belum terpakai; jika tidak, buat otomatis (SRT-...).
  var id = sanitizeSuratRef(data.ref);
  if (!id || findRowById(sheet, 'Pengajuan_Surat', id) !== -1) {
    var tries = 0;
    do {
      id = makeSuratId();
      tries++;
    } while (findRowById(sheet, 'Pengajuan_Surat', id) !== -1 && tries < 6);
  }

  var rowData = buildRowData('Pengajuan_Surat', {
    nama: nama, nik: nik, noHp: noHp, alamat: alamat,
    jenisSurat: jenisSurat, keperluan: keperluan,
    status: 'Pending', noSurat: '', catatan: '',
    rwStatus: 'Menunggu', rwRevisi: 0, rwVersi: 1
  }, new Date(), id);
  sheet.appendRow(rowData);
  sheet.getRange(sheet.getLastRow(), 1).setNumberFormat(TS_FORMAT);

  notifyAdminNewSurat({
    nama: nama, nik: nik, noHp: noHp, alamat: alamat,
    jenisSurat: jenisSurat, keperluan: keperluan
  });

  return { "result": "success", "id": id, "message": 'Pengajuan surat berhasil dikirim.' };
}

// ================= LAPOR & ASPIRASI (intake publik) =================
// Indeks kolom Lapor_Aspirasi (termasuk kolom A Timestamp):
var LAPOR_COL_NOMOR = 1;   // No. Pengaduan
var LAPOR_COL_HP = 3;      // No. HP / WhatsApp
var LAPOR_COL_JENIS = 5;   // Jenis Pengaduan
var LAPOR_COL_ARSIP = 16;  // Diarsipkan

var LAPOR_RATE_MAX_PER_HP = 5;
var LAPOR_RATE_MAX_GLOBAL = 60;
var LAPOR_CHECK_MAX_PER_KEY = 30;
var LAPOR_CHECK_MAX_GLOBAL = 300;

// Format nilai kolom tanggal (yyyy-MM-dd) agar konsisten di respons publik.
function formatDateCell(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return (v === undefined || v === null) ? '' : String(v);
}

// Nomor Pengaduan berurutan per tahun: ADU/<tahun>-NNN (mis. ADU/2026-001).
// Dipakai sebagai referensi yang dipegang warga (bukan kolom ID internal).
function makeNomorPengaduan(sheet) {
  var year = Utilities.formatDate(new Date(), TZ, 'yyyy');
  var prefix = 'ADU/' + year + '-';
  var max = 0;
  if (sheet) {
    var last = sheet.getLastRow();
    if (last >= 2) {
      var vals = sheet.getRange(2, LAPOR_COL_NOMOR + 1, last - 1, 1).getValues();
      for (var i = 0; i < vals.length; i++) {
        var s = String(vals[i][0] === null || vals[i][0] === undefined ? '' : vals[i][0]).trim().toUpperCase();
        if (s.indexOf(prefix) === 0) {
          var n = parseInt(s.substring(prefix.length), 10);
          if (!isNaN(n) && n > max) max = n;
        }
      }
    }
  }
  return prefix + ('000' + (max + 1)).slice(-3);
}

// Rate limit sederhana (Script Properties) untuk submit laporan (per-HP + global).
function checkAndRecordLaporRate(key) {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var data;
  try {
    var raw = props.getProperty('LAPOR_RATE');
    data = raw ? JSON.parse(raw) : {};
  } catch (e) { data = {}; }
  if (!data || typeof data !== 'object') data = {};

  function prune(arr) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      if (now - arr[i] < SURAT_RATE_WINDOW_MS) out.push(arr[i]);
    }
    return out;
  }
  var global = prune(data._global);
  if (global.length >= LAPOR_RATE_MAX_GLOBAL) return false;
  var k = 'hp:' + key;
  var list = prune(data[k]);
  if (list.length >= LAPOR_RATE_MAX_PER_HP) return false;
  list.push(now);
  global.push(now);
  data[k] = list;
  data._global = global;
  props.setProperty('LAPOR_RATE', JSON.stringify(data));
  return true;
}

// Rate limit untuk cek status pengaduan (per-nomor + global), anti-enumerasi.
function checkAndRecordLaporCheckRate(key) {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var data;
  try {
    var raw = props.getProperty('LAPOR_CHECK_RATE');
    data = raw ? JSON.parse(raw) : {};
  } catch (e) { data = {}; }
  if (!data || typeof data !== 'object') data = {};

  function prune(arr) {
    var out = [];
    for (var i = 0; i < (arr || []).length; i++) {
      if (now - arr[i] < SURAT_RATE_WINDOW_MS) out.push(arr[i]);
    }
    return out;
  }
  var global = prune(data._global);
  if (global.length >= LAPOR_CHECK_MAX_GLOBAL) return false;
  var k = 'key:' + key;
  var list = prune(data[k]);
  if (list.length >= LAPOR_CHECK_MAX_PER_KEY) return false;
  list.push(now);
  global.push(now);
  data[k] = list;
  data._global = global;
  props.setProperty('LAPOR_CHECK_RATE', JSON.stringify(data));
  return true;
}

// Folder Google Drive tujuan foto bukti: Script Property "LAPOR_FOLDER_ID";
// bila kosong, cari folder bernama "Lapor"; bila belum ada, BUAT otomatis lalu
// bagikan ke ADMIN_EMAIL (bila diatur) agar mudah dipantau dari akun admin.
function getLaporFolder() {
  var id = PropertiesService.getScriptProperties().getProperty('LAPOR_FOLDER_ID');
  id = (id == null) ? '' : String(id).trim();
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* jatuh ke pencarian nama */ }
  }
  try {
    var it = DriveApp.getFoldersByName('Lapor');
    if (it.hasNext()) return it.next();
  } catch (e2) { /* abaikan */ }
  try {
    var folder = DriveApp.createFolder('Lapor');
    try {
      var admin = getAdminEmail();
      if (admin) {
        admin.split(',').forEach(function (em) {
          em = String(em || '').trim();
          if (em) { try { folder.addViewer(em); } catch (eShare) { /* abaikan */ } }
        });
      }
    } catch (e3) { /* berbagi gagal: folder tetap milik pemilik skrip */ }
    return folder;
  } catch (e4) {
    return null;
  }
}

// Simpan foto bukti (base64) ke folder Drive, kembalikan URL tampilan publik
// atau '' bila gagal (kegagalan TIDAK membatalkan pengiriman laporan).
function saveLaporFoto(nama, mime, base64) {
  if (!base64) return '';
  if (base64.length > 6 * 1024 * 1024) return ''; // batas aman ~4.5MB biner
  var folder = getLaporFolder();
  if (!folder) return '';
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, (mime || 'image/jpeg'), cleanStr(nama, 80) || ('lapor-' + Date.now() + '.jpg'));
  var file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    // Beberapa kebijakan Workspace melarang tautan publik; tetap simpan file-nya.
  }
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

// Kirim email notifikasi ke admin saat ada laporan/aspirasi baru.
function notifyAdminNewLapor(r) {
  try {
    var to = getAdminEmail();
    if (!to) return;
    var ts = Utilities.formatDate(new Date(), TZ, 'dd-MM-yyyy HH:mm');
    var subject = getNotifSubjectPrefix() + ' Laporan/Aspirasi Baru: ' + r.jenisPengaduan + ' - ' + r.nama;
    var fotoUrl = (r.foto && typeof r.foto === 'string') ? String(r.foto).trim() : '';
    var lines = [
      'Laporan / aspirasi baru masuk melalui Portal Publik.',
      '',
      'Waktu            : ' + ts,
      'No. Pengaduan    : ' + r.noPengaduan,
      'Nama Warga       : ' + r.nama,
      'No. HP/WA        : ' + r.noHp,
      'Alamat           : ' + r.alamat,
      'Jenis Pengaduan  : ' + r.jenisPengaduan,
      'Judul            : ' + r.judul,
      'Lokasi Kejadian  : ' + (r.lokasi || '-'),
      'Tanggal Kejadian : ' + (r.tanggalKejadian || '-'),
      'Detail           : ' + r.detail
    ];
    var fotoLine = '';
    if (fotoUrl) {
      fotoLine = 'Bukti pendukung  : ' + fotoUrl;
      lines.push(fotoLine);
    }
    lines.push('');
    lines.push('Buka panel "Lapor & Aspirasi" di dashboard admin untuk menindaklanjuti.');
    var htmlBody = fotoUrl ? buildNotifHtmlLines(lines, fotoLine, fotoUrl, 'View foto') : '';
    MailApp.sendEmail(buildNotifMailOptions(to, subject, lines.join('\n'), htmlBody));
  } catch (err) {
    console.log('notifyAdminNewLapor gagal: ' + err);
  }
}

// Cari warga (aktif) berdasarkan No. HP/WhatsApp ternormalisasi (62...).
// Mengembalikan { nama, alamat, noHp } atau null.
function findWargaByHpNorm(hpNorm) {
  if (!hpNorm) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Data_Warga');
  if (!sheet) return null;
  ensureSpreadsheetFormat(ss, sheet, 'Data_Warga');
  var rows = ensureIds(sheet, 'Data_Warga');
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (isArsip(row[WARGA_COL_ARSIP])) continue;
    var hp = String(row[WARGA_COL_HP] === undefined || row[WARGA_COL_HP] === null ? '' : row[WARGA_COL_HP]);
    if (normalizeSuratHp(hp) === hpNorm) {
      return {
        nama: cleanStr(row[WARGA_COL_NAMA], 100),
        alamat: cleanStr(row[WARGA_COL_ALAMAT], 200),
        noHp: cleanStr(row[WARGA_COL_HP], 30)
      };
    }
  }
  return null;
}

// Handler aksi publik `lookupWargaHp`: cocokkan No. HP/WhatsApp persis (dinormalisasi).
function handleLookupWargaHp(params) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isLaporEnabled()) {
    return suratError('lapor_disabled', 'Fitur Lapor & Aspirasi sedang dinonaktifkan oleh admin.');
  }
  var hpRaw = cleanStr(params.hp, 30);
  var hpDigits = hpRaw.replace(/\D/g, '');
  if (hpDigits.length < 9 || hpDigits.length > 15) {
    return { "result": "success", "version": CODE_VERSION, "found": false, "code": "invalid_hp" };
  }
  var hpNorm = normalizeSuratHp(hpDigits);

  if (!checkAndRecordWargaLookupRate('hp:' + hpNorm)) {
    return suratError('rate_limited', 'Terlalu banyak pencarian. Silakan coba lagi beberapa saat lagi.');
  }

  var warga = findWargaByHpNorm(hpNorm);
  if (!warga) {
    return { "result": "success", "version": CODE_VERSION, "found": false };
  }
  return {
    "result": "success",
    "version": CODE_VERSION,
    "found": true,
    "nama": warga.nama,
    "noHp": warga.noHp,
    "alamat": warga.alamat
  };
}

// Tanggal (yyyy-MM-dd) dari kolom Timestamp Lapor_Aspirasi. Baris baru berupa
// Date; data lama bisa berupa string ISO. Dipakai untuk batas "hari yang sama".
function laporRowDay(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TZ, 'yyyy-MM-dd');
  var m = String(value === undefined || value === null ? '' : value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

// Handler aksi publik `checkLaporDuplicate`: memberi tahu bila No. HP yang sama
// sudah mengirim pengaduan dengan jenis yang sama pada hari ini. Hanya
// mengembalikan jumlah (tanpa judul/detail) dan TIDAK memblokir pengiriman.
function handleCheckLaporDuplicate(params) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isLaporEnabled()) {
    return suratError('lapor_disabled', 'Fitur Lapor & Aspirasi sedang dinonaktifkan oleh admin.');
  }

  var hpRaw = cleanStr((params.hp !== undefined && params.hp !== null) ? params.hp : params.noHp, 30);
  var hpDigits = hpRaw.replace(/\D/g, '');
  var jenis = cleanStr(params.jenisPengaduan, 120);
  if (hpDigits.length < 9 || hpDigits.length > 15) {
    return suratError('invalid', 'Nomor WhatsApp tidak valid.');
  }
  if (!jenis) return suratError('invalid', 'Pilih jenis pengaduan terlebih dahulu.');

  var hpNorm = normalizeSuratHp(hpDigits);
  var jenisKey = jenis.toLowerCase();
  if (!checkAndRecordLaporCheckRate('dup:' + hpNorm + '|' + jenisKey)) {
    return suratError('rate_limited', 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.');
  }

  var count = 0;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Lapor_Aspirasi');
  if (sheet) {
    ensureSpreadsheetFormat(ss, sheet, 'Lapor_Aspirasi');
    var last = sheet.getLastRow();
    if (last >= 2) {
      var rows = sheet.getRange(2, 1, last - 1, LAPOR_COL_JENIS + 1).getValues();
      var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (laporRowDay(row[0]) !== today) continue;
        if (normalizeSuratHp(String(row[LAPOR_COL_HP] === undefined || row[LAPOR_COL_HP] === null ? '' : row[LAPOR_COL_HP])) !== hpNorm) continue;
        if (cleanStr(row[LAPOR_COL_JENIS], 120).toLowerCase() !== jenisKey) continue;
        count++;
      }
    }
  }
  return { "result": "success", "version": CODE_VERSION, "count": count };
}

// Handler aksi publik `submitLapor`: validasi, rate limit, simpan, notifikasi.
function handleSubmitLapor(data) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isLaporEnabled()) {
    return suratError('lapor_disabled', 'Fitur Lapor & Aspirasi sedang dinonaktifkan oleh admin.');
  }

  // Honeypot: field tersembunyi yang hanya diisi bot. Pura-pura sukses.
  if (cleanStr(data.website, 100)) {
    return { "result": "success", "noPengaduan": 'ok', "message": 'Laporan terkirim.' };
  }

  var noHpRaw = cleanStr(data.noHp, 30);
  var hpDigits = noHpRaw.replace(/\D/g, '');
  if (hpDigits.length < 9 || hpDigits.length > 15) {
    return suratError('invalid', 'Nomor WhatsApp tidak valid.');
  }
  var hpNorm = normalizeSuratHp(hpDigits);

  var jenis = cleanStr(data.jenisPengaduan, 120);
  var judul = cleanStr(data.judul, 150);
  var detail = cleanStr(data.detail, 2000);
  var lokasi = cleanStr(data.lokasi, 200);
  var tanggalKejadian = cleanStr(data.tanggalKejadian, 20);
  var harapan = cleanStr(data.harapan, 1000);
  var setuju = (data.setuju === true || String(data.setuju) === 'true' || String(data.setuju) === '1');

  if (!jenis) return suratError('invalid', 'Jenis pengaduan wajib dipilih.');
  if (judul.length < 3) return suratError('invalid', 'Judul pengaduan wajib diisi (minimal 3 karakter).');
  if (detail.length < 10) return suratError('invalid', 'Detail pengaduan wajib diisi (minimal 10 karakter).');
  if (!setuju) return suratError('invalid', 'Persetujuan penggunaan data wajib dicentang.');
  if (tanggalKejadian && !/^\d{4}-\d{2}-\d{2}$/.test(tanggalKejadian)) tanggalKejadian = '';
  if (tanggalKejadian && tanggalKejadian > Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')) {
    return suratError('invalid', 'Tanggal Kejadian tidak boleh melebihi hari ini. Periksa kembali tanggal.');
  }

  if (!checkAndRecordLaporRate(hpNorm)) {
    return suratError('rate_limited', 'Terlalu banyak laporan. Silakan coba lagi beberapa saat lagi.');
  }

  // Hanya nomor yang terdaftar di Data_Warga yang boleh melapor. Nama & Alamat
  // diambil dari data (server-authoritative), bukan dari input warga.
  var warga = findWargaByHpNorm(hpNorm);
  if (!warga) {
    return suratError('not_registered', 'Nomor WhatsApp belum terdaftar pada Data Warga RT. Hubungi pengurus RT untuk mendaftarkan nomor Anda terlebih dahulu.');
  }

  // Foto bukti (opsional): simpan ke Drive folder "Lapor". Kegagalan diabaikan,
  // namun statusnya dilaporkan ke frontend via fotoSaved agar bisa diberi peringatan.
  var adaFoto = !!(data.foto && typeof data.foto === 'string' && data.foto);
  var fotoUrl = '';
  try {
    if (adaFoto) {
      var m = String(data.foto).match(/^data:([^;]+);base64,([\s\S]+)$/);
      if (m) fotoUrl = saveLaporFoto(data.fotoName, m[1], m[2]);
    }
  } catch (e) { fotoUrl = ''; }
  var fotoSaved = !adaFoto || !!fotoUrl;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureRwSchema(ss);
  var sheet = getOrCreateSheet(ss, 'Lapor_Aspirasi');
  if (!sheet) return suratError('server', 'Sheet Lapor_Aspirasi tidak tersedia.');

  ensureSpreadsheetFormat(ss, sheet, 'Lapor_Aspirasi');

  var lock = LockService.getScriptLock();
  var locked = false;
  try { locked = lock.tryLock(15000); } catch (e) { locked = false; }
  var noPengaduan;
  try {
    noPengaduan = makeNomorPengaduan(sheet);
    var id = 'ADU-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + randomCode4();
    var rowData = buildRowData('Lapor_Aspirasi', {
      noPengaduan: noPengaduan,
      nama: warga.nama, noHp: warga.noHp || noHpRaw, alamat: warga.alamat,
      jenisPengaduan: jenis, judul: judul, detail: detail,
      lokasi: lokasi, tanggalKejadian: tanggalKejadian, foto: fotoUrl, harapan: harapan,
      status: 'Diterima', petugas: '', catatanTindakLanjut: '', tanggalPenyelesaian: '', arsip: 'Tidak',
      rwStatus: 'Tidak Perlu'
    }, new Date(), id);
    sheet.appendRow(rowData);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat(TS_FORMAT);
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e2) { /* abaikan */ } }
  }

  notifyAdminNewLapor({
    noPengaduan: noPengaduan, nama: warga.nama, noHp: warga.noHp || noHpRaw, alamat: warga.alamat,
    jenisPengaduan: jenis, judul: judul, detail: detail, lokasi: lokasi, tanggalKejadian: tanggalKejadian,
    foto: fotoUrl
  });

  return { "result": "success", "noPengaduan": noPengaduan, "fotoSaved": fotoSaved, "message": 'Laporan berhasil dikirim.' };
}

// Handler aksi publik `checkLapor`: cari pengaduan berdasarkan No. Pengaduan.
// Pengaduan yang sudah diarsipkan tidak dikembalikan (hanya dihitung).
function handleCheckLapor(params) {
  if (!isPortalEnabled()) {
    return suratError('portal_disabled', 'Portal publik sedang dinonaktifkan oleh admin.');
  }
  if (!isLaporEnabled()) {
    return suratError('lapor_disabled', 'Fitur Lapor & Aspirasi sedang dinonaktifkan oleh admin.');
  }
  var nomor = cleanStr(params.nomor, 40).toUpperCase();
  if (!nomor) {
    return suratError('invalid', 'Masukkan No. Pengaduan (mis. ADU/2026-001).');
  }

  if (!checkAndRecordLaporCheckRate(nomor)) {
    return suratError('rate_limited', 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Lapor_Aspirasi');
  var results = [];
  var archivedCount = 0;

  if (sheet) {
    ensureSpreadsheetFormat(ss, sheet, 'Lapor_Aspirasi');
    var rows = ensureIds(sheet, 'Lapor_Aspirasi');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rNomor = String(row[LAPOR_COL_NOMOR] === null || row[LAPOR_COL_NOMOR] === undefined ? '' : row[LAPOR_COL_NOMOR]).trim().toUpperCase();
      if (rNomor === nomor) {
        if (isArsip(row[LAPOR_COL_ARSIP])) { archivedCount++; continue; }
        results.push({
          "nomor": rNomor,
          "tanggal": formatTimestampCell(row[0]),
          "jenisPengaduan": cleanStr(row[5], 120),
          "judul": cleanStr(row[6], 150),
          "status": cleanStr(row[12], 20) || 'Diterima',
          "petugas": cleanStr(row[13], 100),
          "catatan": cleanStr(row[14], 1000),
          "tanggalSelesai": formatDateCell(row[15])
        });
      }
    }
  }

  results.reverse(); // terbaru lebih dahulu

  return { "result": "success", "version": CODE_VERSION, "count": results.length, "archived": archivedCount, "data": results };
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
