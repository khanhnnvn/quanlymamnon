# Tài liệu Đặc tả Yêu cầu Phần mềm (SRS)
## Hệ thống Quản lý Trường Mầm non đa đơn vị (Multi-tenant Preschool Management System)

| | |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-17 |
| Trạng thái | Draft cho v1 (MVP nền tảng) |
| Chủ sở hữu sản phẩm | khanhnnvn@gmail.com |

---

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu này đặc tả yêu cầu cho hệ thống phần mềm quản lý trường mầm non theo mô hình **SaaS đa đơn vị (multi-tenant)**, cho phép nhiều trường mầm non độc lập cùng sử dụng chung một nền tảng, dữ liệu tách biệt hoàn toàn giữa các trường, truy cập qua một đường dẫn riêng theo từng trường (ví dụ `/mamnon_nguyensieu`, `/mamnon_maidich`).

### 1.2 Phạm vi
Hệ thống quản lý toàn bộ nghiệp vụ vận hành của một trường mầm non, gồm hai nhóm lớn:
- **Hoạt động dạy và học**: lớp học, học sinh, điểm danh, giáo án/kế hoạch giáo dục, đánh giá phát triển trẻ, nhật ký lớp học gửi phụ huynh.
- **Hoạt động bổ trợ**: y tế học đường, dinh dưỡng/thực đơn, học phí, nhân sự, hoạt động ngoại khóa, thông báo, trao đổi phụ huynh–nhà trường, kho/cơ sở vật chất.

Phiên bản v1 (nền tảng, mô tả ở mục 8) triển khai đầy đủ kiến trúc đa-tenant, xác thực & phân quyền, và các module lõi dạy-học (lớp, học sinh, điểm danh, nhật ký, thông báo). Các module còn lại được thiết kế sẵn schema/API để mở rộng ở các phase sau.

### 1.3 Định nghĩa & thuật ngữ
| Thuật ngữ | Ý nghĩa |
|---|---|
| Tenant | Một trường mầm non sử dụng hệ thống, dữ liệu cô lập theo `tenant_id` |
| Slug | Định danh URL của trường, dạng `mamnon_<ten-truong>`, ví dụ `mamnon_nguyensieu` |
| Super Admin | Quản trị hệ thống ở cấp nhà cung cấp dịch vụ (VietSoftware), quản lý toàn bộ tenant |
| School Admin | Hiệu trưởng — quản trị cao nhất trong phạm vi một trường |
| RBAC | Role-Based Access Control — phân quyền theo vai trò |
| Khối (Grade) | Nhóm tuổi: Nhà trẻ, Mầm, Chồi, Lá |
| Lớp (Class) | Đơn vị lớp học thuộc một khối, một năm học |

### 1.4 Đối tượng đọc tài liệu
Đội phát triển (backend/frontend/QA), quản trị hệ thống, và đại diện nghiệp vụ phía trường mầm non.

---

## 2. Mô tả tổng quan

### 2.1 Bối cảnh sản phẩm
Sản phẩm được vận hành bởi VietSoftware, cung cấp dưới dạng dịch vụ cho nhiều trường mầm non tại Việt Nam. Mỗi trường đăng ký sẽ được cấp một "không gian" riêng (tenant) truy cập qua đường dẫn `https://mamnon.vietsoftware.vn/mamnon_<slug>`.

### 2.2 Đối tượng sử dụng (User personas)
1. **Super Admin (VietSoftware)** — tạo/khóa tenant, theo dõi toàn hệ thống, không truy cập dữ liệu nghiệp vụ chi tiết của từng trường trừ khi được ủy quyền hỗ trợ.
2. **Hiệu trưởng (School Admin)** — toàn quyền trong phạm vi trường: cấu hình trường, quản lý nhân sự, học sinh, học phí, báo cáo.
3. **Hiệu phó (Vice Admin)** — quyền gần như Hiệu trưởng, có thể giới hạn một số cấu hình nhạy cảm (tài chính, xóa dữ liệu).
4. **Tổ trưởng chuyên môn (Head Teacher)** — quản lý giáo án, duyệt đánh giá phát triển trẻ trong tổ/khối phụ trách.
5. **Giáo viên chính (Teacher)** — chủ nhiệm lớp: điểm danh, nhật ký, đánh giá trẻ, giáo án lớp mình.
6. **Giáo viên phụ / Trợ giảng (Assistant Teacher)** — hỗ trợ giáo viên chính, quyền hạn hẹp hơn (không xóa, không sửa đánh giá đã chốt).
7. **Cán bộ/Nhân viên**: Kế toán (Accountant), Y tế (Nurse), Cấp dưỡng (Cook/Nutrition), Bảo vệ (Security), Văn thư (Office Staff) — mỗi vai trò chỉ truy cập module nghiệp vụ tương ứng.
8. **Phụ huynh (Parent)** — chỉ xem dữ liệu liên quan đến con mình: điểm danh, nhật ký, sức khỏe, học phí, thông báo; có thể xin nghỉ phép, nhắn tin cho giáo viên.

