export interface UpdateMyProfileDto {
  displayName?: string;
  bio?: string | null;
  /** true = user tap "Mengerti" di guide swipe halaman kontribusi. */
  hasReadContributionGuide?: true;
}
