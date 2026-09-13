export class McpAppError extends Error {
  constructor(message, { code = 'INTERNAL_ERROR', status = 500, details } = {}) {
    super(message);
    this.name = 'McpAppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export function publicError(error) {
  if (error instanceof McpAppError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      }
    };
  }
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '予期しないエラーが発生しました。保存は成功していません。'
    }
  };
}
