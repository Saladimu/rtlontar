#!/usr/bin/env node
// Merge driver Git untuk berkas yang nilainya berbeda di setiap RT.
//
// Dipanggil oleh Git melalui .gitattributes:
//   config.js version.json sw.js merge=keeprt
//
// Perilaku:
// - config.js    : gabungkan perubahan generik dari branch sumber, lalu
//                  pertahankan nilai identitas RT yang memang berbeda dari base.
// - version.json : pertahankan nilai build RT per kunci; kunci baru tetap masuk.
// - sw.js        : gabungkan daftar shell dari branch sumber, pertahankan nama
//                  cache RT.
//
// Bila terjadi konflik yang tidak dapat diselesaikan otomatis, driver menulis
// hasil bertanda konflik dan keluar dengan kode 1 agar diselesaikan manual.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const basePath = process.argv[2];
const oursPath = process.argv[3];
const theirsPath = process.argv[4];
const targetPath = process.argv[6] || oursPath;
const name = path.basename(targetPath);

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(text) {
  fs.writeFileSync(oursPath, text);
}

function mergeText(ours, base, theirs) {
  const result = spawnSync('git', ['merge-file', '-p', ours, base, theirs], {
    encoding: 'utf8'
  });
  if (result.error) throw result.error;
  if (result.status === null || result.status < 0) {
    throw new Error(result.stderr || 'git merge-file gagal');
  }
  return { text: result.stdout, conflicts: result.status > 0 };
}

const CONFIG_FIELDS = [
  'version',
  'appVersion',
  'appName',
  'appLongName',
  'rt',
  'rw',
  'kelurahan',
  'kecamatan',
  'kota',
  'provinsi',
  'alamatrt',
  'alamatContoh',
  'lokasiContoh',
  'suratNoContoh',
  'publicApiUrl',
  'apiBase',
  'publicPortalUrl'
];

function fieldRegex(key) {
  return new RegExp("^(\\s*" + key + "\\s*:\\s*)(['\"])([^'\"\\n]*)\\2", 'm');
}

function readField(source, key) {
  const match = source.match(fieldRegex(key));
  if (!match) return null;
  return {
    value: match[3],
    literal: match[2] + match[3] + match[2]
  };
}

function overriddenConfigFields(ours, base) {
  const fields = [];
  for (const key of CONFIG_FIELDS) {
    const own = readField(ours, key);
    if (!own) continue;
    const original = readField(base, key);
    if (original && original.value === own.value) continue;
    fields.push({ key: key, literal: own.literal });
  }
  return fields;
}

function normalizeConfigFields(source, fields) {
  let out = source;
  for (const field of fields) {
    const regex = new RegExp("^(\\s*" + field.key + "\\s*:\\s*)(['\"])[^'\"\\n]*\\2", 'm');
    if (!regex.test(out)) continue;
    out = out.replace(regex, (match, prefix) => prefix + field.literal);
  }
  return out;
}

function preserveConfig(merged, fields) {
  let out = merged;
  let applied = 0;

  for (const field of fields) {
    const regex = new RegExp("^(\\s*" + field.key + "\\s*:\\s*)(['\"])[^'\"\\n]*\\2", 'm');
    if (!regex.test(out)) continue;
    out = out.replace(regex, (match, prefix) => prefix + field.literal);
    applied++;
  }

  if (applied !== fields.length) {
    throw new Error('gagal mempertahankan ' + (fields.length - applied) + ' nilai RT pada config.js');
  }
  return out;
}

function readCache(source) {
  const match = source.match(/(const CACHE\s*=\s*)(['"])([^'"]*)\2/);
  if (!match) return null;
  return { value: match[3], literal: match[2] + match[3] + match[2] };
}

function replaceCache(source, literal) {
  return source.replace(/(const CACHE\s*=\s*)(['"])[^'"]*\2/, (match, prefix) => prefix + literal);
}

function mergeServiceWorker(ours, base, theirs) {
  const ownCache = readCache(ours);
  const baseCache = readCache(base);
  if (!ownCache || !baseCache || ownCache.value === baseCache.value) {
    return mergeText(oursPath, basePath, theirsPath);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sapa-rt-merge-'));
  const tempBase = path.join(tempDir, 'base.js');
  const tempTheirs = path.join(tempDir, 'theirs.js');
  fs.writeFileSync(tempBase, replaceCache(base, ownCache.literal));
  fs.writeFileSync(tempTheirs, replaceCache(theirs, ownCache.literal));
  return mergeText(oursPath, tempBase, tempTheirs);
}

function mergeVersionJson(ours, base, theirs) {
  const own = JSON.parse(ours);
  const original = JSON.parse(base);
  const incoming = JSON.parse(theirs);
  const out = {};
  const keys = Object.keys(own).concat(Object.keys(incoming).filter((key) => !(key in own)));

  for (const key of keys) {
    if (key in own && (!(key in original) || own[key] !== original[key])) {
      out[key] = own[key];
    } else if (key in incoming) {
      out[key] = incoming[key];
    } else if (key in own) {
      out[key] = own[key];
    }
  }

  write(JSON.stringify(out, null, 2) + '\n');
}

try {
  const base = read(basePath);
  const ours = read(oursPath);
  const theirs = read(theirsPath);

  if (name === 'version.json') {
    mergeVersionJson(ours, base, theirs);
  } else if (name === 'sw.js') {
    const result = mergeServiceWorker(ours, base, theirs);
    write(result.text);
    if (result.conflicts) process.exit(1);
  } else if (name === 'config.js') {
    const fields = overriddenConfigFields(ours, base);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sapa-rt-merge-'));
    const tempBase = path.join(tempDir, 'base.js');
    const tempTheirs = path.join(tempDir, 'theirs.js');
    fs.writeFileSync(tempBase, normalizeConfigFields(base, fields));
    fs.writeFileSync(tempTheirs, normalizeConfigFields(theirs, fields));

    const result = mergeText(oursPath, tempBase, tempTheirs);
    if (result.conflicts) {
      write(result.text);
      process.exit(1);
    }
    write(preserveConfig(result.text, fields));
  } else {
    const result = mergeText(oursPath, basePath, theirsPath);
    write(result.text);
    if (result.conflicts) process.exit(1);
  }
} catch (err) {
  console.error('merge-rt-files: ' + ((err && err.message) || err));
  process.exit(1);
}
