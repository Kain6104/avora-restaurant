import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

export const BranchScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) return undefined;
    
    if (user.role === RoleType.ADMIN) {
      // Admin can view all branches or a specific branch
      const requestedBranchId = request.query.branchId;
      if (requestedBranchId && requestedBranchId !== 'ALL' && requestedBranchId !== 'undefined' && requestedBranchId !== 'null') {
        return requestedBranchId;
      }
      return undefined; // Means all branches
    }
    
    // MANAGER and CHEF are restricted to their own branch
    if (user.role === RoleType.MANAGER || user.role === RoleType.CHEF) {
      if (!user.branchId) {
        throw new ForbiddenException('Your account is not assigned to any branch');
      }
      return user.branchId;
    }
    
    return undefined; // Default fallback for other roles (though they should be blocked by RolesGuard)
  },
);
