# ASSET CHECKLIST: AVORA ENCHANTED FARM

Tài liệu kiểm kê toàn bộ danh mục tài nguyên hình ảnh (Asset Catalog) phục vụ xây dựng thế giới 2.5D Isometric của **AVORA Farm**.

---

## 1. BẢNG ĐỐI CHIẾU THỰC TRẠNG (ASSET AUDIT: CURRENT VS TARGET)

| Tên Đối tượng | Tình trạng Hiện tại (CURRENT) | Mục tiêu Chuẩn hóa (TARGET) | Định dạng & Kích thước |
| :--- | :--- | :--- | :--- |
| **Bầu trời (Sky Background)** | Nền đen/xanh đen `#111b15` trống rỗng | Toàn cảnh vòm trời pastel ấm áp + mây bồng bềnh + ánh dương | WebP/PNG 1920×1080 |
| **Hòn đảo nổi (Floating Island)** | Hình thoi phẳng đơn điệu | Hòn đảo đá nổi 3D hữu cơ nhiều tầng cỏ, vách đá, rêu phong và thác nước | WebP/PNG 1280×720 |
| **Cỏ nền (Grass Terrain)** | Hình thoi xanh phẳng có chấm hạt | Nền cỏ xanh mướt mát có cụm lá, hoa cúc dại, hoa cánh bướm | PNG 128×64 |
| **Đường lát đá (Stone Path)** | Mấy hình tròn xám trên nền | Lối đi lát đá cuội tự nhiên có khe rêu xanh chen chân | PNG 128×64 |
| **Suối nước & Ao cá (Koi Stream)** | Hình thoi xanh lam phẳng | Dòng suối trong vắt phản chiếu trời mây, lá sen nổi và cá Koi | PNG 128×64 |
| **Ô đất trống (Empty Soil)** | Hình thoi nâu đơn giản | Luống đất phù sa tơi xốp, viền cong bo góc, bevel 3D và bóng đổ mềm | PNG 128×80 |
| **Ô đất đã tưới (Watered Soil)** | Hình thoi có đốm tròn xanh | Đất nâu đen sũng nước, phủ màng nước bóng loáng phản quang ánh sáng | PNG 128×80 |
| **Ô đất chín (Ready Plot)** | Vòng tròn vàng kim | Đất tơi vàng lóng lánh, hào quang hoàng kim tỏa sáng dịu dàng | PNG 128×80 |
| **Ô đất chưa mở (Locked Plot)** | Hình thoi xám có viên đá giữa | **Vạt đồng cỏ hoang sơ mọc đầy hoa dại, thảm rêu và sương sớm** | PNG 128×80 |
| **Cây Thần AVORA (Hero Tree)** | Hình vẽ chữ nhật + hình tròn clipart | **Linh Thụ Cổ Thụ Bonsai vĩ đại 5 tầng lá, ruy băng Shimenawa & đèn lồng đỏ** | PNG Transparent 320×380 |
| **Cổng Torii (Torii Gate)** | Thanh chữ nhật đỏ ghép lại | Cổng Torii son đỏ truyền thống, mái cong viền đen và chân đế đá | PNG Transparent 128×160 |
| **Đèn đá Nhật (Stone Lantern)** | Hình đa giác xám | Đèn đá Toro rêu phong với hốc đèn phát sáng ánh nến ấm áp | PNG Transparent 64×112 |
| **Cầu gỗ (Wooden Bridge)** | Cung tròn đỏ đơn giản | Cầu gỗ cong màu đỏ son bắc qua suối có tay vịn và hoa văn uốn lượn | PNG Transparent 128×96 |
| **Hàng rào gỗ (Garden Fence)** | Không có | Hàng rào gỗ mộc mạc viền quanh đảo có dây đèn đom đóm lung linh | PNG Transparent 128×80 |
| **Cây trồng thường (6 Crops)** | Vài chấm pixel hình học | **36 Artwork vẽ tay minh họa 6 giai đoạn sinh trưởng riêng biệt** | PNG 64×64 đến 128×144 |
| **Đột biến thần thoại (3 Mutations)** | Vòng tròn đổi màu | **3 Artwork độc nhất: Nho vàng 24K, Dâu pha lê, Anh đào ánh trăng** | PNG Transparent 128×144 |
| **Giao diện Header (HUD)** | Thanh pill đen icon neon | **Bảng ngọc ngà vân mây (Ivory Parchment), viền vàng kim soft gold** | React Tailwind Components |
| **Thanh Bottom Dock** | Dock đen dashboard dev | **Thanh Dock Thần Thoại dát vàng với cuốn sách Bìa Da Thu Thập** | React Tailwind Components |

---

## 2. DANH MỤC CHI TIẾT 36 ARTWORK CÂY TRỒNG (6 CROPS × 6 STAGES)

Mỗi asset có:
- **Tên Asset Key** (Đăng ký trong `FarmAssetRegistry.ts`)
- **Tập tin** (Đường dẫn lưu tại `frontend/public/game/farm/crops/...`)
- **Kích thước chuẩn**
- **Điểm neo chân (Origin X, Origin Y)**

