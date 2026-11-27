import type {
  ActiveProfileCovers,
  ProfileCover,
  ProfileCoverVariant,
} from '../entities/profile-cover.entity';

export interface CreateProfileCoverInput {
  id: string;
  variant: ProfileCoverVariant;
  url: string;
  fileId?: string | null;
  width: number;
  height: number;
  sizeBytes?: number | null;
  isActive: boolean;
  createdBy: string | null;
  activatedAt: Date | null;
}

export interface ProfileCoverRepository {
  listByVariant(variant: ProfileCoverVariant): Promise<ProfileCover[]>;
  findById(id: string): Promise<ProfileCover | null>;
  getActiveUrls(): Promise<ActiveProfileCovers>;
  create(input: CreateProfileCoverInput): Promise<ProfileCover>;
  activate(id: string): Promise<ProfileCover>;
  deleteById(id: string): Promise<void>;
}