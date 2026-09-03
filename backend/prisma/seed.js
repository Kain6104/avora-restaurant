"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
// Hàm hỗ trợ lấy ngẫu nhiên chi nhánh cho sản phẩm
function getRandomBranches(branches, min, max) {
    if (min === void 0) { min = 2; }
    if (max === void 0) { max = 5; }
    var shuffled = __spreadArray([], branches, true).sort(function () { return 0.5 - Math.random(); });
    var count = Math.floor(Math.random() * (max - min + 1) + min);
    return shuffled.slice(0, count).map(function (b) { return ({ id: b.id }); });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var tiers, branches, catData, categories, optSushiCondiments, optMakiToppings, optSashimiSize, optNoodle, optRice, optDrinks, rawProducts, prodCount, createdProducts, _i, rawProducts_1, p, name_1, price, catIdx, isBest, options, product, opts, _loop_1, gIndex, now, nextMonth, vouchers, flashSale, users, ramenProduct, optionGroups, selectedSize, selectedTopping, itemPriceAtSale, subTotal1, discount1, totalAmount1, order1, orderItem;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log('Bắt đầu dọn dẹp Database cũ...');
                    return [4 /*yield*/, prisma.pointTransaction.deleteMany()];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, prisma.notification.deleteMany()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, prisma.orderItemOption.deleteMany()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, prisma.orderItem.deleteMany()];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, prisma.order.deleteMany()];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, prisma.flashSaleItem.deleteMany()];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, prisma.flashSale.deleteMany()];
                case 7:
                    _c.sent();
                    return [4 /*yield*/, prisma.voucher.deleteMany()];
                case 8:
                    _c.sent();
                    return [4 /*yield*/, prisma.reservation.deleteMany()];
                case 9:
                    _c.sent();
                    return [4 /*yield*/, prisma.address.deleteMany()];
                case 10:
                    _c.sent();
                    // Dọn dẹp hệ thống món và options
                    return [4 /*yield*/, prisma.optionItem.deleteMany()];
                case 11:
                    // Dọn dẹp hệ thống món và options
                    _c.sent();
                    return [4 /*yield*/, prisma.optionGroup.deleteMany()];
                case 12:
                    _c.sent();
                    return [4 /*yield*/, prisma.product.deleteMany()];
                case 13:
                    _c.sent();
                    return [4 /*yield*/, prisma.banner.deleteMany()];
                case 14:
                    _c.sent();
                    return [4 /*yield*/, prisma.category.deleteMany()];
                case 15:
                    _c.sent();
                    return [4 /*yield*/, prisma.user.deleteMany()];
                case 16:
                    _c.sent();
                    return [4 /*yield*/, prisma.membershipTier.deleteMany()];
                case 17:
                    _c.sent();
                    return [4 /*yield*/, prisma.branch.deleteMany()];
                case 18:
                    _c.sent();
                    console.log('1. Đang tạo Membership Tiers (Hạng thành viên)...');
                    return [4 /*yield*/, Promise.all([
                            prisma.membershipTier.create({ data: { name: 'Đồng', minSpending: 0, pointMultiplier: 1.0, discountPercent: 0 } }),
                            prisma.membershipTier.create({ data: { name: 'Bạc', minSpending: 2000000, pointMultiplier: 1.2, discountPercent: 2 } }),
                            prisma.membershipTier.create({ data: { name: 'Vàng', minSpending: 5000000, pointMultiplier: 1.5, discountPercent: 5 } }),
                            prisma.membershipTier.create({ data: { name: 'Kim Cương', minSpending: 15000000, pointMultiplier: 2.0, discountPercent: 10 } }),
                        ])];
                case 19:
                    tiers = _c.sent();
                    console.log('2. Đang tạo 5 Chi nhánh (Branches) với Tọa độ...');
                    return [4 /*yield*/, Promise.all([
                            prisma.branch.create({ data: { name: 'Avora Signature Quận 1', branchCode: 'AVO-Q1', street: '123 Lê Lợi', district: 'Quận 1', province: 'TP.HCM', latitude: 10.773234, longitude: 106.700684, openTime: '10:00', closeTime: '23:00' } }),
                            prisma.branch.create({ data: { name: 'Avora Premium Thảo Điền', branchCode: 'AVO-Q2', street: '45 Xuân Thủy', district: 'Quận 2', province: 'TP.HCM', latitude: 10.803328, longitude: 106.735041, openTime: '10:00', closeTime: '22:30' } }),
                            prisma.branch.create({ data: { name: 'Avora Landmark 81', branchCode: 'AVO-L81', street: '720A Điện Biên Phủ', district: 'Bình Thạnh', province: 'TP.HCM', latitude: 10.794628, longitude: 106.721832, openTime: '09:00', closeTime: '22:00' } }),
                            prisma.branch.create({ data: { name: 'Avora Hoàn Kiếm', branchCode: 'AVO-HN1', street: '15 Lý Thái Tổ', district: 'Hoàn Kiếm', province: 'Hà Nội', latitude: 21.026752, longitude: 105.854431, openTime: '10:00', closeTime: '23:00' } }),
                            prisma.branch.create({ data: { name: 'Avora West Lake', branchCode: 'AVO-HN2', street: '88 Xuân Diệu', district: 'Tây Hồ', province: 'Hà Nội', latitude: 21.063124, longitude: 105.823956, openTime: '11:00', closeTime: '23:30' } }),
                        ])];
                case 20:
                    branches = _c.sent();
                    console.log('3. Đang tạo 5 Danh mục (Categories)...');
                    catData = [
                        { name: 'Sushi & Maki', slug: 'sushi-maki', image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400' }, // Index 0
                        { name: 'Sashimi Tươi Sống', slug: 'sashimi', image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400' }, // Index 1
                        { name: 'Món Nóng & Bếp', slug: 'mon-nong', image: 'https://images.unsplash.com/photo-1544025162-8111149f57b7?w=400' }, // Index 2
                        { name: 'Set Omakase & Combo', slug: 'omakase-combo', image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400' }, // Index 3
                        { name: 'Đồ Uống & Tráng Miệng', slug: 'do-uong', image: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400' } // Index 4
                    ];
                    return [4 /*yield*/, Promise.all(catData.map(function (cat, index) { return prisma.category.create({ data: __assign(__assign({}, cat), { displayOrder: index + 1, branches: { connect: branches.map(function (b) { return ({ id: b.id }); }) } }) }); }))];
                case 21:
                    categories = _c.sent();
                    optSushiCondiments = [
                        { name: 'Gia vị kèm theo', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Thêm Wasabi', priceAdjustment: 0 }, { name: 'Thêm Gừng chua', priceAdjustment: 0 }] }
                    ];
                    optMakiToppings = __spreadArray(__spreadArray([], optSushiCondiments, true), [
                        { name: 'Topping cuộn thêm', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Phủ Phô mai khò', priceAdjustment: 20000 }, { name: 'Phủ Trứng cá hồi', priceAdjustment: 35000 }] }
                    ], false);
                    optSashimiSize = __spreadArray([
                        { name: 'Độ dày lát cắt', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Cắt chuẩn (Standard)', priceAdjustment: 0, isDefault: true }, { name: 'Cắt dày (Thick cut)', priceAdjustment: 0 }] }
                    ], optSushiCondiments, true);
                    optNoodle = [
                        { name: 'Kích cỡ', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Size Vừa', priceAdjustment: 0, isDefault: true }, { name: 'Size Lớn (Thêm mì)', priceAdjustment: 25000 }] },
                        { name: 'Độ cay', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Không cay', priceAdjustment: 0, isDefault: true }, { name: 'Cay vừa', priceAdjustment: 0 }, { name: 'Rất cay', priceAdjustment: 0 }] },
                        { name: 'Topping thêm', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 4, items: [{ name: 'Thêm Trứng lòng đào (Ajitama)', priceAdjustment: 15000 }, { name: 'Thêm Thịt Xá Xíu', priceAdjustment: 35000 }, { name: 'Thêm Rong biển', priceAdjustment: 10000 }, { name: 'Thêm Đậu hũ', priceAdjustment: 10000 }] }
                    ];
                    optRice = [
                        { name: 'Lượng cơm', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Cơm vừa', priceAdjustment: 0, isDefault: true }, { name: 'Ít cơm', priceAdjustment: 0 }, { name: 'Nhiều cơm', priceAdjustment: 10000 }] },
                        { name: 'Món ăn kèm', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Súp Miso', priceAdjustment: 20000 }, { name: 'Salad rong biển', priceAdjustment: 35000 }] }
                    ];
                    optDrinks = [
                        { name: 'Lượng đá', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Đá bình thường', priceAdjustment: 0, isDefault: true }, { name: 'Ít đá', priceAdjustment: 0 }, { name: 'Không đá', priceAdjustment: 0 }] },
                        { name: 'Độ ngọt', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: '100% Đường', priceAdjustment: 0, isDefault: true }, { name: '50% Đường', priceAdjustment: 0 }, { name: 'Không đường', priceAdjustment: 0 }] }
                    ];
                    console.log('4. Đang tạo 120 Sản phẩm với Hệ thống Option Món...');
                    rawProducts = [
                        // --- 1. SUSHI & MAKI (25 Món) ---
                        ['Nigiri Cá Hồi (Sake)', 45000, 0, true, optSushiCondiments],
                        ['Nigiri Cá Ngừ (Maguro)', 55000, 0, false, optSushiCondiments],
                        ['Nigiri Bụng Cá Hồi Béo', 65000, 0, true, optSushiCondiments],
                        ['Nigiri Tôm Ngọt (Amaebi)', 65000, 0, false, optSushiCondiments],
                        ['Nigiri Lươn Nướng (Unagi)', 75000, 0, true, optSushiCondiments],
                        ['Nigiri Bạch Tuộc (Tako)', 40000, 0, false, optSushiCondiments],
                        ['Nigiri Mực Tươi (Ika)', 45000, 0, false, optSushiCondiments],
                        ['Nigiri Sò Đỏ (Hokkigai)', 55000, 0, true, optSushiCondiments],
                        ['Nigiri Trứng Cuộn (Tamago)', 35000, 0, false, optSushiCondiments],
                        ['Nigiri Cá Trích Ép Trứng', 50000, 0, false, optSushiCondiments],
                        ['Nigiri Bò Wagyu A5 Khò', 120000, 0, true, optSushiCondiments],
                        ['Gunkan Trứng Cá Hồi (Ikura)', 95000, 0, true, optSushiCondiments],
                        ['Gunkan Nhím Biển (Uni)', 180000, 0, false, optSushiCondiments],
                        ['Gunkan Thịt Cua', 65000, 0, false, optSushiCondiments],
                        ['Gunkan Rong Biển Tươi', 35000, 0, false, optSushiCondiments],
                        ['Maki California', 85000, 0, true, optMakiToppings],
                        ['Maki Cá Hồi Bơ', 95000, 0, true, optMakiToppings],
                        ['Maki Tôm Tempura', 110000, 0, true, optMakiToppings],
                        ['Maki Lươn Dưa Leo', 120000, 0, false, optMakiToppings],
                        ['Maki Bơ Dưa Leo Chay', 55000, 0, false, optMakiToppings],
                        ['Cuộn Rồng Đỏ (Red Dragon Roll)', 165000, 0, true, optMakiToppings],
                        ['Cuộn Núi Lửa (Volcano Roll)', 180000, 0, true, optMakiToppings],
                        ['Cuộn Da Cá Hồi Chiên Giòn', 105000, 0, false, optMakiToppings],
                        ['Cuộn Cầu Vồng (Rainbow Roll)', 155000, 0, false, optMakiToppings],
                        ['Sushi Viên Temari Đủ Loại', 145000, 0, false, optSushiCondiments],
                        // --- 2. SASHIMI TƯƠI SỐNG (25 Món) ---
                        ['Sashimi Cá Hồi (3 lát)', 95000, 1, true, optSashimiSize],
                        ['Sashimi Cá Hồi (5 lát)', 150000, 1, true, optSashimiSize],
                        ['Sashimi Bụng Cá Hồi (Toro)', 185000, 1, true, optSashimiSize],
                        ['Sashimi Cá Ngừ Đại Dương', 160000, 1, false, optSashimiSize],
                        ['Sashimi Bụng Cá Ngừ (Otoro)', 450000, 1, true, optSashimiSize],
                        ['Sashimi Bạch Tuộc', 120000, 1, false, optSashimiSize],
                        ['Sashimi Mực Tươi Lá', 130000, 1, false, optSashimiSize],
                        ['Sashimi Sò Đỏ Canada', 150000, 1, true, optSashimiSize],
                        ['Sashimi Tôm Ngọt Amaebi', 180000, 1, true, optSashimiSize],
                        ['Sashimi Cầu Gai Nhật', 480000, 1, false, optSashimiSize],
                        ['Sashimi Cá Trích Vàng', 140000, 1, false, optSashimiSize],
                        ['Sashimi Cá Trích Đỏ', 140000, 1, false, optSashimiSize],
                        ['Sashimi Bào Ngư Sống', 350000, 1, false, optSashimiSize],
                        ['Sashimi Cồi Sò Điệp Hokkaido', 280000, 1, true, optSashimiSize],
                        ['Sashimi Tôm Hùm (Theo thời giá)', 1250000, 1, false, null],
                        ['Set Sashimi Tiêu Chuẩn (3 loại)', 280000, 1, true, optSushiCondiments],
                        ['Set Sashimi Mùa Xuân (5 loại)', 450000, 1, true, optSushiCondiments],
                        ['Set Sashimi Đặc Biệt (7 loại)', 680000, 1, true, optSushiCondiments],
                        ['Thuyền Sashimi Hoàng Gia', 1500000, 1, false, optSushiCondiments],
                        ['Khay Sashimi Cá Hồi Khổng Lồ', 850000, 1, true, optSushiCondiments],
                        ['Carpaccio Cá Hồi Sốt Truffle', 220000, 1, false, null],
                        ['Carpaccio Bò Wagyu', 350000, 1, false, null],
                        ['Hàu Sữa Nhật Bản (1 con)', 75000, 1, true, [{ name: 'Sốt ăn kèm', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Sốt Ponzu', priceAdjustment: 0, isDefault: true }, { name: 'Chanh muối', priceAdjustment: 0 }] }]],
                        ['Hàu Sữa Sốt Trứng Muối', 90000, 1, false, null],
                        ['Hàu Nướng Phô Mai', 85000, 1, false, null],
                        // --- 3. MÓN NÓNG & BẾP (30 Món) ---
                        ['Mì Ramen Tonkotsu Chashu', 165000, 2, true, optNoodle],
                        ['Mì Ramen Miso', 155000, 2, false, optNoodle],
                        ['Mì Ramen Shoyu Vị Tương', 145000, 2, false, optNoodle],
                        ['Mì Udon Hải Sản Nóng', 140000, 2, true, optNoodle],
                        ['Mì Udon Bò Nhật', 150000, 2, true, optNoodle],
                        ['Mì Udon Cà Ri Gà', 135000, 2, false, optNoodle],
                        ['Mì Soba Lạnh', 95000, 2, false, null],
                        ['Mì Xào Yakisoba Hải Sản', 145000, 2, true, optNoodle],
                        ['Mì Xào Yakisoba Bò', 155000, 2, false, optNoodle],
                        ['Cơm Lươn Nướng (Unadon)', 290000, 2, true, optRice],
                        ['Cơm Gà Xốt Teriyaki', 120000, 2, true, optRice],
                        ['Cơm Heo Chiên Xù (Katsudon)', 135000, 2, true, optRice],
                        ['Cơm Thịt Bò (Gyudon)', 145000, 2, false, optRice],
                        ['Cơm Cà Ri Heo Chiên', 150000, 2, false, optRice],
                        ['Cơm Chiên Tỏi Đập Thịt Bò', 165000, 2, true, optRice],
                        ['Cơm Chiên Cá Hồi', 145000, 2, false, optRice],
                        ['Bánh Xèo Nhật Okonomiyaki', 125000, 2, false, [{ name: 'Topping', isRequired: false, multipleChoice: true, minSelect: 0, maxSelect: 2, items: [{ name: 'Thêm Cá bào', priceAdjustment: 15000 }, { name: 'Thêm Mayo', priceAdjustment: 5000 }] }]],
                        ['Bánh Bạch Tuộc Takoyaki (6 viên)', 85000, 2, true, null],
                        ['Trứng Hấp Hải Sản Chawanmushi', 65000, 2, true, null],
                        ['Súp Miso Truyền Thống', 35000, 2, false, null],
                        ['Súp Nghêu Trong Suốt', 55000, 2, false, null],
                        ['Cá Tuyết Nướng Xốt Miso', 380000, 2, true, null],
                        ['Cá Hồi Nướng Muối', 180000, 2, false, null],
                        ['Đầu Cá Hồi Nướng Teriyaki', 140000, 2, true, null],
                        ['Bò Wagyu A5 Nướng Đá Muối', 1500000, 2, true, [{ name: 'Độ chín', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Rare', priceAdjustment: 0 }, { name: 'Medium Rare', priceAdjustment: 0, isDefault: true }, { name: 'Medium', priceAdjustment: 0 }] }]],
                        ['Gà Xiên Nướng Yakitori (2 Xiên)', 55000, 2, true, null],
                        ['Lõi Thăn Bò Xiên Nướng', 95000, 2, false, null],
                        ['Tempura Tôm Phủ Cốm (3 con)', 125000, 2, true, null],
                        ['Tempura Rau Củ Thập Cẩm', 85000, 2, false, null],
                        ['Đậu Nành Nhật Edamame', 45000, 2, false, null],
                        // --- 4. SET OMAKASE & COMBO (20 Món) ---
                        ['Bento Trưa Văn Phòng - Gà Teriyaki', 150000, 3, true, optRice],
                        ['Bento Trưa - Cá Hồi Nướng', 180000, 3, false, optRice],
                        ['Bento Trưa - Lươn Nhật', 250000, 3, true, optRice],
                        ['Bento Trưa - Heo Chiên Katsu', 165000, 3, false, optRice],
                        ['Combo Lẩu Shabu Bò Mỹ (2-3 người)', 550000, 3, true, [{ name: 'Nước lẩu', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Nước lẩu Thái Tôm Yum', priceAdjustment: 0 }, { name: 'Nước lẩu Nấm thanh ngọt', priceAdjustment: 0, isDefault: true }, { name: 'Nước lẩu Miso', priceAdjustment: 0 }] }]],
                        ['Combo Lẩu Shabu Bò Wagyu', 1250000, 3, false, [{ name: 'Nước lẩu', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Nước lẩu Cà Chua Miso', priceAdjustment: 0 }, { name: 'Nước lẩu Nấm', priceAdjustment: 0, isDefault: true }] }]],
                        ['Combo Lẩu Sukiyaki', 650000, 3, true, null],
                        ['Combo Lẩu Đầu Cá Hồi', 450000, 3, false, null],
                        ['Set Sushi Mini Cho Trẻ Em', 120000, 3, false, null],
                        ['Set Omakase Khai Vị (7 Món)', 850000, 3, false, null],
                        ['Set Omakase Bếp Trưởng (12 Món)', 1500000, 3, true, null],
                        ['Set Omakase VIP Kèm Rượu', 2500000, 3, false, null],
                        ['Party Sushi Khay Gỗ (Size M)', 650000, 3, true, null],
                        ['Party Sushi Khay Gỗ (Size L)', 1100000, 3, true, null],
                        ['Combo Salmon Lover (Toàn Cá Hồi)', 580000, 3, true, null],
                        ['Combo Maguro Lover (Toàn Cá Ngừ)', 620000, 3, false, null],
                        ['Set Đồ Nướng Yakiniku Tổng Hợp', 950000, 3, false, null],
                        ['Set Chay Thiền Phái Zen', 350000, 3, false, null],
                        ['Mẹt Ăn Vặt Izakaya (Cho bia)', 450000, 3, true, null],
                        ['Combo Date Night (Cho 2 người)', 1800000, 3, true, null],
                        // --- 5. ĐỒ UỐNG & TRÁNG MIỆNG (20 Món) ---
                        ['Trà Xanh Mộc Nhật Bản (Đá/Nóng)', 25000, 4, true, optDrinks],
                        ['Trà Olong Rang Houjicha', 35000, 4, false, optDrinks],
                        ['Trà Trái Cây Yuzu Thanh Yên', 55000, 4, true, optDrinks],
                        ['Matcha Latte Mát Lạnh', 65000, 4, true, optDrinks],
                        ['Matcha Đá Xay Kem Tươi', 85000, 4, false, optDrinks],
                        ['Nước Ép Tươi Dưa Hấu', 50000, 4, false, optDrinks],
                        ['Nước Ép Tươi Thơm', 50000, 4, false, optDrinks],
                        ['Nước Ngọt Coca Cola', 25000, 4, false, optDrinks],
                        ['Sake Junmai Khô (Bình 150ml)', 180000, 4, true, [{ name: 'Cách dùng', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Hâm Nóng', priceAdjustment: 0, isDefault: true }, { name: 'Ướp Lạnh', priceAdjustment: 0 }] }]],
                        ['Sake Daiginjo Cao Cấp (Bình 300ml)', 450000, 4, false, null],
                        ['Chai Sake Hakutsuru 720ml', 1200000, 4, false, null],
                        ['Rượu Mơ Choya (Ly 50ml)', 85000, 4, true, [{ name: 'Uống kèm', isRequired: true, multipleChoice: false, minSelect: 1, maxSelect: 1, items: [{ name: 'Thêm đá viên to', priceAdjustment: 0, isDefault: true }, { name: 'Pha Soda', priceAdjustment: 15000 }] }]],
                        ['Rượu Mơ Vảy Vàng Kikkoman', 950000, 4, false, null],
                        ['Bia Tươi Sapporo Khổng Lồ', 75000, 4, true, null],
                        ['Bia Tiger Bạc', 45000, 4, false, null],
                        ['Bánh Mochi Trà Xanh Ngân Lạnh', 45000, 4, true, null],
                        ['Bánh Mochi Dâu Tây Tươi', 55000, 4, true, null],
                        ['Bánh Mochi Đậu Đỏ Dẻo', 45000, 4, false, null],
                        ['Kem Cây Matcha Thượng Hạng', 65000, 4, true, null],
                        ['Kem Yuzu Sorbet Giải Nhiệt', 75000, 4, false, null]
                    ];
                    prodCount = 1;
                    createdProducts = [];
                    _i = 0, rawProducts_1 = rawProducts;
                    _c.label = 22;
                case 22:
                    if (!(_i < rawProducts_1.length)) return [3 /*break*/, 29];
                    p = rawProducts_1[_i];
                    name_1 = p[0], price = p[1], catIdx = p[2], isBest = p[3], options = p[4];
                    return [4 /*yield*/, prisma.product.create({
                            data: {
                                itemCode: "PRD-".concat(prodCount.toString().padStart(3, '0')),
                                name: name_1,
                                slug: "san-pham-".concat(prodCount, "-").concat(Math.random().toString(36).substring(7)),
                                price: price,
                                isBestSeller: isBest,
                                isAiRecommended: Math.random() > 0.8,
                                imageUrl: categories[catIdx].image,
                                categoryId: categories[catIdx].id,
                                branches: { connect: getRandomBranches(branches, 2, 5) },
                            }
                        })];
                case 23:
                    product = _c.sent();
                    createdProducts.push(product);
                    opts = options;
                    if (!(opts && Array.isArray(opts))) return [3 /*break*/, 27];
                    _loop_1 = function (gIndex) {
                        var groupDef, group, itemsToCreate;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    groupDef = opts[gIndex];
                                    return [4 /*yield*/, prisma.optionGroup.create({
                                            data: {
                                                productId: product.id,
                                                name: groupDef.name,
                                                isRequired: groupDef.isRequired,
                                                multipleChoice: groupDef.multipleChoice,
                                                minSelect: groupDef.minSelect,
                                                maxSelect: groupDef.maxSelect,
                                                displayOrder: gIndex
                                            }
                                        })];
                                case 1:
                                    group = _d.sent();
                                    itemsToCreate = groupDef.items.map(function (item, iIndex) { return ({
                                        optionGroupId: group.id,
                                        name: item.name,
                                        priceAdjustment: item.priceAdjustment,
                                        isDefault: item.isDefault || false,
                                        displayOrder: iIndex
                                    }); });
                                    return [4 /*yield*/, prisma.optionItem.createMany({ data: itemsToCreate })];
                                case 2:
                                    _d.sent();
                                    return [2 /*return*/];
                            }
                        });
                    };
                    gIndex = 0;
                    _c.label = 24;
                case 24:
                    if (!(gIndex < opts.length)) return [3 /*break*/, 27];
                    return [5 /*yield**/, _loop_1(gIndex)];
                case 25:
                    _c.sent();
                    _c.label = 26;
                case 26:
                    gIndex++;
                    return [3 /*break*/, 24];
                case 27:
                    prodCount++;
                    _c.label = 28;
                case 28:
                    _i++;
                    return [3 /*break*/, 22];
                case 29:
                    console.log("\u0110\u00E3 t\u1EA1o th\u00E0nh c\u00F4ng ".concat(createdProducts.length, " m\u00F3n \u0103n k\u00E8m c\u00E1c T\u00F9y ch\u1ECDn (Options)!"));
                    console.log('5. Đang tạo Vouchers (Khuyến mãi)...');
                    now = new Date();
                    nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return [4 /*yield*/, Promise.all([
                            prisma.voucher.create({ data: { code: 'WELCOME50', title: 'Giảm 50K cho bạn mới', discountType: client_1.DiscountType.FIXED_AMOUNT, discountValue: 50000, minOrderValue: 200000, startDate: now, endDate: nextMonth, usageLimit: 1000 } }),
                            prisma.voucher.create({ data: { code: 'FREESHIP', title: 'Miễn phí giao hàng (Tối đa 30K)', discountType: client_1.DiscountType.FREE_SHIP, discountValue: 30000, minOrderValue: 300000, startDate: now, endDate: nextMonth } }),
                            prisma.voucher.create({ data: { code: 'VIPGOLD', title: 'Giảm 10% Hạng Vàng', discountType: client_1.DiscountType.PERCENTAGE, discountValue: 10, maxDiscount: 200000, minOrderValue: 500000, startDate: now, endDate: nextMonth, membershipTierId: tiers[2].id } }),
                        ])];
                case 30:
                    vouchers = _c.sent();
                    console.log('6. Đang tạo Flash Sale...');
                    return [4 /*yield*/, prisma.flashSale.create({
                            data: {
                                name: 'Giờ Vàng Sushi - Nửa Giá',
                                startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
                                endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000),
                                isActive: true,
                                items: {
                                    create: [
                                        { productId: createdProducts[0].id, flashSalePrice: createdProducts[0].price * 0.5, stock: 50, maxQuantityPerUser: 2 },
                                        { productId: createdProducts[15].id, flashSalePrice: createdProducts[15].price * 0.7, stock: 100, maxQuantityPerUser: 5 }
                                    ]
                                }
                            }
                        })];
                case 31:
                    flashSale = _c.sent();
                    console.log('7. Đang tạo Banners & Users...');
                    return [4 /*yield*/, prisma.banner.createMany({
                            data: [
                                { imageUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=1920', linkUrl: '/flash-sale', bannerOrder: 1, altText: 'Flash Sale Đang Diễn Ra' },
                                { imageUrl: 'https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=1920', linkUrl: '/menu/sashimi', bannerOrder: 2, altText: 'Hải Sản Nhập Khẩu' },
                            ]
                        })];
                case 32:
                    _c.sent();
                    return [4 /*yield*/, Promise.all([
                            prisma.user.create({ data: { email: 'admin@avora.vn', fullName: 'Quản trị viên', passwordHash: 'hashed_123', role: client_1.RoleType.ADMIN } }),
                            prisma.user.create({
                                data: {
                                    email: 'khachhang1@gmail.com', fullName: 'Trần Đại Phát', phone: '0901234567', passwordHash: 'hashed_123',
                                    points: 1500, branchId: branches[0].id, membershipTierId: tiers[2].id,
                                    addresses: {
                                        create: [{ recipientName: 'Trần Đại Phát', phone: '0901234567', streetDetail: '123 Nguyễn Huệ', ward: 'Bến Nghé', district: 'Quận 1', province: 'TP.HCM', isDefault: true, latitude: 10.774, longitude: 106.703 }]
                                    }
                                }
                            })
                        ])];
                case 33:
                    users = _c.sent();
                    console.log('8. Đang tạo Lịch sử Đơn hàng kèm Option (OrderItemOption)...');
                    ramenProduct = createdProducts[25];
                    return [4 /*yield*/, prisma.optionGroup.findMany({ where: { productId: ramenProduct.id }, include: { optionItems: true } })];
                case 34:
                    optionGroups = _c.sent();
                    selectedSize = (_a = optionGroups[0]) === null || _a === void 0 ? void 0 : _a.optionItems[1];
                    selectedTopping = (_b = optionGroups[2]) === null || _b === void 0 ? void 0 : _b.optionItems[0];
                    itemPriceAtSale = ramenProduct.price + ((selectedSize === null || selectedSize === void 0 ? void 0 : selectedSize.priceAdjustment) || 0) + ((selectedTopping === null || selectedTopping === void 0 ? void 0 : selectedTopping.priceAdjustment) || 0);
                    subTotal1 = itemPriceAtSale * 1;
                    discount1 = 0;
                    totalAmount1 = subTotal1 - discount1 + 15000;
                    return [4 /*yield*/, prisma.order.create({
                            data: {
                                userId: users[1].id, branchId: branches[0].id, orderCode: 'ORD-RAMEN-01', customerName: 'Trần Đại Phát', customerPhone: '0901234567', deliveryAddress: '123 Nguyễn Huệ, Quận 1',
                                subTotal: subTotal1, shippingFee: 15000, discountAmount: discount1, totalAmount: totalAmount1,
                                status: client_1.OrderStatus.COMPLETED, paymentMethod: 'VN_PAY', paymentStatus: 'PAID'
                            }
                        })];
                case 35:
                    order1 = _c.sent();
                    return [4 /*yield*/, prisma.orderItem.create({
                            data: {
                                orderId: order1.id, productId: ramenProduct.id, quantity: 1,
                                priceAtSale: itemPriceAtSale, originalPriceAtSale: ramenProduct.price,
                                optionsTextSnapshot: 'Size Lớn (Thêm mì), Thêm Trứng lòng đào (Ajitama)'
                            }
                        })];
                case 36:
                    orderItem = _c.sent();
                    if (!(selectedSize && selectedTopping)) return [3 /*break*/, 38];
                    return [4 /*yield*/, prisma.orderItemOption.createMany({
                            data: [
                                { orderItemId: orderItem.id, optionItemId: selectedSize.id, nameAtSale: selectedSize.name, priceAdjustmentAtSale: selectedSize.priceAdjustment },
                                { orderItemId: orderItem.id, optionItemId: selectedTopping.id, nameAtSale: selectedTopping.name, priceAdjustmentAtSale: selectedTopping.priceAdjustment }
                            ]
                        })];
                case 37:
                    _c.sent();
                    _c.label = 38;
                case 38:
                    console.log('🎉 Seeding hoàn tất! Dữ liệu của 120 món ăn kèm Option Topping đầy đủ.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
