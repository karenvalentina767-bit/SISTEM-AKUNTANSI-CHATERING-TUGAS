# Karsa — Sistem Akuntansi Penjualan & Booking Catering Event

Website catering + sistem akuntansi sederhana untuk usaha catering event.

- **Halaman utama (pembeli)** — `frontend/index.html`. Langsung terbuka saat website dibuka.
  Pembeli melihat paket dan **memesan tanpa login**. Siapa saja bisa memesan.
- **Dashboard pemilik** — `frontend/admin.html` (tombol **"Masuk pemilik"** di kanan atas halaman utama).
  Hanya untuk pemilik/karyawan. Pesanan dari pembeli masuk ke menu **Pesanan online**.

Sistem informasi operasional dan akuntansi sederhana untuk usaha catering event.
Aplikasi membantu mencatat customer, booking event, invoice (termasuk PPN 11%),
status pembayaran, serta menampilkan ringkasan pendapatan dan piutang.

## Struktur folder

```text
sistem-akuntansi-catering/
├── backend/
│   ├── app.js          # Supabase client, login & peran, PPN, semua query database
│   └── schema.sql      # Skema database + migrasi + aturan keamanan (RLS)
├── frontend/
│   ├── index.html      # HALAMAN PEMBELI: katalog + form pesan (tanpa login)
│   ├── admin.html      # DASHBOARD PEMILIK: login, booking, invoice, laporan
│   ├── css/style.css   # Tampilan dashboard (warna, huruf, tata letak, versi HP)
│   ├── css/beranda.css # Tampilan halaman pembeli
│   ├── js/
│   │   ├── pengaturan.js  # ← DATA USAHA: nama, alamat, rekening, jam buka, minimal pax
│   │   ├── catalog.js     # Katalog paket (harga jual, MODAL, minimal pax per paket)
│   │   ├── beranda.js     # Halaman pembeli: katalog, form pesan
│   │   ├── pesanan-online.js # Dashboard: daftar pesanan dari pembeli (Terima / Tolak)
│   │   ├── app.js         # Login, navigasi, ringkasan, form booking
│   │   ├── invoices.js    # Invoice, catat DP/cicilan/pelunasan, edit, hapus
│   │   ├── customers.js   # Customer baru vs lama, riwayat pemesanan
│   │   ├── tagihan.js     # Halaman pembeli: Cek tagihan, pengingat, lapor sudah bayar
│   │   ├── konfirmasi-bayar.js # Dashboard: verifikasi laporan bayar dari pembeli
│   │   ├── reports.js     # Laporan laba: pendapatan − modal per bulan (1 grafik)
│   │   ├── users.js       # Atur peran pengguna (khusus owner)
│   │   └── print.js       # Cetak invoice PDF
│   └── img/
├── index.html          # Mengarahkan otomatis ke frontend/index.html
└── README.md
```

## Menyiapkan Supabase

1. Buka project di Supabase → **SQL Editor**.
2. Copy seluruh isi `backend/schema.sql`, tempel, lalu klik **Run**.
   - Aman untuk database lama: data yang sudah ada **tidak dihapus**. Pesanan lama diberi
     nomor urut, status "Belum Lunas" menjadi "Belum Bayar", dan invoice "Lunas" lama
     dicatat sebagai satu transaksi pelunasan.
   - Aman dijalankan ulang.
   - **Sudah pernah menjalankan versi lama?** Jalankan ulang seluruh file ini sekali lagi supaya
     tabel & fungsi baru (pesanan online, harga paket, alur bayar cepat) ikut dibuat.
     Pesanan lama yang masih menunggu langsung bisa dibayar pembeli.
> **Login admin cepat (untuk penilaian):** email & password admin ditetapkan di `backend/app.js` (konstanta `AKUN_ADMIN`)
> dan ditampilkan di samping form login. Akun dibuat otomatis di Supabase saat pertama dipakai masuk,
> jadi tidak perlu Add user manual. Syaratnya: Supabase → Authentication → Providers → Email → matikan **Confirm email**.
> Bila tabel `profiles` sudah berisi akun lain, ubah peran akun admin menjadi `owner` lewat Table Editor.

