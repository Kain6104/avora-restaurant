# ART BIBLE: AVORA ENCHANTED FARM

> **Version:** 2.0 — Production Mobile Game Art Specification  
> **Target Audience:** Khách hàng cao cấp của hệ sinh thái AVORA Restaurant  
> **Concept:** *AVORA Enchanted Farm* — Vườn Tiên Ẩm Thực Hoàng Gia Nhật Bản trên Đảo Nổi  
> **Standard:** High-end Mobile Farming Game (Chuẩn mỹ thuật Liên Quân / Honor of Kings Farm, Genshin Serenitea Pot, Animal Crossing, Hay Day Modern)

---

## 1. ART DIRECTION & PHONG CÁCH TỔNG THỂ

### A. Triết Lý Mỹ Thuật
- **KHÔNG ĐƯỢC:**
  - Nền đen / xanh đen khổng lồ hoặc không gian vũ trụ tối tăm (Dark Cyber / Neon).
  - Hình vẽ vector phẳng (Flat Vector / Clipart / Web game 2000s).
  - Đồ họa tự vẽ bằng code hình học (Procedural Graphics / Primitive Polygons / Circles / Diamonds).
  - Pixel art, Low-poly, Minimalist thô cứng.
- **MỤC TIÊU CẦN ĐẠT:**
  - **Tone sáng rực rỡ, ấm áp và mộng mơ (Bright, Warm, Magical Daytime).**
  - Đồ họa minh họa 2.5D Isometric vẽ tay cao cấp (Hand-painted Isometric Illustration).
  - Thế giới thần tiên ngập tràn ánh nắng ban mai, mây trôi bồng bềnh, vườn hoa anh đào nở rộ, cỏ xanh mướt mát, suối nước trong vắt và các công trình kiến trúc truyền thống Nhật Bản (Torii, đèn đá Toro, cầu gỗ cong, Cây Đại Thụ cổ kính).
  - Giao diện người dùng (UI/HUD) mang phong cách Game Mobile Thần Thoại: Tấm thẻ ngọc ngà (Cream / Ivory Parchment), viền vàng kim uốn lượn (Soft Gold Filigree), điểm xuyết sắc đỏ son hoàng gia AVORA.

---

## 2. BẢNG MÀU CHUẨN (PALETTE SYSTEM)

| Nhóm Màu | Tên Mã Màu | Giá Trị Hex | Ứng Dụng |
| :--- | :--- | :--- | :--- |
| **Primary Ground** | Fresh Meadow Green | `#8bc34a` - `#689f38` | Nền cỏ đảo chính, tươi sáng và mọng nước |
| **Secondary Ground** | Lime Sunlight Grass | `#cddc39` - `#aeea00` | Vạt cỏ đón ánh nắng, tạo độ bóng và rực rỡ |
| **Soil Tone** | Warm Terracotta | `#8d6e63` - `#5d4037` | Đất tơi xốp, màu nâu ấm đất phù sa |
| **Water Tone** | Turquoise Shimmer | `#26c6da` - `#0097a7` | Suối nước ngọc bích, phản chiếu trời mây |
| **Sky / Atmosphere** | Soft Pastel Sky | `#e0f7fa` - `#fff9c4` | Bầu trời ban mai ấm áp, gradient mây hồng vàng |
| **Sakura Accent** | Ethereal Sakura Pink | `#f48fb1` - `#f06292` | Cánh hoa anh đào, hoa dại, hào quang |
| **Wood Accent** | Warm Japanese Wood | `#bcaaa4` - `#795548` | Hàng rào gỗ, cọc leo, cầu gỗ, thân cây |
| **Architecture** | Vermilion Torii Red | `#d32f2f` - `#b71c1c` | Cổng Torii, ruy băng thần đạo, điểm nhấn AVORA |
| **UI Surface** | Cream Ivory Parchment | `#fffdf7` - `#fcf6e8` | Thẻ nền giao diện, bảng thông tin |
| **UI Border** | Imperial Soft Gold | `#e0a93b` - `#ffd54f` | Viền mạ vàng, khung avatar, nút chức năng |

---

## 3. QUY CHUẨN GÓC NHÌN & HỆ THỐNG TỌA ĐỘ ISOMETRIC

- **Tỉ lệ Isometric:** `2 : 1` (Dimetric Standard).
- **Kích thước Ô cơ sở (Tile Size):** `128 px` chiều rộng × `64 px` chiều cao.
- **Góc chiếu sáng (Light Source):**
  - Nguồn sáng chính từ góc **Top-Left (10:30 sáng)** chiếu xuống góc 4:30 chiều.
  - Ánh sáng ấm, nhẹ nhàng của nắng mai (Soft Sunlight).
