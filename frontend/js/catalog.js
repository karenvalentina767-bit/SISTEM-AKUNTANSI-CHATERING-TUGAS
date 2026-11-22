/* Katalog paket catering. Ubah daftar PACKAGES untuk mengganti nama, harga, menu, dan gambar paket.
   price = harga jual per pax, modal = biaya bahan + tenaga per pax (dipakai untuk menghitung LABA di Laporan). */
const PACKAGES = [
  { name: "Prasmanan Nusantara", category: "Pernikahan", price: 85000, modal: 55000, minPax: 100, image: "./img/katalog/prasmanan.jpg",
    menu: ["Nasi putih & nasi liwet", "Ayam bakar madu", "Rendang daging sapi", "Sayur asem", "Kerupuk, sambal, buah"] },
  { name: "Royal Wedding Buffet", category: "Pernikahan", price: 150000, modal: 100000, minPax: 300, image: "./img/katalog/wedding.jpg",
    menu: ["2 jenis nasi & 6 lauk", "Zuppa soup", "4 stall gubukan", "Dessert corner", "Dekorasi meja"] },
  { name: "Gubukan Stall Food", category: "Pernikahan", price: 95000, modal: 62000, minPax: 150, image: "./img/katalog/gubukan.jpg",
    menu: ["Nasi goreng kampung", "Sate ayam & kambing", "Bakso", "Siomay", "Es campur"] },
  { name: "Nasi Box Sehat", category: "Kantor", price: 45000, modal: 28000, minPax: 30, image: "./img/katalog/nasibox.jpg",
    menu: ["Nasi merah / putih", "Ayam panggang", "Telur & sayur", "Buah segar", "Air mineral"] },
  { name: "Corporate Lunch Set", category: "Kantor", price: 120000, modal: 78000, minPax: 50, image: "./img/katalog/corporate.jpg",
    menu: ["Salad", "Main course ikan / daging", "Roti & butter", "Dessert"] },
  { name: "Coffee Break", category: "Snack", price: 30000, modal: 18000, minPax: 25, image: "./img/katalog/coffee.jpg",
    menu: ["Kopi & teh", "3 jenis kue basah", "Pastry", "Air mineral"] },
  { name: "Dessert Corner", category: "Snack", price: 35000, modal: 21000, minPax: 50, image: "./img/katalog/dessert.jpg",
    menu: ["Panna cotta", "Puding", "Mini cake", "Buah potong"] },
  { name: "Paket Syukuran", category: "Syukuran", price: 55000, modal: 35000, minPax: 50, image: "./img/katalog/syukuran.jpg",
    menu: ["Nasi putih", "Gulai kambing / kari ayam", "Acar & kerupuk", "Teh manis"] },
  { name: "Party Western", category: "Syukuran", price: 75000, modal: 48000, minPax: 30, image: "./img/katalog/party.jpg",
    menu: ["Mini burger", "Spaghetti", "Chicken wings & fries", "Soft drink"] },
];

const rupiah = (value) => "Rp " + value.toLocaleString("id-ID");

// Minimal pemesanan (pax) untuk sebuah nama paket
function minimalPax(namaPaket) {
  const paket = PACKAGES.find((p) => p.name.toLowerCase() === String(namaPaket || "").trim().toLowerCase());
  return paket ? paket.minPax : PENGATURAN.minimalPaxCustom;
}

// Modal per pax untuk sebuah pesanan (paket custom memakai persen dari harga jual)
function modalPerPax(namaPaket, hargaJual) {
  const paket = PACKAGES.find((p) => p.name.toLowerCase() === String(namaPaket || "").trim().toLowerCase());
  if (paket && paket.modal != null) return paket.modal;
  return Number(hargaJual || 0) * (PENGATURAN.persenModalCustom / 100);
}

// Isi jenis paket dan harga per pax di form booking
function pilihPaket(index) {
  const paket = PACKAGES[index];
  const form = document.querySelector("#bookingForm");
  form.packageType.value = paket.name;
  form.pricePerPax.value = paket.price;
  if (!form.pax.value || Number(form.pax.value) < paket.minPax) form.pax.value = paket.minPax;
  form.packageType.dispatchEvent(new Event("input"));
  form.pricePerPax.dispatchEvent(new Event("input")); // supaya estimasi total ikut berubah
  document.querySelectorAll(".picker-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.index === String(index));
  });
}

function renderKatalog() {
  // Halaman katalog
  document.querySelector("#catalogGrid").innerHTML = PACKAGES.map((paket, index) => `
    <article class="package">
      <img src="${paket.image}" alt="${paket.name}" loading="lazy" />
      <div class="package-body">
        <span class="package-cat">${paket.category}</span>
        <h3>${paket.name}</h3>
        <ul>${paket.menu.map((item) => `<li>${item}</li>`).join("")}</ul>
        <div class="package-foot">
          <div class="package-price">
            <strong>${rupiah(paket.price)}</strong> <span>per pax</span>
            <small>Minimal ${paket.minPax} pax · modal ${rupiah(paket.modal)} · laba ${rupiah(paket.price - paket.modal)}/pax</small>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-pilih="${index}" data-perlu="tulis">Pakai paket</button>
        </div>
      </div>
    </article>`).join("");

  // Pilihan paket di form booking
  document.querySelector("#packagePicker").innerHTML = PACKAGES.map((paket, index) => `
    <button type="button" class="picker-card" data-index="${index}">
      <img src="${paket.image}" alt="" />
      <strong>${paket.name}</strong>
      <span>${rupiah(paket.price)}/pax, min ${paket.minPax}</span>
    </button>`).join("");

  // Saran nama paket saat mengetik
  document.querySelector("#packageList").innerHTML = PACKAGES.map((p) => `<option value="${p.name}"></option>`).join("");

  document.querySelectorAll(".picker-card").forEach((card) => {
    card.addEventListener("click", () => pilihPaket(Number(card.dataset.index)));
  });

  document.querySelectorAll("[data-pilih]").forEach((button) => {
    button.addEventListener("click", () => {
      App.setActiveTab("booking");
      pilihPaket(Number(button.dataset.pilih));
    });
  });

  // Hapus tanda pilihan saat form dibersihkan
  document.querySelector("#bookingForm").addEventListener("reset", () => {
    document.querySelectorAll(".picker-card").forEach((card) => card.classList.remove("is-selected"));
  });
}
