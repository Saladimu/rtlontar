var CODE_VERSION = "publik-v15-2026-10-11";

// Semua Timestamp disimpan sebagai Date asli, ditampilkan dd-mm-yyyy hh:mm (GMT+7).
// CATATAN: pada Utilities.formatDate (Java) bulan = 'MM' & jam 24 = 'HH'; pada
// number format Google Sheets bulan tetap 'mm' (dibedakan dari menit oleh posisi).
var TZ = "Asia/Jakarta";
var TS_FORMAT = "dd-mm-yyyy hh:mm";

// Jumlah kolom data (termasuk kolom A Timestamp), TIDAK termasuk kolom bantu "ID".
var EXPECTED_FIELDS = {
  "Data_Warga": 13,     // A Timestamp + 12 field (Nomor KK, Status, Jenis Kelamin, Pendidikan, Pekerjaan, dst.)
  "Iuran_Kas": 7,       // A Timestamp + 6 field
  "Pengumuman": 7,      // A Timestamp + 6 field (termasuk Publik)
  "Kegiatan_Warga": 8,  // A Timestamp + 7 field (termasuk Publik)
  "Pengajuan_Surat": 10 // A Timestamp + 9 field (termasuk Status Pengurusan, No. Surat, & Catatan Pengurus)
};

// Header lengkap yang diharapkan (data + kolom bantu ID di paling kanan).
var DESIRED_HEADERS = {
  "Data_Warga": ["Timestamp", "Nomor KK", "Nama Lengkap", "Status", "Jenis Kelamin", "NIK", "Tempat Lahir", "Tanggal Lahir", "Pendidikan", "Pekerjaan", "No HP", "Status Tempat Tinggal", "Alamat/No Rumah", "ID"],
  "Iuran_Kas": ["Timestamp", "Tanggal", "Nama Warga", "No Rumah", "Jenis Transaksi", "Jumlah (Rp)", "Keterangan", "ID"],
  "Pengumuman": ["Timestamp", "Tanggal", "Judul Pengumuman", "Isi Pengumuman", "Kategori", "Penanggung Jawab", "Publik", "ID"],
  "Kegiatan_Warga": ["Timestamp", "Nama Kegiatan", "Tanggal Pelaksanaan", "Waktu", "Lokasi", "Penanggung Jawab", "Keterangan", "Publik", "ID"],
  "Pengajuan_Surat": ["Timestamp", "Nama Lengkap Pemohon", "NIK", "No. HP / WhatsApp", "Alamat / No. Rumah", "Jenis Surat", "Keperluan / Alasan Pengajuan", "Status Pengurusan", "No. Surat", "Catatan Pengurus", "ID"]
};

// Nilai default kolom Publik untuk baris lama saat migrasi.
var PUBLIK_DEFAULT = "Ya";

// 0-based index kolom "Publik" di dalam array baris (sebelum kolom bantu ID).
var PUBLIK_INDEX = {
  "Pengumuman": 6,
  "Kegiatan_Warga": 7
};

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
function buildNotifMailOptions(to, subject, body) {
  var opts = {
    to: to,
    subject: subject,
    body: body,
    name: getNotifSenderName()
  };
  var replyTo = getNotifReplyTo(to);
  if (replyTo) opts.replyTo = replyTo;
  return opts;
}

