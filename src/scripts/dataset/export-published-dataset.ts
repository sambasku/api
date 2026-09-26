/**
 * @deprecated Export dataset pindah ke repo `database/`.
 * Jalankan: `cd ../database && pnpm dataset:export`
 */
console.error(`
dataset:export sudah pindah ke repo publik sambasku/database.

  cd database
  cp .env.example .env   # isi DATABASE_URL + DATABASE_AUTH_TOKEN
  pnpm install
  pnpm dataset:export
`);
process.exit(1);
