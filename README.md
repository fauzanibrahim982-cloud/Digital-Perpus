# Digital Perpus — versi sungguhan

## Isi paket
- `index.html` — struktur website
- `style.css` — tampilan responsif
- `script.js` — Supabase Auth, database, pencarian, rating, favorit, upload dan baca PDF
- `supabase_setup.sql` — tabel, RLS policies, bucket Storage dan trigger profil
- `README.md` — panduan instalasi

## A. Buat proyek Supabase
1. Buka https://supabase.com/ lalu masuk/daftar.
2. Buat project baru dan simpan password database dengan aman.
3. Setelah project aktif, buka **SQL Editor > New query**.
4. Buka `supabase_setup.sql`, salin seluruh isinya, tempel ke SQL Editor, lalu tekan **Run**.
5. Buka **Project Settings > API** (atau bagian API Keys pada dashboard baru). Salin Project URL dan **publishable key** atau legacy `anon` key. Jangan pernah menggunakan `service_role`/secret key di browser.

## B. Isi konfigurasi JavaScript
1. Buka `script.js`.
2. Di bagian paling atas, ganti:
   - `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` dengan Project URL.
   - `PASTE_YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY_HERE` dengan publishable/anon key.
3. Simpan file. URL dan publishable/anon key memang digunakan di browser; keamanan bergantung pada RLS. Secret/service_role key tidak boleh ditaruh di sini.

## C. Pengaturan Auth
1. Dashboard Supabase > **Authentication > URL Configuration**.
2. Tambahkan alamat website yang dipakai ke **Site URL** dan **Redirect URLs**.
3. Untuk pengujian lokal, jalankan melalui local server, bukan hanya `file://`. Contoh dengan VS Code Live Server.
4. Supabase dapat meminta verifikasi email. Kalau pendaftaran berhasil tetapi belum bisa login, cek email verifikasi dan pengaturan SMTP/auth email di project.

## D. Tes lokal
- Taruh semua file dalam folder yang sama.
- Buka folder dengan VS Code dan jalankan `index.html` memakai Live Server, atau gunakan server lokal lain.
- Login/register, unggah PDF kecil (maksimal 10 MB), cek buku muncul, buka buku, beri rating, dan tambahkan favorit.
- Karena bucket private, file dibaca melalui signed URL sementara setelah login.

## E. Terbitkan dengan GitHub Pages
1. Buat repository GitHub baru.
2. Unggah `index.html`, `style.css`, `script.js`, dan `supabase_setup.sql` (SQL tidak wajib berada di root untuk website).
3. Buka **Settings > Pages**.
4. Pilih deploy from branch `main`, folder `/(root)`, lalu Save.
5. Setelah URL GitHub Pages tersedia, tambahkan URL itu ke Supabase Authentication URL Configuration.

## Catatan keamanan & batasan
- Jangan pernah menaruh `service_role` atau secret key di frontend.
- RLS di SQL membatasi perubahan profil, buku, favorit, dan rating menurut akun. File PDF disimpan di bucket private dan akses baca menggunakan signed URL singkat.
- Pengguna yang sudah login dapat membaca file PDF yang diizinkan oleh kebijakan Storage. Pembatasan ini bukan DRM; pengguna yang berhak membuka PDF mungkin masih dapat menyimpan salinan. Unggah hanya materi yang kamu miliki atau punya izin untuk dibagikan.
- Kode ini adalah fondasi awal, bukan hasil audit keamanan profesional. Sebelum dipakai publik, tambahkan moderasi laporan buku, pemeriksaan hak cipta, pembatasan spam/rate, kebijakan privasi, ketentuan layanan, backup, dan monitoring biaya.
- Daftar buku dibuat `is_approved=true` otomatis pada versi awal. Jika kamu ingin persetujuan admin sebelum buku tampil, ubah alur upload dan siapkan mekanisme admin.
- Tidak ada buku contoh palsu yang disisipkan: koleksi mulai kosong sampai pengguna mengunggah PDF.
