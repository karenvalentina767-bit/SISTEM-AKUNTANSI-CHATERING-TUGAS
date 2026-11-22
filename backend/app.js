/* ============================================================
   BACKEND — koneksi & logika data (Supabase PostgreSQL)
   File ini mengurus: konfigurasi Supabase, login & peran pengguna,
   pesanan online dari pembeli (tanpa login),
   perhitungan PPN, dan semua operasi database.
   Tampilan (UI) ada di frontend/js/*.js dan memanggil
   fungsi-fungsi di objek `Backend` di bawah ini.

   Isi dua nilai ini dari Project Supabase milik kamu.
   Jangan gunakan service_role key di browser.
   ============================================================ */
const SUPABASE_URL = "https://rrggksnvyxzhwzxapkdr.supabase.co";
// Tempel di sini: Supabase → Project Settings → API Keys → Publishable key (sb_publishable_...)
const SUPABASE_ANON_KEY = "sb_publishable_0D1NMpLVYsUU6uIi21JfNA_OsXCk8J_";

/* Akun admin tetap untuk login cepat (tugas kuliah).
   Email & password ini ditampilkan di halaman login supaya dosen bisa langsung masuk.
   Akun dibuat otomatis di Supabase saat pertama kali dipakai masuk
   (syarat: Supabase → Authentication → Providers → Email → matikan "Confirm email").
   Ganti nilainya di sini bila ingin email/password lain. */
// true = membuka admin.html langsung masuk dashboard tanpa mengisi login. false = tampilkan form login.
const AUTO_LOGIN = true;
const AKUN_ADMIN = { email: "admin@karsa.com", password: "admin123", nama: "Admin Karsa" };

