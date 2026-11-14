import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppThrottlerGuard } from './app-throttler.guard';

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;
  let reflector: Reflector;
  let mockStorageService: any;
  let mockOptions: any;

  beforeEach(() => {
    reflector = new Reflector();
    mockStorageService = {
      increment: jest.fn(),
    };
    mockOptions = {
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 120,
        },
      ],
      errorMessage: 'Rate limit exceeded',
    };

    guard = new AppThrottlerGuard(mockOptions, mockStorageService, reflector);
  });

  describe('shouldSkip', () => {
    it('should skip when request path contains /payment/sepay', async () => {
      const mockReq = {
        path: '/api/payment/sepay',
        headers: {},
      };
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(true);
    });

    it('should skip when request path contains /payment/webhook', async () => {
      const mockReq = {
        path: '/api/payment/webhook/sepay',
        headers: {},
      };
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(true);
    });

    it('should skip when x-internal-pos-agent header is true', async () => {
      const mockReq = {
        path: '/api/pos/orders',
        headers: { 'x-internal-pos-agent': 'true' },
      };
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(true);
    });

    it('should NOT skip normal public customer endpoints', async () => {
      const mockReq = {
        path: '/api/auth/login',
        headers: {},
      };
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => mockReq,
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const result = await (guard as any).shouldSkip(context);
      expect(result).toBe(false);
    });
  });

  describe('getTracker', () => {
    it('should extract client IP from x-forwarded-for header behind proxy', async () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178',
        },
        ip: '127.0.0.1',
      };

      const tracker = await (guard as any).getTracker(mockReq);
      expect(tracker).toBe('ip_203.0.113.195');
    });

    it('should fallback to req.ip when no forwarded header exists', async () => {
      const mockReq = {
        headers: {},
        ip: '192.168.1.100',
      };

      const tracker = await (guard as any).getTracker(mockReq);
      expect(tracker).toBe('ip_192.168.1.100');
    });

    it('should prefix with user ID if user is authenticated', async () => {
      const mockReq = {
        headers: {},
        ip: '192.168.1.100',
        user: { id: 'usr_abc123' },
      };

      const tracker = await (guard as any).getTracker(mockReq);
      expect(tracker).toBe('usr_usr_abc123_192.168.1.100');
    });
  });

  describe('throwThrottlingException', () => {
    it('should throw standardized 429 HttpException with RATE_LIMIT_EXCEEDED and set Retry-After header', async () => {
      const setHeaderMock = jest.fn();
      const mockRes = {
        setHeader: setHeaderMock,
      };
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({}),
          getResponse: () => mockRes,
        }),
      } as unknown as ExecutionContext;

      const limitDetail = {
        limit: 10,
        ttl: 60000,
        key: 'test_key',
        tracker: 'ip_127.0.0.1',
        totalHits: 11,
        timeToExpire: 45000,
        isBlocked: true,
        timeToBlockExpire: 45,
      };

      try {
        await (guard as any).throwThrottlingException(context, limitDetail);
        fail('Expected guard to throw HttpException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = err.getResponse();
        expect(response).toMatchObject({
          success: false,
          statusCode: 429,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: 45,
          },
        });
        expect(setHeaderMock).toHaveBeenCalledWith('Retry-After', 45);
      }
    });
  });
});
