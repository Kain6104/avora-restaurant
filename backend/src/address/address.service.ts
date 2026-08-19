import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: CreateAddressDto) {
    if (data.isDefault) {
      await this.resetDefaultAddresses(userId);
    }
    
    return this.prisma.address.create({
      data: {
        userId,
        recipientName: data.recipientName,
        phone: data.phone,
        province: data.province,
        ward: data.ward,
        streetDetail: data.streetDetail,
        latitude: data.latitude,
        longitude: data.longitude,
        isDefault: data.isDefault || false,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  async update(id: string, userId: string, data: UpdateAddressDto) {
    await this.findOne(id, userId); // verify existence

    if (data.isDefault) {
      await this.resetDefaultAddresses(userId);
    }

    return this.prisma.address.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId); // verify existence
    return this.prisma.address.delete({
      where: { id },
    });
  }

  private async resetDefaultAddresses(userId: string) {
    await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
