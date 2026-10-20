export type SetPasswordProvider = 'google' | 'facebook' | 'github';

export interface SetPasswordDto {
  provider: SetPasswordProvider;
  idToken?: string;
  accessToken?: string;
  newPassword: string;
}
