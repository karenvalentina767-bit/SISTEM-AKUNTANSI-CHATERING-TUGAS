/* Halaman "Konfirmasi bayar": laporan "Saya sudah bayar" dari pembeli (menu Cek tagihan di website).
   Verifikasi → tercatat sebagai pembayaran resmi, status invoice berubah otomatis (DP / Setengah / Lunas).
   Tolak → bila uangnya tidak ditemukan. */
const PayReports = {
  filter: "Menunggu",

  init() {
    $$("#payFilter button").forEach((b) => b.addEventListener("click", () => {
      this.filter = b.dataset.filter;
      $$("#payFilter button").forEach((x) => x.classList.toggle("is-active", x === b));
      this.render();
    }));
  },

  list() { return App.state.payReports || []; },
  menunggu() { return this.list().filter((r) => r.status === "Menunggu"); },

  render() {
    const n = this.menunggu().length;
    $("#navPay").textContent = n || "";
    const counts = {};
    this.list().forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));
    $$("#payFilter button").forEach((b) => {
      const k = b.dataset.filter;
      b.innerHTML = `${k === "all" ? "Semua" : k}<span class="n">${k === "all" ? this.list().length : counts[k] || 0}</span>`;
    });

    const rows = this.list().filter((r) => this.filter === "all" || r.status === this.filter);
    const box = $("#payReportList");
    if (!rows.length) {
      box.innerHTML = `<div class="empty panel"><strong>${this.filter === "Menunggu" ? "Tidak ada pembayaran yang perlu dicek" : "Tidak ada data"}</strong>Laporan muncul saat pembeli menekan "Saya sudah bayar" di menu Cek tagihan.</div>`;
      return;
    }
    box.innerHTML = rows.map((r) => this.card(r)).join("");
    $$("[data-verif]", box).forEach((b) => b.addEventListener("click", () => this.verify(b.dataset.verif, b)));
    $$("[data-tolak-bayar]", box).forEach((b) => b.addEventListener("click", () => this.reject(b.dataset.tolakBayar)));
  },

  card(r) {
    const pm = r.pesanan_masuk || {};
    const inv = r.pembayaran || {};
    // Belum ada invoice = pembayaran pertama untuk pesanan online baru. Verifikasi sekaligus menerima pesanannya.
    const pesananBaru = !inv.id;
    const paket = PACKAGES.find((p) => p.name === pm.jenis_paket);
    const total = pesananBaru ? (paket ? Backend.hitungTagihan(pm.jumlah_pax, paket.price).total : 0) : Number(inv.total_tagihan || 0);
    const sisa = Math.max(0, total - Number(inv.jumlah_dibayar || 0));
    const lunasiSemua = r.status === "Menunggu" && total > 0 && Number(r.jumlah) >= sisa - 0.5;
    const date = toDate(r.tanggal);
    const statusCls = { Menunggu: "s-dp", Diterima: "s-lunas", Ditolak: "s-belum" }[r.status];
    const aksi = r.status === "Menunggu"
      ? `${waButton(pm.no_hp, `${sapaan(pm.nama)}\n\nKami sedang mengecek pembayaran *${formatMoney(r.jumlah)}* untuk pesanan *${pm.kode}* lewat ${r.metode} (${formatDate(r.tanggal)}). Boleh kirimkan bukti transfernya, Kak? Terima kasih 🙏`)}
         <button class="btn btn-quiet btn-sm" data-perlu="tulis" data-tolak-bayar="${r.id}">Tolak</button>
         <button class="btn btn-primary btn-sm" data-perlu="tulis" data-verif="${r.id}">${icon("plus")}Verifikasi</button>`
      : `<p class="online-meta">${r.status} ${r.diproses_pada ? formatDate(r.diproses_pada) : ""}${r.pemroses?.nama ? ` oleh ${escapeHtml(r.pemroses.nama)}` : ""}</p>`;
    return `<article class="online-card ${r.status === "Menunggu" ? "is-new" : ""}">
      <div class="datebox"><strong>${date.getDate()}</strong><span>${monthShort.format(date)}</span></div>
      <div class="online-main">
        <div class="online-top">
          <span class="online-code">${escapeHtml(pm.kode || "")} · ${pesananBaru ? "pesanan baru" : escapeHtml(inv.no_invoice || "")}</span>
          <span class="pill ${statusCls}">${escapeHtml(r.status)}</span>
        </div>
        <h3>${escapeHtml(pm.nama || "Pembeli")} — ${escapeHtml(pm.nama_event || "")}</h3>
        <p class="online-who">${escapeHtml(pm.no_hp || "")} · dibayar ${formatDate(r.tanggal)} lewat <b>${escapeHtml(r.metode)}</b></p>
        ${r.catatan ? `<p class="online-note">“${escapeHtml(r.catatan)}”</p>` : ""}
        ${r.status === "Menunggu" && pesananBaru
          ? `<p class="online-pack">${escapeHtml(pm.jenis_paket || "")}, ${Number(pm.jumlah_pax || 0).toLocaleString("id-ID")} pax · total ${total ? formatMoney(total) : "perlu harga"}${lunasiSemua ? " · <b>bayar lunas</b>" : ""}</p>
             <p class="online-paid">${icon("check")}<span>Verifikasi = <b>pesanan diterima</b> + invoice dibuat + pembayaran tercatat, sekaligus.</span></p>`
          : r.status === "Menunggu" ? `<p class="online-pack">Sisa tagihan saat ini ${formatMoney(sisa)}${lunasiSemua ? " · <b>laporan ini melunasi tagihan</b>" : ""}</p>` : ""}
      </div>
      <div class="online-side">
        <div class="online-est"><span>Dilaporkan</span><strong>${formatMoney(r.jumlah)}</strong></div>
        <div class="online-actions">${aksi}</div>
      </div>
    </article>`;
  },

  async verify(id, button) {
    const r = this.list().find((x) => String(x.id) === String(id));
    if (!r || !window.confirm(`Uang ${formatMoney(r.jumlah)} dari ${r.pesanan_masuk?.nama || "pembeli"} sudah benar-benar masuk?`)) return;
    button.disabled = true;
    try {
      const hasil = await Backend.verifikasiBayar(r.id);
      showToast(hasil?.pesanan_diterima
        ? `Pesanan ${r.pesanan_masuk?.kode || ""} diterima dan pembayaran ${formatMoney(r.jumlah)} tercatat.`
        : `Pembayaran ${formatMoney(r.jumlah)} tercatat. Status invoice diperbarui.`);
      await App.reload();
    } catch (error) {
      button.disabled = false;
      showToast(`Gagal verifikasi: ${error.message}`, true);
    }
  },

  async reject(id) {
    const r = this.list().find((x) => String(x.id) === String(id));
    if (!r || !window.confirm(`Tolak laporan ${formatMoney(r.jumlah)} dari ${r.pesanan_masuk?.nama || "pembeli"}?\nPilih ini bila uangnya tidak ditemukan.`)) return;
    try {
      await Backend.tolakLaporanBayar(r.id);
      showToast("Laporan pembayaran ditolak.");
      await App.reload();
    } catch (error) {
      showToast(`Gagal menolak: ${error.message}`, true);
    }
  },
};
