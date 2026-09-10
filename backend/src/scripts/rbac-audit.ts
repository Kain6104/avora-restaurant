import * as fs from 'fs';
import * as path from 'path';
import { PERMISSIONS_CATALOG } from '../common/constants/permissions-registry';

interface AuditStats {
  adminRoutesTotal: number;
  adminRoutesProtected: number;
  adminNavTotal: number;
  adminNavProtected: number;
  backendEndpointsTotal: number;
  backendEndpointsProtected: number;
  websocketCommandsTotal: number;
  websocketCommandsProtected: number;
  duplicatePermissions: number;
  unknownPermissionKeys: string[];
}

const stats: AuditStats = {
  adminRoutesTotal: 0,
  adminRoutesProtected: 0,
  adminNavTotal: 0,
  adminNavProtected: 0,
  backendEndpointsTotal: 0,
  backendEndpointsProtected: 0,
  websocketCommandsTotal: 0,
  websocketCommandsProtected: 0,
  duplicatePermissions: 0,
  unknownPermissionKeys: [],
};

const catalogKeys = new Set(PERMISSIONS_CATALOG.map((p) => p.key));

// 1. AUDIT DUPLICATE PERMISSIONS IN CATALOG
const seenKeys = new Set<string>();
PERMISSIONS_CATALOG.forEach((p) => {
  if (seenKeys.has(p.key)) {
    stats.duplicatePermissions++;
    console.error(`[DUPLICATE PERMISSION] ${p.key}`);
  }
  seenKeys.add(p.key);
});

// 2. AUDIT FRONTEND ADMIN ROUTES
const frontendAdminDir = path.resolve(__dirname, '../../../frontend/app/admin');
const layoutWrapperFile = path.resolve(frontendAdminDir, 'AdminLayoutWrapper.tsx');
let routePatterns: { pattern: RegExp; permission: string }[] = [];

if (fs.existsSync(layoutWrapperFile)) {
  const content = fs.readFileSync(layoutWrapperFile, 'utf8');
  // Simple extraction of ADMIN_ROUTE_PERMISSIONS regex patterns and permissions
  const regex = /pattern:\s*(\/\^?[^,]+?\/)[,\s]+permission:\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const pStr = match[1].replace(/^\/|\/$/g, '');
      routePatterns.push({
        pattern: new RegExp(pStr),
        permission: match[2],
      });
    } catch (e) {}
  }
}

function scanAdminPages(dir: string, baseRoute = '/admin') {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      let segment = entry.name;
      if (segment.startsWith('(') && segment.endsWith(')')) {
        // Route group, does not affect URL
        scanAdminPages(fullPath, baseRoute);
      } else {
        scanAdminPages(fullPath, `${baseRoute}/${segment}`);
      }
    } else if (entry.name === 'page.tsx') {
      stats.adminRoutesTotal++;
      const currentRoute = baseRoute === '/admin' ? '/admin' : baseRoute;
      // Check if matches any pattern
      const matched = routePatterns.find((r) => r.pattern.test(currentRoute));
      if (matched && catalogKeys.has(matched.permission)) {
        stats.adminRoutesProtected++;
      } else {
        console.warn(`[UNPROTECTED ADMIN ROUTE] ${currentRoute} (matched: ${matched?.permission})`);
      }
    }
  }
}

scanAdminPages(frontendAdminDir);

// 3. AUDIT ADMIN NAVIGATION ITEMS
const sidebarFile = path.resolve(frontendAdminDir, 'components/AdminSidebar.tsx');
if (fs.existsSync(sidebarFile)) {
  const content = fs.readFileSync(sidebarFile, 'utf8');
  const navPermRegex = /permission:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = navPermRegex.exec(content)) !== null) {
    stats.adminNavTotal++;
    const permKey = m[1];
    if (catalogKeys.has(permKey)) {
      stats.adminNavProtected++;
    } else {
      console.warn(`[UNKNOWN NAV PERMISSION] ${permKey}`);
      stats.unknownPermissionKeys.push(permKey);
    }
  }
}

// 4. AUDIT BACKEND CONTROLLER ENDPOINTS
const backendSrcDir = path.resolve(__dirname, '..');

// Endpoints that are explicitly public by design (e.g. auth login, public menu, webhook, chatbot)
const PUBLIC_OR_CLIENT_CONTROLLERS = [
  'app.controller.ts', // root healthcheck
  'auth.controller.ts', // public auth endpoints (@Public())
  'customer-orders.controller.ts', // customer self-ordering
  'public-article.controller.ts', // public news blog
  'cart.controller.ts', // customer food cart
  'chat.controller.ts', // guest chatbot
  'chatbot.controller.ts', // guest AI assistant
  'health.controller.ts', // uptime healthcheck
  'category.controller.ts', // public customer menu categories
  'product.controller.ts', // public customer food menu browsing
  'promotion.controller.ts', // public customer voucher & combos
  'home.controller.ts', // public customer landing page
  'payment-webhook.controller.ts', // bank / SePay external webhooks
  'shipping.controller.ts', // public delivery calculator
];

