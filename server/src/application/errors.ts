/** Domain-level application errors, mapped to HTTP status codes at the controller edge. */

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Version conflict — the entry was modified concurrently') {
    super(message, 409, 'CONFLICT');
  }
}

export class ValidationError extends AppError {
  constructor(
    message = 'Invalid request',
    readonly details?: unknown,
  ) {
    super(message, 400, 'VALIDATION');
  }
}
