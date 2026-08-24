"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AddressService = class AddressService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, data) {
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
    async findAll(userId) {
        return this.prisma.address.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id, userId) {
        const address = await this.prisma.address.findFirst({
            where: { id, userId },
        });
        if (!address) {
            throw new common_1.NotFoundException('Address not found');
        }
        return address;
    }
    async update(id, userId, data) {
        await this.findOne(id, userId); // verify existence
        if (data.isDefault) {
            await this.resetDefaultAddresses(userId);
        }
        return this.prisma.address.update({
            where: { id },
            data,
        });
    }
    async remove(id, userId) {
        await this.findOne(id, userId); // verify existence
        return this.prisma.address.delete({
            where: { id },
        });
    }
    async resetDefaultAddresses(userId) {
        await this.prisma.address.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });
    }
};
exports.AddressService = AddressService;
exports.AddressService = AddressService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AddressService);
