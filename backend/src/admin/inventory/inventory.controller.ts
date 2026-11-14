import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BranchScope } from '../../common/decorators/branch-scope.decorator';
import { IngredientService } from './ingredient.service';
import { WarehouseService } from './warehouse.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { RecipeService } from './recipe.service';
import { ProcurementService } from './procurement.service';
import { StockTransferService } from './stock-transfer.service';
import { StocktakeService } from './stocktake.service';
import { WasteService } from './waste.service';
import { FoodCostCalculationService } from './food-cost-calculation.service';
import { InventoryMonitorService } from './inventory-monitor.service';
import { Avo1OnboardingService } from './avo1-onboarding.service';
import {
  AssignTaskOwnerDto,
  SubmitOnboardingEvidenceDto,
  ReviewOnboardingSubmissionDto,
  AssignExceptionOwnerDto,
  CloseOnboardingExceptionDto,
  CompositeApprovalDecisionDto,
} from './dto/onboarding.dto';
import {
  CreateIngredientDto,
  UpdateIngredientDto,
  CreateIngredientCategoryDto,
  CreateIngredientUnitDto,
  CreateUnitConversionDto,
} from './dto/ingredient.dto';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  CreateWarehouseLocationDto,
} from './dto/warehouse.dto';
import {
  CreateRecipeDto,
  CreateRecipeVersionDto,
  RecipeWorkflowDecisionDto,
  ClassifyNonInventoryModifiersDto,
  BulkClassifyModifiersDto,
  RecipeImportRequestDto,
} from './dto/recipe.dto';
import {
  CreateSupplierDto,
  CreatePurchaseRequestDto,
  CreatePurchaseOrderDto,
  CreateGoodsReceiptDto,
} from './dto/procurement.dto';
import {
  CreateStockTransferDto,
  DispatchStockTransferDto,
  ReceiveStockTransferDto,
} from './dto/stock-transfer.dto';
import {
  CreateStocktakeDto,
  SubmitStocktakeCountsDto,
  ReviewStocktakeDto,
} from './dto/stocktake.dto';
import { CreateInventoryWasteDto, ReviewInventoryWasteDto } from './dto/waste.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';

