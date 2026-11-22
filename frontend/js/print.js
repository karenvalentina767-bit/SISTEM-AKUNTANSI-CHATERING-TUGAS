/* Cetak invoice: membuka halaman invoice siap cetak, lalu dialog print browser.
   Pilih "Save as PDF" / "Simpan sebagai PDF" untuk mendapatkan file PDF. */
const PrintInvoice = {
  logoData: null,

  // Logo disisipkan langsung (data URL) agar selalu tampil di jendela cetak
  async preloadLogo() {
    try {
      const svg = await (await fetch("./img/logo.svg")).text();
      this.logoData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } catch (error) { /* pakai URL biasa */ }
  },

  html(inv) {
    const order = orderOf(inv);
    const cust = customerOf(inv);
    const u = PENGATURAN.usaha;
    const logo = this.logoData || new URL("./img/logo.svg", window.location.href).href;
    const e = escapeHtml;
    const trx = (inv.transaksi_bayar || []).slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
    const stampClass = { Lunas: "lunas", DP: "dp", Setengah: "dp", "Belum Bayar": "belum" }[inv.status_bayar];

    return `<!doctype html><html lang="id"><head><meta charset="utf-8" />
<title>${e(inv.no_invoice)} - ${e(cust.nama_pelanggan || "")}</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #203b39; font: 12px/1.5 "Plus Jakarta Sans", Arial, sans-serif; font-feature-settings: "tnum" 1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 780px; margin: 0 auto; padding: 28px; position: relative; }
  header { display: flex; justify-content: space-between; align-items: start; padding-bottom: 18px; border-bottom: 3px solid #1f6b57; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .brand img { width: 46px; height: 46px; border-radius: 11px; }
  .brand strong { font-size: 18px; display: block; }
  .brand span { color: #788583; font-size: 11px; display: block; }
  .doc { text-align: right; }
  .doc h1 { margin: 0; color: #123f33; font-size: 28px; font-weight: 800; letter-spacing: -.03em; color: #173d3a; }
  .doc div { font-size: 12px; color: #4a5a54; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin: 22px 0; }
  .label { color: #7b8883; font-size: 11px; font-weight: 600; margin-bottom: 3px; }
  .grid b { display: block; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; padding: 9px 10px; background: #123f33; color: #fff; font-size: 11px; font-weight: 600; }
  td { padding: 10px; border-bottom: 1px solid #e4e4dd; vertical-align: top; }
  .r { text-align: right; } .mono { font-weight: 600; }
  .totals { width: 320px; margin: 14px 0 0 auto; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ecece6; }
  .totals .grand { font-size: 15px; font-weight: 700; border-bottom: 2px solid #123f33; }
  .totals .due { color: #c2412d; font-weight: 700; font-size: 14px; }
  h3 { margin: 26px 0 4px; font-size: 13px; }
  .totals-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
  .totals-row .totals { margin: 14px 0 0; }
  .stamp { margin-left: 30px; transform: rotate(-8deg); padding: 6px 18px; border: 3px solid; border-radius: 10px; font-size: 22px; font-weight: 800; letter-spacing: .06em; opacity: .85; }
  .stamp.lunas { color: #1f6b57; } .stamp.dp { color: #b07c00; } .stamp.belum { color: #c2412d; }
  .pay { margin-top: 24px; display: grid; grid-template-columns: 1.3fr 1fr; gap: 24px; }
  .box { padding: 14px; border: 1px solid #dedfd7; border-radius: 8px; background: #f6f8f5; }
  .sign { text-align: center; padding-top: 14px; }
  .sign .line { margin: 56px auto 4px; width: 180px; border-top: 1px solid #203b39; }
  footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #dedfd7; color: #788583; font-size: 10px; text-align: center; }
  .toolbar { position: sticky; top: 0; display: flex; justify-content: center; gap: 8px; padding: 10px; background: #123f33; }
  .toolbar button { padding: 8px 16px; border: 0; border-radius: 6px; font: 700 12px "Plus Jakarta Sans", sans-serif; cursor: pointer; }
  .toolbar .p { background: #e8a920; color: #2b1d00; }
  @media print { .toolbar { display: none; } .page { padding: 0; } }
</style></head><body>
<div class="toolbar"><button class="p" onclick="window.print()">Cetak / Simpan PDF</button><button onclick="window.close()">Tutup</button></div>
<div class="page">
  <header>
    <div class="brand"><img src="${logo}" alt="" /><div><strong>${e(u.nama)}</strong><span>${e(u.alamat)}</span><span>${e(u.telepon)} · ${e(u.email)}</span></div></div>
    <div class="doc"><h1>INVOICE</h1><div>${e(inv.no_invoice)}</div><div>Pesanan ${e(order.no_pesanan || "-")}</div></div>
  </header>

  <div class="grid">
    <div><div class="label">Ditagihkan kepada</div><b>${e(cust.nama_pelanggan || "-")}</b>${e(cust.no_hp || "")}<br />${e(cust.email || "")}</div>
    <div><div class="label">Tanggal invoice</div><b>${formatDate(inv.tanggal_tagihan)}</b><div class="label" style="margin-top:8px">Jatuh tempo</div><b>${formatDate(inv.tanggal_tempo)}</b></div>
    <div><div class="label">Event</div><b>${e(order.nama_event || "-")}</b>${formatDate(order.tanggal_event)}<div class="label" style="margin-top:8px">Metode pembayaran</div><b>${e(order.metode_pembayaran || "-")}</b></div>
  </div>

  <table>
    <thead><tr><th>Deskripsi</th><th class="r">Jumlah</th><th class="r">Harga / pax</th><th class="r">Subtotal</th></tr></thead>
    <tbody><tr>
      <td><b>${e(order.jenis_paket || "-")}</b><br /><span style="color:#788583">Catering untuk ${e(order.nama_event || "-")}</span></td>
      <td class="r mono">${order.jumlah_pax} pax</td>
      <td class="r mono">${formatMoney(order.harga_per_pax)}</td>
      <td class="r mono">${formatMoney(order.total_penjualan)}</td>
    </tr></tbody>
  </table>

  <div class="totals-row">
  <div class="stamp ${stampClass}">${e(inv.status_bayar.toUpperCase())}</div>
  <div class="totals">
    <div><span>Subtotal</span><span class="mono">${formatMoney(order.total_penjualan)}</span></div>
    <div><span>PPN 11%</span><span class="mono">${formatMoney(inv.pajak_ppn)}</span></div>
    <div class="grand"><span>Total tagihan</span><span class="mono">${formatMoney(inv.total_tagihan)}</span></div>
    <div><span>Sudah dibayar</span><span class="mono">${formatMoney(paidOf(inv))}</span></div>
    <div class="due"><span>Sisa tagihan</span><span class="mono">${formatMoney(remainingOf(inv))}</span></div>
  </div>
  </div>

  ${trx.length ? `<h3>Riwayat pembayaran</h3>
  <table><thead><tr><th>Tanggal</th><th>Metode</th><th>Keterangan</th><th class="r">Jumlah</th></tr></thead><tbody>
  ${trx.map((t) => `<tr><td>${formatDate(t.tanggal)}</td><td>${e(t.metode)}</td><td>${e(t.catatan || "-")}</td><td class="r mono">${formatMoney(t.jumlah)}</td></tr>`).join("")}
  </tbody></table>` : ""}

  <div class="pay">
    <div class="box"><div class="label">Pembayaran</div>Transfer ke <b style="display:inline">${e(u.rekening)}</b>.<br />Cantumkan nomor <b style="display:inline">${e(inv.no_invoice)}</b> pada berita transfer.</div>
    <div class="sign">Hormat kami,<div class="line"></div><b>${e(u.nama)}</b></div>
  </div>
  <footer>Invoice ini dibuat otomatis oleh sistem Karsa · ${e(u.nama)}</footer>
</div>
<script>window.addEventListener("load", () => setTimeout(() => window.print(), 400));<\/script>
</body></html>`;
  },

  // Unduh invoice sebagai file PDF (dipakai tombol "PDF" di menu Invoice)
  async open(inv) {
    if (!inv) return;
    const o = orderOf(inv), c = customerOf(inv);
    const riwayat = (inv.transaksi_bayar || []).slice().sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
      .map((t) => ({ tanggal: t.tanggal, jumlah: t.jumlah, metode: t.metode }));
    const data = {
      kode: o.no_pesanan, nama: c.nama_pelanggan, nama_event: o.nama_event, tanggal_event: o.tanggal_event,
      jenis_paket: o.jenis_paket, jumlah_pax: o.jumlah_pax,
      invoice: { no_invoice: inv.no_invoice, no_pesanan: o.no_pesanan, tanggal_tagihan: inv.tanggal_tagihan, tanggal_tempo: inv.tanggal_tempo,
        total: inv.total_tagihan, dibayar: paidOf(inv), sisa: remainingOf(inv), harga_per_pax: o.harga_per_pax, jumlah_pax: o.jumlah_pax,
        jenis_paket: o.jenis_paket, subtotal: o.total_penjualan, pajak_ppn: inv.pajak_ppn, riwayat },
    };
    try {
      const hasil = await PdfKarsa.simpan(PdfKarsa.invoice(data), `Invoice-${inv.no_invoice}.pdf`);
      if (hasil !== "batal") showToast(`Invoice ${inv.no_invoice} diunduh sebagai PDF.`);
    } catch (error) {
      showToast(`PDF tidak bisa dibuat: ${error.message || error.code || error}`, true);
    }
  },

  // (versi lama) buka jendela cetak browser
  cetak(inv) {
    if (!inv) return;
    const win = window.open("", "_blank");
    if (!win) {
      showToast("Pop-up diblokir browser. Izinkan pop-up untuk mencetak invoice.", true);
      return;
    }
    win.document.open();
    win.document.write(this.html(inv));
    win.document.close();
  },
};

PrintInvoice.preloadLogo();
