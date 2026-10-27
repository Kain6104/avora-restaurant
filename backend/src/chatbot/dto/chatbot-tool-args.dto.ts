import { ClassConstructor, plainToInstance } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Allow,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validate,
  ValidationError,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const VIETNAM_PHONE_PATTERN = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export const FULFILLMENT_TYPES = ['DELIVERY', 'TAKE_AWAY', 'TAKEAWAY', 'DINE_IN'] as const;
export const ORDER_SLOT_TYPES = ['DELIVERY', 'TAKE_AWAY', 'TAKEAWAY'] as const;
export const PAYMENT_METHODS = ['COD', 'SEPAY_QR', 'TRANSFER', 'PAYOS', 'MOMO', 'VNPAY', 'CASH', 'CARD'] as const;

export class EmptyToolArgsDto {
  @Allow()
  private readonly validationMarker?: never;
}

export class ListBranchesArgsDto {
  @IsOptional()
  @IsBoolean()
  reservationOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  deliveryOnly?: boolean;
}

export class BranchLookupArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  branchName?: string;
}

export class FindNearestBranchArgsDto {
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class SearchMenuArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100_000_000)
  budget?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  dietary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchId?: string;
}

export class ProductLookupArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  productId?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  productName?: string;
}

export class AddToCartArgsDto extends ProductLookupArgsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  quantity?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  optionItemIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  optionNames?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateCartItemArgsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lineId!: string;

  @IsInt()
  @Min(0)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ValidateDeliveryAddressArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  streetDetail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ward?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchId?: string;
}

export class SaveAddressArgsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  recipientName!: string;

  @IsString()
  @Matches(VIETNAM_PHONE_PATTERN)
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(250)
  streetDetail!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  ward!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  province!: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude?: number;
}

export class GetAvailableOrderSlotsArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchId?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  date?: string;

  @IsOptional()
  @IsIn(ORDER_SLOT_TYPES)
  orderType?: (typeof ORDER_SLOT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  requestedTime?: string;
}

export class OptionalBranchArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  branchId?: string;
}

export class ApplyVoucherArgsDto {
  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  discountVoucherCode?: string;

  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  shippingVoucherCode?: string;
}

export class RemoveVoucherArgsDto {
  @IsOptional()
  @IsBoolean()
  removeDiscountVoucher?: boolean;

  @IsOptional()
  @IsBoolean()
  removeShippingVoucher?: boolean;
}

export class PreviewPointUsageArgsDto {
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  pointsToUse!: number;
}

export class PreviewOrderArgsDto {
  @IsOptional()
  @IsIn(FULFILLMENT_TYPES)
  fulfillmentType?: (typeof FULFILLMENT_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  operatingSlotId?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  deliveryDate?: string;

  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  discountVoucherCode?: string;

  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(50)
  shippingVoucherCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  pointsToUse?: number;

  @IsOptional()
  @IsBoolean()
  usePoints?: boolean;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: (typeof PAYMENT_METHODS)[number];
}

export class RequestDeliveryLocationArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reason?: string;
}

export class PlaceOrderArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  paymentMethod?: string;
}

export class CheckOrderArgsDto {
  @IsOptional()
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(80)
  orderCode?: string;

  @IsOptional()
  @IsString()
  @Matches(VIETNAM_PHONE_PATTERN)
  phone?: string;
}

export class CancelOrderArgsDto {
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(80)
  orderCode!: string;

  @IsOptional()
  @IsString()
  @Matches(VIETNAM_PHONE_PATTERN)
  phone?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class GetReservationSlotsArgsDto {
  @IsString()
  @MaxLength(100)
  branchId!: string;

  @Matches(DATE_PATTERN)
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  partySize?: number;
}

export class PreviewReservationArgsDto {
  @IsString()
  @MaxLength(100)
  branchId!: string;

  @Matches(DATE_PATTERN)
  reservationDate!: string;

  @Matches(TIME_PATTERN)
  reservationTime!: string;

  @IsInt()
  @Min(1)
  @Max(50)
  partySize!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @IsString()
  @Matches(VIETNAM_PHONE_PATTERN)
  customerPhone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  seatingPreference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;
}

export class GetMyReservationsArgsDto {
  @IsOptional()
  @IsString()
  @Matches(VIETNAM_PHONE_PATTERN)
  phone?: string;
}

export class CancelReservationArgsDto {
  @IsString()
  @Matches(CODE_PATTERN)
  @MaxLength(80)
  reservationCode!: string;

