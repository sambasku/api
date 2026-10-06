# Fix: 29 suite e2e CI gagal — Cannot find module './smtp-mailer.service'

## Goal

Pulihkan CI staging (job `test` di deploy-staging.yml) dengan mengganti `require('./smtp-mailer.service')` (CommonJS) menjadi static import ESM di `src/modules/auth/infrastructure/mailer.factory.ts`.

## Current context / asumsi

- Error Tuan lihat itu dari **GitHub Actions run 37366973080 & 37362844168** (branch staging), bukan dari working tree lokal. Log CI: `Error: Cannot find module './smtp-mailer.service'` di `mailer.factory.ts:27`.
- Root cause: commit `0ddefc6` menulis jalur fallback `createMailer()` pakai `const { SmtpMailerService } = require('./smtp-mailer.service')`. Di vitest/ESM, `require` relatif tanpa ekstensi gagal resolve file `.ts` → throw saat `app.ts:444` memanggil `createMailer()` saat module load → SEMUA test file yang meng-import `app.ts` (28-29 suite e2e) gagal di import stage. 149 suite lain (unit, tidak boot app) lolos.
- **Fix sudah ada di working tree lokal (BELUM di-commit)** — diff `mailer.factory.ts` sudah mengganti `require` jadi static import. Local `pnpm test` = 177 file / 1102 test PASS, `pnpm typecheck` PASS. Yang perlu dilakukan: verifikasi RED→GREEN lalu commit TERBATAS file itu.
- Pola static import ini terbukti aman di CI sebelumnya: commit `34c573a` pakai static import `SmtpMailerService` dan deploy staging SUCCESS (run 37338399894). `require()` diperkenalkan `0ddefc6` dan langsung merusak CI.
- Working tree ada 20+ file modified lain (dashboard, legal, word, dll) — WIP Tuan, JANGAN ikut ter-commit.
- Repo rule (`.cursor/rules/no-auto-commit-push.mdc`): commit/push hanya kalau Tuan eksplisit minta.

## Architecture / pendekatan

Satu-file fix: hapis baris `require()` + eslint-disable, pindahkan `SmtpMailerService` ke static import di atas file (impornya sudah ada di working tree — tinggal verifikasi). Static import menarik `nodemailer` ke bundle, tapi itu sudah terbukti lolos `wrangler deploy` (CI 34c573a hijau) karena Workers pakai `nodejs_compat`. Tidak perlu lazy import async — factory dipanggil sinkron di `app.ts`.

## Step-by-step tasks

### 1. Verifikasi file sudah benar (RED evidence dulu)

Pastikan isi `src/modules/auth/infrastructure/mailer.factory.ts` working tree persis begini di bagian atas dan akhir:

```ts
import type { MailerPort } from '../application/ports/mailer.port';
import { QuotaAwareMailer } from '@/modules/email/infrastructure/quota-aware-mailer';
import { ResendEmailSender } from '@/modules/email/infrastructure/resend-email.sender';
import { SmtpMailerService } from './smtp-mailer.service';
```

dan di ujung `createMailer()`:

```ts
  // ponytail: jalur fallback hanya dipakai test/unit lama; production app.ts selalu kasih deps.
  return new SmtpMailerService();
}
```

Tidak boleh ada lagi baris `require(` maupun `eslint-disable-next-line @typescript-eslint/no-var-requires` di file ini.

Bukti RED (opsional, memakai stash yang aman dan langsung di-pop balik):

```bash
git stash push -- src/modules/auth/infrastructure/mailer.factory.ts
npx vitest run src/modules/audit/__tests__/e2e/audit-logs.e2e.test.ts 2>&1 | tail -5
# expected: FAIL ... Error: Cannot find module './smtp-mailer.service'
git stash pop
```

### 2. Verifikasi GREEN lokal

```bash
pnpm run typecheck
# expected: exit 0, tanpa output error

pnpm run test
# expected (output persis):
#   Test Files  177 passed (177)
#        Tests  1102 passed (1102)
```

### 3. Commit TERBATAS satu file (butuh go-ahead Tuan dulu)

```bash
git add src/modules/auth/infrastructure/mailer.factory.ts
git commit -m "fix(auth): ganti require() smtp-mailer.service dengan static import (ESM/vitest)

require() relatif tanpa ekstensi gagal resolve .ts di vitest, membuat
semua suite e2e yang import app.ts gagal load module (CI run 37366973080)."
git status --short   # pastikan file lain masih modified/untracked, tidak ikut
```

### 4. Push staging + pantau CI (butuh go-ahead Tuan dulu)

```bash
git push origin staging
gh run watch --branch staging --exit-status
# expected: deploy-staging.yml SUCCESS (job test: 177 file pass, lalu wrangler deploy sukses)
```

Kalau tidak mau push langsung, alternatif: buat branch fix + PR — ikut alur standar Tuan.

## Tests / validation

- Tidak perlu test baru (YAGNI): 28 suite e2e yang gagal DI CI itu sendiri adalah regression test untuk bug ini — begitu fix masuk, mereka hijau lagi. Test unit tambahan untuk `createMailer()` tanpa deps akan duplikat cakupan `auth.e2e.test.ts` yang sudah boot `app.ts`.
- Validasi akhir = CI run terbaru branch staging hijau: `gh run list --branch staging --limit 1` → `completed success`.

## Risks, tradeoffs, open questions

- Static import menarik `nodemailer` ke bundle Workers — risiko rendah, terbukti deploy sukses di `34c573a` sebelum `require()` diperkenalkan. Kalau suatu saat bundle bloat, upgrade path: `await import()` async di jalur fallback (tandai `ponytail:` sudah ada di file).
- Risiko utama operasional: `git add` harus SATU FILE itu saja — working tree penuh WIP Tuan lain.
- Terbuka: kenapa `0ddefc6` lolos saat di-commit (kemungkinan test lokal dijalankan setelah file di-fix, lalu fix-nya lupa di-stage). Bukan scope fix ini.
