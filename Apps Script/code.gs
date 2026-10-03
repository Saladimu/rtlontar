function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var payload = (params.action === 'read')
    ? readAllSheets()
    : { "result": "success", "message": "Web App aktif" };

  // Dukungan JSONP untuk membaca data lintas-domain tanpa masalah CORS.
  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return respond(payload);
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
        if (cell instanceof Date && fmt[col]) {
          return Utilities.formatDate(cell, tz, fmt[col]);
        }
        return cell;
      });
    });
  });

  return { "result": "success", "data": data };
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

    var timestamp = new Date();
    // Handle delete action
    if (data.action === "delete") {
      var rowIndex = data.rowIndex; // 0-based index from app (matches array position)
      if (rowIndex === undefined || rowIndex < 0) {
        return respond({ "result": "error", "message": "Invalid row index" });
      }
      var numRows = sheet.getLastRow() - 1; // exclude header
      if (rowIndex >= numRows) {
        return respond({ "result": "error", "message": "Row index out of range" });
      }
      // Row 1 is header, so data starts at row 2
      // rowIndex 0 -> row 2, rowIndex 1 -> row 3, etc.
      sheet.deleteRow(rowIndex + 2);
      return respond({ "result": "success", "message": "Row deleted" });
    }

    var rowData = [timestamp];

    if (sheetName === "Data_Warga") {
      rowData.push(data.nama, data.nik, data.noHp, data.statusTinggal, data.alamat);
    } else if (sheetName === "Iuran_Kas") {
      rowData.push(data.tanggal, data.nama, data.noRumah, data.jenis, data.jumlah, data.keterangan);
    } else if (sheetName === "Pengumuman") {
      rowData.push(data.tanggal, data.judul, data.isi, data.kategori, data.pj);
    } else if (sheetName === "Kegiatan_Warga") {
      rowData.push(data.namaKegiatan, data.tanggal, data.waktu, data.lokasi, data.pj, data.keterangan);
    } else {
      return respond({ "result": "error", "message": "sheetName tidak dikenal: " + sheetName });
    }

    sheet.appendRow(rowData);

    return respond({ "result": "success" });

  } catch (error) {
    return respond({ "result": "error", "message": error.toString() });
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