- **Quy chuẩn bóng đổ (Shadow Standard):**
  - Tuyệt đối không dùng bóng đen tuyền (`rgba(0,0,0,1)`).
  - Dùng **Soft Ambient Occlusion**: Tone xanh lam tím sẫm ấm (`rgba(28, 40, 56, 0.25 - 0.35)`), mờ dần về phía viền (Gaussian Blur 6-12px).
- **Điểm neo (Origin / Footpoint):**
  - Mọi object mặt đất (Cây trồng, Đèn, Cổng, Cây đại thụ) có `origin = (0.5, 0.85 - 0.95)` trùng với gốc chân cắm xuống đất.
- **Độ sâu (Depth Sorting Formula):**
  $$\text{depth} = \text{worldY} \times 10 + \text{layerOffset}$$
  Đảm bảo cây hàng trước không che lấp sai lớp chân của cây hàng sau.

---

## 4. BỐ CỤC KHÔNG GIAN TOÀN CẢNH (WORLD COMPOSITION)

Màn hình game không còn một hòn đảo nhỏ cô lập giữa nền đen, mà là **một bức tranh phong cảnh hoàn chỉnh 5 lớp chiều sâu (5 Depth Layers)**:

```text
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Vòm trời Pastel mộng mơ + Mây bồng bềnh + Ánh dương │
│                                                             │
│ LAYER 2: Dãy núi xa mờ sương + Đảo lơ lửng + Vườn đào xa    │
│                                                             │
│      ┌────────────────── HERO TREE ──────────────────┐      │
│      │        Cây Thần Cổ Thụ AVORA Vĩ Đại           │      │
│      └───────────────────────────────────────────────┘      │
│                                                             │
│ LAYER 3: HÒN ĐẢO NÔNG TRẠI CHÍNH (Chiếm 75-80% màn hình)    │
│   ├── Hàng rào gỗ mộc có dây đèn ấm                         │
│   ├── Suối nước / Ao cá Koi & Cầu gỗ đỏ                     │
│   ├── Cổng Torii son đỏ nghênh đón                          │
│   ├── LỐI ĐI LÁT ĐÁ CUỘI & THẢM HOA DẠI                    │
│   └── LƯỚI ĐẤT NÔNG TRẠI 25 Ô ĐẤT HỮU CƠ (ORGANIC PLOTS)    │
│                                                             │
│ LAYER 4: Vách đá đáy đảo 3D phủ rêu + Dòng thác nước đổ     │
│                                                             │
│ LAYER 5: Tiền cảnh (Foreground) - Nhánh hoa đào rủ mềm mại  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. THIẾT KẾ CÁC THỰC THỂ TRỌNG TÂM (HERO ASSETS)

### A. Cây Thần AVORA (The Sacred AVORA Tree — Centerpiece)
- **Vị trí:** Tọa lạc uy nghiêm trên đỉnh đồi trung tâm của hòn đảo, tỏa bóng mát che chở toàn bộ khu vườn.
- **Hình thái:**
  - Thân cây đại thụ Bonsai cổ thụ uốn lượn phong trần, vân gỗ trầm cổ kính và bộ rễ nổi gân guốc bám chặt vào đá rêu.
  - Vòm tán lá 5 tầng xum xuê đan xen giữa ngọc bích Matcha và phớt hồng hoa anh đào.
  - Dây thần thừng **Shimenawa** trắng thắt nơ truyền thống, đính chuông đồng vàng và đèn lồng đỏ AVORA tỏa hào quang vàng dịu.
  - Hoạt cảnh: Tán lá rung rinh thở nhẹ (breathing tween), liên tục buông lơi những cánh hoa anh đào trôi dạt theo làn gió.

### B. Ô Đất Nông Trại Hữu Cơ (Organic Farm Plots)
- **Không phải hình thoi thô cứng viền đen:**
  - Ô đất có viền cong bo góc tự nhiên mềm mại, có rãnh đất cày, viền cỏ xanh chen chân vào mép đất.
  - Có độ dày thành đất 3D (Bevel cao 12-16px) với bóng đổ tiếp xúc êm dịu lên nền cỏ.
- **Trạng thái:**
  - *EMPTY (Đất mới):* Màu nâu be ấm đất phù sa, tơi xốp.
  - *WATERED (Đã tưới):* Màu đất nâu sẫm sũng nước, ánh lên bóng nước lấp lánh phản chiếu mặt trời.
  - *READY (Sẵn sàng thu hoạch):* Hào quang vàng hoàng kim dịu dàng, cây lắc lư nhịp nhàng và huy hiệu bông lúa/bàn tay mời gọi thu hoạch.
  - *LOCKED (Chưa khai hoang):* **Tuyệt đối không dùng ô màu xám có icon ổ khóa thô!** Thay vào đó là **vạt cỏ dại tự nhiên, bụi hoa dại, tảng đá phủ rêu và sương sớm**. Chỉ khi người chơi chạm vào mới hiện bảng cấp độ yêu cầu mở khóa trang nhã.

---

## 6. HỆ THỐNG CÂY TRỒNG & ĐỘT BIẾN (36 + 3 VISUAL ASSETS)

Mỗi loại cây gồm đủ 6 giai đoạn sinh trưởng riêng biệt:
1. **Lúa Nhật Koshihikari (Japanese Rice):**
   - Hạt giống mầm vàng nhạt → Mạ non 2 lá xanh tươi → Bụi lúa xanh mướt trổ nhánh → Khóm lúa đòng đòng ngậm sữa → Bông lúa uốn cong trĩu hạt vàng rực → Ruộng lúa vàng óng ả phát sáng lấp lánh.
2. **Dâu Tây Tochigi (Strawberry):**
   - Hạt mầm đất → Chồi kép răng cưa → Bụi dâu nở hoa trắng nhuỵ vàng → Quả dâu non xanh li ti → Quả dâu chuyển sắc hồng cam → Trái dâu tây chín đỏ thẫm bóng bẩy đọng sương mai.
3. **Nho Kyoho (Kyoho Grape):**
   - Cọc gỗ cắm mầm → Dây leo bám cọc vươn cao → Giàn lá nho sum suê xòe rộng → Chùm quả non xanh biếc → Chùm nho ngả tím phủ lớp phấn trắng mờ → Chùm nho tím nhung hoàng gia căng mọng nước.
4. **Trà Xanh Uji (Matcha):**
   - Hạt chè → Mầm non → Bụi chè đâm chồi → Bụi trà xanh rì nở hoa trắng nhỏ → Tán trà ngọc bích rậm rạp → Vòm trà búp non óng ả tỏa làn hương sương mai mờ ảo.
5. **Hoa Anh Đào (Sakura):**
   - Hạt lân tinh → Bonsai non → Cành nhánh đâm nụ hồng phấn → Nụ hoa hé cánh bung nở → Tán hoa anh đào nở rộ tầng tầng lớp lớp → Thần thụ anh đào rực rỡ lốc xoáy cánh hoa bay quanh.
6. **Chanh Vàng Yuzu (Yuzu Citrus):**
   - Hạt chanh → Chồi gai mềm → Bụi cây hoa trắng ngát hương → Quả non xanh sần sùi → Quả chuyển vàng ươm → Cây trĩu trịt những quả chanh vàng mặt trời rạng rỡ.

### 3 Đột Biến Thần Thoại:
- **Nho Hoàng Kim 24K (Golden Grape):** Chùm quả đúc bằng vàng khối nguyên chất, ánh kim loại phản chiếu lấp lánh tia sao 8 hướng.
- **Dâu Pha Lê Tuyết (Crystal Strawberry):** Toàn bộ thân dâu kết tinh thành ngọc lam pha lê trong suốt, phát quang tia lạnh huyền ảo.
- **Anh Đào Ánh Trăng (Moonlight Sakura):** Thần hoa phát sáng màu tím lam dạ quang lộng lẫy, đàn bướm phát sáng và đom đóm vờn quanh.

---

## 7. QUY CHUẨN GIAO DIỆN NGƯỜI DÙNG (GAME HUD & DOCK)

### A. Bảng Chỉ Số Góc Trên (Top Header HUD)
- **Phong cách:** Cream Ivory Translucent Banner bo tròn mềm mại, viền chỉ vàng kim mảnh mai, bóng đổ nhẹ không che chắn tầm nhìn.
- **Top-Left (Hồ sơ người chơi):**
  - Khung Avatar tròn viền vàng đính ngọc.
  - Tên người dùng kiểu chữ thanh lịch.
  - Huy hiệu cấp độ nông trại (`Lv.X`) màu hổ phách.
  - Thanh EXP màu xanh ngọc bích viền kim loại.
  - Nút quay lại: `← Quay lại AVORA`.
- **Top-Right (Tài nguyên):**
  - Năng lượng (Energy): Viên ngọc sấm sét cyan `⚡ 30/30`.
  - Farm Coin: Đồng xu vàng dập nổi hoa văn lúa `🪙 15,240`.
  - AVORA Loyalty Point: Viên hồng ngọc điểm thưởng nhà hàng `✨ 350 Điểm`.

### B. Thanh Điều Hướng Dưới (Game Action Dock)
- **Phong cách:** Thanh dock nổi lơ lửng, chất liệu ngọc ngà vân mây (Parchment Float Dock) với các nút hình quả trám dát vàng sang trọng:
  1. **Vườn** (Home / Focus)
  2. **Túi đồ** (Inventory / Seeds)
  3. **Bộ sưu tập** (Cuốn sách Thần thoại Pokédex bìa da xanh lá mạ vàng)
  4. **Cửa hàng** (Shop)
  5. **Đổi quà** (Loyalty Rewards)
  6. **Nhiệm vụ** (Missions)
  7. **Bạn bè** (Friends)
  8. **Gặt hết** (Harvest All Button — nổi bật với viền ánh kim nhấp nháy khi có cây chín)
