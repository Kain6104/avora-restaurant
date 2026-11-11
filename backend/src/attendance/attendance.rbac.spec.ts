import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceQrService } from './attendance-qr.service';
import { AttendanceExcelService } from './attendance-excel.service';
import { AttendanceImportService } from './attendance-import.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AuthorizationService } from '../common/services/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('Attendance RBAC & Permissions Enforcement', () => {
  let controller: AttendanceController;
  let authService: AuthorizationService;
  let reflector: Reflector;

  const mockAttendanceService = {
    getAdminDashboardData: jest.fn(),
    addManualAttendance: jest.fn(),
    processManualAction: jest.fn(),
    bulkDelete: jest.fn(),
  };

  const mockQrService = {
    generateDynamicQr: jest.fn(),
  };

  const mockExcelService = {
    exportToExcel: jest.fn(),
  };

  const mockImportService = {
    importWeeklySchedule: jest.fn(),
    importHistoricalAttendance: jest.fn(),
  };

  const mockAuthorizationService = {
    can: jest.fn(),
    hasPermissionForBranch: jest.fn(),
  };

  const mockPrismaService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        { provide: AttendanceService, useValue: mockAttendanceService },
        { provide: AttendanceQrService, useValue: mockQrService },
        { provide: AttendanceExcelService, useValue: mockExcelService },
        { provide: AttendanceImportService, useValue: mockImportService },
        { provide: AuthorizationService, useValue: mockAuthorizationService },
        { provide: PrismaService, useValue: mockPrismaService },
        Reflector,
      ],
    }).compile();

    controller = module.get<AttendanceController>(AttendanceController);
    authService = module.get<AuthorizationService>(AuthorizationService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should deny access when user lacks attendance.view permission', async () => {
    const guard = new PermissionsGuard(reflector, authService as any, mockPrismaService as any);
    
    mockAuthorizationService.hasPermissionForBranch.mockResolvedValue(false); // No permission
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['attendance.view']);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u_guest', role: 'CUSTOMER' },
          query: {},
          body: {},
          params: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access when user has attendance.view permission', async () => {
    const guard = new PermissionsGuard(reflector, authService as any, mockPrismaService as any);
    
    mockAuthorizationService.hasPermissionForBranch.mockResolvedValue(true); // Has permission
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['attendance.view']);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u_admin', role: 'ADMIN' },
          query: {},
          body: {},
          params: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should deny manual add when user lacks attendance.edit permission', async () => {
    const guard = new PermissionsGuard(reflector, authService as any, mockPrismaService as any);
    
    mockAuthorizationService.hasPermissionForBranch.mockResolvedValue(false);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['attendance.edit']);

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'u_waiter', role: 'WAITER' },
          body: { branchId: 'b1' },
          query: {},
          params: {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
  });
});