### 2.3 Môi trường vận hành
- Web app responsive (desktop cho giáo viên/nhà trường, mobile-first cho phụ huynh).
- Backend Go (REST API, JSON), Frontend Next.js (SSR/CSR hybrid).
- CSDL PostgreSQL dùng chung, cô lập dữ liệu theo `tenant_id` (shared database, shared schema, row-level isolation) — phù hợp quy mô vừa (hàng trăm trường), vận hành/backup đơn giản hơn multi-schema hay multi-database.
- Triển khai sau Cloudflare (CDN/Tunnel), tên miền `mamnon.vietsoftware.vn`.

### 2.4 Giả định & ràng buộc
- Một người dùng (giáo viên/nhân viên) chỉ thuộc **một** tenant; Super Admin không thuộc tenant nào.
- Phụ huynh có thể có nhiều con trong cùng một trường; hệ thống không hỗ trợ phụ huynh có con ở nhiều trường khác nhau trong v1 (mỗi liên kết phụ huynh–học sinh gắn với 1 tenant).
- Ngôn ngữ chính: Tiếng Việt. Kiến trúc dữ liệu cho phép mở rộng đa ngôn ngữ sau này nhưng không bắt buộc ở v1.
- Dữ liệu trẻ em là dữ liệu nhạy cảm → áp dụng nguyên tắc hạn chế truy cập tối thiểu (least privilege) và ghi log truy vết (audit log) cho các thao tác đọc/sửa hồ sơ học sinh.

---

## 3. Mô hình đa đơn vị (Multi-tenant)

### 3.1 Cách truy cập
- Web: `https://mamnon.vietsoftware.vn/<slug>` — ví dụ `/mamnon_nguyensieu`, `/mamnon_maidich`.
- API: `https://mamnon.vietsoftware.vn/api/v1/<slug>/...`.
- Slug là duy nhất toàn hệ thống, định dạng `mamnon_[a-z0-9_]+`, do Super Admin cấp khi tạo trường (đề xuất tự sinh từ tên trường, cho phép chỉnh trước khi kích hoạt).
- Trang `/` (không có slug) là trang giới thiệu + lối vào đăng nhập Super Admin và tìm trường.

### 3.2 Cô lập dữ liệu
- Mọi bảng nghiệp vụ có cột `tenant_id`; mọi truy vấn đi qua tầng repository đều bắt buộc lọc theo `tenant_id` lấy từ context request (middleware tenant-resolver), không tin tưởng giá trị từ client.
- JWT phát hành cho người dùng tenant có claim `tenant_id`; middleware so khớp `tenant_id` trong JWT với slug trên URL — không khớp thì từ chối (403), chống truy cập chéo trường.
- Super Admin dùng JWT riêng (không có `tenant_id`), chỉ truy cập nhóm route `/api/v1/system/*`.

### 3.3 Vòng đời một tenant
`pending` (đăng ký, chưa kích hoạt) → `active` (đang hoạt động) → `suspended` (tạm khóa, ví dụ chưa thanh toán dịch vụ) → `archived` (ngừng, giữ dữ liệu theo chính sách lưu trữ).

---

## 4. Ma trận vai trò × quyền hạn (tóm tắt)

