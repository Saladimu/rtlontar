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
const CODE_VERSION = 'publik-v38-2026-10-26'; // sama dengan EXPECTED_BACKEND_VERSION
const RESET = process.argv.indexOf('--reset') !== -1;

// ================= Model data (mirip code.gs) =================
const DATA_FIELDS = {
  Data_Warga: 14,
  Iuran_Kas: 9,
  Pengumuman: 7,
  Kegiatan_Warga: 8,
  Pengajuan_Surat: 19,
  Lapor_Aspirasi: 21,
};

const DATA_HEADERS = {
  Data_Warga: ['Timestamp', 'Nomor KK', 'Nama Lengkap', 'Status', 'Jenis Kelamin', 'NIK', 'Tempat Lahir', 'Tanggal Lahir', 'Pendidikan', 'Pekerjaan', 'No HP', 'Status Tempat Tinggal', 'Alamat/No Rumah', 'Diarsipkan', 'ID'],
  Iuran_Kas: ['Timestamp', 'Tanggal', 'Nama Warga', 'No Rumah', 'Jenis Transaksi', 'Jumlah (Rp)', 'Keterangan', 'Diarsipkan', 'Reversal Dari', 'ID'],
  Pengumuman: ['Timestamp', 'Tanggal', 'Judul Pengumuman', 'Isi Pengumuman', 'Kategori', 'Penanggung Jawab', 'Publik', 'ID'],
  Kegiatan_Warga: ['Timestamp', 'Nama Kegiatan', 'Tanggal Pelaksanaan', 'Waktu', 'Lokasi', 'Penanggung Jawab', 'Keterangan', 'Publik', 'ID'],
  Pengajuan_Surat: ['Timestamp', 'Nama Lengkap Pemohon', 'NIK', 'No. HP / WhatsApp', 'Alamat / No. Rumah', 'Jenis Surat', 'Keperluan / Alasan Pengajuan', 'Status Pengurusan', 'No. Surat', 'Catatan Pengurus', 'Tanggal Selesai', 'Diarsipkan', 'Rw Status', 'Rw Catatan', 'Rw Oleh', 'Rw Tanggal', 'Rw Revisi', 'Rw Versi', 'Rw Kunci', 'ID'],
  Lapor_Aspirasi: ['Timestamp', 'No. Pengaduan', 'Nama Warga', 'No. HP / WhatsApp', 'Alamat / No. Rumah', 'Jenis Pengaduan', 'Judul Pengaduan', 'Detail Pengaduan', 'Lokasi Kejadian', 'Tanggal Kejadian', 'Foto / Bukti Pendukung', 'Harapan / Solusi', 'Status', 'Petugas / Pengurus', 'Catatan Tindak Lanjut', 'Tanggal Penyelesaian', 'Diarsipkan', 'Rw Status', 'Rw Petugas', 'Rw Diperbarui', 'Rw Kunci', 'ID'],
  Lapor_Tindak_Lanjut: ['ID', 'Lapor ID', 'RT ID', 'Aktor', 'Peran', 'Catatan', 'Status', 'Visibilitas', 'Waktu'],
};

const SURAT_RW_STATUSES = ['Tidak Perlu', 'Menunggu', 'Disetujui', 'Dikembalikan', 'Ditolak'];
const LAPOR_RW_STATUSES = ['Tidak Perlu', 'Perlu Tindak Lanjut', 'Ditangani RW', 'Selesai RW'];
const SURAT_RW_MAX_REVISI = 3;

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

function normalizeSuratRwStatus(v, fallback) {
  const s = cleanStr(v, 40);
  return SURAT_RW_STATUSES.includes(s) ? s : (fallback || 'Tidak Perlu');
}
function normalizeLaporRwStatus(v, fallback) {
  const s = cleanStr(v, 40);
  return LAPOR_RW_STATUSES.includes(s) ? s : (fallback || 'Tidak Perlu');
}
function intAtLeast(v, min) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.floor(n));
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

