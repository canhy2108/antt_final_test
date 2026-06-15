# Kế hoạch kỹ thuật: Đăng nhập bằng khuôn mặt (in-app) cho BudgetBee

Phiên bản 1.0 — 14/06/2026
Phạm vi: tự quét + lưu dữ liệu nhận dạng khuôn mặt trong hệ thống BudgetBee
(client Expo + backend Laravel), dùng làm phương thức đăng nhập/xác thực.

---

## 0. Tóm tắt cho người ra quyết định

- Đây là **một dự án nhận diện sinh trắc thực thụ**, không phải một màn hình quét.
  Để an toàn cho một app **tài chính**, bắt buộc có 3 trụ cột: (1) trích xuất
  **embedding khuôn mặt**, (2) **chống giả mạo (liveness)**, (3) **lưu trữ + đối
  chiếu an toàn**. Thiếu liveness = bị mở khoá bằng **một tấm ảnh**.
- Tin tốt: database đã có sẵn bảng `face_profiles` với cột `face_embedding`
  **512 chiều** — **khớp đúng** với model **ArcFace ONNX** (chuẩn công nghiệp).
  Khung dữ liệu đã đúng; phần còn thiếu là model + liveness + API + UI.
- Khuyến nghị: làm theo **lộ trình 5 giai đoạn**, và **không dùng khuôn mặt làm
  yếu tố đăng nhập chính cho tới khi qua được kiểm thử liveness** (mục 8 & 9).
- Cảnh báo pháp lý: dữ liệu khuôn mặt là **dữ liệu sinh trắc nhạy cảm**. Phải có
  màn hình **đồng ý rõ ràng**, cho phép **xoá**, và **mã hoá khi lưu** (mục 7).

---

## 1. Mục tiêu & phạm vi

Mục tiêu: người dùng đăng ký khuôn mặt trong app, và ở các lần sau có thể
đăng nhập bằng cách quét mặt (đối chiếu với hồ sơ đã lưu).

Trong phạm vi:
- Trang đăng ký khuôn mặt (quét nhiều góc, có hướng dẫn).
- Trích xuất embedding 512-d và lưu vào `face_profiles`.
- Chống giả mạo cơ bản → nâng cao.
- Trang đăng nhập bằng khuôn mặt (đối chiếu + cấp token).
- Quản lý hồ sơ khuôn mặt (xem, thêm góc, xoá).

Ngoài phạm vi (giai đoạn sau): nhận diện nhiều người trên một thiết bị nâng
cao, mở khoá giao dịch giá trị lớn bằng mặt (nên giữ PIN/OTP cho việc này).

---

## 2. Quyết định kiến trúc: On-device vs Server-side

| Tiêu chí | On-device (embedding tính trên điện thoại) | Server-side (gửi ảnh, server tính) |
|---|---|---|
| Quyền riêng tư | Ảnh không rời máy (chỉ gửi vector) — tốt hơn | Ảnh rời máy → rủi ro & trách nhiệm cao |
| Bảo mật model | Khó kiểm soát, nhưng vector vô danh | Server kiểm soát, dễ cập nhật model |
| Hiệu năng | Nhanh, không phụ thuộc mạng | Phụ thuộc mạng (đang là điểm yếu của app) |
| Độ phức tạp client | Cao (nhúng ONNX runtime) | Thấp hơn ở client |
| Chống giả mạo | Cần làm ở client | Có thể làm ở server (mạnh hơn) |

**Khuyến nghị: kiến trúc lai (hybrid).**
- **Phát hiện mặt + liveness + trích xuất embedding ngay trên điện thoại**
  (ArcFace ONNX). Ảnh **không** rời thiết bị; chỉ gửi **vector 512-d** lên server.
- Server **lưu + đối chiếu** vector (cosine distance) như bảng `face_profiles`
  đã thiết kế. Đây vừa riêng tư, vừa cho đăng nhập đa thiết bị.

---

## 3. Thành phần kỹ thuật

### 3.1. Camera & phát hiện khuôn mặt (client)
- Lưu ý: `expo-face-detector` **đã ngừng hỗ trợ từ SDK 51**. Dùng một trong:
  - **react-native-vision-camera** + frame processor (mạnh, linh hoạt), hoặc
  - **react-native-face-detector-camera** (MLKit, gọn cho Expo dev build).
- Chức năng cần: phát hiện 1 khuôn mặt, lấy **landmark** (mắt/mũi/miệng) để
  căn chỉnh (alignment) trước khi đưa vào model — alignment ảnh hưởng lớn tới
  độ chính xác.
- UI: khung oval, hướng dẫn "đưa mặt vào khung", bắt nhiều khung hình.

### 3.2. Trích xuất embedding — ArcFace ONNX (client)
- Model **ArcFace** (ví dụ `arcface_r100` hoặc biến thể nhẹ MobileFaceNet)
  xuất **vector 512 chiều** → khớp đúng cột `face_embedding` (512-d JSON) đã có.
- Chạy bằng **onnxruntime-react-native** (cần Expo **dev build**, không chạy
  trong Expo Go).
