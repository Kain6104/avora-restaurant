import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  // --- VOUCHERS ---
  async findAllVouchers(params: { skip?: number; take?: number; search?: string; tierId?: string; branchIdScope?: string }) {
    const { skip = 0, take = 10, search, tierId, branchIdScope } = params;
    const where: any = {};
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { title: { contains: search } }
      ];
    }
    if (branchIdScope) {
      where.AND = [
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } }
          ]
        }
      ];
    }
    if (tierId && tierId !== 'ALL') {
      where.membershipTiers = {
        some: { id: tierId }
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({ 
        skip, take, where, 
        include: { branches: true, membershipTiers: true },
        orderBy: { createdAt: 'desc' } 
      }),
      this.prisma.voucher.count({ where }),
    ]);
    return { data, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async createVoucher(data: any) {
    data.startDate = data.startDate ? new Date(data.startDate) : null;
    data.endDate = data.endDate ? new Date(data.endDate) : null;
    
    const { branchIds, branchId, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    
    return this.prisma.voucher.create({ 
      data: {
        ...restData,
        branches: branches.length > 0 ? { connect: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds && membershipTierIds.length > 0 ? { connect: membershipTierIds.map((id: string) => ({ id })) } : undefined
      } 
    });
  }

  async updateVoucher(id: string, data: any, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id }, include: { branches: true } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (branchIdScope && !voucher.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to update this voucher');
    }

    if ('startDate' in data) {
      data.startDate = data.startDate ? new Date(data.startDate) : undefined;
    }
    if ('endDate' in data) {
      data.endDate = data.endDate ? new Date(data.endDate) : undefined;
    }
    
    const { branchIds, branchId, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);

    return this.prisma.voucher.update({ 
      where: { id }, 
      data: {
        ...restData,
        branches: branchIds !== undefined ? { set: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds !== undefined ? { set: membershipTierIds.map((id: string) => ({ id })) } : undefined
      } 
    });
  }

  async deleteVoucher(id: string, branchIdScope?: string) {
    const voucher = await this.prisma.voucher.findUnique({ where: { id }, include: { branches: true } });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (branchIdScope && !voucher.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to delete this voucher');
    }
    return this.prisma.voucher.delete({ where: { id } });
  }

  // --- FLASH SALES ---
  async findAllFlashSales(params: { skip?: number; take?: number; search?: string; tierId?: string; branchIdScope?: string }) {
    const { skip = 0, take = 10, search, tierId, branchIdScope } = params;
    const where: any = {};
    if (search) {
      where.name = { contains: search };
    }
    if (branchIdScope) {
      where.AND = [
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } }
          ]
        }
      ];
    }
    if (tierId && tierId !== 'ALL') {
      where.membershipTiers = {
        some: { id: tierId }
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.flashSale.findMany({
        skip, take, where,
        include: { items: { include: { product: true } }, branches: true, membershipTiers: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.flashSale.count({ where }),
    ]);
    return { data, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async createFlashSale(data: any) {
    data.startTime = data.startTime ? new Date(data.startTime) : null;
    data.endTime = data.endTime ? new Date(data.endTime) : null;
    
    const { items, branchIds, branchId, status, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({
      productId: i.productId,
      flashSalePrice: i.flashSalePrice,
      stock: i.stock,
      maxQuantityPerUser: i.maxQuantityPerUser || 0
    })) : undefined;
    
    return this.prisma.flashSale.create({
      data: {
        ...restData,
        branches: branches.length > 0 ? { connect: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds && membershipTierIds.length > 0 ? { connect: membershipTierIds.map((id: string) => ({ id })) } : undefined,
        items: cleanItems ? { create: cleanItems } : undefined
      }
    });
  }

  async updateFlashSale(id: string, data: any, branchIdScope?: string) {
    const flashSale = await this.prisma.flashSale.findUnique({ where: { id }, include: { branches: true } });
    if (!flashSale) throw new NotFoundException('Flash sale not found');
    if (branchIdScope && !flashSale.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to update this flash sale');
    }

    if ('startTime' in data) {
      data.startTime = data.startTime ? new Date(data.startTime) : undefined;
    }
    if ('endTime' in data) {
      data.endTime = data.endTime ? new Date(data.endTime) : undefined;
    }
    
    const { items, branchIds, branchId, status, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({
      productId: i.productId,
      flashSalePrice: i.flashSalePrice,
      stock: i.stock,
      maxQuantityPerUser: i.maxQuantityPerUser || 0
    })) : undefined;

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.flashSale.update({
        where: { id },
        data: {
          ...restData,
          branches: branchIds !== undefined ? { set: branches.map((id: string) => ({ id })) } : undefined,
          membershipTiers: membershipTierIds !== undefined ? { set: membershipTierIds.map((id: string) => ({ id })) } : undefined
        }
      });
      
      if (cleanItems) {
        await prisma.flashSaleItem.deleteMany({ where: { flashSaleId: id } });
        await prisma.flashSaleItem.createMany({
          data: cleanItems.map((item: any) => ({ ...item, flashSaleId: id }))
        });
      }
      return updated;
    });
  }

  async deleteFlashSale(id: string, branchIdScope?: string) {
    const flashSale = await this.prisma.flashSale.findUnique({ where: { id }, include: { branches: true } });
    if (!flashSale) throw new NotFoundException('Flash sale not found');
    if (branchIdScope && !flashSale.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to delete this flash sale');
    }
    return this.prisma.flashSale.delete({ where: { id } });
  }

  // --- COMBOS ---
  async findAllCombos(params: { skip?: number; take?: number; search?: string; tierId?: string; branchIdScope?: string }) {
    const { skip = 0, take = 10, search, tierId, branchIdScope } = params;
    const where: any = {};
    if (search) {
      where.name = { contains: search };
    }
    if (branchIdScope) {
      where.AND = [
        {
          OR: [
            { branches: { none: {} } },
            { branches: { some: { id: branchIdScope } } }
          ]
        }
      ];
    }
    if (tierId && tierId !== 'ALL') {
      where.membershipTiers = {
        some: { id: tierId }
      };
    }
    const [data, total] = await Promise.all([
      this.prisma.combo.findMany({
        skip, take, where,
        include: { items: { include: { product: true } }, branches: true, membershipTiers: true },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.combo.count({ where }),
    ]);
    return { data, meta: { page: Math.floor(skip / take) + 1, limit: take, total, totalPages: Math.ceil(total / take) } };
  }

  async createCombo(data: any) {
    data.startDate = data.startDate ? new Date(data.startDate) : null;
    data.endDate = data.endDate ? new Date(data.endDate) : null;
    
    const { items, branchIds, branchId, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) : undefined;
    
    return this.prisma.combo.create({
      data: {
        ...restData,
        branches: branches.length > 0 ? { connect: branches.map((id: string) => ({ id })) } : undefined,
        membershipTiers: membershipTierIds && membershipTierIds.length > 0 ? { connect: membershipTierIds.map((id: string) => ({ id })) } : undefined,
        items: cleanItems ? { create: cleanItems } : undefined
      }
    });
  }

  async updateCombo(id: string, data: any, branchIdScope?: string) {
    const combo = await this.prisma.combo.findUnique({ where: { id }, include: { branches: true } });
    if (!combo) throw new NotFoundException('Combo not found');
    if (branchIdScope && !combo.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to update this combo');
    }

    if ('startDate' in data) {
      data.startDate = data.startDate ? new Date(data.startDate) : null;
    }
    if ('endDate' in data) {
      data.endDate = data.endDate ? new Date(data.endDate) : null;
    }
    
    const { items, branchIds, branchId, membershipTierIds, ...restData } = data;
    const branches = branchIds || (branchId && branchId !== '' ? [branchId] : []);
    const cleanItems = items ? items.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) : undefined;

    return this.prisma.$transaction(async (prisma) => {
      const updated = await prisma.combo.update({
        where: { id },
        data: {
          ...restData,
          branches: branchIds !== undefined ? { set: branches.map((id: string) => ({ id })) } : undefined,
          membershipTiers: membershipTierIds !== undefined ? { set: membershipTierIds.map((id: string) => ({ id })) } : undefined
        }
      });
      
      if (cleanItems) {
        await prisma.comboItem.deleteMany({ where: { comboId: id } });
        await prisma.comboItem.createMany({
          data: cleanItems.map((item: any) => ({ ...item, comboId: id }))
        });
      }
      return updated;
    });
  }

  async deleteCombo(id: string, branchIdScope?: string) {
    const combo = await this.prisma.combo.findUnique({ where: { id }, include: { branches: true } });
    if (!combo) throw new NotFoundException('Combo not found');
    if (branchIdScope && !combo.branches.some(b => b.id === branchIdScope)) {
      throw new ForbiddenException('Not allowed to delete this combo');
    }
    return this.prisma.combo.delete({ where: { id } });
  }
}
