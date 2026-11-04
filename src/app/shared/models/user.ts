/** Limite do nome exibido, no cadastro e no perfil. */
export const USER_NAME_MAX_LENGTH = 80;

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
