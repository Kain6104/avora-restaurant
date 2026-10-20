import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationEngineService } from '../notification/notification-engine.service';
import {
  ReservationStatus,
  ReservationSource,
  TableOperationalStatus,
  RoleType,
} from '@prisma/client';
import {
  RESERVATION_ERRORS,
  ReservationBusinessException,
} from './reservation.errors';
import {
  normalizePhone,
  parseDateTimeVN,
  formatDateVN,
  formatTimeVN,
  generateReservationCode,
  generateCheckInToken,
  isTimeOverlapping,
  maskPhone,
  RESTAURANT_TIMEZONE,
} from './utils/reservation-time.util';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  UpdateReservationCustomerDto,
  AdminUpdateReservationDto,
} from './dto/update-reservation.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateWalkInDto } from './dto/walk-in.dto';

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  /**
   * Danh sách chi nhánh phục vụ đặt bàn
   */
  async getBranches() {
    return this.prisma.branch.findMany({
      select: {
        id: true,
        name: true,
        branchCode: true,
        street: true,
        ward: true,
        district: true,
        province: true,
        phone: true,
        openTime: true,
        closeTime: true,
        latitude: true,
        longitude: true,
        reservationEnabled: true,
        reservationDurationMinutes: true,
        reservationBufferMinutes: true,
        reservationSlotMinutes: true,
        minPartySize: true,
        maxPartySize: true,
        advanceBookingDays: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // =========================================================================
  // 1. AVAILABILITY ENGINE
  // =========================================================================

  async getAvailability(query: AvailabilityQueryDto) {
    const { branchId, date, partySize = 2 } = query;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        restaurantTables: {
          where: { isActive: true },
          include: { area: true },
        },
      },
    });

    if (!branch) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.BRANCH_NOT_FOUND,
        'Chi nhánh không tồn tại',
      );
    }

    if (!branch.reservationEnabled) {
      return {
        branchId,
        branchName: branch.name,
        date,
        partySize,
        isOpen: false,
        message: 'Chi nhánh hiện đang tạm ngưng nhận đặt bàn trực tuyến',
        slots: [],
      };
    }

    // Party size constraints
    if (partySize < branch.minPartySize) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.PARTY_TOO_SMALL,
        `Số lượng khách tối thiểu là ${branch.minPartySize} người`,
      );
    }
    if (partySize > branch.maxPartySize) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.PARTY_TOO_LARGE,
        `Số lượng khách trực tuyến tối đa là ${branch.maxPartySize} người. Vui lòng liên hệ trực tiếp hotline để đặt tiệc lớn.`,
      );
    }

    // Check advance booking days
    const queryDateObj = new Date(`${date}T00:00:00+07:00`);
    const todayVN = new Date(new Date().toLocaleString('en-US', { timeZone: RESTAURANT_TIMEZONE }));
    todayVN.setHours(0, 0, 0, 0);

    const diffDays = Math.round((queryDateObj.getTime() - todayVN.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 0) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.TOO_LATE,
        'Không thể đặt bàn cho ngày trong quá khứ',
      );
    }
    if (diffDays > branch.advanceBookingDays) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.TOO_FAR_IN_ADVANCE,
        `Chỉ có thể đặt trước tối đa ${branch.advanceBookingDays} ngày`,
      );
    }

    // Check Special Hours
    const specialHours = await this.prisma.branchSpecialHours.findUnique({
      where: {
        branchId_date: {
          branchId,
          date: queryDateObj,
        },
      },
    });

    if (specialHours?.isClosed) {
      return {
        branchId,
        branchName: branch.name,
        date,
        partySize,
        isOpen: false,
        message: specialHours.note || 'Chi nhánh đóng cửa vào ngày này theo lịch đặc biệt',
        slots: [],
      };
    }

    const openTimeStr = specialHours?.openTime || branch.openTime || '10:00';
    const closeTimeStr = specialHours?.closeTime || branch.closeTime || '22:00';

    // Parse open/close minutes
    const [openH, openM] = openTimeStr.split(':').map(Number);
    const [closeH, closeM] = closeTimeStr.split(':').map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    const slotMinutes = branch.reservationSlotMinutes || 30;
    const durationMinutes = branch.reservationDurationMinutes || 90;
    const bufferMinutes = branch.reservationBufferMinutes || 15;

    // Fetch existing reservations on this date
    // Query range in UTC covering the whole VN day
    const dayStartUTC = new Date(`${date}T00:00:00+07:00`);
    const dayEndUTC = new Date(`${date}T23:59:59+07:00`);

    const existingReservations = await this.prisma.reservation.findMany({
      where: {
        branchId,
        startAt: { gte: new Date(dayStartUTC.getTime() - 4 * 3600 * 1000) }, // allow overlap from late night
        endAt: { lte: new Date(dayEndUTC.getTime() + 4 * 3600 * 1000) },
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED] },
      },
      include: {
        tables: {
          include: { table: true },
        },
      },
    });

    // Fetch reservation blocks
    const reservationBlocks = await this.prisma.reservationBlock.findMany({
      where: {
        branchId,
        startAt: { lte: dayEndUTC },
        endAt: { gte: dayStartUTC },
      },
    });

    const now = new Date();
    const minAdvanceMs = (branch.minAdvanceMinutes || 60) * 60 * 1000;

    const slots: Array<{
      time: string;
      status: string;
      remainingCapacity: number;
      reason?: string;
    }> = [];
    const activeTables = branch.restaurantTables.filter(
      (t) => t.status === TableOperationalStatus.ACTIVE,
    );
    const totalPhysicalCapacity = activeTables.reduce((sum, t) => sum + t.capacity, 0) || branch.capacity;

    // Generate slots
    for (let m = openMinutes; m + durationMinutes <= closeMinutes; m += slotMinutes) {
      const slotHour = Math.floor(m / 60);
      const slotMin = m % 60;
      const timeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

      const slotStartUTC = parseDateTimeVN(date, timeStr);
      const slotEndUTC = new Date(slotStartUTC.getTime() + durationMinutes * 60 * 1000);

      // Check if slot is too soon in the past/lead time
      if (slotStartUTC.getTime() - now.getTime() < minAdvanceMs) {
        slots.push({
          time: timeStr,
          status: 'PAST',
          remainingCapacity: 0,
          reason: 'Đã qua khung giờ đặt trước',
        });
        continue;
      }

      // Check block
      const fullBlock = reservationBlocks.find(
        (b) =>
          b.blockType === 'FULL_BLOCK' &&
          isTimeOverlapping(slotStartUTC, slotEndUTC, b.startAt, b.endAt),
      );
      if (fullBlock) {
        slots.push({
          time: timeStr,
          status: 'FULL',
          remainingCapacity: 0,
          reason: fullBlock.reason || 'Khu vực hoặc chi nhánh tạm thời bị khóa',
        });
        continue;
      }

      // Calculate capacity blocked
      const capacityBlocks = reservationBlocks.filter(
        (b) =>
          b.blockType === 'CAPACITY_BLOCK' &&
          isTimeOverlapping(slotStartUTC, slotEndUTC, b.startAt, b.endAt),
      );
      const blockedCapacitySum = capacityBlocks.reduce(
        (sum, b) => sum + (b.blockedCapacity || 0),
        0,
      );

      const effectiveTotalCapacity = Math.max(0, totalPhysicalCapacity - blockedCapacitySum);

      // Check overlapping reservations
      const overlappingReservations = existingReservations.filter((r) =>
        r.startAt && r.endAt
          ? isTimeOverlapping(slotStartUTC, slotEndUTC, r.startAt, r.endAt, bufferMinutes)
          : false,
      );

      const bookedCapacity = overlappingReservations.reduce((sum, r) => sum + r.partySize, 0);
      const remainingCapacity = Math.max(0, effectiveTotalCapacity - bookedCapacity);

      // Table Assignment Mode availability
      let hasFittingTable = true;
      if (activeTables.length > 0) {
        const occupiedTableIds = new Set<string>();
        for (const r of overlappingReservations) {
          for (const rt of r.tables) {
            occupiedTableIds.add(rt.tableId);
          }
        }

        const freeTables = activeTables.filter((t) => !occupiedTableIds.has(t.id));

        // Check if single table fits
        const singleFit = freeTables.some((t) => t.capacity >= partySize);

        // Check if combination of 2 tables in same area fits
        let comboFit = false;
        if (!singleFit && partySize <= 16) {
          const areaGroups = new Map<string, typeof freeTables>();
          for (const t of freeTables) {
            const areaKey = t.areaId || 'DEFAULT';
            if (!areaGroups.has(areaKey)) areaGroups.set(areaKey, []);
            areaGroups.get(areaKey)!.push(t);
          }

          for (const [_, tablesInArea] of areaGroups) {
            for (let i = 0; i < tablesInArea.length; i++) {
              for (let j = i + 1; j < tablesInArea.length; j++) {
                if (tablesInArea[i].capacity + tablesInArea[j].capacity >= partySize) {
                  comboFit = true;
                  break;
                }
              }
              if (comboFit) break;
            }
            if (comboFit) break;
          }
        }

        hasFittingTable = singleFit || comboFit;
      }

      if (remainingCapacity < partySize || !hasFittingTable) {
        slots.push({
          time: timeStr,
          status: 'FULL',
          remainingCapacity: 0,
        });
      } else if (remainingCapacity < partySize * 2) {
        slots.push({
          time: timeStr,
          status: 'LIMITED',
          remainingCapacity,
        });
      } else {
        slots.push({
          time: timeStr,
          status: 'AVAILABLE',
          remainingCapacity,
        });
      }
    }

    return {
      branchId,
      branchName: branch.name,
      date,
      partySize,
      isOpen: true,
      durationMinutes,
      bufferMinutes,
      slots,
    };
  }

  // =========================================================================
  // 2. CONCURRENCY ENGINE & PESSIMISTIC LOCKING
  // =========================================================================

  async createReservation(
    dto: CreateReservationDto,
    userId?: string,
    actorRole: string = 'USER',
  ) {
    const { branchId, reservationDate, reservationTime, partySize } = dto;
    const cleanPhone = normalizePhone(dto.customerPhone);

    if (!cleanPhone || cleanPhone.length < 9) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.INVALID_PHONE,
        'Số điện thoại không hợp lệ',
      );
    }

    // Auto-link with registered user if userId was not extracted from session
    if (!userId) {
      const matchedUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(cleanPhone ? [{ phone: cleanPhone }] : []),
            ...(dto.customerEmail ? [{ email: dto.customerEmail.trim() }] : []),
          ],
        },
        select: { id: true },
      });
      if (matchedUser) {
        userId = matchedUser.id;
      }
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        restaurantTables: {
          where: { isActive: true },
          include: { area: true },
        },
      },
    });

    if (!branch) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.BRANCH_NOT_FOUND,
        'Chi nhánh không tồn tại',
      );
    }

    if (!branch.reservationEnabled) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.DISABLED,
        'Chi nhánh hiện đang tạm ngưng nhận đặt bàn',
      );
    }

    // Party size validation
    if (partySize < branch.minPartySize) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.PARTY_TOO_SMALL,
        `Số lượng khách tối thiểu là ${branch.minPartySize}`,
      );
    }
    if (partySize > branch.maxPartySize) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.PARTY_TOO_LARGE,
        `Số lượng khách tối đa cho đặt bàn trực tuyến là ${branch.maxPartySize}`,
      );
    }

    const startAt = parseDateTimeVN(reservationDate, reservationTime);
    const durationMinutes = branch.reservationDurationMinutes || 90;
    const bufferMinutes = branch.reservationBufferMinutes || 15;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

    const now = new Date();
    const minAdvanceMs = (branch.minAdvanceMinutes || 60) * 60 * 1000;

    if (actorRole === 'USER' && startAt.getTime() - now.getTime() < minAdvanceMs) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.TOO_LATE,
        `Vui lòng đặt trước ít nhất ${branch.minAdvanceMinutes} phút`,
      );
    }

    const slotKey = `${reservationDate}_${reservationTime}`;

    // 1. Ensure ReservationSlotLock row exists before transaction to prevent gap-lock deadlocks
    try {
      await this.prisma.reservationSlotLock.upsert({
        where: {
          branchId_slotKey: {
            branchId,
            slotKey,
          },
        },
        create: {
          branchId,
          slotKey,
          currentBookedCapacity: 0,
        },
        update: {},
      });
    } catch {
      // Ignored: if created concurrently, the row exists now and FOR UPDATE will serialize
    }

    // Execute with MySQL Pessimistic Row Lock inside $transaction
    return this.prisma.$transaction(
      async (tx) => {
        // 2. Lock the specific slot row with SELECT ... FOR UPDATE (serializes all concurrent bookings for this slot)
        await tx.$queryRawUnsafe(
          `SELECT id, currentBookedCapacity FROM ReservationSlotLock WHERE branchId = ? AND slotKey = ? FOR UPDATE`,
          branchId,
          slotKey,
        );

        // 3. Re-check capacity & overlapping inside lock
        const activeTables = branch.restaurantTables.filter(
          (t) => t.status === TableOperationalStatus.ACTIVE,
        );
        const totalCapacity = activeTables.reduce((sum, t) => sum + t.capacity, 0) || branch.capacity;

        // Check blocks
        const overlappingBlock = await tx.reservationBlock.findFirst({
          where: {
            branchId,
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            blockType: 'FULL_BLOCK',
          },
        });
        if (overlappingBlock) {
          throw new ReservationBusinessException(
            RESERVATION_ERRORS.SLOT_FULL,
            overlappingBlock.reason || 'Khung giờ này đã bị khóa',
          );
        }

        // Overlapping reservations
        const overlappingReservations = await tx.reservation.findMany({
          where: {
            branchId,
            startAt: { lt: new Date(endAt.getTime() + bufferMinutes * 60 * 1000) },
            endAt: { gt: new Date(startAt.getTime() - bufferMinutes * 60 * 1000) },
            status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED] },
          },
          include: {
            tables: true,
          },
        });

        const bookedCapacity = overlappingReservations.reduce((sum, r) => sum + r.partySize, 0);
        if (bookedCapacity + partySize > totalCapacity) {
          throw new ReservationBusinessException(
            RESERVATION_ERRORS.SLOT_FULL,
            'Khung giờ này vừa hết chỗ do có khách khác đặt trước',
          );
        }

        // 4. Best-Fit Table Assignment Algorithm
        const assignedTableIds: string[] = [];
        if (activeTables.length > 0) {
          const occupiedTableIds = new Set<string>();
          for (const r of overlappingReservations) {
            for (const rt of r.tables) {
              occupiedTableIds.add(rt.tableId);
            }
          }

          const freeTables = activeTables.filter((t) => !occupiedTableIds.has(t.id));

          // Candidates that fit the party
          const candidateTables = freeTables.filter((t) => t.capacity >= partySize);

          if (candidateTables.length > 0) {
            // Sort: 1) Preference match, 2) Minimal unused seats (capacity - partySize ASC), 3) minCapacity ASC
            candidateTables.sort((a, b) => {
              const pref = dto.seatingPreference?.toLowerCase();
              const aMatch = pref && a.area?.name.toLowerCase().includes(pref) ? -1 : 0;
              const bMatch = pref && b.area?.name.toLowerCase().includes(pref) ? -1 : 0;
              if (aMatch !== bMatch) return aMatch - bMatch;

              const diffA = a.capacity - partySize;
              const diffB = b.capacity - partySize;
              if (diffA !== diffB) return diffA - diffB;

              return a.minCapacity - b.minCapacity;
            });

            assignedTableIds.push(candidateTables[0].id);
          } else {
            // Check combo of 2 tables in the same area
            let bestPair: [string, string] | null = null;
            let minPairDiff = Infinity;

            const areaGroups = new Map<string, typeof freeTables>();
            for (const t of freeTables) {
              const areaKey = t.areaId || 'DEFAULT';
              if (!areaGroups.has(areaKey)) areaGroups.set(areaKey, []);
              areaGroups.get(areaKey)!.push(t);
            }

            for (const [_, tablesInArea] of areaGroups) {
              for (let i = 0; i < tablesInArea.length; i++) {
                for (let j = i + 1; j < tablesInArea.length; j++) {
                  const comboCap = tablesInArea[i].capacity + tablesInArea[j].capacity;
                  if (comboCap >= partySize) {
                    const diff = comboCap - partySize;
                    if (diff < minPairDiff) {
                      minPairDiff = diff;
                      bestPair = [tablesInArea[i].id, tablesInArea[j].id];
                    }
                  }
                }
              }
            }

            if (bestPair) {
              assignedTableIds.push(...bestPair);
            } else if (branch.reservationMode === 'TABLE') {
              throw new ReservationBusinessException(
                RESERVATION_ERRORS.TABLE_UNAVAILABLE,
                'Không còn bàn trống phù hợp cho số lượng khách này',
              );
            }
          }
        }

        // 5. Generate Code & Token
        const reservationCode = generateReservationCode(startAt);
        const checkInToken = generateCheckInToken();

        // 6. Create Reservation
        const reservation = await tx.reservation.create({
          data: {
            reservationCode,
            userId: userId || null,
            branchId,
            customerName: dto.customerName.trim(),
            customerPhone: cleanPhone,
            customerEmail: dto.customerEmail?.trim() || null,
            startAt,
            endAt,
            // Legacy sync
            reservationDate: new Date(`${reservationDate}T00:00:00+07:00`),
            reservationTime,
            partySize,
            tablePreference: dto.seatingPreference || null,
            occasion: dto.occasion || null,
            seatingPreference: dto.seatingPreference || null,
            specialRequests: dto.specialRequests || null,
            source: dto.source || ReservationSource.WEB,
            status: ReservationStatus.CONFIRMED, // Standard web bookings auto-confirm if slot available
            checkInToken,
            idempotencyKey: dto.idempotencyKey || null,
          },
        });

        // 7. Link ReservationTable
        for (const tableId of assignedTableIds) {
          await tx.reservationTable.create({
            data: {
              reservationId: reservation.id,
              tableId,
            },
          });
        }

        // 8. Update Lock Booked Capacity
        await tx.reservationSlotLock.update({
          where: {
            branchId_slotKey: {
              branchId,
              slotKey,
            },
          },
          data: {
            currentBookedCapacity: bookedCapacity + partySize,
          },
        });

        // 9. Create AuditLog (if authenticated user)
        if (userId) {
          await tx.auditLog.create({
            data: {
              userId,
              action: 'CREATE_RESERVATION',
              target: `Reservation:${reservation.id}`,
              newValue: JSON.stringify({
                code: reservationCode,
                branchId,
                startAt: startAt.toISOString(),
                partySize,
                tableIds: assignedTableIds,
              }),
            },
          });
        }

        return {
          ...reservation,
          assignedTableIds,
        };
      },
      { timeout: 10000 },
    ).then(async (res) => {
      // Async notification outside transaction
      if (userId) {
        try {
          await this.notificationService.createNotification({
            userId,
            title: 'Đặt bàn thành công tại AVORA',
            content: `Mã đặt bàn của bạn là ${res.reservationCode} tại ${branch.name} vào ${reservationTime} ngày ${reservationDate}.`,
            type: 'RESERVATION',
            referenceId: res.id,
            url: `/profile/reservations/${res.reservationCode}`,
          });
        } catch (e) {
          this.logger.error('Failed to send notification for reservation:', e);
        }
      }

      // Gửi thông báo tới nhân viên chi nhánh qua NotificationEngine
      try {
        await this.notificationEngine.publishEvent({
          eventType: 'RESERVATION_CREATED',
          category: 'RESERVATION',
          priority: 1, // NORMAL
          branchId: branch.id,
          entityId: res.id,
          title: 'Đặt bàn mới',
          message: `Có yêu cầu đặt bàn mới #${res.reservationCode} cho ${res.partySize} khách lúc ${reservationTime} ${reservationDate} tại ${branch.name}.`,
          actor: {
            id: userId,
            name: (res as any).customerName || 'Khách hàng',
          },
          reference: {
            type: 'RESERVATION',
            id: res.id,
            url: `/admin/reservations?id=${res.id}`,
          },
          metadata: {
            reservationId: res.id,
            reservationCode: res.reservationCode,
            partySize: res.partySize,
            reservationTime,
            reservationDate,
            branchId: branch.id,
          },
          requiredPermissions: ['reservations.view'],
          appScopes: ['ADMIN', 'POS'],
          legacyType: 'RESERVATION',
        });
      } catch (engineErr) {
        this.logger.error('Error publishing RESERVATION_CREATED event:', engineErr);
      }

      return res;
    });
  }

  // =========================================================================
  // 3. WALK-IN CREATION (QUICK SEATING AT COUNTER)
  // =========================================================================

  async createWalkIn(dto: CreateWalkInDto, staffUserId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branchId },
      include: {
        restaurantTables: { where: { isActive: true } },
      },
    });
    if (!branch) {
      throw new ReservationBusinessException(RESERVATION_ERRORS.BRANCH_NOT_FOUND, 'Chi nhánh không tồn tại');
    }

    const startAt = new Date();
    const durationMinutes = branch.reservationDurationMinutes || 90;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const dateStr = formatDateVN(startAt);
    const timeStr = formatTimeVN(startAt);

    const reservationCode = generateReservationCode(startAt);
    const checkInToken = generateCheckInToken();
    const status = dto.initialStatus === 'SEATED' ? ReservationStatus.SEATED : ReservationStatus.CHECKED_IN;

    const reservation = await this.prisma.reservation.create({
      data: {
        reservationCode,
        branchId: dto.branchId,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone ? normalizePhone(dto.customerPhone) : '0000000000',
        startAt,
        endAt,
        reservationDate: new Date(`${dateStr}T00:00:00+07:00`),
        reservationTime: timeStr,
        partySize: dto.partySize,
        source: ReservationSource.WALK_IN,
        status,
        checkInToken,
        checkedInAt: startAt,
        seatedAt: status === ReservationStatus.SEATED ? startAt : null,
        internalNote: dto.notes || 'Khách vãng lai tại quầy (Walk-in)',
      },
    });

    if (dto.tableIds && dto.tableIds.length > 0) {
      for (const tableId of dto.tableIds) {
        await this.prisma.reservationTable.create({
          data: {
            reservationId: reservation.id,
            tableId,
          },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId: staffUserId,
        action: 'WALK_IN_RESERVATION',
        target: `Reservation:${reservation.id}`,
        newValue: JSON.stringify({ code: reservationCode, status, tableIds: dto.tableIds }),
      },
    });

    return reservation;
  }

  // =========================================================================
  // 4. LOOKUP & SECURITY (GUEST + CUSTOMER)
  // =========================================================================

  async getReservationByCode(
    reservationCode: string,
    phone?: string,
    userId?: string,
    isStaff: boolean = false,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { reservationCode },
      include: {
        branch: true,
        tables: {
          include: { table: { include: { area: true } } },
        },
      },
    });

    if (!reservation) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.NOT_FOUND,
        'Không tìm thấy thông tin đặt bàn',
      );
    }

    // Security Check:
    // If not staff, must match either userId OR normalized phone OR user's registered phone/email
    if (!isStaff) {
      let isOwnerUser = Boolean(userId && reservation.userId === userId);

      if (!isOwnerUser && userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, phone: true, email: true },
        });
        if (
          user &&
          ((user.phone && normalizePhone(user.phone) === normalizePhone(reservation.customerPhone)) ||
            (user.email &&
              reservation.customerEmail &&
              user.email.toLowerCase() === reservation.customerEmail.toLowerCase()))
        ) {
          isOwnerUser = true;
          // Auto-link for future visits
          await this.prisma.reservation.update({
            where: { id: reservation.id },
            data: { userId: user.id },
          }).catch(() => {});
        }
      }

      const isOwnerPhone =
        phone &&
        reservation.customerPhone &&
        normalizePhone(phone) === normalizePhone(reservation.customerPhone);

      if (!isOwnerUser && !isOwnerPhone) {
        throw new ReservationBusinessException(
          RESERVATION_ERRORS.UNAUTHORIZED,
          'Số điện thoại hoặc mã đặt bàn không chính xác',
        );
      }

      // Hide internal note from customer/guest (Requirement AE)
      const { internalNote, ...safeData } = reservation;
      return safeData;
    }

    return reservation;
  }

  async getCustomerReservations(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    // Fetch user phone/email to sync any unlinked reservations
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, email: true },
    });

    if (user && (user.phone || user.email)) {
      const cleanUserPhone = user.phone ? normalizePhone(user.phone) : null;
      await this.prisma.reservation.updateMany({
        where: {
          userId: null,
          OR: [
            ...(cleanUserPhone ? [{ customerPhone: cleanUserPhone }] : []),
            ...(user.email ? [{ customerEmail: user.email }] : []),
          ],
        },
        data: { userId: user.id },
      }).catch(() => {});
    }

    const whereClause: any = {
      OR: [
        { userId },
        ...(user?.phone ? [{ customerPhone: normalizePhone(user.phone) }] : []),
        ...(user?.email ? [{ customerEmail: user.email }] : []),
      ],
    };

    const [total, reservations] = await Promise.all([
      this.prisma.reservation.count({ where: whereClause }),
      this.prisma.reservation.findMany({
        where: whereClause,
        orderBy: { startAt: 'desc' },
        skip,
        take: limit,
        include: {
          branch: {
            select: { id: true, name: true, phone: true, street: true, province: true },
          },
          tables: {
            include: { table: true },
          },
        },
      }),
    ]);

    // Omit internalNote from list
    const safeList = reservations.map(({ internalNote, ...rest }) => rest);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: safeList,
    };
  }

  // =========================================================================
  // 5. ADMIN / MANAGER RESERVATION MANAGEMENT
  // =========================================================================

  async getAdminReservations(filter: {
    branchId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: ReservationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { branchId, date, startDate, endDate, status, search, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (branchId) where.branchId = branchId;
    if (status) where.status = status;

    if (date) {
      const startOfDay = new Date(`${date}T00:00:00+07:00`);
      const endOfDay = new Date(`${date}T23:59:59+07:00`);
      where.startAt = { gte: startOfDay, lte: endOfDay };
    } else if (startDate || endDate) {
      where.startAt = {};
      if (startDate) where.startAt.gte = new Date(`${startDate}T00:00:00+07:00`);
      if (endDate) where.startAt.lte = new Date(`${endDate}T23:59:59+07:00`);
    }

    if (search) {
      where.OR = [
        { reservationCode: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const [total, reservations] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        orderBy: [{ startAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          branch: { select: { id: true, name: true, branchCode: true } },
          tables: {
            include: { table: { include: { area: true } } },
          },
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      }),
    ]);

    // Mask phone in list view (Requirement AF)
    const formattedData = reservations.map((r) => ({
      ...r,
      customerPhoneMasked: maskPhone(r.customerPhone),
    }));

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: formattedData,
    };
  }

  async getAdminDayTimeline(branchId: string, date: string) {
    const startOfDay = new Date(`${date}T00:00:00+07:00`);
    const endOfDay = new Date(`${date}T23:59:59+07:00`);

    const [tables, reservations] = await Promise.all([
      this.prisma.restaurantTable.findMany({
        where: { branchId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { tableCode: 'asc' }],
        include: { area: true },
      }),
      this.prisma.reservation.findMany({
        where: {
          branchId,
          startAt: { gte: startOfDay, lte: endOfDay },
          status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED] },
        },
        include: {
          tables: true,
        },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    return {
      date,
      branchId,
      tables,
      reservations,
    };
  }

  // =========================================================================
  // 6. STATE MACHINE & RBAC TRANSITIONS
  // =========================================================================

  async transitionStatus(
    id: string,
    newStatus: ReservationStatus,
    actor: { userId: string; role: string; name?: string },
    reason?: string,
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { branch: true },
    });
    if (!reservation) {
      throw new ReservationBusinessException(RESERVATION_ERRORS.NOT_FOUND, 'Đặt bàn không tồn tại');
    }

    const currentStatus = reservation.status;

    // RBAC validation: only ADMIN/MANAGER or SYSTEM can change operational statuses
    if (
      actor.role === 'USER' &&
      newStatus !== ReservationStatus.CANCELLED
    ) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.UNAUTHORIZED,
        'Khách hàng chỉ có thể hủy đặt bàn',
      );
    }

    // State Machine Allowed Transitions
    const allowedTransitions: Record<ReservationStatus, ReservationStatus[]> = {
      [ReservationStatus.PENDING]: [
        ReservationStatus.CONFIRMED,
        ReservationStatus.REJECTED,
        ReservationStatus.CANCELLED,
      ],
      [ReservationStatus.CONFIRMED]: [
        ReservationStatus.CHECKED_IN,
        ReservationStatus.SEATED,
        ReservationStatus.CANCELLED,
        ReservationStatus.NO_SHOW,
      ],
      [ReservationStatus.CHECKED_IN]: [
        ReservationStatus.SEATED,
        ReservationStatus.CANCELLED,
      ],
      [ReservationStatus.SEATED]: [
        ReservationStatus.COMPLETED,
      ],
      [ReservationStatus.COMPLETED]: [],
      [ReservationStatus.CANCELLED]: [],
      [ReservationStatus.NO_SHOW]: [],
      [ReservationStatus.REJECTED]: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.INVALID_STATUS_TRANSITION,
        `Không thể chuyển trạng thái từ ${currentStatus} sang ${newStatus}`,
      );
    }

    const updateData: any = {
      status: newStatus,
    };

    const now = new Date();
    if (newStatus === ReservationStatus.CHECKED_IN) updateData.checkedInAt = now;
    if (newStatus === ReservationStatus.SEATED) updateData.seatedAt = now;
    if (newStatus === ReservationStatus.COMPLETED) updateData.completedAt = now;
    if (newStatus === ReservationStatus.NO_SHOW) updateData.noShowAt = now;
    if (newStatus === ReservationStatus.CANCELLED || newStatus === ReservationStatus.REJECTED) {
      updateData.canceledAt = now;
      updateData.cancelReason = reason || 'Quản trị viên cập nhật';
      updateData.canceledBy = actor.name || actor.userId;
    }

    const updated = await this.prisma.reservation.update({
      where: { id },
      data: updateData,
    });

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId: actor.userId,
        action: `RESERVATION_STATUS_${newStatus}`,
        target: `Reservation:${id}`,
        oldValue: currentStatus,
        newValue: newStatus,
      },
    });

    // Notify user if customer is linked
    if (reservation.userId) {
      let notifyTitle = '';
      let notifyContent = '';

      if (newStatus === ReservationStatus.CONFIRMED) {
        notifyTitle = 'Đặt bàn đã được xác nhận';
        notifyContent = `Đặt bàn mã ${reservation.reservationCode} tại ${reservation.branch.name} đã được xác nhận. Hân hạnh phục vụ quý khách!`;
      } else if (newStatus === ReservationStatus.CANCELLED || newStatus === ReservationStatus.REJECTED) {
        notifyTitle = 'Đặt bàn đã bị hủy';
        notifyContent = `Đặt bàn mã ${reservation.reservationCode} đã được hủy (${reason || 'Theo yêu cầu'}).`;
      }

      if (notifyTitle) {
        try {
          await this.notificationService.createNotification({
            userId: reservation.userId,
            title: notifyTitle,
            content: notifyContent,
            type: 'RESERVATION',
            referenceId: reservation.id,
            url: `/profile/reservations/${reservation.reservationCode}`,
          });
        } catch (e) {
          this.logger.error('Failed to notify reservation status change', e);
        }
      }
    }

    return updated;
  }

  // =========================================================================
  // 7. ASSIGN TABLES (RACE-CONDITION FREE)
  // =========================================================================

  async assignTables(
    reservationId: string,
    tableIds: string[],
    actor: { userId: string; role: string },
  ) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { branch: true },
    });
    if (!reservation) {
      throw new ReservationBusinessException(RESERVATION_ERRORS.NOT_FOUND, 'Đặt bàn không tồn tại');
    }

    if (!reservation.startAt || !reservation.endAt) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.INVALID_STATUS_TRANSITION,
        'Đặt bàn thiếu thông tin thời gian',
      );
    }

    const bufferMinutes = reservation.branch.reservationBufferMinutes || 15;

    return this.prisma.$transaction(async (tx) => {
      // Check each table for overlapping reservations
      for (const tableId of tableIds) {
        const table = await tx.restaurantTable.findUnique({ where: { id: tableId } });
        if (!table || table.status !== TableOperationalStatus.ACTIVE) {
          throw new ReservationBusinessException(
            RESERVATION_ERRORS.TABLE_UNAVAILABLE,
            `Bàn ${table?.tableCode || tableId} đang tạm ngưng phục vụ`,
          );
        }

        const conflict = await tx.reservationTable.findFirst({
          where: {
            tableId,
            reservationId: { not: reservationId },
            reservation: {
              status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED] },
              startAt: { lt: new Date(reservation.endAt!.getTime() + bufferMinutes * 60 * 1000) },
              endAt: { gt: new Date(reservation.startAt!.getTime() - bufferMinutes * 60 * 1000) },
            },
          },
          include: { reservation: true },
        });

        if (conflict) {
          throw new ReservationBusinessException(
            RESERVATION_ERRORS.TABLE_UNAVAILABLE,
            `Bàn ${table.tableCode} đã được gán cho đặt bàn ${conflict.reservation.reservationCode} trong cùng khung giờ`,
          );
        }
      }

      // Clear existing table assignments
      await tx.reservationTable.deleteMany({
        where: { reservationId },
      });

      // Insert new assignments
      for (const tableId of tableIds) {
        await tx.reservationTable.create({
          data: {
            reservationId,
            tableId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.userId,
          action: 'ASSIGN_TABLES',
          target: `Reservation:${reservationId}`,
          newValue: JSON.stringify(tableIds),
        },
      });

      return {
        success: true,
        message: 'Đã gán bàn thành công',
        tableIds,
      };
    });
  }

  // =========================================================================
  // 8. CUSTOMER SELF-SERVICE (CANCEL & MODIFY)
  // =========================================================================

  async customerCancelReservation(
    idOrCode: string,
    userId?: string,
    phone?: string,
    cancelReason?: string,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        OR: [{ id: idOrCode }, { reservationCode: idOrCode }],
      },
      include: { branch: true },
    });

    if (!reservation) {
      throw new ReservationBusinessException(RESERVATION_ERRORS.NOT_FOUND, 'Đặt bàn không tồn tại');
    }

    // Ownership check
    const isOwnerUser = userId && reservation.userId === userId;
    const isOwnerPhone =
      phone &&
      reservation.customerPhone &&
      normalizePhone(phone) === normalizePhone(reservation.customerPhone);

    if (!isOwnerUser && !isOwnerPhone) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.UNAUTHORIZED,
        'Bạn không có quyền thao tác trên đặt bàn này',
      );
    }

    if (
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.COMPLETED
    ) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.ALREADY_SERVED,
        'Không thể hủy đặt bàn ở trạng thái hiện tại',
      );
    }

    // Cutoff check
    const now = new Date();
    const cutoffMinutes = reservation.branch.reservationModifyCutoffMinutes || 60;
    if (
      reservation.startAt &&
      reservation.startAt.getTime() - now.getTime() < cutoffMinutes * 60 * 1000
    ) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.CANCEL_CUTOFF,
        `Chỉ có thể hủy đặt bàn trước giờ hẹn ít nhất ${cutoffMinutes} phút`,
      );
    }

    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: ReservationStatus.CANCELLED,
        canceledAt: now,
        cancelReason: cancelReason || 'Khách hàng tự hủy',
        canceledBy: 'CUSTOMER',
      },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'CUSTOMER_CANCEL_RESERVATION',
          target: `Reservation:${reservation.id}`,
          newValue: cancelReason || 'Khách hàng hủy',
        },
      });
    }

    return updated;
  }

  // =========================================================================
  // 9. SECURE QR CHECK-IN VERIFICATION
  // =========================================================================

  async verifyCheckInToken(token: string, staffBranchId?: string) {
    if (!token) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.INVALID_CHECKIN_TOKEN,
        'Mã check-in không hợp lệ',
      );
    }

    const reservation = await this.prisma.reservation.findUnique({
      where: { checkInToken: token },
      include: {
        branch: true,
        tables: { include: { table: true } },
      },
    });

    if (!reservation) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.INVALID_CHECKIN_TOKEN,
        'Mã check-in không tồn tại hoặc đã hết hạn',
      );
    }

    if (staffBranchId && reservation.branchId !== staffBranchId) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.UNAUTHORIZED,
        'Mã check-in này thuộc về chi nhánh khác',
      );
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.INVALID_STATUS_TRANSITION,
        'Đặt bàn này đã bị hủy',
      );
    }
    if (reservation.status === ReservationStatus.COMPLETED) {
      throw new ReservationBusinessException(
        RESERVATION_ERRORS.ALREADY_SERVED,
        'Đặt bàn này đã hoàn tất phục vụ',
      );
    }

    // Auto mark CHECKED_IN if currently CONFIRMED
    if (reservation.status === ReservationStatus.CONFIRMED) {
      await this.prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: ReservationStatus.CHECKED_IN,
          checkedInAt: new Date(),
        },
      });
      reservation.status = ReservationStatus.CHECKED_IN;
    }

    return {
      success: true,
      reservation,
    };
  }

  // =========================================================================
  // 10. REAL ANALYTICS ENGINE (NO MOCK DATA)
  // =========================================================================

  async getAnalytics(branchId?: string, rangeDays: number = 30) {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - rangeDays);

    const where: any = {
      startAt: { gte: sinceDate },
    };
    if (branchId) where.branchId = branchId;

    const all = await this.prisma.reservation.findMany({
      where,
      select: {
        id: true,
        status: true,
        partySize: true,
        source: true,
        startAt: true,
      },
    });

    const totalBookings = all.length;
    const totalGuests = all.reduce((sum, r) => sum + r.partySize, 0);
    const avgPartySize = totalBookings > 0 ? Number((totalGuests / totalBookings).toFixed(1)) : 0;

    const completed = all.filter((r) => r.status === ReservationStatus.COMPLETED).length;
    const cancelled = all.filter((r) => r.status === ReservationStatus.CANCELLED).length;
    const noShow = all.filter((r) => r.status === ReservationStatus.NO_SHOW).length;
    const seatedOrCheckedIn = all.filter(
      (r) => r.status === ReservationStatus.SEATED || r.status === ReservationStatus.CHECKED_IN,
    ).length;

    const conversionRate = totalBookings > 0 ? Number(((completed / totalBookings) * 100).toFixed(1)) : 0;
    const cancellationRate = totalBookings > 0 ? Number(((cancelled / totalBookings) * 100).toFixed(1)) : 0;
    const noShowRate = totalBookings > 0 ? Number(((noShow / totalBookings) * 100).toFixed(1)) : 0;

    // Source breakdown
    const sourceBreakdown: Record<string, number> = {
      WEB: 0,
      CHATBOT: 0,
      VOICE: 0,
      ADMIN: 0,
      WALK_IN: 0,
    };
    for (const r of all) {
      sourceBreakdown[r.source] = (sourceBreakdown[r.source] || 0) + 1;
    }

    // Peak hours distribution (10:00 - 22:00)
    const peakHours: Record<string, number> = {};
    for (const r of all) {
      if (r.startAt) {
        const hour = formatTimeVN(r.startAt).substring(0, 2) + ':00';
        peakHours[hour] = (peakHours[hour] || 0) + 1;
      }
    }

    return {
      rangeDays,
      totalBookings,
      totalGuests,
      avgPartySize,
      completed,
      cancelled,
      noShow,
      seatedOrCheckedIn,
      conversionRate,
      cancellationRate,
      noShowRate,
      sourceBreakdown,
      peakHours,
    };
  }
}
