# HAMZZ Store v6.0

Update besar HAMZZ Store. Versi **6.0**.

## Fitur baru
- Rating & ulasan pelanggan
- Admin dapat membuat Banner
- Voucher diskon
- Statistik penjualan
- Chat Admin / Chat Pesanan
- Revisi pesanan
- Flash Sale
- Info HAMZZ Store
- Semua fitur baru tersedia dari menu ☰ (strip tiga)
- Tombol Chat Admin untuk pembeli berada di atas menu bawah
- Menu admin utama tetap di bawah: Tambah Produk, Pesanan, Payment
- Checkout: pilih payment dulu, QR baru muncul setelah dipilih, lalu formulir + bukti transfer

## Data online
Data menggunakan Netlify Blobs pada store `hamzz-v4-data` agar data v4/v5 yang sudah ada tetap digunakan.

## Environment Variables
- `HAMZZ_ADMIN_EMAIL`
- `HAMZZ_ADMIN_PASSWORD`
- `HAMZZ_AUTH_SECRET`

Setelah upload ke Netlify, lakukan deploy ulang dan tunggu status **Published**.
