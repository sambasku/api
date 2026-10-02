import { BadRequestError, ForbiddenError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import type { User, UserRole } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { derivePrimaryRole } from '../../domain/entities/user.entity';

export interface UpdateUserRoleCommand {
  targetUserId: string;
  /** Set role baru (replace semua). Minimal satu, tanpa root. */
  newRoles: UserRole[];
  actorId: string;
  actorRoles: string[];
  requestId?: string | null;
}

export interface UpdateUserRoleResult {
  id: string;
  /** @deprecated Derived tertinggi dari roles (wire compat). */
  role: User['role'];
  roles: User['roles'];
}

const allowedRolesForAdmin: User['role'][] = ['contributor', 'editor', 'reviewer', 'admin'];

// Urutan guard: SELALU check security boundary terdalam duluan.
export class UpdateUserRoleUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: UpdateUserRoleCommand): Promise<UpdateUserRoleResult> {
    const target = await this.userRepo.findById(cmd.targetUserId);
    if (!target) {
      throw new BadRequestError('USER_NOT_FOUND', 'User target tidak ditemukan');
    }

    // Guard 1: tidak boleh ubah ROLE user yang ROLEnya root (security boundary)
    if (target.roles.includes('root')) {
      throw new ForbiddenError(
        'CANNOT_CHANGE_ROOT',
        'Tidak diizinkan mengubah user dengan peran root',
      );
    }

    // Guard 2: tidak boleh ubah role sendiri (hindari kunci diri sendiri di luar)
    if (target.id === cmd.actorId) {
      throw new ForbiddenError(
        'CANNOT_CHANGE_SELF_ROLE',
        'Tidak diizinkan mengubah peran sendiri',
      );
    }

    // Guard 3: root role hanya boleh di-set via SQL seed, tidak via endpoint
    if (cmd.newRoles.includes('root')) {
      throw new BadRequestError(
        'INVALID_ROLE',
        'Peran root tidak dapat diatur via panel admin',
      );
    }

    const roles = [...new Set(cmd.newRoles)];
    if (roles.length === 0 || roles.some((r) => !allowedRolesForAdmin.includes(r))) {
      throw new BadRequestError('INVALID_ROLE', 'Peran baru tidak valid');
    }

    const prevRoles = target.roles;
    const sameSet =
      roles.length === prevRoles.length && roles.every((r) => prevRoles.includes(r));
    if (sameSet) {
      return { id: target.id, role: target.role, roles: target.roles };
    }

    await this.userRepo.setRoles(target.id, roles);
    await this.refreshTokenRepo.revokeAllForUser(target.id);

    // Best-effort (tidak throw): audit log tidak boleh bikin request gagal.
    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'update',
      entityType: 'user',
      entityId: target.id,
      oldData: { roles: prevRoles },
      newData: { roles },
      requestId: cmd.requestId ?? null,
    });

    return { id: target.id, role: derivePrimaryRole(roles), roles };
  }
}