3. **Buat akun pengguna**: Authentication → Users → **Add user** → isi email & password,
   centang *Auto Confirm User*.
   - Akun **pertama** otomatis menjadi **owner**.
   - Akun berikutnya otomatis **viewer**; owner mengubah perannya di menu **Pengguna**.
4. Disarankan: Authentication → Sign In / Providers → matikan **Allow new users to sign up**,
   supaya orang luar tidak bisa mendaftar sendiri.
5. Project Settings → API: salin **Project URL** dan **anon / publishable key**.

> Jangan pernah memakai `service_role key` di kode frontend.

## Memasukkan URL & key Supabase

Buka `backend/app.js`, lalu ubah dua baris paling atas:

```javascript
const SUPABASE_URL = "https://xxxx.supabase.co";
const SUPABASE_ANON_KEY = "isi-anon-atau-publishable-key";
```

## Mode simulasi payment gateway (bawaan, untuk demo / tugas kuliah)

`simulasiPembayaran: true` di `frontend/js/pengaturan.js` (sudah aktif).

```
PEMBELI                                   PEMILIK
───────                                   ───────
1. Pesan paket → tagihan langsung muncul
2. Klik "Bayar DP" / "Bayar lunas"
   → halaman bayar "KarsaPay" sesuai metode
     yang dipilih saat memesan (tanpa pilih ulang)
3. ±15 detik kemudian pembayaran otomatis
   diterima → status DP/Setengah/Lunas
   → tombol "Lihat invoice"    (tidak perlu klik apa pun:
                                           pesanan otomatis Diterima,
4. Pelunasan: buka website, klik           invoice & pembayaran tercatat
   "Bayar sisa", ulangi langkah 3          otomatis di dashboard)
```

- Tidak ada uang sungguhan. Pembayaran dianggap masuk otomatis ±15 detik setelah halaman bayar terbuka (`DETIK_OTOMATIS` di `frontend/js/tagihan.js`).
- Pembeli bisa membuka **invoice** sendiri (rincian paket, PPN, riwayat bayar, cap LUNAS) dari menu Cek tagihan, lalu cetak / simpan PDF.
- Pembayaran dicatat oleh fungsi database `bayar_simulasi()` (aturan DP 50%, tidak boleh lebih bayar, tetap berlaku).
  Di sistem sungguhan, pencatatan ini dilakukan oleh **webhook** payment gateway (Midtrans/Xendit), bukan oleh browser.
- Menu **Konfirmasi bayar** di dashboard otomatis disembunyikan karena tidak dipakai.
- Owner hanya perlu bertindak untuk **paket custom** (isi harga per pax lalu Terima) atau pembayaran **tunai** di tempat
  (catat di **Invoice → Bayar**).
- Ubah ke `false` untuk kembali ke mode manual di bawah (pembeli lapor "Saya sudah bayar", owner verifikasi).

## Mode manual (simulasiPembayaran: false)

### Alur lengkap (versi simpel)

Setiap pesanan punya **kode sendiri** (`WEB-0001`, `WEB-0002`, …) dan **tagihan sendiri**.

```
PEMBELI (website, tanpa login)            PEMILIK (Masuk pemilik → dashboard)
──────────────────────────────            ───────────────────────────────────
1. Pesan paket katalog
   → tagihan LANGSUNG muncul
     (nominal DP/lunas + rekening)
2. Transfer, lalu tekan 1 tombol
   "Saya sudah bayar DP Rp …"
   (tanpa isi form, tanpa kirim bukti)
                                          3. Cek mutasi → klik 1 tombol
                                             "Verifikasi" / "Uang sudah masuk"
                                             → pesanan diterima + invoice dibuat
                                               + DP tercatat, SEKALIGUS
4. Pelunasan: buka website lagi
   → tagihan otomatis tampil (tersimpan
     di browser) → 1 tombol "Saya sudah
     bayar sisa"                          5. Klik "Verifikasi" → Lunas
```

Dibanding versi sebelumnya, pembeli **tidak perlu menunggu admin** untuk bisa membayar,
dan pemilik **tidak perlu membuka form booking** untuk menerima pesanan.

- **Paket custom** (harga belum pasti): pemilik mengisi **Rp/pax** langsung di kartu pesanan
  lalu klik **Terima**. Tagihan langsung muncul di halaman pembeli.
