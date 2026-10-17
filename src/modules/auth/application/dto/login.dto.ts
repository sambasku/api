export interface LoginDto {
  /** Email ATAU username. Klien mobile kirim 'identifier', console/web 'email'. */
  identifier: string;
  password: string;
}
