import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}));

describe('Admin UsersService - Account Security & Email Change OTP', () => {
  let service: UsersService;
  let mockPrisma: any;

  const mockUser = {
    id: 'user-123',
    fullName: 'Le Van B',
    email: 'old_email@example.com',
    phone: '0987654321',
    isEmailVerified: true,
    isAccountLocked: false,
    pendingNewEmail: null,
    changeEmailOtp: null,
    changeEmailOtpExpires: null,
    changeEmailOtpAttempts: 0,
    changeEmailOtpLastSentAt: null,
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ ...mockUser }),
        create: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUser, ...data })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(true),
      },
    };

    service = new UsersService(mockPrisma);
  });

  // 1. Chặn sửa password
  it('1. test_update_disallow_password: Admin update should strip password and passwordHash', async () => {
    await service.update('user-123', {
      fullName: 'Le Van B Updated',
      password: 'hackedPassword123',
      passwordHash: 'hash123',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {
        fullName: 'Le Van B Updated',
      },
    });
  });

  // 2. Chặn sửa trực tiếp email nếu đã verified
  it('2. test_update_disallow_direct_email_change_if_verified: Should reject direct email edit if isEmailVerified is true', async () => {
    await expect(
      service.update('user-123', {
        email: 'bypass@example.com',
      })
    ).rejects.toThrow(BadRequestException);
  });

  // 3. Chặn gán cờ isEmailVerified thủ công
  it('3. test_update_disallow_manual_is_email_verified: Should strip isEmailVerified from update payload', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isEmailVerified: false });

    await service.update('user-123', {
      isEmailVerified: true,
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {},
    });
  });

  // 4. Khởi tạo đổi email & gửi OTP thành công
  it('4. test_request_email_change_success: Should generate 6-digit OTP and set 10 min expiration', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null); // email mới chưa ai dùng

    const res = await service.requestEmailChange('user-123', 'new_email@example.com', 'admin-1');

    expect(res.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
        data: expect.objectContaining({
          pendingNewEmail: 'new_email@example.com',
          changeEmailOtp: expect.stringMatching(/^\d{6}$/),
          changeEmailOtpAttempts: 0,
        }),
      })
    );
  });

  // 5. Chặn gửi OTP nếu email mới đã có người dùng
  it('5. test_request_email_change_reject_duplicate_email: Should reject if new email already exists in DB', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'other-user', email: 'taken@example.com' });

    await expect(
      service.requestEmailChange('user-123', 'taken@example.com', 'admin-1')
    ).rejects.toThrow(BadRequestException);
  });

  // 6. Chặn gửi OTP nếu email mới trùng email hiện tại
  it('6. test_request_email_change_reject_same_email: Should reject if new email is identical to current email', async () => {
    await expect(
      service.requestEmailChange('user-123', 'old_email@example.com', 'admin-1')
    ).rejects.toThrow(BadRequestException);
  });

  // 7. Rate limit 60s giữa các lần gửi OTP
  it('7. test_request_email_change_rate_limit: Should reject if requested within 60 seconds', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      changeEmailOtpLastSentAt: new Date(Date.now() - 20000), // mới gửi 20s trước
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.requestEmailChange('user-123', 'another@example.com', 'admin-1')
    ).rejects.toThrow(BadRequestException);
  });

  // 8. Xác thực OTP thành công, cập nhật email và ghi Audit Log
  it('8. test_verify_email_change_success: Should update email, verify, clear OTP, and create AuditLog', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      pendingNewEmail: 'verified_new@example.com',
      changeEmailOtp: '654321',
      changeEmailOtpExpires: new Date(Date.now() + 500000),
      changeEmailOtpAttempts: 0,
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await service.verifyEmailChange('user-123', 'verified_new@example.com', '654321', 'admin-1');

    expect(res.success).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {
        email: 'verified_new@example.com',
        isEmailVerified: true,
        pendingNewEmail: null,
        changeEmailOtp: null,
        changeEmailOtpExpires: null,
        changeEmailOtpAttempts: 0,
      },
    });

    // Kiểm tra AuditLog
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'CHANGE_USER_EMAIL',
        oldValue: expect.stringContaining('old_email@example.com'),
        newValue: expect.stringContaining('verified_new@example.com'),
      }),
    });
  });

  // 9. Báo lỗi khi nhập sai OTP
  it('9. test_verify_email_change_wrong_otp: Should increment attempts and reject wrong OTP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      pendingNewEmail: 'verified_new@example.com',
      changeEmailOtp: '654321',
      changeEmailOtpExpires: new Date(Date.now() + 500000),
      changeEmailOtpAttempts: 1,
    });

    await expect(
      service.verifyEmailChange('user-123', 'verified_new@example.com', '000000', 'admin-1')
    ).rejects.toThrow(BadRequestException);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { changeEmailOtpAttempts: 2 },
    });
  });

  // 10. Khóa khi nhập sai OTP quá 5 lần
  it('10. test_verify_email_change_max_attempts: Should reject if attempts >= 5', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      pendingNewEmail: 'verified_new@example.com',
      changeEmailOtp: '654321',
      changeEmailOtpExpires: new Date(Date.now() + 500000),
      changeEmailOtpAttempts: 5,
    });

    await expect(
      service.verifyEmailChange('user-123', 'verified_new@example.com', '654321', 'admin-1')
    ).rejects.toThrow(BadRequestException);
  });

  // 11. Báo lỗi khi OTP đã hết hạn (> 10 phút)
  it('11. test_verify_email_change_expired_otp: Should reject expired OTP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      pendingNewEmail: 'verified_new@example.com',
      changeEmailOtp: '654321',
      changeEmailOtpExpires: new Date(Date.now() - 10000), // đã hết hạn
      changeEmailOtpAttempts: 0,
    });

    await expect(
      service.verifyEmailChange('user-123', 'verified_new@example.com', '654321', 'admin-1')
    ).rejects.toThrow(BadRequestException);
  });
});
