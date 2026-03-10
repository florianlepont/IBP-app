import { HttpException } from '@nestjs/common';

export type SyncMappedError = {
  status: 'retryable_error' | 'fatal_error';
  error: { code: string; message: string; http_status?: number; details?: Record<string, unknown> };
};

export function mapSyncError(error: unknown): SyncMappedError {
  let httpStatus: number | undefined;
  if (error instanceof HttpException) {
    httpStatus = error.getStatus();
  }

  const extracted = extractSyncErrorPayload(error);
  const retryable = typeof httpStatus === 'number' ? httpStatus >= 500 || httpStatus === 429 : true;
  const code = extracted.code
    ? extracted.code
    : retryable
      ? defaultRetryableSyncCode(httpStatus)
      : typeof httpStatus === 'number'
        ? `http_${httpStatus}`
        : 'sync_fatal_error';

  return {
    status: retryable ? 'retryable_error' : 'fatal_error',
    error: {
      code,
      message: extracted.message,
      http_status: httpStatus,
      details: extracted.details
    }
  };
}

function extractSyncErrorPayload(error: unknown): {
  code?: string;
  message: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string' && response.trim().length > 0) {
      return { message: response };
    }
    if (response && typeof response === 'object') {
      const objectResponse = response as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
        error?: unknown;
      };
      const message = Array.isArray(objectResponse.message)
        ? objectResponse.message.map((value) => String(value)).join(' | ')
        : typeof objectResponse.message === 'string'
          ? objectResponse.message
          : typeof objectResponse.error === 'string'
            ? objectResponse.error
            : 'Sync operation failed';
      const code = typeof objectResponse.code === 'string' ? objectResponse.code : undefined;
      const details =
        objectResponse.details && typeof objectResponse.details === 'object' && !Array.isArray(objectResponse.details)
          ? (objectResponse.details as Record<string, unknown>)
          : undefined;
      return { code, message, details };
    }
  }

  if (error instanceof Error && error.message) {
    return { message: error.message };
  }

  return { message: 'Unexpected sync failure' };
}

function defaultRetryableSyncCode(httpStatus?: number): string {
  if (httpStatus === 429) {
    return 'rate_limited';
  }
  if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504 || typeof httpStatus !== 'number') {
    return 'network_gateway_error';
  }
  return 'transient_upstream_error';
}
