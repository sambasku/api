import type {
  WordGroupRecord,
  WordGroupStatus,
} from '../entities/word-group.entity';

export interface CreateWordGroupInput {
  name: string;
  description?: string | null;
  status: WordGroupStatus;
  isVerified: boolean;
  createdBy: string;
}

export interface UpdateWordGroupInput {
  id: string;
  name?: string;
  description?: string | null;
  status?: WordGroupStatus;
  isVerified?: boolean;
  updatedBy: string;
}

export interface AddWordGroupMemberInput {
  groupId: string;
  wordId: string;
  notes?: string | null;
  status: WordGroupStatus;
  createdBy: string;
}

export interface ListWordGroupsInput {
  limit: number;
  before?: string;
  q?: string;
  status?: WordGroupStatus;
  /** true = hanya published (endpoint publik). */
  publicOnly?: boolean;
  /** filter kelompok yang memuat kata ini */
  wordId?: string;
}

export interface ListWordGroupsResult {
  items: WordGroupRecord[];
  nextCursor: string | null;
}

export interface WordGroupRepository {
  create(input: CreateWordGroupInput): Promise<WordGroupRecord>;
  update(input: UpdateWordGroupInput): Promise<WordGroupRecord | null>;
  softDelete(id: string, deletedBy: string): Promise<boolean>;
  /** publicOnly=true: hanya anggota status published & kata published. */
  findById(id: string, publicOnly?: boolean): Promise<WordGroupRecord | null>;
  list(input: ListWordGroupsInput): Promise<ListWordGroupsResult>;
  addMember(input: AddWordGroupMemberInput): Promise<WordGroupRecord | null>;
  removeMember(groupId: string, wordId: string, deletedBy: string): Promise<boolean>;
  /** true = kata ada & belum soft-deleted (validasi FK sebelum insert). */
  wordExists(wordId: string): Promise<boolean>;
}
