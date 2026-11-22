/* ============================================================
   BACKEND VERSI DEMO — tanpa Supabase.
   Meniru fungsi-fungsi di backend/schema.sql (kirim_pesanan, cek_tagihan,
   bayar_simulasi, terima_cepat, dst.) dan menyimpan data di browser (localStorage),
   jadi halaman pembeli dan dashboard pemilik saling terhubung.
   Login pemilik: email & password apa saja.
   ============================================================ */
const SUPABASE_URL = "demo";
const SUPABASE_ANON_KEY = "demo";

// Popup confirm/alert diblokir di halaman yang dihosting: anggap selalu "OK"
window.confirm = () => true;
window.alert = (m) => console.log(m);

const Backend = (() => {
  const TAX_RATE = 0.11;
  const STATUS = ["Belum Bayar", "DP", "Setengah", "Lunas"];
  const METODE = ["Transfer Bank", "Tunai", "QRIS", "E-Wallet", "Kartu Debit/Kredit"];
  const isConfigured = true;
  const KUNCI = "karsa-demo-db-v2"; // v2: aturan wajib lunas H-1
  const OWNER = { id: "owner-demo", email: "owner@karsa.demo", nama: "Owner Demo", role: "owner", created_at: new Date().toISOString() };

  const round2 = (v) => Math.round(v * 100) / 100;
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const hariIni = () => iso(new Date());
  const geser = (tgl, n) => { const d = new Date(`${tgl}T00:00:00`); d.setDate(d.getDate() + n); return iso(d); };
  const now = () => new Date().toISOString();
  const tunda = (ms = 120) => new Promise((r) => setTimeout(r, ms)); // biar terasa seperti server
  const salin = (x) => JSON.parse(JSON.stringify(x));
  const rp = (v) => Math.round(v).toLocaleString("id-ID");
  const gagal = (pesan) => { throw new Error(pesan); };

  function hitungTagihan(pax, hargaPerPax) {
    const subtotal = round2(Number(pax || 0) * Number(hargaPerPax || 0));
    const pajak = round2(subtotal * TAX_RATE);
    return { subtotal, pajak, total: round2(subtotal + pajak) };
  }
  function hitungStatus(dibayar, total) {
    const b = Number(dibayar || 0), t = Number(total || 0);
    if (b <= 0) return "Belum Bayar";
    if (b >= t) return "Lunas";
    if (b >= t / 2) return "Setengah";
    return "DP";
  }
  const hpNormal = (hp) => { const d = String(hp || "").replace(/\D/g, ""); return d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d; };
  const hargaPaket = (nama) => PACKAGES.find((p) => p.name.toLowerCase() === String(nama || "").trim().toLowerCase()) || null;
  // Jatuh tempo = tanggal acara + offset. H-1 → -1 (wajib lunas sehari sebelum acara)
  const HARI_LUNAS = () => -(PENGATURAN.hariLunasSebelumAcara ?? 1);

  /* ---------------- Penyimpanan ---------------- */
  let memori = null;
  function kosong() {
    return { seq: {}, nomor: {}, pelanggan: [], pesanan_event: [], pembayaran: [], transaksi_bayar: [], pesanan_masuk: [], laporan_bayar: [], login: false };
  }
  function muat() {
    if (memori) return memori;
    try { memori = JSON.parse(localStorage.getItem(KUNCI) || "null"); } catch (e) { memori = null; }
    if (!memori) { memori = kosong(); isiContoh(memori); simpan(); }
    return memori;
  }
  function simpan() { try { localStorage.setItem(KUNCI, JSON.stringify(memori)); } catch (e) { /* browser menolak: data hanya di memori */ } }
  const id = (db, t) => (db.seq[t] = (db.seq[t] || 0) + 1);
  function nomorBerikut(db, jenis) {
    const th = new Date().getFullYear();
    const k = `${jenis}-${th}`;
    db.nomor[k] = (db.nomor[k] || 0) + 1;
    return `${jenis}-${th}-${String(db.nomor[k]).padStart(4, "0")}`;
  }

  /* ---------------- Inti (meniru fungsi SQL) ---------------- */
  function sinkronDibayar(db, pembayaranId) {
    const b = db.pembayaran.find((x) => x.id === pembayaranId);
    if (!b) return;
    b.jumlah_dibayar = round2(db.transaksi_bayar.filter((t) => t.pembayaran_id === b.id).reduce((s, t) => s + Number(t.jumlah), 0));
    b.status_bayar = hitungStatus(b.jumlah_dibayar, b.total_tagihan);
  }
  function tambahTransaksi(db, { pembayaran_id, tanggal, jumlah, metode, catatan }) {
    const b = db.pembayaran.find((x) => x.id === pembayaran_id);
    if (!b) gagal("Invoice tidak ditemukan.");
    if (Number(b.jumlah_dibayar) + Number(jumlah) > Number(b.total_tagihan) + 0.5) gagal(`Jumlah melebihi sisa tagihan (sisa Rp ${rp(b.total_tagihan - b.jumlah_dibayar)}).`);
    const t = { id: id(db, "transaksi"), pembayaran_id, tanggal, jumlah: round2(Number(jumlah)), metode, catatan: catatan || "", dibuat_oleh: db.login ? OWNER.id : null, created_at: now() };
    db.transaksi_bayar.push(t);
    sinkronDibayar(db, pembayaran_id);
    return t;
  }
  function bookingInti(db, v) {
    const subtotal = round2(v.pax * v.harga);
    const ppn = round2(subtotal * TAX_RATE);
    let pl = db.pelanggan.find((p) => p.no_hp_normal === hpNormal(v.hp));
    let baru = false;
    if (!pl) {
      pl = { id: id(db, "pelanggan"), nama_pelanggan: v.nama, no_hp: v.hp, no_hp_normal: hpNormal(v.hp), email: v.email || "", created_at: v.created_at || now() };
      db.pelanggan.push(pl); baru = true;
    } else if (v.email && !pl.email) pl.email = v.email;
    const no = nomorBerikut(db, "ORD");
    const pe = { id: id(db, "pesanan"), pelanggan_id: pl.id, no_pesanan: no, nama_event: v.acara, tanggal_event: v.tanggal, jenis_paket: v.paket,
      jumlah_pax: v.pax, harga_per_pax: v.harga, total_penjualan: subtotal, metode_pembayaran: v.metode, dibuat_oleh: v.oleh ?? (db.login ? OWNER.id : null), created_at: v.created_at || now() };
    db.pesanan_event.push(pe);
    const b = { id: id(db, "pembayaran"), pesanan_id: pe.id, no_invoice: no.replace("ORD-", "INV-"), tanggal_tagihan: v.tgl_tagihan || hariIni(),
      tanggal_tempo: v.tgl_tempo, pajak_ppn: ppn, total_tagihan: round2(subtotal + ppn), jumlah_dibayar: 0, status_bayar: "Belum Bayar", created_at: v.created_at || now() };
    db.pembayaran.push(b);
    return { pe, b, baru };
  }
  function bookingDariOnline(db, masukId, harga, oleh) {
    const m = db.pesanan_masuk.find((x) => x.id === Number(masukId));
    if (!m) gagal("Pesanan online tidak ditemukan.");
    if (m.status !== "Baru") gagal(`Pesanan online ini sudah diproses (${m.status}).`);
    if (!harga || harga <= 0) gagal("Isi harga per pax.");
    const { pe, b, baru } = bookingInti(db, { nama: m.nama, hp: m.no_hp, email: m.email, acara: m.nama_event, tanggal: m.tanggal_event, paket: m.jenis_paket,
      pax: m.jumlah_pax, harga, metode: m.metode_bayar, tgl_tempo: geser(m.tanggal_event, m.tempo_hari), oleh });
    Object.assign(m, { status: "Diterima", pesanan_id: pe.id, diproses_oleh: oleh, diproses_pada: now() });
    return { no_pesanan: pe.no_pesanan, no_invoice: b.no_invoice, pelanggan_baru: baru };
  }
  function cariPesanan(db, kode, hp) {
    const m = db.pesanan_masuk.find((x) => String(x.kode).toUpperCase() === String(kode || "").trim().toUpperCase() && hpNormal(x.no_hp) === hpNormal(hp));
    if (!m) gagal("Kode pesanan atau nomor HP tidak cocok.");
    return m;
  }
  const totalKatalog = (m) => { const p = hargaPaket(m.jenis_paket); return p ? hitungTagihan(m.jumlah_pax, p.price).total : null; };

  /* ---------------- Contoh data supaya dashboard tidak kosong ---------------- */
  function isiContoh(db) {
    const t = hariIni();
    const contoh = [
      { nama: "Rina Kartika", hp: "081234560001", acara: "Pernikahan Rina & Dimas", paket: "Prasmanan Nusantara", pax: 300, tanggal: geser(t, -40), bayar: [0.5, 0.5], metode: "Transfer Bank" },
      { nama: "PT Sinar Logistik", hp: "081234560002", acara: "Rapat Tahunan", paket: "Corporate Lunch Set", pax: 80, tanggal: geser(t, -20), bayar: [1], metode: "Transfer Bank" },
      { nama: "Hendra Wijaya", hp: "081234560003", acara: "Syukuran Rumah Baru", paket: "Paket Syukuran", pax: 120, tanggal: geser(t, -12), bayar: [0.5], metode: "QRIS" },
      { nama: "Bu Lestari", hp: "081234560004", acara: "Arisan Keluarga", paket: "Coffee Break", pax: 40, tanggal: geser(t, 3), bayar: [0.5], metode: "E-Wallet" },
      { nama: "Universitas Nusantara", hp: "081234560005", acara: "Seminar Nasional", paket: "Nasi Box Sehat", pax: 250, tanggal: geser(t, 9), bayar: [0.5], metode: "Transfer Bank" },
      { nama: "Rina Kartika", hp: "081234560001", acara: "Ulang Tahun Anak", paket: "Party Western", pax: 60, tanggal: geser(t, 25), bayar: [], metode: "QRIS" },
    ];
    contoh.forEach((c, i) => {
      const p = hargaPaket(c.paket);
      const dibuat = new Date(`${geser(c.tanggal, -21)}T09:00:00`).toISOString();
      const { b } = bookingInti(db, { ...c, harga: p.price, tgl_tagihan: geser(c.tanggal, -21), tgl_tempo: geser(c.tanggal, HARI_LUNAS()), created_at: dibuat, oleh: OWNER.id });
      c.bayar.forEach((porsi, k) => {
        const jumlah = porsi === 1 || k === c.bayar.length - 1 && c.bayar.reduce((s, x) => s + x, 0) >= 1 ? b.total_tagihan - b.jumlah_dibayar : round2(b.total_tagihan * porsi);
        tambahTransaksi(db, { pembayaran_id: b.id, tanggal: k === 0 ? geser(c.tanggal, -14) : geser(c.tanggal, -2), jumlah, metode: c.metode, catatan: k === 0 ? "Pembayaran awal" : "Pelunasan" });
      });
    });
    // Satu pesanan online paket custom yang menunggu harga dari owner
    const mid = id(db, "masuk");
    db.pesanan_masuk.push({ id: mid, kode: `WEB-${String(mid).padStart(4, "0")}`, nama: "Yusuf Ramadhan", no_hp: "081234560009", email: "",
      nama_event: "Aqiqah Putri", tanggal_event: geser(t, 14), jenis_paket: "Custom: Kambing guling + nasi kebuli", jumlah_pax: 100,
      catatan: "Mohon tanpa MSG", status: "Baru", metode_bayar: "QRIS", skema_bayar: "DP", tempo_hari: HARI_LUNAS(), pesanan_id: null, diproses_oleh: null, diproses_pada: null, created_at: now() });
  }

  /* ---------------- Login ---------------- */
  async function sesiAktif() { const db = muat(); return db.login ? { user: { id: OWNER.id, email: OWNER.email } } : null; }
  async function masuk(email, password) {
    await tunda(250);
    if (!email || !password) gagal("Isi email dan password (bebas, ini demo).");
    const db = muat(); db.login = true; simpan();
    pendengar.forEach((cb) => cb("SIGNED_IN", { user: { id: OWNER.id } }));
  }
  async function keluar() { const db = muat(); db.login = false; simpan(); pendengar.forEach((cb) => cb("SIGNED_OUT", null)); }
  const pendengar = [];
  function saatAuthBerubah(cb) { pendengar.push(cb); }
  async function profilSaya() { return muat().login ? salin(OWNER) : null; }
  async function ambilPengguna() { return [salin(OWNER)]; }
  async function ubahPeran() { gagal("Versi demo hanya punya satu akun owner."); }
  async function sinkronHargaPaket() { /* harga demo langsung dibaca dari catalog.js */ }

  /* ---------------- Data dashboard ---------------- */
  const pemroses = (uid) => (uid ? { nama: OWNER.nama, role: OWNER.role } : null);
  async function ambilInvoice() {
    await tunda();
    const db = muat();
    return salin(db.pembayaran.map((b) => {
      const pe = db.pesanan_event.find((x) => x.id === b.pesanan_id);
      const pl = db.pelanggan.find((x) => x.id === pe.pelanggan_id);
      return { ...b,
        transaksi_bayar: db.transaksi_bayar.filter((t) => t.pembayaran_id === b.id).map((t) => ({ ...t, pencatat: pemroses(t.dibuat_oleh) })),
        pesanan_event: { ...pe, pembuat: pemroses(pe.dibuat_oleh), pelanggan: pl } };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }

  async function simpanBooking(values, pesananMasukId = null) {
    await tunda();
    const db = muat();
    const m = pesananMasukId ? db.pesanan_masuk.find((x) => x.id === Number(pesananMasukId)) : null;
    if (m && m.status !== "Baru") gagal(`Pesanan online ini sudah diproses (${m.status}).`);
    const { pe, b, baru } = bookingInti(db, { nama: values.customerName, hp: values.phone, email: values.email, acara: values.eventName, tanggal: values.eventDate,
      paket: values.packageType, pax: Number(values.pax), harga: Number(values.pricePerPax), metode: values.paymentMethod, tgl_tagihan: values.billingDate, tgl_tempo: values.dueDate });
    if (Number(values.downPayment || 0) > 0) tambahTransaksi(db, { pembayaran_id: b.id, tanggal: values.billingDate, jumlah: Number(values.downPayment), metode: values.paymentMethod, catatan: "Pembayaran awal saat booking" });
    if (m) Object.assign(m, { status: "Diterima", pesanan_id: pe.id, diproses_oleh: OWNER.id, diproses_pada: now() });
    simpan();
    return { no_pesanan: pe.no_pesanan, no_invoice: b.no_invoice, pelanggan_baru: baru };
  }

  async function ubahBooking({ invoiceId, pesananId, values }) {
    await tunda();
    const db = muat();
    const pe = db.pesanan_event.find((x) => x.id === Number(pesananId));
    const b = db.pembayaran.find((x) => x.id === Number(invoiceId));
    const { subtotal, pajak, total } = hitungTagihan(values.pax, values.pricePerPax);
    Object.assign(pe, { nama_event: values.eventName, tanggal_event: values.eventDate, jenis_paket: values.packageType, jumlah_pax: Number(values.pax),
      harga_per_pax: Number(values.pricePerPax), total_penjualan: subtotal, metode_pembayaran: values.paymentMethod });
    Object.assign(b, { tanggal_tagihan: values.billingDate, tanggal_tempo: values.dueDate, pajak_ppn: pajak, total_tagihan: total });
    sinkronDibayar(db, b.id);
    simpan();
  }

  async function catatPembayaran(invoiceId, { tanggal, jumlah, metode, catatan }) {
    await tunda();
    const db = muat();
    tambahTransaksi(db, { pembayaran_id: Number(invoiceId), tanggal, jumlah, metode, catatan });
    simpan();
  }
  async function hapusTransaksi(tid) {
    const db = muat();
    const t = db.transaksi_bayar.find((x) => x.id === Number(tid));
    db.transaksi_bayar = db.transaksi_bayar.filter((x) => x.id !== Number(tid));
    if (t) sinkronDibayar(db, t.pembayaran_id);
    simpan();
  }
  async function hapusBooking(pesananId) {
    const db = muat();
    const pid = Number(pesananId);
    const bIds = db.pembayaran.filter((b) => b.pesanan_id === pid).map((b) => b.id);
    db.transaksi_bayar = db.transaksi_bayar.filter((t) => !bIds.includes(t.pembayaran_id));
    db.laporan_bayar = db.laporan_bayar.filter((l) => !bIds.includes(l.pembayaran_id));
    db.pembayaran = db.pembayaran.filter((b) => b.pesanan_id !== pid);
    db.pesanan_event = db.pesanan_event.filter((p) => p.id !== pid);
    db.pesanan_masuk.forEach((m) => { if (m.pesanan_id === pid) m.pesanan_id = null; });
    simpan();
  }

  /* ---------------- Pesanan online ---------------- */
  async function kirimPesanan(v) {
    await tunda(300);
    const db = muat();
    const hp = hpNormal(v.hp);
    if (String(v.nama || "").trim().length < 2) gagal("Nama wajib diisi (2–100 huruf).");
    if (hp.length < 10 || hp.length > 15) gagal("Nomor HP tidak valid.");
    if (String(v.acara || "").trim().length < 3) gagal("Nama acara wajib diisi (3–150 huruf).");
    if (!v.tanggal || v.tanggal < geser(hariIni(), 1)) gagal("Tanggal acara paling cepat besok.");
    const p = hargaPaket(v.paket);
    if (p && Number(v.pax) < p.minPax) gagal(`Minimal ${p.minPax} pax untuk paket ${p.name}.`);
    if (!["Transfer Bank", "QRIS", "E-Wallet", "Kartu Debit/Kredit"].includes(v.metode)) gagal("Pilih metode pembayaran (Transfer Bank, QRIS, E-Wallet, atau Kartu). Pembayaran tunai tidak tersedia.");
    if (!["DP", "Lunas"].includes(v.skema)) gagal("Pilih cara bayar: DP dulu atau langsung lunas.");
    // ATURAN TERLAMBAT
    const milikNomor = db.pembayaran.filter((b) => {
      const pe = db.pesanan_event.find((x) => x.id === b.pesanan_id);
      const pl = pe && db.pelanggan.find((x) => x.id === pe.pelanggan_id);
      return pl && pl.no_hp_normal === hp;
    });
    if (milikNomor.some((b) => b.status_bayar !== "Lunas" && b.tanggal_tempo < hariIni()))
      gagal("Nomor ini masih punya tagihan yang lewat jatuh tempo. Lunasi dulu lewat menu Cek tagihan, lalu pesan lagi.");
    const pernahTelat = milikNomor.some((b) => {
      const tr = db.transaksi_bayar.filter((t) => t.pembayaran_id === b.id).map((t) => t.tanggal).sort();
      return b.status_bayar === "Lunas" && tr.length && tr[tr.length - 1] > b.tanggal_tempo;
    });
    if (v.skema !== "Lunas" && pernahTelat) gagal('Karena pembayaran sebelumnya pernah terlambat, pesanan ini wajib bayar lunas di awal. Pilih "Bayar lunas".');

    const mid = id(db, "masuk");
    const kode = `WEB-${String(mid).padStart(4, "0")}`;
    db.pesanan_masuk.push({ id: mid, kode, nama: v.nama.trim(), no_hp: v.hp.trim(), email: v.email || "", nama_event: v.acara.trim(), tanggal_event: v.tanggal,
      jenis_paket: v.paket, jumlah_pax: Number(v.pax), catatan: v.catatan || "", status: "Baru", metode_bayar: v.metode, skema_bayar: v.skema, tempo_hari: HARI_LUNAS(),
      pesanan_id: null, diproses_oleh: null, diproses_pada: null, created_at: now() });
    simpan();
    return { kode, total: p ? hitungTagihan(v.pax, p.price).total : null, tanggal_tempo: geser(v.tanggal, HARI_LUNAS()) };
  }

  async function cekTagihan(kode, hp) {
    await tunda();
    const db = muat();
    const m = cariPesanan(db, kode, hp);
    const laporan = db.laporan_bayar.filter((l) => l.pesanan_masuk_id === m.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((l) => ({ tanggal: l.tanggal, jumlah: l.jumlah, metode: l.metode, status: l.status }));
    const hasil = { kode: m.kode, nama: m.nama, nama_event: m.nama_event, tanggal_event: m.tanggal_event, jenis_paket: m.jenis_paket, jumlah_pax: m.jumlah_pax,
      status: m.status, metode_bayar: m.metode_bayar, skema_bayar: m.skema_bayar, tempo_hari: m.tempo_hari, dikirim: m.created_at, invoice: null, tagihan_awal: null };
    if (m.pesanan_id) {
      const pe = db.pesanan_event.find((x) => x.id === m.pesanan_id);
      const b = pe && db.pembayaran.find((x) => x.pesanan_id === pe.id);
      if (b) hasil.invoice = { no_pesanan: pe.no_pesanan, no_invoice: b.no_invoice, tanggal_tagihan: b.tanggal_tagihan, tanggal_tempo: b.tanggal_tempo,
        total: b.total_tagihan, dibayar: b.jumlah_dibayar, sisa: Math.max(b.total_tagihan - b.jumlah_dibayar, 0), status_bayar: b.status_bayar, metode: pe.metode_pembayaran,
        harga_per_pax: pe.harga_per_pax, jumlah_pax: pe.jumlah_pax, jenis_paket: pe.jenis_paket, subtotal: pe.total_penjualan, pajak_ppn: b.pajak_ppn,
        riwayat: db.transaksi_bayar.filter((t) => t.pembayaran_id === b.id).map((t) => ({ tanggal: t.tanggal, jumlah: t.jumlah, metode: t.metode })), laporan };
    } else if (m.status === "Baru") {
      const total = totalKatalog(m);
      if (total != null) hasil.tagihan_awal = { total, dibayar: 0, sisa: total, tanggal_tempo: geser(m.tanggal_event, m.tempo_hari), metode: m.metode_bayar,
        status_bayar: "Belum Bayar", riwayat: [], laporan };
    }
    return salin(hasil);
  }

  // SIMULASI payment gateway: langsung tercatat, pesanan otomatis diterima
  async function bayarSimulasi(kode, hp, jumlah, metode) {
    const db = muat();
    const m = cariPesanan(db, kode, hp);
    if (m.status === "Ditolak") gagal("Pesanan ini tidak dapat dilayani, jadi tidak perlu dibayar.");
    const cadangan = salin(db);
    try {
      if (!m.pesanan_id) {
        const p = hargaPaket(m.jenis_paket);
        if (!p) gagal("Harga paket custom belum dikonfirmasi admin. Tunggu kabar dari kami dulu, ya.");
        bookingDariOnline(db, m.id, p.price, null);
      }
      const b = db.pembayaran.find((x) => x.pesanan_id === m.pesanan_id);
      if (b.total_tagihan - b.jumlah_dibayar <= 0) gagal("Tagihan ini sudah lunas.");
      if (b.jumlah_dibayar === 0 && jumlah < Math.round(b.total_tagihan * 0.5) - 0.5) gagal(`Pembayaran pertama minimal DP 50% (Rp ${rp(b.total_tagihan * 0.5)}).`);
      const ref = "SIM-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      tambahTransaksi(db, { pembayaran_id: b.id, tanggal: hariIni(), jumlah, metode, catatan: `Simulasi payment gateway ${ref} (${m.kode})` });
      simpan();
      return { ok: true, ref, status_bayar: b.status_bayar };
    } catch (e) { memori = cadangan; throw e; }
  }

  // Mode manual (simulasiPembayaran: false)
  async function laporBayar(kode, hp, { jumlah, metode, tanggal, catatan }) {
    const db = muat();
    const m = cariPesanan(db, kode, hp);
    if (m.status === "Ditolak") gagal("Pesanan ini tidak dapat dilayani, jadi tidak perlu dibayar.");
    let total, dibayar = 0, pembayaran_id = null;
    if (m.pesanan_id) { const b = db.pembayaran.find((x) => x.pesanan_id === m.pesanan_id); total = b.total_tagihan; dibayar = b.jumlah_dibayar; pembayaran_id = b.id; }
    else { total = totalKatalog(m); if (total == null) gagal("Harga paket custom belum dikonfirmasi admin. Tunggu kabar dari kami dulu, ya."); }
    const menunggu = db.laporan_bayar.filter((l) => l.pesanan_masuk_id === m.id && l.status === "Menunggu").reduce((s, l) => s + l.jumlah, 0);
    if (dibayar === 0 && menunggu === 0 && jumlah < Math.round(total * 0.5) - 0.5) gagal(`Pembayaran pertama minimal DP 50% (Rp ${rp(total * 0.5)}).`);
    if (jumlah > total - dibayar - menunggu + 0.5) gagal(`Jumlah melebihi sisa tagihan (sisa Rp ${rp(total - dibayar - menunggu)}).`);
    db.laporan_bayar.push({ id: id(db, "laporan"), pesanan_masuk_id: m.id, pembayaran_id, jumlah: Number(jumlah), metode, tanggal, catatan: catatan || "", status: "Menunggu",
      transaksi_id: null, diproses_oleh: null, diproses_pada: null, created_at: now() });
    simpan();
    return { ok: true };
  }

  async function ambilPesananMasuk() {
    await tunda();
    const db = muat();
    return salin(db.pesanan_masuk.map((m) => ({ ...m, pemroses: pemroses(m.diproses_oleh), pesanan_event: m.pesanan_id ? { no_pesanan: db.pesanan_event.find((x) => x.id === m.pesanan_id)?.no_pesanan } : null }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }
  async function ambilLaporanBayar() {
    const db = muat();
    return salin(db.laporan_bayar.map((l) => {
      const m = db.pesanan_masuk.find((x) => x.id === l.pesanan_masuk_id) || {};
      const b = db.pembayaran.find((x) => x.id === l.pembayaran_id);
      return { ...l, pesanan_masuk: { id: m.id, kode: m.kode, nama: m.nama, no_hp: m.no_hp, nama_event: m.nama_event, jenis_paket: m.jenis_paket, jumlah_pax: m.jumlah_pax, status: m.status },
        pembayaran: b ? { id: b.id, no_invoice: b.no_invoice, total_tagihan: b.total_tagihan, jumlah_dibayar: b.jumlah_dibayar, tanggal_tempo: b.tanggal_tempo } : null,
        pemroses: pemroses(l.diproses_oleh) };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  }
  async function terimaCepat(mid, harga = null) {
    await tunda();
    const db = muat();
    const m = db.pesanan_masuk.find((x) => x.id === Number(mid));
    const h = harga ?? hargaPaket(m?.jenis_paket)?.price;
    if (!h) gagal("Paket custom: isi harga per pax dulu.");
    const hasil = bookingDariOnline(db, mid, Number(h), OWNER.id);
    simpan();
    return hasil;
  }
  async function tolakPesananMasuk(mid) {
    const db = muat();
    const m = db.pesanan_masuk.find((x) => x.id === Number(mid) && x.status === "Baru");
    if (!m) gagal("Pesanan sudah diproses atau tidak ditemukan.");
    Object.assign(m, { status: "Ditolak", diproses_oleh: OWNER.id, diproses_pada: now() });
    db.laporan_bayar.filter((l) => l.pesanan_masuk_id === m.id && l.status === "Menunggu")
      .forEach((l) => Object.assign(l, { status: "Ditolak", diproses_oleh: OWNER.id, diproses_pada: now() }));
    simpan();
    return { ok: true };
  }
  async function hapusPesananMasuk(mid) {
    const db = muat();
    db.pesanan_masuk = db.pesanan_masuk.filter((x) => x.id !== Number(mid));
    db.laporan_bayar = db.laporan_bayar.filter((l) => l.pesanan_masuk_id !== Number(mid));
    simpan();
  }
  async function verifikasiBayar(lid) {
    const db = muat();
    const cadangan = salin(db);
    try {
      const l = db.laporan_bayar.find((x) => x.id === Number(lid));
      if (!l || l.status !== "Menunggu") gagal("Laporan ini sudah diproses.");
      const m = db.pesanan_masuk.find((x) => x.id === l.pesanan_masuk_id);
      let baru = false;
      if (!l.pembayaran_id) {
        if (!m.pesanan_id) {
          const p = hargaPaket(m.jenis_paket);
          if (!p) gagal(`Paket custom: isi harga & terima pesanan ${m.kode} dulu di menu Pesanan online.`);
          bookingDariOnline(db, m.id, p.price, OWNER.id); baru = true;
        }
        l.pembayaran_id = db.pembayaran.find((b) => b.pesanan_id === m.pesanan_id).id;
      }
      const t = tambahTransaksi(db, { pembayaran_id: l.pembayaran_id, tanggal: l.tanggal, jumlah: l.jumlah, metode: l.metode, catatan: `Dilaporkan pembeli (${m.kode})` });
      Object.assign(l, { status: "Diterima", transaksi_id: t.id, diproses_oleh: OWNER.id, diproses_pada: now() });
      simpan();
      return { ok: true, pesanan_diterima: baru };
    } catch (e) { memori = cadangan; throw e; }
  }
  async function tolakLaporanBayar(lid) {
    const db = muat();
    const l = db.laporan_bayar.find((x) => x.id === Number(lid) && x.status === "Menunggu");
    if (l) Object.assign(l, { status: "Ditolak", diproses_oleh: OWNER.id, diproses_pada: now() });
    simpan();
  }

  // Tombol "Reset data demo"
  function resetDemo() {
    try { localStorage.removeItem(KUNCI); localStorage.removeItem("karsa-tagihan-terakhir"); } catch (e) { /* abaikan */ }
    memori = null; muat();
  }

  return {
    TAX_RATE, STATUS, METODE, isConfigured, resetDemo,
    kirimPesanan, ambilPesananMasuk, tolakPesananMasuk, hapusPesananMasuk, terimaCepat, sinkronHargaPaket,
    cekTagihan, laporBayar, bayarSimulasi, ambilLaporanBayar, verifikasiBayar, tolakLaporanBayar,
    hitungTagihan, hitungStatus,
    sesiAktif, masuk, keluar, saatAuthBerubah, profilSaya, ambilPengguna, ubahPeran,
    ambilInvoice, simpanBooking, ubahBooking, catatPembayaran, hapusTransaksi, hapusBooking,
  };
})();

/* Tombol kecil "Reset data" di dashboard owner (untuk mengulang demo dari awal) */
document.addEventListener("DOMContentLoaded", () => {
  if (!/admin\.html/.test(location.pathname)) return;
  const b = document.createElement("button");
  b.type = "button"; b.className = "demo-reset"; b.textContent = "↺ Reset data";
  b.title = "Kembalikan semua data ke contoh awal";
  b.addEventListener("click", () => { Backend.resetDemo(); location.reload(); });
  document.body.appendChild(b);
  const g = document.createElement("style");
  g.textContent = `.demo-reset{position:fixed;right:14px;bottom:14px;z-index:9999;padding:6px 12px;border:1px solid rgba(0,0,0,.12);border-radius:999px;background:#fff;color:#6b6b66;font:600 12px system-ui,sans-serif;cursor:pointer;opacity:.75}
  .demo-reset:hover{opacity:1}@media(max-width:760px){.demo-reset{bottom:78px}}`;
  document.head.appendChild(g);
});
