/* HALAMAN PEMBELI — katalog dan form pesan.
   Pembeli tidak perlu login. Pesanan dikirim lewat Backend.kirimPesanan()
   dan muncul di dashboard pemilik (menu "Pesanan online"). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CUSTOM = "__custom__";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const money = (v) => "Rp " + Math.round(Number(v || 0)).toLocaleString("id-ID");
  const digits = (hp) => String(hp || "").replace(/\D/g, "");
  const hpNormal = (hp) => { const d = digits(hp); return d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d; };
  const localISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };
  const formatDate = (iso) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
  const usaha = PENGATURAN.usaha;

  const form = $("#orderForm");
  const message = $("#orderMessage");
  let filter = "Semua";

  /* ---------- Data usaha ---------- */
  function isiDataUsaha() {
    ["#brandName", "#footName", "#footCopy"].forEach((s) => ($(s).textContent = usaha.nama));
    $("#footAddress").textContent = usaha.alamat;
    $("#footHours").textContent = usaha.jamBuka || "";
    $("#footEmail").textContent = usaha.email;
    $("#year").textContent = new Date().getFullYear();
    $("#footPhone").textContent = usaha.telepon;
    document.title = `${usaha.nama} — Catering Pernikahan, Kantor & Syukuran`;
  }

  /* ---------- Katalog ---------- */
  function renderFilter() {
    const cats = ["Semua", ...new Set(PACKAGES.map((p) => p.category))];
    $("#catFilter").innerHTML = cats.map((c) => `<button type="button" data-cat="${esc(c)}" class="${c === filter ? "is-active" : ""}">${esc(c)}</button>`).join("");
    $$("[data-cat]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.cat; renderFilter(); renderKatalogSitus(); }));
  }

  function renderKatalogSitus() {
    const dipilih = form.paket.value;
    $("#siteCatalog").innerHTML = PACKAGES.map((p, i) => ({ p, i }))
      .filter(({ p }) => filter === "Semua" || p.category === filter)
      .map(({ p, i }) => `
        <article class="package ${String(i) === dipilih ? "is-picked" : ""}">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
          <div class="package-body">
            <span class="package-cat">${esc(p.category)}</span>
            <h3>${esc(p.name)}</h3>
            <ul>${p.menu.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
            <div class="package-foot">
              <div class="package-price">
                <strong>${money(p.price)}</strong> <span>/ pax</span>
                <small>Minimal ${p.minPax} pax</small>
              </div>
              <button type="button" class="btn btn-primary btn-sm" data-pesan="${i}">Pesan paket ini</button>
            </div>
          </div>
        </article>`).join("");
    $$("[data-pesan]").forEach((b) => b.addEventListener("click", () => {
      form.paket.value = b.dataset.pesan;
      paketBerubah();
      $("#pesan").scrollIntoView({ behavior: "smooth" });
      window.setTimeout(() => form.nama.focus({ preventScroll: true }), 500);
    }));
  }

  /* ---------- Form ---------- */
  function paketTerpilih() {
    const v = form.paket.value;
    if (v === "" ) return null;
    if (v === CUSTOM) return { custom: true, minPax: PENGATURAN.minimalPaxCustom };
    return PACKAGES[Number(v)];
  }

  function paketBerubah() {
    const p = paketTerpilih();
    $("#customWrap").classList.toggle("is-hidden", !p?.custom);
    form.paketCustom.required = Boolean(p?.custom);
    if (p && (!form.pax.value || Number(form.pax.value) < p.minPax)) form.pax.value = p.minPax;
    renderKatalogSitus();
    hitung();
  }

  function hitung() {
    const p = paketTerpilih();
    const pax = Number(form.pax.value || 0);
    const hint = $("#paxHint");
    const pack = $("#sumPack");

    if (!p) {
      pack.className = "sum-pack is-empty";
      pack.textContent = "Belum ada paket dipilih.";
      hint.textContent = "";
    } else if (p.custom) {
      pack.className = "sum-pack";
      pack.innerHTML = `<div><strong>Paket custom</strong><span>Harga ditentukan setelah konsultasi</span></div>`;
      hint.textContent = `Minimal ${p.minPax} pax`;
    } else {
      pack.className = "sum-pack";
      pack.innerHTML = `<img src="${esc(p.image)}" alt="" /><div><strong>${esc(p.name)}</strong><span>${esc(p.category)}</span></div>`;
      hint.textContent = `Minimal ${p.minPax} pax untuk paket ini`;
    }
    hint.classList.toggle("is-error", Boolean(p && pax && pax < p.minPax));

    const harga = p && !p.custom ? p.price : 0;
    const subtotal = harga * pax;
    const pajak = Math.round(subtotal * 0.11);
    $("#sumPrice").textContent = p ? (p.custom ? "Dikonfirmasi" : money(harga)) : "—";
    $("#sumPax").textContent = pax ? `${pax.toLocaleString("id-ID")} pax` : "—";
    $("#sumSubtotal").textContent = p?.custom ? "—" : money(subtotal);
    $("#sumTax").textContent = p?.custom ? "—" : money(pajak);
    $("#sumTotal").textContent = p?.custom ? "Dikonfirmasi" : money(subtotal + pajak);
    renderRencanaBayar(p?.custom ? null : subtotal + pajak);
  }

  /* ---------- Pembayaran ---------- */
  const pilihan = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
  const DP = (PENGATURAN.dpMinimalPersen || 50) / 100;
  const HARI_LUNAS = PENGATURAN.hariLunasSebelumAcara ?? 1;
  // Tanggal pelunasan = H-1: sehari sebelum tanggal acara
  const batasLunas = (tanggalAcara) => {
    if (!tanggalAcara) return null;
    const d = new Date(`${tanggalAcara}T00:00:00`); d.setDate(d.getDate() - HARI_LUNAS); return localISO(d);
  };

  // Hitung yang dibayar di awal (DP / lunas) dan sisa yang wajib lunas H-1
  function rencanaBayar(total) {
    const skema = pilihan("skema");
    if (!skema) return null;
    const awal = total == null ? null : skema === "Lunas" ? total : Math.round(total * DP);
    const sisa = total == null ? null : total - awal;
    return { skema, awal, sisa, batas: batasLunas(form.tanggal.value) };
  }

  function renderRencanaBayar(total) {
    const box = $("#payPlan");
    const r = rencanaBayar(total);
    if (!r) { box.innerHTML = ""; return; }
    const pct = Math.round(DP * 100);
    const nominal = (v, teks) => (v == null ? teks : money(v));
    const rows = [`<div><span>Metode</span><b>${esc(pilihan("metode") || "—")}</b></div>`];
    if (r.skema === "Lunas") {
      rows.push(`<div><span>Bayar lunas sekarang</span><b>${nominal(r.awal, "100%")}</b></div>`);
    } else {
      rows.push(`<div><span>DP sekarang</span><b>${nominal(r.awal, `${pct}%`)}</b></div>`);
      rows.push(`<div><span>Pelunasan paling lambat ${r.batas ? formatDate(r.batas) : `H-${HARI_LUNAS}`}</span><b>${nominal(r.sisa, `${100 - pct}%`)}</b></div>`);
    }
    box.innerHTML = `<h3>Rencana pembayaran</h3>${rows.join("")}`;
  }

  function tandai(el, salah) { el.classList.toggle("is-invalid", salah); return salah; }

  function periksa() {
    const p = paketTerpilih();
    const pax = Number(form.pax.value || 0);
    const besok = addDays(PENGATURAN.minimalHariPesan || 1);
    const cek = [
      [form.nama, form.nama.value.trim().length < 2, "Isi nama lengkap."],
      [form.hp, hpNormal(form.hp.value).length < 10 || hpNormal(form.hp.value).length > 15, "Nomor HP belum benar."],
      [form.email, form.email.value.trim() !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.value.trim()), "Format email belum benar."],
      [form.acara, form.acara.value.trim().length < 3, "Isi nama acara."],
      [form.tanggal, !form.tanggal.value || form.tanggal.value < besok, `Tanggal acara paling cepat ${formatDate(besok)}.`],
      [form.paket, !p, "Pilih paket."],
      [form.paketCustom, Boolean(p?.custom) && form.paketCustom.value.trim().length < 2, "Tuliskan paket yang diinginkan."],
      [form.pax, !pax || (p && pax < p.minPax) || pax > 10000, p ? `Minimal ${p.minPax} pax.` : "Isi jumlah tamu."],
      [$("#metodeChoices"), !pilihan("metode"), "Pilih metode pembayaran."],
      [$("#skemaChoices"), !pilihan("skema"), "Pilih cara bayar: DP dulu atau langsung lunas."],
    ];
    let pertama = null;
    cek.forEach(([el, salah, teks]) => { if (tandai(el, salah) && !pertama) pertama = { el, teks }; });
    return pertama;
  }

  async function kirim(event) {
    event.preventDefault();
    const salah = periksa();
    if (salah) {
      message.textContent = salah.teks;
      message.className = "form-message is-error";
      (salah.el.matches("input, select, textarea") ? salah.el : salah.el.querySelector("input")).focus();
      return;
    }
    const p = paketTerpilih();
    const values = {
      nama: form.nama.value.trim(),
      hp: form.hp.value.trim(),
      email: form.email.value.trim(),
      acara: form.acara.value.trim(),
      tanggal: form.tanggal.value,
      paket: p.custom ? `Custom: ${form.paketCustom.value.trim()}` : p.name,
      pax: Number(form.pax.value),
      catatan: form.catatan.value.trim(),
      metode: pilihan("metode"),
      skema: pilihan("skema"),
      tempo: -HARI_LUNAS,
    };
    const tombol = $("#orderSubmit");
    tombol.disabled = true;
    message.textContent = "Mengirim pesanan…";
    message.className = "form-message";
    try {
      const hasil = await Backend.kirimPesanan(values);
      Tagihan.simpan(hasil.kode, values.hp);
      tampilkanSelesai(hasil, values);
    } catch (error) {
      const teks = /fetch|network|Supabase belum/i.test(error.message)
        ? "Tidak bisa terhubung ke server. Periksa internet Anda, lalu coba lagi."
        : error.message;
      message.textContent = teks;
      message.className = "form-message is-error";
    } finally {
      tombol.disabled = false;
    }
  }

  // Pesanan terkirim → tagihan LANGSUNG tampil di layar ini, pembeli bisa bayar saat itu juga.
  function tampilkanSelesai(hasil, v) {
    const custom = hasil.total == null;
    $("#doneCode").textContent = hasil.kode;
    $("#doneTitle").textContent = custom ? "Pesanan terkirim!" : "Pesanan terkirim! Silakan bayar.";
    $("#doneText").textContent = custom
      ? `Pesanan ${v.paket} untuk ${v.pax} pax pada ${formatDate(v.tanggal)} sudah kami terima. Admin akan menghubungi ${v.hp} untuk mengabari harga.`
      : `${v.paket}, ${v.pax} pax, ${formatDate(v.tanggal)}. Klik tombol Bayar di bawah ini, status langsung berubah otomatis. Tagihan ini juga tersimpan di menu Cek tagihan.`;
    $("#orderLayout").classList.add("is-hidden");
    const done = $("#orderDone");
    done.classList.remove("is-hidden");
    Tagihan.tampilkanDi($("#donePay"), hasil.kode, v.hp);
    done.scrollIntoView({ behavior: "smooth", block: "start" });
    done.focus({ preventScroll: true });
  }

  function pesanLagi() {
    form.reset();
    message.textContent = "";
    $$(".is-invalid", form).forEach((el) => el.classList.remove("is-invalid"));
    $("#orderDone").classList.add("is-hidden");
    $("#donePay").innerHTML = "";
    $("#orderLayout").classList.remove("is-hidden");
    paketBerubah();
    $("#pesan").scrollIntoView({ behavior: "smooth" });
  }

  /* ---------- Mulai ---------- */
  isiDataUsaha();
  form.paket.innerHTML = '<option value="">Pilih paket…</option>' +
    PACKAGES.map((p, i) => `<option value="${i}">${esc(p.name)} (${money(p.price)}/pax)</option>`).join("") +
    `<option value="${CUSTOM}">Paket custom / lainnya</option>`;
  form.tanggal.min = addDays(PENGATURAN.minimalHariPesan || 1);
  // Pembeli bayar online saja (tidak ada pilihan Tunai)
  $("#metodeChoices").innerHTML = Backend.METODE.filter((m) => m !== "Tunai").map((m) =>
    `<label class="choice"><input type="radio" name="metode" value="${esc(m)}" /><span><strong>${esc(m)}</strong></span></label>`).join("");
  $("#dpHint").textContent = `Minimal ${Math.round(DP * 100)}% sekarang, sisanya wajib lunas H-${HARI_LUNAS} (sehari sebelum acara)`;
  $("#ruleNote").innerHTML = `<b>Aturan bayar:</b> wajib DP minimal ${Math.round(DP * 100)}% atau langsung lunas. Wajib <b>lunas paling lambat H-${HARI_LUNAS}</b> (${HARI_LUNAS === 1 ? "sehari" : `${HARI_LUNAS} hari`} sebelum acara). ` +
    "Bila terlambat, pesanan berikutnya tidak bisa dibuat sebelum tagihan dilunasi, dan pesanan selanjutnya wajib bayar lunas di awal.";  form.addEventListener("change", (e) => {
    if (e.target.type === "radio") { e.target.closest(".choices")?.classList.remove("is-invalid"); hitung(); }
  });
  form.paket.addEventListener("change", paketBerubah);
  form.pax.addEventListener("input", hitung);
  form.tanggal.addEventListener("input", hitung);
  form.addEventListener("input", (e) => e.target.classList.remove("is-invalid"));
  form.addEventListener("submit", kirim);
  $("#orderAgain").addEventListener("click", pesanLagi);
  renderFilter();
  renderKatalogSitus();
  hitung();

  if (!Backend.isConfigured) {
    const n = $("#configNotice");
    n.textContent = "Form pemesanan online belum aktif. Silakan hubungi kami lewat telepon.";
    n.classList.remove("is-hidden");
  }
})();
