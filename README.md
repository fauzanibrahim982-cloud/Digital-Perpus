# Digital Perpus — Paket Perbaikan

## Isi paket
- `index.html`
- `style.css`
- `script.js`
- `supabase_setup.sql` (jika tersedia pada paket sumber)

## Memasang di GitHub Pages
1. Ekstrak ZIP ini.
2. Buka repositori GitHub yang menjadi sumber website.
3. Ganti tiga file utama dengan `index.html`, `style.css`, dan `script.js` dari ZIP ini. Pastikan namanya persis sama, bukan `index(8).html` atau `style(4).css`.
4. Klik Commit changes dan tunggu GitHub Pages selesai menerbitkan perubahan.
5. Buka website lalu lakukan hard refresh atau buka tab samaran. URL CSS/JS sudah diberi versi baru untuk menghindari cache lama.

## Supabase
Project URL dan publishable key yang kamu kirim sudah dimasukkan ke `script.js`. SQL setup tetap perlu dijalankan di SQL Editor Supabase. Jika masih muncul `Failed to fetch`, periksa status proyek Supabase, koneksi internet, dan Console/Network browser. Jangan masukkan `service_role` key ke kode website.
