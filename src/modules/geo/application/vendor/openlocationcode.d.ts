/** Tipografi longgar untuk vendor Apache-2.0 Google Open Location Code. */
export class OpenLocationCode {
  isShort(code: string): boolean;
  isFull(code: string): boolean;
  recoverNearest(
    shortCode: string,
    referenceLatitude: number,
    referenceLongitude: number,
  ): string;
  decode(code: string): {
    latitudeLo: number;
    longitudeLo: number;
    latitudeHi: number;
    longitudeHi: number;
    latitudeCenter: number;
    longitudeCenter: number;
    codeLength: number;
  };
  encode(latitude: number, longitude: number, codeLength?: number): string;
}
