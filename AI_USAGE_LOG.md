# AI Usage Log

Catatan mentah penggunaan AI selama pengerjaan take-home test ini.
Draf ini yang dirapikan ke bagian **AI Disclosure** di README.

## Tools yang digunakan

- **Hermes Agent (Aira)** — AI coding assistant lokal yang bekerja
  berdampingan dengan saya (Zacky) di terminal, menjalankan tooling,
  menulis draf kode, dan mengeksekusi pengujian.

## Bagian yang AI bantu, dan alasannya

| Bagian | Bantuan AI | Kenapa |
|---|---|---|
| Skeleton repo & scaffolding (Vite, tsconfig, git init, struktur folder) | Ditulis AI, saya review | Repetitif, pola sudah umum, tidak mengandung keputusan domain |
| Schema database & migrasi Drizzle | Draf awal AI, saya review SQL hasil generate | Saya baca file SQL-nya baris per baris sebelum commit |
| Route CRUD requests/users + validasi zod | Draf AI, saya sesuaikan | Pola CRUD standar; keputusan aturan tetap di policy.ts yang saya tulis |
| `policy.ts` — matriks permission | **Saya tulis sendiri** | Ini inti soal — harus 100% saya pahami untuk interview |
| `auth/session.ts` — session token | AI menyarankan JWT, **saya tolak** | Brief minta logout sejati; saya pilih session token di DB |
| Tes matriks permission (30 tes) | Draf awal AI, saya sesuaikan skenario + base URL | Skenario sudah saya pahami dari matriks; AI mempercepat penulisan boilerplate test |
| Dockerfile, docker-compose, nginx.conf | AI menulis, saya debug | Ada 3 bug yang saya dan AI telusuri bersama: pnpm 10 policy, path migrasi, tests tidak ke-copy |
| Jenkinsfile | AI menulis, saya jelaskan tiap stage di README | Jenkins tidak bisa dijalankan; kualitas = bisa dijelaskan |
| README & AI usage log ini | AI menyusun, saya koreksi | Dokumen ini mencerminkan kerja nyata di atas |

## Bagian yang saya tulis sendiri

- **`policy.ts`** — seluruh matriks permission sebagai fungsi murni.
- **Keputusan arsitektur** — Vue 3 bukan Nuxt; session token bukan JWT;
  Drizzle; nginx single-origin; pnpm 9 di Docker (setelah debug pnpm 10).
- **Alasan & narasi di README** — semua "Kenapa" saya tulis sendiri setelah
  memahami trade-off-nya.

## Satu kasus di mana saya menolak hasil AI

AI menyarankan **JWT di localStorage** untuk auth. Saya tolak karena brief
menyebut *"Login and logout"* — logout sejati butuh token yang bisa dicabut
di server. Saya ganti dengan session token opaque di tabel `sessions`
(+ httpOnly cookie + header Bearer agar bisa diuji via curl), dan menulis
ulang middleware-nya.

## Bagaimana saya memverifikasi hasil AI

- Setiap blok kode di-typecheck (`tsc --noEmit` / `vue-tsc --noEmit`) sebelum commit.
- Setiap commit = unit logis yang benar-benar berjalan (tidak ada commit "kode mati").
- RBAC diverifikasi 2x: uji manual 16 skenario curl, lalu 30 tes otomatis dari dalam container Docker.
- `docker compose up` diuji dari clean clone (lihat README) — sesuai permintaan brief.
