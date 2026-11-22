/* FRONTEND — inti aplikasi: utilitas, login & peran, navigasi, ringkasan, dan form booking.
   Semua akses database ada di backend/app.js (objek `Backend`). */

/* ---------------- Utilitas umum ---------------- */
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });
const monthShort = new Intl.DateTimeFormat("id-ID", { month: "short" });

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const formatMoney = (value) => money.format(Math.round(Number(value || 0))).replace(/\s/g, " ");
const toDate = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00`);
const formatDate = (value) => {
  if (!value) return "—";
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
};
const localISO = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
};
const today = () => localISO(new Date());
const addDays = (iso, days) => { const d = toDate(iso); d.setDate(d.getDate() + days); return localISO(d); };
// Aturan bayar: wajib lunas H-1 (sehari sebelum tanggal acara)
const HARI_LUNAS_SEBELUM = PENGATURAN.hariLunasSebelumAcara ?? 1;
const jatuhTempoAcara = (tanggalAcara) => addDays(tanggalAcara, -HARI_LUNAS_SEBELUM);
const daysBetween = (fromIso, toIso) => Math.round((toDate(toIso) - toDate(fromIso)) / 86400000);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 4000);
}

function setMessage(el, text, type = "") {
  el.textContent = text;
  el.className = el.className.replace(/\bis-(error|success)\b/g, "").trim();
  if (type) el.classList.add(`is-${type}`);
}

// Nomor HP → format internasional 62xxxx (sama dengan normalisasi_hp di database)
function normalisasiHp(hp) {
  const d = String(hp || "").replace(/\D/g, "");
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}

/* ---------------- WhatsApp ----------------
   Tombol "WhatsApp" membuka chat ke pelanggan dengan pesan yang sudah terisi (wa.me).
   Bisa dipakai dari HP maupun laptop (WhatsApp Web / Desktop). */
function waLink(hp, pesan) {
  const nomor = normalisasiHp(hp);
  return `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
}
function waButton(hp, pesan, label = "WhatsApp") {
  if (!hp) return "";
  return `<a class="btn btn-wa btn-sm" href="${escapeHtml(waLink(hp, pesan))}" target="_blank" rel="noopener">${icon("wa")}${escapeHtml(label)}</a>`;
}
const sapaan = (nama) => `Halo Kak ${String(nama || "").split(" ")[0]}, kami dari ${PENGATURAN.usaha.nama}.`;

// Pesan WA pengingat tagihan
function pesanPengingat(inv) {
  const o = orderOf(inv);
  const telat = daysBetween(inv.tanggal_tempo, today());
  const kapan = telat > 0 ? `sudah lewat ${telat} hari dari jatuh tempo ${formatDate(inv.tanggal_tempo)}`
    : telat === 0 ? "jatuh tempo hari ini" : `jatuh tempo ${formatDate(inv.tanggal_tempo)}`;
  return `${sapaan(customerOf(inv).nama_pelanggan)}\n\nMengingatkan tagihan *${inv.no_invoice}* untuk acara *${o.nama_event || ""}* (${formatDate(o.tanggal_event)}).\n` +
    `Sisa pembayaran *${formatMoney(remainingOf(inv))}*, ${kapan}.\n\nPelunasan bisa langsung lewat menu *Cek tagihan* di website kami. Terima kasih 🙏`;
}

/* ---------------- Helper data invoice ---------------- */
const orderOf = (inv) => inv.pesanan_event || {};
const customerOf = (inv) => orderOf(inv).pelanggan || {};
const paidOf = (inv) => Number(inv.jumlah_dibayar || 0);
const remainingOf = (inv) => Math.max(0, Number(inv.total_tagihan || 0) - paidOf(inv));
const isOverdue = (inv) => inv.status_bayar !== "Lunas" && inv.tanggal_tempo < today();
const STATUS_CLASS = { "Belum Bayar": "s-belum", DP: "s-dp", Setengah: "s-setengah", Lunas: "s-lunas" };
const statusBadge = (status) => `<span class="pill ${STATUS_CLASS[status] || ""}">${escapeHtml(status)}</span>`;
const roleBadge = (role) => role ? `<span class="role-pill r-${role}">${escapeHtml(role)}</span>` : "";

