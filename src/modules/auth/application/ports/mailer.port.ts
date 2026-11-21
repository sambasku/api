export interface MailerPort {
  sendResetPasswordEmail(to: string, resetUrl: string, displayCode: string): Promise<void>;
  sendVerificationOtpEmail(to: string, displayCode: string): Promise<void>;
  sendAccountDeletionEmail(to: string, displayCode: string, pageUrl: string): Promise<void>;
  sendVerifierApprovedEmail(to: string, displayName: string): Promise<void>;
  sendBalehoPaymentEmail(
    to: string,
    input: {
      displayName: string;
      placementId: string;
      sizeLabel: string;
      positionLabel: string;
    },
  ): Promise<void>;
}