- **Bayar tunai / kartu** di tempat: pemilik klik **Terima** (1 klik), lalu catat uangnya di **Invoice → Bayar**.
- **Tidak bisa melayani** (tanggal penuh, dll.): klik **Tolak**. Laporan bayar yang menunggu ikut ditolak;
  kembalikan uang pembeli bila sudah masuk.
- Masih bisa mengubah detail sebelum menerima: link **Ubah detail dulu (form lengkap)** di kartu pesanan.

**Harga paket di database**: supaya pembeli bisa langsung bayar, harga & minimal pax paket disimpan juga di
tabel `paket_harga`. Tidak perlu diubah manual: **setiap owner login ke dashboard, harga dari
`frontend/js/catalog.js` otomatis disalin** ke database. Jadi setelah mengubah harga di `catalog.js`,
cukup login sebagai owner sekali.

### Aturan bayar

| Aturan | Isi |
|---|---|
| Pembayaran awal | **Wajib DP minimal 50%**, atau boleh langsung **lunas** |
| Batas pelunasan | **H-1**: wajib lunas paling lambat sehari sebelum tanggal acara |
| Bila terlambat | Status **Terlambat** (merah) + pengingat di website pembeli dan di Ringkasan pemilik |
| | Pembeli **tidak bisa membuat pesanan baru** sampai tagihan yang terlambat dilunasi |
| | Pembeli yang **pernah telat** wajib **bayar lunas di awal** untuk pesanan berikutnya |

Rekening, nomor e-wallet, dan gambar QRIS (opsional) diatur di `frontend/js/pengaturan.js` (`usaha.rekening`, `usaha.ewallet`, `usaha.qris`).
Angka DP dan H-1 diatur di `frontend/js/pengaturan.js` (`dpMinimalPersen`, `hariLunasSebelumAcara`).
Jika H-1 diubah, ubah juga angka `-1` di fungsi `kirim_pesanan` pada `backend/schema.sql`.
Jika DP diubah, ubah juga angka `0.5` di fungsi `lapor_bayar` pada `backend/schema.sql`.
Semua aturan di atas dijaga oleh database, jadi tidak bisa diakali lewat tampilan.

**Melunasi sebelum jatuh tempo**: pembeli kapan saja bisa membuka **Cek tagihan** dan menekan
**Saya sudah bayar sisa**. Untuk jumlah atau tanggal lain, ada link **Bayar jumlah lain / tanggal lain?**.

**Pengingat jatuh tempo** (tanpa WhatsApp, gratis):
- **Untuk pembeli**: kode + HP yang pernah dicek disimpan di browser pembeli. Saat website dibuka lagi
  dan jatuh tempo tinggal ≤ 3 hari (atau sudah lewat), muncul **bar pengingat** di atas halaman.
  Di halaman Cek tagihan juga selalu tampil "Jatuh tempo X hari lagi".
- **Untuk pemilik**: **Ringkasan → Pengingat jatuh tempo** menampilkan siapa saja yang tagihannya dekat
  atau lewat jatuh tempo, lengkap dengan tombol **Telepon**.
- Pembayaran tunai yang diterima langsung bisa dicatat sendiri oleh pemilik di menu **Invoice → Bayar**.

**Keamanan**: pembeli hanya bisa melihat tagihannya sendiri (kode **dan** nomor HP harus cocok),
hanya bisa mengirim pesanan dan laporan bayar, dan tidak bisa membaca data lain.
Laporan bayar baru dihitung setelah **diverifikasi** pemilik, dan tidak boleh melebihi sisa tagihan.

## Data usaha

Ubah `frontend/js/pengaturan.js`: nama usaha, alamat, telepon, jam buka, **rekening**,
minimal pax untuk paket custom, dan berapa hari sebelum jatuh tempo pengingat muncul.

## Menjalankan di laptop

Jalankan dari **root folder** ini (bukan dengan double-click `file://`).

**VS Code Live Server** — klik kanan `index.html` di root → *Open with Live Server*.

**Python:**

```bash
python -m http.server 5500
```

Buka `http://localhost:5500`.

**Node.js:**