  @IsString()
  @Matches(VIETNAM_PHONE_PATTERN)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class HandoffToHumanArgsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export const CHATBOT_TOOL_DTO_BY_NAME = {
  listBranches: ListBranchesArgsDto,
  getBranchDetail: BranchLookupArgsDto,
  findNearestBranch: FindNearestBranchArgsDto,
  searchMenu: SearchMenuArgsDto,
  getProductDetail: ProductLookupArgsDto,
  listCategories: EmptyToolArgsDto,
  addToCart: AddToCartArgsDto,
  updateCartItem: UpdateCartItemArgsDto,
  getCart: EmptyToolArgsDto,
  clearCart: EmptyToolArgsDto,
  getUserAddresses: EmptyToolArgsDto,
  requestDeliveryLocation: RequestDeliveryLocationArgsDto,
  validateDeliveryAddress: ValidateDeliveryAddressArgsDto,
  saveAddress: SaveAddressArgsDto,
  getAvailableOrderSlots: GetAvailableOrderSlotsArgsDto,
  findApplicableVouchers: OptionalBranchArgsDto,
  applyVoucher: ApplyVoucherArgsDto,
  removeVoucher: RemoveVoucherArgsDto,
  getMembershipStatus: EmptyToolArgsDto,
  previewPointUsage: PreviewPointUsageArgsDto,
  getPaymentMethods: OptionalBranchArgsDto,
  previewOrder: PreviewOrderArgsDto,
  placeOrder: PlaceOrderArgsDto,
  checkOrder: CheckOrderArgsDto,
  cancelOrder: CancelOrderArgsDto,
  getReservationSlots: GetReservationSlotsArgsDto,
  previewReservation: PreviewReservationArgsDto,
  createReservation: EmptyToolArgsDto,
  getMyReservations: GetMyReservationsArgsDto,
  cancelReservation: CancelReservationArgsDto,
  stopVoice: EmptyToolArgsDto,
  handoffToHuman: HandoffToHumanArgsDto,
} as const;

export type ChatbotToolName = keyof typeof CHATBOT_TOOL_DTO_BY_NAME;
export type ChatbotToolArgsMap = {
  [Name in ChatbotToolName]: InstanceType<(typeof CHATBOT_TOOL_DTO_BY_NAME)[Name]>;
};
export type ValidatedChatbotToolCommand = {
  [Name in ChatbotToolName]: { name: Name; args: ChatbotToolArgsMap[Name] };
}[ChatbotToolName];

export class ChatbotToolArgumentValidationError extends Error {
  constructor(public readonly details: string[]) {
    super('Tool arguments are invalid');
  }
}

export function isChatbotToolName(value: string): value is ChatbotToolName {
  return value in CHATBOT_TOOL_DTO_BY_NAME;
}

function normalizeToolArguments(rawArgs: unknown): Record<string, unknown> {
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) return {};

  const normalized = Object.fromEntries(
    Object.entries(rawArgs).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() : value,
    ]),
  );
  for (const key of [
    'discountVoucherCode',
    'shippingVoucherCode',
    'paymentMethod',
    'fulfillmentType',
    'orderType',
  ]) {
    if (typeof normalized[key] === 'string') {
      normalized[key] = normalized[key].toUpperCase();
    }
  }
  for (const key of ['phone', 'customerPhone']) {
    if (typeof normalized[key] === 'string') {
      normalized[key] = normalized[key].replace(/[.\s-]/g, '');
    }
  }
  return normalized;
}

function flattenValidationErrors(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const ownErrors = error.constraints
      ? Object.values(error.constraints).map((message) => `${path}: ${message}`)
      : [];
    return [...ownErrors, ...flattenValidationErrors(error.children || [], path)];
  });
}

function validateSemanticConstraints(
  name: ChatbotToolName,
  args: ChatbotToolArgsMap[ChatbotToolName],
): string[] {
  if (name === 'getBranchDetail') {
    const value = args as BranchLookupArgsDto;
    return value.branchId || value.branchName ? [] : ['branchId or branchName is required'];
  }
  if (name === 'getProductDetail' || name === 'addToCart') {
    const value = args as ProductLookupArgsDto;
    return value.productId || value.productName ? [] : ['productId or productName is required'];
  }
  if (name === 'validateDeliveryAddress') {
    const value = args as ValidateDeliveryAddressArgsDto;
    const hasCoordinates = value.latitude !== undefined && value.longitude !== undefined;
    const hasTextAddress = Boolean(value.streetDetail && value.ward && value.province);
    return value.addressId || hasCoordinates || hasTextAddress
      ? []
      : ['addressId, coordinates, or a complete text address is required'];
  }
  if (name === 'applyVoucher') {
    const value = args as ApplyVoucherArgsDto;
    return value.discountVoucherCode || value.shippingVoucherCode
      ? []
      : ['discountVoucherCode or shippingVoucherCode is required'];
  }
  if (name === 'removeVoucher') {
    const value = args as RemoveVoucherArgsDto;
    return value.removeDiscountVoucher || value.removeShippingVoucher
      ? []
      : ['at least one voucher removal flag must be true'];
  }
  return [];
}

export async function validateChatbotToolCommand(
  name: ChatbotToolName,
  rawArgs: unknown,
): Promise<ValidatedChatbotToolCommand> {
  const DtoClass = CHATBOT_TOOL_DTO_BY_NAME[name] as ClassConstructor<object>;
  const normalizedInput = normalizeToolArguments(rawArgs);
  const args = plainToInstance(DtoClass, normalizedInput);
  const errors = await validate(args, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    stopAtFirstError: false,
  });
  const details = [
    ...flattenValidationErrors(errors),
    ...validateSemanticConstraints(name, args),
  ];
  if (details.length > 0) {
    throw new ChatbotToolArgumentValidationError(details);
  }
  return { name, args } as ValidatedChatbotToolCommand;
}
