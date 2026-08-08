export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    message: string,
    status = 400,
    code = "APP_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(message, 401, "UNAUTHORIZED");
}

export function forbidden(message = "Forbidden") {
  return new AppError(message, 403, "FORBIDDEN");
}

export function notFound(message = "Not found") {
  return new AppError(message, 404, "NOT_FOUND");
}

export function validationError(message: string, details?: unknown) {
  return new AppError(message, 422, "VALIDATION_ERROR", details);
}
