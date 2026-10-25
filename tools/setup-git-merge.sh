#!/bin/sh
# Pasang merge driver Git agar config.js, version.json, dan sw.js
# mempertahankan nilai RT saat branch RT menerima merge dari main.
set -eu

cd "$(git rev-parse --show-toplevel)"
git config merge.keeprt.driver "node tools/merge-rt-files.js %O %A %B %L %P"
echo "Merge driver keeprt terpasang."
