import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

export const ALL_CHATBOT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // ==========================================
  // 1. CHI NHÁNH & THÔNG TIN CHUNG
  // ==========================================
  {
    name: 'listBranches',
    description: 'Lấy danh sách tất cả chi nhánh của nhà hàng Avora kèm địa chỉ, số điện thoại, giờ mở/đóng cửa và khả năng nhận đặt bàn hoặc giao hàng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reservationOnly: {
          type: SchemaType.BOOLEAN,
          description: 'Chỉ lấy các chi nhánh có hỗ trợ đặt bàn (mặc định: false)'
        },
        deliveryOnly: {
          type: SchemaType.BOOLEAN,
          description: 'Chỉ lấy các chi nhánh có nhận đơn giao hàng trực tuyến (mặc định: false)'
        }
      }
    }
  },
  {
    name: 'getBranchDetail',
    description: 'Xem thông tin chi tiết của một chi nhánh cụ thể (địa chỉ, số điện thoại, giờ hoạt động, tiện ích, vị trí bản đồ).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID của chi nhánh' },
        branchName: { type: SchemaType.STRING, description: 'Tên hoặc từ khóa chi nhánh nếu không biết ID' }
      }
    }
  },
  {
    name: 'findNearestBranch',
    description: 'Tìm chi nhánh gần vị trí của khách hàng nhất theo tọa độ GPS (vĩ độ, kinh độ).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        latitude: { type: SchemaType.NUMBER, description: 'Vĩ độ GPS của khách hàng' },
        longitude: { type: SchemaType.NUMBER, description: 'Kinh độ GPS của khách hàng' }
      },
      required: ['latitude', 'longitude']
    }
  },

  // ==========================================
  // 2. THỰC ĐƠN & TÙY CHỌN MÓN (OPTIONS)
  // ==========================================
  {
    name: 'searchMenu',
    description: 'Tìm kiếm món ăn trong thực đơn theo từ khóa (VD: cá hồi, sushi, lẩu), ngân sách tối đa, chế độ ăn (chay, keto), chất gây dị ứng hoặc từ khóa hot/bestseller.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Từ khóa tìm món hoặc tên món' },
        budget: { type: SchemaType.NUMBER, description: 'Ngân sách tối đa cho món ăn (VNĐ)' },
        dietary: { type: SchemaType.STRING, description: 'Chế độ ăn kiêng (chay, keto, healthy)' },
        category: { type: SchemaType.STRING, description: 'Tên danh mục món' },
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh muốn kiểm tra món' }
      }
    }
  },
  {
    name: 'getProductDetail',
    description: 'Lấy chi tiết món ăn, bao gồm giá gốc, giá Flash Sale (nếu đang diễn ra), mô tả, và CÁC NHÓM TÙY CHỌN BẮT BUỘC / TỰ CHỌN (Size, Độ cay, Topping kèm phụ phí). BẮT BUỘC GỌI HÀM NÀY NẾU MÓN CÓ NHIỀU SIZE HOẶC TÙY CHỌN.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'ID món ăn' },
        productName: { type: SchemaType.STRING, description: 'Tên món ăn nếu không có ID' }
      }
    }
  },

  // ==========================================
  // 3. GIỎ HÀNG TRÊN SERVER (SERVER CART)
  // ==========================================
  {
    name: 'addToCart',
    description: 'Thêm món ăn vào giỏ hàng trên máy chủ kèm số lượng, các tùy chọn (Options: Size, Topping...) và ghi chú riêng. NẾU MÓN CÓ OPTION BẮT BUỘC, PHẢI HỎI KHÁCH VÀ TRUYỀN optionItemIds.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: { type: SchemaType.STRING, description: 'ID món ăn' },
        productName: { type: SchemaType.STRING, description: 'Tên món ăn (nếu không biết ID)' },
        quantity: { type: SchemaType.NUMBER, description: 'Số lượng phần ăn (mặc định: 1)' },
        optionItemIds: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Danh sách ID của các tùy chọn đã chọn (Size, Vị, Topping)'
        },
        note: { type: SchemaType.STRING, description: 'Ghi chú cho món (VD: ít đường, không hành)' }
      }
    }
  },
  {
    name: 'updateCartItem',
    description: 'Cập nhật số lượng của một món trong giỏ hàng (truyền quantity = 0 để xóa món khỏi giỏ).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        lineId: { type: SchemaType.STRING, description: 'Mã dòng món trong giỏ (nếu biết)' },
        productName: { type: SchemaType.STRING, description: 'Tên món cần chỉnh sửa' },
        quantity: { type: SchemaType.NUMBER, description: 'Số lượng mới (0 để xóa)' },
        note: { type: SchemaType.STRING, description: 'Ghi chú mới nếu muốn sửa' }
      }
    }
  },
  {
    name: 'getCart',
    description: 'Xem toàn bộ giỏ hàng hiện tại, bao gồm danh sách món, tùy chọn, số lượng, đơn giá và tổng tạm tính.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}
    }
  },
  {
    name: 'clearCart',
    description: 'Xóa sạch toàn bộ giỏ hàng hiện tại khi khách hàng muốn chọn lại từ đầu.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}
    }
  },

  // ==========================================
  // 4. ĐỊA CHỈ & KHUNG GIỜ GIAO HÀNG (SLOTS)
  // ==========================================
  {
    name: 'getUserAddresses',
    description: 'Lấy danh sách các địa chỉ giao hàng đã lưu trong tài khoản của khách hàng (đánh dấu địa chỉ mặc định). GỌI HÀM NÀY KHI BẮT ĐẦU CHỐT ĐƠN GIAO HÀNG.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}
    }
  },
  {
    name: 'validateDeliveryAddress',
    description: 'Kiểm tra xem địa chỉ nhận hàng có nằm trong bán kính giao hàng của chi nhánh hay không và tính phí ship ước tính.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        addressId: { type: SchemaType.STRING, description: 'ID địa chỉ có sẵn của khách' },
        streetDetail: { type: SchemaType.STRING, description: 'Số nhà, tên đường' },
        ward: { type: SchemaType.STRING, description: 'Phường/Xã' },
        province: { type: SchemaType.STRING, description: 'Tỉnh/Thành phố' },
        latitude: { type: SchemaType.NUMBER, description: 'Vĩ độ GPS' },
        longitude: { type: SchemaType.NUMBER, description: 'Kinh độ GPS' },
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh giao hàng' }
      }
    }
  },
  {
    name: 'saveAddress',
    description: 'Lưu địa chỉ giao hàng mới vào sổ địa chỉ của tài khoản khách hàng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        recipientName: { type: SchemaType.STRING, description: 'Tên người nhận' },
        phone: { type: SchemaType.STRING, description: 'Số điện thoại nhận hàng (10 chữ số)' },
        streetDetail: { type: SchemaType.STRING, description: 'Số nhà, đường' },
        ward: { type: SchemaType.STRING, description: 'Phường/Xã' },
        province: { type: SchemaType.STRING, description: 'Tỉnh/Thành phố' },
        latitude: { type: SchemaType.NUMBER, description: 'Vĩ độ GPS (nếu có)' },
        longitude: { type: SchemaType.NUMBER, description: 'Kinh độ GPS (nếu có)' }
      },
      required: ['recipientName', 'phone', 'streetDetail', 'ward', 'province']
    }
  },
  {
    name: 'getAvailableOrderSlots',
    description: 'Lấy danh sách các khung giờ giao hàng (hoặc nhận món mang về) khả dụng của chi nhánh cho ngày được chọn (VD: 11:30 - 12:30, 18:00 - 19:00). BẮT BUỘC GỌI TRƯỚC KHI TẠO ĐƠN.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh' },
        date: { type: SchemaType.STRING, description: 'Ngày giao hàng định dạng YYYY-MM-DD (mặc định: hôm nay)' },
        orderType: {
          type: SchemaType.STRING,
          description: 'Hình thức: DELIVERY (Giao hàng) hoặc TAKE_AWAY (Mang về)',
        },
        requestedTime: {
          type: SchemaType.STRING,
          description: 'Giờ cụ thể khách yêu cầu nếu có (ví dụ: "11:45", "12h", "19:30", "7h tối"). Hệ thống sẽ tự động đối chiếu và chọn khung giờ phù hợp gần nhất.',
        }
      }
    }
  },

  // ==========================================
  // 5. VOUCHER & ĐIỂM THÀNH VIÊN (LOYALTY)
  // ==========================================
  {
    name: 'findApplicableVouchers',
    description: 'Tìm kiếm tất cả các mã giảm giá (voucher món ăn và voucher freeship) hợp lệ cho đơn hàng hiện tại dựa trên giá trị giỏ hàng và hạng thành viên của khách.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh' }
      }
    }
  },
  {
    name: 'applyVoucher',
    description: 'Áp dụng mã giảm giá vào đơn hàng. Hệ thống hỗ trợ đồng thời tối đa 1 mã giảm món ăn (discountVoucherCode) VÀ 1 mã miễn phí vận chuyển (shippingVoucherCode).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        discountVoucherCode: { type: SchemaType.STRING, description: 'Mã voucher giảm giá món ăn (VD: GIAM20K, VIPDIAMOND)' },
        shippingVoucherCode: { type: SchemaType.STRING, description: 'Mã voucher miễn phí/giảm giá vận chuyển (VD: FREESHIP)' }
      }
    }
  },
  {
    name: 'removeVoucher',
    description: 'Gỡ bỏ voucher đang áp dụng khỏi đơn hàng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        removeDiscountVoucher: { type: SchemaType.BOOLEAN, description: 'Gỡ voucher giảm món' },
        removeShippingVoucher: { type: SchemaType.BOOLEAN, description: 'Gỡ voucher giảm ship' }
      }
    }
  },
  {
    name: 'getMembershipStatus',
    description: 'Tra cứu thông tin thành viên: Hạng thẻ (Đồng, Bạc, Vàng, Kim Cương), tổng chi tiêu, số điểm thưởng hiện có và tỷ lệ quy đổi điểm.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}
    }
  },
  {
    name: 'previewPointUsage',
    description: 'Tính toán số tiền được giảm khi sử dụng một số lượng điểm tích lũy cụ thể cho đơn hàng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        pointsToUse: { type: SchemaType.NUMBER, description: 'Số điểm muốn tiêu' }
      },
      required: ['pointsToUse']
    }
  },

  // ==========================================
  // 6. PHƯƠNG THỨC THANH TOÁN & PREVIEW ĐƠN
  // ==========================================
  {
    name: 'getPaymentMethods',
    description: 'Lấy danh sách các phương thức thanh toán khả dụng cho đơn hàng (COD - Tiền mặt khi nhận, Chuyển khoản ngân hàng, QR PayOS, MoMo, VNPay).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh' }
      }
    }
  },
  {
    name: 'previewOrder',
    description: 'TÍNH TOÁN VÀ XEM TRƯỚC TOÀN BỘ ĐƠN HÀNG: Trả về phân rã chuẩn từ server (tiền món, giảm giá, phí ship, điểm trừ, thuế VAT, tổng thanh toán). BẮT BUỘC GỌI VÀ ĐỌC TỔNG TIỀN CHO KHÁCH TRƯỚC KHI ĐẶT ĐƠN.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fulfillmentType: { type: SchemaType.STRING, description: 'Hình thức: DELIVERY, TAKE_AWAY, DINE_IN' },
        addressId: { type: SchemaType.STRING, description: 'ID địa chỉ nhận hàng (nếu DELIVERY)' },
        operatingSlotId: { type: SchemaType.STRING, description: 'ID khung giờ nhận đơn' },
        deliveryDate: { type: SchemaType.STRING, description: 'Ngày giao hàng YYYY-MM-DD' },
        discountVoucherCode: { type: SchemaType.STRING, description: 'Mã voucher món (nếu có)' },
        shippingVoucherCode: { type: SchemaType.STRING, description: 'Mã voucher ship (nếu có)' },
        pointsToUse: { type: SchemaType.NUMBER, description: 'Số điểm muốn tiêu (nếu có)' },
        paymentMethod: { type: SchemaType.STRING, description: 'Phương thức thanh toán: COD, TRANSFER, PAYOS, MOMO, VNPAY' }
      }
    }
  },
  {
    name: 'placeOrder',
    description: 'CHÍNH THỨC TẠO ĐƠN HÀNG TRÊN HỆ THỐNG sau khi khách hàng đã xem previewOrder và nói xác nhận đồng ý đặt hàng.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        paymentMethod: { type: SchemaType.STRING, description: 'Phương thức thanh toán đã chọn (COD, TRANSFER, PAYOS, MOMO, VNPAY)' },
        note: { type: SchemaType.STRING, description: 'Ghi chú chung cho toàn bộ đơn hàng' },
        idempotencyKey: { type: SchemaType.STRING, description: 'Khóa chống tạo đơn lặp ngẫu nhiên' }
      }
    }
  },
  {
    name: 'checkOrder',
    description: 'Tra cứu trạng thái và tiến độ của đơn hàng (Đang chuẩn bị, Đang giao, Đã hoàn thành...) theo mã đơn hàng hoặc lấy đơn gần nhất của khách.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderCode: { type: SchemaType.STRING, description: 'Mã đơn hàng (VD: AVO-260913-0001)' }
      }
    }
  },
  {
    name: 'cancelOrder',
    description: 'Hủy đơn hàng nếu đơn hàng vẫn đang ở trạng thái Chờ xác nhận (PENDING).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderCode: { type: SchemaType.STRING, description: 'Mã đơn hàng cần hủy' },
        reason: { type: SchemaType.STRING, description: 'Lý do hủy đơn hàng' }
      },
      required: ['orderCode', 'reason']
    }
  },

  // ==========================================
  // 7. NGHIỆP VỤ ĐẶT BÀN (TABLE RESERVATION)
  // ==========================================
  {
    name: 'getReservationSlots',
    description: 'Kiểm tra các khung giờ đặt bàn còn chỗ tại một chi nhánh vào một ngày cụ thể cho số lượng khách nhất định.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh muốn đặt bàn' },
        date: { type: SchemaType.STRING, description: 'Ngày đặt bàn định dạng YYYY-MM-DD' },
        partySize: { type: SchemaType.NUMBER, description: 'Số lượng người đi cùng (mặc định: 2)' }
      },
      required: ['branchId', 'date']
    }
  },
  {
    name: 'previewReservation',
    description: 'Kiểm tra điều kiện và tóm tắt toàn bộ thông tin đặt bàn (Chi nhánh, Ngày, Giờ, Số khách, Tên, SĐT, Vị trí ưu tiên) để khách hàng kiểm tra và xác nhận.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh' },
        reservationDate: { type: SchemaType.STRING, description: 'Ngày đặt (YYYY-MM-DD)' },
        reservationTime: { type: SchemaType.STRING, description: 'Giờ đặt (HH:mm)' },
        partySize: { type: SchemaType.NUMBER, description: 'Số lượng khách' },
        customerName: { type: SchemaType.STRING, description: 'Tên người đặt bàn' },
        customerPhone: { type: SchemaType.STRING, description: 'Số điện thoại liên hệ' },
        customerEmail: { type: SchemaType.STRING, description: 'Email liên hệ (nếu có)' },
        seatingPreference: { type: SchemaType.STRING, description: 'Sở thích chỗ ngồi: Cửa sổ, Ngoài trời, Trong nhà, Phòng riêng VIP...' },
        specialRequests: { type: SchemaType.STRING, description: 'Yêu cầu đặc biệt (sinh nhật, ghế trẻ em, trang trí tiệc...)' }
      },
      required: ['branchId', 'reservationDate', 'reservationTime', 'partySize', 'customerName', 'customerPhone']
    }
  },
  {
    name: 'createReservation',
    description: 'TẠO ĐẶT BÀN CHÍNH THỨC trong hệ thống sau khi khách hàng đã xem previewReservation và xác nhận đồng ý.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        branchId: { type: SchemaType.STRING, description: 'ID chi nhánh' },
        reservationDate: { type: SchemaType.STRING, description: 'Ngày đặt (YYYY-MM-DD)' },
        reservationTime: { type: SchemaType.STRING, description: 'Giờ đặt (HH:mm)' },
        partySize: { type: SchemaType.NUMBER, description: 'Số lượng khách' },
        customerName: { type: SchemaType.STRING, description: 'Tên người đặt' },
        customerPhone: { type: SchemaType.STRING, description: 'Số điện thoại' },
        customerEmail: { type: SchemaType.STRING, description: 'Email' },
        seatingPreference: { type: SchemaType.STRING, description: 'Sở thích vị trí' },
        specialRequests: { type: SchemaType.STRING, description: 'Yêu cầu đặc biệt' },
        idempotencyKey: { type: SchemaType.STRING, description: 'Khóa chống tạo đặt bàn trùng lặp' }
      },
      required: ['branchId', 'reservationDate', 'reservationTime', 'partySize', 'customerName', 'customerPhone']
    }
  },
  {
    name: 'getMyReservations',
    description: 'Tra cứu danh sách các lịch đặt bàn sắp tới của khách hàng theo tài khoản đăng nhập hoặc số điện thoại.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        phone: { type: SchemaType.STRING, description: 'Số điện thoại nếu khách chưa đăng nhập' }
      }
    }
  },
  {
    name: 'cancelReservation',
    description: 'Hủy lịch đặt bàn đã có bằng mã đặt bàn (VD: AVR-260914-0001) và số điện thoại.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reservationCode: { type: SchemaType.STRING, description: 'Mã đặt bàn cần hủy' },
        phone: { type: SchemaType.STRING, description: 'Số điện thoại khi đặt bàn' },
        reason: { type: SchemaType.STRING, description: 'Lý do hủy bàn' }
      },
      required: ['reservationCode', 'phone']
    }
  },

  // ==========================================
  // 8. ĐIỀU KHIỂN GIAO DIỆN & TIỆN ÍCH
  // ==========================================
  {
    name: 'stopVoice',
    description: 'Dừng chế độ đàm thoại giọng nói khi khách hàng chào tạm biệt, cảm ơn hoặc yêu cầu ngắt máy.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {}
    }
  },
  {
    name: 'handoffToHuman',
    description: 'Chuyển cuộc trò chuyện sang nhân viên tư vấn người thật khi khách hàng yêu cầu hoặc khi gặp khiếu nại phức tạp.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        reason: { type: SchemaType.STRING, description: 'Lý do chuyển nhân viên hỗ trợ' }
      },
      required: ['reason']
    }
  }
];
