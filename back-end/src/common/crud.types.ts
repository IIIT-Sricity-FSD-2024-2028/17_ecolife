export interface Entity {
  id: string | number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const ok = <T>(message: string, data: T): ApiResponse<T> => ({
  success: true,
  message,
  data,
});
