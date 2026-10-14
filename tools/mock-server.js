#!/usr/bin/env node
'use strict';

/*
 * SAPA RT - Local Mock Backend + Static Server
 * ============================================
 * Menjalankan pratinjau lokal TANPA menyentuh Google Sheets / produksi.
 *
 * - Menyajikan berkas statis dari root repo (index.html, public.html, dst.).
 * - Menangani endpoint same-origin "/api" persis seperti kontrak Apps Script
 *   (action=version/read/readPublic/checkSurat/lookupWarga/sendTestEmail/delete
 *   via GET, serta add/update/delete/setPortalStatus/submitSurat via POST).
 * - Data disimpan lokal di tools/mock-data.json (dibuat otomatis, tidak dikirim
 *   ke jaringan mana pun).
 *
 * Jalankan:  node tools/mock-server.js           (default http://localhost:8000)
 *            PORT=8080 node tools/mock-server.js
 *            node tools/mock-server.js --reset    (tulis ulang data awal)
 *
 * TIDAK ADA koneksi keluar ke script.google.com. Sepenuhnya terisolasi.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = process.env.MOCK_DATA_FILE
  ? path.resolve(process.env.MOCK_DATA_FILE)
  : path.join(__dirname, 'mock-data.json');
const CODE_VERSION = 'publik-v21-2026-10-14'; // sama dengan EXPECTED_BACKEND_VERSION
const RESET = process.argv.indexOf('--reset') !== -1;

// ================= Model data (mirip code.gs) =================
const DATA_FIELDS = {
  Data_Warga: 14,
  Iuran_Kas: 7,
  Pengumuman: 7,
  Kegiatan_Warga: 8,
  Pengajuan_Surat: 11,
  Lapor_Aspirasi: 17,
};

const PUBLIK_SET = ['tidak', 'no', 'false', '0', 'draft'];
const ARSIP_SET = ['ya', 'yes', 'true', '1', 'arsip'];

function cleanStr(value, maxLen) {
  let s = value === undefined || value === null ? '' : String(value);
  s = s.replace(/\s+/g, ' ').trim();
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}
function isPublik(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return true;
  return !PUBLIK_SET.includes(String(v).trim().toLowerCase());
}
function normalizePublik(v) {
  return isPublik(v) ? 'Ya' : 'Tidak';
}
function isArsip(v) {
  if (v === true) return true;
  if (v === false || v === null || v === undefined) return false;
  return ARSIP_SET.includes(String(v).trim().toLowerCase());
}
function normalizeArsip(v) {
  return isArsip(v) ? 'Ya' : 'Tidak';
}

function blank(v) {
  return v === undefined || v === null ? '' : v;
}

function nowIso() {
  return new Date().toISOString();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ISO -> bagian tanggal/jam zona Asia/Jakarta.
function jakartaParts(iso) {
  const d = new Date(iso);
  const parts = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(d)
    .forEach((p) => {
      parts[p.type] = p.value;
    });
  return parts;
}
// ISO -> "yyyy-MM-dd HH:mm" (GMT+7) untuk Pengajuan_Surat.
function jakartaDateTime(iso) {
  const p = jakartaParts(iso);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
// ISO -> "yyMMdd" (GMT+7) untuk No. Pengajuan.
function jakartaYyMmDd(iso) {
  const p = jakartaParts(iso);
  return p.year.slice(2) + p.month + p.day;
}
// ISO -> "dd-MM-yyyy HH:mm" (GMT+7) untuk hasil checkSurat.
function displayTimestamp(iso) {
  const p = jakartaParts(iso);
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

function randomCode4() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}
function makeSuratId(iso) {
  return 'SRT-' + jakartaYyMmDd(iso || nowIso()) + '-' + randomCode4();
}
function genId(sheetName, iso) {
  if (sheetName === 'Pengajuan_Surat') return makeSuratId(iso);
  if (sheetName === 'Lapor_Aspirasi') return 'ADU-' + jakartaYyMmDd(iso || nowIso()) + '-' + randomCode4();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function buildRow(sheetName, data, tsIso, id) {
  const row = [tsIso];
  if (sheetName === 'Data_Warga') {
    row.push(
      blank(data.nomorKK), blank(data.nama), blank(data.status), blank(data.jenisKelamin),
      blank(data.nik), blank(data.tempat), blank(data.tanggalLahir), blank(data.pendidikan),
      blank(data.pekerjaan), blank(data.noHp), blank(data.statusTinggal), blank(data.alamat),
      normalizeArsip(data.arsip)
    );
  } else if (sheetName === 'Iuran_Kas') {
    row.push(blank(data.tanggal), blank(data.nama), blank(data.noRumah), blank(data.jenis), blank(data.jumlah), blank(data.keterangan));
  } else if (sheetName === 'Pengumuman') {
    row.push(blank(data.tanggal), blank(data.judul), blank(data.isi), blank(data.kategori), blank(data.pj), normalizePublik(data.publik));
  } else if (sheetName === 'Kegiatan_Warga') {
    row.push(blank(data.namaKegiatan), blank(data.tanggal), blank(data.waktu), blank(data.lokasi), blank(data.pj), blank(data.keterangan), normalizePublik(data.publik));
  } else if (sheetName === 'Pengajuan_Surat') {
    row.push(
      blank(data.nama), blank(data.nik), blank(data.noHp), blank(data.alamat),
      blank(data.jenisSurat), blank(data.keperluan),
      data.status ? String(data.status) : 'Pending', blank(data.noSurat), blank(data.catatan),
      normalizeArsip(data.arsip)
    );
  } else if (sheetName === 'Lapor_Aspirasi') {
    row.push(
      blank(data.noPengaduan), blank(data.nama), blank(data.noHp), blank(data.alamat),
      blank(data.jenisPengaduan), blank(data.judul), blank(data.detail),
      blank(data.lokasi), blank(data.tanggalKejadian), blank(data.foto), blank(data.harapan),
      data.status ? String(data.status) : 'Diterima', blank(data.petugas), blank(data.catatanTindakLanjut),
      blank(data.tanggalPenyelesaian), normalizeArsip(data.arsip)
    );
  } else {
    return null;
  }
  row.push(id || genId(sheetName, tsIso));
  return row;
}

// ================= Penyimpanan =================
const SHEET_NAMES = ['Data_Warga', 'Iuran_Kas', 'Pengumuman', 'Kegiatan_Warga', 'Pengajuan_Surat', 'Lapor_Aspirasi'];

function seedData() {
  const base = Date.parse('2026-10-09T02:00:00.000Z');
  const iso = (min) => new Date(base + min * 60000).toISOString();
  return {
    portalEnabled: true,
    adminEmail: '',
    sheets: {
      Data_Warga: [
        buildRow('Data_Warga', { nomorKK: '3201010101010001', nama: 'Budi Santoso', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201010101800001', tempat: 'Bogor', tanggalLahir: '1980-01-01', pendidikan: 'SMA', pekerjaan: 'Karyawan', noHp: '081234567890', statusTinggal: 'Tetap', alamat: 'Jl. Merdeka No. 1' }, iso(0), 'id-seed-w1'),
        buildRow('Data_Warga', { nomorKK: '3201010101010001', nama: 'Siti Aminah', status: 'Istri', jenisKelamin: 'Perempuan', nik: '3201010101850002', tempat: 'Bogor', tanggalLahir: '1985-05-12', pendidikan: 'S1', pekerjaan: 'Guru', noHp: '081298765432', statusTinggal: 'Tetap', alamat: 'Jl. Merdeka No. 1' }, iso(1), 'id-seed-w2'),
        buildRow('Data_Warga', { nomorKK: '3201010101010002', nama: 'Andi Wijaya', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201010101790003', tempat: 'Bandung', tanggalLahir: '1979-11-20', pendidikan: 'SMP', pekerjaan: 'Wiraswasta', noHp: '081377788899', statusTinggal: 'Kontrak', alamat: 'Jl. Kenanga No. 7' }, iso(2), 'id-seed-w3'),
      ],
      Iuran_Kas: [
        buildRow('Iuran_Kas', { tanggal: '2026-10-05', nama: 'Budi Santoso', noRumah: '1', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(3), 'id-seed-k1'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-06', nama: 'Andi Wijaya', noRumah: '7', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(4), 'id-seed-k2'),
      ],
      Pengumuman: [
        buildRow('Pengumuman', { tanggal: '2026-10-07', judul: 'Kerja Bakti Minggu Ini', isi: 'Kerja bakti akan dilaksanakan hari Minggu pukul 07.00 di lapangan RT.', kategori: 'Kegiatan', pj: 'Pak RT', publik: 'Ya' }, iso(5), 'id-seed-p1'),
        buildRow('Pengumuman', { tanggal: '2026-10-08', judul: 'Rapat Pengurus', isi: 'Rapat internal pengurus RT, tertutup untuk warga.', kategori: 'Internal', pj: 'Sekretaris', publik: 'Tidak' }, iso(6), 'id-seed-p2'),
      ],
      Kegiatan_Warga: [
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Kerja Bakti', tanggal: '2026-10-12', waktu: '07:00', lokasi: 'Lapangan RT', pj: 'Pak RT', keterangan: 'Membersihkan saluran air', publik: 'Ya' }, iso(7), 'id-seed-g1'),
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Posyandu Balita', tanggal: '2026-10-15', waktu: '08:00', lokasi: 'Balai RW', pj: 'Bu Kader', keterangan: 'Penimbangan & imunisasi', publik: 'Ya' }, iso(8), 'id-seed-g2'),
      ],
      Pengajuan_Surat: [
        buildRow('Pengajuan_Surat', { nama: 'Budi Santoso', nik: '3201010101800001', noHp: '081234567890', alamat: 'Jl. Merdeka No. 1', jenisSurat: 'Surat Keterangan Domisili', keperluan: 'Persyaratan administrasi bank', status: 'Selesai', noSurat: 'SRT-260100-AAAA', catatan: 'Sudah diambil' }, iso(9), 'SRT-261009-AAAA'),
      ],
      Lapor_Aspirasi: [],
    },
  };
}

function loadStore() {
  if (RESET) {
    const fresh = seedData();
    saveStore(fresh);
    console.log('[mock] data direset ke contoh awal:', DATA_FILE);
    return fresh;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.sheets) throw new Error('format tidak valid');
    SHEET_NAMES.forEach((n) => {
      if (!Array.isArray(parsed.sheets[n])) parsed.sheets[n] = [];
    });
    if (typeof parsed.portalEnabled !== 'boolean') parsed.portalEnabled = true;
    if (typeof parsed.adminEmail !== 'string') parsed.adminEmail = '';
    return parsed;
  } catch (e) {
    if (fs.existsSync(DATA_FILE)) {
      console.warn('[mock] gagal membaca', DATA_FILE, '- memakai data contoh:', e.message);
    }
    const fresh = seedData();
    saveStore(fresh);
    return fresh;
  }
}

let store = null;

function saveStore(s) {
  store = s || store;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('[mock] gagal menyimpan data:', e.message);
  }
}

store = loadStore();

// ================= Handler API =================
function findRowIndex(sheetName, id) {
  const rows = store.sheets[sheetName] || [];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][rows[i].length - 1]) === String(id)) return i;
  }
  return -1;
}

function readAllSheets() {
  const data = {};
  SHEET_NAMES.forEach((name) => {
    const rows = store.sheets[name] || [];
    data[name] = rows.map((row) => {
      const out = row.slice();
      if (name === 'Pengajuan_Surat' || name === 'Lapor_Aspirasi') out[0] = jakartaDateTime(out[0]);
      // kolom tanggal/lainnya sudah berupa string kanonik -> diteruskan apa adanya
      return out;
    });
  });
  return { result: 'success', version: CODE_VERSION, portalEnabled: store.portalEnabled !== false, adminEmail: store.adminEmail || '', data };
}

function readPublicSheets() {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  const full = readAllSheets();
  const data = { Pengumuman: [], Kegiatan_Warga: [] };
  const idx = { Pengumuman: 6, Kegiatan_Warga: 7 };
  ['Pengumuman', 'Kegiatan_Warga'].forEach((name) => {
    data[name] = (full.data[name] || []).filter((row) => isPublik(row[idx[name]]));
  });
  return { result: 'success', version: CODE_VERSION, portalEnabled: true, data };
}

function handleLookupWarga(params) {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  const nik = cleanStr(params.nik, 40).replace(/\D/g, '');
  if (!/^\d{16}$/.test(nik)) {
    return { result: 'success', version: CODE_VERSION, found: false, code: 'invalid_nik' };
  }
  const rows = store.sheets.Data_Warga || [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isArsip(row[13])) continue;
    const rNik = String(row[5] === undefined || row[5] === null ? '' : row[5]).replace(/\D/g, '');
    if (rNik === nik) {
      return {
        result: 'success',
        version: CODE_VERSION,
        found: true,
        nama: cleanStr(row[2], 100),
        noHp: cleanStr(row[10], 30),
        alamat: cleanStr(row[12], 200),
      };
    }
  }
  return { result: 'success', version: CODE_VERSION, found: false };
}

function normalizeSuratHp(value) {
  const d = String(value === undefined || value === null ? '' : value).replace(/\D/g, '');
  if (!d) return '';
  if (d.charAt(0) === '0') return '62' + d.substring(1);
  if (d.charAt(0) === '8') return '62' + d;
  return d;
}

function handleCheckSurat(params) {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  const nik = cleanStr(params.nik, 40).replace(/\D/g, '');
  const hpRaw = params.hp !== undefined && params.hp !== null ? params.hp : params.noHp;
  const hp = cleanStr(hpRaw, 30).replace(/\D/g, '');
  if (!/^\d{16}$/.test(nik) || hp.length < 9) {
    return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Masukkan NIK (16 digit) dan No. HP/WhatsApp yang valid.' };
  }
  const hpNorm = normalizeSuratHp(hp);
  const rows = store.sheets.Pengajuan_Surat || [];
  const results = [];
  let archivedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rNik = String(row[2] === undefined || row[2] === null ? '' : row[2]).replace(/\D/g, '');
    const rHp = String(row[3] === undefined || row[3] === null ? '' : row[3]).replace(/\D/g, '');
    if (rNik === nik && normalizeSuratHp(rHp) === hpNorm) {
      if (isArsip(row[10])) { archivedCount++; continue; } // pengajuan diarsipkan tidak dapat diambil publik
      results.push({
        ref: String(row[row.length - 1] === undefined || row[row.length - 1] === null ? '' : row[row.length - 1]),
        tanggal: displayTimestamp(row[0]),
        jenisSurat: cleanStr(row[5], 120),
        status: cleanStr(row[7], 20) || 'Pending',
        noSurat: cleanStr(row[8], 100),
        catatan: cleanStr(row[9], 500),
      });
    }
  }
  results.reverse();
  return { result: 'success', version: CODE_VERSION, count: results.length, archived: archivedCount, data: results };
}

function findByHpNorm(hpNorm) {
  const rows = store.sheets.Data_Warga || [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isArsip(row[13])) continue;
    const hp = String(row[10] === undefined || row[10] === null ? '' : row[10]);
    if (normalizeSuratHp(hp) === hpNorm) {
      return { nama: cleanStr(row[2], 100), alamat: cleanStr(row[12], 200), noHp: cleanStr(row[10], 30) };
    }
  }
  return null;
}

function portalDisabled() {
  return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
}

function handleLookupWargaHp(params) {
  if (store.portalEnabled === false) return portalDisabled();
  const hpDigits = cleanStr(params.hp, 30).replace(/\D/g, '');
  if (hpDigits.length < 9 || hpDigits.length > 15) {
    return { result: 'success', version: CODE_VERSION, found: false, code: 'invalid_hp' };
  }
  const warga = findByHpNorm(normalizeSuratHp(hpDigits));
  if (!warga) return { result: 'success', version: CODE_VERSION, found: false };
  return { result: 'success', version: CODE_VERSION, found: true, nama: warga.nama, noHp: warga.noHp, alamat: warga.alamat };
}

function makeNomorPengaduan() {
  const year = String(new Date().getFullYear());
  const prefix = 'ADU/' + year + '-';
  let max = 0;
  (store.sheets.Lapor_Aspirasi || []).forEach((row) => {
    const s = String(row[1] === undefined || row[1] === null ? '' : row[1]).trim().toUpperCase();
    if (s.indexOf(prefix) === 0) {
      const n = parseInt(s.substring(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return prefix + ('000' + (max + 1)).slice(-3);
}

function handleCheckLapor(params) {
  if (store.portalEnabled === false) return portalDisabled();
  const nomor = cleanStr(params.nomor, 40).toUpperCase();
  if (!nomor) {
    return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Masukkan No. Pengaduan (mis. ADU/2026-001).' };
  }
  const rows = store.sheets.Lapor_Aspirasi || [];
  const results = [];
  let archivedCount = 0;
  rows.forEach((row) => {
    const rNomor = String(row[1] === undefined || row[1] === null ? '' : row[1]).trim().toUpperCase();
    if (rNomor === nomor) {
      if (isArsip(row[16])) { archivedCount++; return; }
      results.push({
        nomor: rNomor,
        tanggal: displayTimestamp(row[0]),
        jenisPengaduan: cleanStr(row[5], 120),
        judul: cleanStr(row[6], 150),
        status: cleanStr(row[12], 20) || 'Diterima',
        petugas: cleanStr(row[13], 100),
        catatan: cleanStr(row[14], 1000),
        tanggalSelesai: cleanStr(row[15], 20),
      });
    }
  });
  results.reverse();
  return { result: 'success', version: CODE_VERSION, count: results.length, archived: archivedCount, data: results };
}

function handleDelete(params) {
  const sheetName = params.sheetName;
  const id = params.id;
  if (!sheetName || !DATA_FIELDS[sheetName] || id === undefined || id === null || id === '') {
    return { result: 'error', message: 'Parameter tidak valid' };
  }
  const idx = findRowIndex(sheetName, id);
  if (idx === -1) return { result: 'error', message: 'ID tidak ditemukan: ' + id };
  store.sheets[sheetName].splice(idx, 1);
  saveStore();
  return { result: 'success', message: 'Row deleted from ' + sheetName };
}

function handlePost(data) {
  if (!data || typeof data !== 'object') return { result: 'error', message: 'Body kosong / tidak terbaca' };

  if (data.action === 'setPortalStatus') {
    store.portalEnabled = data.enabled === true || String(data.enabled) === 'true';
    saveStore();
    return { result: 'success', portalEnabled: store.portalEnabled };
  }

  if (data.action === 'setAdminEmail') {
    const email = cleanStr(data.email, 200);
    if (!email) return { result: 'error', code: 'invalid_email', message: 'Alamat email admin tidak boleh kosong.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { result: 'error', code: 'invalid_email', message: 'Format email tidak valid: ' + email };
    store.adminEmail = email;
    saveStore();
    return { result: 'success', adminEmail: email, message: 'Email admin disimpan: ' + email + '.' };
  }

  if (data.action === 'submitSurat') {
    if (store.portalEnabled === false) {
      return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
    }
    if (cleanStr(data.website, 100)) return { result: 'success', id: 'ok', message: 'Pengajuan terkirim.' };
    const nama = cleanStr(data.nama, 100);
    const nik = cleanStr(data.nik, 40).replace(/\D/g, '');
    const noHp = cleanStr(data.noHp, 30).replace(/[^\d+]/g, '');
    const alamat = cleanStr(data.alamat, 200);
    const jenisSurat = cleanStr(data.jenisSurat, 120);
    const keperluan = cleanStr(data.keperluan, 800);
    if (nama.length < 3) return { result: 'error', code: 'invalid', message: 'Nama lengkap wajib diisi (minimal 3 karakter).' };
    if (!/^\d{16}$/.test(nik)) return { result: 'error', code: 'invalid', message: 'NIK harus 16 digit angka.' };
    const hpDigits = noHp.replace(/\D/g, '');
    if (hpDigits.length < 9 || hpDigits.length > 15) return { result: 'error', code: 'invalid', message: 'Nomor HP/WhatsApp tidak valid.' };
    if (!alamat) return { result: 'error', code: 'invalid', message: 'Alamat / No. Rumah wajib diisi.' };
    if (!jenisSurat) return { result: 'error', code: 'invalid', message: 'Jenis Surat wajib dipilih.' };
    if (keperluan.length < 3) return { result: 'error', code: 'invalid', message: 'Keperluan / alasan pengajuan wajib diisi (minimal 3 karakter).' };
    const ts = nowIso();
    let id = cleanStr(data.ref, 40);
    if (!id || !/^[A-Za-z0-9-]{6,40}$/.test(id) || findRowIndex('Pengajuan_Surat', id) !== -1) id = makeSuratId(ts);
    const row = buildRow('Pengajuan_Surat', { nama, nik, noHp, alamat, jenisSurat, keperluan, status: 'Pending', noSurat: '', catatan: '' }, ts, id);
    store.sheets.Pengajuan_Surat.push(row);
    saveStore();
    console.log('[mock] submitSurat tercatat:', id);
    return { result: 'success', id, message: 'Pengajuan surat berhasil dikirim.' };
  }

  if (data.action === 'submitLapor') {
    if (store.portalEnabled === false) return portalDisabled();
    if (cleanStr(data.website, 100)) return { result: 'success', noPengaduan: 'ok', message: 'Laporan terkirim.' };
    const hpDigits = cleanStr(data.noHp, 30).replace(/\D/g, '');
    if (hpDigits.length < 9 || hpDigits.length > 15) {
      return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Nomor WhatsApp tidak valid.' };
    }
    const warga = findByHpNorm(normalizeSuratHp(hpDigits));
    if (!warga) {
      return { result: 'error', code: 'not_registered', version: CODE_VERSION, message: 'Nomor WhatsApp belum terdaftar pada Data Warga RT. Hubungi pengurus RT untuk mendaftarkan nomor Anda terlebih dahulu.' };
    }
    const jenis = cleanStr(data.jenisPengaduan, 120);
    const judul = cleanStr(data.judul, 150);
    const detail = cleanStr(data.detail, 2000);
    const setuju = (data.setuju === true || String(data.setuju) === 'true' || String(data.setuju) === '1');
    if (!jenis) return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Jenis pengaduan wajib dipilih.' };
    if (judul.length < 3) return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Judul pengaduan wajib diisi (minimal 3 karakter).' };
    if (detail.length < 10) return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Detail pengaduan wajib diisi (minimal 10 karakter).' };
    if (!setuju) return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Persetujuan penggunaan data wajib dicentang.' };
    let tglKejadian = cleanStr(data.tanggalKejadian, 20);
    if (tglKejadian && !/^\d{4}-\d{2}-\d{2}$/.test(tglKejadian)) tglKejadian = '';
    const ts = nowIso();
    const noPengaduan = makeNomorPengaduan();
    const id = 'ADU-' + jakartaYyMmDd(ts) + '-' + randomCode4();
    const row = buildRow('Lapor_Aspirasi', {
      noPengaduan, nama: warga.nama, noHp: warga.noHp || hpDigits, alamat: warga.alamat,
      jenisPengaduan: jenis, judul, detail,
      lokasi: cleanStr(data.lokasi, 200), tanggalKejadian: tglKejadian,
      foto: data.foto ? '(mock) foto tersimpan' : '', harapan: cleanStr(data.harapan, 1000),
      status: 'Diterima', petugas: '', catatanTindakLanjut: '', tanggalPenyelesaian: '', arsip: 'Tidak',
    }, ts, id);
    store.sheets.Lapor_Aspirasi.push(row);
    saveStore();
    console.log('[mock] submitLapor tercatat:', noPengaduan);
    return { result: 'success', noPengaduan, id, message: 'Laporan berhasil dikirim.' };
  }

  if (data.test) {
    return { result: 'success', message: 'Koneksi ke mock backend OK (lokal).' };
  }

  const sheetName = data.sheetName;
  if (!DATA_FIELDS[sheetName]) {
    return { result: 'error', message: 'sheetName tidak dikenal: ' + sheetName };
  }

  if (data.action === 'update') {
    const idx = findRowIndex(sheetName, data.id);
    if (idx === -1) return { result: 'error', message: 'ID tidak ditemukan: ' + data.id };
    const existing = store.sheets[sheetName][idx];
    const existingTs = existing[0];
    const existingId = existing[existing.length - 1];
    store.sheets[sheetName][idx] = buildRow(sheetName, data, existingTs, existingId);
    saveStore();
    return { result: 'success', message: 'Row updated' };
  }

  if (data.action === 'delete') {
    const idx = findRowIndex(sheetName, data.id);
    if (idx === -1) return { result: 'error', message: 'ID tidak ditemukan: ' + data.id };
    store.sheets[sheetName].splice(idx, 1);
    saveStore();
    return { result: 'success', message: 'Row deleted' };
  }

  // ADD
  const ts = nowIso();
  const id = data.id ? String(data.id) : genId(sheetName, ts);
  // Idempotensi seperti backend: ID yang sudah ada tidak ditambahkan dua kali.
  if (data.id && findRowIndex(sheetName, id) !== -1) {
    return { result: 'success', id, duplicate: true };
  }
  if (sheetName === 'Lapor_Aspirasi' && !cleanStr(data.noPengaduan, 40)) {
    data.noPengaduan = makeNomorPengaduan();
  }
  store.sheets[sheetName].push(buildRow(sheetName, data, ts, id));
  saveStore();
  return { result: 'success', id };
}

// ================= HTTP =================
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJson(res, obj, status, isJsonp, callback) {
  const body = isJsonp ? callback + '(' + JSON.stringify(obj) + ');' : JSON.stringify(obj);
  res.writeHead(status || 200, {
    'Content-Type': isJsonp ? 'text/javascript; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseQuery(reqUrl) {
  const u = new URL(reqUrl, 'http://localhost');
  const params = {};
  u.searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

function handleApi(req, res) {
  const params = parseQuery(req.url);
  const isJsonp = !!params.callback;
  const callback = params.callback;

  if (req.method === 'GET' || req.method === 'HEAD') {
    let payload;
    if (params.action === 'delete') payload = handleDelete(params);
    else if (params.action === 'read') payload = readAllSheets();
    else if (params.action === 'readPublic') payload = readPublicSheets();
    else if (params.action === 'checkSurat') payload = handleCheckSurat(params);
    else if (params.action === 'lookupWarga') payload = handleLookupWarga(params);
    else if (params.action === 'lookupWargaHp') payload = handleLookupWargaHp(params);
    else if (params.action === 'checkLapor') payload = handleCheckLapor(params);
    else if (params.action === 'sendTestEmail') {
      const email = cleanStr(params.email, 200);
      if (email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          payload = { result: 'error', code: 'invalid_email', version: CODE_VERSION, message: 'Format email tidak valid: ' + email };
        } else {
          store.adminEmail = email;
          saveStore();
          payload = { result: 'success', to: email, version: CODE_VERSION, message: 'Email uji (mock) ke ' + email + '.' };
        }
      } else if (!store.adminEmail) {
        payload = { result: 'error', code: 'no_admin_email', version: CODE_VERSION, message: 'Email admin belum diatur. Isi kolom Admin Email (ADMIN_EMAIL) di panel Pengaturan.' };
      } else {
        payload = { result: 'success', to: store.adminEmail, version: CODE_VERSION, message: 'Email uji (mock) ke ' + store.adminEmail + '.' };
      }
    }
    else if (params.action === 'version') payload = { result: 'success', version: CODE_VERSION };
    else payload = { result: 'success', message: 'Web App aktif (mock lokal)', version: CODE_VERSION };
    sendJson(res, payload, 200, isJsonp, callback);
    return;
  }

  if (req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (e) {
        sendJson(res, { result: 'error', message: 'JSON tidak valid' }, 200, isJsonp, callback);
        return;
      }
      let payload;
      try {
        payload = handlePost(data);
      } catch (e) {
        payload = { result: 'error', message: String(e && e.message ? e.message : e) };
      }
      sendJson(res, payload, 200, isJsonp, callback);
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method not allowed');
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/public') pathname = '/public.html';

  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': stat.size,
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log('[mock] SAPA RT local preview: http://localhost:' + PORT);
  console.log('[mock] Data lokal:', DATA_FILE);
  console.log('[mock] Endpoint /api dilayani mock (TIDAK menyentuh Google Sheets).');
});
