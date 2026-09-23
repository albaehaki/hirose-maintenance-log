# Maintenance Request Log — PT Hirose Electric Indonesia

Aplikasi web internal untuk mencatat permintaan perawatan mesin pabrik.
Operator membuat request saat mesin bermasalah, Supervisor menyetujui/menolak,
Admin mengelola user dan semua data.

## Teknologi

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend | **Vue 3 + Vite** | Brief bilang "Vue 3 **atau** Nuxt". Ini aplikasi internal di belakang login — SSR/SEO tidak relevan, jadi Nuxt hanya menambah lapisan abstraksi (Nitro server) tanpa nilai tambah. Satu bahasa (TypeScript) dengan backend. |
| Backend | **Hono (TypeScript)** | Brief bilang "Hono **atau** Go, pilih satu". Satu toolchain untuk seluruh repo → bisa share tipe `Role`/`Status`, validasi zod terintegrasi rapi, dan lebih gampang dibaca reviewer dengan background JS. |
| Database | **PostgreSQL 16 + Drizzle ORM** | Drizzle menghasilkan **file migrasi SQL asli** yang bisa dibaca reviewer (type-safety tanpa menyembunyikan SQL-nya), jauh lebih ringan dari Prisma. |
| Auth | **Session token opaque** di tabel `sessions` | Lihat bagian "Keputusan Auth" di bawah. |
| Password | `bcryptjs` (12 rounds) | Murni JavaScript — tidak butuh kompilasi native, jadi `docker build` reproducible di mesin mana pun. |
| Validasi | `zod` + `@hono/zod-validator` | Satu skema sebagai sumber kebenaran, otomatis balas 400 dengan pesan error. |
| Orkestrasi | Docker Compose | Tiga service: `db`, `api`, `web`. |
| CI | Jenkinsfile | Bisa dibaca & dijelaskan; tidak perlu dijalankan di Jenkins server. |

## Cara Menjalankan (dari clean clone)

```bash
cp .env.example .env
docker compose up --build
```

Lalu buka **http://localhost:8080** (frontend) — tidak ada langkah manual lain:
schema dimigrasi dan seed dijalankan otomatis oleh `entrypoint.sh` saat
container `api` pertama kali boot. Health check tersedia di
**http://localhost:3000/api/health**.

> Docker Compose menunggu PostgreSQL **healthy** (`condition: service_healthy`)
> sebelum memulai API, dan menunggu API healthy sebelum memulai web — jadi
> urutan start otomatis aman, tidak bergantung kecepatan mesin.

## Kredensial Login (seed)

| Role | Email | Password |
|---|---|---|
| Operator | `operator@hirose.test` | `Operator123!` |
| Supervisor | `supervisor@hirose.test` | `Supervisor123!` |
| Admin | `admin@hirose.test` | `Admin123!` |

Seed bersifat **idempotent** — menjalankan ulang (misalnya saat container
restart) tidak akan menduplikasi data.

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

> **Semua aturan di atas di-enforce di server** (file `backend/src/policy.ts`
> + middleware Hono), bukan hanya disembunyikan di UI. Reviewer dapat
> membuktikannya dengan memanggil API secara langsung — lihat bagian Test.

## Keputusan Auth — Kenapa Session Token, Bukan JWT

Brief: *"Login and logout, with session or token handling you can justify."*

Saya memilih **session token opaque yang disimpan di database**, dikirim
lewat **httpOnly cookie** (`sid`) sekaligus diterima lewat header
`Authorization: Bearer`.

| Aspek | Penjelasan |
|---|---|
| **Logout benar-benar bekerja** | Token dihapus dari tabel `sessions` → langsung invalid. JWT stateless tidak bisa dicabut tanpa blacklist (yang ironisnya membuatnya stateful lagi). |
| **Bisa diuji langsung via API** | Reviewer cukup `POST /api/auth/login` → ambil token dari JSON → pakai sebagai `Bearer` di panggilan berikutnya. Tidak perlu cookie jar. |
| **Frontend tetap aman** | Cookie `httpOnly` + `sameSite=Lax` → JavaScript tidak bisa membacanya (proteksi XSS). |
| **Sesi kedaluwarsa** | TTL 8 jam (satu shift kerja), pembersihan otomatis tiap jam. |

Kalimat untuk interview: *"Logout yang sesungguhnya berarti token harus bisa
dicabut di sisi server. JWT tidak bisa dicabut tanpa blacklist, yang membuatnya
stateful kembali sehingga kehilangan keunggulannya."*

## Arsitektur

```
Browser ──► nginx (web) ──/api/──► Hono API (api) ──► PostgreSQL (db)
              :8080                    :3000               :5432
```

- **Satu origin, tanpa CORS**: nginx melayani file statis Vue sekaligus
  meneruskan `/api/*` ke container `api`. Ini menghindari seluruh kelas
  masalah CORS di production.
- **SPA fallback** (`try_files $uri $uri/ /index.html`): refresh di
  `/requests/1` tidak menjadi 404.
- **Layout sidebar**: setelah login, navigasi utama ada di sidebar kiri
  (Daftar Request, Request Baru, Kelola User untuk admin, Logout) dengan
  info user di bawah. Di layar kecil sidebar berubah jadi *off-canvas* dengan
  tombol hamburger. Form tambah user tampil dalam **modal** supaya halaman
  kelola user tetap bersih (+ pencarian user).
- **RBAC terpusat**: `policy.ts` berisi 8 baris matriks permission sebagai
  fungsi murni; route hanya memanggil `canX(...)`. Satu tempat untuk mengubah
  aturan, satu tempat untuk mengetes.
