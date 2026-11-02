import { BadRequestError, ConflictError, ValidationError } from '@/shared/errors/app-error';
import type { AuditLogRepository } from '@/modules/audit/domain/repositories/audit-log.repository';
import { Email } from '../../domain/value-objects/email.vo';
import { Password } from '../../domain/value-objects/password.vo';
import type { User, UserRole } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import { slugifyUsername, USERNAME_HANDLE_REGEX } from '../utils/username-slug';
import { isReservedHandle } from '../utils/reserved-handles';

export const ASSIGNABLE_ADMIN_ROLES = ['contributor', 'editor', 'reviewer', 'admin'] as const;
export type AssignableAdminRole = (typeof ASSIGNABLE_ADMIN_ROLES)[number];

export interface CreateAdminUserCommand {
  username: string;
  email: string;
  phone: string | null;
  password: string;
  roles: UserRole[];
  isActive: boolean;
  actorId: string;
  requestId?: string | null;
}

export class CreateAdminUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly hasher: PasswordHasherPort,
    private readonly auditRepo: AuditLogRepository,
  ) {}

  async execute(cmd: CreateAdminUserCommand): Promise<User> {
    if (cmd.roles.some((r) => !ASSIGNABLE_ADMIN_ROLES.includes(r as AssignableAdminRole))) {
      throw new BadRequestError('INVALID_ROLE', 'Peran root tidak dapat diatur via panel admin');
    }
    if (cmd.roles.length === 0) {
      throw new BadRequestError('INVALID_ROLE', 'Minimal satu peran');
    }

    const email = Email.create(cmd.email);
    Password.create(cmd.password);

    // Username admin = handle @mention juga: normalisasi sama seperti register
    // (lowercase, tanpa spasi/hyphen). Tolak input yang tak menghasilkan
    // handle valid supaya admin sadar, bukan diam-dima dapat nama lain.
    const username = slugifyUsername(cmd.username);
    if (!USERNAME_HANDLE_REGEX.test(username) || isReservedHandle(username)) {
      throw new ValidationError([
        {
          field: 'username',
          message: `Nama pengguna tidak valid. Coba ${username}_sambas atau nama tanpa spasi.`,
        },
      ]);
    }

    if (await this.userRepo.findByUsername(username)) {
      throw new ConflictError('USERNAME_ALREADY_EXISTS', 'Nama sudah dipakai');
    }
    if (await this.userRepo.findByEmail(email.value)) {
      throw new ConflictError('EMAIL_ALREADY_EXISTS', 'Email sudah terdaftar');
    }
    if (cmd.phone && (await this.userRepo.findByPhone(cmd.phone))) {
      throw new ConflictError('PHONE_ALREADY_EXISTS', 'Nomor HP sudah terdaftar');
    }

    const passwordHash = await this.hasher.hash(cmd.password);
    const user = await this.userRepo.save({
      username,
      email: email.value,
      phone: cmd.phone,
      passwordHash,
      emailVerified: true,
      roles: [...new Set(cmd.roles)],
      isActive: cmd.isActive,
    });

    await this.auditRepo.record({
      userId: cmd.actorId,
      action: 'create',
      entityType: 'user',
      entityId: user.id,
      newData: {
        username: user.username,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
        role: user.role,
        is_active: user.isActive,
        email_verified: true,
        via: 'admin',
      },
      requestId: cmd.requestId ?? null,
    });

    return user;
  }
}
