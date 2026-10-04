var CODE_VERSION = "id-v2-2026-10-04";

// Nilai kolom A (Timestamp) dijadikan ID stabil untuk update/delete.
// - Baris lama berisi Date  -> "t" + epoch millis (absolut, bebas zona waktu).
// - Baris baru berisi string ID dari frontend (mis. "t1728...ab12").
//   toId() untuk string mengembalikannya apa adanya, sehingga cocok dua arah.
function toId(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return 't' + v.getTime();
  return String(v);
}

// Cari nomor baris spreadsheet (1-based, termasuk header) berdasarkan ID.
// Mengembalikan -1 jika tidak ditemukan.
function findRowById(sheet, id) {
  var target = toId(id);
  if (!target) return -1;
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (toId(ids[i][0]) === target) return i + 2;
  }
  return -1;
}

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

// Handle delete request
function handleDelete(params) {
  var sheetName = params.sheetName;
  var id = params.id;

  if (!sheetName || id === undefined || id === null || id === '') {
    return { "result": "error", "message": "Parameter tidak valid" };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return { "result": "error", "message": "Sheet tidak ditemukan: " + sheetName };
  }

  var row = findRowById(sheet, id);
  if (row === -1) {
    return { "result": "error", "message": "ID tidak ditemukan: " + id };
  }

  sheet.deleteRow(row);

  return { "result": "success", "message": "Row deleted from " + sheetName };
}

function readAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = ss.getSpreadsheetTimeZone();
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
    var values = sheet.getDataRange().getValues();
    if (values.length > 0) {
      values = values.slice(1); // buang baris header (tanpa mengubah array asli)
    }
    var fmt = formats[name] || {};
    data[name] = values.map(function (row) {
      return row.map(function (cell, col) {
        if (col === 0) return toId(cell); // kolom A = ID stabil
        if (cell instanceof Date && fmt[col]) {
          return Utilities.formatDate(cell, tz, fmt[col]);
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return respond({ "result": "error", "message": "Sheet tidak ditemukan" });
    }

    // UPDATE: perbarui baris yang sudah ada berdasarkan ID stabil (JANGAN tambah baris baru).
    if (data.action === "update") {
      var updRow = findRowById(sheet, data.id);
      if (updRow === -1) {
        return respond({ "result": "error", "message": "ID tidak ditemukan: " + data.id });
      }
      var existingTs = sheet.getRange(updRow, 1).getValue(); // pertahankan Timestamp/ID asli
      var updRowData = buildRowData(sheetName, data, existingTs);
      if (!updRowData) {
        return respond({ "result": "error", "message": "sheetName tidak dikenal: " + sheetName });
      }
      sheet.getRange(updRow, 1, 1, updRowData.length).setValues([updRowData]);
      return respond({ "result": "success", "message": "Row updated" });
    }

    // DELETE: hapus baris berdasarkan ID stabil.
    if (data.action === "delete") {
      var delRow = findRowById(sheet, data.id);
      if (delRow === -1) {
        return respond({ "result": "error", "message": "ID tidak ditemukan: " + data.id });
      }
      sheet.deleteRow(delRow);
      return respond({ "result": "success", "message": "Row deleted" });
    }

    // ADD: tambahkan baris baru. ID diambil dari data.timestamp bila ada.
    var addTs = data.timestamp ? data.timestamp : new Date();
    var rowData = buildRowData(sheetName, data, addTs);
    if (!rowData) {
      return respond({ "result": "error", "message": "sheetName tidak dikenal: " + sheetName });
    }

    sheet.appendRow(rowData);

    return respond({ "result": "success", "id": toId(rowData[0]) });

  } catch (error) {
    return respond({ "result": "error", "message": error.toString() });
  }
}

function buildRowData(sheetName, data, timestamp) {
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

  return rowData;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
