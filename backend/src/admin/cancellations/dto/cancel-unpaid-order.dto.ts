import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export const CANCELLATION_REASONS = [
  { code: 'CUSTOMER_CHANGED_MIND', label: 'Khách hàng đổi ý' },
  { code: 'CUSTOMER_WRONG_ITEM', label: 'Khách hàng đặt nhầm món' },
  { code: 'STAFF_INPUT_ERROR', label: 'Nhân viên nhập nhầm món' },
  { code: 'DUPLICATE_ORDER', label: 'Trùng đơn hàng' },
  { code: 'WRONG_ORDER_INFO', label: 'Sai thông tin đơn hàng' },
  { code: 'OUT_OF_STOCK_INGREDIENTS', label: 'Hết nguyên liệu' },
  { code: 'OUT_OF_STOCK_ITEM', label: 'Hết món' },
  { code: 'CANNOT_DELIVER', label: 'Không thể giao hàng' },
  { code: 'CANNOT_CONTACT_CUSTOMER', label: 'Không liên hệ được khách hàng' },
  { code: 'CUSTOMER_NO_SHOW', label: 'Khách hàng không đến nhận' },
  { code: 'SYSTEM_ERROR', label: 'Lỗi hệ thống' },
  { code: 'OTHER', label: 'Lý do khác' },
] as const;

export class CancelUnpaidOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã lý do hủy là bắt buộc' })
  reasonCode: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  wasteRecorded?: boolean;

  @IsString()
  @IsOptional()
  wasteNotes?: string;
}