```bash
npx serve .
```

## Muncul "Failed to fetch" saat login atau kirim pesanan?

Artinya browser **tidak bisa menghubungi Supabase** (bukan password salah). Periksa:

1. Buka dashboard Supabase. Project free akan **di-pause** bila lama tidak dipakai → klik **Restore**.
2. Pastikan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `backend/app.js` berasal dari project **Anda sendiri**
   (Project Settings → API).
3. Periksa koneksi internet.

Kalau password salah, pesannya adalah "Email atau password salah."

## Deploy ke GitHub Pages

1. Push semua isi folder ini ke repo GitHub (branch `main`).
2. Buka **Settings → Pages**.
3. Pilih **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Simpan, lalu tunggu beberapa menit sampai link demo aktif.

`index.html` di root akan otomatis membuka halaman pembeli (`frontend/index.html`).
Dashboard pemilik ada di `…/frontend/admin.html`.

## Fitur

**Peran pengguna** (ditegakkan oleh database lewat Row Level Security, bukan hanya disembunyikan di tampilan)

| Peran  | Lihat | Input & ubah | Hapus data | Atur peran |
|--------|:-----:|:------------:|:----------:|:----------:|
| Owner  | ✓ | ✓ | ✓ | ✓ |
| Admin  | ✓ | ✓ | – | – |
| Viewer | ✓ | – | – | – |

Setiap pesanan dan pembayaran mencatat **siapa yang menginput** beserta perannya.

**Booking & pesanan**
- Nomor pesanan **urut per tahun**: `ORD-2026-0001`, `ORD-2026-0002`, … dan invoice ikut: `INV-2026-0001`.
  Dibuat di database dalam satu transaksi, jadi tidak bisa dobel.
- **Metode pembayaran** per pesanan: Transfer Bank, Tunai, QRIS, E-Wallet, Kartu Debit/Kredit.
- **Minimal pemesanan**: tiap paket katalog punya minimal pax; paket custom memakai `minimalPaxCustom`.
- **Customer lama dikenali dari nomor HP** (format 0812…, +62 812…, 62812… dianggap sama).

**Pembayaran**
- Status otomatis dari jumlah yang sudah dibayar: **Belum Bayar** (0) → **DP** (< 50%) →
  **Setengah** (50% s/d < 100%) → **Lunas** (100%).
- Catat DP, cicilan, dan pelunasan; riwayat pembayaran lengkap per invoice.
- Pembayaran yang melebihi sisa tagihan ditolak database.

**Lainnya**
- **Pengingat jatuh tempo** di Ringkasan: daftar invoice yang jatuh tempo dalam beberapa hari atau sudah lewat.
- **Cetak invoice PDF**: tombol *PDF* → pilih *Simpan sebagai PDF* di dialog cetak.
- **Pelanggan**: customer baru vs lama (repeat order), total belanja, sisa tagihan, dan **riwayat pemesanan**.
- **Laporan laba**: satu grafik laba yang bisa dilihat **per hari (Senin–Minggu)**, **per tanggal (sebulan)**,
  atau **per bulan (setahun)**, dengan tombol panah untuk pindah periode. Ada tabel rincian. Bisa dicetak.
  Laba = pendapatan − modal. **Modal per pax** diatur sekali per paket di `frontend/js/catalog.js`
  (kolom `modal`); paket custom memakai `persenModalCustom` di `pengaturan.js` (bawaan 65% dari harga jual).
  Tagihan yang belum dibayar dipantau di **Ringkasan** dan **Invoice**.

## Catatan

- Pendapatan di laporan dihitung tanpa PPN dan diakui pada tanggal event; kas masuk termasuk PPN.
- Invoice dari versi lama tetap memakai nomor lamanya; pesanan baru memakai nomor urut.

Demo web: [Buka Sistem Invoice Catering](https://karenvalentina767-bit.github.io/SISTEM-AKUNTANSI-CHATERING-TUGAS/)

> Demo ini dihosting publik lewat GitHub Pages. Data disimpan di Supabase.
> Halaman utama terbuka untuk semua pembeli tanpa login. Dashboard pemilik (`admin.html`) membutuhkan login:
> jalankan `backend/schema.sql` dan buat akun dulu.