// ================= KEAMANAN / TOKEN ADMIN =================
// Token admin disimpan di Script Properties: Project Settings > Script Properties,
// key "ADMIN_TOKEN". Semua operasi tulis (add/update/delete) dan baca lengkap
// WAJIB menyertakan token ini. Portal publik memakai action=readPublic (tanpa token)
// yang hanya mengembalikan Pengumuman & Kegiatan ber-Publik "Ya".
function getAdminToken() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN') || '';
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
  } else if (params.action === 'lookupWarga') {
    // Cari profil warga berdasarkan NIK (bantu isi form surat). Tanpa token.
    payload = handleLookupWarga(params);
  } else if (params.action === 'sendTestEmail') {
    // Kirim email uji notifikasi (butuh token admin).
    payload = isAuthorized(params.token) ? handleSendTestEmail() : unauthorized();
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
  if (name === 'Data_Warga' || name === 'Pengajuan_Surat') {
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

function readAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ["Data_Warga", "Iuran_Kas", "Pengumuman", "Kegiatan_Warga", "Pengajuan_Surat"];
  var formats = {
    "Data_Warga": { 7: "yyyy-MM-dd" },
    "Iuran_Kas": { 1: "yyyy-MM-dd" },
    "Pengumuman": { 1: "yyyy-MM-dd" },
    "Kegiatan_Warga": { 2: "yyyy-MM-dd", 3: "HH:mm" },
    "Pengajuan_Surat": { 0: "yyyy-MM-dd HH:mm" }
  };
  var data = {};

  names.forEach(function (name) {
    var sheet = getOrCreateSheet(ss, name);
    if (!sheet) {
      data[name] = [];
      return;
    }

    ensureSpreadsheetFormat(ss, sheet, name);
    var rows = ensureIds(sheet, name);
    var fmt = formats[name] || {};

    data[name] = rows.map(function (row) {
      return row.map(function (cell, col) {
        if (cell instanceof Date && fmt[col]) {
          return Utilities.formatDate(cell, TZ, fmt[col]);
        }
        return cell;
      });
    });
  });

  return { "result": "success", "version": CODE_VERSION, "portalEnabled": isPortalEnabled(), "data": data };
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

  var full = readAllSheets();
  var data = { "Pengumuman": [], "Kegiatan_Warga": [] };

  ["Pengumuman", "Kegiatan_Warga"].forEach(function (name) {
    var rows = (full.data && full.data[name]) || [];
    var idx = PUBLIK_INDEX[name];
    data[name] = rows.filter(function (row) {
      return isPublik(row[idx]);
    });
  });

  return { "result": "success", "version": CODE_VERSION, "portalEnabled": true, "data": data };
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

    // Aksi khusus: mengubah status ON/OFF portal publik (butuh token admin).
    if (data.action === 'setPortalStatus') {
      if (!isAuthorized(data.token)) {
        return respond(unauthorized());
      }
      var enabled = setPortalEnabled(data.enabled === true || String(data.enabled) === 'true');
      return respond({ "result": "success", "portalEnabled": enabled });
    }

    // Aksi publik: kirim pengajuan surat (TANPA token, hanya menambah baris baru).
    if (data.action === 'submitSurat') {
      return respond(handleSubmitSurat(data));
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
    var sheet = getOrCreateSheet(ss, sheetName);

    if (!sheet) {
      return respond({ "result": "error", "message": "Sheet tidak ditemukan" });
    }

    ensureSpreadsheetFormat(ss, sheet, sheetName);

    // Aturan bisnis khusus Pengajuan_Surat: status "Selesai" wajib punya No. Surat.
    var suratErrMsg = suratSaveError(sheetName, data);
    if (suratErrMsg) {
      return respond({ "result": "error", "code": "invalid", "message": suratErrMsg });
    }

    // UPDATE: perbarui baris yang sudah ada berdasarkan ID stabil (JANGAN tambah baris baru).
    if (data.action === "update") {
      var updRow = findRowById(sheet, sheetName, data.id);
      if (updRow === -1) {
        return respond({ "result": "error", "message": "ID tidak ditemukan: " + data.id });
      }
      var existingTs = sheet.getRange(updRow, 1).getValue(); // pertahankan Timestamp asli
      var existingId = sheet.getRange(updRow, EXPECTED_FIELDS[sheetName] + 1).getValue(); // pertahankan ID
      var updRowData = buildRowData(sheetName, data, existingTs, existingId);
      sheet.getRange(updRow, 1, 1, updRowData.length).setValues([updRowData]);
      sheet.getRange(updRow, 1).setNumberFormat(TS_FORMAT);
      return respond({ "result": "success", "message": "Row updated" });
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
    var addId = data.id ? String(data.id) : (sheetName === "Pengajuan_Surat" ? makeSuratId() : ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
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
      data.noHp, data.statusTinggal, data.alamat
    );
  } else if (sheetName === "Iuran_Kas") {
    rowData.push(data.tanggal, data.nama, data.noRumah, data.jenis, data.jumlah, data.keterangan);
  } else if (sheetName === "Pengumuman") {
    rowData.push(data.tanggal, data.judul, data.isi, data.kategori, data.pj, normalizePublik(data.publik));
  } else if (sheetName === "Kegiatan_Warga") {
    rowData.push(data.namaKegiatan, data.tanggal, data.waktu, data.lokasi, data.pj, data.keterangan, normalizePublik(data.publik));
  } else if (sheetName === "Pengajuan_Surat") {
    rowData.push(
      data.nama, data.nik, data.noHp, data.alamat,
      data.jenisSurat, data.keperluan,
      data.status || "Pending", data.noSurat || "", data.catatan || ""
    );
  } else {
    return null;
  }

  rowData.push(id || (sheetName === 'Pengajuan_Surat' ? makeSuratId() : ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7))));
  return rowData;
}

// ===== Pengajuan Surat (intake publik) =====================================

