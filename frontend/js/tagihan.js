/* HALAMAN PEMBELI — "Cek tagihan".
   Pembeli melihat status pesanan, sisa tagihan, jatuh tempo, dan pengingat.

   ALUR CEPAT:
   - Paket katalog: tagihan langsung muncul begitu pesanan dikirim (tidak perlu menunggu admin).
     Pembeli bayar, lalu tekan SATU tombol "Saya sudah bayar DP / lunas". Selesai.
   - Admin cukup klik Verifikasi saat uangnya masuk. Pesanan, invoice, dan status bayar
     berubah otomatis.
   - Paket custom: tagihan muncul setelah admin mengisi harga.

   Kode + HP terakhir disimpan di browser pembeli, jadi tagihan & pengingat jatuh tempo
   muncul otomatis setiap kali website dibuka lagi (tidak perlu mengetik ulang). */
const Tagihan = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const money = (v) => "Rp " + Math.round(Number(v || 0)).toLocaleString("id-ID");
  const localISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = () => localISO(new Date());
  const tgl = (iso) => (iso ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${String(iso).slice(0, 10)}T00:00:00`)) : "—");
  const selisihHari = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${today()}T00:00:00`)) / 86400000);
  const KUNCI = "karsa-tagihan-terakhir";
  const usaha = PENGATURAN.usaha;
  const DP = (PENGATURAN.dpMinimalPersen || 50) / 100;
  const BAYAR_DI_TEMPAT = ["Tunai", "Kartu Debit/Kredit"];
  // true = pakai simulasi payment gateway (lihat pengaturan.js)
  const SIMULASI = PENGATURAN.simulasiPembayaran !== false;
  const skemaTeks = (s) => ({ DP: `DP ${Math.round(DP * 100)}% dulu`, Lunas: "bayar lunas", Setengah: "bayar setengah", "Jatuh tempo": "bayar nanti" }[s] || s);
  let aktif = null; // { kode, hp, data, box }

  /* ---------- Simpan kode + HP di browser pembeli (untuk pengingat) ---------- */
  function simpan(kode, hp) {
    try { localStorage.setItem(KUNCI, JSON.stringify({ kode, hp })); } catch (e) { /* browser menolak penyimpanan: abaikan */ }
  }
  function ambilTersimpan() {
    try { return JSON.parse(localStorage.getItem(KUNCI) || "null"); } catch (e) { return null; }
  }

  /* ---------- Pengingat jatuh tempo ---------- */
  function infoTempo(inv) {
    if (!inv || Number(inv.sisa) <= 0 || inv.awal) return null;
    const d = selisihHari(inv.tanggal_tempo);
    if (d < 0) return { cls: "late", teks: `TERLAMBAT ${-d} hari. Segera lunasi sisa ${money(inv.sisa)}. Selama belum lunas, Anda tidak bisa membuat pesanan baru.` };
    if (d === 0) return { cls: "late", teks: `Hari ini jatuh tempo. Sisa tagihan ${money(inv.sisa)}.` };
    if (d <= (PENGATURAN.hariPengingat || 3)) return { cls: "soon", teks: `Jatuh tempo ${d} hari lagi (${tgl(inv.tanggal_tempo)}). Sisa ${money(inv.sisa)}.` };
    return { cls: "info", teks: `Jatuh tempo ${tgl(inv.tanggal_tempo)} (${d} hari lagi). Sisa ${money(inv.sisa)}.` };
  }

  function tampilkanPengingatAtas(data) {
    const bar = $("#reminderBar");
    const info = infoTempo(data?.invoice);
    if (!info || info.cls === "info") { bar.classList.add("is-hidden"); return; }
    $("#reminderText").textContent = `${data.kode}: ${info.teks}`;
    bar.className = `reminder-bar is-${info.cls}`;
  }

  /* ---------- Tampilan hasil ---------- */
  const STATUS_PESANAN = {
    Baru: { cls: "s-dp", teks: "Menunggu konfirmasi" },
    Diterima: { cls: "s-lunas", teks: "Dikonfirmasi" },
    Ditolak: { cls: "s-belum", teks: "Tidak dapat dilayani" },
  };
  const STATUS_BAYAR = { "Belum Bayar": "s-belum", DP: "s-dp", Setengah: "s-setengah", Lunas: "s-lunas" };

  // Tujuan bayar per metode. Isi rekening / e-wallet / QRIS di frontend/js/pengaturan.js
  function tujuanBayar(metode) {
    const salin = (teks, label = "Salin") => `<button type="button" class="link-btn" data-salin="${esc(teks)}">${label}</button>`;
    if (metode === "Transfer Bank") {
      return `<div class="pay-now-row"><span>Transfer ke</span><b>${esc(usaha.rekening)}</b>${salin(usaha.rekening.replace(/[^0-9]/g, ""), "Salin no.")}</div>`;
    }
    if (metode === "E-Wallet" && usaha.ewallet) {
      return `<div class="pay-now-row"><span>Kirim ke</span><b>${esc(usaha.ewallet)}</b>${salin(usaha.ewallet.replace(/[^0-9]/g, ""), "Salin no.")}</div>`;
    }
    if (metode === "QRIS" && usaha.qris) {
      return `<div class="pay-now-qris"><img src="${esc(usaha.qris)}" alt="Kode QRIS ${esc(usaha.nama)}" /><span>Scan QRIS ini dari aplikasi bank / e-wallet apa pun.</span></div>`;
    }
    if (BAYAR_DI_TEMPAT.includes(metode)) {
      return `<p class="pay-now-how">Bayar ${metode === "Tunai" ? "tunai" : "dengan kartu"} langsung di <b>${esc(usaha.alamat)}</b> (${esc(usaha.jamBuka || "")}). Admin yang mencatat, Anda tidak perlu lapor.</p>`;
    }
    return `<p class="pay-now-how">Hubungi kami di <b>${esc(usaha.telepon)}</b> untuk ${metode === "QRIS" ? "kode QRIS" : "nomor e-wallet"}.</p>`;
  }

  // Status untuk pembeli (sederhana): Belum dibayar / DP terbayar / Lunas.
  // "DP" dan "Setengah" di sistem owner sama-sama berarti "sudah bayar sebagian" bagi pembeli.
  function statusPembeli(inv) {
    if (Number(inv.sisa) <= 0) return "Lunas";
    if (Number(inv.dibayar) > 0) return "DP terbayar";
    return "Belum dibayar";
  }
  // Label tiap pembayaran: DP, Cicilan, Pelunasan
  function labelBayar(riwayat, i, total) {
    const sampai = riwayat.slice(0, i + 1).reduce((s, t) => s + Number(t.jumlah), 0);
    if (i === 0 && sampai >= Number(total) - 0.5) return "Bayar lunas";
    if (i === 0) return "DP";
    return sampai >= Number(total) - 0.5 ? "Pelunasan" : "Cicilan";
  }

  // Ubah data dari server jadi satu bentuk tagihan. tagihan_awal = paket katalog yang belum ada invoicenya.
  function ambilInv(data) {
    if (data.invoice) return data.invoice;
    if (data.tagihan_awal) return { ...data.tagihan_awal, awal: true };
    return null;
  }

  // Hanya SATU kartu tagihan yang tampil di halaman (di layar "Pesanan terkirim" ATAU di bagian Cek tagihan),
  // supaya tidak ada salinan lama yang tombol bayarnya masih aktif.
  function pakaiKotak(box) {
    ["#donePay", "#billResult"].map((s) => $(s)).filter((b) => b && b !== box && b.querySelector(".bill-card")).forEach((b) => {
      b.innerHTML = b.id === "billResult"
        ? '<p class="bill-note">Klik <b>Cek tagihan</b> untuk menampilkan tagihan Anda di sini.</p>'
        : '<p class="bill-note">Tagihan sekarang tampil di bagian <b>Cek tagihan</b> di bawah.</p>';
    });
  }

  function render(data, box = aktif?.box || $("#billResult")) {
    pakaiKotak(box);
    const st = STATUS_PESANAN[data.status] || STATUS_PESANAN.Baru;
    const inv = ambilInv(data);
    const terlambat = inv && !inv.awal && Number(inv.sisa) > 0 && selisihHari(inv.tanggal_tempo) < 0;
    const pill = terlambat ? '<span class="pill s-late">Terlambat</span>'
      : inv?.awal ? '<span class="pill s-belum">Belum dibayar</span>'
      : inv ? `<span class="pill ${STATUS_BAYAR[inv.status_bayar]}">${esc(statusPembeli(inv))}</span>`
      : `<span class="pill ${st.cls}">${st.teks}</span>`;
    const kepala = `
      <header class="bill-head">
        <div><span class="bill-code">${esc(data.kode)}</span><h3>${esc(data.nama_event)}</h3>
          <p>${esc(data.nama)} · ${esc(data.jenis_paket)}, ${Number(data.jumlah_pax).toLocaleString("id-ID")} pax · acara ${tgl(data.tanggal_event)}</p></div>
        ${pill}
      </header>`;

    if (!inv) {
      const pesan = data.status === "Ditolak"
        ? "<b>Maaf, pesanan ini tidak dapat kami layani.</b> Silakan hubungi kami untuk tanggal atau paket lain."
        : `<b>Paket custom: admin akan menghitung harganya.</b> Kami hubungi Anda di nomor HP yang didaftarkan. Setelah itu tagihan muncul di sini dan bisa langsung dibayar.`;
      box.innerHTML = `<div class="bill-card">${kepala}<p class="bill-note">${pesan}</p></div>`;
      return;
    }

    const info = infoTempo(inv);
    const persen = Math.min(100, Math.round((Number(inv.dibayar) / Number(inv.total || 1)) * 100));
    const laporanSemua = inv.laporan || [];
    const menunggu = laporanSemua.filter((l) => l.status === "Menunggu");
    const daftarBayar = inv.riwayat || [];
    const riwayat = daftarBayar.map((t, i) => `<li><span><b>${labelBayar(daftarBayar, i, inv.total)}</b> · ${tgl(t.tanggal)} · ${esc(t.metode)}</span><b>${money(t.jumlah)}</b></li>`).join("");
    const laporan = laporanSemua.filter((l) => l.status !== "Diterima")
      .map((l) => `<li><span>${tgl(l.tanggal)} · ${esc(l.metode)} · <em class="${l.status === "Menunggu" ? "wait" : "rej"}">${l.status === "Menunggu" ? "sedang dicek admin" : "tidak ditemukan admin"}</em></span><b>${money(l.jumlah)}</b></li>`).join("");
    const lunas = Number(inv.sisa) <= 0;
    const sisaBisaLapor = Math.max(0, Number(inv.sisa) - menunggu.reduce((s, l) => s + Number(l.jumlah), 0));
    const tglLunas = daftarBayar.length ? daftarBayar[daftarBayar.length - 1].tanggal : null;
    const meta = inv.awal
      ? `Harga paket sudah pasti, jadi Anda bisa langsung bayar. Pesanan otomatis <b>terkonfirmasi</b> begitu ${SIMULASI ? "Anda membayar" : "pembayaran dicek admin"}.`
      : lunas ? `Invoice ${esc(inv.no_invoice)} · terima kasih, pembayaran Anda sudah lengkap.`
      : `Invoice ${esc(inv.no_invoice)} · metode ${esc(inv.metode)}`;
    // Pengingat hanya bila mendesak (≤ 3 hari / terlambat); tanggal biasa sudah ada di kotak angka
    const peringatan = info && info.cls !== "info" ? `<div class="bill-alert is-${info.cls}"><svg><use href="#i-bell"/></svg>${esc(info.teks)}</div>` : "";

    box.innerHTML = `<div class="bill-card">
      ${kepala}
      ${peringatan}
      <div class="bill-figures">
        <div><span>Total tagihan</span><strong>${money(inv.total)}</strong></div>
        <div><span>Sudah dibayar</span><strong>${money(inv.dibayar)}</strong></div>
        ${lunas
          ? `<div><span>Sisa</span><strong>Rp 0</strong></div><div><span>Dilunasi</span><strong>${tgl(tglLunas)}</strong></div>`
          : `<div><span>Sisa</span><strong class="due">${money(inv.sisa)}</strong></div><div><span>Lunas paling lambat</span><strong>${tgl(inv.tanggal_tempo)}</strong></div>`}
      </div>
      <div class="progress"><span style="width:${persen}%"></span></div>
      <p class="bill-meta">${meta}</p>
      ${inv.awal ? "" : `<button type="button" class="btn btn-quiet btn-block inv-open"><svg><use href="#i-receipt"/></svg>Lihat &amp; unduh invoice</button>`}
      ${lunas ? "" : menunggu.length
        ? `<div class="bill-alert is-done"><svg><use href="#i-check"/></svg><span><b>Terima kasih!</b> Pembayaran ${money(menunggu[0].jumlah)} sedang dicek admin. Status berubah otomatis, Anda tidak perlu melakukan apa-apa lagi.${sisaBisaLapor > 0 ? ` Sisa ${money(sisaBisaLapor)} bisa dilunasi kapan saja sebelum ${tgl(inv.tanggal_tempo)}.` : ""}</span></div>
           ${sisaBisaLapor > 0 ? `<button type="button" class="link-btn pay-later-toggle">Lunasi sisanya sekarang juga</button><div class="pay-later is-hidden">${panelBayar(inv, data, sisaBisaLapor, false)}</div>` : ""}`
        : panelBayar(inv, data, sisaBisaLapor, true)}
      ${riwayat ? `<h4>Pembayaran diterima</h4><ul class="bill-list">${riwayat}</ul>` : ""}
      ${laporan ? `<h4>Pembayaran yang Anda laporkan</h4><ul class="bill-list">${laporan}</ul>` : ""}
    </div>`;

    $$("[data-salin]", box).forEach((b) => b.addEventListener("click", () => salin(b)));
    $(".inv-open", box)?.addEventListener("click", () => lihatInvoice(data));
    $$("[data-gateway]", box).forEach((b) => b.addEventListener("click", () => bukaGateway(Number(b.dataset.gateway), b.dataset.nama)));
    $$("[data-sudah]", box).forEach((b) => b.addEventListener("click", () => laporCepat(Number(b.dataset.sudah), b)));
    $(".pay-later-toggle", box)?.addEventListener("click", (e) => { e.currentTarget.classList.add("is-hidden"); $(".pay-later", box).classList.remove("is-hidden"); });
    $(".pay-other-toggle", box)?.addEventListener("click", (e) => { e.currentTarget.classList.add("is-hidden"); $(".pay-report", box).classList.remove("is-hidden"); $(".pay-report", box).jumlah.focus(); });
    $(".pay-report", box)?.addEventListener("submit", laporForm);
  }

  // Panel "Bayar sekarang": nominal + tujuan bayar + tombol SEKALI TAP "Saya sudah bayar".
  function panelBayar(inv, data, sisaBisaLapor, bolehDp) {
    const pertama = Number(inv.dibayar) === 0 && bolehDp;
    const dp = Math.round(inv.total * DP);
    const diTempat = BAYAR_DI_TEMPAT.includes(inv.metode);
    const pilihan = pertama
      ? [{ label: `DP ${Math.round(DP * 100)}%`, nominal: dp, utama: data.skema_bayar !== "Lunas" },
         { label: "Lunas", nominal: Math.round(sisaBisaLapor), utama: data.skema_bayar === "Lunas" }]
      : [{ label: "Sisa", nominal: Math.round(sisaBisaLapor), utama: true }];
    // Urutkan sesuai pilihan pembeli saat memesan
    pilihan.sort((a, b) => Number(b.utama) - Number(a.utama));
    const namaPilihan = (p) => (p.label === "Sisa" ? "sisa" : p.label === "Lunas" ? "lunas" : "DP");

    // Payment gateway (simulasi): tombol "Bayar" langsung membuka halaman bayar sesuai METODE YANG DIPILIH
    // saat memesan, jadi pembeli tidak memilih metode dua kali. Tidak ada verifikasi owner.
    if (SIMULASI) {
      // Pembeli SUDAH memilih DP / lunas di form pesanan → tampilkan SATU tombol sesuai pilihan itu saja
      const p = pilihan.find((x) => x.utama) || pilihan[0];
      const judul = p.label === "Sisa" ? "Pelunasan" : p.label === "Lunas" ? "Bayar lunas" : `Bayar DP ${Math.round(DP * 100)}%`;
      const sisaNanti = p.label.startsWith("DP") ? Math.round(sisaBisaLapor - p.nominal) : 0;
      const catatan = sisaNanti > 0
        ? `Sisa ${money(sisaNanti)} dilunasi paling lambat <b>${tgl(inv.tanggal_tempo)}</b>.`
        : p.label === "Sisa" ? `Paling lambat <b>${tgl(inv.tanggal_tempo)}</b>.` : "Sekali bayar, langsung lunas.";
      if (inv.metode === "Tunai") {
        return `<div class="pay-now"><h4>${judul} di tempat · ${money(p.nominal)}</h4>
          <p class="pay-now-how">${catatan} Bayar tunai di <b>${esc(usaha.alamat)}</b> (${esc(usaha.jamBuka || "")}). Petugas kami langsung mencatat pembayaran Anda.</p></div>`;
      }
      return `<div class="pay-now">
        <h4>${judul}</h4>
        <p class="pay-now-how">${catatan}</p>
        <div class="pay-now-actions">
          <button type="button" class="btn btn-primary btn-lg btn-block" data-gateway="${p.nominal}" data-nama="${namaPilihan(p)}">Bayar ${money(p.nominal)}</button>
        </div>
        <p class="pay-now-how">Metode: <b>${esc(namaMetode(inv.metode))}</b>. Status berubah <b>otomatis</b> begitu pembayaran diterima.</p>
        <p class="pay-msg form-message" role="alert"></p>
      </div>`;
    }

    const nominal = pilihan.map((p) =>
      `<div class="pay-now-row"><span>${p.label === "Sisa" ? "Sisa yang harus dilunasi" : p.label === "Lunas" ? "Bayar lunas" : `DP minimal (${Math.round(DP * 100)}%)`}</span><b>${money(p.nominal)}</b><button type="button" class="link-btn" data-salin="${p.nominal}">Salin</button></div>`).join("");

    const tombol = diTempat ? "" : `
      <div class="pay-now-actions">
        ${pilihan.map((p) => `<button type="button" class="btn ${p.utama ? "btn-primary" : "btn-quiet"} btn-lg btn-block" data-sudah="${p.nominal}">
          <svg><use href="#i-check"/></svg>Saya sudah bayar ${p.label === "Sisa" ? "sisa" : p.label === "Lunas" ? "lunas" : "DP"} ${money(p.nominal)}</button>`).join("")}
      </div>
      <p class="pay-msg form-message" role="alert"></p>
      <button type="button" class="link-btn pay-other-toggle">Bayar jumlah lain / tanggal lain?</button>
      ${formLain(inv, sisaBisaLapor, pertama)}`;

    return `<div class="pay-now">
      <h4>Bayar sekarang</h4>
      ${nominal}
      ${tujuanBayar(inv.metode)}
      ${diTempat ? "" : `<p class="pay-now-how">Setelah bayar, tekan <b>satu tombol</b> di bawah. Tidak perlu kirim bukti. Kami cek mutasi dan status berubah otomatis.</p>`}
      ${tombol}
    </div>`;
  }

  // Form manual (jarang dipakai): jumlah lain, metode lain, atau tanggal bayar kemarin
  function formLain(inv, sisaBisaLapor, pertama) {
    const min = pertama ? Math.round(inv.total * DP) : 1;
    return `<form class="pay-report is-hidden" novalidate>
      <div class="grid-2">
        <label class="field">Jumlah dibayar (Rp) <b>*</b><input name="jumlah" type="number" min="${min}" max="${Math.round(sisaBisaLapor)}" placeholder="${Math.round(sisaBisaLapor)}" /></label>
        <label class="field">Metode <b>*</b><select name="metode">${Backend.METODE.map((m) => `<option ${m === inv.metode ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
        <label class="field">Tanggal bayar <b>*</b><input name="tanggal" type="date" max="${today()}" value="${today()}" /></label>
        <label class="field">Catatan <small>opsional</small><input name="catatan" maxlength="300" placeholder="Transfer dari BCA a.n. …" /></label>
      </div>
      ${pertama ? `<p class="hint">Pembayaran pertama minimal DP ${Math.round(DP * 100)}% (${money(min)}).</p>` : ""}
      <p class="pay-form-msg form-message" role="alert"></p>
      <button type="submit" class="btn btn-primary btn-lg btn-block">Kirim</button>
    </form>`;
  }

  async function salin(btn) {
    const asli = btn.textContent;
    try { await navigator.clipboard.writeText(btn.dataset.salin); btn.textContent = "Tersalin ✓"; }
    catch (e) { btn.textContent = btn.dataset.salin; }
    window.setTimeout(() => (btn.textContent = asli), 1800);
  }

  /* ---------- Aksi ---------- */
  async function cekTagihan(kode, hp, { diam = false, box } = {}) {
    const msg = $("#billMessage");
    if (!diam) { msg.textContent = "Memeriksa…"; msg.className = "form-message"; }
    try {
      const data = await Backend.cekTagihan(kode, hp);
      aktif = { kode: data.kode, hp, data, box: box || aktif?.box || $("#billResult") };
      simpan(data.kode, hp);
      tampilkanPengingatAtas(data);
      if (!diam) { msg.textContent = ""; render(data); }
      return data;
    } catch (error) {
      if (!diam) {
        msg.textContent = /fetch|network|Supabase belum/i.test(error.message) ? "Tidak bisa terhubung ke server. Periksa internet Anda." : error.message;
        msg.className = "form-message is-error";
      }
      return null;
    }
  }

  async function kirimLaporan({ jumlah, metode, tanggal, catatan }) {
    await Backend.laporBayar(aktif.kode, aktif.hp, { jumlah, metode, tanggal, catatan });
    await cekTagihan(aktif.kode, aktif.hp);
  }

  // SEKALI TAP: "Saya sudah bayar DP / lunas / sisa" (metode sesuai pesanan, tanggal hari ini)
  async function laporCepat(jumlah, btn) {
    const inv = ambilInv(aktif.data);
    const msg = $(".pay-msg", aktif.box);
    btn.disabled = true;
    const teks = btn.innerHTML;
    btn.textContent = "Mengirim…";
    try {
      await kirimLaporan({ jumlah, metode: inv.metode, tanggal: today(), catatan: "" });
    } catch (error) {
      btn.disabled = false; btn.innerHTML = teks;
      if (msg) { msg.textContent = error.message; msg.className = "pay-msg form-message is-error"; }
    }
  }

  async function laporForm(event) {
    event.preventDefault();
    const f = event.currentTarget;
    const msg = $(".pay-form-msg", f);
    const salah = (teks) => { msg.textContent = teks; msg.className = "pay-form-msg form-message is-error"; };
    const jumlah = Number(f.jumlah.value || 0);
    if (!jumlah || jumlah <= 0) { salah("Isi jumlah yang dibayar."); f.jumlah.focus(); return; }
    const min = Number(f.jumlah.min || 1);
    if (jumlah < min) { salah(`Pembayaran pertama minimal ${money(min)}.`); f.jumlah.focus(); return; }
    if (!f.tanggal.value || f.tanggal.value > today()) { salah("Tanggal bayar tidak valid."); return; }
    const btn = $('[type="submit"]', f);
    btn.disabled = true;
    msg.textContent = "Mengirim…"; msg.className = "pay-form-msg form-message";
    try {
      await kirimLaporan({ jumlah, metode: f.metode.value, tanggal: f.tanggal.value, catatan: f.catatan.value.trim() });
    } catch (error) {
      salah(error.message);
      btn.disabled = false;
    }
  }

  /* ---------- PAYMENT GATEWAY (simulasi untuk demo) ----------
     Meniru halaman bayar Midtrans/Xendit. Metode diambil dari pilihan pembeli saat memesan.
     Setelah halaman bayar tampil, pembayaran dianggap masuk otomatis dalam ±15 detik
     (meniru notifikasi bank), lalu bayar_simulasi() mencatatnya di database.
     Di sistem sungguhan, pencatatan dilakukan oleh webhook payment gateway. */
  const DETIK_OTOMATIS = 15;
  const namaMetode = (m) => ({ "Transfer Bank": "Transfer Bank (Virtual Account BCA)", QRIS: "QRIS", "E-Wallet": "E-Wallet (GoPay / OVO / DANA)", "Kartu Debit/Kredit": "Kartu Debit / Kredit" }[m] || m);

  // Pola QR dari kode referensi
  function qrPalsu(seed) {
    let h = 7; for (const c of seed) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
    const n = 21; let kotak = "";
    const sudut = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let isi;
      if (sudut(x, y)) { const cx = x < 7 ? x : x - (n - 7), cy = y < 7 ? y : y - (n - 7); isi = cx === 0 || cy === 0 || cx === 6 || cy === 6 || (cx > 1 && cx < 5 && cy > 1 && cy < 5); }
      else { h = (Math.imul(h, 1103515245) + 12345) >>> 0; isi = ((h >>> 16) & 1) === 0; }
      if (isi) kotak += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" class="gw-qr" aria-label="Kode QRIS">${kotak}</svg>`;
  }

  async function bukaGateway(jumlah, nama) {
    // Cek status terbaru dulu: kalau sudah lunas / nominal berubah, tampilkan yang terbaru, jangan buka halaman bayar
    const terbaru = await cekTagihan(aktif.kode, aktif.hp, { diam: true });
    if (terbaru) {
      const invBaru = ambilInv(terbaru);
      if (!invBaru || Number(invBaru.sisa) <= 0 || jumlah > Number(invBaru.sisa) + 0.5) { render(terbaru); return; }
    }
    const metode = ambilInv(aktif.data).metode;
    const ref = "KP" + Date.now().toString().slice(-8);
    const dlg = document.createElement("dialog");
    dlg.className = "gw";
    let jam = null, detak = null;
    const tutup = () => { window.clearTimeout(jam); window.clearInterval(detak); dlg.close(); dlg.remove(); };
    const kepala = `<header class="gw-head"><div><b>KarsaPay</b><small>Pembayaran aman</small></div><button type="button" class="gw-x" aria-label="Tutup">×</button></header>`;

    const va = "8808" + String(Date.now()).slice(-8);
    const isiMetode = {
      QRIS: `${qrPalsu(ref)}<p class="gw-hint">Scan QR ini dari aplikasi bank atau e-wallet apa pun.</p>`,
      "Transfer Bank": `<div class="gw-va"><span>Nomor Virtual Account BCA</span><strong>${va.replace(/(\d{4})/g, "$1 ").trim()}</strong>
        <button type="button" class="link-btn" data-salin="${va}">Salin nomor</button></div><p class="gw-hint">m-BCA / KlikBCA → Transfer → BCA Virtual Account → masukkan nomor di atas.</p>`,
      "E-Wallet": `<div class="gw-va"><span>Kode bayar GoPay / OVO / DANA</span><strong>${ref}</strong>
        <button type="button" class="link-btn" data-salin="${ref}">Salin kode</button></div><p class="gw-hint">Buka aplikasi e-wallet → Bayar → masukkan kode di atas.</p>`,
      "Kartu Debit/Kredit": `<div class="gw-va"><span>Kartu terdaftar</span><strong>•••• •••• •••• 4821</strong></div><p class="gw-hint">Konfirmasi pembayaran di aplikasi bank penerbit kartu Anda.</p>`,
    }[metode] || "";

    const layarBayar = `${kepala}
      <div class="gw-amount"><span>${esc(aktif.kode)} · bayar ${esc(nama)} · ${esc(namaMetode(metode))}</span><strong>${money(jumlah)}</strong></div>
      <div class="gw-pay">${isiMetode}</div>
      <div class="gw-wait"><span class="gw-spin" aria-hidden="true"></span><span>Menunggu pembayaran… otomatis terkonfirmasi dalam <b class="gw-detik">${DETIK_OTOMATIS}</b> detik</span></div>
      <p class="gw-msg form-message" role="alert"></p>`;

    const layarSukses = (hasil) => `${kepala}
      <div class="gw-done"><div class="done-icon"><svg><use href="#i-check"/></svg></div>
        <h3>Pembayaran berhasil</h3><p>${money(jumlah)} · ${esc(namaMetode(metode))}<br><small>No. transaksi ${esc(hasil.ref)}</small></p>
        <p>Status tagihan sekarang: <b>${esc(hasil.status_bayar)}</b></p>
        <button type="button" class="btn btn-primary btn-lg btn-block gw-inv"><svg><use href="#i-receipt"/></svg>Lihat invoice</button>
        <button type="button" class="btn btn-quiet btn-lg btn-block gw-x">Selesai</button></div>`;

    function gambar(html) {
      dlg.innerHTML = html;
      $$(".gw-x", dlg).forEach((b) => b.addEventListener("click", tutup));
      $$("[data-salin]", dlg).forEach((b) => b.addEventListener("click", () => salin(b)));
      $(".gw-inv", dlg)?.addEventListener("click", () => { tutup(); lihatInvoice(aktif.data); });
    }

    async function terimaPembayaran() {
      try {
        const hasil = await Backend.bayarSimulasi(aktif.kode, aktif.hp, jumlah, metode);
        await cekTagihan(aktif.kode, aktif.hp);
        gambar(layarSukses(hasil));
      } catch (error) {
        const msg = $(".gw-msg", dlg); const tunggu = $(".gw-wait", dlg);
        if (tunggu) tunggu.remove();
        if (msg) { msg.textContent = error.message; msg.className = "gw-msg form-message is-error"; }
        cekTagihan(aktif.kode, aktif.hp); // tampilkan status terbaru di halaman
      }
    }

    document.body.appendChild(dlg);
    gambar(layarBayar);
    let sisaDetik = DETIK_OTOMATIS;
    detak = window.setInterval(() => {
      sisaDetik -= 1;
      const el = $(".gw-detik", dlg);
      if (el) el.textContent = Math.max(sisaDetik, 0);
      if (sisaDetik <= 0) window.clearInterval(detak);
    }, 1000);
    jam = window.setTimeout(terimaPembayaran, DETIK_OTOMATIS * 1000);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); tutup(); });
    dlg.showModal();
  }

  /* ---------- INVOICE untuk pembeli ---------- */
  function lihatInvoice(data) {
    const inv = data?.invoice;
    if (!inv) return;
    const harga = Number(inv.harga_per_pax || 0);
    const pax = Number(inv.jumlah_pax || data.jumlah_pax || 0);
    const subtotal = Number(inv.subtotal ?? Math.round(Number(inv.total) / 1.11));
    const ppn = Number(inv.pajak_ppn ?? Number(inv.total) - subtotal);
    const lunas = Number(inv.sisa) <= 0;
    const riwayat = (inv.riwayat || []).map((t, i, arr) => `<tr><td>${labelBayar(arr, i, inv.total)}</td><td>${tgl(t.tanggal)}</td><td>${esc(t.metode)}</td><td class="r">${money(t.jumlah)}</td></tr>`).join("");

    const el = document.createElement("div");
    el.className = "inv-overlay";
    el.innerHTML = `<div class="inv-sheet" role="dialog" aria-label="Invoice ${esc(inv.no_invoice)}">
      <div class="inv-tools">
        <span class="inv-msg" role="status"></span>
        <button type="button" class="btn btn-quiet btn-sm inv-pdf"><svg><use href="#i-receipt"/></svg>Unduh PDF</button>
        <button type="button" class="btn btn-primary btn-sm inv-close">Tutup</button>
      </div>
      <header class="inv-top">
        <div><img src="./img/logo.svg" alt="" onerror="this.remove()"/><h2>${esc(usaha.nama)}</h2>
          <p>${esc(usaha.alamat)}<br>${esc(usaha.telepon)} · ${esc(usaha.email)}</p></div>
        <div class="inv-title"><h1>INVOICE</h1><p><b>${esc(inv.no_invoice)}</b><br>Pesanan ${esc(inv.no_pesanan)} · ${esc(data.kode)}</p>
          <span class="inv-stamp ${lunas ? "is-paid" : ""}">${esc(statusPembeli(inv)).toUpperCase()}</span></div>
      </header>
      <section class="inv-meta">
        <div><span>Ditagihkan kepada</span><b>${esc(data.nama)}</b></div>
        <div><span>Tanggal invoice</span><b>${tgl(inv.tanggal_tagihan)}</b></div>
        <div><span>Tanggal acara</span><b>${tgl(data.tanggal_event)}</b></div>
        <div><span>Jatuh tempo</span><b>${tgl(inv.tanggal_tempo)}</b></div>
      </section>
      <table class="inv-table">
        <thead><tr><th>Keterangan</th><th class="r">Jumlah</th><th class="r">Harga</th><th class="r">Total</th></tr></thead>
        <tbody><tr><td><b>${esc(inv.jenis_paket || data.jenis_paket)}</b><br><small>${esc(data.nama_event)}</small></td>
          <td class="r">${pax.toLocaleString("id-ID")} pax</td><td class="r">${harga ? money(harga) : "—"}</td><td class="r">${money(subtotal)}</td></tr></tbody>
      </table>
      <div class="inv-sum">
        <div><span>Subtotal</span><b>${money(subtotal)}</b></div>
        <div><span>PPN 11%</span><b>${money(ppn)}</b></div>
        <div class="big"><span>Total tagihan</span><b>${money(inv.total)}</b></div>
        <div><span>Sudah dibayar</span><b>${money(inv.dibayar)}</b></div>
        <div class="${lunas ? "" : "due"}"><span>Sisa tagihan</span><b>${money(inv.sisa)}</b></div>
      </div>
      ${riwayat ? `<h3>Riwayat pembayaran</h3><table class="inv-table small"><thead><tr><th>Pembayaran</th><th>Tanggal</th><th>Metode</th><th class="r">Jumlah</th></tr></thead><tbody>${riwayat}</tbody></table>` : ""}
      <p class="inv-foot">${lunas ? "Terima kasih, pembayaran Anda sudah lunas." : `Mohon lunasi sisa tagihan paling lambat ${tgl(inv.tanggal_tempo)} melalui menu Cek tagihan di website kami.`}</p>
    </div>`;
    const tutup = () => { el.remove(); document.body.classList.remove("inv-printing"); };
    el.addEventListener("click", (e) => { if (e.target === el) tutup(); });
    $(".inv-close", el).addEventListener("click", tutup);
    $(".inv-pdf", el).addEventListener("click", async (e) => {
      const btn = e.currentTarget; const msg = $(".inv-msg", el);
      btn.disabled = true; msg.textContent = "Menyiapkan PDF…";
      try {
        const hasil = await simpanFile(buatPdf(data), `Invoice-${inv.no_invoice}.pdf`);
        msg.textContent = hasil === "batal" ? "Unduhan dibatalkan." : "PDF diunduh ✓";
      } catch (error) {
        msg.textContent = "PDF tidak bisa diunduh di sini.";
        console.warn(error);
      } finally { btn.disabled = false; }
    });
    document.body.appendChild(el);
  }


  /* ---------- INVOICE PDF: dibuat oleh js/pdf.js ---------- */
  const buatPdf = (data) => PdfKarsa.invoice(data);
  const simpanFile = (blob, namaFile) => PdfKarsa.simpan(blob, namaFile);

  // Tampilkan tagihan di kotak tertentu (dipakai halaman "Pesanan terkirim": langsung bisa bayar)
  async function tampilkanDi(box, kode, hp) {
    $("#billForm").kode.value = kode; $("#billForm").hp.value = hp;
    aktif = { kode, hp, data: null, box };
    box.innerHTML = '<p class="bill-note">Menyiapkan tagihan…</p>';
    const data = await cekTagihan(kode, hp, { diam: true, box });
    if (data) render(data, box);
    else box.innerHTML = '<p class="bill-note">Tagihan belum bisa dimuat. Buka menu <b>Cek tagihan</b> beberapa saat lagi.</p>';
  }

  // Buka di bagian "Cek tagihan"
  function buka(kode, hp) {
    const f = $("#billForm");
    f.kode.value = kode; f.hp.value = hp;
    aktif = { kode, hp, data: null, box: $("#billResult") };
    $("#tagihan").scrollIntoView({ behavior: "smooth" });
    cekTagihan(kode, hp);
  }

  /* ---------- Mulai ---------- */
  $("#billForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.kode.value.trim() || !f.hp.value.trim()) {
      $("#billMessage").textContent = "Isi kode pesanan dan nomor HP."; $("#billMessage").className = "form-message is-error"; return;
    }
    aktif = { ...(aktif || {}), box: $("#billResult") };
    const btn = $('button[type="submit"]', f);
    btn.disabled = true;
    // Setelah tagihan ketemu, layar langsung turun ke hasilnya (supaya terlihat, terutama di HP)
    cekTagihan(f.kode.value.trim(), f.hp.value.trim()).then((data) => {
      btn.disabled = false;
      if (data) $("#billResult").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // Pembeli yang pernah memesan / mengecek di browser ini: tagihan langsung tampil, tanpa mengetik ulang
  const tersimpan = ambilTersimpan();
  if (tersimpan?.kode && Backend.isConfigured) {
    $("#billForm").kode.value = tersimpan.kode;
    $("#billForm").hp.value = tersimpan.hp;
    aktif = { kode: tersimpan.kode, hp: tersimpan.hp, data: null, box: $("#billResult") };
    cekTagihan(tersimpan.kode, tersimpan.hp, { diam: true }).then((data) => data && render(data, $("#billResult")));
  }

  return { buka, simpan, tampilkanDi };
})();
