export class CreateAddressDto {
  recipientName?: string;
  phone?: string;
  province: string;
  ward: string;
  streetDetail: string;
  isDefault?: boolean;
  latitude?: number;
  longitude?: number;
}
