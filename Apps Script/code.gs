function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.sheetName;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": "Sheet tidak ditemukan" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var timestamp = new Date();
    var rowData = [timestamp];
    
    if (sheetName === "Data_Warga") {
      rowData.push(data.nama, data.nik, data.noHp, data.statusTinggal, data.alamat);
    } else if (sheetName === "Iuran_Kas") {
      rowData.push(data.tanggal, data.nama, data.noRumah, data.jenis, data.jumlah, data.keterangan);
    } else if (sheetName === "Pengumuman") {
      rowData.push(data.tanggal, data.judul, data.isi, data.kategori, data.pj);
    } else if (sheetName === "Kegiatan_Warga") {
      rowData.push(data.namaKegiatan, data.tanggal, data.waktu, data.lokasi, data.pj, data.keterangan);
    }
    
    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}