export class ZohoApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ZohoApiError";
  }
}

export class ZohoAuthError extends ZohoApiError {
  constructor(message: string, details?: unknown) {
    super(message, 401, "ZOHO_AUTH", details);
    this.name = "ZohoAuthError";
  }
}

export class ZohoRateLimitError extends ZohoApiError {
  constructor(message = "Zoho rate limit exceeded", details?: unknown) {
    super(message, 429, "ZOHO_RATE_LIMIT", details);
    this.name = "ZohoRateLimitError";
  }
}

export class ZohoValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ZohoValidationError";
  }
}
