/* ============================================================
   PENGATURAN USAHA — ubah sesuai data usaha catering kamu.
   Dipakai di halaman pembeli dan invoice PDF.
   ============================================================ */
const PENGATURAN = {
  usaha: {
    nama: "Karsa Catering",
    alamat: "Jl. Contoh No. 12, Surabaya",
    telepon: "0812-0000-0000",
    email: "halo@karsacatering.id",
    // Rekening yang ditampilkan di invoice
    rekening: "BCA 123 456 7890 a.n. Karsa Catering",
    // Opsional. Kosongkan ("") bila tidak dipakai, pembeli akan diminta menghubungi telepon di atas.
    ewallet: "GoPay / OVO / DANA 0812-0000-0000 a.n. Karsa Catering",
    qris: "", // contoh: "./img/qris.png" (simpan gambar QRIS di folder frontend/img)
    jamBuka: "Setiap hari, 08.00–20.00",
  },

  // Halaman pembeli: pesanan paling cepat untuk acara N hari dari hari ini
  minimalHariPesan: 1,

  // Minimal pemesanan untuk paket custom (yang tidak ada di katalog).
  // Paket katalog memakai minPax masing-masing di frontend/js/catalog.js.
  minimalPaxCustom: 20,

  // Laba paket custom: modal dianggap sekian persen dari harga jual
  // (paket katalog memakai modal masing-masing di frontend/js/catalog.js)
  persenModalCustom: 65,

  // ATURAN BAYAR (tampil di website pembeli)
  // Pembayaran pertama minimal DP sekian persen. Jika diubah, ubah juga angka 0.5 di fungsi lapor_bayar (backend/schema.sql).
  dpMinimalPersen: 50,
  // Pelunasan WAJIB LUNAS paling lambat N hari SEBELUM tanggal acara (H-N). Dipakai untuk jatuh tempo invoice.
  // Jika diubah, ubah juga angka -1 di fungsi kirim_pesanan (backend/schema.sql).
  hariLunasSebelumAcara: 1,

  // SIMULASI PAYMENT GATEWAY (untuk demo / tugas kuliah).
  // true  = pembeli bayar lewat halaman bayar tiruan (QRIS / VA / e-wallet), status langsung berubah,
  //         owner TIDAK perlu verifikasi apa pun.
  // false = mode manual: pembeli transfer sendiri lalu tekan "Saya sudah bayar", owner memverifikasi.
  simulasiPembayaran: true,

  // Invoice muncul di "Pengingat jatuh tempo" bila jatuh tempo ≤ N hari lagi (atau sudah lewat)
  hariPengingat: 3,
};
