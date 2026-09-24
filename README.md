# Maintenance Request Log — PT Hirose Electric Indonesia

Aplikasi internal buat catat permintaan perbaikan mesin di pabrik. Operator bikin request kalau mesin bermasalah, supervisor yang setujuin atau tolak, dan admin pegang kendali penuh: kelola user, edit/delete data apa pun.

## Menjalankan Aplikasi

Dari clone yang masih bersih:

```bash
cp .env.example .env
docker compose up --build
```

Buka **http://localhost:8080**. Gak ada langkah manual lain — migrasi database dan seed user jalan otomatis pas container api pertama kali boot. Kalau mau cek kondisi server: **http://localhost:3000/api/health** harus balas `{"status":"ok","db":"up"}`.

Satu catatan: compose-nya pakai healthcheck berantai (db → api → web), jadi urutan start gak bakal error walau mesinnya lambat.

## Akun Seed

| Role | Email | Password |
|---|---|---|
| Operator | `operator@hirose.test` | `Operator123!` |
| Supervisor | `supervisor@hirose.test` | `Supervisor123!` |
| Admin | `admin@hirose.test` | `Admin123!` |

Seed-nya idempotent — container restart gak bikin data dobel.

## Teknologi yang Dipakai

| Layer | Pilihan | Alasan singkat |
|---|---|---|
| Frontend | Vue 3 + Vite | Soal bilang "Vue 3 atau Nuxt". Ini aplikasi internal di belakang login, SSR gak relevan — Nuxt cuma nambah kompleksitas. |
| Backend | Hono (TypeScript) | Soal bilang "Hono atau Go, pilih satu". Satu bahasa buat seluruh repo, tipe `Role`/`Status` bisa dipakai bareng frontend. |
| Database | PostgreSQL 16 + Drizzle ORM | Drizzle tetap ngasilin file migrasi SQL asli yang bisa dibaca, tapi kodenya type-safe. |
| Auth | Session token di tabel `sessions` | Penjelasan lengkap di bawah. |
| Password | bcryptjs | Murni JS, gak butuh kompilasi native — build Docker jadi konsisten. |
| Validasi | zod | Skema satu sumber kebenaran, otomatis balas 400 kalau input salah. |
| Deploy | Docker Compose | Tiga service: db, api, web. |
| CI | Jenkinsfile | Cuma dibaca & ditanyain, jadi stage-nya dijelasin di bawah. |

## Matriks Permission

| # | Aksi | Operator | Supervisor | Admin |
|---|---|---|---|---|
| 1 | Create a request | ✅ | ✅ | ✅ |
| 2 | View own requests | ✅ | ✅ | ✅ |
| 3 | View all requests | ❌ | ✅ | ✅ |
| 4 | Edit own request while status is Submitted | ✅ | ✅ | ✅ |
| 5 | Edit any request | ❌ | ❌ | ✅ |
| 6 | Approve or reject a request | ❌ | ✅ | ✅ |
| 7 | Delete a request | ❌ | ❌ | ✅ |
| 8 | Create / edit / deactivate users | ❌ | ❌ | ✅ |

Semua aturan ini di-enforce di server, bukan cuma disembunyikan dari UI. Implementasinya di `backend/src/policy.ts` — satu file berisi semua aturan, dan route tinggal manggil fungsi `canX(...)`-nya. Ada 30 tes otomatis yang ngecek matriks ini langsung lewat API (cara jalannya di bagian bawah).

## Keputusan Auth: Session Token, Bukan JWT

Awalnya sempat kepikiran JWT karena simpel, tapi soal minta *"login and logout with session or token handling you can justify"* — kata kuncinya **logout yang beneran**. JWT stateless gak bisa dicabut sebelum expired, kecuali bikin blacklist yang justru bikin dia stateful lagi. Jadi saya pakai **session token opaque yang disimpan di database**:

- Login → server bikin token random 32 byte, disimpen di tabel `sessions`, TTL 8 jam (satu shift kerja).
- Token dikirim lewat **httpOnly cookie** (`sid`) biar JS gak bisa baca (anti-XSS), dan juga dibales di body JSON biar gampang dites pakai curl.
- Logout → token dihapus dari database, langsung mati. Kalau mau buktiin, tes-nya ada di bagian test: setelah logout, token yang sama gak bisa dipakai lagi (401).
- Sesi expired dibersihin otomatis tiap jam.

## Arsitektur

```
Browser ──► nginx (web) ──/api/──► Hono API (api) ──► PostgreSQL (db)
              :8080                    :3000               :5432
```

