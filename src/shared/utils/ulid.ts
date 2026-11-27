import { monotonicFactory, ulid } from 'ulid';

// Strategi ID - ULID (api-base-stack.md Section 19):
// time-sortable, URL-safe, 26 char, digenerate di aplikasi bukan DB sequence.
export function generateId(): string {
  return ulid();
}

const monotonicUlid = monotonicFactory();

// ULID monotonic per isolate: dua id dalam milidetik yang sama tetap terurut
// sesuai urutan dibuat. Dipakai tabel yang dibaca terurut by id (audit_logs).
export function generateMonotonicId(): string {
  return monotonicUlid();
}
