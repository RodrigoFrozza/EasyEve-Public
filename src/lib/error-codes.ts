export const ErrorCodes = {
  CHUNK_LOAD_ERROR: 'E001',

  ESI_TOKEN_EXPIRED: 'A001',
  ESI_TOKEN_INVALID: 'A002',
  ESI_FETCH_FAILED: 'A003',
  ESI_REFRESH_FAILED: 'A004',
  ESI_NO_TOKEN: 'A005',
 
  OAUTH_EXCHANGE_FAILED: 'B001',
  OAUTH_INVALID_RESPONSE: 'B002',

  API_FETCH_FAILED: 'C001',
  API_NOT_FOUND: 'C002',
  API_UNAUTHORIZED: 'C003',
  API_FORBIDDEN: 'C004',
  API_SERVER_ERROR: 'C005',
  INSUFFICIENT_PERMISSIONS: 'C006',

  VALIDATION_FAILED: 'D001',
  INVALID_INPUT: 'D002',
  VALIDATION_ERROR: 'D003',
  NOT_FOUND: 'D004',
  API_CONFLICT: 'C008',
  RATE_LIMIT_EXCEEDED: 'C009',

  DATABASE_ERROR: 'E002',
  DB_CONNECTION_FAILED: 'E003',

  ESI_ERROR: 'A006',
  ESI_RATE_LIMITED: 'A007',
  ESI_ERROR_LIMIT_EXCEEDED: 'A008',
  INTERNAL_ERROR: 'C007',
  UNKNOWN_ERROR: 'Z999',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
export type ErrorCodeKey = keyof typeof ErrorCodes

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.CHUNK_LOAD_ERROR]: 'Error loading resource. Please refresh the page.',

  [ErrorCodes.ESI_TOKEN_EXPIRED]: 'Session expired. Please log in again.',
  [ErrorCodes.ESI_TOKEN_INVALID]: 'Invalid token. Please log in again.',
  [ErrorCodes.ESI_FETCH_FAILED]: 'Failed to fetch character data.',
  [ErrorCodes.ESI_REFRESH_FAILED]: 'Failed to refresh session.',
  [ErrorCodes.ESI_NO_TOKEN]: 'Session not found. Please log in.',

  [ErrorCodes.OAUTH_EXCHANGE_FAILED]: 'Authentication failed.',
  [ErrorCodes.OAUTH_INVALID_RESPONSE]: 'Invalid response from authentication server.',

  [ErrorCodes.API_FETCH_FAILED]: 'Failed to communicate with server.',
  [ErrorCodes.API_NOT_FOUND]: 'Resource not found.',
  [ErrorCodes.API_UNAUTHORIZED]: 'Unauthorized.',
  [ErrorCodes.API_FORBIDDEN]: 'Access denied.',
  [ErrorCodes.API_SERVER_ERROR]: 'Internal server error.',
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions.',

  [ErrorCodes.VALIDATION_FAILED]: 'Invalid data.',
  [ErrorCodes.INVALID_INPUT]: 'Invalid input.',
  [ErrorCodes.VALIDATION_ERROR]: 'Validation error.',
  [ErrorCodes.NOT_FOUND]: 'Resource not found.',
  [ErrorCodes.API_CONFLICT]: 'Resource conflict.',
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please try again later.',

  [ErrorCodes.DATABASE_ERROR]: 'Database error.',
  [ErrorCodes.DB_CONNECTION_FAILED]: 'Database connection failed.',

  [ErrorCodes.ESI_ERROR]: 'Error calling EVE ESI service.',
  [ErrorCodes.ESI_RATE_LIMITED]: 'ESI rate limit reached. Please wait.',
  [ErrorCodes.ESI_ERROR_LIMIT_EXCEEDED]: 'ESI error limit exceeded. Backing off to prevent ban.',
  [ErrorCodes.INTERNAL_ERROR]: 'Internal server error.',
  [ErrorCodes.UNKNOWN_ERROR]: 'Unknown error.',
}

export function getErrorMessage(code: ErrorCode): string {
  return ErrorMessages[code] || ErrorMessages[ErrorCodes.UNKNOWN_ERROR]
}

export function isKnownErrorCode(code: string): code is ErrorCode {
  return code in ErrorMessages
}