// Avatar inisial dengan warna tetap per nama
function initials(name) {
  const words = String(name || "?").replace(/^(PT|CV|Ibu|Bapak|Pak|Bu)\.?\s+/i, "").trim().split(/\s+/);
  return ((words[0] || "?")[0] + (words[1] ? words[1][0] : "")).toUpperCase();
}
function avatar(name, extra = "") {
  const n = [...String(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return `<span class="avatar c${(n % 5) + 1} ${extra}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}
const icon = (name) => `<svg><use href="#i-${name}"/></svg>`;
// Rp 65,9 jt — angka ringkas untuk kalimat
function shortMoney(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `Rp ${(v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (a >= 1e6) return `Rp ${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return formatMoney(v);
}

// Apakah pesanan ini adalah pesanan pertama si customer?
function isFirstOrder(inv) {
  const custId = customerOf(inv).id;
  const mine = App.state.invoices.filter((i) => customerOf(i).id === custId);
  const first = mine.reduce((a, b) => (orderKey(a) <= orderKey(b) ? a : b), inv);
  return first.id === inv.id;
}
const orderKey = (inv) => `${orderOf(inv).created_at || inv.created_at}|${String(orderOf(inv).id).padStart(10, "0")}`;

function customerTypeBadge(inv) {
  return isFirstOrder(inv)
    ? '<span class="tag new">Baru</span>'
    : '<span class="tag repeat">Lama</span>';
}

function dueLabel(inv) {
  const diff = daysBetween(today(), inv.tanggal_tempo);
  if (diff < 0) return { text: `Lewat ${-diff} hari`, cls: "late" };
  if (diff === 0) return { text: "Jatuh tempo hari ini", cls: "late" };
  return { text: `${diff} hari lagi`, cls: "soon" };
}

/* ---------------- Aplikasi ---------------- */
const App = {
  state: { profile: null, invoices: [], users: [], online: [], payReports: [], tab: "dashboard" },

  can(perm) {
    const role = this.state.profile?.role;
    if (perm === "tulis") return role === "owner" || role === "admin";
    if (perm === "hapus" || perm === "owner") return role === "owner";
    return Boolean(role);
  },

  async start() {
    $("#todayLabel").textContent = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

    renderKatalog();
    $$(".method-select").forEach((select) => {
      select.innerHTML = Backend.METODE.map((m) => `<option>${m}</option>`).join("");
    });
    this.bindNavigation();
    Booking.init();
    Invoices.init();
    Customers.init();
    Reports.init();
    Users.init();
    OnlineOrders.init();
    PayReports.init();
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
      $$("[data-close]", dialog).forEach((b) => b.addEventListener("click", () => dialog.close()));
    });

    $("#loginForm").addEventListener("submit", (event) => this.login(event));
    // Tampilkan akun admin tetap (dari backend/app.js) di samping form login
    const akun = Backend.AKUN_ADMIN;
    $("#demoEmail").textContent = akun.email;
    $("#demoPassword").textContent = akun.password;
    $("#demoFill").addEventListener("click", () => {
      const form = $("#loginForm");
      form.email.value = akun.email;
      form.password.value = akun.password;
      form.password.focus();
    });
    $("#logoutButton").addEventListener("click", () => this.logout());

    if (!Backend.isConfigured) {
      const banner = $("#configBanner");
      banner.textContent = "Supabase belum terhubung. Buka backend/app.js, isi SUPABASE_URL dan SUPABASE_ANON_KEY, lalu refresh halaman.";
      banner.classList.remove("is-hidden");
    }

    Backend.saatAuthBerubah((event) => {
      if (event === "SIGNED_OUT") this.showLogin();
    });

    try {
      let session = await Backend.sesiAktif();
      // Masuk otomatis memakai akun admin tetap (kecuali baru saja menekan Keluar)
      if (!session && Backend.AUTO_LOGIN && Backend.isConfigured && !sessionStorage.getItem("keluarManual")) {
        setMessage($("#loginMessage"), "Masuk otomatis...");
        await Backend.masuk(Backend.AKUN_ADMIN.email, Backend.AKUN_ADMIN.password);
        session = await Backend.sesiAktif();
      }
      if (session) await this.enter();
      else this.showLogin();
    } catch (error) {
      this.showLogin(error.message);
    }
  },

  showLogin(message = "") {
    this.state.profile = null;
    document.body.dataset.role = "";
    $("#appShell").classList.add("is-hidden");
    $("#loginScreen").classList.remove("is-hidden");
    setMessage($("#loginMessage"), message, message ? "error" : "");
  },

  async login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('[type="submit"]', form);
    button.disabled = true;
    setMessage($("#loginMessage"), "Memeriksa akun...");
    try {
      await Backend.masuk(form.email.value.trim(), form.password.value);
      sessionStorage.removeItem("keluarManual");
      form.reset();
      await this.enter();
    } catch (error) {
      setMessage($("#loginMessage"), error.message, "error");
    } finally {
      button.disabled = false;
    }
  },

  async logout() {
    sessionStorage.setItem("keluarManual", "1");
    await Backend.keluar();
    this.showLogin();
  },

  async enter() {
    const profile = await Backend.profilSaya();
    if (!profile || !profile.role) {
      await Backend.keluar();
      this.showLogin("Akun ini belum punya peran. Minta owner untuk mengaturnya.");
      return;
    }
    this.state.profile = profile;
    document.body.dataset.role = profile.role;
    const nama = profile.nama || profile.email || "Pengguna";
    $("#userName").textContent = nama;
    [$("#userAvatar"), $("#userAvatarMobile")].forEach((el) => (el.textContent = initials(nama)));
    const roleEl = $("#userRole");
    roleEl.textContent = profile.role;
    roleEl.className = `role-pill r-${profile.role}`;
    const hour = new Date().getHours();
    const waktu = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam";
    $("#greeting").textContent = `Selamat ${waktu}, ${nama.split(" ")[0]}`;
    $("#loginScreen").classList.add("is-hidden");
    $("#appShell").classList.remove("is-hidden");
    this.setActiveTab("dashboard");
    // Mode simulasi payment gateway: pembayaran tercatat otomatis, menu "Konfirmasi bayar" tidak diperlukan
    if (PENGATURAN.simulasiPembayaran !== false) {
      // Menu "Pesanan online" juga tidak perlu: pesanan yang dibayar langsung jadi invoice.
      // Paket custom yang butuh harga tampil di Ringkasan.
      ["#navPayItem", "#navOnlineItem", "#navOnlineMobileItem"].forEach((s) => $(s)?.classList.add("is-hidden"));
    }
    // Owner login → harga di catalog.js disalin ke database, supaya pembeli bisa langsung bayar dengan harga terbaru
    if (profile.role === "owner") {
      Backend.sinkronHargaPaket(PACKAGES).catch((e) =>
        console.warn("Sinkron harga paket gagal (jalankan ulang backend/schema.sql):", e.message));
    }
    await this.reload();
  },

  bindNavigation() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-tab]");
      if (button) this.setActiveTab(button.dataset.tab);
    });
    const shell = $("#appShell");
    $("#drawerOpen").addEventListener("click", () => shell.classList.add("drawer-open"));
    [$("#drawerClose"), $("#drawerBackdrop")].forEach((el) => el.addEventListener("click", () => shell.classList.remove("drawer-open")));
    $("#heroRemind").addEventListener("click", (event) => {
      event.preventDefault();
      $("#dueReminders").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  },

  setActiveTab(tab) {
    if (tab === "booking" && !this.can("tulis")) tab = "dashboard";
    if (tab === "users" && !this.can("owner")) tab = "dashboard";
    this.state.tab = tab;
    $$("[data-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
    $$("[data-view]").forEach((v) => v.classList.toggle("is-active", v.dataset.view === tab));
    $("#mobileTitle").textContent = {
      dashboard: "Ringkasan", online: "Pesanan online", payments: "Konfirmasi bayar", booking: "Catat booking", invoices: "Invoice", customers: "Pelanggan",
      reports: "Laporan", catalog: "Katalog paket", users: "Pengguna",
    }[tab];
    $("#appShell").classList.remove("drawer-open");
    window.scrollTo({ top: 0 });
    if (tab === "users") Users.load();
    if (tab === "reports") Reports.render();
    if (tab === "online") OnlineOrders.render();
    if (tab === "payments") PayReports.render();
  },

  // Ambil ulang semua data lalu gambar ulang semua halaman
  async reload() {
    try {
      this.state.invoices = await Backend.ambilInvoice();
    } catch (error) {
      showToast(`Gagal memuat data: ${error.message}`, true);
    }
    try {
      [this.state.online, this.state.payReports] = await Promise.all([Backend.ambilPesananMasuk(), Backend.ambilLaporanBayar()]);
    } catch (error) {
      this.state.online = [];
      this.state.payReports = [];
      showToast(/pesanan_masuk|laporan_bayar/.test(error.message)
        ? "Menu Pesanan online / Konfirmasi bayar belum aktif: jalankan ulang backend/schema.sql di Supabase."
        : `Gagal memuat pesanan online: ${error.message}`, true);
    }
    PayReports.render();
    OnlineOrders.render();
    Dashboard.render();
    Invoices.render();
    Customers.render();
    if (this.state.tab === "reports") Reports.render();
  },
};

/* ---------------- Ringkasan (dashboard) ---------------- */
const Dashboard = {
  chart: null,

  render() {
    const invoices = App.state.invoices;
    const cashIn = invoices.reduce((s, i) => s + paidOf(i), 0);
    const open = invoices.filter((i) => i.status_bayar !== "Lunas");
    const outstanding = open.reduce((s, i) => s + remainingOf(i), 0);
    const totalBilled = invoices.reduce((s, i) => s + Number(i.total_tagihan || 0), 0);
    const overdue = open.filter(isOverdue);
    const in30 = addDays(today(), 30);
    const upcoming = invoices
      .filter((i) => orderOf(i).tanggal_event >= today())
      .sort((a, b) => orderOf(a).tanggal_event.localeCompare(orderOf(b).tanggal_event));
    const next30 = upcoming.filter((i) => orderOf(i).tanggal_event <= in30);

    // Kalimat utama
    const hero = $("#heroSentence");
    if (!invoices.length) {
      hero.innerHTML = "Belum ada invoice. Catat booking pertama untuk mulai melihat posisi kas.";
    } else if (!outstanding) {
      hero.innerHTML = `Semua tagihan sudah lunas. Total <b>${shortMoney(cashIn)}</b> sudah diterima.`;
    } else {
      const lateText = overdue.length
        ? `<b>${overdue.length} tagihan</b> sudah lewat jatuh tempo.`
        : "Belum ada tagihan yang lewat jatuh tempo.";
      hero.innerHTML = `<b>${shortMoney(outstanding)}</b> masih di tangan customer. ${lateText}`;
    }
    $("#heroRemind").classList.toggle("is-hidden", !open.length);

    // Bar nilai invoice: uang yang sudah masuk vs piutang (sisa tagihan yang belum dibayar pelanggan)
    const parts = [
      { label: "Uang sudah diterima", cls: "seg-paid", value: cashIn },
      { label: `Piutang${open.length ? ` (${open.length} tagihan belum lunas)` : ""}`, cls: "seg-belum", value: outstanding },
    ];
    $("#heroTotal").textContent = formatMoney(totalBilled);
    $("#heroStack").innerHTML = parts.filter((p) => p.value > 0)
      .map((p) => `<span class="${p.cls}" style="flex:${p.value}" title="${p.label}: ${formatMoney(p.value)}"></span>`).join("");
    $("#heroLegend").innerHTML = parts
      .map((p) => `<li><i class="${p.cls}"></i><span>${p.label}</span><b>${formatMoney(p.value)}</b></li>`).join("");

    // Metrik
    $("#paidRevenue").textContent = formatMoney(cashIn);
    $("#outstandingReceivables").textContent = formatMoney(outstanding);
    $("#outstandingCount").textContent = `${open.length} invoice belum lunas`;
    $("#scheduledEvents").textContent = next30.length;
    $("#scheduledPax").textContent = `${next30.reduce((s, i) => s + Number(orderOf(i).jumlah_pax || 0), 0).toLocaleString("id-ID")} pax perlu disiapkan`;
    const stats = Customers.stats();
    $("#repeatRate").textContent = `${stats.rate}%`;
    $("#repeatNote").textContent = `${stats.lama} dari ${stats.total} customer`;
    $("#navOverdue").textContent = overdue.length || "";

    this.renderReminders(open);
    this.renderUpcoming(upcoming);
    this.renderMiniChart();
  },

  renderReminders(open) {
    const limit = addDays(today(), PENGATURAN.hariPengingat);
    const due = open
      .filter((i) => i.tanggal_tempo <= limit)
      .sort((a, b) => a.tanggal_tempo.localeCompare(b.tanggal_tempo));
    const late = due.filter((i) => i.tanggal_tempo < today()).length;
    $("#reminderSubtitle").textContent = due.length
      ? `${due.length} invoice perlu diingatkan, ${late} di antaranya sudah lewat jatuh tempo`
      : `Invoice belum lunas yang jatuh tempo dalam ${PENGATURAN.hariPengingat} hari atau sudah lewat`;
    const box = $("#dueReminders");
    if (!due.length) {
      box.innerHTML = '<div class="empty"><strong>Tidak ada tagihan mendesak</strong>Semua invoice belum jatuh tempo dalam waktu dekat.</div>';
      return;
    }
    box.innerHTML = due.slice(0, 6).map((inv) => {
      const label = dueLabel(inv);
      const cust = customerOf(inv);
      const date = toDate(inv.tanggal_tempo);
      return `<div class="row-item">
        <div class="datebox is-${label.cls}"><strong>${date.getDate()}</strong><span>${monthShort.format(date)}</span></div>
        <div>
          <div class="row-title">${escapeHtml(cust.nama_pelanggan || "Customer")}</div>
          <div class="row-sub">Sisa <b>${formatMoney(remainingOf(inv))}</b> dari ${escapeHtml(inv.no_invoice)}</div>
          <span class="${label.cls}">${label.text}</span>
        </div>
        <div class="row-actions">
          ${waButton(cust.no_hp, pesanPengingat(inv))}
          <button class="btn btn-quiet btn-sm" data-pay-open="${inv.id}">Detail</button>
        </div>
      </div>`;
    }).join("") + (due.length > 6 ? `<button class="more" data-tab="invoices">Lihat ${due.length - 6} invoice lainnya</button>` : "");
    $$("[data-pay-open]", box).forEach((b) => b.addEventListener("click", () => Invoices.openPay(b.dataset.payOpen)));
  },

  renderUpcoming(upcoming) {
    const box = $("#upcomingEvents");
    if (!upcoming.length) {
      box.innerHTML = '<div class="empty"><strong>Belum ada event terjadwal</strong>Booking baru akan muncul di sini.</div>';
      return;
    }
    box.innerHTML = upcoming.slice(0, 5).map((inv) => {
      const order = orderOf(inv);
      const date = toDate(order.tanggal_event);
      return `<div class="row-item">
        <div class="datebox"><strong>${date.getDate()}</strong><span>${monthShort.format(date)}</span></div>
        <div><div class="row-title">${escapeHtml(order.nama_event)}</div><div class="row-sub">${escapeHtml(order.jenis_paket)}, ${escapeHtml(customerOf(inv).nama_pelanggan || "")}</div></div>
        <div class="pax">${order.jumlah_pax} pax</div>
      </div>`;
    }).join("");
  },

  renderMiniChart() {
    const canvas = $("#cashMiniChart");
    if (!window.Chart || !canvas) return;
    const months = [];
    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: monthShort.format(d) });
    }
    const totals = months.map((m) => App.state.invoices.reduce((s, inv) =>
      s + (inv.transaksi_bayar || []).filter((t) => String(t.tanggal).startsWith(m.key)).reduce((a, t) => a + Number(t.jumlah), 0), 0));
    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: "bar",
      data: { labels: months.map((m) => m.label), datasets: [{ label: "Kas masuk", data: totals, backgroundColor: "#1f6b57", borderRadius: 4, borderSkipped: "start", maxBarThickness: 26 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 300 }, transitions: { resize: { animation: { duration: 0 } } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${formatMoney(c.parsed.y)}` } } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: "#7b8883", font: { family: "Plus Jakarta Sans", size: 11 } } },
          y: { grid: { color: "#eef1ed" }, border: { display: false }, ticks: { color: "#7b8883", maxTicksLimit: 4, font: { family: "Plus Jakarta Sans", size: 11 }, callback: (v) => shortMoney(v).replace("Rp ", "") } },
        },
      },
    });
  },
};