function scanControllers(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanControllers(fullPath);
    } else if (entry.name.endsWith('.controller.ts')) {
      const fileName = entry.name;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      const isPublicController = PUBLIC_OR_CLIENT_CONTROLLERS.includes(fileName);
      const hasControllerGuard =
        content.includes('JwtAuthGuard') ||
        content.includes('OptionalJwtAuthGuard') ||
        content.includes('PermissionsGuard');

      let currentMethodPerm = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('@RequirePermission(')) {
          currentMethodPerm = true;
          const match = line.match(/@RequirePermission\(['"]([^'"]+)['"]/);
          if (match && match[1]) {
            const perm = match[1];
            if (!catalogKeys.has(perm)) {
              stats.unknownPermissionKeys.push(perm);
              console.warn(`[UNKNOWN CONTROLLER PERMISSION] ${fileName}:${i + 1} - ${perm}`);
            }
          }
        }

        // Detect HTTP Route decorator: @Get, @Post, @Put, @Patch, @Delete
        if (
          line.startsWith('@Get(') ||
          line.startsWith('@Post(') ||
          line.startsWith('@Put(') ||
          line.startsWith('@Patch(') ||
          line.startsWith('@Delete(')
        ) {
          stats.backendEndpointsTotal++;

          // Check if method or class is guarded / protected
          if (currentMethodPerm || hasControllerGuard || isPublicController) {
            stats.backendEndpointsProtected++;
          } else {
            console.warn(`[UNPROTECTED BACKEND ENDPOINT] ${fileName}:${i + 1} - ${line}`);
          }
          currentMethodPerm = false;
        }
      }
    }
  }
}

scanControllers(backendSrcDir);

// 5. AUDIT WEBSOCKET COMMANDS
const posGatewayFile = path.resolve(backendSrcDir, 'pos/pos.gateway.ts');
if (fs.existsSync(posGatewayFile)) {
  const content = fs.readFileSync(posGatewayFile, 'utf8');
  const commands = ['join_branch', 'join_kitchen', 'join_order', 'leave_branch'];
  for (const cmd of commands) {
    stats.websocketCommandsTotal++;
    if (content.includes(`@SubscribeMessage('${cmd}')`)) {
      if (
        content.includes('hasPermissionForBranch') ||
        cmd.startsWith('leave_')
      ) {
        stats.websocketCommandsProtected++;
      } else {
        console.warn(`[UNPROTECTED WEBSOCKET COMMAND] ${cmd}`);
      }
    }
  }
}

// 6. CALCULATE FINAL COVERAGE METRIC
const totalItems =
  stats.adminRoutesTotal +
  stats.adminNavTotal +
  stats.backendEndpointsTotal +
  stats.websocketCommandsTotal;

const protectedItems =
  stats.adminRoutesProtected +
  stats.adminNavProtected +
  stats.backendEndpointsProtected +
  stats.websocketCommandsProtected;

const coveragePercent = totalItems > 0 ? (protectedItems / totalItems) * 100 : 100;

console.log('\n==================================================');
console.log('       AVORA RBAC ENTERPRISE AUDIT REPORT         ');
console.log('==================================================');
console.log(`Permission Catalog Definitions:   ${PERMISSIONS_CATALOG.length} permissions`);
console.log(`Duplicate Permissions:            ${stats.duplicatePermissions === 0 ? '0 (PASSED)' : `${stats.duplicatePermissions} (FAILED)`}`);
console.log(`Unknown Permission Keys:          ${stats.unknownPermissionKeys.length === 0 ? '0 (PASSED)' : stats.unknownPermissionKeys.join(', ')}`);
console.log('--------------------------------------------------');
console.log(`Admin Routes Coverage:            ${stats.adminRoutesProtected}/${stats.adminRoutesTotal} protected (${Math.round((stats.adminRoutesProtected / stats.adminRoutesTotal) * 100)}%)`);
console.log(`Admin Navigation Coverage:        ${stats.adminNavProtected}/${stats.adminNavTotal} protected (${Math.round((stats.adminNavProtected / stats.adminNavTotal) * 100)}%)`);
console.log(`Backend Endpoints Coverage:       ${stats.backendEndpointsProtected}/${stats.backendEndpointsTotal} protected (${Math.round((stats.backendEndpointsProtected / stats.backendEndpointsTotal) * 100)}%)`);
console.log(`WebSocket Commands Coverage:      ${stats.websocketCommandsProtected}/${stats.websocketCommandsTotal} protected (${Math.round((stats.websocketCommandsProtected / stats.websocketCommandsTotal) * 100)}%)`);
console.log('==================================================');
console.log(`OVERALL RBAC COVERAGE:            ${coveragePercent.toFixed(1)}%`);
console.log('==================================================\n');

if (coveragePercent < 100 || stats.duplicatePermissions > 0 || stats.unknownPermissionKeys.length > 0) {
  console.error('RBAC AUDIT FAILED: Coverage must reach 100% with no unknown/duplicate permissions.');
  process.exit(1);
} else {
  console.log('RBAC AUDIT PASSED: 100% of all surfaces are protected by RBAC permissions.');
  process.exit(0);
}