### 1. Lúa Nhật Hoàng Gia (Japanese Rice — Koshihikari)
1. `crop_rice_s0`: `/game/farm/crops/rice/stage_0.png` | 64×64 | Origin: `(0.5, 0.85)` | Hạt giống mầm cắm trên luống bùn ướt
2. `crop_rice_s1`: `/game/farm/crops/rice/stage_1.png` | 64×64 | Origin: `(0.5, 0.85)` | Mạ non 2 lá xanh non mơn mởn
3. `crop_rice_s2`: `/game/farm/crops/rice/stage_2.png` | 80×80 | Origin: `(0.5, 0.85)` | Bụi lúa đẻ nhánh sum suê
4. `crop_rice_s3`: `/game/farm/crops/rice/stage_3.png` | 96×96 | Origin: `(0.5, 0.90)` | Lúa đòng đòng nở hoa trắng sữa
5. `crop_rice_s4`: `/game/farm/crops/rice/stage_4.png` | 112×112 | Origin: `(0.5, 0.90)` | Bông lúa trĩu hạt ngả vàng óng
6. `crop_rice_s5`: `/game/farm/crops/rice/stage_5.png` | 128×128 | Origin: `(0.5, 0.90)` | Thảm lúa vàng rực rỡ tỏa ánh kim mai

### 2. Dâu Tây Tochigi (Strawberry)
7. `crop_straw_s0`: `/game/farm/crops/strawberry/stage_0.png` | 64×64 | Origin: `(0.5, 0.85)` | Hạt giống dâu đất
8. `crop_straw_s1`: `/game/farm/crops/strawberry/stage_1.png` | 64×64 | Origin: `(0.5, 0.85)` | Chồi non 3 lá kép răng cưa
9. `crop_straw_s2`: `/game/farm/crops/strawberry/stage_2.png` | 80×80 | Origin: `(0.5, 0.85)` | Bụi dâu hoa trắng nhụy vàng
10. `crop_straw_s3`: `/game/farm/crops/strawberry/stage_3.png` | 96×96 | Origin: `(0.5, 0.90)` | Quả non xanh li ti mọc thành chùm
11. `crop_straw_s4`: `/game/farm/crops/strawberry/stage_4.png` | 112×112 | Origin: `(0.5, 0.90)` | Quả dâu ửng hồng căng mọng
12. `crop_straw_s5`: `/game/farm/crops/strawberry/stage_5.png` | 128×128 | Origin: `(0.5, 0.90)` | Dâu tây đỏ thẫm bóng bẩy đọng sương lấp lánh

### 3. Nho Kyoho Hoàng Gia (Grape)
13. `crop_grape_s0`: `/game/farm/crops/grape/stage_0.png` | 64×64 | Origin: `(0.5, 0.85)` | Mầm nho kèm cọc tre định hình
14. `crop_grape_s1`: `/game/farm/crops/grape/stage_1.png` | 64×64 | Origin: `(0.5, 0.85)` | Tua cuốn leo bám cọc gỗ
15. `crop_grape_s2`: `/game/farm/crops/grape/stage_2.png` | 80×96 | Origin: `(0.5, 0.90)` | Giàn lá to xòe rộng rợp bóng
16. `crop_grape_s3`: `/game/farm/crops/grape/stage_3.png` | 96×112 | Origin: `(0.5, 0.90)` | Chùm quả non xanh biếc
17. `crop_grape_s4`: `/game/farm/crops/grape/stage_4.png` | 112×128 | Origin: `(0.5, 0.90)` | Chùm nho ngả sắc tím thẫm
18. `crop_grape_s5`: `/game/farm/crops/grape/stage_5.png` | 128×144 | Origin: `(0.5, 0.90)` | Chùm nho tím nhung quý phái phủ phấn mờ

### 4. Trà Xanh Uji (Uji Matcha)
19. `crop_matcha_s0`: `/game/farm/crops/matcha/stage_0.png` | 64×64 | Origin: `(0.5, 0.85)` | Hạt chè xanh
20. `crop_matcha_s1`: `/game/farm/crops/matcha/stage_1.png` | 64×64 | Origin: `(0.5, 0.85)` | Mầm trà tươi non
21. `crop_matcha_s2`: `/game/farm/crops/matcha/stage_2.png` | 80×80 | Origin: `(0.5, 0.85)` | Khóm chè đâm tược mơn mởn
22. `crop_matcha_s3`: `/game/farm/crops/matcha/stage_3.png` | 96×96 | Origin: `(0.5, 0.90)` | Bụi chè rậm rạp điểm hoa trắng
23. `crop_matcha_s4`: `/game/farm/crops/matcha/stage_4.png` | 112×112 | Origin: `(0.5, 0.90)` | Tán trà ngọc bích tỏa hương
24. `crop_matcha_s5`: `/game/farm/crops/matcha/stage_5.png` | 128×128 | Origin: `(0.5, 0.90)` | Vòm chè thượng hạng phát quang làn hương thiền

