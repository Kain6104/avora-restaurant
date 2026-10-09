import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SaveDraftLayoutDto,
  PublishLayoutDto,
  CreateLayoutDto,
  FarmGardenLayoutStatus,
  FarmGardenObjectType,
  FarmGardenDisplayMode,
  FarmGardenDeviceMode,
} from './dto/farm-layout.dto';
import { FarmGateway } from './farm.gateway';

@Injectable()
export class FarmLayoutService {
  private readonly logger = new Logger(FarmLayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmGateway: FarmGateway,
  ) {}

  /**
   * Lấy bố cục đang được áp dụng chính thức (status: PUBLISHED) cho người dùng /farm
   * Tự động khởi tạo phiên bản mặc định nếu chưa có
   */
  async getActivePublishedLayout() {
    let publishedVersion = await this.prisma.farmGardenLayoutVersion.findFirst({
      where: { status: FarmGardenLayoutStatus.PUBLISHED },
      include: {
        layout: true,
        objects: {
          include: { asset: true },
          orderBy: { zIndex: 'asc' },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (!publishedVersion) {
      this.logger.log('Chưa tìm thấy bố cục PUBLISHED, tự động khởi tạo bố cục mặc định...');
      publishedVersion = await this.seedDefaultLayout();
    }

    return publishedVersion;
  }

  /**
   * Lấy danh sách tất cả các Layout và các phiên bản của từng Layout
   */
  async getLayoutList() {
    const layouts = await this.prisma.farmGardenLayout.findMany({
      include: {
        versions: {
          select: {
            id: true,
            version: true,
            status: true,
            revision: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            createdByUserId: true,
            publishedByUserId: true,
            _count: {
              select: { objects: true },
            },
          },
          orderBy: { version: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (layouts.length === 0) {
      await this.seedDefaultLayout();
      return this.getLayoutList();
    }

    return layouts;
  }

  /**
   * Lấy chi tiết toàn bộ một phiên bản Layout (kèm đối tượng và asset)
   */
  async getLayoutVersion(versionId: string) {
    const version = await this.prisma.farmGardenLayoutVersion.findUnique({
      where: { id: versionId },
      include: {
        layout: true,
        createdByUser: {
          select: { id: true, fullName: true, avatarUrl: true, email: true },
        },
        publishedByUser: {
          select: { id: true, fullName: true, avatarUrl: true, email: true },
        },
        objects: {
          include: { asset: true },
          orderBy: { zIndex: 'asc' },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản bố cục');
    }

    return version;
  }

  /**
   * Tạo một Layout mới
   */
  async createLayout(dto: CreateLayoutDto, userId: string) {
    const existing = await this.prisma.farmGardenLayout.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });
    if (existing) {
      throw new BadRequestException(`Mã bố cục "${dto.code}" đã tồn tại`);
    }

    const layout = await this.prisma.farmGardenLayout.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        name: dto.name.trim(),
        description: dto.description?.trim(),
      },
    });

    // Tạo phiên bản nháp version 1 ban đầu
    const firstVersion = await this.prisma.farmGardenLayoutVersion.create({
      data: {
        layoutId: layout.id,
        version: 1,
        status: FarmGardenLayoutStatus.DRAFT,
        revision: 0,
        createdByUserId: userId,
      },
    });

    return { layout, version: firstVersion };
  }

  /**
   * Tạo phiên bản mới bằng cách nhân bản một phiên bản hiện có
   * Giữ nguyên objectKey, tạo id mới và ánh xạ lại parentId chính xác
   */
  async duplicateVersion(sourceVersionId: string, userId: string) {
    const source = await this.prisma.farmGardenLayoutVersion.findUnique({
      where: { id: sourceVersionId },
      include: { objects: true },
    });

    if (!source) {
      throw new NotFoundException('Không tìm thấy phiên bản nguồn để nhân bản');
    }

    // Tìm version cao nhất hiện tại của layout này
    const maxVer = await this.prisma.farmGardenLayoutVersion.findFirst({
      where: { layoutId: source.layoutId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersionNum = (maxVer?.version || 1) + 1;

    return this.prisma.$transaction(async (tx) => {
      const newVersion = await tx.farmGardenLayoutVersion.create({
        data: {
          layoutId: source.layoutId,
          version: nextVersionNum,
          status: FarmGardenLayoutStatus.DRAFT,
          revision: 0,
          createdByUserId: userId,
        },
      });

      // Ánh xạ id cũ sang id mới để duy trì quan hệ parentId
      const oldIdToNewId = new Map<string, string>();

      // Bước 1: Tạo các object với parentId tạm thời là null
      for (const obj of source.objects) {
        const created = await tx.farmGardenObject.create({
          data: {
            objectKey: obj.objectKey,
            layoutVersionId: newVersion.id,
            objectType: obj.objectType,
            assetId: obj.assetId,
            plotIndex: obj.plotIndex,
            name: obj.name,
            positionX: obj.positionX,
            positionY: obj.positionY,
            width: obj.width,
            height: obj.height,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            rotation: obj.rotation,
            opacity: obj.opacity,
            zIndex: obj.zIndex,
            anchorX: obj.anchorX,
            anchorY: obj.anchorY,
            flipX: obj.flipX,
            flipY: obj.flipY,
            isVisible: obj.isVisible,
            isLocked: obj.isLocked,
            displayMode: obj.displayMode,
            deviceMode: obj.deviceMode,
            animationConfig: (obj.animationConfig as any) ?? undefined,
            styleConfig: (obj.styleConfig as any) ?? undefined,
            startAt: obj.startAt,
            endAt: obj.endAt,
          },
        });
        oldIdToNewId.set(obj.id, created.id);
      }

      // Bước 2: Cập nhật lại parentId theo ánh xạ mới
      for (const obj of source.objects) {
        if (obj.parentId && oldIdToNewId.has(obj.parentId)) {
          const newObjId = oldIdToNewId.get(obj.id);
          const newParentId = oldIdToNewId.get(obj.parentId);
          if (newObjId && newParentId) {
            await tx.farmGardenObject.update({
              where: { id: newObjId },
              data: { parentId: newParentId },
            });
          }
        }
      }

      return newVersion;
    });
  }

  /**
   * Lưu Bản Nháp (Save Draft) kèm cơ chế Optimistic Locking qua revision
   */
  async saveDraft(
    versionId: string,
    dto: SaveDraftLayoutDto,
    userId: string,
    ipAddress?: string,
  ) {
    const version = await this.prisma.farmGardenLayoutVersion.findUnique({
      where: { id: versionId },
      include: { objects: true },
    });

    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản bố cục');
    }

    // 1. Kiểm tra xung đột ghi đè đồng thời (Optimistic Lock)
    if (version.revision !== dto.revision) {
      throw new ConflictException(
        `Xung đột chỉnh sửa: Bố cục đã được Quản trị viên khác lưu (Revision hiện tại: ${version.revision}, Revision của bạn: ${dto.revision}). Vui lòng tải lại để hợp nhất!`,
      );
    }

    const nextRevision = version.revision + 1;

    return this.prisma.$transaction(async (tx) => {
      // 2. Xóa các object cũ của version này để cập nhật bộ object mới
      await tx.farmGardenObject.deleteMany({
        where: { layoutVersionId: versionId },
      });

      // 3. Tạo mới các objects (bước 1 không gán parentId để tránh ràng buộc ngoại)
      const clientKeyToCreatedId = new Map<string, string>();

      for (const obj of dto.objects) {
        const created = await tx.farmGardenObject.create({
          data: {
            objectKey: obj.objectKey,
            layoutVersionId: versionId,
            objectType: obj.objectType,
            assetId: obj.assetId || null,
            plotIndex: obj.plotIndex !== undefined && obj.plotIndex !== null ? Number(obj.plotIndex) : null,
            name: obj.name || null,
            positionX: Number(obj.positionX),
            positionY: Number(obj.positionY),
            width: Number(obj.width),
            height: Number(obj.height),
            scaleX: obj.scaleX !== undefined ? Number(obj.scaleX) : 1.0,
            scaleY: obj.scaleY !== undefined ? Number(obj.scaleY) : 1.0,
            rotation: obj.rotation !== undefined ? Number(obj.rotation) : 0.0,
            opacity: obj.opacity !== undefined ? Number(obj.opacity) : 1.0,
            zIndex: obj.zIndex !== undefined ? Math.round(Number(obj.zIndex)) : 0,
            anchorX: obj.anchorX !== undefined ? Number(obj.anchorX) : 0.5,
            anchorY: obj.anchorY !== undefined ? Number(obj.anchorY) : 1.0,
            flipX: Boolean(obj.flipX),
            flipY: Boolean(obj.flipY),
            isVisible: obj.isVisible !== undefined ? Boolean(obj.isVisible) : true,
            isLocked: Boolean(obj.isLocked),
            displayMode: obj.displayMode || FarmGardenDisplayMode.ALWAYS,
            deviceMode: obj.deviceMode || FarmGardenDeviceMode.ALL,
            animationConfig: (obj.animationConfig as any) ?? undefined,
            styleConfig: (obj.styleConfig as any) ?? undefined,
            startAt: obj.startAt ? new Date(obj.startAt) : null,
            endAt: obj.endAt ? new Date(obj.endAt) : null,
          },
        });

        // Ghi nhận id theo objectKey và theo id cũ nếu có
        clientKeyToCreatedId.set(obj.objectKey, created.id);
        if (obj.id) {
          clientKeyToCreatedId.set(obj.id, created.id);
        }
      }

      // 4. Cập nhật parentId theo quan hệ cha-con
      for (const obj of dto.objects) {
        if (obj.parentId) {
          const newObjId = clientKeyToCreatedId.get(obj.objectKey) || (obj.id ? clientKeyToCreatedId.get(obj.id) : null);
          const newParentId = clientKeyToCreatedId.get(obj.parentId);
          if (newObjId && newParentId && newObjId !== newParentId) {
            await tx.farmGardenObject.update({
              where: { id: newObjId },
              data: { parentId: newParentId },
            });
          }
        }
      }

      // 5. Cập nhật revision cho phiên bản
      const updatedVersion = await tx.farmGardenLayoutVersion.update({
        where: { id: versionId },
        data: { revision: nextRevision },
        include: {
          objects: {
            include: { asset: true },
            orderBy: { zIndex: 'asc' },
          },
        },
      });

      // 6. Ghi nhật ký quản trị AuditLog
      await tx.auditLog.create({
        data: {
          userId,
          action: 'FARM_LAYOUT_UPDATE',
          target: `LayoutVersion:${versionId}:Rev${nextRevision}`,
          oldValue: JSON.stringify({ objectCount: version.objects.length, revision: version.revision }),
          newValue: JSON.stringify({ objectCount: dto.objects.length, revision: nextRevision }),
          ipAddress,
        },
      });

      // Nếu phiên bản đang sửa chính là phiên bản PUBLISHED, phát sóng ngay cho client
      if (version.status === FarmGardenLayoutStatus.PUBLISHED) {
        try {
          this.farmGateway.emitLayoutUpdated(updatedVersion);
        } catch (err) {}
      }

      return updatedVersion;
    });
  }

  /**
   * Xuất bản (Publish Layout) trong transaction
   * Đảm bảo chỉ có 1 phiên bản PUBLISHED duy nhất
   * Gửi sự kiện realtime qua WebSocket mà không làm mất cây của người chơi
   */
  async publish(
    versionId: string,
    dto: PublishLayoutDto,
    userId: string,
    ipAddress?: string,
  ) {
    const version = await this.prisma.farmGardenLayoutVersion.findUnique({
      where: { id: versionId },
      include: {
        layout: true,
        objects: {
          include: { asset: true },
          orderBy: { zIndex: 'asc' },
        },
      },
    });

    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản bố cục cần xuất bản');
    }

    if (version.revision !== dto.revision) {
      throw new ConflictException(
        `Không thể xuất bản: Revision đã thay đổi (${version.revision} vs ${dto.revision}). Vui lòng tải lại và kiểm tra lại!`,
      );
    }

    const nextRevision = version.revision + 1;

    const published = await this.prisma.$transaction(async (tx) => {
      // 1. Chuyển phiên bản PUBLISHED cũ thành ARCHIVED
      await tx.farmGardenLayoutVersion.updateMany({
        where: {
          layoutId: version.layoutId,
          status: FarmGardenLayoutStatus.PUBLISHED,
          id: { not: versionId },
        },
        data: { status: FarmGardenLayoutStatus.ARCHIVED },
      });

      // 2. Chuyển phiên bản hiện tại thành PUBLISHED
      const updated = await tx.farmGardenLayoutVersion.update({
        where: { id: versionId },
        data: {
          status: FarmGardenLayoutStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedByUserId: userId,
          revision: nextRevision,
        },
        include: {
          layout: true,
          objects: {
            include: { asset: true },
            orderBy: { zIndex: 'asc' },
          },
        },
      });

      // 3. Ghi AuditLog
      await tx.auditLog.create({
        data: {
          userId,
          action: 'FARM_LAYOUT_PUBLISH',
          target: `LayoutVersion:${versionId}:V${version.version}`,
          oldValue: JSON.stringify({ previousStatus: version.status }),
          newValue: JSON.stringify({
            status: FarmGardenLayoutStatus.PUBLISHED,
            version: version.version,
            objectCount: version.objects.length,
            publishedAt: updated.publishedAt,
          }),
          ipAddress,
        },
      });

      return updated;
    });

    // 4. Phát sóng sự kiện WebSocket cho toàn bộ client đang mở /farm
    try {
      this.farmGateway.emitLayoutUpdated(published);
      this.logger.log(`Đã phát sự kiện WebSocket FARM_LAYOUT_UPDATED cho phiên bản ${version.version}`);
    } catch (err) {
      this.logger.warn('Lỗi khi phát broadcast FARM_LAYOUT_UPDATED qua socket:', err);
    }

    return published;
  }

  /**
   * Khôi phục (Rollback) về một phiên bản cũ
   */
  async rollback(
    versionId: string,
    targetVersionId: string,
    userId: string,
    ipAddress?: string,
  ) {
    const targetVersion = await this.prisma.farmGardenLayoutVersion.findUnique({
      where: { id: targetVersionId },
      include: { objects: true },
    });

    if (!targetVersion) {
      throw new NotFoundException('Không tìm thấy phiên bản mục tiêu để khôi phục');
    }

    // Tạo một phiên bản DRAFT mới từ targetVersion
    const duplicated = await this.duplicateVersion(targetVersionId, userId);

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'FARM_LAYOUT_ROLLBACK',
        target: `LayoutVersion:${versionId} -> ${targetVersionId}`,
        oldValue: JSON.stringify({ currentVersionId: versionId }),
        newValue: JSON.stringify({ restoredFromVersionId: targetVersionId, newDraftVersionId: duplicated.id }),
        ipAddress,
      },
    });

    return duplicated;
  }

  /**
   * Kiểm tra mức độ an toàn của ô đất: Đếm số nông trại đang trồng cây trên plotIndex này
   */
  async checkPlotUsage(plotIndex: number) {
    const numPlot = Number(plotIndex);
    const activeCropsCount = await this.prisma.farmPlot.count({
      where: {
        plotIndex: numPlot,
        cropInstanceId: { not: null },
      },
    });

    const totalFarmsWithPlotUnlocked = await this.prisma.farmPlot.count({
      where: {
        plotIndex: numPlot,
      },
    });

    return {
      plotIndex: numPlot,
      activeCropsCount,
      totalFarmsWithPlotUnlocked,
      isSafeToDelete: activeCropsCount === 0,
    };
  }

  /**
   * Xóa một đối tượng khỏi layout với quy tắc bảo vệ ô đất
   */
  async deleteObject(objectId: string, userId: string) {
    const obj = await this.prisma.farmGardenObject.findUnique({
      where: { id: objectId },
    });

    if (!obj) {
      throw new NotFoundException('Không tìm thấy đối tượng cần xóa');
    }

    // Nếu là ô đất, kiểm tra có ai đang trồng cây không
    if (obj.objectType === FarmGardenObjectType.PLOT && obj.plotIndex !== null) {
      const usage = await this.checkPlotUsage(obj.plotIndex);
      if (!usage.isSafeToDelete) {
        throw new BadRequestException(
          `Không thể xóa ô đất #${obj.plotIndex} vì hiện đang có ${usage.activeCropsCount} nông trại đang trồng cây! Vui lòng chọn ẩn (isVisible = false) hoặc đợi thu hoạch.`,
        );
      }
    }

    await this.prisma.farmGardenObject.delete({ where: { id: objectId } });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'FARM_LAYOUT_DELETE_OBJECT',
        target: `FarmGardenObject:${objectId}:${obj.objectKey}`,
        oldValue: JSON.stringify(obj),
      },
    });

    return { success: true, message: 'Đã xóa đối tượng thành công' };
  }

  /**
   * Khởi tạo bố cục mặc định ban đầu (Seeder)
   * 25 ô đất Isometric chuẩn + Cây Thần AVORA
   */
  private async seedDefaultLayout() {
    const defaultLayout = await this.prisma.farmGardenLayout.upsert({
      where: { code: 'DEFAULT_ISLAND' },
      update: {},
      create: {
        code: 'DEFAULT_ISLAND',
        name: 'Đảo Tiên AVORA Hoàng Gia',
        description: 'Bố cục mặc định 25 ô đất hữu cơ và Cây Thần Cổ Thụ AVORA',
      },
    });

    // Tạo phiên bản 1 PUBLISHED
    const systemAdmin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const defaultUserId = systemAdmin?.id || 'system_auto_seed';

    const version = await this.prisma.farmGardenLayoutVersion.create({
      data: {
        layoutId: defaultLayout.id,
        version: 1,
        status: FarmGardenLayoutStatus.PUBLISHED,
        revision: 1,
        createdByUserId: defaultUserId,
        publishedByUserId: defaultUserId,
        publishedAt: new Date(),
      },
    });

    // Tọa độ chuẩn của lưới 5x5 ô đất (Đồng bộ với FarmWorldLayoutConfig.ts)
    const GRID_SIZE = 5;
    const originX = -280;
    const originY = -35;
    const TILE_WIDTH = 304;
    const TILE_HEIGHT = 156;

    const plotObjects: any[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const plotIndex = row * GRID_SIZE + col;
        const x = originX + (col - row) * (TILE_WIDTH / 2);
        const y = originY + (col + row) * (TILE_HEIGHT / 2);
        const zIndex = Math.round(y * 10);

        plotObjects.push({
          objectKey: `plot_${plotIndex}`,
          layoutVersionId: version.id,
          objectType: FarmGardenObjectType.PLOT,
          plotIndex,
          name: `Ô đất #${plotIndex + 1}`,
          positionX: x,
          positionY: y,
          width: 264,
          height: 168,
          scaleX: 1.0,
          scaleY: 1.0,
          rotation: 0,
          opacity: 1.0,
          zIndex,
          anchorX: 0.5,
          anchorY: 0.45,
          isVisible: true,
          isLocked: false,
          displayMode: FarmGardenDisplayMode.ALWAYS,
          deviceMode: FarmGardenDeviceMode.ALL,
        });
      }
    }

    // Hero Object: Cây Thần AVORA
    const treeObject = {
      objectKey: 'prop_avora_tree',
      layoutVersionId: version.id,
      objectType: FarmGardenObjectType.TREE,
      name: 'Cây Thần AVORA',
      positionX: 310,
      positionY: 60,
      width: 412,
      height: 550,
      scaleX: 0.532,
      scaleY: 0.532,
      rotation: 0,
      opacity: 1.0,
      zIndex: 720,
      anchorX: 0.5,
      anchorY: 0.90,
      isVisible: true,
      isLocked: false,
      displayMode: FarmGardenDisplayMode.ALWAYS,
      deviceMode: FarmGardenDeviceMode.ALL,
      animationConfig: {
        preset: 'SWAY',
        staticBaseEnabled: true,
        staticBaseRatio: 0.28,
        swayPivotX: 0.5,
        swayPivotY: 1.0,
        duration: 3800,
        rotationAmplitude: 0.45,
      },
    };

    await this.prisma.farmGardenObject.createMany({
      data: [...plotObjects, treeObject],
    });

    return this.prisma.farmGardenLayoutVersion.findUnique({
      where: { id: version.id },
      include: {
        layout: true,
        objects: {
          include: { asset: true },
          orderBy: { zIndex: 'asc' },
        },
      },
    }) as any;
  }
}