| Chức năng | School/Vice Admin | Head Teacher | Teacher | Assistant | Kế toán | Y tế | Cấp dưỡng | Bảo vệ | Phụ huynh |
|---|---|---|---|---|---|---|---|---|---|
| Cấu hình trường, năm học, khối | Toàn quyền | - | - | - | - | - | - | - | - |
| Quản lý nhân sự & phân quyền | Toàn quyền | Xem | - | - | - | - | - | - | - |
| Quản lý lớp & phân công GV | Toàn quyền | Đề xuất | Xem lớp mình | Xem lớp mình | - | - | - | - | - |
| Hồ sơ học sinh | Toàn quyền | Xem khối | Sửa lớp mình | Xem lớp mình | Xem (thu phí) | Xem (y tế) | - | Xem cơ bản (đón/trả) | Xem con mình |
| Điểm danh | Xem tất cả | Xem khối | Ghi lớp mình | Ghi lớp mình | - | - | - | Ghi cổng trường | Xem con mình |
| Nhật ký lớp / hình ảnh | Xem tất cả | Duyệt khối | Ghi lớp mình | Ghi lớp mình | - | - | - | - | Xem con mình |
| Giáo án / kế hoạch dạy | Duyệt | Duyệt khối | Soạn lớp mình | Xem | - | - | - | - | - |
| Đánh giá phát triển trẻ | Xem tất cả | Duyệt khối | Ghi lớp mình | Đề xuất | - | - | - | - | Xem con mình |
| Y tế học đường | Xem tất cả | - | Xem lớp mình | - | - | Toàn quyền | - | - | Xem con mình |
| Thực đơn / dinh dưỡng | Duyệt | - | Xem | Xem | - | Góp ý | Toàn quyền | - | Xem |
| Học phí / hóa đơn | Toàn quyền | - | - | - | Toàn quyền | - | - | - | Xem & thanh toán |
| Thông báo | Toàn quyền | Gửi khối | Gửi lớp mình | - | - | - | - | - | Nhận |
| Xin nghỉ phép | Duyệt | - | Duyệt lớp mình | - | - | - | - | - | Gửi yêu cầu |
| Báo cáo/thống kê trường | Toàn quyền | Khối mình | - | - | Tài chính | Y tế | - | - | - |

Ma trận đầy đủ (theo từng API endpoint) nằm trong `docs/ARCHITECTURE.md`.

---

## 5. Yêu cầu chức năng theo module

### M1. Quản lý tenant (Super Admin)
- Tạo/sửa/khóa/mở trường; cấp slug; cấu hình gói dịch vụ, giới hạn số học sinh/giáo viên.
- Xem danh sách trường, trạng thái hoạt động, thống kê sử dụng.
- Không truy cập trực tiếp dữ liệu nghiệp vụ của trường (trừ chế độ hỗ trợ có ghi log).

### M2. Xác thực & phân quyền
- Đăng nhập bằng email/số điện thoại + mật khẩu (JWT access token + refresh token).
- Phân quyền theo vai trò (RBAC) mô tả ở mục 4; một người dùng có thể giữ nhiều vai trò (ví dụ vừa Hiệu phó vừa Giáo viên chủ nhiệm).
- Đổi mật khẩu, quên mật khẩu (gửi email/OTP — thiết kế sẵn, triển khai gửi email ở phase sau).
- Khóa tài khoản sau nhiều lần đăng nhập sai (chống brute-force).

### M3. Quản lý năm học, khối, lớp
- CRUD năm học (`school_years`), đặt năm học hiện hành.
- CRUD khối (Nhà trẻ/Mầm/Chồi/Lá — cấu hình được, không hard-code).
- CRUD lớp theo khối + năm học; phân công giáo viên chính/phụ; sức chứa lớp.

### M4. Hồ sơ học sinh & phụ huynh
- CRUD hồ sơ học sinh: thông tin cá nhân, ngày sinh, ảnh, lớp hiện tại, trạng thái (đang học/thôi học/bảo lưu).
- Liên kết nhiều phụ huynh/người giám hộ với một học sinh, đánh dấu người liên hệ chính, người được phép đón trẻ (kèm ảnh nhận diện tùy chọn).
- Lịch sử chuyển lớp/chuyển trường.

### M5. Điểm danh
- Giáo viên điểm danh theo lớp theo ngày: có mặt/vắng/muộn/nghỉ phép.
- Ghi nhận giờ đến/đón, người đón (đối chiếu danh sách người được phép đón ở M4).
- Phụ huynh xem lịch sử điểm danh của con theo thời gian thực.

### M6. Kế hoạch giáo dục & giáo án
- Giáo viên soạn giáo án/hoạt động theo ngày/tuần cho lớp, gắn chủ đề theo chương trình khung.
- Tổ trưởng/Ban giám hiệu duyệt giáo án.

