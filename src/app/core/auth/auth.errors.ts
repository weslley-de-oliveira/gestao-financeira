/** E-mail ou senha incorretos. A mesma mensagem é usada nos dois casos para não revelar se o e-mail existe. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/** A senha atual informada para confirmar uma operação sensível (excluir a conta) está errada. */
export class IncorrectPasswordError extends Error {
  constructor() {
    super('Incorrect password');
    this.name = 'IncorrectPasswordError';
  }
}
