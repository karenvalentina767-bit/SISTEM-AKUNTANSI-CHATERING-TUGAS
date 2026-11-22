/* Halaman Laporan laba: satu grafik sederhana, bisa dilihat
   - Per hari dalam seminggu (Senin–Minggu)
   - Per tanggal dalam sebulan (1–31)
   - Per bulan dalam setahun (Jan–Des)
   Laba = pendapatan − modal. Modal = jumlah pax × modal per pax (diatur di js/catalog.js).
   Pendapatan dan laba diakui pada tanggal acara, tanpa PPN. */
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const Reports = {
  chart: null,
  mode: "minggu",       // minggu | bulan | tahun
  anchor: today(),      // tanggal acuan periode yang sedang dilihat

  init() {
    $$("#periodMode button").forEach((b) => b.addEventListener("click", () => {
      this.mode = b.dataset.mode;
      $$("#periodMode button").forEach((x) => x.classList.toggle("is-active", x === b));
      this.render();
    }));
    $("#periodPrev").addEventListener("click", () => this.geser(-1));
    $("#periodNext").addEventListener("click", () => this.geser(1));
    $("#periodToday").addEventListener("click", () => { this.anchor = today(); this.render(); });
    // Cetak lewat dialog print browser (tidak tersedia bila halaman dibuka di dalam frame, mis. link demo)
    if (window.self !== window.top) $("#printReport").classList.add("is-hidden");
    $("#printReport").addEventListener("click", () => window.print());
    $("#pdfReport").addEventListener("click", (e) => this.unduhPdf(e.currentTarget));
  },

  // Pindah ke minggu / bulan / tahun sebelum atau sesudahnya
  geser(arah) {
    const d = toDate(this.anchor);
    if (this.mode === "minggu") d.setDate(d.getDate() + 7 * arah);
    if (this.mode === "bulan") { d.setDate(1); d.setMonth(d.getMonth() + arah); }
    if (this.mode === "tahun") { d.setDate(1); d.setFullYear(d.getFullYear() + arah); }
    this.anchor = localISO(d);
    this.render();
  },

  // Daftar "kotak" waktu untuk periode terpilih: { label, cocok(tanggalAcara) }
  periode() {
    const a = toDate(this.anchor);
    const fmt = (d) => `${d.getDate()} ${BULAN[d.getMonth()]}`;
    if (this.mode === "minggu") {
      const senin = new Date(a);
      senin.setDate(a.getDate() - ((a.getDay() + 6) % 7)); // Senin = awal minggu
      const hari = HARI.map((nama, i) => {
        const d = new Date(senin); d.setDate(senin.getDate() + i);
        const iso = localISO(d);
        return { label: nama, sub: fmt(d), cocok: (t) => t === iso };
      });
      const minggu = new Date(senin); minggu.setDate(senin.getDate() + 6);
      return { judul: `${fmt(senin)} – ${fmt(minggu)} ${minggu.getFullYear()}`, kolom: "Hari", grafik: "Laba per hari", buckets: hari };
    }
    if (this.mode === "bulan") {
      const y = a.getFullYear(), m = a.getMonth();
      const jumlah = new Date(y, m + 1, 0).getDate();
      const prefix = `${y}-${String(m + 1).padStart(2, "0")}-`;
      const buckets = Array.from({ length: jumlah }, (_, i) => {
        const d = new Date(y, m, i + 1);
        return { label: String(i + 1), sub: HARI[(d.getDay() + 6) % 7], cocok: (t) => t === prefix + String(i + 1).padStart(2, "0") };
      });
      return { judul: `${BULAN_PANJANG[m]} ${y}`, kolom: "Tanggal", grafik: "Laba per tanggal", buckets };
    }
    const y = a.getFullYear();
    const buckets = BULAN.map((nama, i) => ({ label: nama, sub: "", cocok: (t) => String(t).startsWith(`${y}-${String(i + 1).padStart(2, "0")}`) }));
    return { judul: `Tahun ${y}`, kolom: "Bulan", grafik: "Laba per bulan", buckets };
  },

  compute(buckets) {
    const m = buckets.map(() => ({ orders: 0, revenue: 0, cost: 0 }));
    App.state.invoices.forEach((inv) => {
      const o = orderOf(inv);
      const t = String(o.tanggal_event || "").slice(0, 10);
      const i = buckets.findIndex((b) => b.cocok(t));
      if (i < 0) return;
      m[i].orders += 1;
      m[i].revenue += Number(o.total_penjualan || 0);
      m[i].cost += Number(o.jumlah_pax || 0) * modalPerPax(o.jenis_paket, o.harga_per_pax);
    });
    m.forEach((x) => (x.profit = x.revenue - x.cost));
    return m;
  },

  // Unduh laporan yang sedang dilihat sebagai PDF (angka, grafik, dan tabel rincian)
  async unduhPdf(btn) {
    const p = this.periode();
    const m = this.compute(p.buckets);
    const sum = (k) => m.reduce((s, x) => s + x[k], 0);
    const pendapatan = sum("revenue"), modal = sum("cost"), laba = pendapatan - modal;
    const baris = p.buckets.map((b, i) => ({ b, x: m[i] })).filter(({ x }) => this.mode !== "bulan" || x.orders)
      .map(({ b, x }) => ({ label: b.label, sub: b.sub, pesanan: x.orders, pendapatan: x.revenue, modal: x.cost, laba: x.profit }));
    let grafik = null;
    try { grafik = $("#profitChart")?.toDataURL("image/png"); } catch (e) { /* grafik tidak tersedia */ }
    const msg = $("#reportMsg");
    btn.disabled = true; msg.textContent = "Menyiapkan PDF…";
    try {
      const blob = PdfKarsa.laporan({
        periode: p.judul, kolom: p.kolom, judulGrafik: p.grafik, grafik, baris,
        metrik: { pesanan: sum("orders"), pendapatan, modal, laba, margin: pendapatan ? `${Math.round((laba / pendapatan) * 100)}%` : "0%" },
      });
      const hasil = await PdfKarsa.simpan(blob, `Laporan-laba-${p.judul.replace(/[^\w]+/g, "-")}.pdf`);
      msg.textContent = hasil === "batal" ? "Unduhan dibatalkan." : "PDF diunduh ✓";
    } catch (error) {
      msg.textContent = "PDF tidak bisa dibuat.";
      console.warn(error);
    } finally {
      btn.disabled = false;
      window.setTimeout(() => (msg.textContent = ""), 4000);
    }
  },

  render() {
    const p = this.periode();
    const m = this.compute(p.buckets);
    const sum = (k) => m.reduce((s, x) => s + x[k], 0);
    const revenue = sum("revenue"), cost = sum("cost"), profit = revenue - cost;

    $("#periodLabel").textContent = p.judul;
    $("#chartTitle").textContent = p.grafik;
    $("#tableTitle").textContent = `Rincian ${p.grafik.replace("Laba ", "")}`;
    $("#periodCol").textContent = p.kolom;

    $("#repOrders").textContent = sum("orders").toLocaleString("id-ID");
    $("#repRevenue").textContent = formatMoney(revenue);
    $("#repCost").textContent = formatMoney(cost);
    $("#repProfit").textContent = formatMoney(profit);
    $("#repProfit").classList.toggle("is-negative", profit < 0);
    $("#repMargin").textContent = revenue ? `${Math.round((profit / revenue) * 100)}%` : "0%";

    const cell = (v, cls = "") => `<td class="num ${v ? cls : "zero"}">${v ? formatMoney(v) : "—"}</td>`;
    const laba = (v) => cell(v, v < 0 ? "neg" : "pos");
    const count = (v) => `<td class="num ${v ? "" : "zero"}">${v || "—"}</td>`;
    // Tampilan per tanggal: hanya baris yang ada pesanannya, supaya tabel tidak 31 baris kosong
    const rows = p.buckets.map((b, i) => ({ b, x: m[i] })).filter(({ x }) => this.mode !== "bulan" || x.orders);
    $("#reportRows").innerHTML = rows.length
      ? rows.map(({ b, x }) => `<tr><td>${b.label}${b.sub ? ` <small class="muted">${b.sub}</small>` : ""}</td>${count(x.orders)}${cell(x.revenue)}${cell(x.cost)}${laba(x.profit)}</tr>`).join("")
      : '<tr><td colspan="5"><div class="empty"><strong>Belum ada acara di periode ini</strong>Coba geser ke periode lain dengan tombol panah.</div></td></tr>';
    $("#reportFoot").innerHTML = `<tr><td>Total</td>${count(sum("orders"))}${cell(revenue)}${cell(cost)}${laba(profit)}</tr>`;

    // Gambar setelah halaman selesai ditata, supaya ukuran grafik tepat
    window.requestAnimationFrame(() => this.renderChart(p, m));
  },

  renderChart(p, m) {
    const canvas = $("#profitChart");
    if (!window.Chart) {
      canvas.parentElement.innerHTML = '<div class="empty"><strong>Grafik tidak dapat dimuat</strong>Periksa koneksi internet, lalu muat ulang halaman. Tabel di bawah tetap berisi angka lengkap.</div>';
      return;
    }
    const font = { family: '"Plus Jakarta Sans", system-ui, sans-serif', size: 11.5 };
    const short = (v) => {
      const a = Math.abs(v);
      if (a >= 1e9) return `${(v / 1e9).toFixed(1)} M`;
      if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1)} jt`;
      if (a >= 1e3) return `${Math.round(v / 1e3)} rb`;
      return String(v);
    };
    const profits = m.map((x) => x.profit);
    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: p.buckets.map((b) => (this.mode === "minggu" ? [b.label, b.sub] : b.label)),
        datasets: [{
          label: "Laba",
          data: profits,
          backgroundColor: profits.map((v) => (v < 0 ? "#c2412d" : "#1f6b57")),
          borderRadius: 5, borderSkipped: "start", maxBarThickness: this.mode === "bulan" ? 16 : 40,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 }, transitions: { resize: { animation: { duration: 0 } } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const b = p.buckets[items[0].dataIndex];
                return `${b.label}${b.sub ? ` (${b.sub})` : ""} · ${m[items[0].dataIndex].orders} pesanan`;
              },
              label: (c) => [
                ` Pendapatan: ${formatMoney(m[c.dataIndex].revenue)}`,
                ` Modal: ${formatMoney(m[c.dataIndex].cost)}`,
                ` Laba: ${formatMoney(c.parsed.y)}`,
              ],
            },
          },
        },
        scales: {
          x: { grid: { display: false }, border: { color: "#e3e7e2" }, ticks: { color: "#7b8883", font, maxRotation: 0, autoSkip: true } },
          y: { beginAtZero: true, grid: { color: "#eef1ed" }, border: { display: false }, ticks: { color: "#7b8883", maxTicksLimit: 6, callback: short, font } },
        },
      },
    });
  },
};
