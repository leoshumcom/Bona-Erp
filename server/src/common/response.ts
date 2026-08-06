// 统一响应格式
export const success = (data: unknown, message = '操作成功') => ({
  success: true,
  message,
  data,
});

export const error = (message: string, code = 400) => ({
  success: false,
  message,
  code,
});

export const paginated = (data: unknown[], total: number, page: number, pageSize: number) => ({
  success: true,
  data,
  pagination: {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  },
});
