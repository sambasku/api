import { NotFoundError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { WordGroupRecord } from '../../domain/entities/word-group.entity';
import type {
  AddWordGroupMemberInput,
  CreateWordGroupInput,
  ListWordGroupsInput,
  ListWordGroupsResult,
  UpdateWordGroupInput,
  WordGroupRepository,
} from '../../domain/repositories/word-group.repository';

const GROUP_MIN_NAME = 1;
const GROUP_MAX_NAME = 120;

function assertName(name: string): void {
  const trimmed = name.trim();
  if (trimmed.length < GROUP_MIN_NAME || trimmed.length > GROUP_MAX_NAME) {
    throw new ValidationError([
      {
        field: 'name',
        message: `Nama kelompok wajib diisi, maksimal ${GROUP_MAX_NAME} karakter`,
      },
    ]);
  }
}

export class CreateWordGroupUseCase {
  constructor(private readonly repo: WordGroupRepository) {}
  async execute(input: CreateWordGroupInput): Promise<WordGroupRecord> {
    assertName(input.name);
    return this.repo.create({ ...input, name: input.name.trim() });
  }
}

export class UpdateWordGroupUseCase {
  constructor(private readonly repo: WordGroupRepository) {}
  async execute(input: UpdateWordGroupInput): Promise<WordGroupRecord> {
    if (input.name !== undefined) assertName(input.name);
    const updated = await this.repo.update({
      ...input,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    });
    if (!updated) {
      throw new NotFoundError('WORD_GROUP_NOT_FOUND', 'Kelompok kata tidak ditemukan');
    }
    return updated;
  }
}

export class DeleteWordGroupUseCase {
  constructor(
    private readonly repo: WordGroupRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}
  async execute(id: string, actorId: string): Promise<void> {
    const ok = await this.repo.softDelete(id, actorId);
    if (!ok) {
      throw new NotFoundError('WORD_GROUP_NOT_FOUND', 'Kelompok kata tidak ditemukan');
    }
    await this.auditRepo.record({
      userId: actorId,
      action: 'delete',
      entityType: 'word_group',
      entityId: id,
    });
  }
}

export class ListWordGroupsUseCase {
  constructor(private readonly repo: WordGroupRepository) {}
  execute(input: ListWordGroupsInput): Promise<ListWordGroupsResult> {
    return this.repo.list(input);
  }
}

export class GetWordGroupUseCase {
  constructor(private readonly repo: WordGroupRepository) {}
  async execute(id: string, publicOnly = true): Promise<WordGroupRecord> {
    // publicOnly diteruskan ke repo: filter grup published sekaligus anggota
    // published dari kata published (jangan bocorkan antrean moderasi).
    const row = await this.repo.findById(id, publicOnly);
    if (!row) {
      throw new NotFoundError('WORD_GROUP_NOT_FOUND', 'Kelompok kata tidak ditemukan');
    }
    return row;
  }
}

export class AddWordGroupMemberUseCase {
  constructor(private readonly repo: WordGroupRepository) {}
  async execute(input: AddWordGroupMemberInput): Promise<WordGroupRecord> {
    const group = await this.repo.findById(input.groupId);
    if (!group) {
      throw new NotFoundError('WORD_GROUP_NOT_FOUND', 'Kelompok kata tidak ditemukan');
    }
    if (!(await this.repo.wordExists(input.wordId))) {
      throw new NotFoundError('WORD_NOT_FOUND', 'Kata tidak ditemukan');
    }
    const updated = await this.repo.addMember(input);
    if (!updated) {
      throw new NotFoundError('WORD_GROUP_NOT_FOUND', 'Kelompok kata tidak ditemukan');
    }
    return updated;
  }
}

export class RemoveWordGroupMemberUseCase {
  constructor(private readonly repo: WordGroupRepository) {}
  async execute(groupId: string, wordId: string, actorId: string): Promise<void> {
    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new NotFoundError('WORD_GROUP_NOT_FOUND', 'Kelompok kata tidak ditemukan');
    }
    const ok = await this.repo.removeMember(groupId, wordId, actorId);
    if (!ok) {
      throw new NotFoundError('WORD_GROUP_MEMBER_NOT_FOUND', 'Kata bukan anggota kelompok ini');
    }
  }
}
