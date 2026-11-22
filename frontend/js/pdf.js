/* ============================================================
   PDF — invoice & laporan laba (memakai jsPDF di js/vendor).
   Dipakai halaman pembeli (Cek tagihan) dan dashboard pemilik.
   ============================================================ */
const PdfKarsa = (() => {
  const usaha = PENGATURAN.usaha;
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = () => iso(new Date());
  const tgl = (v) => (v ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${String(v).slice(0, 10)}T00:00:00`)) : "-");
  const rpTeks = (v) => (Number(v) < 0 ? "-Rp " : "Rp ") + Math.round(Math.abs(Number(v || 0))).toLocaleString("id-ID");
  function statusPembeli(inv) {
    if (Number(inv.sisa) <= 0) return "Lunas";
    if (Number(inv.dibayar) > 0) return "DP terbayar";
    return "Belum dibayar";
  }
  function labelBayar(riwayat, i, total) {
    const sampai = riwayat.slice(0, i + 1).reduce((s, t) => s + Number(t.jumlah), 0);
    if (i === 0 && sampai >= Number(total) - 0.5) return "Bayar lunas";
    if (i === 0) return "DP";
    return sampai >= Number(total) - 0.5 ? "Pelunasan" : "Cicilan";
  }
  function baru() {
    if (!window.jspdf) throw new Error("Library PDF belum termuat.");
    return new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  }

  /* Data invoice: { kode, nama, nama_event, tanggal_event, jenis_paket, jumlah_pax,
     invoice: { no_invoice, no_pesanan, tanggal_tagihan, tanggal_tempo, total, dibayar, sisa,
                harga_per_pax, jumlah_pax, jenis_paket, subtotal, pajak_ppn, riwayat:[{tanggal,jumlah,metode}] } } */
  function invoice(data) {
    const inv = data.invoice;
    const doc = baru();
    const L = 18, R = 192, abu = [107, 107, 102], hitam = [29, 29, 27];
    const harga = Number(inv.harga_per_pax || 0);
    const pax = Number(inv.jumlah_pax || data.jumlah_pax || 0);
    const subtotal = Number(inv.subtotal ?? Math.round(Number(inv.total) / 1.11));
    const ppn = Number(inv.pajak_ppn ?? Number(inv.total) - subtotal);
    const lunas = Number(inv.sisa) <= 0;
    const warna = (c) => doc.setTextColor(...c);

    // Kop
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); warna(hitam); doc.text(usaha.nama, L, 24);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); warna(abu);
    doc.text([usaha.alamat, `${usaha.telepon}  |  ${usaha.email}`], L, 30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); warna(hitam); doc.text("INVOICE", R, 25, { align: "right" });
    doc.setFontSize(10); doc.text(inv.no_invoice, R, 31, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); warna(abu); doc.text(data.kode && data.kode !== inv.no_pesanan ? `Pesanan ${inv.no_pesanan}  |  ${data.kode}` : `Pesanan ${inv.no_pesanan}`, R, 36, { align: "right" });
    // Cap status
    const cap = statusPembeli(inv).toUpperCase();
    const capWarna = lunas ? [31, 107, 79] : [194, 65, 12];
    doc.setDrawColor(...capWarna); doc.setLineWidth(0.6); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    const lebarCap = doc.getTextWidth(cap) + 8;
    doc.roundedRect(R - lebarCap, 40, lebarCap, 8, 1.5, 1.5); warna(capWarna); doc.text(cap, R - lebarCap / 2, 45.6, { align: "center" });
    doc.setDrawColor(...hitam); doc.setLineWidth(0.6); doc.line(L, 53, R, 53);

    // Info
    const info = [["DITAGIHKAN KEPADA", data.nama], ["TANGGAL INVOICE", tgl(inv.tanggal_tagihan)], ["TANGGAL ACARA", tgl(data.tanggal_event)], ["JATUH TEMPO", tgl(inv.tanggal_tempo)]];
    info.forEach(([k, v], i) => {
      const x = L + i * 43.5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); warna(abu); doc.text(k, x, 61);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); warna(hitam); doc.text(doc.splitTextToSize(String(v), 41), x, 66.5);
    });

    // Tabel item
    let y = 78;
    doc.setFillColor(244, 244, 240); doc.rect(L, y, R - L, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); warna(abu);
    doc.text("KETERANGAN", L + 2, y + 5.3); doc.text("JUMLAH", 120, y + 5.3, { align: "right" });
    doc.text("HARGA", 155, y + 5.3, { align: "right" }); doc.text("TOTAL", R - 2, y + 5.3, { align: "right" });
    y += 14;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); warna(hitam); doc.text(String(inv.jenis_paket || data.jenis_paket), L + 2, y);
    doc.setFont("helvetica", "normal"); doc.text(`${pax.toLocaleString("id-ID")} pax`, 120, y, { align: "right" });
    doc.text(harga ? rpTeks(harga) : "-", 155, y, { align: "right" }); doc.text(rpTeks(subtotal), R - 2, y, { align: "right" });
    doc.setFontSize(8.5); warna(abu); doc.text(String(data.nama_event), L + 2, y + 5);
    y += 10; doc.setDrawColor(221, 221, 221); doc.setLineWidth(0.3); doc.line(L, y, R, y);

    // Ringkasan
    y += 8;
    const baris = (label, nilai, opsi = {}) => {
      doc.setFont("helvetica", opsi.tebal ? "bold" : "normal"); doc.setFontSize(opsi.besar ? 12 : 10);
      warna(opsi.tebal ? hitam : abu); doc.text(label, 120, y);
      warna(opsi.merah ? [194, 65, 12] : hitam); doc.setFont("helvetica", "bold"); doc.text(nilai, R - 2, y, { align: "right" });
      y += opsi.besar ? 9 : 6.5;
    };
    baris("Subtotal", rpTeks(subtotal));
    baris("PPN 11%", rpTeks(ppn));
    doc.setDrawColor(...hitam); doc.setLineWidth(0.5); doc.line(118, y - 3.5, R, y - 3.5); y += 2.5;
    baris("Total tagihan", rpTeks(inv.total), { tebal: true, besar: true });
    baris("Sudah dibayar", rpTeks(inv.dibayar));
    baris("Sisa tagihan", rpTeks(inv.sisa), { merah: !lunas });

    // Riwayat pembayaran
    const daftar = inv.riwayat || [];
    if (daftar.length) {
      y += 6;
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); warna(hitam); doc.text("Riwayat pembayaran", L, y); y += 4;
      doc.setFillColor(244, 244, 240); doc.rect(L, y, R - L, 7, "F");
      doc.setFontSize(8); warna(abu);
      doc.text("PEMBAYARAN", L + 2, y + 4.8); doc.text("TANGGAL", 70, y + 4.8); doc.text("METODE", 120, y + 4.8); doc.text("JUMLAH", R - 2, y + 4.8, { align: "right" });
      y += 7;
      daftar.forEach((t, i) => {
        y += 6.5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); warna(hitam);
        doc.text(labelBayar(daftar, i, inv.total), L + 2, y); doc.text(tgl(t.tanggal), 70, y); doc.text(String(t.metode), 120, y);
        doc.text(rpTeks(t.jumlah), R - 2, y, { align: "right" });
        doc.setDrawColor(235, 235, 235); doc.setLineWidth(0.2); doc.line(L, y + 2.5, R, y + 2.5);
      });
    }

    // Catatan kaki
    y = Math.max(y + 16, 250);
    doc.setDrawColor(200, 200, 200); doc.setLineDashPattern([1, 1], 0); doc.line(L, y, R, y); doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); warna(abu);
    doc.text(lunas ? "Terima kasih, pembayaran Anda sudah lunas." : `Mohon lunasi sisa tagihan paling lambat ${tgl(inv.tanggal_tempo)} melalui menu Cek tagihan di website kami.`, (L + R) / 2, y + 7, { align: "center" });
    doc.text(`Dicetak ${tgl(today())}  |  ${usaha.nama}`, (L + R) / 2, y + 12, { align: "center" });
    return doc.output("blob");
  }


  /* Laporan laba: { periode, kolom, metrik:{pesanan,pendapatan,modal,laba,margin}, baris:[{label,sub,pesanan,pendapatan,modal,laba}], grafik (dataURL PNG, opsional) } */
  function laporan(r) {
    const doc = baru();
    const L = 18, R = 192, abu = [107, 107, 102], hitam = [29, 29, 27], hijau = [31, 107, 87], merah = [194, 65, 45];
    const warna = (c) => doc.setTextColor(...c);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); warna(hitam); doc.text(usaha.nama, L, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); warna(abu); doc.text(usaha.alamat, L, 27.5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); warna(hitam); doc.text("LAPORAN LABA", R, 22, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); warna(abu); doc.text(r.periode, R, 28, { align: "right" });
    doc.setDrawColor(...hitam); doc.setLineWidth(0.6); doc.line(L, 33, R, 33);

    // Kotak angka
    const kotak = [["Jumlah pesanan", String(r.metrik.pesanan)], ["Pendapatan (tanpa PPN)", rpTeks(r.metrik.pendapatan)], ["Modal", rpTeks(r.metrik.modal)], [`Laba (${r.metrik.margin})`, rpTeks(r.metrik.laba)]];
    const lebar = (R - L - 9) / 4;
    kotak.forEach(([k, v], i) => {
      const x = L + i * (lebar + 3);
      doc.setFillColor(i === 3 ? 227 : 244, i === 3 ? 239 : 244, i === 3 ? 233 : 240); doc.roundedRect(x, 39, lebar, 19, 2, 2, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); warna(abu); doc.text(k, x + 3, 45);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); warna(i === 3 ? (r.metrik.laba < 0 ? merah : hijau) : hitam); doc.text(v, x + 3, 53);
    });
    let y = 66;
    if (r.grafik) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); warna(hitam); doc.text(r.judulGrafik || "Grafik laba", L, y); y += 3;
      doc.addImage(r.grafik, "PNG", L, y, R - L, 62); y += 68;
    }
    // Tabel
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); warna(hitam); doc.text("Rincian", L, y); y += 3;
    const kol = [L + 2, 95, 130, 160, R - 2];
    const kepala = () => {
      doc.setFillColor(244, 244, 240); doc.rect(L, y, R - L, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); warna(abu);
      doc.text(r.kolom.toUpperCase(), kol[0], y + 4.8);
      ["PESANAN", "PENDAPATAN", "MODAL", "LABA"].forEach((h, i) => doc.text(h, kol[i + 1], y + 4.8, { align: "right" }));
      y += 7;
    };
    kepala();
    const baris = r.baris.length ? r.baris : [{ label: "Belum ada acara di periode ini", pesanan: 0, pendapatan: 0, modal: 0, laba: 0, kosong: true }];
    baris.forEach((b) => {
      if (y > 270) { doc.addPage(); y = 20; kepala(); }
      y += 6.3;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); warna(b.kosong ? abu : hitam);
      doc.text(`${b.label}${b.sub ? `  ${b.sub}` : ""}`, kol[0], y);
      if (!b.kosong) {
        doc.text(String(b.pesanan || "-"), kol[1], y, { align: "right" });
        doc.text(b.pendapatan ? rpTeks(b.pendapatan) : "-", kol[2], y, { align: "right" });
        doc.text(b.modal ? rpTeks(b.modal) : "-", kol[3], y, { align: "right" });
        warna(b.laba < 0 ? merah : b.laba > 0 ? hijau : abu); doc.setFont("helvetica", "bold");
        doc.text(b.laba ? rpTeks(b.laba) : "-", kol[4], y, { align: "right" });
      }
      doc.setDrawColor(235, 235, 235); doc.setLineWidth(0.2); doc.line(L, y + 2.4, R, y + 2.4);
    });
    y += 8.5;
    doc.setDrawColor(...hitam); doc.setLineWidth(0.5); doc.line(L, y - 5, R, y - 5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); warna(hitam);
    doc.text("Total", kol[0], y); doc.text(String(r.metrik.pesanan), kol[1], y, { align: "right" });
    doc.text(rpTeks(r.metrik.pendapatan), kol[2], y, { align: "right" }); doc.text(rpTeks(r.metrik.modal), kol[3], y, { align: "right" });
    warna(r.metrik.laba < 0 ? merah : hijau); doc.text(rpTeks(r.metrik.laba), kol[4], y, { align: "right" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); warna(abu);
    doc.text("Laba = pendapatan - modal. Pendapatan tanpa PPN, diakui pada tanggal acara. Modal per pax diatur di katalog paket.", L, 284);
    doc.text(`Dicetak ${tgl(today())}`, R, 289, { align: "right" });
    return doc.output("blob");
  }

  // Simpan file: di halaman Claude memakai kemampuan "downloads", di browser biasa memakai link unduhan.
  async function simpan(blob, namaFile) {
    if (window.claude && typeof window.claude.use === "function") {
      const dl = await window.claude.use("downloads");
      if (dl) {
        try { await dl.save({ filename: namaFile, data: blob }); return "ok"; }
        catch (e) { if (e && e.code === "declined") return "batal"; throw e; }
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = namaFile;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    return "ok";
  }


  return { invoice, laporan, simpan, statusPembeli, labelBayar };
})();
