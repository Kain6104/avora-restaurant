import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { IngredientService } from './ingredient.service';
import { WarehouseService } from './warehouse.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { RecipeService } from './recipe.service';
import { InventoryReservationService } from './inventory-reservation.service';
import { ProcurementService } from './procurement.service';
import { StockTransferService } from './stock-transfer.service';
import { StocktakeService } from './stocktake.service';
import { WasteService } from './waste.service';
import { FoodCostCalculationService } from './food-cost-calculation.service';
import { InventoryMonitorService } from './inventory-monitor.service';
import { Avo1OnboardingService } from './avo1-onboarding.service';

@Module({
  controllers: [InventoryController],
  providers: [
    IngredientService,
    WarehouseService,
    InventoryLedgerService,
    RecipeService,
    InventoryReservationService,
    ProcurementService,
    StockTransferService,
    StocktakeService,
    WasteService,
    FoodCostCalculationService,
    InventoryMonitorService,
    Avo1OnboardingService,
  ],
  exports: [
    IngredientService,
    WarehouseService,
    InventoryLedgerService,
    RecipeService,
    InventoryReservationService,
    ProcurementService,
    StockTransferService,
    StocktakeService,
    WasteService,
    FoodCostCalculationService,
    InventoryMonitorService,
    Avo1OnboardingService,
  ],
})
export class InventoryModule {}

