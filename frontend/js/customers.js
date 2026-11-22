/* Halaman Pelanggan: customer baru vs lama, dan riwayat pemesanan per customer. */
const Customers = {
  state: { search: "", filter: "all", openId: null },

  init() {
    $("#customerSearch").addEventListener("input", (e) => { this.state.search = e.target.value; this.render(); });
    $$("#customerFilter button").forEach((b) => b.addEventListener("click", () => {
      this.state.filter = b.dataset.filter;
      $$("#customerFilter button").forEach((x) => x.classList.toggle("is-active", x === b));
      this.render();
    }));
    $("#custDialogBook").addEventListener("click", () => {
      const c = this.list().find((x) => String(x.id) === String(this.state.openId));
      if (!c) return;
      $("#customerDialog").close();
      App.setActiveTab("booking");
      const form = $("#bookingForm");
      form.phone.value = c.no_hp;
      form.customerName.value = c.nama_pelanggan;
      form.email.value = c.email || "";
      Booking.lookupCustomer();
      form.eventName.focus();
    });
  },

  // Kelompokkan invoice per customer
  list() {
    const map = new Map();
    App.state.invoices.forEach((inv) => {
      const cust = customerOf(inv);
      if (!cust.id) return;
      if (!map.has(cust.id)) map.set(cust.id, { ...cust, orders: [] });
      map.get(cust.id).orders.push(inv);
    });
    return [...map.values()].map((c) => {
      c.orders.sort((a, b) => orderKey(b).localeCompare(orderKey(a)));
      c.count = c.orders.length;
      c.isRepeat = c.count >= 2;
      c.spent = c.orders.reduce((s, i) => s + Number(i.total_tagihan || 0), 0);
      c.paid = c.orders.reduce((s, i) => s + paidOf(i), 0);
      c.due = c.orders.reduce((s, i) => s + remainingOf(i), 0);
      c.last = c.orders[0];
      return c;
    });
  },

  stats() {
    const list = this.list();
    const lama = list.filter((c) => c.isRepeat).length;
    return { total: list.length, lama, baru: list.length - lama, rate: list.length ? Math.round((lama / list.length) * 100) : 0 };
  },

  render() {
    const stats = this.stats();
    $("#custTotal").textContent = stats.total;
    $("#custNew").textContent = stats.baru;
    $("#custRepeat").textContent = stats.lama;
    $("#custRate").textContent = `${stats.rate}%`;

    const needle = this.state.search.toLowerCase();
    const list = this.list()
      .filter((c) => !needle || `${c.nama_pelanggan} ${c.no_hp} ${c.email}`.toLowerCase().includes(needle))
      .filter((c) => this.state.filter === "all" || (this.state.filter === "repeat" ? c.isRepeat : !c.isRepeat))
      .sort((a, b) => b.spent - a.spent);
    $("#customerCount").textContent = `${list.length} customer ditampilkan`;
    const rows = $("#customerRows");
    if (!list.length) {
      rows.innerHTML = '<tr><td colspan="5"><div class="empty"><strong>Belum ada customer</strong>Customer tercatat otomatis saat booking disimpan.</div></td></tr>';
      return;
    }
    rows.innerHTML = list.map((c) => `<tr class="clickable" data-cust="${c.id}">
      <td><div class="who">${avatar(c.nama_pelanggan)}<div>
        <div class="cell-main">${escapeHtml(c.nama_pelanggan)}${c.isRepeat ? '<span class="tag repeat">Lama</span>' : '<span class="tag new">Baru</span>'}</div>
        <div class="cell-sub">${escapeHtml(c.no_hp)}${c.email ? `, ${escapeHtml(c.email)}` : ""}</div>
      </div></div></td>
      <td><span class="cell-main">${c.count}</span> <span class="muted">pesanan</span></td>
      <td class="num amount">${formatMoney(c.spent)}</td>
      <td class="num">${c.due ? `<span class="owed">${formatMoney(c.due)}</span>` : '<span class="muted">Tidak ada</span>'}</td>
      <td><div class="cell-main">${escapeHtml(orderOf(c.last).nama_event || "—")}</div><div class="cell-sub">${formatDate(orderOf(c.last).tanggal_event)}</div></td>
    </tr>`).join("");
    $$("[data-cust]", rows).forEach((r) => r.addEventListener("click", () => this.openHistory(r.dataset.cust)));
  },

  openHistory(id) {
    const c = this.list().find((x) => String(x.id) === String(id));
    if (!c) return;
    this.state.openId = c.id;
    $("#custDialogAvatar").outerHTML = avatar(c.nama_pelanggan, "avatar-lg").replace("<span", '<span id="custDialogAvatar"');
    $("#custDialogName").innerHTML = `${escapeHtml(c.nama_pelanggan)}${c.isRepeat ? '<span class="tag repeat">Customer lama</span>' : '<span class="tag new">Customer baru</span>'}`;
    $("#custDialogMeta").textContent = `${c.no_hp}${c.email ? ", " + c.email : ""}. Pelanggan sejak ${formatDate(c.created_at)}.`;
    $("#custDialogCount").textContent = c.count;
    $("#custDialogSpent").textContent = formatMoney(c.spent);
    $("#custDialogPaid").textContent = formatMoney(c.paid);
    $("#custDialogDue").textContent = formatMoney(c.due);
    $("#custDialogRows").innerHTML = c.orders.map((inv) => {
      const o = orderOf(inv);
      return `<tr class="clickable" data-open-inv="${inv.id}">
        <td><div class="cell-main">${escapeHtml(o.no_pesanan || "—")}</div><div class="cell-sub">${escapeHtml(inv.no_invoice)}</div></td>
        <td><div class="cell-main">${escapeHtml(o.nama_event)}</div><div class="cell-sub">${formatDate(o.tanggal_event)}</div></td>
        <td>${escapeHtml(o.jenis_paket)}<div class="cell-sub">${o.jumlah_pax} pax, ${escapeHtml(o.metode_pembayaran || "")}</div></td>
        <td class="num amount">${formatMoney(inv.total_tagihan)}</td>
        <td>${statusBadge(inv.status_bayar)}</td>
      </tr>`;
    }).join("");
    $$("[data-open-inv]").forEach((r) => r.addEventListener("click", () => {
      $("#customerDialog").close();
      Invoices.openPay(r.dataset.openInv);
    }));
    const dialog = $("#customerDialog");
    if (!dialog.open) dialog.showModal();
  },
};