### 5. Hoa Anh Đào Thần (Sakura)
25. `crop_sakura_s0`: `/game/farm/crops/sakura/stage_0.png` | 64×64 | Origin: `(0.5, 0.85)` | Hạt mầm phát quang
26. `crop_sakura_s1`: `/game/farm/crops/sakura/stage_1.png` | 64×64 | Origin: `(0.5, 0.85)` | Chồi mầm bonsai non
27. `crop_sakura_s2`: `/game/farm/crops/sakura/stage_2.png` | 80×96 | Origin: `(0.5, 0.90)` | Cành nhánh đơm nụ hoa
28. `crop_sakura_s3`: `/game/farm/crops/sakura/stage_3.png` | 96×112 | Origin: `(0.5, 0.90)` | Nụ hoa hé cánh phớt hồng
29. `crop_sakura_s4`: `/game/farm/crops/sakura/stage_4.png` | 112×128 | Origin: `(0.5, 0.90)` | Vòm hoa anh đào bung nở rực rỡ
30. `crop_sakura_s5`: `/game/farm/crops/sakura/stage_5.png` | 128×144 | Origin: `(0.5, 0.90)` | Thần hoa lộng lẫy cuốn lốc cánh hoa xoay bay

### 6. Chanh Vàng Yuzu (Yuzu Citrus)
31. `crop_yuzu_s0`: `/game/farm/crops/yuzu/stage_0.png` | 64×64 | Origin: `(0.5, 0.85)` | Hạt giống chanh
32. `crop_yuzu_s1`: `/game/farm/crops/yuzu/stage_1.png` | 64×64 | Origin: `(0.5, 0.85)` | Mầm gai non
33. `crop_yuzu_s2`: `/game/farm/crops/yuzu/stage_2.png` | 80×80 | Origin: `(0.5, 0.85)` | Bụi cây hoa trắng ngào ngạt
34. `crop_yuzu_s3`: `/game/farm/crops/yuzu/stage_3.png` | 96×96 | Origin: `(0.5, 0.90)` | Quả chanh non xanh sần sùi
35. `crop_yuzu_s4`: `/game/farm/crops/yuzu/stage_4.png` | 112×112 | Origin: `(0.5, 0.90)` | Quả chanh chín vàng ươm
36. `crop_yuzu_s5`: `/game/farm/crops/yuzu/stage_5.png` | 128×128 | Origin: `(0.5, 0.90)` | Cây trĩu nặng quả vàng mặt trời lấp lánh ánh kim

---

## 3. DANH MỤC 3 BIẾN THỂ ĐỘT BIẾN ĐẶC QUYỀN (SIGNATURE MUTATIONS)

1. `mutation_golden_grape`: `/game/farm/mutations/golden-grape/plant.png` | 128×144 | Origin: `(0.5, 0.90)` | Nho bằng vàng khối 24K óng ả phát sáng tia kim quang
2. `mutation_crystal_strawberry`: `/game/farm/mutations/crystal-strawberry/plant.png` | 128×128 | Origin: `(0.5, 0.90)` | Dâu pha lê tuyết trong suốt khúc xạ ánh ngọc bích lam
3. `mutation_moonlight_sakura`: `/game/farm/mutations/moonlight-sakura/plant.png` | 144×144 | Origin: `(0.5, 0.90)` | Cây hoa dạ quang tím huyền bí tỏa bụi tinh tú trong đêm

---

## 4. DANH MỤC TÀI NGUYÊN MÔI TRƯỜNG & ĐẠO CỤ (ENVIRONMENT & PROPS)

1. `env_sky_daylight`: Bầu trời pastel ban mai mây bồng bềnh (1920×1080)
2. `env_island_cliff`: Vách đá hòn đảo nổi 3D tầng tầng lớp lớp (1280×720)
3. `prop_avora_tree`: **Cây Thần Cổ Thụ Bonsai AVORA vĩ đại** (320×380)
4. `prop_torii_gate`: Cổng Torii son đỏ thần đạo (128×160)
5. `prop_stone_lantern`: Đèn đá Toro thắp nến ấm áp (64×112)
6. `prop_wooden_bridge`: Cầu gỗ đỏ bắc qua suối (128×96)
7. `prop_garden_fence`: Hàng rào gỗ mộc có dây đèn ấm (128×80)
8. `tile_soil_empty`: Luống đất phù sa hữu cơ bo viền mềm (128×80)
9. `tile_soil_watered`: Đất sẫm mượt mà sũng nước lấp lánh (128×80)
10. `tile_soil_ready`: Đất tơi vàng hào quang gặt hái (128×80)
11. `tile_locked_meadow`: **Vạt đồng cỏ dại tự nhiên, hoa cúc và sương mai** (128×80)
12. `tile_stone_path`: Lối đi đá cuội tự nhiên có cỏ mọc xen (128×64)
13. `tile_koi_stream`: Suối ngọc bích trong veo có cá Koi & lá sen (128×64)
14. `particle_petal`: Cánh hoa anh đào rơi chao nghiêng (24×24)
15. `particle_firefly`: Đom đóm phát sáng lập lòe (28×28)
16. `particle_gold_star`: Ngôi sao vàng bùng nổ khi thu hoạch (32×32)
