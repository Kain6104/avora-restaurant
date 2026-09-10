import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    // Không throw UnauthorizedException nếu không có token hoặc token không hợp lệ
    // Trả về user nếu hợp lệ, ngược lại trả về null để cho phép khách (Guest) truy cập
    if (err || !user) {
      return null;
    }
    return user;
  }
}
