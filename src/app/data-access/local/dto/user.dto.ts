import { PasswordHash } from '../../../core/security/password-hasher';
import { User } from '../../../shared/models/user';
import { UserWithCredentials } from '../../repositories/user.repository';

/** Registro de `users` no `localStorage` da demo (e no seed), com o hash da senha. */
export interface UserDto {
  id: string;
  name: string;
  email: string;
  passwordHash: PasswordHash;
  createdAt: string;
}

export function toUserWithCredentials(dto: UserDto): UserWithCredentials {
  const user: User = { id: dto.id, name: dto.name, email: dto.email, createdAt: dto.createdAt };
  return { user, passwordHash: dto.passwordHash };
}

export function toUserDto({ user, passwordHash }: UserWithCredentials): UserDto {
  return { ...user, passwordHash };
}
