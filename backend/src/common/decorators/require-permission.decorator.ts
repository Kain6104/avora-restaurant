import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRE_PERMISSION_METADATA_KEY = 'REQUIRE_PERMISSION_METADATA';

export interface RequirePermissionOptions {
  branchExtractor?: (req: any) => string | undefined | null;
  branchParam?: string; // e.g. 'branchId', 'id'
  branchQuery?: string; // e.g. 'branchId'
  branchBody?: string;  // e.g. 'branchId'
  resourceResolver?: (req: any, prisma: PrismaService) => Promise<string | null | undefined>;
  allowAllBranchesIfParamMissing?: boolean;
}

export interface PermissionMetadata {
  permission: string;
  options?: RequirePermissionOptions;
}

export const RequirePermission = (
  permission: string,
  options?: RequirePermissionOptions,
): CustomDecorator<string> => {
  return SetMetadata(REQUIRE_PERMISSION_METADATA_KEY, {
    permission,
    options,
  } as PermissionMetadata);
};

// Backward-compatibility decorator
export const Permissions = (
  ...permissions: string[]
): CustomDecorator<string> => {
  // If multiple permissions are passed, we take the primary first one
  const primary = permissions[0] || '';
  return SetMetadata(REQUIRE_PERMISSION_METADATA_KEY, {
    permission: primary,
  } as PermissionMetadata);
};
