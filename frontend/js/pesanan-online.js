/* Halaman "Pesanan online": pesanan yang dikirim pembeli dari halaman utama website.
   Terima → form booking terisi otomatis → Simpan booking (pesanan ditandai Diterima).
   Tolak → pesanan ditandai Ditolak. */
const OnlineOrders = {
  filter: "Baru",
  query: "",

  init() {
    $$("#onlineFilter button").forEach((b) => b.addEventListener("click", () => {
      this.filter = b.dataset.filter;
      $$("#onlineFilter button").forEach((x) => x.classList.toggle("is-active", x === b));
      this.render();
    }));
    $("#onlineSearch").addEventListener("input", (e) => { this.query = e.target.value.trim().toLowerCase(); this.render(); });
  },

  list() { return App.state.online || []; },
  baru() { return this.list().filter((o) => o.status === "Baru"); },

  // Badge di menu + pengumuman di Ringkasan
  // Mode otomatis: tidak ada menu Pesanan online. Yang perlu tindakan owner hanya paket custom (harga belum ada).
  otomatis() { return PENGATURAN.simulasiPembayaran !== false; },
  customMenunggu() { return this.baru().filter((o) => this.estimasi(o) == null); },

  renderBadges() {
    if (this.otomatis()) {
      const custom = this.customMenunggu();
      $("#onlineAlert").classList.add("is-hidden"); // panel di bawah sudah cukup, tidak perlu banner lagi
      $("#customPending").classList.toggle("is-hidden", !custom.length);
      const box = $("#customPendingList");
      box.innerHTML = custom.map((o) => this.card(o)).join("");
      this.pasangAksi(box);
      return;
    }
    const n = this.baru().length;
    const bayar = PayReports.menunggu().length;
    ["#navOnline", "#navOnlineMobile"].forEach((s) => ($(s).textContent = n || ""));
    const alert = $("#onlineAlert");
    alert.classList.toggle("is-hidden", !n && !bayar);
    alert.dataset.tab = n ? "online" : "payments";
    $("#onlineAlertText").textContent = [n ? `${n} pesanan online baru` : "", bayar ? `${bayar} pembayaran perlu diverifikasi` : ""].filter(Boolean).join(" · ");
  },

  render() {
    this.renderBadges();
    const counts = { Baru: 0, Diterima: 0, Ditolak: 0 };
    this.list().forEach((o) => (counts[o.status] = (counts[o.status] || 0) + 1));
    $$("#onlineFilter button").forEach((b) => {
      const n = b.dataset.filter === "all" ? this.list().length : counts[b.dataset.filter] || 0;
      b.innerHTML = `${b.dataset.filter === "all" ? "Semua" : b.dataset.filter}<span class="n">${n}</span>`;
    });

    const q = this.query;
    const rows = this.list()
      .filter((o) => this.filter === "all" || o.status === this.filter)
      .filter((o) => !q || [o.kode, o.nama, o.no_hp, o.nama_event, o.jenis_paket].some((v) => String(v || "").toLowerCase().includes(q)));

    $("#onlineCount").textContent = rows.length ? `${rows.length} pesanan` : "";
    const box = $("#onlineList");
    if (!rows.length) {
      const kosong = this.filter === "Baru"
        ? "<strong>Belum ada pesanan baru</strong>Pesanan dari halaman utama website akan muncul di sini."
        : "<strong>Tidak ada pesanan</strong>Coba ubah filter atau kata kunci.";
      box.innerHTML = `<div class="empty panel">${kosong}</div>`;
      return;
    }
    box.innerHTML = rows.map((o) => this.card(o)).join("");
    this.pasangAksi(box);
  },

  pasangAksi(box) {
    $$("[data-terima]", box).forEach((b) => b.addEventListener("click", () => this.acceptQuick(b.dataset.terima, b)));
    $$("[data-form-lengkap]", box).forEach((b) => b.addEventListener("click", () => this.accept(b.dataset.formLengkap)));
    $$("[data-verif-online]", box).forEach((b) => b.addEventListener("click", () => PayReports.verify(b.dataset.verifOnline, b)));
    $$("[data-tolak]", box).forEach((b) => b.addEventListener("click", () => this.reject(b.dataset.tolak)));
    $$("[data-hapus-online]", box).forEach((b) => b.addEventListener("click", () => this.remove(b.dataset.hapusOnline)));
  },

  estimasi(o) {
    const paket = PACKAGES.find((p) => p.name === o.jenis_paket);
    if (!paket) return null;
    return Backend.hitungTagihan(o.jumlah_pax, paket.price).total;
  },

  // "Transfer Bank · Bayar setengah · tempo 30 hari"
  bayarText(o) {
    const pct = PENGATURAN.dpMinimalPersen || 50;
    const skema = { DP: `DP ${pct}% dulu, lunas H-${HARI_LUNAS_SEBELUM}`, Lunas: "Bayar lunas di awal", Setengah: "Bayar setengah", "Jatuh tempo": "Bayar nanti" }[o.skema_bayar] || o.skema_bayar;
    return `${o.metode_bayar || "Transfer Bank"} · ${skema}`;
  },

  // Nominal yang dibayar pembeli di awal sesuai pilihannya
  bayarAwal(o, total) {
    if (o.skema_bayar === "Lunas") return total;
    return Math.round(total * (PENGATURAN.dpMinimalPersen || 50) / 100);
  },

  card(o) {
    const est = this.estimasi(o);
    const date = toDate(o.tanggal_event);
    const sisaHari = daysBetween(today(), o.tanggal_event);
    const kapan = sisaHari < 0 ? `<span class="late">Tanggal sudah lewat</span>` : `<span class="soon">${sisaHari} hari lagi</span>`;
    const statusCls = { Baru: "s-dp", Diterima: "s-lunas", Ditolak: "s-belum" }[o.status];
    const diproses = o.status === "Baru" ? "" :
      `<p class="online-meta">${o.status} ${o.diproses_pada ? formatDate(o.diproses_pada) : ""}${o.pemroses?.nama ? ` oleh ${escapeHtml(o.pemroses.nama)}` : ""}${o.pesanan_event?.no_pesanan ? `, jadi booking <b>${escapeHtml(o.pesanan_event.no_pesanan)}</b>` : ""}</p>`;
    // Pembeli sudah lapor bayar? Owner cukup cek mutasi lalu klik "Uang sudah masuk":
    // pesanan diterima + invoice dibuat + pembayaran tercatat sekaligus.
    const lapor = o.status === "Baru" ? this.laporanMenunggu(o) : null;
    const custom = est == null;
    const aksi = o.status !== "Baru"
      ? `${o.status === "Ditolak" ? waButton(o.no_hp, this.pesanWa(o), "Kabari") : ""}${o.status === "Ditolak" ? `<button class="icon-btn danger" data-perlu="owner" data-hapus-online="${o.id}" title="Hapus" aria-label="Hapus">${icon("trash")}</button>` : ""}`
      : lapor && !custom
        ? `<button class="btn btn-quiet btn-sm" data-perlu="tulis" data-tolak="${o.id}">Tolak</button>
           <button class="btn btn-primary btn-sm" data-perlu="tulis" data-verif-online="${lapor.id}">${icon("plus")}Uang sudah masuk</button>`
        : `${waButton(o.no_hp, this.pesanWa(o))}
           <button class="btn btn-quiet btn-sm" data-perlu="tulis" data-tolak="${o.id}">Tolak</button>
           ${custom ? `<label class="online-price" data-perlu="tulis">Rp/pax<input type="number" min="1" step="1000" inputmode="numeric" data-harga-for="${o.id}" placeholder="harga" /></label>` : ""}
           <button class="btn btn-primary btn-sm" data-perlu="tulis" data-terima="${o.id}">${icon("plus")}Terima</button>`;
    const formLengkap = o.status === "Baru"
      ? `<button type="button" class="link-btn online-more" data-perlu="tulis" data-form-lengkap="${o.id}">Ubah detail dulu (form lengkap)</button>` : "";
    const infoLapor = lapor
      ? `<p class="online-paid">${icon("cash")}<span>Pembeli sudah lapor bayar <b>${formatMoney(lapor.jumlah)}</b> lewat ${escapeHtml(lapor.metode)} (${formatDate(lapor.tanggal)}). Cek mutasi, lalu klik <b>Uang sudah masuk</b>.</span></p>`
      : "";

    return `<article class="online-card ${o.status === "Baru" ? "is-new" : ""}">
      <div class="datebox"><strong>${date.getDate()}</strong><span>${monthShort.format(date)}</span></div>
      <div class="online-main">
        <div class="online-top">
          <span class="online-code">${escapeHtml(o.kode || "")}</span>
          <span class="pill ${statusCls}">${escapeHtml(o.status)}</span>
          <span class="online-time">masuk ${formatDate(o.created_at)}</span>
        </div>
        <h3>${escapeHtml(o.nama_event)}</h3>
        <p class="online-who">${escapeHtml(o.nama)} · ${escapeHtml(o.no_hp)}${o.email ? ` · ${escapeHtml(o.email)}` : ""}</p>
        <p class="online-pack"><b>${escapeHtml(o.jenis_paket)}</b>, ${Number(o.jumlah_pax).toLocaleString("id-ID")} pax · ${formatDate(o.tanggal_event)} ${kapan}</p>
        <p class="online-pay">${icon("cash")}${escapeHtml(this.bayarText(o))}</p>
        ${o.catatan ? `<p class="online-note">“${escapeHtml(o.catatan)}”</p>` : ""}
        ${infoLapor}
        ${diproses}
      </div>
      <div class="online-side">
        <div class="online-est"><span>${o.status === "Baru" ? "Total" : "Estimasi"}</span><strong>${est ? formatMoney(est) : "Perlu harga"}</strong></div>
        <div class="online-actions">${aksi}</div>
        ${formLengkap}
      </div>
    </article>`;
  },

  // Pesan WhatsApp sesuai keadaan pesanan
  pesanWa(o) {
    const detail = `*${o.kode}* (${o.jenis_paket}, ${Number(o.jumlah_pax).toLocaleString("id-ID")} pax, ${formatDate(o.tanggal_event)})`;
    if (o.status === "Ditolak") {
      return `${sapaan(o.nama)}\n\nMohon maaf, pesanan ${detail} untuk acara *${o.nama_event}* belum bisa kami layani. ` +
        `Apakah Kakak berkenan dengan tanggal atau paket lain? Kami siap bantu carikan alternatifnya 🙏`;
    }
    if (this.estimasi(o) == null) {
      return `${sapaan(o.nama)}\n\nTerima kasih atas pesanan ${detail} untuk acara *${o.nama_event}*.\n` +
        `Untuk paket custom ini, kami ingin konfirmasi detail menu dan harganya dulu. Kapan Kakak ada waktu untuk ngobrol sebentar?`;
    }
    return `${sapaan(o.nama)}\n\nTerima kasih atas pesanan ${detail} untuk acara *${o.nama_event}*.\n` +
      `Total tagihan *${formatMoney(this.estimasi(o))}*. Pembayaran bisa langsung lewat menu *Cek tagihan* di website kami dengan kode pesanan di atas. Ada yang ingin ditanyakan, Kak?`;
  },

  // Laporan "Saya sudah bayar" yang masih menunggu untuk pesanan ini
  laporanMenunggu(o) {
    return PayReports.menunggu().find((r) => String(r.pesanan_masuk_id) === String(o.id)) || null;
  },

  // TERIMA 1 KLIK: booking + invoice langsung jadi (jatuh tempo H-1 sebelum acara).
  async acceptQuick(id, button) {
    const o = this.list().find((x) => String(x.id) === String(id));
    if (!o) return;
    const est = this.estimasi(o);
    let harga = null;
    if (est == null) {
      harga = Number($(`[data-harga-for="${o.id}"]`)?.value || 0);
      if (!harga || harga <= 0) { showToast("Paket custom: isi harga per pax dulu.", true); $(`[data-harga-for="${o.id}"]`)?.focus(); return; }
    }
    const total = est ?? Backend.hitungTagihan(o.jumlah_pax, harga).total;
    if (!window.confirm(`Terima pesanan ${o.kode} (${o.nama}) senilai ${formatMoney(total)}?\nTagihan langsung muncul di halaman pembeli.`)) return;
    button.disabled = true;
    try {
      const hasil = await Backend.terimaCepat(o.id, harga);
      showToast(`Pesanan ${o.kode} diterima → ${hasil.no_invoice}. Pembeli sudah bisa bayar.`);
      await App.reload();
    } catch (error) {
      button.disabled = false;
      showToast(`Gagal menerima pesanan: ${error.message}`, true);
    }
  },

  // Isi form booking dari pesanan online (untuk mengubah detail sebelum diterima)
  accept(id) {
    const o = this.list().find((x) => String(x.id) === String(id));
    if (!o) return;
    const form = $("#bookingForm");
    form.reset();
    Booking.requestId = o.id;
    form.phone.value = o.no_hp;
    form.customerName.value = o.nama;
    form.email.value = o.email || "";
    form.eventName.value = o.nama_event;
    form.eventDate.value = o.tanggal_event;
    form.pax.value = o.jumlah_pax;
    const idx = PACKAGES.findIndex((p) => p.name === o.jenis_paket);
    App.setActiveTab("booking");
    if (idx >= 0) pilihPaket(idx);
    else { form.packageType.value = o.jenis_paket; form.pricePerPax.value = ""; }
    Booking.lookupCustomer();
    // Jalankan setelah reset form selesai (reset mengembalikan tanggal & metode ke bawaan)
    window.setTimeout(() => {
      form.paymentMethod.value = o.metode_bayar || "Transfer Bank";
      form.dueDate.value = jatuhTempoAcara(o.tanggal_event); // aturan: wajib lunas H-1 sebelum acara
      Booking.update();
    }, 0);
    const harga = idx >= 0 ? PACKAGES[idx].price : 0;
    const total = Backend.hitungTagihan(o.jumlah_pax, harga).total;
    const awal = this.bayarAwal(o, total);
    const rencana = o.skema_bayar === "Lunas"
      ? `bayar <b>lunas di awal</b>${harga ? ` (${formatMoney(awal)})` : ""}`
      : `bayar <b>DP ${PENGATURAN.dpMinimalPersen || 50}%</b>${harga ? ` (${formatMoney(awal)})` : ""}, lunas paling lambat <b>H-${HARI_LUNAS_SEBELUM}</b> (${formatDate(jatuhTempoAcara(o.tanggal_event))})`;
    const banner = $("#fromOnline");
    banner.innerHTML = `<div><b>Dari pesanan online ${escapeHtml(o.kode)}.</b> Metode <b>${escapeHtml(o.metode_bayar || "Transfer Bank")}</b> dan jatuh tempo sudah terisi sesuai pilihan pembeli. Pembeli memilih ${rencana}.
      Isi <b>Dibayar sekarang</b> hanya jika uangnya sudah diterima. Kalau belum, catat nanti di menu Invoice. Lalu klik <b>Simpan booking</b>.${o.catatan ? `<br>Catatan pembeli: “${escapeHtml(o.catatan)}”` : ""}${idx < 0 ? "<br><b>Paket custom:</b> isi harga per pax sesuai kesepakatan." : ""}</div>
      <button type="button" class="btn btn-quiet btn-sm" id="cancelOnline">Batal</button>`;
    banner.classList.remove("is-hidden");
    $("#cancelOnline").addEventListener("click", () => { form.reset(); App.setActiveTab(this.otomatis() ? "dashboard" : "online"); });
    window.scrollTo({ top: 0 });
  },

  async reject(id) {
    const o = this.list().find((x) => String(x.id) === String(id));
    const lapor = this.laporanMenunggu(o || {});
    if (!o || !window.confirm(`Tolak pesanan ${o.kode} dari ${o.nama}?\nJangan lupa kabari pembeli.${lapor ? `\n\nPembeli sudah lapor bayar ${formatMoney(lapor.jumlah)}: laporan itu ikut ditolak. Kembalikan uangnya bila sudah masuk.` : ""}`)) return;
    try {
      await Backend.tolakPesananMasuk(o.id);
      showToast(`Pesanan ${o.kode} ditolak.`);
      await App.reload();
    } catch (error) {
      showToast(`Gagal menolak pesanan: ${error.message}`, true);
    }
  },

  async remove(id) {
    const o = this.list().find((x) => String(x.id) === String(id));
    if (!o || !window.confirm(`Hapus permanen pesanan ${o.kode}?`)) return;
    try {
      await Backend.hapusPesananMasuk(o.id);
      showToast(`Pesanan ${o.kode} dihapus.`);
      await App.reload();
    } catch (error) {
      showToast(`Gagal menghapus: ${error.message}`, true);
    }
  },
};
