var CODE_VERSION = "publik-v7-2026-10-05";

// Semua Timestamp disimpan sebagai Date asli, ditampilkan dd-mm-yyyy hh:mm (GMT+7).
var TZ = "Asia/Jakarta";
var TS_FORMAT = "dd-mm-yyyy hh:mm";

// Jumlah kolom data (termasuk kolom A Timestamp), TIDAK termasuk kolom bantu "ID".
var EXPECTED_FIELDS = {
  "Data_Warga": 8,      // A Timestamp + 7 field (termasuk Tempat Lahir & Tanggal Lahir)
  "Iuran_Kas": 7,       // A Timestamp + 6 field
  "Pengumuman": 7,      // A Timestamp + 6 field (termasuk Publik)
  "Kegiatan_Warga": 8   // A Timestamp + 7 field (termasuk Publik)
};

// Header lengkap yang diharapkan (data + kolom bantu ID di paling kanan).
var DESIRED_HEADERS = {
  "Data_Warga": ["Timestamp", "Nama Lengkap", "NIK", "Tempat Lahir", "Tanggal Lahir", "No HP", "Status Tempat Tinggal", "Alamat/No Rumah", "ID"],
  "Iuran_Kas": ["Timestamp", "Tanggal", "Nama Warga", "No Rumah", "Jenis Transaksi", "Jumlah (Rp)", "Keterangan", "ID"],
  "Pengumuman": ["Timestamp", "Tanggal", "Judul Pengumuman", "Isi Pengumuman", "Kategori", "Penanggung Jawab", "Publik", "ID"],
  "Kegiatan_Warga": ["Timestamp", "Nama Kegiatan", "Tanggal Pelaksanaan", "Waktu", "Lokasi", "Penanggung Jawab", "Keterangan", "Publik", "ID"]
};

// Nilai default kolom Publik untuk baris lama saat migrasi.
var PUBLIK_DEFAULT = "Ya";

// 0-based index kolom "Publik" di dalam array baris (sebelum kolom bantu ID).
var PUBLIK_INDEX = {
  "Pengumuman": 6,
  "Kegiatan_Warga": 7
};

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

  if (name === 'Data_Warga') {
    migrateDataWargaLayout(sheet, desired);
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

// Migrasi Data_Warga: sisipkan kolom "Tempat Lahir" & "Tanggal Lahir" setelah NIK
// (kolom 4 & 5) bila belum ada. Aman dijalankan berulang.
function migrateDataWargaLayout(sheet, desired) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) lastCol = 1;
  var width = Math.max(lastCol, desired.length);
  var header = sheet.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h); });
  if (header.join('').trim() === '') return; // sheet kosong, header diurus pemanggil
  if (header.indexOf('Tempat Lahir') !== -1 && header.indexOf('Tanggal Lahir') !== -1) return; // sudah migrasi

  // Sisipkan 2 kolom baru tepat setelah NIK (sebelum kolom ke-4 layout lama).
  sheet.insertColumnsBefore(4, 2);
  sheet.getRange(1, 4).setValue('Tempat Lahir');
  sheet.getRange(1, 5).setValue('Tanggal Lahir');
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

function readAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var names = ["Data_Warga", "Iuran_Kas", "Pengumuman", "Kegiatan_Warga"];
  var formats = {
    "Data_Warga": { 4: "yyyy-MM-dd" },
    "Iuran_Kas": { 1: "yyyy-MM-dd" },
    "Pengumuman": { 1: "yyyy-MM-dd" },
    "Kegiatan_Warga": { 2: "yyyy-MM-dd", 3: "HH:mm" }
  };
  var data = {};

  names.forEach(function (name) {
    var sheet = ss.getSheetByName(name);
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
// Data_Warga & Iuran_Kas TIDAK pernah dikembalikan, sehingga data privat tidak bocor.
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

    var sheetName = data.sheetName;
    if (!EXPECTED_FIELDS[sheetName]) {
      return respond({ "result": "error", "message": "sheetName tidak dikenal: " + sheetName });
    }

    // Semua operasi tulis (add/update/delete) wajib menyertakan token admin.
    if (!isAuthorized(data.token)) {
      return respond(unauthorized());
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

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
    var addId = data.id ? String(data.id) : ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
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
    rowData.push(data.nama, data.nik, data.tempat, data.tanggalLahir, data.noHp, data.statusTinggal, data.alamat);
  } else if (sheetName === "Iuran_Kas") {
    rowData.push(data.tanggal, data.nama, data.noRumah, data.jenis, data.jumlah, data.keterangan);
  } else if (sheetName === "Pengumuman") {
    rowData.push(data.tanggal, data.judul, data.isi, data.kategori, data.pj, normalizePublik(data.publik));
  } else if (sheetName === "Kegiatan_Warga") {
    rowData.push(data.namaKegiatan, data.tanggal, data.waktu, data.lokasi, data.pj, data.keterangan, normalizePublik(data.publik));
  } else {
    return null;
  }

  rowData.push(id || ('id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)));
  return rowData;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