- Đăng ký: chụp **3–5 khung** (mặt thường, hơi nghiêng, thiếu sáng), tính
  embedding cho từng khung → lưu nhiều hồ sơ (`label`: "Không kính", "Đeo
  kính"…) đúng như thiết kế "User (1) ↔ Face (N)" của bảng.

### 3.3. Chống giả mạo / Liveness (BẮT BUỘC cho app tài chính)
Theo chuẩn **ISO/IEC 30107-3** (Presentation Attack Detection). Cách tiếp cận
**lai**, tăng dần:
- **Active (chủ động)** — Giai đoạn đầu, dễ làm: yêu cầu người dùng thực hiện
  thử thách ngẫu nhiên: chớp mắt, quay trái/phải, mỉm cười. Chặn ảnh tĩnh đơn giản.
- **Passive (thụ động)** — Nâng cao: phân tích kết cấu da, phản xạ ánh sáng,
  micro-expression, độ sâu 3D để chống ảnh in, màn hình phát lại, **deepfake**.
- Lựa chọn thực dụng: tích hợp SDK chuyên dụng có liveness đã **chứng nhận iBeta**
  (ví dụ `@biopassid/face-sdk-react-native`, hoặc dịch vụ như Sumsub/FaceTec)
  thay vì tự viết passive liveness — tự viết rất khó đạt chuẩn.

### 3.4. Lưu trữ
- **Vector** trong `face_profiles.face_embedding` (đã có). Sản xuất: cân nhắc
  Postgres + **pgvector** (HNSW/IVFFLAT) để đối chiếu kNN nhanh; SQLite demo thì
  cosine-distance bằng PHP (chậm nhưng đúng — migration đã ghi chú).
- **Không lưu ảnh gốc** trên server (kiến trúc hybrid). Nếu buộc phải lưu ảnh
  để huấn luyện lại: mã hoá at-rest, tách kho, có vòng đời xoá.
- Liên kết `device_id` để tăng cường (đăng nhập mặt + đúng thiết bị).

### 3.5. Đối chiếu (matching)
- Khoảng cách **cosine** giữa vector quét và các hồ sơ của user; khớp khi
  `similarity ≥ ngưỡng` (ví dụ 0.5–0.6 với ArcFace — phải hiệu chỉnh bằng dữ
  liệu thật, xem mục 9).
- Trả về top-1; ghi `last_matched_at`, `match_count` (cột đã có).
- Khoá tốc độ thử (rate-limit) + khoá tạm sau N lần sai (giống
  `BiometricController` hiện tại).

---

## 4. API backend cần xây (Laravel)

Tận dụng bảng `face_profiles` đã có. Tạo Model `FaceProfile` + controller + routes:

```
// Auth-required (đã đăng nhập bằng mật khẩu trước khi đăng ký mặt)
POST   /api/face/enroll        // body: { embedding:number[512], label?, device_id? }
GET    /api/face/profiles      // liệt kê hồ sơ mặt của user
DELETE /api/face/profiles/{id} // xoá 1 hồ sơ

// Public (đăng nhập bằng mặt) — kèm liveness proof
POST   /api/face/challenge     // server cấp nonce + thử thách liveness ngẫu nhiên
POST   /api/face/verify        // body: { embedding, device_id, liveness_proof, nonce }
                               // server đối chiếu cosine → cấp Sanctum token
```

Nguyên tắc bảo mật (kế thừa thiết kế tốt sẵn có của app):
- Đối chiếu phía server, **không tin client tự nói "đã khớp"**.
- Chống tấn công lặp lại: **nonce một lần** + ràng buộc `device_id`.
- Embedding đi kèm **bằng chứng liveness** đã ký/đóng dấu thời gian.
- Ghi **audit log** mọi lần enroll/verify (giống `Log::channel('audit')`).

---

## 5. Luồng màn hình client

Đăng ký (`app/face/setup.tsx`):
1. Màn hình **đồng ý** (giải thích dữ liệu mặt dùng để làm gì, lưu ở đâu, cách xoá).
2. Mở camera trước, khung oval, hướng dẫn.
3. Liveness chủ động (chớp mắt / quay đầu) → bắt 3–5 khung hợp lệ.
4. Tính 512-d embedding cho từng khung → `POST /api/face/enroll`.
5. Bật cờ đã đăng ký → quay về.

Đăng nhập (`app/face/login.tsx`):
1. Mở camera → liveness → bắt 1 khung → tính embedding.
2. `POST /api/face/challenge` → `verify` → nhận token → vào `/(tabs)`.
3. Thất bại → fallback mật khẩu/PIN.

---

## 6. Bảo mật & tuân thủ (KHÔNG bỏ qua với app tài chính)

- **Đồng ý rõ ràng** trước khi thu thập sinh trắc; cho phép **rút lại + xoá**.
- **Mã hoá** vector/ảnh at-rest; phân quyền truy cập chặt.
- **ISO/IEC 30107-3** cho liveness; ưu tiên thành phần đã chứng nhận iBeta.
- **Tối thiểu hoá dữ liệu**: ưu tiên không lưu ảnh gốc; chỉ lưu vector vô danh.
- **Phòng deepfake**: liveness passive là lớp phòng thủ chính.
- Cân nhắc quy định bảo vệ dữ liệu cá nhân hiện hành (VN: Nghị định 13/2023;
  nếu phục vụ người dùng EU thì GDPR coi sinh trắc là "special category").
- **Khuyến nghị mạnh**: không dùng khuôn mặt một mình để duyệt **giao dịch
  tiền/đổi mật khẩu** — giữ PIN+OTP cho các thao tác nhạy cảm (như app đang làm).

---

## 7. Lộ trình theo giai đoạn

- **Giai đoạn 0 — Nền tảng (1–2 tuần):** Model `FaceProfile`, API enroll/verify
  (đối chiếu cosine), audit log, rate-limit. Chưa có UI camera (test bằng vector giả).
- **Giai đoạn 1 — Capture & Embedding on-device (2–4 tuần):** tích hợp
  vision-camera + ArcFace ONNX (dev build), trang đăng ký nhiều góc, gửi vector.
- **Giai đoạn 2 — Liveness chủ động (1–2 tuần):** thử thách chớp mắt/quay đầu;
  ràng buộc nonce. *Chỉ sau bước này mới bật đăng nhập mặt cho người dùng thật.*
- **Giai đoạn 3 — Liveness thụ động / SDK chứng nhận (3–5 tuần):** tích hợp SDK
  PAD đạt iBeta để chống ảnh/màn hình/deepfake.
- **Giai đoạn 4 — Hardening & tuân thủ (liên tục):** hiệu chỉnh ngưỡng, mã hoá,
  màn hình đồng ý/xoá, kiểm thử bảo mật, (tuỳ chọn) pgvector.

---

## 8. Kiểm thử & tiêu chí chấp nhận

- **Độ chính xác:** đo **FAR** (chấp nhận nhầm người lạ) và **FRR** (từ chối nhầm
  chính chủ) trên tập thật; hiệu chỉnh ngưỡng cosine. Mục tiêu app tài chính:
  FAR rất thấp (ví dụ ≤ 0.01%), chấp nhận FRR cao hơn (an toàn ưu tiên).
- **Liveness/PAD:** test tấn công trình diễn theo ISO/IEC 30107-3 — ảnh in, ảnh
  trên màn hình, video phát lại, mặt nạ; lý tưởng đạt iBeta Level 1–2.
- **Đa điều kiện:** thiếu sáng, đeo kính, khẩu trang một phần, nhiều góc.
- **Bảo mật:** chống lặp lại (nonce), giả mạo embedding, lạm dụng API, rò rỉ dữ liệu.

---

## 9. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Mở khoá bằng ảnh (không liveness) | Nghiêm trọng | Bắt buộc liveness trước khi bật cho user thật |
| Deepfake | Cao | Liveness passive + SDK chứng nhận |
| Rò rỉ dữ liệu sinh trắc | Cao (pháp lý) | Không lưu ảnh, mã hoá vector, cho phép xoá |
| Ngưỡng sai → FAR cao | Cao | Hiệu chỉnh trên dữ liệu thật, ưu tiên an toàn |
| Phụ thuộc mạng khi verify | Trung bình | Hybrid: tính embedding offline, chỉ gửi vector |
| Không chạy trong Expo Go | Chắc chắn | Bắt buộc dev build (onnxruntime/native) |

---

## 10. Phụ thuộc kỹ thuật (tóm tắt)
- Client: `react-native-vision-camera` (hoặc MLKit face detector),
  `onnxruntime-react-native`, model ArcFace (.onnx) 512-d, Expo **dev build**.
- Server: Model+migration `FaceProfile` (đã có bảng), so khớp cosine (PHP) →
  (tuỳ chọn) Postgres + pgvector.
- Tuỳ chọn liveness: `@biopassid/face-sdk-react-native` / Sumsub / FaceTec.

---

## Nguồn tham khảo
- ArcFace ONNX cho React Native/Expo (mẫu tham khảo):
  https://github.com/maateusx/react-native-expo-facial-recognition
- ArcFace ONNX production-grade (Expo + TypeScript):
  https://github.com/DhouiouiCharfeddine/react-native-expo-facial-recognition
- Expo FaceDetector (đã deprecated từ SDK 51):
  https://docs.expo.dev/versions/latest/sdk/facedetector/
- Face detector dùng MLKit cho Expo:
  https://github.com/luicfrr/react-native-face-detector-camera
- SDK có liveness cho RN (dùng qua dev build):
  https://www.npmjs.com/package/@biopassid/face-sdk-react-native
- Liveness Detection — best practices (anti-spoofing):
  https://www.complycube.com/en/liveness-detection-anti-spoofing-practices/
- Face Liveness — hướng dẫn 2025 (ISO/IEC 30107-3, iBeta):
  https://sumsub.com/blog/face-liveness-detection/
