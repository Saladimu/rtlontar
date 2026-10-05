var CODE_VERSION = "id-v3-2026-10-04";

// Semua Timestamp disimpan sebagai Date asli, ditampilkan dd-mm-yyyy hh:mm (GMT+7).
var TZ = "Asia/Jakarta";
var TS_FORMAT = "dd-mm-yyyy hh:mm";

// Jumlah kolom data (termasuk kolom A Timestamp), TIDAK termasuk kolom bantu "ID".
var EXPECTED_FIELDS = {
  "Data_Warga": 6,      // A Timestamp + 5 field
  "Iuran_Kas": 7,       // A Timestamp + 6 field
  "Pengumuman": 6,      // A Timestamp + 5 field
  "Kegiatan_Warga": 7   // A Timestamp + 6 field
};

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var payload;

  // Handle delete action via GET (for JSONP support)
  if (params.action === 'delete') {
    payload = handleDelete(params);
  } else if (params.action === 'read') {
    payload = readAllSheets();
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

// Pastikan timezone spreadsheet = GMT+7, kolom Timestamp berformat dd-mm-yyyy hh:mm,
// dan header kolom bantu "ID" sudah ada.
function ensureSpreadsheetFormat(ss, sheet, name) {
  if (ss.getSpreadsheetTimeZone() !== TZ) {
    ss.setSpreadsheetTimeZone(TZ);
  }
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

  return { "result": "success", "version": CODE_VERSION, "data": data };
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
    var sheetName = data.sheetName;
    if (!EXPECTED_FIELDS[sheetName]) {
      return respond({ "result": "error", "message": "sheetName tidak dikenal: " + sheetName });
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
    rowData.push(data.nama, data.nik, data.noHp, data.statusTinggal, data.alamat);
  } else if (sheetName === "Iuran_Kas") {
    rowData.push(data.tanggal, data.nama, data.noRumah, data.jenis, data.jumlah, data.keterangan);
  } else if (sheetName === "Pengumuman") {
    rowData.push(data.tanggal, data.judul, data.isi, data.kategori, data.pj);
  } else if (sheetName === "Kegiatan_Warga") {
    rowData.push(data.namaKegiatan, data.tanggal, data.waktu, data.lokasi, data.pj, data.keterangan);
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
