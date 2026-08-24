"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const notification_service_1 = require("../notification/notification.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService, notificationService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
    }
    async register(data) {
        const { email, password, fullName, phone } = data;
        // Kiểm tra xem email đã tồn tại chưa
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { phone }
                ]
            },
        });
        if (existingUser) {
            if (existingUser.email === email) {
                throw new common_1.ConflictException('Email này đã được sử dụng.');
            }
            if (existingUser.phone === phone) {
                throw new common_1.ConflictException('Số điện thoại này đã được sử dụng.');
            }
        }
        // Mã hóa mật khẩu
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        // Tạo user mới
        const newUser = await this.prisma.user.create({
            data: {
                email,
                fullName,
                phone,
                passwordHash,
                role: 'USER',
            },
        });
        // Tạo thông báo chào mừng
        await this.notificationService.createNotification({
            userId: newUser.id,
            title: 'Chào mừng bạn đến với Avora!',
            content: 'Tài khoản của bạn đã được đăng ký thành công. Hãy khám phá các món ăn tuyệt vời của chúng tôi nhé!',
            type: 'SYSTEM',
        });
        return {
            message: 'Đăng ký thành công',
            user: {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.fullName,
                role: newUser.role,
            }
        };
    }
    async login(data) {
        const { email, password } = data; // 'email' acts as identifier here
        if (!email || !password) {
            throw new common_1.UnauthorizedException('Vui lòng nhập email/số điện thoại và mật khẩu.');
        }
        // Tìm user theo email hoặc phone
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: email },
                    { phone: email }
                ]
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Email, số điện thoại hoặc mật khẩu không chính xác.');
        }
        if (!user.passwordHash) {
            if (user.authProvider === 'GOOGLE') {
                throw new common_1.UnauthorizedException('Tài khoản này được liên kết với Google. Vui lòng đăng nhập bằng Google.');
            }
            throw new common_1.UnauthorizedException('Tài khoản không có mật khẩu. Vui lòng đăng nhập bằng phương thức khác.');
        }
        // So sánh mật khẩu
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Email, số điện thoại hoặc mật khẩu không chính xác.');
        }
        // Tạo Payload cho JWT
        const payload = { sub: user.id, email: user.email, role: user.role };
        return {
            message: 'Đăng nhập thành công',
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            }
        };
    }
    async validateGoogleUser(profile) {
        const { email, firstName, lastName, picture, googleId } = profile;
        const fullName = `${firstName} ${lastName}`.trim();
        let user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            // Create new user
            user = await this.prisma.user.create({
                data: {
                    email,
                    fullName,
                    avatarUrl: picture,
                    googleId,
                    authProvider: 'GOOGLE',
                    role: 'USER',
                },
            });
            // Tạo thông báo chào mừng
            await this.notificationService.createNotification({
                userId: user.id,
                title: 'Chào mừng bạn đến với Avora!',
                content: 'Tài khoản của bạn đã được đăng ký qua Google thành công. Hãy khám phá các món ăn tuyệt vời của chúng tôi nhé!',
                type: 'SYSTEM',
            });
        }
        else {
            // Update existing user with Google info if missing
            user = await this.prisma.user.update({
                where: { email },
                data: {
                    googleId: user.googleId || googleId,
                    avatarUrl: user.avatarUrl || picture,
                },
            });
        }
        return user;
    }
    async updatePhone(userId, phone) {
        const existingUser = await this.prisma.user.findUnique({
            where: { phone },
        });
        if (existingUser && existingUser.id !== userId) {
            throw new common_1.ConflictException('Số điện thoại này đã được sử dụng bởi một tài khoản khác.');
        }
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: { phone },
        });
        return updatedUser;
    }
    generateToken(user) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        return this.jwtService.sign(payload);
    }
    async getMe(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                orders: {
                    orderBy: { createdAt: 'desc' },
                }
            }
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Không tìm thấy người dùng');
        }
        const { passwordHash } = user, result = __rest(user, ["passwordHash"]);
        return result;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        notification_service_1.NotificationService])
], AuthService);