// Tanggal (GMT+7) dalam format ISO yyyy-MM-dd dari sebuah timestamp ISO.
function jakartaDateOf(iso) {
  const p = jakartaParts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

// Tanggal hari ini (GMT+7) dalam format ISO yyyy-MM-dd.
function jakartaDateToday() {
  return jakartaDateOf(nowIso());
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
    row.push(blank(data.tanggal), blank(data.nama), blank(data.noRumah), blank(data.jenis), blank(data.jumlah), blank(data.keterangan), normalizeArsip(data.arsip), blank(data.reversalDari));
  } else if (sheetName === 'Pengumuman') {
    row.push(blank(data.tanggal), blank(data.judul), blank(data.isi), blank(data.kategori), blank(data.pj), normalizePublik(data.publik));
  } else if (sheetName === 'Kegiatan_Warga') {
    row.push(blank(data.namaKegiatan), blank(data.tanggal), blank(data.waktu), blank(data.lokasi), blank(data.pj), blank(data.keterangan), normalizePublik(data.publik));
  } else if (sheetName === 'Pengajuan_Surat') {
    row.push(
      blank(data.nama), blank(data.nik), blank(data.noHp), blank(data.alamat),
      blank(data.jenisSurat), blank(data.keperluan),
      data.status ? String(data.status) : 'Pending', blank(data.noSurat), blank(data.catatan),
      blank(data.tanggalSelesai), normalizeArsip(data.arsip),
      normalizeSuratRwStatus(data.rwStatus, 'Tidak Perlu'),
      blank(data.rwCatatan), blank(data.rwOleh), blank(data.rwTanggal),
      intAtLeast(data.rwRevisi, 0), intAtLeast(data.rwVersi, 1), blank(data.rwKunci)
    );
  } else if (sheetName === 'Lapor_Aspirasi') {
    row.push(
      blank(data.noPengaduan), blank(data.nama), blank(data.noHp), blank(data.alamat),
      blank(data.jenisPengaduan), blank(data.judul), blank(data.detail),
      blank(data.lokasi), blank(data.tanggalKejadian), blank(data.foto), blank(data.harapan),
      data.status ? String(data.status) : 'Diterima', blank(data.petugas), blank(data.catatanTindakLanjut),
      blank(data.tanggalPenyelesaian), normalizeArsip(data.arsip),
      normalizeLaporRwStatus(data.rwStatus, 'Tidak Perlu'),
      blank(data.rwPetugas), blank(data.rwDiperbarui), blank(data.rwKunci)
    );
  } else if (sheetName === 'Lapor_Tindak_Lanjut') {
    row.push(
      blank(data.id), blank(data.laporId), blank(data.rtId), blank(data.aktor), blank(data.peran),
      blank(data.catatan), blank(data.status), blank(data.visibilitas), blank(data.waktu)
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
    laporEnabled: true,
    suratEnabled: true,
    adminEmail: '',
    saldoAwal: 1500000,
    sheets: {
      Data_Warga: [
        buildRow('Data_Warga', { nomorKK: '3201010101010001', nama: 'Budi Santoso', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201010101800001', tempat: 'Bogor', tanggalLahir: '1980-01-01', pendidikan: 'SMA', pekerjaan: 'Karyawan', noHp: '081234567890', statusTinggal: 'Tetap', alamat: 'Jl. Merdeka No. 1' }, iso(0), 'id-seed-w1'),
        buildRow('Data_Warga', { nomorKK: '3201010101010001', nama: 'Siti Aminah', status: 'Istri', jenisKelamin: 'Perempuan', nik: '3201010101850002', tempat: 'Bogor', tanggalLahir: '1985-05-12', pendidikan: 'S1', pekerjaan: 'Guru', noHp: '081298765432', statusTinggal: 'Tetap', alamat: 'Jl. Merdeka No. 1' }, iso(1), 'id-seed-w2'),
        buildRow('Data_Warga', { nomorKK: '3201010101010002', nama: 'Andi Wijaya', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201010101790003', tempat: 'Bandung', tanggalLahir: '1979-11-20', pendidikan: 'SMP', pekerjaan: 'Wiraswasta', noHp: '081377788899', statusTinggal: 'Kontrak', alamat: 'Jl. Kenanga No. 7' }, iso(2), 'id-seed-w3'),
        buildRow('Data_Warga', { nomorKK: '3201010101010002', nama: 'Dewi Lestari', status: 'Istri', jenisKelamin: 'Perempuan', nik: '3201014506850004', tempat: 'Bandung', tanggalLahir: '1985-06-05', pendidikan: 'S1', pekerjaan: 'Ibu Rumah Tangga', noHp: '081377788800', statusTinggal: 'Kontrak', alamat: 'Jl. Kenanga No. 7' }, iso(30), 'id-seed-w4'),
        buildRow('Data_Warga', { nomorKK: '3201010101010002', nama: 'Rizky Wijaya', status: 'Anak', jenisKelamin: 'Laki-laki', nik: '3201011203100005', tempat: 'Bandung', tanggalLahir: '2010-03-12', pendidikan: 'SD', pekerjaan: 'Pelajar', noHp: '081377788800', statusTinggal: 'Kontrak', alamat: 'Jl. Kenanga No. 7' }, iso(31), 'id-seed-w5'),
        buildRow('Data_Warga', { nomorKK: '3201010101010003', nama: 'Joko Prasetyo', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201011502780006', tempat: 'Surabaya', tanggalLahir: '1978-02-15', pendidikan: 'S1', pekerjaan: 'PNS', noHp: '081399900001', statusTinggal: 'Tetap', alamat: 'Jl. Melati No. 12' }, iso(32), 'id-seed-w6'),
        buildRow('Data_Warga', { nomorKK: '3201010101010003', nama: 'Rina Marlina', status: 'Istri', jenisKelamin: 'Perempuan', nik: '3201016005820007', tempat: 'Jakarta', tanggalLahir: '1982-05-20', pendidikan: 'S1', pekerjaan: 'Perawat', noHp: '081399900002', statusTinggal: 'Tetap', alamat: 'Jl. Melati No. 12' }, iso(33), 'id-seed-w7'),
        buildRow('Data_Warga', { nomorKK: '3201010101010004', nama: 'Sari Dewi', status: 'Kepala Keluarga', jenisKelamin: 'Perempuan', nik: '3201015501880008', tempat: 'Yogyakarta', tanggalLahir: '1988-01-15', pendidikan: 'SMA', pekerjaan: 'Pedagang', noHp: '081311122233', statusTinggal: 'Tetap', alamat: 'Jl. Kenanga No. 9' }, iso(34), 'id-seed-w8'),
        buildRow('Data_Warga', { nomorKK: '3201010101010005', nama: 'Ahmad Fauzi', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201011010750009', tempat: 'Medan', tanggalLahir: '1975-10-10', pendidikan: 'SMP', pekerjaan: 'Buruh', noHp: '081344455566', statusTinggal: 'Kontrak', alamat: 'Jl. Anggrek No. 3' }, iso(35), 'id-seed-w9'),
        buildRow('Data_Warga', { nomorKK: '3201010101010005', nama: 'Putri Handayani', status: 'Istri', jenisKelamin: 'Perempuan', nik: '3201014207800010', tempat: 'Medan', tanggalLahir: '1980-07-02', pendidikan: 'SMA', pekerjaan: 'Ibu Rumah Tangga', noHp: '081344455567', statusTinggal: 'Kontrak', alamat: 'Jl. Anggrek No. 3' }, iso(36), 'id-seed-w10'),
        buildRow('Data_Warga', { nomorKK: '3201010101010006', nama: 'Hendra Gunawan', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201010509700011', tempat: 'Semarang', tanggalLahir: '1970-09-05', pendidikan: 'S1', pekerjaan: 'Pensiunan', noHp: '081355566677', statusTinggal: 'Tetap', alamat: 'Jl. Melati No. 20' }, iso(37), 'id-seed-w11'),
        buildRow('Data_Warga', { nomorKK: '3201010101010007', nama: 'Slamet Riyadi', status: 'Kepala Keluarga', jenisKelamin: 'Laki-laki', nik: '3201011106650012', tempat: 'Solo', tanggalLahir: '1965-06-11', pendidikan: 'SMA', pekerjaan: 'Karyawan', noHp: '081366677788', statusTinggal: 'Tetap', alamat: 'Jl. Kenanga No. 15', arsip: 'Ya' }, iso(38), 'id-seed-w12'),
      ],
      Iuran_Kas: [
        buildRow('Iuran_Kas', { tanggal: '2026-10-05', nama: 'Budi Santoso', noRumah: '1', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(3), 'id-seed-k1'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-06', nama: 'Andi Wijaya', noRumah: '7', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(4), 'id-seed-k2'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-07', nama: 'Siti Aminah', noRumah: '1', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(39), 'id-seed-k3'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-08', nama: 'Joko Prasetyo', noRumah: '12', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(40), 'id-seed-k4'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-09', nama: 'Sari Dewi', noRumah: '9', jenis: 'Sumbangan', jumlah: 100000, keterangan: 'Sumbangan kegiatan 17-an' }, iso(41), 'id-seed-k5'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-10', nama: 'Bendahara', noRumah: '', jenis: 'Pengeluaran', jumlah: 75000, keterangan: 'Beli lampu jalan gang' }, iso(42), 'id-seed-k6'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-11', nama: 'Ahmad Fauzi', noRumah: '3', jenis: 'Iuran Bulanan', jumlah: 50000, keterangan: 'Iuran Oktober' }, iso(43), 'id-seed-k7'),
        buildRow('Iuran_Kas', { tanggal: '2026-10-12', nama: 'Bendahara', noRumah: '', jenis: 'Pengeluaran', jumlah: 250000, keterangan: 'Perbaikan pos ronda' }, iso(44), 'id-seed-k8'),
        buildRow('Iuran_Kas', { tanggal: '2026-09-10', nama: 'Bendahara', noRumah: '', jenis: 'Pengeluaran', jumlah: 40000, keterangan: 'Beli spanduk (salah input, dibatalkan)', arsip: 'Ya' }, iso(45), 'id-seed-k9'),
      ],
      Pengumuman: [
        buildRow('Pengumuman', { tanggal: '2026-10-07', judul: 'Kerja Bakti Minggu Ini', isi: 'Kerja bakti akan dilaksanakan hari Minggu pukul 07.00 di lapangan RT.', kategori: 'Kegiatan', pj: 'Pak RT', publik: 'Ya' }, iso(5), 'id-seed-p1'),
        buildRow('Pengumuman', { tanggal: '2026-10-08', judul: 'Rapat Pengurus', isi: 'Rapat internal pengurus RT, tertutup untuk warga.', kategori: 'Internal', pj: 'Sekretaris', publik: 'Tidak' }, iso(6), 'id-seed-p2'),
        buildRow('Pengumuman', { tanggal: '2026-10-10', judul: 'Pemadaman Listrik Terjadwal', isi: 'PLN akan melakukan pemeliharaan pada Sabtu pukul 09.00-12.00. Mohon persiapan warga.', kategori: 'Informasi', pj: 'Sekretaris', publik: 'Ya' }, iso(45), 'id-seed-p3'),
        buildRow('Pengumuman', { tanggal: '2026-10-11', judul: 'Iuran Keamanan Bulan Ini', isi: 'Mohon iuran keamanan bulan ini disetorkan paling lambat tanggal 25 kepada Bendahara.', kategori: 'Keuangan', pj: 'Bendahara', publik: 'Ya' }, iso(46), 'id-seed-p4'),
        buildRow('Pengumuman', { tanggal: '2026-10-12', judul: 'Evaluasi Petugas Kebersihan', isi: 'Rapat evaluasi internal pengurus RT mengenai jadwal kebersihan.', kategori: 'Internal', pj: 'Pak RT', publik: 'Tidak' }, iso(47), 'id-seed-p5'),
      ],
      Kegiatan_Warga: [
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Kerja Bakti', tanggal: '2026-10-12', waktu: '07:00', lokasi: 'Lapangan RT', pj: 'Pak RT', keterangan: 'Membersihkan saluran air', publik: 'Ya' }, iso(7), 'id-seed-g1'),
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Posyandu Balita', tanggal: '2026-10-15', waktu: '08:00', lokasi: 'Balai RW', pj: 'Bu Kader', keterangan: 'Penimbangan & imunisasi', publik: 'Ya' }, iso(8), 'id-seed-g2'),
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Senam Sehat', tanggal: '2026-10-18', waktu: '06:30', lokasi: 'Lapangan RT', pj: 'Bu Kader', keterangan: 'Senam bersama warga', publik: 'Ya' }, iso(48), 'id-seed-g3'),
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Peringatan Maulid', tanggal: '2026-10-20', waktu: '19:30', lokasi: 'Balai RW', pj: 'Pak RT', keterangan: 'Ceramah & santunan anak yatim', publik: 'Ya' }, iso(49), 'id-seed-g4'),
        buildRow('Kegiatan_Warga', { namaKegiatan: 'Rapat Bulanan RT', tanggal: '2026-10-25', waktu: '19:00', lokasi: 'Rumah Pak RT', pj: 'Sekretaris', keterangan: 'Membahas program & keuangan', publik: 'Tidak' }, iso(50), 'id-seed-g5'),
      ],
      Pengajuan_Surat: [
        buildRow('Pengajuan_Surat', { nama: 'Budi Santoso', nik: '3201010101800001', noHp: '081234567890', alamat: 'Jl. Merdeka No. 1', jenisSurat: 'Surat Keterangan Domisili', keperluan: 'Persyaratan administrasi bank', status: 'Selesai', noSurat: 'SRT-260100-AAAA', catatan: 'Sudah diambil', tanggalSelesai: '2026-10-12' }, iso(9), 'SRT-261009-AAAA'),
        buildRow('Pengajuan_Surat', { nama: 'Siti Aminah', nik: '3201010101850002', noHp: '081298765432', alamat: 'Jl. Merdeka No. 1', jenisSurat: 'Surat Keterangan Domisili (Perorangan)', keperluan: 'Pembukaan rekening bank', status: 'Pending', noSurat: '', catatan: '' }, iso(51), 'SRT-261010-BBBB'),
        buildRow('Pengajuan_Surat', { nama: 'Andi Wijaya', nik: '3201010101790003', noHp: '081377788899', alamat: 'Jl. Kenanga No. 7', jenisSurat: 'Surat Pengantar SKCK', keperluan: 'Melamar pekerjaan', status: 'Diproses', noSurat: '', catatan: 'Sedang diproses pengurus' }, iso(52), 'SRT-261011-CCCC'),
        buildRow('Pengajuan_Surat', { nama: 'Joko Prasetyo', nik: '3201011502780006', noHp: '081399900001', alamat: 'Jl. Melati No. 12', jenisSurat: 'Surat Keterangan Tidak Mampu (SKTM)', keperluan: 'Bantuan pendidikan anak', status: 'Selesai', noSurat: '474/017-RT/RW.06/X/2026', catatan: 'Sudah diambil', tanggalSelesai: '2026-10-15' }, iso(53), 'SRT-261012-DDDD'),
        buildRow('Pengajuan_Surat', { nama: 'Sari Dewi', nik: '3201015501880008', noHp: '081311122233', alamat: 'Jl. Kenanga No. 9', jenisSurat: 'Surat Keterangan Domisili Usaha', keperluan: 'Legalitas usaha warung', status: 'Ditolak', noSurat: '', catatan: 'Kelengkapan dokumen kurang' }, iso(54), 'SRT-261013-EEEE'),
        buildRow('Pengajuan_Surat', { nama: 'Ahmad Fauzi', nik: '3201011010750009', noHp: '081344455566', alamat: 'Jl. Anggrek No. 3', jenisSurat: 'Surat Pengantar Kartu Keluarga (KK)', keperluan: 'Penambahan anggota keluarga', status: 'Selesai', noSurat: '474/017-RT/RW.06/X/2026', catatan: 'Selesai, data lama', tanggalSelesai: '2026-10-16', arsip: 'Ya' }, iso(55), 'SRT-261014-FFFF'),
      ],
      Lapor_Aspirasi: [
        buildRow('Lapor_Aspirasi', { noPengaduan: 'ADU/2026-001', nama: 'Budi Santoso', noHp: '081234567890', alamat: 'Jl. Merdeka No. 1', jenisPengaduan: '🗑️ Sampah', judul: 'Tumpukan sampah di depan rumah', detail: 'Sampah menumpuk di depan rumah sudah 3 hari dan menimbulkan bau.', lokasi: 'Jl. Merdeka No. 1', tanggalKejadian: '2026-10-13', foto: '', harapan: 'Diangkut rutin', status: 'Selesai', petugas: 'Pak RT', catatanTindakLanjut: 'Sudah diangkut petugas kebersihan', tanggalPenyelesaian: '2026-10-14' }, '2026-10-13T02:00:00.000Z', 'ADU-261013-0001'),
        buildRow('Lapor_Aspirasi', { noPengaduan: 'ADU/2026-002', nama: 'Siti Aminah', noHp: '081298765432', alamat: 'Jl. Merdeka No. 1', jenisPengaduan: '💡 Penerangan Jalan', judul: 'Lampu jalan depan gang mati', detail: 'Lampu PJU di depan gang 3 mati sejak 3 hari lalu sehingga jalan menjadi gelap.', lokasi: 'Depan gang 3', tanggalKejadian: '2026-10-13', foto: '', harapan: 'Mohon segera diperbaiki', status: 'Diproses', petugas: 'Pak RT', catatanTindakLanjut: 'Sudah dilaporkan ke kelurahan', tanggalPenyelesaian: '' }, '2026-10-14T03:00:00.000Z', 'ADU-261014-0002'),
        buildRow('Lapor_Aspirasi', { noPengaduan: 'ADU/2026-003', nama: 'Joko Prasetyo', noHp: '081399900001', alamat: 'Jl. Melati No. 12', jenisPengaduan: '🚰 Saluran Air / Drainase', judul: 'Drainase tersumbat', detail: 'Saluran air di depan rumah tersumbat sampah sehingga air menggenang saat hujan.', lokasi: 'Jl. Melati', tanggalKejadian: '2026-10-12', foto: 'https://drive.google.com/uc?export=view&id=CONTOHFOTO001', harapan: 'Dibersihkan berkala', status: 'Selesai', petugas: 'Bu Sekretaris', catatanTindakLanjut: 'Sudah dibersihkan saat kerja bakti', tanggalPenyelesaian: '2026-10-14' }, '2026-10-14T04:00:00.000Z', 'ADU-261014-0003'),
        buildRow('Lapor_Aspirasi', { noPengaduan: 'ADU/2026-004', nama: 'Sari Dewi', noHp: '081311122233', alamat: 'Jl. Kenanga No. 9', jenisPengaduan: '🔊 Ketertiban / Kebisingan', judul: 'Kebisingan malam hari', detail: 'Kegiatan musik hingga larut malam mengganggu istirahat warga sekitar.', lokasi: 'Jl. Kenanga', tanggalKejadian: '2026-10-14', foto: '', harapan: 'Ditertibkan', status: 'Diproses', petugas: 'Pak RT', catatanTindakLanjut: 'Sudah ditegur', tanggalPenyelesaian: '' }, '2026-10-15T01:30:00.000Z', 'ADU-261015-0004'),
        buildRow('Lapor_Aspirasi', { noPengaduan: 'ADU/2026-005', nama: 'Ahmad Fauzi', noHp: '081344455566', alamat: 'Jl. Anggrek No. 3', jenisPengaduan: '🗑️ Sampah', judul: 'Tumpukan sampah di ujung gang', detail: 'Sampah menumpuk di ujung gang sejak 2 hari dan menimbulkan bau.', lokasi: 'Ujung gang Anggrek', tanggalKejadian: '2026-10-14', foto: '', harapan: 'Diangkut rutin', status: 'Diterima', petugas: '', catatanTindakLanjut: '', tanggalPenyelesaian: '' }, '2026-10-15T02:15:00.000Z', 'ADU-261015-0005'),
        buildRow('Lapor_Aspirasi', { noPengaduan: 'ADU/2026-006', nama: 'Putri Handayani', noHp: '081344455567', alamat: 'Jl. Anggrek No. 3', jenisPengaduan: '💬 Aspirasi / Saran', judul: 'Usul jadwal ronda', detail: 'Mengusulkan penambahan jadwal ronda malam untuk keamanan lingkungan.', lokasi: '', tanggalKejadian: '2026-10-10', foto: '', harapan: '', status: 'Selesai', petugas: 'Pak RT', catatanTindakLanjut: 'Telah dibahas pengurus', tanggalPenyelesaian: '2026-10-11', arsip: 'Ya' }, '2026-10-11T05:00:00.000Z', 'ADU-261011-0006'),
      ],
      Lapor_Tindak_Lanjut: [],
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
    if (!Array.isArray(parsed.sheets.Lapor_Tindak_Lanjut)) parsed.sheets.Lapor_Tindak_Lanjut = [];
    if (typeof parsed.portalEnabled !== 'boolean') parsed.portalEnabled = true;
    if (typeof parsed.laporEnabled !== 'boolean') parsed.laporEnabled = true;
    if (typeof parsed.suratEnabled !== 'boolean') parsed.suratEnabled = true;
    if (typeof parsed.adminEmail !== 'string') parsed.adminEmail = '';
    if (!isFinite(Number(parsed.saldoAwal)) || Number(parsed.saldoAwal) < 0) parsed.saldoAwal = 0;
    else parsed.saldoAwal = Math.round(Number(parsed.saldoAwal));
    // Migrasi lokal: Iuran_Kas lama belum punya kolom "Reversal Dari".
    // Lama : [ts, tanggal, nama, noRumah, jenis, jumlah, keterangan, arsip, ID]
    // Baru : [..., arsip, reversalDari, ID]
    (parsed.sheets.Iuran_Kas || []).forEach((row) => {
      if (Array.isArray(row) && row.length === 9) row.splice(8, 0, '');
    });
    // Migrasi lokal: Pengajuan_Surat lama belum punya kolom "Tanggal Selesai".
    // Lama : [ts, ..., catatan, arsip, ID]
    // Baru : [ts, ..., catatan, tanggalSelesai, arsip, ID]
    (parsed.sheets.Pengajuan_Surat || []).forEach((row) => {
      if (Array.isArray(row) && row.length === 12) row.splice(10, 0, '');
    });
    // Migrasi lokal: kolom alur RW (v35) disisipkan sebelum kolom bantu ID.
    (parsed.sheets.Pengajuan_Surat || []).forEach((row) => {
      if (Array.isArray(row) && row.length === 13) {
        row.splice(12, 0, 'Tidak Perlu', '', '', '', 0, 1, '');
      }
    });
    (parsed.sheets.Lapor_Aspirasi || []).forEach((row) => {
      if (Array.isArray(row) && row.length === 18) {
        row.splice(17, 0, 'Tidak Perlu', '', '', '');
      }
    });
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
  return { result: 'success', version: CODE_VERSION, portalEnabled: store.portalEnabled !== false, laporEnabled: store.laporEnabled !== false, suratEnabled: store.suratEnabled !== false, adminEmail: store.adminEmail || '', saldoAwal: Number(store.saldoAwal) || 0, data };
}

function readPublicSheets() {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  const data = { Pengumuman: [], Kegiatan_Warga: [] };
  const idx = { Pengumuman: 6, Kegiatan_Warga: 7 };
  ['Pengumuman', 'Kegiatan_Warga'].forEach((name) => {
    // Portal publik hanya membaca dua sheet ini; jangan menyentuh data privat.
    data[name] = (store.sheets[name] || []).filter((row) => isPublik(row[idx[name]])).map((row) => row.slice());
  });
  return { result: 'success', version: CODE_VERSION, portalEnabled: true, laporEnabled: store.laporEnabled !== false, suratEnabled: store.suratEnabled !== false, data };
}

function handleCheckSuratDuplicate(params) {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  if (store.suratEnabled === false) return suratDisabled();

  const nik = cleanStr(params.nik, 40).replace(/\D/g, '');
  const hpRaw = params.hp !== undefined && params.hp !== null ? params.hp : params.noHp;
  const hp = cleanStr(hpRaw, 30).replace(/\D/g, '');
  const jenisSurat = cleanStr(params.jenisSurat, 120);
  if (!/^\d{16}$/.test(nik) || hp.length < 9) {
    return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Masukkan NIK (16 digit) dan No. HP/WhatsApp yang valid.' };
  }
  if (!jenisSurat) return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Pilih jenis surat terlebih dahulu.' };

  const hpNorm = normalizeSuratHp(hp);
  const jenisKey = jenisSurat.toLowerCase();
  const rows = store.sheets.Pengajuan_Surat || [];
  const results = [];
  let total = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (isArsip(row[11])) continue;
    const rNik = String(row[2] === undefined || row[2] === null ? '' : row[2]).replace(/\D/g, '');
    if (rNik !== nik) continue;
    if (normalizeSuratHp(String(row[3] === undefined || row[3] === null ? '' : row[3])) !== hpNorm) continue;
    if (cleanStr(row[5], 120).toLowerCase() !== jenisKey) continue;
    total++;
    results.push({ tanggal: displayTimestamp(row[0]), keperluan: cleanStr(row[6], 800) });
  }
  results.reverse();
  return { result: 'success', version: CODE_VERSION, count: total, data: results.slice(0, 5) };
}

function handleLookupWarga(params) {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  if (store.suratEnabled === false) return suratDisabled();
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

function normalizeSuratRef(value) {
  return cleanStr(value, 60).replace(/[\s\u2010-\u2015\u2212]+/g, '').toUpperCase();
}

function sanitizeSuratRef(value) {
  const s = normalizeSuratRef(value);
  return /^[A-Z0-9-]{6,40}$/.test(s) ? s : null;
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
  if (store.suratEnabled === false) return suratDisabled();

  const ref = normalizeSuratRef(params.ref);
  const byRef = !!ref;
  let nik = '';
  let hpNorm = '';
  if (byRef) {
    if (!/^[A-Z0-9-]{6,40}$/.test(ref)) {
      return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Masukkan No. Pengajuan yang valid.' };
    }
  } else {
    nik = cleanStr(params.nik, 40).replace(/\D/g, '');
    const hpRaw = params.hp !== undefined && params.hp !== null ? params.hp : params.noHp;
    const hp = cleanStr(hpRaw, 30).replace(/\D/g, '');
    if (!/^\d{16}$/.test(nik) || hp.length < 9) {
      return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Masukkan NIK (16 digit) dan No. HP/WhatsApp yang valid.' };
    }
    hpNorm = normalizeSuratHp(hp);
  }

  const rows = store.sheets.Pengajuan_Surat || [];
  const results = [];
  let archivedCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawRowRef = row[row.length - 1];
    const rowRef = normalizeSuratRef(rawRowRef);
    const matches = byRef
      ? (rowRef === ref)
      : (String(row[2] === undefined || row[2] === null ? '' : row[2]).replace(/\D/g, '') === nik &&
         normalizeSuratHp(String(row[3] === undefined || row[3] === null ? '' : row[3])) === hpNorm);
    if (matches) {
      if (isArsip(row[11])) { archivedCount++; continue; } // pengajuan diarsipkan tidak dapat diambil publik
      results.push({
        ref: rowRef,
        tanggal: displayTimestamp(row[0]),
        jenisSurat: cleanStr(row[5], 120),
        status: cleanStr(row[7], 20) || 'Pending',
        noSurat: cleanStr(row[8], 100),
        catatan: cleanStr(row[9], 500),
        revisi: intAtLeast(row[16], 0),
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

function laporDisabled() {
  return { result: 'error', code: 'lapor_disabled', version: CODE_VERSION, message: 'Fitur Lapor & Aspirasi sedang dinonaktifkan oleh admin.' };
}

function suratDisabled() {
  return { result: 'error', code: 'surat_disabled', version: CODE_VERSION, message: 'Fitur Layanan Surat sedang dinonaktifkan oleh admin.' };
}

function handleLookupWargaHp(params) {
  if (store.portalEnabled === false) return portalDisabled();
  if (store.laporEnabled === false) return laporDisabled();
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

function handleCheckLaporDuplicate(params) {
  if (store.portalEnabled === false) {
    return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
  }
  if (store.laporEnabled === false) return laporDisabled();

  const hpDigits = cleanStr(params.hp !== undefined && params.hp !== null ? params.hp : params.noHp, 30).replace(/\D/g, '');
  const jenis = cleanStr(params.jenisPengaduan, 120);
  if (hpDigits.length < 9 || hpDigits.length > 15) {
    return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Nomor WhatsApp tidak valid.' };
  }
  if (!jenis) return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Pilih jenis pengaduan terlebih dahulu.' };

  const hpNorm = normalizeSuratHp(hpDigits);
  const jenisKey = jenis.toLowerCase();
  const today = jakartaDateToday();
  const rows = store.sheets.Lapor_Aspirasi || [];
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (jakartaDateOf(row[0]) !== today) continue;
    if (normalizeSuratHp(String(row[3] === undefined || row[3] === null ? '' : row[3])) !== hpNorm) continue;
    if (cleanStr(row[5], 120).toLowerCase() !== jenisKey) continue;
    count++;
  }
  return { result: 'success', version: CODE_VERSION, count };
}

function handleCheckLapor(params) {
  if (store.portalEnabled === false) return portalDisabled();
  if (store.laporEnabled === false) return laporDisabled();
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

// ================= Handler RW 06 =================
const SURAT_RW = { STATUS: 12, CATATAN: 13, OLEH: 14, TANGGAL: 15, REVISI: 16, VERSI: 17, KUNCI: 18, ID: 19 };
const LAPOR_RW = { STATUS: 17, PETUGAS: 18, DIPERBARUI: 19, KUNCI: 20, ID: 21 };

function rwError(code, message) {
  return { result: 'error', code, version: CODE_VERSION, message };
}

function suratRwSnapshot(row) {
  return {
    id: String(blank(row[SURAT_RW.ID])),
    rwStatus: normalizeSuratRwStatus(row[SURAT_RW.STATUS], 'Tidak Perlu'),
    rwCatatan: cleanStr(row[SURAT_RW.CATATAN], 1000),
    rwOleh: cleanStr(row[SURAT_RW.OLEH], 200),
    rwTanggal: blank(row[SURAT_RW.TANGGAL]),
    rwRevisi: intAtLeast(row[SURAT_RW.REVISI], 0),
    rwVersi: intAtLeast(row[SURAT_RW.VERSI], 1),
  };
}

function laporRwSnapshot(row) {
  return {
    id: String(blank(row[LAPOR_RW.ID])),
    rwStatus: normalizeLaporRwStatus(row[LAPOR_RW.STATUS], 'Tidak Perlu'),
    rwPetugas: cleanStr(row[LAPOR_RW.PETUGAS], 100),
    rwDiperbarui: blank(row[LAPOR_RW.DIPERBARUI]),
  };
}

function handleRwRead(data) {
  const sheetName = cleanStr(data.sheet, 60);
  const allowed = Object.keys(DATA_FIELDS).concat(['Lapor_Tindak_Lanjut']);
  if (!allowed.includes(sheetName)) return rwError('invalid_sheet', 'Sheet tidak diizinkan untuk RW: ' + sheetName);
  const includeArchived = data.includeArchived === true || String(data.includeArchived) === 'true';
  const statusFilter = cleanStr(data.status, 40);
  const laporIdFilter = cleanStr(data.laporId, 60);
  let limit = (data.limit === undefined || data.limit === null || data.limit === '') ? 500 : intAtLeast(data.limit, 1);
  if (limit > 2000) limit = 2000;
  const offset = (data.offset === undefined || data.offset === null || data.offset === '') ? 0 : intAtLeast(data.offset, 0);

  let rows = (store.sheets[sheetName] || []).slice();
  rows = rows.filter((row) => {
    if (sheetName === 'Pengajuan_Surat' && !includeArchived && isArsip(row[11])) return false;
    if (sheetName === 'Lapor_Aspirasi' && !includeArchived && isArsip(row[16])) return false;
    if (statusFilter) {
      const st = sheetName === 'Pengajuan_Surat' ? row[SURAT_RW.STATUS]
        : sheetName === 'Lapor_Aspirasi' ? row[LAPOR_RW.STATUS] : '';
      if (String(blank(st)) !== statusFilter) return false;
    }
    if (laporIdFilter && sheetName === 'Lapor_Tindak_Lanjut' && String(blank(row[1])) !== laporIdFilter) return false;
    return true;
  });
  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const out = {
    result: 'success', version: CODE_VERSION, sheet: sheetName,
    headers: DATA_HEADERS[sheetName] || [], rows: page, total, offset, limit,
    truncated: offset + page.length < total,
  };
  if (sheetName === 'Iuran_Kas') out.saldoAwal = Number(store.saldoAwal) || 0;
  return out;
}

function handleRwSuratDecision(data) {
  const id = cleanStr(data.id, 60);
  const decision = cleanStr(data.decision, 30);
  const catatan = cleanStr(data.catatan, 1000);
  const aktor = cleanStr(data.aktor, 200);
  const kunci = cleanStr(data.kunci, 120);
  if (!id) return rwError('invalid', 'ID pengajuan wajib diisi.');
  if (!['Disetujui', 'Dikembalikan', 'Ditolak'].includes(decision)) return rwError('invalid_decision', 'Keputusan RW tidak dikenal.');
  if (decision !== 'Disetujui' && catatan.length < 3) return rwError('note_required', 'Catatan wajib diisi untuk keputusan ' + decision + '.');
  if (!aktor) return rwError('actor_required', 'Aktor (email/nama) RW wajib diisi.');
  if (kunci.length < 6) return rwError('idempotency_required', 'Kunci idempotensi wajib diisi (minimal 6 karakter).');
  const idx = findRowIndex('Pengajuan_Surat', id);
  if (idx === -1) return rwError('not_found', 'Pengajuan tidak ditemukan: ' + id);
  const row = store.sheets.Pengajuan_Surat[idx];
  const snap = suratRwSnapshot(row);
  if (kunci && String(blank(row[SURAT_RW.KUNCI])) === kunci) {
    return Object.assign({ result: 'success', version: CODE_VERSION, duplicate: true }, snap);
  }
  if (snap.rwStatus !== 'Menunggu') return rwError('not_pending', 'Pengajuan tidak dalam status Menunggu (saat ini: ' + snap.rwStatus + ').');
  if (data.expectedVersi !== undefined && data.expectedVersi !== null && data.expectedVersi !== '' &&
      Number(data.expectedVersi) !== snap.rwVersi) {
    return rwError('stale', 'Pengajuan sudah berubah sejak dibaca. Muat ulang data sebelum memutuskan.');
  }
  if (decision === 'Dikembalikan' && snap.rwRevisi >= SURAT_RW_MAX_REVISI) {
    return rwError('max_negative', 'Batas ' + SURAT_RW_MAX_REVISI + ' revisi sudah tercapai. Gunakan Setujui atau Tolak sebagai keputusan final.');
  }
  const stamp = nowIso();
  const finalReject = decision === 'Ditolak' && snap.rwRevisi >= SURAT_RW_MAX_REVISI;
  const newRevisi = (decision === 'Disetujui' || finalReject) ? snap.rwRevisi : snap.rwRevisi + 1;
  const newVersi = snap.rwVersi + 1;
  row[SURAT_RW.STATUS] = decision;
  row[SURAT_RW.CATATAN] = catatan;
  row[SURAT_RW.OLEH] = aktor;
  row[SURAT_RW.TANGGAL] = stamp;
  row[SURAT_RW.REVISI] = newRevisi;
  row[SURAT_RW.VERSI] = newVersi;
  row[SURAT_RW.KUNCI] = kunci;
  saveStore();
  return {
    result: 'success', version: CODE_VERSION, id,
    rwStatus: decision, rwCatatan: catatan, rwOleh: aktor, rwTanggal: stamp,
    rwRevisi: newRevisi, rwVersi: newVersi,
  };
}

function handleRwLaporNote(data) {
  const id = cleanStr(data.id, 60);
  const catatan = cleanStr(data.catatan, 1000);
  const aktor = cleanStr(data.aktor, 200);
  const kunci = cleanStr(data.kunci, 120);
  const visibilitas = cleanStr(data.visibilitas, 20) || 'Publik';
  const status = cleanStr(data.status, 40);
  if (!id) return rwError('invalid', 'ID pengaduan wajib diisi.');
  if (catatan.length < 3) return rwError('note_required', 'Catatan tindak lanjut wajib diisi (minimal 3 karakter).');
  if (!aktor) return rwError('actor_required', 'Aktor (email/nama) RW wajib diisi.');
  if (kunci.length < 6) return rwError('idempotency_required', 'Kunci idempotensi wajib diisi (minimal 6 karakter).');
  if (visibilitas !== 'Publik' && visibilitas !== 'Internal') return rwError('invalid_visibility', 'Visibilitas harus Publik atau Internal.');
  if (status && !['Ditangani RW', 'Selesai RW'].includes(status)) return rwError('invalid_status', 'Status RW harus Ditangani RW atau Selesai RW.');
  const idx = findRowIndex('Lapor_Aspirasi', id);
  if (idx === -1) return rwError('not_found', 'Pengaduan tidak ditemukan: ' + id);
  const row = store.sheets.Lapor_Aspirasi[idx];
  const snap = laporRwSnapshot(row);
  if (kunci && String(blank(row[LAPOR_RW.KUNCI])) === kunci) {
    return Object.assign({ result: 'success', version: CODE_VERSION, duplicate: true }, snap);
  }
  if (data.expectedDiperbarui !== undefined && data.expectedDiperbarui !== null && data.expectedDiperbarui !== '' &&
      String(data.expectedDiperbarui) !== String(snap.rwDiperbarui)) {
    return rwError('stale', 'Pengaduan sudah berubah sejak dibaca. Muat ulang data sebelum mengirim tanggapan.');
  }
  let newStatus = status || snap.rwStatus;
  if (!status && (snap.rwStatus === 'Tidak Perlu' || snap.rwStatus === 'Perlu Tindak Lanjut')) newStatus = 'Ditangani RW';
  const stamp = nowIso();
  row[LAPOR_RW.STATUS] = newStatus;
  row[LAPOR_RW.PETUGAS] = aktor;
  row[LAPOR_RW.DIPERBARUI] = stamp;
  row[LAPOR_RW.KUNCI] = kunci;
  if (visibilitas === 'Publik') row[14] = catatan;

  const timelineId = 'TL-' + jakartaYyMmDd(stamp) + '-' + randomCode4();
  if (!Array.isArray(store.sheets.Lapor_Tindak_Lanjut)) store.sheets.Lapor_Tindak_Lanjut = [];
  store.sheets.Lapor_Tindak_Lanjut.push([
    timelineId, id, store.rtId || '', aktor, 'RW', catatan, newStatus, visibilitas, stamp,
  ]);
  saveStore();
  return {
    result: 'success', version: CODE_VERSION, id, timelineId,
    rwStatus: newStatus, rwPetugas: aktor, rwDiperbarui: stamp, visibilitas,
  };
}

function handleLaporEscalate(data) {
  const id = cleanStr(data.id, 60);
  if (!id) return { result: 'error', code: 'invalid', message: 'ID pengaduan wajib diisi.' };
  const idx = findRowIndex('Lapor_Aspirasi', id);
  if (idx === -1) return { result: 'error', code: 'not_found', message: 'Pengaduan tidak ditemukan: ' + id };
  const row = store.sheets.Lapor_Aspirasi[idx];
  const cur = normalizeLaporRwStatus(row[LAPOR_RW.STATUS], 'Tidak Perlu');
  if (cur !== 'Tidak Perlu') return { result: 'success', id, rwStatus: cur, duplicate: true };
  const stamp = nowIso();
  row[LAPOR_RW.STATUS] = 'Perlu Tindak Lanjut';
  row[LAPOR_RW.DIPERBARUI] = stamp;
  saveStore();
  return { result: 'success', id, rwStatus: 'Perlu Tindak Lanjut', rwDiperbarui: stamp };
}

function handleResubmitSurat(data) {
  const id = cleanStr(data.id, 60);
  if (!id) return { result: 'error', code: 'invalid', message: 'ID pengajuan wajib diisi.' };
  const idx = findRowIndex('Pengajuan_Surat', id);
  if (idx === -1) return { result: 'error', code: 'not_found', message: 'Pengajuan tidak ditemukan: ' + id };
  const row = store.sheets.Pengajuan_Surat[idx];
  const cur = normalizeSuratRwStatus(row[SURAT_RW.STATUS], 'Tidak Perlu');
  const revisi = intAtLeast(row[SURAT_RW.REVISI], 0);
  const versi = intAtLeast(row[SURAT_RW.VERSI], 1);
  if (cur === 'Menunggu') return { result: 'success', id, rwStatus: 'Menunggu', duplicate: true };
  if (cur !== 'Dikembalikan' && cur !== 'Ditolak') {
    return { result: 'error', code: 'not_returned', message: 'Pengajuan tidak berstatus Dikembalikan/Ditolak (saat ini: ' + cur + ').' };
  }
  if (cur === 'Ditolak' && revisi >= SURAT_RW_MAX_REVISI) {
    return { result: 'error', code: 'max_negative', message: 'Pengajuan sudah ditolak final setelah ' + SURAT_RW_MAX_REVISI + ' revisi. Buat pengajuan baru bila masih diperlukan.' };
  }
  row[SURAT_RW.STATUS] = 'Menunggu';
  row[SURAT_RW.VERSI] = versi + 1;
  row[SURAT_RW.KUNCI] = '';
  saveStore();
  return { result: 'success', id, rwStatus: 'Menunggu', rwRevisi: revisi, rwVersi: versi + 1 };
}

function handleRwCheck() {
  return {
    result: 'success', version: CODE_VERSION, rtId: store.rtId || '',
    rwTokenConfigured: true, schemaMigrated: true,
    capabilities: ['rwRead', 'rwSuratDecision', 'rwLaporNote', 'rwCheck'],
    suratMaxRevisi: SURAT_RW_MAX_REVISI,
    sheets: Object.keys(DATA_FIELDS).concat(['Lapor_Tindak_Lanjut']),
  };
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

  if (data.action === 'rwCheck') return handleRwCheck();
  if (data.action === 'rwRead') return handleRwRead(data);
  if (data.action === 'rwSuratDecision') return handleRwSuratDecision(data);
  if (data.action === 'rwLaporNote') return handleRwLaporNote(data);
  if (data.action === 'laporEscalate') return handleLaporEscalate(data);
  if (data.action === 'resubmitSurat') return handleResubmitSurat(data);

  if (data.action === 'setPortalStatus') {
    store.portalEnabled = data.enabled === true || String(data.enabled) === 'true';
    saveStore();
    return { result: 'success', portalEnabled: store.portalEnabled };
  }

  if (data.action === 'setLaporStatus') {
    store.laporEnabled = data.enabled === true || String(data.enabled) === 'true';
    saveStore();
    return { result: 'success', laporEnabled: store.laporEnabled };
  }

  if (data.action === 'setSuratStatus') {
    store.suratEnabled = data.enabled === true || String(data.enabled) === 'true';
    saveStore();
    return { result: 'success', suratEnabled: store.suratEnabled };
  }

  if (data.action === 'setAdminEmail') {
    const email = cleanStr(data.email, 200);
    if (!email) return { result: 'error', code: 'invalid_email', message: 'Alamat email admin tidak boleh kosong.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { result: 'error', code: 'invalid_email', message: 'Format email tidak valid: ' + email };
    store.adminEmail = email;
    saveStore();
    return { result: 'success', adminEmail: email, message: 'Email admin disimpan: ' + email + '.' };
  }

  if (data.action === 'setSaldoAwal') {
    const n = Number(String(data.saldoAwal == null ? '' : data.saldoAwal).replace(/[^0-9.-]/g, ''));
    if (!isFinite(n) || n < 0) return { result: 'error', code: 'invalid', message: 'Saldo awal harus berupa angka >= 0.' };
    store.saldoAwal = Math.round(n);
    saveStore();
    return { result: 'success', saldoAwal: store.saldoAwal, message: 'Saldo awal disimpan.' };
  }

  if (data.action === 'submitSurat') {
    if (store.portalEnabled === false) {
      return { result: 'error', code: 'portal_disabled', version: CODE_VERSION, message: 'Portal publik sedang dinonaktifkan oleh admin.' };
    }
    if (store.suratEnabled === false) return suratDisabled();
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
    let id = sanitizeSuratRef(data.ref);
    if (!id || findRowIndex('Pengajuan_Surat', id) !== -1) id = makeSuratId(ts);
    const row = buildRow('Pengajuan_Surat', { nama, nik, noHp, alamat, jenisSurat, keperluan, status: 'Pending', noSurat: '', catatan: '', rwStatus: 'Menunggu', rwRevisi: 0, rwVersi: 1 }, ts, id);
    store.sheets.Pengajuan_Surat.push(row);
    saveStore();
    console.log('[mock] submitSurat tercatat:', id);
    return { result: 'success', id, message: 'Pengajuan surat berhasil dikirim.' };
  }

  if (data.action === 'submitLapor') {
    if (store.portalEnabled === false) return portalDisabled();
    if (store.laporEnabled === false) return laporDisabled();
    if (cleanStr(data.website, 100)) return { result: 'success', noPengaduan: 'ok', fotoSaved: true, message: 'Laporan terkirim.' };
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
    if (tglKejadian && tglKejadian > jakartaDateToday()) {
      return { result: 'error', code: 'invalid', version: CODE_VERSION, message: 'Tanggal Kejadian tidak boleh melebihi hari ini. Periksa kembali tanggal.' };
    }
    const ts = nowIso();
    const noPengaduan = makeNomorPengaduan();
    const id = 'ADU-' + jakartaYyMmDd(ts) + '-' + randomCode4();
    const adaFoto = !!(data.foto && typeof data.foto === 'string' && data.foto);
    const row = buildRow('Lapor_Aspirasi', {
      noPengaduan, nama: warga.nama, noHp: warga.noHp || hpDigits, alamat: warga.alamat,
      jenisPengaduan: jenis, judul, detail,
      lokasi: cleanStr(data.lokasi, 200), tanggalKejadian: tglKejadian,
      foto: adaFoto ? '(mock) foto tersimpan' : '', harapan: cleanStr(data.harapan, 1000),
      status: 'Diterima', petugas: '', catatanTindakLanjut: '', tanggalPenyelesaian: '', arsip: 'Tidak',
      rwStatus: 'Tidak Perlu',
    }, ts, id);
    store.sheets.Lapor_Aspirasi.push(row);
    saveStore();
    console.log('[mock] submitLapor tercatat:', noPengaduan);
    return { result: 'success', noPengaduan, id, fotoSaved: true, message: 'Laporan berhasil dikirim.' };
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
    if (sheetName === 'Pengajuan_Surat') {
      data.rwStatus = normalizeSuratRwStatus(existing[SURAT_RW.STATUS], 'Tidak Perlu');
      data.rwCatatan = existing[SURAT_RW.CATATAN] || '';
      data.rwOleh = existing[SURAT_RW.OLEH] || '';
      data.rwTanggal = existing[SURAT_RW.TANGGAL] || '';
      data.rwRevisi = intAtLeast(existing[SURAT_RW.REVISI], 0);
      data.rwVersi = intAtLeast(existing[SURAT_RW.VERSI], 1);
      data.rwKunci = existing[SURAT_RW.KUNCI] || '';
      const contentChanged = ['nama', 'nik', 'noHp', 'alamat', 'jenisSurat', 'keperluan'].some((key, i) => {
        const inc = data[key] === undefined || data[key] === null ? '' : String(data[key]);
        const cur = existing[i + 1] === undefined || existing[i + 1] === null ? '' : String(existing[i + 1]);
        return inc !== cur;
      });
      if (contentChanged) {
        data.rwVersi += 1;
        if (data.rwStatus === 'Disetujui') { data.rwStatus = 'Menunggu'; data.rwKunci = ''; }
      }
      const rw = normalizeSuratRwStatus(data.rwStatus, 'Tidak Perlu');
      const status = data.status || 'Pending';
      const noSurat = cleanStr(data.noSurat, 100);
      if (rw !== 'Disetujui' && rw !== 'Tidak Perlu') {
        if (noSurat) return { result: 'error', code: 'invalid', message: 'No. Surat hanya dapat diisi setelah RW menyetujui pengajuan.' };
        if (status === 'Selesai') return { result: 'error', code: 'invalid', message: 'Status Selesai hanya dapat diatur setelah RW menyetujui pengajuan.' };
      }
      if (status === 'Selesai' && !noSurat) {
        return { result: 'error', code: 'invalid', message: 'No. Surat resmi wajib diisi sebelum menandai status Selesai.' };
      }
    } else if (sheetName === 'Lapor_Aspirasi') {
      data.rwStatus = normalizeLaporRwStatus(existing[LAPOR_RW.STATUS], 'Tidak Perlu');
      data.rwPetugas = existing[LAPOR_RW.PETUGAS] || '';
      data.rwDiperbarui = existing[LAPOR_RW.DIPERBARUI] || '';
      data.rwKunci = existing[LAPOR_RW.KUNCI] || '';
    }
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
  if (sheetName === 'Pengajuan_Surat' || sheetName === 'Lapor_Aspirasi') {
    data.rwStatus = sheetName === 'Pengajuan_Surat' ? 'Menunggu' : 'Tidak Perlu';
    if (sheetName === 'Pengajuan_Surat') {
      const status = data.status || 'Pending';
      const noSurat = cleanStr(data.noSurat, 100);
      if (noSurat) return { result: 'error', code: 'invalid', message: 'No. Surat hanya dapat diisi setelah RW menyetujui pengajuan.' };
      if (status === 'Selesai') return { result: 'error', code: 'invalid', message: 'Status Selesai hanya dapat diatur setelah RW menyetujui pengajuan.' };
    }
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
    else if (params.action === 'checkSuratDuplicate') payload = handleCheckSuratDuplicate(params);
    else if (params.action === 'lookupWarga') payload = handleLookupWarga(params);
    else if (params.action === 'lookupWargaHp') payload = handleLookupWargaHp(params);
    else if (params.action === 'checkLapor') payload = handleCheckLapor(params);
    else if (params.action === 'checkLaporDuplicate') payload = handleCheckLaporDuplicate(params);
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
