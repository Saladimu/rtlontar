# 🤖 Agents & System Instructions - Dashboard RT Tanjung Duren Utara

Dokumen ini berisi arsitektur sistem, aturan integrasi data, serta petunjuk teknis bagi pengembang atau AI Agent yang bertugas memelihara, memodifikasi, atau memperluas fungsionalitas aplikasi ini.

---

## 🏗️ System Architecture Overview

- **Frontend Architecture:** Single Page Application (SPA) berbasis HTML5, diselaraskan dengan Tailwind CSS CDN untuk *utility styling*, dan FontAwesome CDN untuk ikonografi.
- **Backend Architecture:** Serverless Function via Google Apps Script (`doPost` HTTP Endpoint).
- **Database Layer:** Google Sheets (Relational-like Tabular Spreadsheet Storage).
- **State Persistence Layer:** Dual Storage Mode:
  - *Primary:* Dynamic asynchronous HTTP POST request ke Google Apps Script Web App.
  - *Fallback / Local State:* `localStorage` browser untuk akses offline dan *instant rendering*.

---

## 📦 Data Schema & Agent Payload Contracts

Setiap permintaan pengiriman data dari Frontend Agent ke Backend Apps Script dikirimkan menggunakan metode `POST` dengan *Content-Type* `application/json` yang membawa objek `sheetName`.

### 1. Modul Data Warga (`sheetName: "Data_Warga"`)
```json
{
  "sheetName": "Data_Warga",
  "nama": "String (Required)",
  "nik": "String (Optional)",
  "noHp": "String (Required)",
  "statusTinggal": "String [Tetap | Kontrak]",
  "alamat": "String (Required)"
}
```

### 2. Modul Iuran & Kas RT (`sheetName: "Iuran_Kas"`)
```json
{
  "sheetName": "Iuran_Kas",
  "tanggal": "YYYY-MM-DD",
  "nama": "String (Required)",
  "noRumah": "String (Optional)",
  "jenis": "String [Pemasukan | Pengeluaran]",
  "jumlah": "Number (Required)",
  "keterangan": "String (Optional)"
}
```

### 3. Modul Pengumuman (`sheetName: "Pengumuman"`)
```json
{
  "sheetName": "Pengumuman",
  "tanggal": "YYYY-MM-DD",
  "judul": "String (Required)",
  "isi": "String (Required)",
  "kategori": "String [Informasi Umum | Penting/Mendesak | Keuangan | Kegiatan]",
  "pj": "String (Required)"
}
```

### 4. Modul Kegiatan Warga (`sheetName: "Kegiatan_Warga"`)
```json
{
  "sheetName": "Kegiatan_Warga",
  "namaKegiatan": "String (Required)",
  "tanggal": "YYYY-MM-DD",
  "waktu": "HH:MM",
  "lokasi": "String (Required)",
  "pj": "String (Required)",
  "keterangan": "String (Optional)"
}
```

---

## ⚙️ Maintenance & Development Guidelines for AI Agents

1. **Responsive First Directive:** Seluruh perombakan antarmuka harus mempertahankan prinsip responsif seluler (`sm:`, `md:`, `lg:` breakpoints pada Tailwind CSS).
2. **CORS Protocol Management:** Panggilan `fetch()` ke Google Apps Script harus dikonfigurasi dengan mode `'no-cors'` karena batasan pengalihan domain Google (*redirect behavior*).
3. **Data Integrity:** Pastikan sinkronisasi antara kunci properti JSON pada skrip *frontend* selaras dengan urutan indeks `rowData.push()` pada backend Google Apps Script.
4. **Offline Resilience:** Selalu simpan state terbaru ke `localStorage` sebelum meluncurkan perintah `fetch()` ke jaringan external.