export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') => new AppError(400, code, message);
export const unauthorized = (message = 'Cần đăng nhập', code = 'UNAUTHORIZED') => new AppError(401, code, message);
export const forbidden = (message = 'Không đủ quyền', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (message = 'Không tìm thấy', code = 'NOT_FOUND') => new AppError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
