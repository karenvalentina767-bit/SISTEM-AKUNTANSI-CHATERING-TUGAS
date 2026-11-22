# Versi demo (tanpa Supabase)

`demo-backend.js` menggantikan `backend/app.js`: semua aturan dari `schema.sql` ditiru di JavaScript
dan data disimpan di browser (localStorage), lengkap dengan contoh data.

Cara pakai: salin isi `frontend/` ke folder baru, taruh `demo-backend.js` di `js/`, lalu di
`index.html` dan `admin.html` hapus script supabase-js dan ganti `../backend/app.js` dengan `./js/demo-backend.js`.
Login owner: email & password apa saja. Tombol "Reset data" ada di pojok kanan bawah dashboard.
