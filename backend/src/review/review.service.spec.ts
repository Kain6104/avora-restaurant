import { BadRequestException, NotFoundException, ForbiddenException, ConflictException, GoneException } from '@nestjs/common';
import { ProductReviewService } from './services/product-review.service';
import { OrderReviewService } from './services/order-review.service';
import { OrderStatus, OrderReviewStatus, ProductReviewStatus, ReviewReactionType, PointTransactionSource } from '@prisma/client';

describe('AVORA Review System Unit Tests', () => {
  describe('ProductReviewService', () => {
    let service: ProductReviewService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({ id: 'user-1', isLocked: false }),
        },
        product: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        productReview: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
          aggregate: jest.fn(),
        },
        orderItem: {
          findFirst: jest.fn(),
        },
        reviewReaction: {
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        },
        reviewMedia: {
          updateMany: jest.fn(),
        },
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      };

      service = new ProductReviewService(mockPrisma);
    });

    it('should reject rating < 1 or > 5 or non-integer', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });

      await expect(
        service.createProductReview('user-1', 'prod-1', { rating: 0, content: 'Tệ' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createProductReview('user-1', 'prod-1', { rating: 6, content: 'Tốt' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createProductReview('user-1', 'prod-1', { rating: 4.5, content: 'Ngon' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate product review by the same user', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.productReview.findUnique.mockResolvedValue({ id: 'rev-1', userId: 'user-1', productId: 'prod-1' });

      await expect(
        service.createProductReview('user-1', 'prod-1', { rating: 5, content: 'Rất ngon' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should correctly determine Verified Purchase only for COMPLETED orders', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.productReview.findUnique.mockResolvedValue(null);

      // Order COMPLETED with this product
      mockPrisma.orderItem.findFirst.mockResolvedValue({
        id: 'item-1',
        orderId: 'order-1',
        order: {
          id: 'order-1',
          status: OrderStatus.COMPLETED,
          completedAt: new Date('2026-09-01'),
          deliveredAt: new Date('2026-09-01'),
          createdAt: new Date('2026-09-01'),
        },
      });

      mockPrisma.productReview.create.mockResolvedValue({
        id: 'rev-new',
        userId: 'user-1',
        productId: 'prod-1',
        rating: 5,
        content: 'Tuyệt vời',
        isVerifiedPurchase: true,
        verifiedOrderId: 'order-1',
        status: ProductReviewStatus.ACTIVE,
      });

      mockPrisma.productReview.aggregate.mockResolvedValue({
        _avg: { rating: 5 },
        _count: { id: 1 },
      });

      mockPrisma.productReview.findUnique.mockImplementation(({ where }: any) => {
        if (where?.userId_productId) return Promise.resolve(null);
        if (where?.id) {
          return Promise.resolve({
            id: 'rev-new',
            userId: 'user-1',
            productId: 'prod-1',
            rating: 5,
            content: 'Tuyệt vời',
            isVerifiedPurchase: true,
            verifiedOrderId: 'order-1',
            purchasedAt: new Date('2026-09-01'),
            media: [],
            reply: null,
          });
        }
        return Promise.resolve(null);
      });

      const result = await service.createProductReview('user-1', 'prod-1', {
        rating: 5,
        content: 'Tuyệt vời',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.productReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isVerifiedPurchase: true,
            verifiedOrderId: 'order-1',
          }),
        }),
      );
    });

    it('should NOT allow user to react (Like/Dislike) to their own review', async () => {
      mockPrisma.productReview.findUnique.mockResolvedValue({
        id: 'rev-own',
        userId: 'user-1',
        status: ProductReviewStatus.ACTIVE,
      });

      await expect(
        service.reactToReview('user-1', 'rev-own', ReviewReactionType.LIKE),
      ).rejects.toThrow(BadRequestException);
    });

    it('should toggle and switch reactions properly (Like -> Dislike)', async () => {
      mockPrisma.productReview.findUnique.mockResolvedValue({
        id: 'rev-other',
        userId: 'user-2',
        status: ProductReviewStatus.ACTIVE,
      });

      // Existing LIKE reaction
      mockPrisma.reviewReaction.findUnique.mockResolvedValue({
        id: 'react-1',
        userId: 'user-1',
        productReviewId: 'rev-other',
        type: ReviewReactionType.LIKE,
      });

      // Switch to DISLIKE
      await service.reactToReview('user-1', 'rev-other', ReviewReactionType.DISLIKE);
      expect(mockPrisma.reviewReaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'react-1' },
          data: { type: ReviewReactionType.DISLIKE },
        }),
      );

      // Same reaction -> removes reaction (toggle)
      await service.reactToReview('user-1', 'rev-other', ReviewReactionType.LIKE);
      expect(mockPrisma.reviewReaction.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'react-1' },
        }),
      );
    });
  });

  describe('OrderReviewService', () => {
    let service: OrderReviewService;
    let mockPrisma: any;
    let mockNotificationService: any;

    beforeEach(() => {
      mockPrisma = {
        order: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        orderReview: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
        },
        orderReviewFollowUp: {
          create: jest.fn(),
          findUnique: jest.fn(),
        },
        reviewMedia: {
          updateMany: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        pointTransaction: {
          create: jest.fn(),
        },
        systemSetting: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where.key === 'ORDER_REVIEW_REWARD_POINTS') return Promise.resolve({ value: '999' });
            if (where.key === 'ORDER_REVIEW_WINDOW_DAYS') return Promise.resolve({ value: '14' });
            return Promise.resolve(null);
          }),
        },
        $transaction: jest.fn(async (cb) => cb(mockPrisma)),
      };

      mockNotificationService = {
        createNotification: jest.fn().mockResolvedValue({ id: 'noti-1' }),
      };

      service = new OrderReviewService(mockPrisma, mockNotificationService);
    });

    it('should reject review if order is NOT COMPLETED (e.g. DELIVERING, PENDING, CANCELLED)', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-1',
        status: OrderStatus.DELIVERING,
        review: null,
      });

      await expect(
        service.createOrderReview('user-1', 'ord-1', { overallRating: 5, content: 'Ngon tuyệt' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject review if user is not the order owner', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-other',
        status: OrderStatus.COMPLETED,
        review: null,
      });

      await expect(
        service.createOrderReview('user-1', 'ord-1', { overallRating: 5, content: 'Ngon tuyệt' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if order already has an OrderReview (Immutable, exactly once)', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-1',
        status: OrderStatus.COMPLETED,
        review: { id: 'rev-existing' },
      });

      await expect(
        service.createOrderReview('user-1', 'ord-1', { overallRating: 5, content: 'Đã gửi rồi' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if 14 days window has expired', async () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-1',
        userId: 'user-1',
        status: OrderStatus.COMPLETED,
        completedAt: fifteenDaysAgo,
        review: null,
      });

      await expect(
        service.createOrderReview('user-1', 'ord-1', { overallRating: 5, content: 'Hết hạn rồi' }),
      ).rejects.toThrow(GoneException);
    });

    it('should atomically create OrderReview, grant points, create PointTransaction, and dispatch reward notification', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      mockPrisma.order.findFirst.mockResolvedValue({
        id: 'ord-valid',
        orderCode: 'AVR-123456',
        userId: 'user-1',
        status: OrderStatus.COMPLETED,
        completedAt: threeDaysAgo,
        review: null,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        points: 100,
        membershipTierId: 'tier-1',
        membershipTier: { name: 'Thành viên Bạc' },
      });

      mockPrisma.pointTransaction.create.mockResolvedValue({
        id: 'tx-1',
        amount: 999,
        referenceCode: 'ORDER_REVIEW:ord-valid',
      });

      mockPrisma.orderReview.create.mockResolvedValue({
        id: 'rev-order-1',
        orderId: 'ord-valid',
        userId: 'user-1',
        overallRating: 5,
        content: 'Dịch vụ tuyệt vời',
        rewardPointsSnapshot: 999,
        rewardGranted: true,
      });

      mockPrisma.orderReview.findUnique.mockResolvedValue({
        id: 'rev-order-1',
        orderId: 'ord-valid',
        userId: 'user-1',
        overallRating: 5,
        content: 'Dịch vụ tuyệt vời',
        rewardPointsSnapshot: 999,
        rewardGranted: true,
        media: [],
        followUps: [],
        reply: null,
        pointTransaction: { id: 'tx-1', amount: 999 },
      });

      const result = await service.createOrderReview('user-1', 'ord-valid', {
        overallRating: 5,
        content: 'Dịch vụ tuyệt vời',
      });

      expect(result.success).toBe(true);

      // Verify points incremented
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            points: { increment: 999 },
          }),
        }),
      );

      // Verify PointTransaction created with source REWARD & referenceCode
      expect(mockPrisma.pointTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            amount: 999,
            source: PointTransactionSource.REWARD,
            referenceCode: 'ORDER_REVIEW:ord-valid',
          }),
        }),
      );

      // Verify reward notification sent
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          eventId: 'ORDER_REVIEW_REWARD:ord-valid:user-1',
          type: 'REWARD',
        }),
      );
    });

    it('should reject follow-up if 14 days expired', async () => {
      mockPrisma.orderReview.findUnique.mockResolvedValue({
        id: 'rev-1',
        userId: 'user-1',
        reviewExpiresAt: new Date(Date.now() - 1000), // expired
        followUps: [],
      });

      await expect(
        service.createFollowUp('user-1', 'rev-1', { content: 'Phản hồi muộn' }),
      ).rejects.toThrow(GoneException);
    });

    it('should allow append-only follow-up within 14 days with ZERO additional points', async () => {
      mockPrisma.orderReview.findUnique.mockResolvedValue({
        id: 'rev-1',
        userId: 'user-1',
        reviewExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days remaining
        followUps: [],
      });

      mockPrisma.orderReviewFollowUp.create.mockResolvedValue({
        id: 'fu-1',
        orderReviewId: 'rev-1',
        userId: 'user-1',
        content: 'Đóng gói rất kỹ, mình cảm ơn shop!',
      });

      mockPrisma.orderReviewFollowUp.findUnique.mockResolvedValue({
        id: 'fu-1',
        orderReviewId: 'rev-1',
        userId: 'user-1',
        content: 'Đóng gói rất kỹ, mình cảm ơn shop!',
        media: [],
      });

      const result = await service.createFollowUp('user-1', 'rev-1', {
        content: 'Đóng gói rất kỹ, mình cảm ơn shop!',
      });

      expect(result.success).toBe(true);
      // Ensure NO points granted for follow-up!
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.pointTransaction.create).not.toHaveBeenCalled();
    });
  });
});