### M7. Đánh giá phát triển trẻ
- Đánh giá định kỳ theo 5 lĩnh vực phát triển (thể chất, nhận thức, ngôn ngữ, tình cảm–kỹ năng xã hội, thẩm mỹ) theo Bộ chuẩn phát triển trẻ em 5 tuổi và các mốc tương ứng độ tuổi khác.
- Xuất phiếu đánh giá theo học kỳ gửi phụ huynh.

### M8. Nhật ký lớp học (gửi phụ huynh)
- Giáo viên đăng nhật ký hằng ngày cho lớp/học sinh: nội dung, hình ảnh, video.
- Phụ huynh xem nhật ký của con, có thể thả cảm xúc/bình luận.
- Kiểm soát hiển thị: chỉ phụ huynh của học sinh trong ảnh/lớp đó được xem.

### M9. Thông báo & tin tức
- Nhà trường/giáo viên gửi thông báo theo phạm vi: toàn trường, một khối, một lớp.
- Đánh dấu thông báo khẩn (ưu tiên hiển thị, có thể tích hợp kênh đẩy — push/SMS ở phase sau).

### M10. Trao đổi phụ huynh – giáo viên
- Nhắn tin 1:1 giữa phụ huynh và giáo viên chủ nhiệm.
- Xin nghỉ phép: phụ huynh gửi yêu cầu, giáo viên/nhà trường duyệt, tự động phản ánh vào Điểm danh (M5).

### M11. Y tế học đường
- Theo dõi cân nặng/chiều cao định kỳ, biểu đồ tăng trưởng theo chuẩn WHO.
- Sổ tiêm chủng, khám sức khỏe định kỳ.
- Ghi nhận sự cố y tế (sốt, tai nạn nhẹ, dị ứng...) và thuốc phụ huynh gửi kèm hướng dẫn sử dụng.

### M12. Dinh dưỡng & thực đơn
- Thực đơn theo ngày/tuần theo bữa (sáng/trưa/xế), tính năng lượng khẩu phần.
- Ghi chú dị ứng/thực đơn riêng theo học sinh.

### M13. Học phí & thanh toán
- Danh mục khoản thu theo năm học (học phí, ăn, ngoại khóa...).
- Lập hóa đơn theo học sinh/tháng, theo dõi trạng thái thanh toán.
- Tích hợp cổng thanh toán online (thiết kế sẵn interface, chọn nhà cung cấp ở phase triển khai).

### M14. Quản lý nhân sự
- Hồ sơ giáo viên/nhân viên: vị trí, cấp bậc, hợp đồng, ngày vào làm.
- Chấm công nhân sự (tách với điểm danh học sinh).
- Không quản lý bảng lương chi tiết trong v1 (chỉ lưu lương cơ bản tham chiếu).

### M15. Hoạt động ngoại khóa / bổ sung
- Danh mục câu lạc bộ/năng khiếu/ngoại ngữ, lịch học, học phí riêng.
- Đăng ký của học sinh, giáo viên phụ trách.
- Sự kiện/dã ngoại: tạo sự kiện, thu phí, xác nhận tham gia của phụ huynh.

### M16. Kho & cơ sở vật chất
- Danh mục vật tư/đồ dùng/thiết bị, số lượng, vị trí, tình trạng.
- Ghi nhận nhập/xuất kho.

### M17. Báo cáo & thống kê
- Dashboard theo vai trò: Hiệu trưởng (tổng quan trường), Giáo viên (lớp mình), Kế toán (công nợ), Y tế (tình trạng sức khỏe toàn trường).
- Xuất báo cáo phục vụ Phòng/Sở GD-ĐT (sĩ số, chuyên cần, tỷ lệ suy dinh dưỡng/thừa cân...) — định dạng xuất ở phase sau (Excel/PDF).

### M18. Nhật ký hệ thống & bảo mật
- Audit log cho các hành động nhạy cảm: xem/sửa hồ sơ học sinh, thay đổi phân quyền, xuất dữ liệu, đăng nhập thất bại.
- Super Admin xem log ở mức tenant (không xem nội dung nghiệp vụ), trường xem log ở mức tenant mình.

---