const Backend = (() => {
  const TAX_RATE = 0.11;
  const STATUS = ["Belum Bayar", "DP", "Setengah", "Lunas"];
  const METODE = ["Transfer Bank", "Tunai", "QRIS", "E-Wallet", "Kartu Debit/Kredit"];

  const isConfigured = Boolean(
    window.supabase &&
      SUPABASE_URL.startsWith("https://") &&
      !SUPABASE_URL.includes("ISI_") &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_ANON_KEY.includes("ISI_")
  );

  const client = isConfigured
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const round2 = (value) => Math.round(value * 100) / 100;

  // Hitung subtotal, PPN 11%, dan total tagihan
  function hitungTagihan(pax, hargaPerPax) {
    const subtotal = round2(Number(pax || 0) * Number(hargaPerPax || 0));
    const pajak = round2(subtotal * TAX_RATE);
    const total = round2(subtotal + pajak);
    return { subtotal, pajak, total };
  }

  // Sama dengan fungsi hitung_status() di database
  function hitungStatus(dibayar, total) {
    const bayar = Number(dibayar || 0);
    const tagihan = Number(total || 0);
    if (bayar <= 0) return "Belum Bayar";
    if (bayar >= tagihan) return "Lunas";
    if (bayar >= tagihan / 2) return "Setengah";
    return "DP";
  }

  function wajibTerhubung() {
    if (!client) {
      throw new Error("Supabase belum terhubung. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di backend/app.js.");
    }
  }

  function cek({ data, error }) {
    if (error) throw new Error(terjemahkanError(error));
    return data;
  }

  function terjemahkanError(error) {
    const pesan = error?.message || String(error);
    if (/row-level security|permission denied/i.test(pesan)) return "Akses ditolak untuk peran akun ini.";
    if (/Invalid login credentials/i.test(pesan)) return "Email atau password salah.";
    if (/Email not confirmed/i.test(pesan)) return "Email belum dikonfirmasi. Cek kotak masuk email.";
    return pesan;
  }

  /* ---------------- Login & peran pengguna ---------------- */

  async function sesiAktif() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function masuk(email, password) {
    wajibTerhubung();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return;

    // Akun admin tetap belum ada di Supabase → buat otomatis, lalu masuk
    const akunAdmin = email.toLowerCase() === AKUN_ADMIN.email && password === AKUN_ADMIN.password;
    if (akunAdmin && /Invalid login credentials/i.test(error.message || "")) {
      const daftar = await client.auth.signUp({
        email, password, options: { data: { nama: AKUN_ADMIN.nama } },
      });
      if (daftar.error) throw new Error(terjemahkanError(daftar.error));
      if (daftar.data.session) return; // konfirmasi email nonaktif → langsung masuk
      const ulang = await client.auth.signInWithPassword({ email, password });
      if (!ulang.error) return;
      throw new Error("Akun admin dibuat, tetapi Supabase meminta konfirmasi email. Matikan \"Confirm email\" di Authentication → Providers → Email, lalu coba lagi.");
    }
    throw new Error(terjemahkanError(error));
  }

  async function keluar() {
    if (client) await client.auth.signOut();
  }

  function saatAuthBerubah(callback) {
    if (client) client.auth.onAuthStateChange((event, session) => callback(event, session));
  }

  async function profilSaya() {
    wajibTerhubung();
    const session = await sesiAktif();
    if (!session) return null;
    const data = cek(await client.from("profiles").select("*").eq("id", session.user.id).maybeSingle());
    return data || { id: session.user.id, email: session.user.email, nama: "", role: null };
  }

  async function ambilPengguna() {
    wajibTerhubung();
    return cek(await client.from("profiles").select("*").order("created_at"));
  }

  async function ubahPeran(id, role) {
    wajibTerhubung();
    cek(await client.from("profiles").update({ role }).eq("id", id));
  }

  /* ---------------- Invoice, pesanan, pelanggan ---------------- */

  // Semua invoice beserta pesanan, pelanggan, penginput, dan riwayat pembayaran
  async function ambilInvoice() {
    if (!client) return [];
    const data = cek(
      await client
        .from("pembayaran")
        .select(
          "*, transaksi_bayar(id, tanggal, jumlah, metode, catatan, created_at, pencatat:profiles(nama, role))," +
            " pesanan_event(id, no_pesanan, nama_event, tanggal_event, jenis_paket, jumlah_pax, harga_per_pax," +
            " total_penjualan, metode_pembayaran, created_at, pembuat:profiles(nama, role)," +
            " pelanggan(id, nama_pelanggan, no_hp, email, created_at))"
        )
        .order("created_at", { ascending: false })
    );
    return data || [];
  }

  // Simpan booking baru dalam satu transaksi database (lihat fungsi buat_booking di schema.sql).
  // Jika `pesananMasukId` diisi, booking dibuat dari pesanan online dan pesanan itu ditandai Diterima.
  async function simpanBooking(values, pesananMasukId = null) {
    wajibTerhubung();
    const fungsi = pesananMasukId ? "terima_pesanan_masuk" : "buat_booking";
    const idParam = pesananMasukId ? { p_id: Number(pesananMasukId) } : {};
    return cek(
      await client.rpc(fungsi, {
        ...idParam,
        p_nama: values.customerName,
        p_hp: values.phone,
        p_email: values.email || "",
        p_nama_event: values.eventName,
        p_tanggal_event: values.eventDate,
        p_paket: values.packageType,
        p_pax: Number(values.pax),
        p_harga: Number(values.pricePerPax),
        p_metode: values.paymentMethod,
        p_tgl_tagihan: values.billingDate,
        p_tgl_tempo: values.dueDate,
        p_dp: Number(values.downPayment || 0),
      })
    );
  }

  // Ubah data event dan invoice (status bayar dihitung otomatis oleh database)
  async function ubahBooking({ invoiceId, pesananId, values }) {
    wajibTerhubung();
    const pax = Number(values.pax);
    const hargaPerPax = Number(values.pricePerPax);
    const { subtotal, pajak, total } = hitungTagihan(pax, hargaPerPax);

    cek(
      await client
        .from("pesanan_event")
        .update({
          nama_event: values.eventName,
          tanggal_event: values.eventDate,
          jenis_paket: values.packageType,
          jumlah_pax: pax,
          harga_per_pax: hargaPerPax,
          total_penjualan: subtotal,
          metode_pembayaran: values.paymentMethod,
        })
        .eq("id", pesananId)
    );
    cek(
      await client
        .from("pembayaran")
        .update({
          tanggal_tagihan: values.billingDate,
          tanggal_tempo: values.dueDate,
          pajak_ppn: pajak,
          total_tagihan: total,
        })
        .eq("id", invoiceId)
    );
  }

  // Catat pembayaran masuk (DP, cicilan, atau pelunasan)
  async function catatPembayaran(invoiceId, { tanggal, jumlah, metode, catatan }) {
    wajibTerhubung();
    cek(
      await client.from("transaksi_bayar").insert({
        pembayaran_id: invoiceId,
        tanggal,
        jumlah: Number(jumlah),
        metode,
        catatan: catatan || "",
      })
    );
  }

  async function hapusTransaksi(id) {
    wajibTerhubung();
    cek(await client.from("transaksi_bayar").delete().eq("id", id));
  }

  // Hapus booking (invoice & transaksi ikut terhapus lewat ON DELETE CASCADE)
  async function hapusBooking(pesananId) {
    wajibTerhubung();
    cek(await client.from("pesanan_event").delete().eq("id", pesananId));
  }

  /* ---------------- Pesanan online dari pembeli ---------------- */

  // Dipanggil dari halaman pembeli (tanpa login). Hanya bisa mengirim, tidak bisa membaca.
  async function kirimPesanan(values) {
    wajibTerhubung();
    return cek(
      await client.rpc("kirim_pesanan", {
        p_nama: values.nama,
        p_hp: values.hp,
        p_email: values.email || "",
        p_nama_event: values.acara,
        p_tanggal_event: values.tanggal,
        p_paket: values.paket,
        p_pax: Number(values.pax),
        p_catatan: values.catatan || "",
        p_metode: values.metode,
        p_skema: values.skema,
        p_tempo: Number(values.tempo),
      })
    );
  }

  // Pembeli: lihat tagihan sendiri dengan kode pesanan + nomor HP
  async function cekTagihan(kode, hp) {
    wajibTerhubung();
    return cek(await client.rpc("cek_tagihan", { p_kode: kode, p_hp: hp }));
  }

  // Pembeli: lapor sudah bayar (menunggu verifikasi owner/admin)
  async function laporBayar(kode, hp, { jumlah, metode, tanggal, catatan }) {
    wajibTerhubung();
    return cek(
      await client.rpc("lapor_bayar", {
        p_kode: kode, p_hp: hp, p_jumlah: Number(jumlah), p_metode: metode, p_tanggal: tanggal, p_catatan: catatan || "",
      })
    );
  }

  // SIMULASI payment gateway: pembayaran langsung tercatat tanpa verifikasi owner (untuk demo)
  async function bayarSimulasi(kode, hp, jumlah, metode) {
    wajibTerhubung();
    return cek(await client.rpc("bayar_simulasi", { p_kode: kode, p_hp: hp, p_jumlah: Number(jumlah), p_metode: metode }));
  }

  // Owner/admin: daftar laporan bayar dari pembeli
  async function ambilLaporanBayar() {
    if (!client) return [];
    return (
      cek(
        await client
          .from("laporan_bayar")
          .select("*, pesanan_masuk(id, kode, nama, no_hp, nama_event, jenis_paket, jumlah_pax, status), pembayaran(id, no_invoice, total_tagihan, jumlah_dibayar, tanggal_tempo), pemroses:profiles(nama)")
          .order("created_at", { ascending: false })
      ) || []
    );
  }

  async function verifikasiBayar(id) {
    wajibTerhubung();
    return cek(await client.rpc("verifikasi_bayar", { p_id: Number(id) }));
  }

  async function tolakLaporanBayar(id) {
    wajibTerhubung();
    const session = await sesiAktif();
    cek(
      await client
        .from("laporan_bayar")
        .update({ status: "Ditolak", diproses_oleh: session?.user?.id || null, diproses_pada: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "Menunggu")
    );
  }

  async function ambilPesananMasuk() {
    if (!client) return [];
    return (
      cek(
        await client
          .from("pesanan_masuk")
          .select("*, pemroses:profiles(nama, role), pesanan_event(no_pesanan)")
          .order("created_at", { ascending: false })
      ) || []
    );
  }

  // Tolak pesanan online. Laporan bayar yang masih menunggu ikut ditolak (fungsi tolak_pesanan).
  async function tolakPesananMasuk(id) {
    wajibTerhubung();
    return cek(await client.rpc("tolak_pesanan", { p_id: Number(id) }));
  }

  // Terima 1 klik: booking + invoice langsung dibuat. Harga paket katalog diambil dari database;
  // paket custom wajib diisi hargaPerPax.
  async function terimaCepat(id, hargaPerPax = null) {
    wajibTerhubung();
    return cek(await client.rpc("terima_cepat", { p_id: Number(id), p_harga: hargaPerPax == null ? null : Number(hargaPerPax) }));
  }

  // Owner: salin harga & minimal pax dari catalog.js ke database (tabel paket_harga),
  // supaya pembeli bisa langsung bayar dengan harga yang benar.
  async function sinkronHargaPaket(paket) {
    if (!client || !paket?.length) return;
    cek(
      await client.from("paket_harga").upsert(
        paket.map((p) => ({ nama: p.name, harga: p.price, min_pax: p.minPax, updated_at: new Date().toISOString() })),
        { onConflict: "nama" }
      )
    );
  }

  async function hapusPesananMasuk(id) {
    wajibTerhubung();
    cek(await client.from("pesanan_masuk").delete().eq("id", id));
  }

  return {
    TAX_RATE, STATUS, METODE, isConfigured, AKUN_ADMIN, AUTO_LOGIN,
    kirimPesanan, ambilPesananMasuk, tolakPesananMasuk, hapusPesananMasuk, terimaCepat, sinkronHargaPaket,
    cekTagihan, laporBayar, bayarSimulasi, ambilLaporanBayar, verifikasiBayar, tolakLaporanBayar,
    hitungTagihan, hitungStatus,
    sesiAktif, masuk, keluar, saatAuthBerubah, profilSaya, ambilPengguna, ubahPeran,
    ambilInvoice, simpanBooking, ubahBooking, catatPembayaran, hapusTransaksi, hapusBooking,
  };
})();
