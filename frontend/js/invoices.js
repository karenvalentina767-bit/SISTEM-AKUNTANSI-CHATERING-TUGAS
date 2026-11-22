/* Halaman Invoice & pembayaran: tabel invoice, catat DP/cicilan/pelunasan, edit, hapus. */
const Invoices = {
  state: { search: "", filter: "all", payId: null },

  init() {
    $("#invoiceSearch").addEventListener("input", (e) => { this.state.search = e.target.value; this.render(); });
    $$("#invoiceFilter button").forEach((b) => b.addEventListener("click", () => this.setFilter(b.dataset.filter)));

    const edit = $("#editForm");
    edit.addEventListener("submit", (e) => this.submitEdit(e));
    ["pax", "pricePerPax", "packageType"].forEach((n) => edit[n].addEventListener("input", () => this.updateEditEstimate()));

    const pay = $("#payForm");
    pay.addEventListener("submit", (e) => this.submitPay(e));
    $$("[data-pay]").forEach((chip) => chip.addEventListener("click", () => {
      const inv = this.find(this.state.payId);
      if (!inv) return;
      const fraction = Number(chip.dataset.pay);
      // "DP 30%" = 30% dari total; "Jadi setengah" = sampai 50% terbayar; "Lunasi" = seluruh sisa
      const target = fraction === 0.3 ? inv.total_tagihan * 0.3 : inv.total_tagihan * fraction - paidOf(inv);
      pay.jumlah.value = Math.max(0, Math.min(Math.round(target), Math.round(remainingOf(inv)))) || "";
    }));
    $("#payPrint").addEventListener("click", () => this.state.payId && PrintInvoice.open(this.find(this.state.payId)));
  },

  setFilter(filter) {
    this.state.filter = filter;
    $$("#invoiceFilter button").forEach((b) => b.classList.toggle("is-active", b.dataset.filter === filter));
    this.render();
  },

  find(id) {
    return App.state.invoices.find((i) => String(i.id) === String(id));
  },

  filtered() {
    const needle = this.state.search.toLowerCase();
    const f = this.state.filter;
    return App.state.invoices.filter((inv) => {
      const order = orderOf(inv);
      const text = [inv.no_invoice, order.no_pesanan, order.nama_event, customerOf(inv).nama_pelanggan, customerOf(inv).no_hp].join(" ").toLowerCase();
      const okText = !needle || text.includes(needle);
      const okFilter = f === "all" ||
        (f === "open" && inv.status_bayar !== "Lunas") ||
        (f === "overdue" && isOverdue(inv)) ||
        inv.status_bayar === f;
      return okText && okFilter;
    });
  },

  render() {
    // Jumlah per filter
    const all = App.state.invoices;
    const counts = {
      all: all.length,
      open: all.filter((i) => i.status_bayar !== "Lunas").length,
      overdue: all.filter(isOverdue).length,
    };
    Backend.STATUS.forEach((st) => (counts[st] = all.filter((i) => i.status_bayar === st).length));
    $$("#invoiceFilter button").forEach((b) => {
      const label = b.dataset.label || (b.dataset.label = b.textContent);
      b.innerHTML = `${escapeHtml(label)}<span class="n">${counts[b.dataset.filter] ?? 0}</span>`;
    });

    const list = this.filtered();
    $("#invoiceCount").textContent = `Menampilkan ${list.length} dari ${all.length} invoice`;
    const rows = $("#invoiceRows");
    if (!list.length) {
      rows.innerHTML = `<tr><td colspan="6"><div class="empty"><strong>${all.length ? "Tidak ada invoice yang cocok" : "Belum ada invoice"}</strong>${all.length ? "Ubah kata kunci atau pilih filter lain." : "Invoice dibuat otomatis saat booking disimpan."}</div></td></tr>`;
      return;
    }
    rows.innerHTML = list.map((inv) => {
      const order = orderOf(inv);
      const cust = customerOf(inv);
      const pct = inv.total_tagihan ? Math.min(100, Math.round((paidOf(inv) / inv.total_tagihan) * 100)) : 0;
      const open = inv.status_bayar !== "Lunas";
      const due = open ? dueLabel(inv) : null;
      const showDue = due && (due.cls === "late" || daysBetween(today(), inv.tanggal_tempo) <= PENGATURAN.hariPengingat);
      return `<tr>
        <td>
          <div class="cell-main">${escapeHtml(order.no_pesanan || "—")}</div>
          <div class="cell-sub">${escapeHtml(inv.no_invoice)}</div>
        </td>
        <td>
          <div class="who">${avatar(cust.nama_pelanggan)}<div>
            <div class="cell-main">${escapeHtml(cust.nama_pelanggan || "—")}${customerTypeBadge(inv)}</div>
            <div class="inputter">Diinput ${escapeHtml(order.pembuat?.nama || "—")} ${roleBadge(order.pembuat?.role)}</div>
          </div></div>
        </td>
        <td>
          <div class="cell-main">${escapeHtml(order.nama_event || "—")}</div>
          <div class="cell-sub">${formatDate(order.tanggal_event)}, ${order.jumlah_pax || 0} pax, ${escapeHtml(order.jenis_paket || "")}</div>
        </td>
        <td class="num">
          <div class="amount">${formatMoney(inv.total_tagihan)}</div>
          <div class="bar"><span style="width:${pct}%"></span></div>
          <div class="cell-sub">${open ? `<span class="owed">Sisa ${formatMoney(remainingOf(inv))}</span>` : "Lunas dibayar"}</div>
        </td>
        <td>
          ${statusBadge(inv.status_bayar)}
          <div class="cell-sub">${escapeHtml(order.metode_pembayaran || "—")}</div>
          ${showDue ? `<span class="${due.cls}">${due.text}</span>` : ""}
        </td>
        <td>
          <div class="actions">
            ${open && App.can("tulis")
              ? `<button class="btn btn-primary btn-sm" data-act="pay" data-id="${inv.id}">Bayar</button>`
              : `<button class="btn btn-quiet btn-sm" data-act="pay" data-id="${inv.id}">Riwayat</button>`}
            <button class="icon-btn" data-act="pdf" data-id="${inv.id}" title="Cetak invoice PDF" aria-label="Cetak invoice PDF">${icon("file")}</button>
            ${App.can("tulis") ? `<button class="icon-btn" data-act="edit" data-id="${inv.id}" title="Edit booking" aria-label="Edit booking">${icon("edit")}</button>` : ""}
            ${App.can("hapus") ? `<button class="icon-btn danger" data-act="delete" data-id="${inv.id}" title="Hapus pesanan" aria-label="Hapus pesanan">${icon("trash")}</button>` : ""}
          </div>
        </td>
      </tr>`;
    }).join("");
    $$("[data-act]", rows).forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.id;
      ({ pay: () => this.openPay(id), pdf: () => PrintInvoice.open(this.find(id)), edit: () => this.openEdit(id), delete: () => this.remove(id, b) })[b.dataset.act]();
    }));
  },

  /* ----- Dialog pembayaran ----- */
  openPay(id) {
    const inv = this.find(id);
    if (!inv) return;
    this.state.payId = inv.id;
    const order = orderOf(inv);
    const cust = customerOf(inv);
    $("#payTitle").textContent = `${cust.nama_pelanggan || "Customer"}, ${order.nama_event || ""}`;
    $("#paySubtitle").textContent = `Pesanan ${order.no_pesanan || "—"}, invoice ${inv.no_invoice}, event ${formatDate(order.tanggal_event)}`;
    $("#payTotal").textContent = formatMoney(inv.total_tagihan);
    $("#payPaid").textContent = formatMoney(paidOf(inv));
    $("#payRemaining").textContent = formatMoney(remainingOf(inv));
    const status = $("#payStatus");
    status.textContent = inv.status_bayar;
    status.className = `pill ${STATUS_CLASS[inv.status_bayar]}`;
    const pct = inv.total_tagihan ? Math.min(100, (paidOf(inv) / inv.total_tagihan) * 100) : 0;
    $("#payProgress").style.width = `${pct}%`;
    $("#payMeta").innerHTML = `<span>Metode <b>${escapeHtml(order.metode_pembayaran || "—")}</b></span><span>Jatuh tempo <b>${formatDate(inv.tanggal_tempo)}</b></span><span>Diinput oleh <b>${escapeHtml(order.pembuat?.nama || "—")}</b> ${roleBadge(order.pembuat?.role)}</span>`;

    const form = $("#payForm");
    form.reset();
    form.tanggal.value = today();
    form.metode.value = order.metode_pembayaran || "Transfer Bank";
    form.jumlah.max = Math.round(remainingOf(inv));
    form.classList.toggle("is-hidden", inv.status_bayar === "Lunas");
    setMessage($("#payMessage"), "");

    const history = (inv.transaksi_bayar || []).slice().sort((a, b) => `${a.tanggal}${a.created_at}`.localeCompare(`${b.tanggal}${b.created_at}`));
    let running = 0;
    $("#payHistory").innerHTML = history.length
      ? history.map((t) => {
          running += Number(t.jumlah);
          return `<div class="history-row">
            <div><div class="cell-main">${formatDate(t.tanggal)}, ${escapeHtml(t.metode)}</div><div class="cell-sub">${t.catatan ? `${escapeHtml(t.catatan)}. ` : ""}Dicatat ${escapeHtml(t.pencatat?.nama || "sistem")} ${roleBadge(t.pencatat?.role)}</div></div>
            <div class="history-amount"><strong>+ ${formatMoney(t.jumlah)}</strong>${statusBadge(Backend.hitungStatus(running, inv.total_tagihan))}</div>
            ${App.can("hapus") ? `<button class="icon-btn danger" data-del-trx="${t.id}" title="Hapus transaksi" aria-label="Hapus transaksi">${icon("trash")}</button>` : ""}
          </div>`;
        }).join("")
      : '<div class="empty"><strong>Belum ada pembayaran</strong>Catat DP atau pelunasan di atas.</div>';
    $$("[data-del-trx]").forEach((b) => b.addEventListener("click", () => this.removeTransaction(b.dataset.delTrx)));

    const dialog = $("#payDialog");
    if (!dialog.open) dialog.showModal();
  },

  async submitPay(event) {
    event.preventDefault();
    const inv = this.find(this.state.payId);
    const form = event.currentTarget;
    const jumlah = Number(form.jumlah.value);
    if (jumlah > remainingOf(inv) + 0.5) return setMessage($("#payMessage"), `Jumlah melebihi sisa tagihan (${formatMoney(remainingOf(inv))}).`, "error");
    const button = $('[type="submit"]', form);
    button.disabled = true;
    try {
      await Backend.catatPembayaran(inv.id, {
        tanggal: form.tanggal.value, jumlah, metode: form.metode.value, catatan: form.catatan.value,
      });
      const newStatus = Backend.hitungStatus(paidOf(inv) + jumlah, inv.total_tagihan);
      showToast(`Pembayaran ${formatMoney(jumlah)} tersimpan. Status sekarang ${newStatus}.`);
      await App.reload();
      this.openPay(inv.id);
    } catch (error) {
      setMessage($("#payMessage"), `Gagal menyimpan: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  },

  async removeTransaction(id) {
    if (!window.confirm("Hapus transaksi pembayaran ini? Status invoice akan dihitung ulang.")) return;
    try {
      await Backend.hapusTransaksi(id);
      showToast("Transaksi dihapus.");
      await App.reload();
      this.openPay(this.state.payId);
    } catch (error) {
      showToast(`Gagal menghapus: ${error.message}`, true);
    }
  },

  /* ----- Edit booking ----- */
  openEdit(id) {
    const inv = this.find(id);
    if (!inv) return;
    const order = orderOf(inv);
    const form = $("#editForm");
    form.dataset.invoiceId = inv.id;
    form.dataset.pesananId = inv.pesanan_id;
    $("#editOrderNo").textContent = order.no_pesanan || "";
    form.eventName.value = order.nama_event || "";
    form.eventDate.value = String(order.tanggal_event || "").slice(0, 10);
    form.packageType.value = order.jenis_paket || "";
    form.pax.value = order.jumlah_pax || "";
    form.pricePerPax.value = order.harga_per_pax || "";
    form.paymentMethod.value = order.metode_pembayaran || "Transfer Bank";
    form.billingDate.value = String(inv.tanggal_tagihan || "").slice(0, 10);
    form.dueDate.value = String(inv.tanggal_tempo || "").slice(0, 10);
    setMessage($("#editMessage"), "");
    this.updateEditEstimate();
    $("#editDialog").showModal();
  },

  updateEditEstimate() {
    const form = $("#editForm");
    $("#editEstimatedTotal").textContent = formatMoney(Backend.hitungTagihan(form.pax.value, form.pricePerPax.value).total);
    const min = minimalPax(form.packageType.value);
    const hint = $("#editMinPaxHint");
    hint.textContent = `Minimal ${min} pax`;
    hint.classList.toggle("is-error", Number(form.pax.value || 0) < min);
  },

  async submitEdit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#editMessage");
    const min = minimalPax(form.packageType.value);
    if (Number(form.pax.value) < min) return setMessage(message, `Minimal pemesanan paket ini ${min} pax.`, "error");
    const inv = this.find(form.dataset.invoiceId);
    const newTotal = Backend.hitungTagihan(form.pax.value, form.pricePerPax.value).total;
    if (inv && newTotal < paidOf(inv)) return setMessage(message, `Total baru lebih kecil dari yang sudah dibayar (${formatMoney(paidOf(inv))}).`, "error");

    const button = $('[type="submit"]', form);
    button.disabled = true;
    setMessage(message, "Menyimpan perubahan...");
    try {
      await Backend.ubahBooking({
        invoiceId: form.dataset.invoiceId,
        pesananId: form.dataset.pesananId,
        values: {
          eventName: form.eventName.value, eventDate: form.eventDate.value, packageType: form.packageType.value,
          pax: form.pax.value, pricePerPax: form.pricePerPax.value, paymentMethod: form.paymentMethod.value,
          billingDate: form.billingDate.value, dueDate: form.dueDate.value,
        },
      });
      showToast("Perubahan berhasil disimpan.");
      $("#editDialog").close();
      await App.reload();
    } catch (error) {
      setMessage(message, `Perubahan belum tersimpan: ${error.message}`, "error");
    } finally {
      button.disabled = false;
    }
  },

  /* ----- Hapus (owner) ----- */
  async remove(id, button) {
    const inv = this.find(id);
    if (!inv || !App.can("hapus")) return;
    const order = orderOf(inv);
    const ok = window.confirm(`Hapus pesanan ${order.no_pesanan} "${order.nama_event}" beserta invoice dan riwayat pembayarannya? Tindakan ini tidak bisa dibatalkan.`);
    if (!ok) return;
    button.disabled = true;
    try {
      await Backend.hapusBooking(inv.pesanan_id);
      showToast(`Pesanan ${order.no_pesanan} dihapus.`);
      await App.reload();
    } catch (error) {
      button.disabled = false;
      showToast(`Gagal menghapus: ${error.message}`, true);
    }
  },
};
