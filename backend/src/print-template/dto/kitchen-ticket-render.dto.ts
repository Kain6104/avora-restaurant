import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class KitchenTicketRenderDto {
  @IsNotEmpty({ message: 'Mã đơn hàng không được để trống' })
  @IsString()
  orderId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orderItemIds?: string[];

  @IsOptional()
  @IsIn(['NEW', 'ADD', 'CANCEL', 'NOTE'], { message: 'Chế độ in phiếu bếp không hợp lệ' })
  ticketMode?: 'NEW' | 'ADD' | 'CANCEL' | 'NOTE' = 'NEW';

  @IsOptional()
  @IsString()
  noteContent?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