## 6. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
|---|---|
| Hiệu năng | API phản hồi < 300ms cho 95% request đọc dữ liệu thông thường (không tính upload media); hỗ trợ ≥ 50 trường hoạt động đồng thời trên hạ tầng v1 |
| Bảo mật | Mật khẩu băm bằng bcrypt/argon2; JWT ký HS256/RS256, access token sống ngắn (15–30 phút) + refresh token; toàn bộ traffic qua HTTPS (Cloudflare); chống CSRF cho các thao tác ghi qua cookie (nếu dùng cookie session), chống XSS/SQL injection bằng prepared statement (không nối chuỗi SQL) |
| Cô lập dữ liệu | Không có đường nào từ tenant A đọc được dữ liệu tenant B kể cả khi có lỗi client — enforce ở tầng middleware + repository, có test tự động kiểm chứng |
| Khả dụng | Mục tiêu uptime 99% cho v1 (hạ tầng đơn máy chủ + Cloudflare Tunnel); có kế hoạch nâng cấp HA ở phase sau |
| Sao lưu | Backup PostgreSQL hằng ngày (pg_dump), lưu tối thiểu 7 bản gần nhất |
| Khả mở rộng | Kiến trúc cho phép thêm module mới (bảng + API) không phá vỡ module hiện có; tách rõ domain theo module ở tầng backend |
| Khả dùng (UX) | Giao diện tiếng Việt, responsive, tối ưu cho phụ huynh dùng điện thoại; giáo viên thao tác điểm danh/nhật ký ≤ 3 bước |
| Nhật ký & giám sát | Ghi log truy cập API, log lỗi tập trung theo file, log audit cho thao tác nhạy cảm (mục M18) |
| Bảo vệ dữ liệu trẻ em | Giới hạn quyền xem hồ sơ học sinh theo đúng lớp/phạm vi phụ trách; ảnh/video học sinh chỉ hiển thị cho phụ huynh liên quan và giáo viên của lớp |

---

## 7. Kiến trúc & công nghệ (tóm tắt)

Chi tiết đầy đủ: xem `docs/ARCHITECTURE.md` (mô hình dữ liệu, danh sách API, sơ đồ triển khai).

- **Backend**: Go (Gin), kiến trúc layer (handler → service → repository), JWT auth, migration SQL tự chạy khi khởi động.
- **Frontend**: Next.js (App Router), TypeScript, TailwindCSS, route động `/[tenant]/...`.
- **CSDL**: PostgreSQL, shared schema + `tenant_id`, connect qua role `mamnon`.
- **Triển khai**: chạy trực tiếp trên máy chủ (không Docker) qua `launchd` (macOS) để tự khởi động khi restart máy; Nginx làm reverse proxy nội bộ; Cloudflare Tunnel đưa `mamnon.vietsoftware.vn` ra Internet mà không mở port trực tiếp.

---

## 8. Phạm vi triển khai v1 (MVP nền tảng)

Để đảm bảo chất lượng thay vì dàn trải, v1 triển khai **đầy đủ, chạy được thật**:
- Kiến trúc đa-tenant hoàn chỉnh (routing theo slug, cô lập dữ liệu, JWT theo tenant).
- M1 Quản lý tenant (Super Admin).
- M2 Xác thực & phân quyền (RBAC đầy đủ theo mục 4).
- M3 Năm học/Khối/Lớp.
- M4 Hồ sơ học sinh & phụ huynh.
- M5 Điểm danh.
- M8 Nhật ký lớp học (dạng text + đường dẫn ảnh, chưa có dịch vụ upload file).
- M9 Thông báo.
- M17 Dashboard cơ bản theo vai trò.

**Đã thiết kế schema & API contract sẵn, chưa cài đặt giao diện/logic đầy đủ** (phase 2+): M6 Giáo án, M7 Đánh giá phát triển trẻ, M10 Nhắn tin & xin nghỉ phép, M11 Y tế, M12 Dinh dưỡng, M13 Học phí, M14 Nhân sự chi tiết, M15 Ngoại khóa, M16 Kho, M18 Audit log UI, upload file/ảnh thật (object storage).

## 9. Tiêu chí nghiệm thu v1
1. Tạo được ≥ 2 trường (tenant) qua Super Admin, mỗi trường truy cập độc lập qua slug riêng, không rò rỉ dữ liệu chéo.
2. Đăng nhập được với đủ các vai trò mô tả ở mục 2.2, mỗi vai trò chỉ thấy đúng chức năng được phép theo mục 4.
3. Hiệu trưởng tạo năm học, khối, lớp, phân công giáo viên; giáo viên thêm học sinh, điểm danh, đăng nhật ký; phụ huynh xem được nhật ký/điểm danh của đúng con mình.
4. Toàn bộ luồng trên chạy được trên môi trường triển khai thật tại `mamnon.vietsoftware.vn`.
