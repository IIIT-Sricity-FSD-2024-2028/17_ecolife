import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

/**
 * Wraps every successful response in { success, message, data }.
 * Controllers can return { message, data } to customize the message, or
 * just return raw data and get a generic success message.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        if (result && typeof result === 'object' && 'message' in result && 'data' in result) {
          return {
            success: true as const,
            message: (result as any).message,
            data: (result as any).data,
          };
        }
        return { success: true as const, message: 'Request successful', data: result };
      }),
    );
  }
}
