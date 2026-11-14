import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RecipeService } from './recipe.service';
import {
  AssignTaskOwnerDto,
  SubmitOnboardingEvidenceDto,
  ReviewOnboardingSubmissionDto,
  AssignExceptionOwnerDto,
  CloseOnboardingExceptionDto,
  CompositeApprovalDecisionDto,
  OnboardingDepartment,
  OnboardingTaskStatus,
} from './dto/onboarding.dto';

const SETTING_TASKS = 'avo1_onboarding_tasks_v1';
const SETTING_SUBMISSIONS = 'avo1_onboarding_submissions_v1';
const SETTING_EXCEPTIONS = 'avo1_onboarding_exceptions_v1';
const SETTING_COMPOSITES = 'avo1_composite_decisions_v1';
const SETTING_HARDWARE = 'avo1_hardware_acceptance_v1';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_UPLOAD_ROWS = 5000;

export interface OnboardingTaskRecord {
  workstreamId: string;
  department: OnboardingDepartment;
  description: string;
  responsibleRole: string;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  requiredInput: string;
  submittedEvidence: string | null;
  status: OnboardingTaskStatus;
  approvalRequirement: string;
  rejectionReason: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingSubmissionRecord {
  id: string;
  workstreamId: string;
  workstreamType: string;
  branchCode: string;
  fileName: string;
  fileSizeBytes: number;
  fileSha256: string;
  rowCount: number;
  submitterId: string;
  submitterName: string;
  submittedAt: string;
  status: OnboardingTaskStatus;
  validationResult: any;
  approverId: string | null;
  approverName: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  auditLogRef: string | null;
  commitRef: string | null;
  committedAt: string | null;
  rawContent: string;
  createDraftRevisionIfApproved?: boolean;
}

export interface OnboardingExceptionRecord {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  businessImpact: string;
  branchWarehouseScope: string;
  functionalOwner: string;
  assignedEmployeeId: string | null;
  assignedEmployeeName: string | null;
  createdDate: string;
  targetCompletionDate: string | null;
  supportingEvidence: string | null;
  approvalStatus: 'PENDING_INPUT' | 'PENDING_APPROVAL' | 'OVERDUE' | 'COMPLETED';
  closureReason: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  auditRef: string | null;
}

@Injectable()
export class Avo1OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeService: RecipeService,
  ) {}

  private async readJsonSetting<T>(key: string, fallback: T): Promise<T> {
    if (typeof (this.prisma as any).systemSetting?.findUnique !== 'function') return fallback;
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!row?.value) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  private async writeJsonSetting(key: string, value: unknown): Promise<void> {
    if (typeof (this.prisma as any).systemSetting?.upsert !== 'function') return;
    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  private async logAuditSafe(
    actorId: string | undefined,
    action: string,
    target: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<string | null> {
    try {
      if (actorId && typeof (this.prisma as any).auditLog?.create === 'function') {
        const rec = await this.prisma.auditLog.create({
          data: {
            userId: actorId,
            action,
            target,
            oldValue: oldValue ? JSON.stringify(oldValue) : null,
            newValue: newValue ? JSON.stringify(newValue) : null,
          },
        });
        return rec?.id || null;
      }
    } catch {
      // Safe when user FK absent in unit test mocks
    }
    return null;
  }

  private buildDefaultTasks(nowIso: string): OnboardingTaskRecord[] {
    return [
      {
        workstreamId: 'WS-02-RECIPES',
        department: 'HEAD_CHEF_RD',
        description: 'Hoàn tất định mức công thức cho 212 món ăn theo 4 Wave (ưu tiên P1 Sushi/Sashimi/Cơm Cuộn)',
        responsibleRole: 'Head Chef / R&D',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: 'RECIPE_ONBOARDING_WORKBOOK_212_PRODUCTS.csv (actual gram/ml, prep loss, yield)',
        submittedEvidence: null,
        status: 'AWAITING_INPUT',
        approvalRequirement: 'Maker-Checker: Chef Submit -> Independent R&D/Manager Approve -> Publish',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-03-MODIFIERS',
        department: 'MENU_OPERATIONS',
        description: 'Phân loại 664 OptionItems và xử lý 54 bất thường tùy chọn (MÓN TRONG SET, TRÀ, NƯỚC ÉP, BUFFET)',
        responsibleRole: 'Menu Operations & Head Chef',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: 'OPTION_MODIFIER_COVERAGE_MATRIX_664_ITEMS.csv & 01_CATALOG_OPTION_ANOMALIES_FOR_MENU_OPS.csv',
        submittedEvidence: null,
        status: 'AWAITING_INPUT',
        approvalRequirement: 'Menu Operations & Chef explicit classification',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-05-INGREDIENTS',
        department: 'PROCUREMENT',
        description: 'Mở rộng danh mục Nguyên vật liệu từ 8 SKU nền tảng sang đầy đủ Bếp, Lẩu, Bar, Bao bì Takeaway',
        responsibleRole: 'Procurement & Head Chef',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: 'Verified Ingredient Master SKUs (codes, units, conversion factors, storage, shelf life)',
        submittedEvidence: null,
        status: 'AWAITING_INPUT',
        approvalRequirement: 'Procurement & R&D verification',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-06-SUPPLIERS',
        department: 'FINANCE',
        description: 'Hoàn thiện MST nhà cung cấp, hợp đồng giá SupplierIngredient & chạy kiểm thử GRN staging',
        responsibleRole: 'Finance & Procurement',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: '03_SUPPLIER_DATA_REQUEST.csv (verified legal name, taxCode, contacts, contracts)',
        submittedEvidence: null,
        status: 'AWAITING_INPUT',
        approvalRequirement: 'Finance tax validation + Procurement SoD GRN test',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-07-DEV-SEED',
        department: 'FINANCE',
        description: 'Ký duyệt đối chiếu 8 dòng seed WH-AVO1-KITCHEN (51,000 đv / 35,965,000 VND) tách biệt 4 chi nhánh khác',
        responsibleRole: 'Finance & AVO1 Branch Manager',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: '04_DEV_SEED_MANAGER_APPROVAL_FORM.md (AVO1 Manager Ref + Finance Ref)',
        submittedEvidence: null,
        status: 'AWAITING_INPUT',
        approvalRequirement: 'Dual Sign-off: AVO1 Manager + Finance Controller',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-08-OPENING-STOCK',
        department: 'WAREHOUSE',
        description: 'Kiểm đếm mù thực tế WH-AVO1-KITCHEN & WH-AVO1-BAR và ghi nhận OPENING_BALANCE + IngredientBatch',
        responsibleRole: 'Warehouse Lead & AVO1 Branch Manager',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: 'Regenerated OPENING_STOCKTAKE_BLIND_COUNT_SHEET.csv (counts, lot, expiry, verified cost)',
        submittedEvidence: null,
        status: 'BLOCKED',
        approvalRequirement: 'Segregation of Duties: Counter != Approver (AVO1 Manager)',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-04-COMPOSITES',
        department: 'AVO1_BRANCH_MANAGER',
        description: 'Phê duyệt chiến lược Set Sushi (A vs B), vé Buffet không trừ kho và tắt Buffet Test Package 1788880668704',
        responsibleRole: 'AVO1 Branch Manager & Operations',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: '02_SET_SUSHI_BUFFET_SIGNOFF_SHEET.csv',
        submittedEvidence: null,
        status: 'AWAITING_INPUT',
        approvalRequirement: 'Operations + AVO1 Manager sign-off',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-10-HARDWARE-POS',
        department: 'POS_KDS_TECH',
        description: 'Chạy 12 kịch bản staging trên Native WPF POS (AvoraPosNative), Web POS và >= 2 màn hình KDS',
        responsibleRole: 'POS/KDS Technical Team',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: '12 staging order IDs, InventoryTransaction IDs, WPF offline sync log, screenshots',
        submittedEvidence: null,
        status: 'BLOCKED',
        approvalRequirement: 'POS Tech Execution + QA Verification',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        workstreamId: 'WS-10-QA-SIGN-OFF',
        department: 'QA',
        description: 'Xác nhận chéo 12 kịch bản phần cứng, không trùng trừ kho và chốt 12 cổng Stage B cho AVO1',
        responsibleRole: 'QA Lead',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        requiredInput: 'Signed 12-Gate Stage B Hardware & Ledger Evidence',
        submittedEvidence: null,
        status: 'BLOCKED',
        approvalRequirement: 'Independent QA & AVO1 Manager Final Go/No-Go',
        rejectionReason: null,
        targetDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }

  private buildDefaultExceptions(nowIso: string): OnboardingExceptionRecord[] {
    return [
      {
        id: 'EXC-AVO1-001',
        severity: 'CRITICAL',
        businessImpact: '212/212 món theo dõi kho chưa có công thức PUBLISHED — không thể trừ kho và tính Food Cost thực tế',
        branchWarehouseScope: 'AVO1 / All Branches',
        functionalOwner: 'Head Chef / R&D',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-002',
        severity: 'CRITICAL',
        businessImpact: '664/664 OptionItems chưa phân loại (54 dòng bất thường menu) — rủi ro sai lệch định lượng topping',
        branchWarehouseScope: 'AVO1 / 123 Modifier Products',
        functionalOwner: 'Menu Operations & Head Chef',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-003',
        severity: 'HIGH',
        businessImpact: 'Chưa chốt chiến lược Set Sushi (A vs B), vé Buffet vẫn inventoryTracked=true và còn Buffet Test Package',
        branchWarehouseScope: 'AVO1 / Set & Buffet SKUs',
        functionalOwner: 'AVO1 Branch Manager & Menu Operations',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-004',
        severity: 'CRITICAL',
        businessImpact: 'Danh mục Ingredient chỉ có 8 SKU nền tảng, thiếu hải sản mở rộng, lẩu, quầy Bar và bao bì Takeaway',
        branchWarehouseScope: 'WH-AVO1-KITCHEN & WH-AVO1-BAR',
        functionalOwner: 'Procurement & Head Chef',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-005',
        severity: 'HIGH',
        businessImpact: '3/3 nhà cung cấp thiếu MST (taxCode=null), 0 hợp đồng SupplierIngredient, 0 GRN staging',
        branchWarehouseScope: 'AVO1 / Procurement',
        functionalOwner: 'Procurement & Finance',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-006',
        severity: 'CRITICAL',
        businessImpact: '8 dòng seed phát triển trong WH-AVO1-KITCHEN (51,000 đv / 35,965,000 VND) chưa được duyệt xóa nền',
        branchWarehouseScope: 'WH-AVO1-KITCHEN',
        functionalOwner: 'Finance & AVO1 Branch Manager',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_APPROVAL',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-007',
        severity: 'CRITICAL',
        businessImpact: '0 giao dịch OPENING_BALANCE và 0 lô IngredientBatch tại WH-AVO1-KITCHEN & WH-AVO1-BAR',
        branchWarehouseScope: 'WH-AVO1-KITCHEN & WH-AVO1-BAR',
        functionalOwner: 'Warehouse Lead',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
      {
        id: 'EXC-AVO1-008',
        severity: 'HIGH',
        businessImpact: '0/12 kịch bản phần cứng Native WPF POS, Web POS và >= 2 màn hình KDS được kiểm thử thực tế',
        branchWarehouseScope: 'AVO1 Staging Terminals',
        functionalOwner: 'POS/KDS Technical Team & QA',
        assignedEmployeeId: null,
        assignedEmployeeName: null,
        createdDate: nowIso,
        targetCompletionDate: null,
        supportingEvidence: null,
        approvalStatus: 'PENDING_INPUT',
        closureReason: null,
        approvedById: null,
        approvedByName: null,
        auditRef: null,
      },
    ];
  }

  async getWorkspaceDashboard(branchCode = 'AVO1') {
    const nowIso = new Date().toISOString();
    const [
      tasks,
      submissions,
      exceptions,
      compositeDecisions,
      hardwareAcceptance,
      branches,
      trackedProductsCount,
      publishedRecipesCount,
      optionItemsCount,
      publishedModifiersCount,
      modifierPolicySetting,
      legacyNonInvSetting,
      ingredientsCount,
      suppliers,
      supplierIngredientsCount,
      openExceptionsLiveCount,
      users,
    ] = await Promise.all([
      this.readJsonSetting<OnboardingTaskRecord[]>(SETTING_TASKS, this.buildDefaultTasks(nowIso)),
      this.readJsonSetting<OnboardingSubmissionRecord[]>(SETTING_SUBMISSIONS, []),
      this.readJsonSetting<OnboardingExceptionRecord[]>(SETTING_EXCEPTIONS, this.buildDefaultExceptions(nowIso)),
      this.readJsonSetting<Record<string, any>>(SETTING_COMPOSITES, {}),
      this.readJsonSetting<{ scenarios?: any[] }>(SETTING_HARDWARE, { scenarios: [] }),
      this.prisma.branch.findMany({
        select: {
          id: true,
          branchCode: true,
          name: true,
          inventoryActivated: true,
          inventoryPolicy: true,
          warehouses: {
            select: {
              id: true,
              code: true,
              storageZone: true,
              _count: { select: { balances: true, batches: true, ledgerTransactions: true } },
            },
          },
        },
        orderBy: { branchCode: 'asc' },
      }),
      this.prisma.product.count({ where: { available: true, inventoryTracked: true } }),
      this.prisma.product.count({
        where: {
          available: true,
          inventoryTracked: true,
          recipes: { some: { versions: { some: { status: 'PUBLISHED' } } } },
        },
      }),
      this.prisma.optionItem.count(),
      this.prisma.recipeOptionModifier.count({ where: { recipeVersion: { status: 'PUBLISHED' } } }),
      typeof (this.prisma as any).systemSetting?.findUnique === 'function'
        ? this.prisma.systemSetting.findUnique({ where: { key: 'inventory_modifier_policies' } })
        : null,
      typeof (this.prisma as any).systemSetting?.findUnique === 'function'
        ? this.prisma.systemSetting.findUnique({ where: { key: 'inventory_non_inventory_option_items' } })
        : null,
      this.prisma.ingredient.count({ where: { isActive: true } }),
      this.prisma.supplier.findMany({
        select: { id: true, code: true, name: true, taxCode: true, paymentTerms: true, status: true },
      }),
      this.prisma.supplierIngredient.count(),
      this.prisma.inventoryOperationalException.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
      typeof (this.prisma as any).user?.findMany === 'function'
        ? this.prisma.user.findMany({
            select: { id: true, fullName: true, role: true },
            orderBy: { fullName: 'asc' },
            take: 100,
          })
        : [],
    ]);

    const targetBranch = branches.find((b) => b.branchCode === branchCode) || branches.find((b) => b.branchCode === 'AVO1') || branches[0];
    const targetBranchId = targetBranch?.id;

    const [avo1SeedRemaining, avo1OpeningTx, avo1Batches, avo1Balances] = targetBranchId
      ? await Promise.all([
          this.prisma.inventoryBalance.count({
            where: {
              warehouse: { branchId: targetBranchId },
              currentStock: { gt: 0 },
              AND: { warehouse: { ledgerTransactions: { none: {} } } },
            },
          }),
          this.prisma.inventoryTransaction.count({
            where: { branchId: targetBranchId, type: 'OPENING_BALANCE' },
          }),
          this.prisma.ingredientBatch.count({
            where: { warehouse: { branchId: targetBranchId } },
          }),
          this.prisma.inventoryBalance.findMany({
            where: { warehouse: { branchId: targetBranchId } },
            select: { currentStock: true },
          }),
        ])
      : [0, 0, 0, []];

    const avo1TxAggregate = targetBranchId
      ? await this.prisma.inventoryTransaction.aggregate({
          where: { branchId: targetBranchId },
          _sum: { quantityIn: true, quantityOut: true },
          _count: { _all: true },
        })
      : { _sum: { quantityIn: 0, quantityOut: 0 }, _count: { _all: 0 } };

    const avo1TotalBal = avo1Balances.reduce((s, b) => s + Number(b.currentStock), 0);
    const avo1NetTx = Number(avo1TxAggregate._sum.quantityIn || 0) - Number(avo1TxAggregate._sum.quantityOut || 0);
    const avo1LedgerVariance = Math.round((avo1TotalBal - avo1NetTx) * 10000) / 10000;

    // Modifiers strictly from validated/classified DB records (never blank templates)
    const modPolicyMap = this.parseJsonSafe(modifierPolicySetting?.value);
    const legacyModMap = this.parseJsonSafe(legacyNonInvSetting?.value);
    const resolvedPolicyIds = new Set<string>();
    for (const [k, v] of Object.entries(modPolicyMap)) {
      if (['NON_INVENTORY_MODIFIER', 'INVALID_CATALOG_ASSIGNMENT'].includes((v as any)?.classification)) {
        resolvedPolicyIds.add(k);
      }
    }
    for (const k of Object.keys(legacyModMap)) resolvedPolicyIds.add(k);
    const modifiersResolved = Math.min(optionItemsCount, publishedModifiersCount + resolvedPolicyIds.size);

    const suppliersWithTax = suppliers.filter((s) => Boolean(s.taxCode?.trim())).length;
    const hardwarePassedCount = (hardwareAcceptance.scenarios || []).filter((s: any) => s.passed).length;
    const assignedExceptionsCount = exceptions.filter((e) => Boolean(e.assignedEmployeeId)).length;
    const compositeApprovedCount = Object.values(compositeDecisions).filter((d: any) => d?.approved).length;

    const progress = {
      recipeCompletionPercent: trackedProductsCount > 0 ? Math.round((publishedRecipesCount / trackedProductsCount) * 100) : 0,
      modifierResolutionPercent: optionItemsCount > 0 ? Math.round((modifiersResolved / optionItemsCount) * 100) : 0,
      compositeDecisionsPercent: Math.round((Math.min(2, compositeApprovedCount) / 2) * 100),
      ingredientCompletenessPercent: ingredientsCount > 8 ? Math.min(100, Math.round((ingredientsCount / 50) * 100)) : 0,
      supplierReadinessPercent:
        suppliers.length > 0 && supplierIngredientsCount > 0
          ? Math.round((suppliersWithTax / suppliers.length) * 100)
          : 0,
      seedReconciliationPercent: avo1SeedRemaining === 0 ? 100 : 0,
      openingStocktakePercent: avo1OpeningTx > 0 && avo1LedgerVariance === 0 ? 100 : 0,
      hardwareAcceptancePercent: Math.round((Math.min(12, hardwarePassedCount) / 12) * 100),
      exceptionOwnershipPercent: exceptions.length > 0 ? Math.round((assignedExceptionsCount / exceptions.length) * 100) : 100,
      stageBAuthorizationPercent: targetBranch?.inventoryActivated ? 100 : 0,
    };

    const gates = await this.evaluateAvo1StageBGatesInternal({
      trackedProductsCount,
      publishedRecipesCount,
      optionItemsCount,
      modifiersResolved,
      compositeApprovedCount,
      ingredientsCount,
      suppliersCount: suppliers.length,
      suppliersWithTax,
      supplierIngredientsCount,
      avo1SeedRemaining,
      avo1OpeningTx,
      avo1LedgerVariance,
      avo1Batches,
      hardwarePassedCount,
      assignedExceptionsCount,
      totalExceptionsCount: exceptions.length,
      nowIso,
    });

    const overallReadinessPercent = Math.round(
      (gates.filter((g) => g.status === 'PASS').length / gates.length) * 100,
    );

    return {
      auditedAt: nowIso,
      targetBranch: targetBranch
        ? {
            id: targetBranch.id,
            branchCode: targetBranch.branchCode,
            name: targetBranch.name,
            inventoryActivated: targetBranch.inventoryActivated,
            inventoryPolicy: targetBranch.inventoryPolicy,
          }
        : null,
      allBranchesIsolation: branches.map((b) => ({
        branchCode: b.branchCode,
        name: b.name,
        inventoryActivated: b.inventoryActivated,
        inventoryPolicy: b.inventoryPolicy,
      })),
      executiveOverview: {
        overallReadinessPercent,
        completedWorkstreams: tasks.filter((t) => t.status === 'COMMITTED' || t.status === 'APPROVED').length,
        blockedWorkstreams: tasks.filter((t) => t.status === 'BLOCKED' || t.status === 'AWAITING_INPUT').length,
        pendingApprovals: submissions.filter((s) => s.status === 'PENDING_APPROVAL').length,
        rejectedSubmissions: submissions.filter((s) => s.status === 'REJECTED').length,
        outstandingDataRequests: tasks.filter((t) => !t.submittedEvidence).length,
        criticalOperationalExceptions:
          openExceptionsLiveCount + exceptions.filter((e) => e.severity === 'CRITICAL' && e.approvalStatus !== 'COMPLETED').length,
        lastSynchronizationTime: nowIso,
        lastAuditTime: nowIso,
      },
      progress,
      tasks,
      submissions: submissions.map(({ rawContent: _omitted, ...rest }) => rest),
      exceptions,
      gates,
      // Strict RBAC hygiene: never return bank account fields to onboarding workspace
      suppliersSummary: suppliers.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        hasTaxCode: Boolean(s.taxCode?.trim()),
        paymentTerms: s.paymentTerms,
        status: s.status,
      })),
      availableEmployees: users,
    };
  }

  private async evaluateAvo1StageBGatesInternal(ctx: {
    trackedProductsCount: number;
    publishedRecipesCount: number;
    optionItemsCount: number;
    modifiersResolved: number;
    compositeApprovedCount: number;
    ingredientsCount: number;
    suppliersCount: number;
    suppliersWithTax: number;
    supplierIngredientsCount: number;
    avo1SeedRemaining: number;
    avo1OpeningTx: number;
    avo1LedgerVariance: number;
    avo1Batches: number;
    hardwarePassedCount: number;
    assignedExceptionsCount: number;
    totalExceptionsCount: number;
    nowIso: string;
  }) {
    const grnConfirmedCount =
      typeof (this.prisma as any).goodsReceipt?.count === 'function'
        ? await this.prisma.goodsReceipt.count({ where: { status: 'CONFIRMED' } })
        : 0;

    return [
      {
        gate: 1,
        name: 'Required recipes published',
        status: ctx.trackedProductsCount > 0 && ctx.publishedRecipesCount >= ctx.trackedProductsCount ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: `${ctx.trackedProductsCount} tracked products PUBLISHED`,
        actualEvidenceRef: `${ctx.publishedRecipesCount}/${ctx.trackedProductsCount} published`,
        responsibleOwner: 'Head Chef / R&D',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 2,
        name: 'All 664 modifiers classified or resolved',
        status: ctx.optionItemsCount > 0 && ctx.modifiersResolved >= ctx.optionItemsCount ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: `${ctx.optionItemsCount}/${ctx.optionItemsCount} OptionItems resolved`,
        actualEvidenceRef: `${ctx.modifiersResolved}/${ctx.optionItemsCount} resolved`,
        responsibleOwner: 'Head Chef & Menu Operations',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 3,
        name: 'Combo, Set Sushi & Buffet strategies approved',
        status: ctx.compositeApprovedCount >= 2 ? 'PASS' : 'BLOCKED — APPROVAL REQUIRED',
        requiredEvidence: 'Combo Strategy A + Set Sushi A/B + Buffet ticket sign-off',
        actualEvidenceRef: `${ctx.compositeApprovedCount} composite decisions approved`,
        responsibleOwner: 'AVO1 Branch Manager & Menu Operations',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 4,
        name: 'Catalog anomalies resolved',
        status: ctx.modifiersResolved >= ctx.optionItemsCount ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: '54 anomalous OptionItems reviewed by Menu Ops',
        actualEvidenceRef: '0/54 anomaly approvals recorded',
        responsibleOwner: 'Menu Operations',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 5,
        name: 'Required Ingredient SKUs populated',
        status: ctx.ingredientsCount > 8 ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: 'Full Kitchen, Hotpot, Bar & Takeaway Ingredient SKUs',
        actualEvidenceRef: `${ctx.ingredientsCount} active Ingredient SKUs`,
        responsibleOwner: 'Procurement & Head Chef',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 6,
        name: 'AVO1 seed reconciliation completed w/ written approval',
        status: ctx.avo1SeedRemaining === 0 ? 'PASS' : 'BLOCKED — APPROVAL REQUIRED',
        requiredEvidence: 'Dual Manager + Finance sign-off & 8 WH-AVO1-KITCHEN rows reset',
        actualEvidenceRef: `${ctx.avo1SeedRemaining} unbacked seed rows remaining on AVO1`,
        responsibleOwner: 'Finance & AVO1 Branch Manager',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 7,
        name: 'Physical opening stock approved',
        status: ctx.avo1OpeningTx > 0 ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: 'Blind OPENING_BALANCE stocktake for WH-AVO1-KITCHEN & WH-AVO1-BAR',
        actualEvidenceRef: `${ctx.avo1OpeningTx} OPENING_BALANCE tx on AVO1`,
        responsibleOwner: 'Warehouse Lead & AVO1 Manager',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 8,
        name: 'Ledger discrepancy equals zero',
        status: ctx.avo1LedgerVariance === 0 && ctx.avo1OpeningTx > 0 ? 'PASS' : 'FAIL',
        requiredEvidence: 'Current Stock = Opening + In - Out (Variance = 0)',
        actualEvidenceRef: `AVO1 Variance = ${ctx.avo1LedgerVariance}`,
        responsibleOwner: 'Finance & Warehouse',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 9,
        name: 'FEFO lots validated',
        status: ctx.avo1Batches > 0 ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: 'Active IngredientBatch records with batchNumber & expirationDate',
        actualEvidenceRef: `${ctx.avo1Batches} batches on AVO1`,
        responsibleOwner: 'Warehouse Lead',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 10,
        name: 'All 12 live POS/WPF/KDS hardware scenarios pass',
        status: ctx.hardwarePassedCount >= 12 ? 'PASS' : 'IMPLEMENTED BUT NOT TESTED',
        requiredEvidence: '12/12 staging hardware runs with screenshots & tx IDs',
        actualEvidenceRef: `${ctx.hardwarePassedCount}/12 hardware scenarios passed`,
        responsibleOwner: 'POS/KDS Technical Team & QA',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 11,
        name: 'Supplier & GRN validation passes',
        status:
          ctx.suppliersCount > 0 &&
          ctx.suppliersWithTax >= ctx.suppliersCount &&
          ctx.supplierIngredientsCount > 0 &&
          grnConfirmedCount > 0
            ? 'PASS'
            : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: 'Verified Tax Codes, SupplierIngredient contracts & >=1 CONFIRMED GRN',
        actualEvidenceRef: `TaxCodes ${ctx.suppliersWithTax}/${ctx.suppliersCount}, Contracts ${ctx.supplierIngredientsCount}, GRNs ${grnConfirmedCount}`,
        responsibleOwner: 'Procurement & Finance',
        lastVerifiedAt: ctx.nowIso,
      },
      {
        gate: 12,
        name: 'Exception owners formally assigned',
        status: ctx.totalExceptionsCount > 0 && ctx.assignedExceptionsCount >= ctx.totalExceptionsCount ? 'PASS' : 'BLOCKED — BUSINESS INPUT REQUIRED',
        requiredEvidence: 'Real verified employees assigned to all open exceptions',
        actualEvidenceRef: `${ctx.assignedExceptionsCount}/${ctx.totalExceptionsCount} exceptions assigned`,
        responsibleOwner: 'AVO1 Branch Manager',
        lastVerifiedAt: ctx.nowIso,
      },
    ];
  }

  async assignTaskOwner(workstreamId: string, dto: AssignTaskOwnerDto, actor?: { id: string; fullName?: string }) {
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, fullName: true, email: true },
    });
    if (!employee) {
      throw new NotFoundException(`Không tìm thấy nhân viên hợp lệ có ID '${dto.employeeId}'`);
    }

    const nowIso = new Date().toISOString();
    const tasks = await this.readJsonSetting<OnboardingTaskRecord[]>(SETTING_TASKS, this.buildDefaultTasks(nowIso));
    const idx = tasks.findIndex((t) => t.workstreamId === workstreamId);
    if (idx < 0) {
      throw new NotFoundException(`Không tìm thấy hạng mục công việc '${workstreamId}'`);
    }

    const prev = { ...tasks[idx] };
    tasks[idx] = {
      ...tasks[idx],
      assignedEmployeeId: employee.id,
      assignedEmployeeName: employee.fullName || employee.email,
      targetDate: dto.targetDate || tasks[idx].targetDate,
      updatedAt: nowIso,
    };

    await this.writeJsonSetting(SETTING_TASKS, tasks);
    await this.logAuditSafe(actor?.id, 'ONBOARDING_TASK_OWNER_ASSIGNED', `Task:${workstreamId}`, prev, tasks[idx]);
    return tasks[idx];
  }

  async submitOnboardingEvidence(
    dto: SubmitOnboardingEvidenceDto,
    actor: { id: string; fullName?: string },
  ) {
    const lowerName = dto.fileName.trim().toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.json')) {
      throw new BadRequestException('Chỉ chấp nhận định dạng tệp .csv hoặc .json');
    }

    const sizeBytes = Buffer.byteLength(dto.content, 'utf8');
    if (sizeBytes === 0 || sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`Kích thước tệp không hợp lệ (${sizeBytes} bytes; giới hạn <= 5MB)`);
    }
    if (dto.content.includes('\uFFFD')) {
      throw new BadRequestException('Tệp bị lỗi bảng mã UTF-8 (chứa ký tự hỏng tiếng Việt)');
    }

    const lines = dto.content.trim().split(/\r?\n/);
    if (lines.length > MAX_UPLOAD_ROWS) {
      throw new BadRequestException(`Số dòng vượt quá giới hạn an toàn (${lines.length} > ${MAX_UPLOAD_ROWS})`);
    }

    const fileSha256 = crypto.createHash('sha256').update(dto.content, 'utf8').digest('hex');
    const nowIso = new Date().toISOString();
    const submissions = await this.readJsonSetting<OnboardingSubmissionRecord[]>(SETTING_SUBMISSIONS, []);

    const duplicate = submissions.find(
      (s) => s.fileSha256 === fileSha256 && s.workstreamId === dto.workstreamId && s.status !== 'REJECTED',
    );
    if (duplicate) {
      throw new ConflictException(
        `Tệp trùng lặp nội dung (SHA-256: ${fileSha256.slice(0, 12)}...) đã được nộp trước đó tại mã ${duplicate.id}`,
      );
    }

    // Validate domain payload WITHOUT committing to production tables yet!
    let validationResult: any = { valid: true, rowCount: Math.max(0, lines.length - 1) };
    let validationPassed = true;

    if (dto.workstreamType === 'RECIPE_WORKBOOK') {
      const preview = await this.recipeService.previewRecipeImport({
        csvContent: dto.content,
        createDraftRevisionIfApproved: Boolean(dto.createDraftRevisionIfApproved),
      });
      validationResult = preview.summary;
      validationPassed = preview.summary.validRecipesCount > 0 && preview.summary.invalidCount === 0;
    }

    const submissionId = `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const auditId = await this.logAuditSafe(
      actor.id,
      'ONBOARDING_EVIDENCE_SUBMITTED',
      `Submission:${submissionId}`,
      null,
      { workstreamId: dto.workstreamId, fileName: dto.fileName, fileSha256, validationPassed },
    );

    const record: OnboardingSubmissionRecord = {
      id: submissionId,
      workstreamId: dto.workstreamId,
      workstreamType: dto.workstreamType,
      branchCode: dto.branchCode || 'AVO1',
      fileName: dto.fileName,
      fileSizeBytes: sizeBytes,
      fileSha256,
      rowCount: Math.max(0, lines.length - 1),
      submitterId: actor.id,
      submitterName: actor.fullName || actor.id,
      submittedAt: nowIso,
      status: validationPassed ? 'PENDING_APPROVAL' : 'VALIDATION_FAILED',
      validationResult,
      approverId: null,
      approverName: null,
      reviewedAt: null,
      rejectionReason: validationPassed ? null : 'Dữ liệu kiểm tra (dry-run) phát hiện lỗi hoặc thiếu định lượng hợp lệ',
      auditLogRef: auditId,
      commitRef: null,
      committedAt: null,
      rawContent: dto.content,
      createDraftRevisionIfApproved: Boolean(dto.createDraftRevisionIfApproved),
    };

    submissions.unshift(record);
    await this.writeJsonSetting(SETTING_SUBMISSIONS, submissions);

    // Update task status cleanly (Upload/Validate != Approved != Committed)
    const tasks = await this.readJsonSetting<OnboardingTaskRecord[]>(SETTING_TASKS, this.buildDefaultTasks(nowIso));
    const tIdx = tasks.findIndex((t) => t.workstreamId === dto.workstreamId);
    if (tIdx >= 0) {
      tasks[tIdx].submittedEvidence = `${record.id} (${record.fileName} | SHA:${fileSha256.slice(0, 8)})`;
      tasks[tIdx].status = record.status;
      tasks[tIdx].rejectionReason = record.rejectionReason;
      tasks[tIdx].updatedAt = nowIso;
      await this.writeJsonSetting(SETTING_TASKS, tasks);
    }

    const { rawContent: _hidden, ...safeReturn } = record;
    return safeReturn;
  }

  async reviewOnboardingSubmission(
    submissionId: string,
    dto: ReviewOnboardingSubmissionDto,
    actor: { id: string; fullName?: string },
  ) {
    const nowIso = new Date().toISOString();
    const submissions = await this.readJsonSetting<OnboardingSubmissionRecord[]>(SETTING_SUBMISSIONS, []);
    const idx = submissions.findIndex((s) => s.id === submissionId);
    if (idx < 0) throw new NotFoundException(`Không tìm thấy hồ sơ nộp '${submissionId}'`);

    const sub = submissions[idx];
    if (sub.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Hồ sơ '${submissionId}' phải ở trạng thái PENDING_APPROVAL mới có thể duyệt (hiện tại: ${sub.status})`);
    }
    if (sub.submitterId === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Người tải lên / nộp dữ liệu không được tự phê duyệt hồ sơ của chính mình',
      );
    }

    sub.approverId = actor.id;
    sub.approverName = actor.fullName || actor.id;
    sub.reviewedAt = nowIso;
    sub.status = dto.approved ? 'APPROVED' : 'REJECTED';
    sub.rejectionReason = dto.approved ? null : dto.rejectionReason || dto.notes || 'Bị từ chối bởi người phê duyệt';

    const auditId = await this.logAuditSafe(
      actor.id,
      dto.approved ? 'ONBOARDING_SUBMISSION_APPROVED' : 'ONBOARDING_SUBMISSION_REJECTED',
      `Submission:${submissionId}`,
      { status: 'PENDING_APPROVAL' },
      { status: sub.status, approverId: actor.id, reason: sub.rejectionReason },
    );
    if (auditId) sub.auditLogRef = auditId;

    await this.writeJsonSetting(SETTING_SUBMISSIONS, submissions);

    const tasks = await this.readJsonSetting<OnboardingTaskRecord[]>(SETTING_TASKS, this.buildDefaultTasks(nowIso));
    const tIdx = tasks.findIndex((t) => t.workstreamId === sub.workstreamId);
    if (tIdx >= 0) {
      tasks[tIdx].status = sub.status;
      tasks[tIdx].rejectionReason = sub.rejectionReason;
      tasks[tIdx].updatedAt = nowIso;
      await this.writeJsonSetting(SETTING_TASKS, tasks);
    }

    const { rawContent: _hidden, ...safeReturn } = sub;
    return safeReturn;
  }

  async commitApprovedSubmission(
    submissionId: string,
    actor: { id: string; fullName?: string },
  ) {
    const nowIso = new Date().toISOString();
    const submissions = await this.readJsonSetting<OnboardingSubmissionRecord[]>(SETTING_SUBMISSIONS, []);
    const idx = submissions.findIndex((s) => s.id === submissionId);
    if (idx < 0) throw new NotFoundException(`Không tìm thấy hồ sơ '${submissionId}'`);

    const sub = submissions[idx];
    if (sub.status === 'COMMITTED') {
      throw new BadRequestException(`Hồ sơ '${submissionId}' đã được commit trước đó (${sub.commitRef})`);
    }
    if (sub.status !== 'APPROVED') {
      throw new BadRequestException(
        `Chặn an toàn: Chỉ hồ sơ đã APPROVED mới được phép commit vào hệ thống (trạng thái hiện tại: ${sub.status})`,
      );
    }

    let commitResult: any = { commitRef: `CMT-${Date.now()}` };
    if (sub.workstreamType === 'RECIPE_WORKBOOK') {
      const committed = await this.recipeService.commitRecipeImport(
        {
          csvContent: sub.rawContent,
          createDraftRevisionIfApproved: Boolean(sub.createDraftRevisionIfApproved),
        },
        { id: sub.submitterId, fullName: sub.submitterName },
      );
      commitResult = { commitRef: `CMT-REC-${Date.now()}`, ...committed };
    }

    sub.status = 'COMMITTED';
    sub.commitRef = commitResult.commitRef;
    sub.committedAt = nowIso;

    const auditId = await this.logAuditSafe(
      actor.id,
      'ONBOARDING_SUBMISSION_COMMITTED',
      `Submission:${submissionId}`,
      { status: 'APPROVED' },
      { status: 'COMMITTED', commitRef: sub.commitRef, workstreamType: sub.workstreamType },
    );
    if (auditId) sub.auditLogRef = auditId;

    await this.writeJsonSetting(SETTING_SUBMISSIONS, submissions);

    const tasks = await this.readJsonSetting<OnboardingTaskRecord[]>(SETTING_TASKS, this.buildDefaultTasks(nowIso));
    const tIdx = tasks.findIndex((t) => t.workstreamId === sub.workstreamId);
    if (tIdx >= 0) {
      tasks[tIdx].status = 'COMMITTED';
      tasks[tIdx].updatedAt = nowIso;
      await this.writeJsonSetting(SETTING_TASKS, tasks);
    }

    return { submissionId: sub.id, status: sub.status, ...commitResult };
  }

  async assignExceptionOwner(
    exceptionId: string,
    dto: AssignExceptionOwnerDto,
    actor?: { id: string; fullName?: string },
  ) {
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId },
      select: { id: true, fullName: true, email: true },
    });
    if (!employee) {
      throw new NotFoundException(`Không tìm thấy nhân viên hợp lệ '${dto.employeeId}'`);
    }

    const nowIso = new Date().toISOString();
    const list = await this.readJsonSetting<OnboardingExceptionRecord[]>(SETTING_EXCEPTIONS, this.buildDefaultExceptions(nowIso));
    const idx = list.findIndex((e) => e.id === exceptionId);
    if (idx < 0) throw new NotFoundException(`Không tìm thấy ngoại lệ '${exceptionId}'`);

    const prev = { ...list[idx] };
    list[idx].assignedEmployeeId = employee.id;
    list[idx].assignedEmployeeName = employee.fullName || employee.email;
    if (dto.targetCompletionDate) list[idx].targetCompletionDate = dto.targetCompletionDate;

    await this.writeJsonSetting(SETTING_EXCEPTIONS, list);
    await this.logAuditSafe(actor?.id, 'ONBOARDING_EXCEPTION_ASSIGNED', `Exception:${exceptionId}`, prev, list[idx]);
    return list[idx];
  }

  async closeOnboardingException(
    exceptionId: string,
    dto: CloseOnboardingExceptionDto,
    actor: { id: string; fullName?: string },
  ) {
    const nowIso = new Date().toISOString();
    const list = await this.readJsonSetting<OnboardingExceptionRecord[]>(SETTING_EXCEPTIONS, this.buildDefaultExceptions(nowIso));
    const idx = list.findIndex((e) => e.id === exceptionId);
    if (idx < 0) throw new NotFoundException(`Không tìm thấy ngoại lệ '${exceptionId}'`);

    const ex = list[idx];
    if (!ex.assignedEmployeeId) {
      throw new BadRequestException('Phải phân công nhân viên phụ trách thực tế trước khi đóng ngoại lệ');
    }
    if (ex.assignedEmployeeId === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Nhân viên phụ trách ngoại lệ không được tự phê duyệt đóng ngoại lệ của chính mình',
      );
    }

    ex.supportingEvidence = dto.evidenceRef;
    ex.closureReason = dto.closureReason;
    ex.approvedById = actor.id;
    ex.approvedByName = actor.fullName || actor.id;
    ex.approvalStatus = 'COMPLETED';
    ex.auditRef = await this.logAuditSafe(
      actor.id,
      'ONBOARDING_EXCEPTION_CLOSED',
      `Exception:${exceptionId}`,
      { approvalStatus: list[idx].approvalStatus },
      ex,
    );

    await this.writeJsonSetting(SETTING_EXCEPTIONS, list);
    return ex;
  }

  async approveCompositeDecision(
    dto: CompositeApprovalDecisionDto,
    actor: { id: string; fullName?: string },
  ) {
    if (dto.submittedById === actor.id) {
      throw new ForbiddenException(
        'Vi phạm kiểm soát chéo (Segregation of Duties): Người đề xuất chiến lược Set/Buffet không được tự phê duyệt',
      );
    }

    const decisions = await this.readJsonSetting<Record<string, any>>(SETTING_COMPOSITES, {});
    const nowIso = new Date().toISOString();

    decisions[dto.decisionType] = {
      approved: true,
      strategyOrOutcome: dto.strategyOrOutcome,
      approvalRef: dto.approvalRef,
      submittedById: dto.submittedById,
      approvedById: actor.id,
      approvedByName: actor.fullName || actor.id,
      approvedAt: nowIso,
      committed: Boolean(dto.executeCommit),
    };

    if (dto.executeCommit) {
      if (dto.decisionType === 'BUFFET_TICKETS_NON_TRACKED') {
        await this.prisma.product.updateMany({
          where: { itemCode: { in: ['PRD-021', 'PRD-022', 'PRD-023', 'PRD-111', 'PRD-114', 'PRD-119', 'PRD-239'] } },
          data: { inventoryTracked: false },
        });
      } else if (dto.decisionType === 'DEACTIVATE_TEST_BUFFET_PACKAGE') {
        await this.prisma.buffetPackage.updateMany({
          where: { name: { contains: '1788880668704' } },
          data: { active: false },
        });
      }
    }

    await this.writeJsonSetting(SETTING_COMPOSITES, decisions);
    await this.logAuditSafe(actor.id, 'COMPOSITE_DECISION_APPROVED', `Composite:${dto.decisionType}`, null, decisions[dto.decisionType]);
    return decisions[dto.decisionType];
  }

  private parseJsonSafe(raw?: string | null): Record<string, any> {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}

