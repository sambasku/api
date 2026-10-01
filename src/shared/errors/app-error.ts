// Hierarki error lintas modul - lihat api-base-stack.md Section 13.
// Use case melempar class ini langsung; mereka tidak tahu soal Hono.
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
}

export class ValidationError extends AppError {
  statusCode = 400;
  errorCode = 'VALIDATION_ERROR';
  constructor(
    public details: { field: string; message: string }[],
  ) {
    super('Data yang dikirim belum sesuai');
  }
}

export class NotFoundError extends AppError {
  statusCode = 404;
  errorCode: string;
  constructor(errorCode: string, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

export class UnauthorizedError extends AppError {
  statusCode = 401;
  errorCode: string;
  // errorCode bisa dioverride untuk kode spesifik: INVALID_CREDENTIALS, TOKEN_EXPIRED
  constructor(errorCode = 'UNAUTHORIZED', message = 'Kamu belum login') {
    super(message);
    this.errorCode = errorCode;
  }
}

export class ForbiddenError extends AppError {
  statusCode = 403;
  errorCode: string;
  details: { field: string; message: string }[] | null;
  constructor(
    errorCode = 'FORBIDDEN',
      message = 'Akses ini terbatas',
    details: { field: string; message: string }[] | null = null,
  ) {
    super(message);
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  statusCode = 400;
  errorCode: string;
  details: { field: string; message: string }[] | null;
  // errorCode bisa dioverride untuk kode spesifik: INVALID_ROLE,
  // SEARCH_MISS_TERM_MISMATCH, dll
  constructor(
    errorCode = 'BAD_REQUEST',
      message = 'Data yang dikirim belum sesuai',
    details: { field: string; message: string }[] | null = null,
  ) {
    super(message);
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class ConflictError extends AppError {
  statusCode = 409;
  errorCode: string;
  /** Payload opsional (mis. DUPLICATE_MEANING: word_id / meaning_id). */
  data: Record<string, unknown> | null;
  // errorCode bisa dioverride untuk kode spesifik: EMAIL_ALREADY_EXISTS, dst
  constructor(
    errorCode = 'CONFLICT',
    message = 'Konflik data',
    data: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.errorCode = errorCode;
    this.data = data;
  }
}

export class RateLimitedError extends AppError {
  statusCode = 429;
  errorCode = 'RATE_LIMITED';
  constructor(
    message = 'Kebanyakan permintaan, coba lagi nanti ya.',
    public retryAfterSeconds = 120,
  ) {
    super(message);
  }
}

export class ServiceUnavailableError extends AppError {
  statusCode = 503;
  errorCode: string;
  constructor(errorCode = 'SERVICE_UNAVAILABLE', message = 'Layanan tidak tersedia') {
    super(message);
    this.errorCode = errorCode;
  }
}

/** Upstream third-party gagal / timeout / payload tak terparse (502). */
export class BadGatewayError extends AppError {
  statusCode = 502;
  errorCode: string;
  constructor(errorCode = 'BAD_GATEWAY', message = 'Layanan hulu gagal') {
    super(message);
    this.errorCode = errorCode;
  }
}