@Controller('admin/inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly ingredientService: IngredientService,
    private readonly warehouseService: WarehouseService,
    private readonly ledgerService: InventoryLedgerService,
    private readonly recipeService: RecipeService,
    private readonly procurementService: ProcurementService,
    private readonly transferService: StockTransferService,
    private readonly stocktakeService: StocktakeService,
    private readonly wasteService: WasteService,
    private readonly foodCostService: FoodCostCalculationService,
    private readonly monitorService: InventoryMonitorService,
    private readonly onboardingService: Avo1OnboardingService,
  ) {}

  // 1. INGREDIENTS & UNITS
  @Get('ingredients')
  @RequirePermission('inventory.view')
  async getIngredients(@Query() query: QueryInventoryDto) {
    return {
      success: true,
      data: await this.ingredientService.getIngredients(query),
    };
  }

  @Get('ingredients/:id')
  @RequirePermission('inventory.view')
  async getIngredientById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.ingredientService.getIngredientById(id),
    };
  }

  @Post('ingredients')
  @RequirePermission('ingredients.manage')
  async createIngredient(@Body() dto: CreateIngredientDto) {
    return {
      success: true,
      message: 'Đã tạo nguyên liệu thành công',
      data: await this.ingredientService.createIngredient(dto),
    };
  }

  @Put('ingredients/:id')
  @RequirePermission('ingredients.manage')
  async updateIngredient(@Param('id') id: string, @Body() dto: UpdateIngredientDto) {
    return {
      success: true,
      message: 'Đã cập nhật nguyên liệu thành công',
      data: await this.ingredientService.updateIngredient(id, dto),
    };
  }

  @Get('categories')
  @RequirePermission('inventory.view')
  async getCategories() {
    return {
      success: true,
      data: await this.ingredientService.getCategories(),
    };
  }

  @Post('categories')
  @RequirePermission('ingredients.manage')
  async createCategory(@Body() dto: CreateIngredientCategoryDto) {
    return {
      success: true,
      data: await this.ingredientService.createCategory(dto),
    };
  }

  @Get('units')
  @RequirePermission('inventory.view')
  async getUnits() {
    return {
      success: true,
      data: await this.ingredientService.getUnits(),
    };
  }

  @Post('units')
  @RequirePermission('ingredients.manage')
  async createUnit(@Body() dto: CreateIngredientUnitDto) {
    return {
      success: true,
      data: await this.ingredientService.createUnit(dto),
    };
  }

  @Post('unit-conversions')
  @RequirePermission('ingredients.manage')
  async addUnitConversion(@Body() dto: CreateUnitConversionDto) {
    return {
      success: true,
      data: await this.ingredientService.addUnitConversion(dto),
    };
  }

  // 2. WAREHOUSES
  @Get('warehouses')
  @RequirePermission('inventory.view')
  async getWarehouses(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.warehouseService.getWarehouses(branchId),
    };
  }

  @Get('warehouses/:id')
  @RequirePermission('inventory.view')
  async getWarehouseById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.warehouseService.getWarehouseById(id),
    };
  }

  @Post('warehouses')
  @RequirePermission('inventory.create')
  async createWarehouse(@Body() dto: CreateWarehouseDto) {
    return {
      success: true,
      data: await this.warehouseService.createWarehouse(dto),
    };
  }

  @Put('warehouses/:id')
  @RequirePermission('inventory.update')
  async updateWarehouse(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return {
      success: true,
      data: await this.warehouseService.updateWarehouse(id, dto),
    };
  }

  @Post('warehouse-locations')
  @RequirePermission('inventory.create')
  async createLocation(@Body() dto: CreateWarehouseLocationDto) {
    return {
      success: true,
      data: await this.warehouseService.createLocation(dto),
    };
  }

  // 3. RECIPES & BOM
  @Get('recipes')
  @RequirePermission('recipes.view')
  async getRecipes(
    @Query('search') search?: string,
    @Query('productId') productId?: string,
    @Query('isSemiFinished') isSemiFinished?: string,
  ) {
    return {
      success: true,
      data: await this.recipeService.getRecipes({
        search,
        productId,
        isSemiFinished: isSemiFinished ? isSemiFinished === 'true' : undefined,
      }),
    };
  }

  @Get('recipes/export/onboarding-template')
  @RequirePermission('recipes.view')
  async exportRecipeOnboardingWorkbook(
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.recipeService.exportRecipeOnboardingWorkbook();
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="avora-recipe-onboarding-template.csv"');
      return `\uFEFF${result.csv}`;
    }
    return {
      success: true,
      data: result,
    };
  }

  @Get('recipes/missing-prep-sheet')
  @RequirePermission('recipes.view')
  async getMissingRecipePrepSheet(
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.recipeService.getMissingRecipePrepSheet();
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="avora-missing-recipe-prep-sheet.csv"');
      return `\uFEFF${result.csv}`;
    }
    return {
      success: true,
      data: result,
    };
  }

  @Get('recipes/modifier-coverage')
  @RequirePermission('recipes.view')
  async getModifierCoverageMatrix() {
    return {
      success: true,
      data: await this.recipeService.getModifierCoverageMatrix(),
    };
  }

  @Post('recipes/non-inventory-modifiers')
  @RequirePermission('recipes.approve')
  async classifyNonInventoryModifiers(
    @Body() dto: ClassifyNonInventoryModifiersDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã cập nhật phân loại tùy chọn không ảnh hưởng tồn kho',
      data: await this.recipeService.classifyNonInventoryModifiers(dto, req.user),
    };
  }

  @Post('recipes/modifiers/bulk-classify')
  @RequirePermission('recipes.approve')
  async bulkClassifyModifiers(
    @Body() dto: BulkClassifyModifiersDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã cập nhật phân loại tùy chọn hàng loạt',
      data: await this.recipeService.bulkClassifyModifiers(dto, req.user),
    };
  }

  @Post('recipes/import/preview')
  @RequirePermission('recipes.manage')
  async previewRecipeImport(@Body() dto: RecipeImportRequestDto) {
    return {
      success: true,
      data: await this.recipeService.previewRecipeImport(dto),
    };
  }

  @Post('recipes/import/commit')
  @RequirePermission('recipes.manage')
  async commitRecipeImport(@Body() dto: RecipeImportRequestDto, @Req() req: any) {
    return {
      success: true,
      message: 'Đã import các công thức hợp lệ ở trạng thái DRAFT chờ duyệt',
      data: await this.recipeService.commitRecipeImport(dto, req.user),
    };
  }

  @Get('recipes/:id')
  @RequirePermission('recipes.view')
  async getRecipeById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.recipeService.getRecipeById(id),
    };
  }

  @Post('recipes')
  @RequirePermission('recipes.manage')
  async createRecipe(@Body() dto: CreateRecipeDto, @Req() req: any) {
    return {
      success: true,
      message: 'Đã lưu công thức nháp (DRAFT). Vui lòng gửi duyệt để R&D phê duyệt và ban hành.',
      data: await this.recipeService.createRecipe(dto, req.user),
    };
  }

  @Post('recipes/:id/versions')
  @RequirePermission('recipes.manage')
  async createRecipeVersion(
    @Param('id') recipeId: string,
    @Body() dto: CreateRecipeVersionDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.recipeService.createNewVersion(recipeId, dto, req.user),
    };
  }

  @Post('recipes/:id/versions/:versionId/submit')
  @RequirePermission('recipes.manage')
  async submitRecipeVersionForReview(
    @Param('id') recipeId: string,
    @Param('versionId') versionId: string,
    @Body() dto: RecipeWorkflowDecisionDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã gửi công thức chờ Chef/R&D duyệt (SUBMITTED_FOR_REVIEW)',
      data: await this.recipeService.submitVersionForReview(recipeId, versionId, req.user, dto?.notes),
    };
  }

  @Post('recipes/:id/versions/:versionId/approve')
  @RequirePermission('recipes.approve')
  async approveRecipeVersion(
    @Param('id') recipeId: string,
    @Param('versionId') versionId: string,
    @Body() dto: RecipeWorkflowDecisionDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã phê duyệt công thức (APPROVED)',
      data: await this.recipeService.approveVersion(recipeId, versionId, req.user, dto?.notes),
    };
  }

  @Post('recipes/:id/versions/:versionId/reject')
  @RequirePermission('recipes.approve')
  async rejectRecipeVersion(
    @Param('id') recipeId: string,
    @Param('versionId') versionId: string,
    @Body() dto: RecipeWorkflowDecisionDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã trả công thức về trạng thái nháp (DRAFT)',
      data: await this.recipeService.rejectVersion(recipeId, versionId, req.user, dto?.notes),
    };
  }

  @Post('recipes/:id/versions/:versionId/publish')
  @RequirePermission('recipes.approve')
  async publishRecipeVersion(
    @Param('id') recipeId: string,
    @Param('versionId') versionId: string,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã ban hành phiên bản công thức chính thức (PUBLISHED)',
      data: await this.recipeService.publishVersion(recipeId, versionId, req.user),
    };
  }

  @Post('recipes/:id/versions/:versionId/archive')
  @RequirePermission('recipes.approve')
  async archiveRecipeVersion(
    @Param('id') recipeId: string,
    @Param('versionId') versionId: string,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã lưu trữ phiên bản công thức (ARCHIVED)',
      data: await this.recipeService.archiveVersion(recipeId, versionId, req.user),
    };
  }

  // 4. PROCUREMENT (SUPPLIERS, PR, PO, GRN)
  @Get('suppliers')
  @RequirePermission('suppliers.manage')
  async getSuppliers() {
    return {
      success: true,
      data: await this.procurementService.getSuppliers(),
    };
  }

  @Post('suppliers')
  @RequirePermission('suppliers.manage')
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return {
      success: true,
      data: await this.procurementService.createSupplier(dto),
    };
  }

  @Get('purchase-requests')
  @RequirePermission('purchase_requests.create')
  async getPurchaseRequests(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.procurementService.getPurchaseRequests(branchId),
    };
  }

  @Post('purchase-requests')
  @RequirePermission('purchase_requests.create')
  async createPurchaseRequest(@Body() dto: CreatePurchaseRequestDto, @Req() req: any) {
    return {
      success: true,
      data: await this.procurementService.createPurchaseRequest(dto, req.user),
    };
  }

  @Post('purchase-requests/:id/review')
  @RequirePermission('purchase_requests.approve')
  async reviewPurchaseRequest(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.procurementService.reviewPurchaseRequest(id, approved, req.user),
    };
  }

  @Get('purchase-orders')
  @RequirePermission('purchase_orders.manage')
  async getPurchaseOrders(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.procurementService.getPurchaseOrders(branchId),
    };
  }

  @Post('purchase-orders')
  @RequirePermission('purchase_orders.manage')
  async createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @Req() req: any) {
    return {
      success: true,
      data: await this.procurementService.createPurchaseOrder(dto, req.user),
    };
  }

  @Post('purchase-orders/:id/approve')
  @RequirePermission('purchase_orders.approve')
  async approvePurchaseOrder(@Param('id') id: string, @Req() req: any) {
    return {
      success: true,
      data: await this.procurementService.approvePurchaseOrder(id, req.user),
    };
  }

  @Get('goods-receipts')
  @RequirePermission('goods_receipts.confirm')
  async getGoodsReceipts(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.procurementService.getGoodsReceipts(branchId),
    };
  }

  @Post('goods-receipts')
  @RequirePermission('goods_receipts.confirm')
  async createGoodsReceipt(@Body() dto: CreateGoodsReceiptDto, @Req() req: any) {
    return {
      success: true,
      message: 'Đã xác nhận nhập kho và ghi nhận sổ cái thành công',
      data: await this.procurementService.createAndConfirmGoodsReceipt(dto, req.user),
    };
  }

  // 5. STOCK TRANSFERS
  @Get('transfers')
  @RequirePermission('inventory.transfer')
  async getTransfers(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.transferService.getTransfers(branchId),
    };
  }

  @Post('transfers')
  @RequirePermission('inventory.transfer')
  async createTransfer(@Body() dto: CreateStockTransferDto, @Req() req: any) {
    return {
      success: true,
      data: await this.transferService.createTransfer(dto, req.user),
    };
  }

  @Post('transfers/:id/approve')
  @RequirePermission('inventory.transfer.approve')
  async approveTransfer(@Param('id') id: string, @Req() req: any) {
    return {
      success: true,
      data: await this.transferService.approveTransfer(id, req.user),
    };
  }

  @Post('transfers/:id/dispatch')
  @RequirePermission('inventory.transfer')
  async dispatchTransfer(
    @Param('id') id: string,
    @Body() dto: DispatchStockTransferDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.transferService.dispatchTransfer(id, dto, req.user),
    };
  }

  @Post('transfers/:id/receive')
  @RequirePermission('inventory.transfer')
  async receiveTransfer(
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.transferService.receiveTransfer(id, dto, req.user),
    };
  }

  // 6. STOCKTAKE (KIỂM KÊ)
  @Get('stocktakes')
  @RequirePermission('inventory.stocktake')
  async getStocktakes(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.stocktakeService.getStocktakes(branchId),
    };
  }

  @Get('stocktakes/export/blind-count-sheet')
  @RequirePermission('inventory.stocktake')
  async exportBlindStocktakeSheet(
    @Query('branchId') branchId: string | undefined,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.stocktakeService.exportBlindStocktakeSheet(branchId);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="avora-opening-stocktake-blind-sheet.csv"');
      return `\uFEFF${result.csv}`;
    }
    return {
      success: true,
      data: result,
    };
  }

  @Get('stocktakes/:id')
  @RequirePermission('inventory.stocktake')
  async getStocktakeById(@Param('id') id: string) {
    return {
      success: true,
      data: await this.stocktakeService.getStocktakeById(id),
    };
  }

  @Post('stocktakes')
  @RequirePermission('inventory.stocktake')
  async createStocktake(@Body() dto: CreateStocktakeDto, @Req() req: any) {
    return {
      success: true,
      data: await this.stocktakeService.createStocktake(dto, req.user),
    };
  }

  @Post('stocktakes/:id/counts')
  @RequirePermission('inventory.stocktake')
  async submitStocktakeCounts(
    @Param('id') id: string,
    @Body() dto: SubmitStocktakeCountsDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.stocktakeService.submitCounts(id, dto, req.user),
    };
  }

  @Post('stocktakes/:id/review')
  @RequirePermission('inventory.stocktake.approve')
  async reviewStocktake(
    @Param('id') id: string,
    @Body() dto: ReviewStocktakeDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.stocktakeService.reviewStocktake(id, dto, req.user),
    };
  }

  // 7. WASTE & SPOILAGE
  @Get('waste')
  @RequirePermission('inventory.waste.create')
  async getWasteRecords(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.wasteService.getWasteRecords(branchId),
    };
  }

  @Post('waste')
  @RequirePermission('inventory.waste.create')
  async createWaste(@Body() dto: CreateInventoryWasteDto, @Req() req: any) {
    return {
      success: true,
      message: 'Đã lập phiếu hao hụt và cập nhật sổ cái kho thành công',
      data: await this.wasteService.createWasteRecord(dto, req.user),
    };
  }

  @Post('waste/:id/review')
  @RequirePermission('inventory.waste.approve')
  async reviewWaste(
    @Param('id') id: string,
    @Body() dto: ReviewInventoryWasteDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.wasteService.reviewWaste(id, dto, req.user),
    };
  }

  // 8. INVENTORY TRANSACTIONS (SỔ CÁI KHO)
  @Get('transactions')
  @RequirePermission('inventory.view')
  async getTransactions(@Query() query: any) {
    return {
      success: true,
      data: await this.ledgerService.getTransactions(query),
    };
  }

  // 9. INTELLIGENCE & FOOD COST REPORTS
  @Get('reports/valuation')
  @RequirePermission('inventory.reports.view')
  async getValuationReport(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.foodCostService.getInventoryValuation(branchId),
    };
  }

  @Get('reports/food-cost')
  @RequirePermission('inventory.reports.view')
  async getFoodCostReport(@Query() query: any) {
    return {
      success: true,
      data: await this.foodCostService.getFoodCostReport(query),
    };
  }

  @Get('reports/expiration-alerts')
  @RequirePermission('inventory.reports.view')
  async getExpirationAlerts(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.foodCostService.getExpirationAlerts(branchId),
    };
  }

  // 10. OPERATIONAL MONITORING & BRANCH ACTIVATION (PHASE 3.1)
  @Get('monitor')
  @RequirePermission('inventory.view')
  async getOperationalMonitor(@Query('branchId') branchId?: string) {
    return {
      success: true,
      data: await this.monitorService.getMonitorDashboard(branchId),
    };
  }

  @Get('monitor/seed-reconciliation')
  @RequirePermission('inventory.view')
  async getSeedReconciliationAudit() {
    return {
      success: true,
      data: await this.monitorService.getSeedReconciliationAudit(),
    };
  }

  @Post('monitor/seed-reconciliation/execute')
  @RequirePermission('inventory.adjust')
  async executeAuthorizedSeedReconciliation(
    @Body()
    body: {
      scope?: 'AVO1_ONLY' | 'FULL_5_BRANCH';
      balanceIds: string[];
      managerApprovalRef: string;
      approvedById: string;
      approvedByName?: string;
      financeApprovalRef?: string;
      financeApprovedById?: string;
      dryRun?: boolean;
    },
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.monitorService.executeAuthorizedSeedReconciliation(body, req.user),
    };
  }

  @Post('monitor/exceptions/:id/resolve')
  @RequirePermission('inventory.adjust')
  async resolveOperationalException(
    @Param('id') id: string,
    @Body() body: { status: 'ACKNOWLEDGED' | 'RESOLVED'; resolutionNotes?: string },
    @Req() req: any,
  ) {
    return {
      success: true,
      data: await this.monitorService.resolveException(id, body as any, req.user),
    };
  }

  @Put('branch-activation/:branchId')
  @RequirePermission('inventory.adjust')
  async updateBranchInventoryActivation(
    @Param('branchId') branchId: string,
    @Body()
    body: {
      inventoryActivated: boolean;
      inventoryPolicy: 'STRICT_TRACKING' | 'WARN_AND_ALLOW' | 'MANUAL_CONSUMPTION';
      approvalRef?: string;
      pilotSignOffRef?: string;
    },
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã cập nhật cấu hình kích hoạt kho chi nhánh',
      data: await this.monitorService.updateBranchActivation(branchId, body as any, req.user),
    };
  }

  // 11. AVO1 BUSINESS ONBOARDING WORKSPACE (PHASE 3.5)
  @Get('onboarding/avo1')
  @RequirePermission('inventory.view')
  async getAvo1OnboardingWorkspace(@Query('branchCode') branchCode?: string) {
    return {
      success: true,
      data: await this.onboardingService.getWorkspaceDashboard(branchCode || 'AVO1'),
    };
  }

  @Post('onboarding/avo1/tasks/:workstreamId/assign')
  @RequirePermission('inventory.adjust')
  async assignOnboardingTaskOwner(
    @Param('workstreamId') workstreamId: string,
    @Body() dto: AssignTaskOwnerDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã phân công nhân sự phụ trách workstream',
      data: await this.onboardingService.assignTaskOwner(workstreamId, dto, req.user),
    };
  }

  @Post('onboarding/avo1/submissions')
  @RequirePermission('recipes.manage')
  async submitOnboardingEvidence(@Body() dto: SubmitOnboardingEvidenceDto, @Req() req: any) {
    return {
      success: true,
      message: 'Đã tiếp nhận và kiểm tra tệp dữ liệu nghiệp vụ',
      data: await this.onboardingService.submitOnboardingEvidence(dto, req.user),
    };
  }

  @Post('onboarding/avo1/submissions/:id/review')
  @RequirePermission('inventory.adjust')
  async reviewOnboardingSubmission(
    @Param('id') id: string,
    @Body() dto: ReviewOnboardingSubmissionDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: dto.approved ? 'Đã phê duyệt hồ sơ dữ liệu' : 'Đã từ chối hồ sơ dữ liệu',
      data: await this.onboardingService.reviewOnboardingSubmission(id, dto, req.user),
    };
  }

  @Post('onboarding/avo1/submissions/:id/commit')
  @RequirePermission('inventory.adjust')
  async commitOnboardingSubmission(@Param('id') id: string, @Req() req: any) {
    return {
      success: true,
      message: 'Đã commit hồ sơ đã duyệt vào hệ thống',
      data: await this.onboardingService.commitApprovedSubmission(id, req.user),
    };
  }

  @Post('onboarding/avo1/exceptions/:id/assign')
  @RequirePermission('inventory.adjust')
  async assignOnboardingExceptionOwner(
    @Param('id') id: string,
    @Body() dto: AssignExceptionOwnerDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã gán nhân sự xử lý ngoại lệ',
      data: await this.onboardingService.assignExceptionOwner(id, dto, req.user),
    };
  }

  @Post('onboarding/avo1/exceptions/:id/close')
  @RequirePermission('inventory.adjust')
  async closeOnboardingException(
    @Param('id') id: string,
    @Body() dto: CloseOnboardingExceptionDto,
    @Req() req: any,
  ) {
    return {
      success: true,
      message: 'Đã đóng ngoại lệ theo bằng chứng phê duyệt',
      data: await this.onboardingService.closeOnboardingException(id, dto, req.user),
    };
  }

  @Post('onboarding/avo1/composite-decision')
  @RequirePermission('inventory.adjust')
  async approveCompositeDecision(@Body() dto: CompositeApprovalDecisionDto, @Req() req: any) {
    return {
      success: true,
      message: 'Đã ghi nhận quyết định chiến lược Set/Buffet (SoD)',
      data: await this.onboardingService.approveCompositeDecision(dto, req.user),
    };
  }
}
