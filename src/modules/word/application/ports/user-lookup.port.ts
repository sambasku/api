/** Lookup user minimal untuk validasi atribusi impor (hindari ketergantungan penuh modul auth). */
export interface UserLookupPort {
  findById(id: string): Promise<{ id: string; isActive: boolean } | null>;
}
