import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const BranchScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    
    // Nếu PermissionsGuard đã thẩm định và xác nhận branchId
    if (request.authorizedBranchId) {
      return request.authorizedBranchId;
    }

    const requestedBranchId = request.query?.branchId;
    if (
      requestedBranchId &&
      requestedBranchId !== 'ALL' &&
      requestedBranchId !== 'undefined' &&
      requestedBranchId !== 'null'
    ) {
      return requestedBranchId;
    }

    return undefined;
  },
);
