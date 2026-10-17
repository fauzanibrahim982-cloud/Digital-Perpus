# Digital Perpus — Upgrade V2

Paket ini meneruskan website Digital Perpus yang sudah ada. File SQL `supabase_setup.sql` asli disertakan untuk referensi saja; **jangan jalankan ulang file setup lama** pada database yang sudah dipakai.

## Fitur yang ditambahkan
- Tema hitam premium.
- Pembaca PDF dengan tombol halaman sebelumnya/berikutnya.
- Jual buku opsional dan harga dalam Rupiah.
- QRIS penjual di Profil, upload bukti pembayaran, dan persetujuan/penolakan oleh penjual.
- Akses buku berbayar dibuka setelah penjual menyetujui pembelian (butuh SQL upgrade).
- Rating 1–5 bintang dengan ulasan opsional, rata-rata rating, dan jumlah rating.
- Menu Perpus Member: buku sendiri, ulasan untuk buku sendiri, dan permintaan pembelian.
- Hapus buku milik sendiri.
- Foto profil, banner profil, dan sampul buku dari galeri HP.
- Pencarian global disembunyikan saat membuka Upload, Profil, Perpus Member, atau pembaca.
- Admin Panel aman untuk mengubah banner utama situs (akun admin harus didaftarkan di tabel `admin_users`).

## Sebelum memasang
1. Simpan salinan tiga file website lama: `index.html`, `style.css`, `script.js`.
2. Di Supabase, buat backup database dan pastikan file di Storage masih ada. Backup kode website saja tidak membackup akun, buku, atau file Storage.
3. Pastikan URL dan publishable/anon key di `script.js` sesuai proyek Supabase milikmu. Jangan pernah memakai `service_role` key di browser.
4. **Jalankan `supabase_upgrade_v2.sql` satu kali** di Supabase Dashboard → SQL Editor. Skrip ini bersifat tambahan (additive), tidak menghapus tabel akun/buku lama, dan mengganti kebijakan baca PDF supaya buku berbayar perlu persetujuan penjual.
5. Upload `index.html`, `style.css`, dan `script.js` ke root repositori GitHub Pages, lalu commit.
6. Untuk Admin Panel, buka Supabase → Authentication → Users, salin UUID akunmu, lalu jalankan query `insert into public.admin_users (user_id) values ('UUID_AKUNMU') on conflict do nothing;` di SQL Editor. Ganti UUID_AKUNMU dengan UUID asli.
7. Uji login, buku gratis lama, unggah buku baru gratis, unggah buku berbayar, unggah QRIS, kirim bukti dari akun pembeli kedua, setujui pembelian dari akun penjual, lalu uji akses baca.

## Catatan pembayaran
QRIS milik member tidak memproses atau memverifikasi pembayaran otomatis. Penjual wajib memeriksa transaksi di aplikasi penyedia pembayaran sebelum menekan Setujui. Jangan setujui hanya berdasarkan gambar bukti. Fitur ini adalah alur manual antar member, bukan escrow atau payment gateway.

## Catatan penting
- Buku lama akan dianggap gratis karena kolom baru `is_for_sale` default-nya `false`.
- Gambar disimpan di bucket publik `dp-assets`; QRIS dan sampul dapat dilihat orang yang mengakses profil/kartu buku.
- Bukti pembayaran disimpan di bucket privat `payment-proofs`.
- File PDF di bucket privat `book-pdfs`; kebijakan baca membatasi akses buku berbayar sampai status pembelian `approved`.
- Browser cache dapat menampilkan file lama beberapa saat. Coba buka URL di tab samaran atau muat ulang setelah GitHub Pages selesai deploy.
- Admin Panel hanya muncul setelah UUID akun dimasukkan ke `admin_users` melalui SQL. Jangan menambahkan akun admin dengan tombol publik atau hanya menyembunyikan tombol di HTML.