/* ---------------- Form booking ---------------- */
const Booking = {
  requestId: null, // diisi bila booking dibuat dari pesanan online

  init() {
    const form = $("#bookingForm");
    this.resetDates();
    form.addEventListener("reset", () => {
      this.requestId = null;
      $("#fromOnline").classList.add("is-hidden");
    });
    form.addEventListener("submit", (e) => this.submit(e));
    form.addEventListener("reset", () => window.setTimeout(() => {
      this.resetDates();
      this.update();
      $("#customerLookup").classList.add("is-hidden");
    }, 0));
    ["pax", "pricePerPax", "downPayment"].forEach((name) => form[name].addEventListener("input", () => this.update()));
    form.packageType.addEventListener("input", () => this.update());
    form.phone.addEventListener("input", () => this.lookupCustomer());
    // Jatuh tempo otomatis H-1 sebelum tanggal acara (bisa diubah manual)
    form.eventDate.addEventListener("input", () => { if (form.eventDate.value) form.dueDate.value = jatuhTempoAcara(form.eventDate.value); });
    $$("[data-dp]").forEach((chip) => chip.addEventListener("click", () => {
      const { total } = Backend.hitungTagihan(form.pax.value, form.pricePerPax.value);
      form.downPayment.value = Math.round(total * Number(chip.dataset.dp)) || "";
      this.update();
    }));
    this.update();
  },

  resetDates() {
    const form = $("#bookingForm");
    form.billingDate.value = today();
    form.dueDate.value = addDays(today(), 7);
    form.paymentMethod.value = "Transfer Bank";
  },

  // Kenali customer lama dari nomor HP
  lookupCustomer() {
    const form = $("#bookingForm");
    const note = $("#customerLookup");
    const hp = normalisasiHp(form.phone.value);
    if (hp.length < 9) { note.classList.add("is-hidden"); return; }
    const orders = App.state.invoices.filter((i) => normalisasiHp(customerOf(i).no_hp) === hp);
    note.classList.remove("is-hidden");
    if (!orders.length) {
      note.className = "lookup new";
      note.innerHTML = "<b>Customer baru.</b> Nomor ini belum pernah memesan.";
      return;
    }
    const cust = customerOf(orders[0]);
    const last = orders.slice().sort((a, b) => orderKey(b).localeCompare(orderKey(a)))[0];
    if (!form.customerName.value) form.customerName.value = cust.nama_pelanggan || "";
    if (!form.email.value) form.email.value = cust.email || "";
    note.className = "lookup repeat";
    note.innerHTML = `<b>Customer lama, ${escapeHtml(cust.nama_pelanggan)}.</b> Sudah ${orders.length} kali memesan, terakhir ${escapeHtml(orderOf(last).nama_event)} pada ${formatDate(orderOf(last).tanggal_event)}.
      <button type="button" class="link" data-cust-history="${cust.id}">Lihat riwayat</button>`;
    $("[data-cust-history]", note).addEventListener("click", () => Customers.openHistory(cust.id));
  },

  update() {
    const form = $("#bookingForm");
    const { subtotal, pajak, total } = Backend.hitungTagihan(form.pax.value, form.pricePerPax.value);
    const dp = Number(form.downPayment.value || 0);
    const status = Backend.hitungStatus(dp, total);
    $("#estSubtotal").textContent = formatMoney(subtotal);
    $("#estTax").textContent = formatMoney(pajak);
    $("#estPaid").textContent = formatMoney(dp);
    $("#estimatedTotal").textContent = formatMoney(total);
    const badge = $("#estStatus");
    badge.textContent = total && dp > total ? "Melebihi total" : status;
    badge.className = `pill ${STATUS_CLASS[status]}`;

    const min = minimalPax(form.packageType.value);
    form.pax.min = min;
    const pax = Number(form.pax.value || 0);
    const hint = $("#minPaxHint");
    hint.textContent = `Minimal ${min} pax${PACKAGES.some((p) => p.name === form.packageType.value) ? " untuk paket ini" : " untuk paket custom"}`;
    hint.classList.toggle("is-error", Boolean(pax) && pax < min);
  },

  async submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $("#bookingMessage");
    const values = Object.fromEntries(new FormData(form).entries());
    const { total } = Backend.hitungTagihan(values.pax, values.pricePerPax);
    const min = minimalPax(values.packageType);

    if (Number(values.pax) < min) return setMessage(message, `Minimal pemesanan ${values.packageType} adalah ${min} pax.`, "error");
    if (Number(values.downPayment || 0) > total) return setMessage(message, "Pembayaran awal melebihi total invoice.", "error");
    if (values.dueDate < values.billingDate) return setMessage(message, "Jatuh tempo tidak boleh sebelum tanggal billing.", "error");

    const submitButton = $('[type="submit"][form="bookingForm"]');
    submitButton.disabled = true;
    setMessage(message, "Menyimpan customer, pesanan, dan invoice...");
    try {
      const dariOnline = this.requestId;
      const hasil = await Backend.simpanBooking(values, dariOnline);
      form.reset();
      setMessage(message, `${dariOnline ? "Pesanan online diterima. " : ""}Booking ${hasil.no_pesanan} tersimpan dengan invoice ${hasil.no_invoice} (${hasil.pelanggan_baru ? "customer baru" : "customer lama"}).`, "success");
      showToast(`Booking ${hasil.no_pesanan} berhasil disimpan.`);
      await App.reload();
    } catch (error) {
      setMessage(message, `Booking belum tersimpan: ${error.message}`, "error");
      showToast("Booking belum tersimpan.", true);
    } finally {
      submitButton.disabled = false;
    }
  },
};