- **Satu origin, tanpa CORS** — nginx yang serve frontend sekaligus nerusin `/api/*` ke backend. Gak perlu ngurus CORS di production.
- **SPA fallback** ada di nginx, jadi refresh halaman `/requests/1` gak bakal 404.
- **Layout-nya sidebar** — menu (daftar request, request baru, kelola user, logout) ada di kiri, plus info user yang lagi login. Di HP sidebar berubah jadi menu tarik (hamburger), dan form tambah user muncul sebagai popup biar halamannya tetep rapi.
- **Hash password gak pernah keluar dari API** — query user pake kolom yang dipilih eksplisit, kolom hash gak pernah disertakan.
- **Audit trail** — tiap perubahan status request dicatat (siapa, dari status apa, ke status apa, kapan, plus catatan) dan ditampilkan sebagai timeline di halaman detail request.

## Jenkinsfile: Penjelasan Stage

Jenkins server-nya sendiri gak bakal dijalanin — tapi stage-nya bakal ditanya, jadi ini isinya:

| Stage | Fungsinya |
|---|---|
| Checkout | Ambil kode dari repo. `git log` ditampilkan biar commit history kelihatan di log build. |
| Install Dependencies | Install backend & frontend paralel dengan `--frozen-lockfile` biar versi dependency sama persis kayak lokal. |
| Lint & Typecheck | Gerbang paling murah — kalau typo kode, gagal di sini duluan sebelum buang waktu build image. |
| Build Frontend | Bukti frontend beneran bisa di-build. |
| Build Images | Build image backend & frontend. |
| Integration Test — Permission Matrix | Stage paling penting: nyalain stack penuh, tunggu semua healthy, terus jalanin 30 tes matriks dari dalam container. Ini bukti aturan permission beneran berlaku di server. |
| Teardown | `down -v` wajib biar run berikutnya mulai dari database bersih. |

## Bonus yang Dikerjakan (max 2 sesuai soal)

1. **Audit trail** — tabel `request_audit`, endpoint `GET /api/requests/:id/history`, dan timeline-nya tampil di halaman detail.
2. **Automated test matriks permission** — 30 tes yang login sebagai ketiga role dan ngecek semua 8 baris matriks, termasuk kasus jebakan (supervisor coba edit request orang lain → harus 403) dan bukti logout beneran mencabut token.

Yang ikut kebawa (gak dihitung sebagai bonus): Dockerfile multi-stage (hasilnya api 255 MB, web 93.8 MB), health check endpoint, dan healthcheck di tiap service compose.

## Menjalankan Test

```bash
cp .env.example .env
docker compose up -d --build
./scripts/wait-for-healthy.sh

# tes dari dalam container (persis yang Jenkinsfile jalanin)
docker compose exec -T -e TEST_BASE_URL=http://web:80/api api node --test dist/tests/permission-matrix.test.js
```

## Keterbatasan yang Diketahui

- Belum ada pagination — list request nampilin semua data. Buat pabrik kecil oke, kalau datanya udah ribuan perlu `LIMIT/OFFSET` + search.
- Sesi selalu 8 jam, belum ada remember-me.
- Belum ada rate limiting di endpoint login.
- Kalau sempat, mau ditambahin API documentation (OpenAPI) dan halaman detail yang lebih lengkap dengan data mesin.

## AI Disclosure

Saya pakai AI coding assistant (Hermes Agent) buat bantu ngerjain test ini, dan saya usahain jujur:

**Yang AI bantu:**
- Skeleton proyek & config boilerplate (setup Vite, tsconfig, docker-compose, Dockerfile, Jenkinsfile) — bagian ini repetitif dan umum, lebih cepat pakai AI.
- Draf awal skema zod dan sebagian route CRUD, yang kemudian saya review dan sesuaikan.
- Draf awal tes matriks permission — tapi skenarionya saya yang nentuin, karena itu udah saya pahami dari matriks di soal.

**Yang saya tulis sendiri / putuskan sendiri:**
- Semua keputusan arsitektur: pilih Vue 3 bukan Nuxt, session token bukan JWT, Drizzle, nginx single-origin. Alasannya ada di dokumen ini.
- `policy.ts` — matriks permission jadi kode. Ini bagian inti soal, jadi saya tulis sendiri dan hafal detailnya.

**Satu kasus di mana saya nolak hasil AI:**
AI awalnya nyaranin JWT di localStorage. Saya tolak karena soal minta logout yang sebenarnya — JWT gak bisa dicabut. Saya ganti dengan session token di database dan tulis ulang middleware auth-nya. Pas proses itu saya juga sempat debug bareng AI soal build Docker yang gagal (versi pnpm yang beda dan path migrasi), dan hasil akhirnya udah saya uji dari fresh clone.

Kalau ada detail yang mau didiskusikan, saya siap jelasin — termasuk ngerubah kodenya langsung.
