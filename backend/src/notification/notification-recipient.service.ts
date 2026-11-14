import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchScopeType, ScopeType } from '@prisma/client';
import { SYSTEM_ROLE_CODES } from '../common/constants/permissions-registry';

export interface ResolveRecipientsOptions {
  eventType: string;
  category?: string;
  branchId?: string | null;
  requiredPermissions?: string[];
  appScopes?: ('ADMIN' | 'POS' | 'WAITER' | 'KDS')[];
  excludeUserIds?: string[];
  sendToAllBranchStaff?: boolean;
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
   * active assignments, branch scope, category preferences, and event target.
   *
   * CRITICAL SECURITY PRINCIPLES (PHASE 2):
   * 1. Default delivery to ALL valid active staff assigned to the relevant branch.
   * 2. Accounts with canonical role 'USER' (customers) are STRICTLY EXCLUDED.
   * 3. Respects personal staff notification preferences (StaffNotificationPreference).
   * 4. Multi-device support: Staff receive events even when PWA/app is closed or in background.
   */
  async resolveRecipients(options: ResolveRecipientsOptions): Promise<RecipientUser[]> {
    const {
      eventType,
      category = 'ORDER',
      branchId,
      requiredPermissions,
      appScopes,
      excludeUserIds = [],
      sendToAllBranchStaff = true,
    } = options;

    try {
      // 1. Build query for active staff assignments
      // If sendToAllBranchStaff is true (default per Phase 2.1), we include all staff roles (excluding customer role USER)
      const roleFilter: any = {
        isActive: true,
        code: { not: 'USER' },
      };

      if (!sendToAllBranchStaff && requiredPermissions && requiredPermissions.length > 0) {
        roleFilter.OR = [
          { code: SYSTEM_ROLE_CODES.ADMIN },
          {
            permissions: {
              some: {
                permissionKey: { in: requiredPermissions },
              },
            },
          },
        ];
      }

      const assignments = await this.prisma.userRoleAssignment.findMany({
        where: {
          isActive: true,
          role: roleFilter,
          user: {
            isAccountLocked: false,
            // Exclude users in excludeUserIds list
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
              staffNotificationPreference: true,
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

        // RULE 2.1: Strictly exclude accounts with role 'USER' unless they hold an active non-USER staff role assignment
        if (user.role === 'USER' && (!assignment.role || assignment.role.code === 'USER')) {
          continue;
        }

        const isAdmin = assignment.role.code === SYSTEM_ROLE_CODES.ADMIN || user.role === 'ADMIN';
        const isGlobalScope = assignment.role.scopeType === ScopeType.GLOBAL;
        const isAllBranches = assignment.branchScope === BranchScopeType.ALL_BRANCHES;
        const assignedBranchIds = assignment.branches.map((b) => b.branchId);

        // Branch-level verification
        let hasBranchAccess = false;
        if (!branchId || branchId === 'ALL') {
          hasBranchAccess = true;
        } else {
          if (isAdmin || isAllBranches) {
            hasBranchAccess = true;
          } else if (assignedBranchIds.includes(branchId)) {
            hasBranchAccess = true;
          }
        }

        if (!hasBranchAccess) {
          continue; // Assigned to another branch!
        }

        // App Scope check (only if sendToAllBranchStaff is explicitly false)
        if (!sendToAllBranchStaff && appScopes && appScopes.length > 0 && !isAdmin) {
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

        // RULE 2.3: Check personal staff notification preferences
        if (user.staffNotificationPreference) {
          const pref = user.staffNotificationPreference;
          const upperCat = (category || '').toUpperCase();

          let isCategoryEnabled = true;
          if (upperCat === 'ORDER') isCategoryEnabled = pref.orderEnabled;
          else if (upperCat === 'ITEM') isCategoryEnabled = pref.itemEnabled;
          else if (upperCat === 'KITCHEN') isCategoryEnabled = pref.kitchenEnabled;
          else if (upperCat === 'QR_ORDER') isCategoryEnabled = pref.qrOrderEnabled;
          else if (upperCat === 'SERVICE') isCategoryEnabled = pref.serviceEnabled;
          else if (upperCat === 'PAYMENT') isCategoryEnabled = pref.paymentEnabled;
          else if (upperCat === 'TABLE') isCategoryEnabled = pref.tableEnabled;
          else if (upperCat === 'BUFFET') isCategoryEnabled = pref.buffetEnabled;
          else if (upperCat === 'ALERT') isCategoryEnabled = pref.alertEnabled;

          if (!isCategoryEnabled) {
            // Staff opted out of this notification category
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
        `Resolved ${recipients.length} recipients for event=${eventType} category=${category} branch=${branchId || 'GLOBAL'}`,
      );
      return recipients;
    } catch (error) {
      this.logger.error(`Error resolving recipients for event ${eventType}:`, error);
      return [];
    }
  }
}