// Aturan bisnis Pengajuan_Surat untuk jalur admin (add/update): bila status
// "Selesai", No. Surat (nomor surat resmi) wajib diisi. Mengembalikan pesan
// error atau null bila valid.
function suratSaveError(sheetName, data) {
  if (sheetName !== 'Pengajuan_Surat') return null;
  var status = String(data.status === undefined || data.status === null || data.status === '' ? 'Pending' : data.status);
  var noSurat = cleanStr(data.noSurat, 100);
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
function sanitizeSuratRef(value) {
  var s = cleanStr(value, 40);
  if (!s) return null;
  return /^[A-Za-z0-9-]{6,40}$/.test(s) ? s : null;
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
    var props = PropertiesService.getScriptProperties();
    var to = props.getProperty('ADMIN_EMAIL');
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

// Aksi admin (token): kirim email uji ke ADMIN_EMAIL untuk memverifikasi
// konfigurasi notifikasi. Mengembalikan error yang jelas bila belum diatur.
function handleSendTestEmail() {
  var props = PropertiesService.getScriptProperties();
  var to = props.getProperty('ADMIN_EMAIL');
  if (!to) {
    return {
      "result": "error",
      "code": "no_admin_email",
      "message": "Script Property ADMIN_EMAIL belum diatur. Buka Project Settings > Script Properties, tambahkan ADMIN_EMAIL berisi alamat email admin, lalu coba lagi."
    };
  }
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

// Handler aksi publik `checkSurat`: warga cek status dengan NIK + No. HP.
// Hanya mengembalikan pengajuan yang NIK sama dan No. HP cocok (setelah dinormalisasi).
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

  var nik = cleanStr(params.nik, 40).replace(/\D/g, '');
  var hpRaw = (params.hp !== undefined && params.hp !== null) ? params.hp : params.noHp;
  var hp = cleanStr(hpRaw, 30).replace(/\D/g, '');

  if (!/^\d{16}$/.test(nik) || hp.length < 9) {
    return suratError('invalid', 'Masukkan NIK (16 digit) dan No. HP/WhatsApp yang valid.');
  }

  // Normalisasi nomor HP agar "0812...", "62812...", "+62 812...", dsb. saling cocok.
  var hpNorm = normalizeSuratHp(hp);

  if (!checkAndRecordSuratCheckRate(nik + '|' + hpNorm)) {
    return suratError('rate_limited', 'Terlalu banyak percobaan. Silakan coba lagi beberapa saat lagi.');
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Pengajuan_Surat');
  var results = [];

  if (sheet) {
    ensureSpreadsheetFormat(ss, sheet, 'Pengajuan_Surat');
    var rows = ensureIds(sheet, 'Pengajuan_Surat');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rNik = String(row[2] === undefined || row[2] === null ? '' : row[2]).replace(/\D/g, '');
      var rHp = String(row[3] === undefined || row[3] === null ? '' : row[3]).replace(/\D/g, '');
      if (rNik === nik && normalizeSuratHp(rHp) === hpNorm) {
        results.push({
          "ref": String(row[10] === undefined || row[10] === null ? '' : row[10]),
          "tanggal": formatTimestampCell(row[0]),
          "jenisSurat": cleanStr(row[5], 120),
          "status": cleanStr(row[7], 20) || 'Pending',
          "noSurat": cleanStr(row[8], 100),
          "catatan": cleanStr(row[9], 500)
        });
      }
    }
  }

  results.reverse(); // terbaru lebih dahulu

  return { "result": "success", "version": CODE_VERSION, "count": results.length, "data": results };
}

// ================= LOOKUP WARGA (bantu isi form surat) =================
// Cari SATU warga berdasarkan NIK (16 digit) persis, untuk mengisi otomatis
// Nama, No. HP, & Alamat pada form pengajuan surat portal publik. Bukan untuk
// membaca seluruh data warga: hanya 3 field itu yang dikembalikan. Tetap
// ter-gate oleh status portal + rate-limited untuk mencegah enumerasi NIK.
// Indeks kolom Data_Warga (termasuk kolom A Timestamp):
//   2 = Nama Lengkap, 5 = NIK, 10 = No HP, 12 = Alamat/No Rumah.
var WARGA_COL_NAMA = 2;
var WARGA_COL_NIK = 5;
var WARGA_COL_HP = 10;
var WARGA_COL_ALAMAT = 12;

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
    status: 'Pending', noSurat: '', catatan: ''
  }, new Date(), id);
  sheet.appendRow(rowData);
  sheet.getRange(sheet.getLastRow(), 1).setNumberFormat(TS_FORMAT);

  notifyAdminNewSurat({
    nama: nama, nik: nik, noHp: noHp, alamat: alamat,
    jenisSurat: jenisSurat, keperluan: keperluan
  });

  return { "result": "success", "id": id, "message": 'Pengajuan surat berhasil dikirim.' };
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
