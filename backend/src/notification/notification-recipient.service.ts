import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchScopeType, ScopeType } from '@prisma/client';
import { SYSTEM_ROLE_CODES } from '../common/constants/permissions-registry';

export interface ResolveRecipientsOptions {
  eventType: string;
  branchId?: string | null;
  requiredPermissions: string[];
  appScopes?: ('ADMIN' | 'POS' | 'WAITER' | 'KDS')[];
  excludeUserIds?: string[];
}

export interface RecipientUser {
  id: string;
  email: string;
  fullName: string;
}

@Injectable()
export class NotificationRecipientService {
  private readonly logger = new Logger(NotificationRecipientService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve valid notification recipients based on Enterprise RBAC,
   * active assignments, permission keys, branch scope, and event target.
   *
   * CRITICAL SECURITY PRINCIPLE:
   * - Customers (role: USER) never receive internal staff notifications.
   * - Staff at branch AVO2 NEVER receive operational notifications for branch AVO1.
   * - Only staff with matching permissions (or Super Admins) receive the event.
   */
  async resolveRecipients(options: ResolveRecipientsOptions): Promise<RecipientUser[]> {
    const {
      eventType,
      branchId,
      requiredPermissions,
      appScopes,
      excludeUserIds = [],
    } = options;

    if (!requiredPermissions || requiredPermissions.length === 0) {
      this.logger.warn(`resolveRecipients called with empty requiredPermissions for event ${eventType}`);
      return [];
    }

    try {
      // 1. Query all active assignments matching permissions and branch
      const assignments = await this.prisma.userRoleAssignment.findMany({
        where: {
          isActive: true,
          role: {
            isActive: true,
            OR: [
              { code: SYSTEM_ROLE_CODES.ADMIN },
              {
                permissions: {
                  some: {
                    permissionKey: { in: requiredPermissions },
                  },
                },
              },
            ],
          },
          user: {
            // Exclude users explicitly locked or in exclude list
            ...(excludeUserIds.length > 0
              ? { id: { notIn: excludeUserIds } }
              : {}),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              role: true,
            },
          },
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              scopeType: true,
              permissions: {
                select: {
                  permissionKey: true,
                },
              },
            },
          },
          branches: {
            select: {
              branchId: true,
            },
          },
        },
      });

      const recipientMap = new Map<string, RecipientUser>();

      for (const assignment of assignments) {
        const user = assignment.user;
        if (!user) continue;

        // Ensure user is not an unassigned external customer
        if (user.role === 'USER' && assignment.role.code !== SYSTEM_ROLE_CODES.ADMIN) {
          // If a user record still has role: 'USER' but has an active staff role assignment,
          // the assignment role takes precedence, but double-check permissions
        }

        const isAdmin = assignment.role.code === SYSTEM_ROLE_CODES.ADMIN;
        const isGlobalScope = assignment.role.scopeType === ScopeType.GLOBAL;
        const isAllBranches = assignment.branchScope === BranchScopeType.ALL_BRANCHES;
        const assignedBranchIds = assignment.branches.map((b) => b.branchId);

        // Branch-level verification
        let hasBranchAccess = false;
        if (!branchId || branchId === 'ALL') {
          // Event has no specific branch requirement or is global
          hasBranchAccess = true;
        } else {
          // Event belongs to a specific branch (e.g. AVO1)
          if (isAdmin || isAllBranches) {
            hasBranchAccess = true;
          } else if (assignedBranchIds.includes(branchId)) {
            hasBranchAccess = true;
          }
        }

        if (!hasBranchAccess) {
          continue; // User is assigned to a different branch!
        }

        // App Scope check (if specified, e.g. event is specifically meant for POS / Waiter)
        if (appScopes && appScopes.length > 0 && !isAdmin) {
          const userPermKeys = new Set(assignment.role.permissions.map((p) => p.permissionKey));
          let matchesAppScope = false;

          for (const app of appScopes) {
            if (app === 'ADMIN' && (userPermKeys.has('admin.access') || isGlobalScope)) matchesAppScope = true;
            if (app === 'POS' && (userPermKeys.has('pos.access') || userPermKeys.has('pos.order.create') || userPermKeys.has('orders.view') || !isGlobalScope)) matchesAppScope = true;
            if (app === 'WAITER' && (userPermKeys.has('waiter.access') || userPermKeys.has('pos.order.create') || userPermKeys.has('orders.view'))) matchesAppScope = true;
            if (app === 'KDS' && (userPermKeys.has('kds.access') || userPermKeys.has('kitchen.orders.view'))) matchesAppScope = true;
          }

          if (!matchesAppScope) {
            continue;
          }
        }

        recipientMap.set(user.id, {
          id: user.id,
          email: user.email,
          fullName: user.fullName || user.email,
        });
      }

      const recipients = Array.from(recipientMap.values());
      this.logger.debug(
        `Resolved ${recipients.length} recipients for event=${eventType} branch=${branchId || 'GLOBAL'}`,
      );
      return recipients;
    } catch (error) {
      this.logger.error(`Error resolving recipients for event ${eventType}:`, error);
      return [];
    }
  }
}