- **`passwordHash` tidak pernah keluar dari API**: query users memakai
  `safeCols` yang eksplisit tidak menyertakan kolom hash.
- **Audit trail**: setiap perubahan status tercatat di tabel `request_audit`
  (siapa, dari status apa, ke status apa, kapan, catatan) dan ditampilkan
  sebagai timeline di halaman detail request.

## Jenkinsfile — Penjelasan Stage

| Stage | Kenapa ada |
|---|---|
| **Checkout** | Ambil kode dari SCM. `git log --oneline -10` sengaja ditampilkan supaya commit history terlihat di log build. |
| **Install Dependencies** | Dua stage paralel (backend + frontend). `--frozen-lockfile` memastikan dependensi identik dengan lokal — mencegah "jalan di CI, gagal di lokal". |
| **Lint & Typecheck** | Gerbang tercepat: gagal di sini lebih murah daripada gagal setelah image dibangun. |
| **Build Frontend** | Buktikan frontend benar-benar bisa di-build, bukan cuma lolos typecheck. |
| **Build Images** | Bangun image backend (multi-stage) & frontend. |
| **Integration Test — Permission Matrix** | **Stage terpenting.** Nyalakan seluruh stack dengan compose, tunggu healthy (`scripts/wait-for-healthy.sh`), lalu jalankan 30 tes yang memanggil API sebagai ketiga role dan memverifikasi setiap baris matriks. Satu-satunya cara membuktikan aturan permission berlaku di server adalah memanggil API yang benar-benar berjalan, dengan database sungguhan, sebagai user sungguhan — unit test dengan mock tidak membuktikan itu. |
| **Teardown** | `down -v` wajib supaya run berikutnya mulai dari database bersih (kalau tidak, seed idempotent akan melewati dan test jadi ambigu). |

## Optional Tasks yang Dikerjakan (maksimal 2, sesuai brief)

1. **Audit trail** — tabel `request_audit` + endpoint `GET /api/requests/:id/history`
   + timeline di halaman detail.
2. **Automated test matriks permission** — 30 tes (`node --test`) yang login
   sebagai ketiga role dan memverifikasi seluruh 8 baris matriks, termasuk
   jebakan "supervisor tidak boleh edit request orang lain" dan "logout
   mencabut token di sisi server".

**Bonus tambahan yang ikut serta** (tidak dihitung sebagai pilihan bonus):
- Multi-stage Dockerfile (ukuran: api **255 MB**, web **93.8 MB** termasuk
  nginx base ~50 MB — perbandingan sebelum/sesudah dicatat selama pengembangan).
- Health check endpoint (`/api/health` = `SELECT 1` ke DB) + healthcheck
  bawaan di compose untuk tiap service.

## Cara Menjalankan Test

```bash
# Setup stack dulu
cp .env.example .env
docker compose up -d --build
./scripts/wait-for-healthy.sh

# Test matriks permission dari dalam container (30 tes)
docker compose exec -T -e TEST_BASE_URL=http://web:80/api api node --test dist/tests/permission-matrix.test.js

# Atau dari host setelah stack jalan
TEST_BASE_URL=http://localhost:8080/api node --test backend/dist/tests/permission-matrix.test.js
```

## Known Limitations & Yang Akan Dikerjakan Berikutnya

- Pagination belum ada — daftar request menampilkan semua (cocok untuk skala
  pabrik kecil; untuk ribuan baris akan ditambahkan `LIMIT/OFFSET` + server
  search).
- Tidak ada refresh token/sesi remember-me — sesi selalu 8 jam.
- UI belum responsif penuh untuk layar kecil (dipakai internal via desktop).
- Belum ada rate limiting di endpoint login.

## AI Disclosure

Dalam pengerjaan test ini, saya menggunakan AI coding assistant (Hermes
Agent) untuk membantu di bagian-bagian berikut:

**Bagian yang AI bantu:**
- **Skeleton proyek & konfigurasi boilerplate** (Vite scaffold, tsconfig,
  docker-compose, Dockerfile multi-stage, Jenkinsfile) — ini pola yang
  repetitif dan sudah umum; AI mempercepat setup sehingga waktu fokus
  terpakai untuk logika domain.
- **Skema zod & sebagian besar route CRUD** — AI menyusun draf awal, lalu
  saya review dan sesuaikan dengan kebutuhan domain.
- **Tes matriks permission** — draf awal 30 tes, saya sesuaikan base URL dan
  skenario dengan arsitektur yang dipakai.

**Bagian yang saya tulis sendiri / saya pilih secara sadar:**
- **Keputusan arsitektur** — Vue 3 (bukan Nuxt), session token opaque (bukan
  JWT), Drizzle (bukan ORM berat), nginx satu-origin (bukan CORS). Semua
  dijelaskan di dokumen ini beserta alasannya.
- **`policy.ts` (matriks permission sebagai kode)** — ini inti soal; saya
  tulis dan hafalkan baris per baris karena akan diwalkthrough di interview.

**Satu kasus di mana saya menolak/menulis ulang hasil AI:**
- AI awalnya menyarankan JWT di localStorage untuk auth. Saya tolak: brief
  menyebut **logout secara eksplisit**, dan logout sejati butuh token yang
  bisa dicabut di server. Saya ganti dengan session token di tabel
  `sessions` + httpOnly cookie, dan menulis ulang middleware auth-nya.

>Saya memahami kode ini sepenuhnya — keputusan arsitektur ada di dokumen ini,
> dan setiap file inti (policy, session, routes) bisa saya jelaskan baris per
> baris.
