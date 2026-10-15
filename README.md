# Học tiếng Trung IT

Web học tiếng Trung cho lập trình viên/IT người Việt làm trong nhà máy. Lộ trình A: HSK 1–5 (HSK 2.0). Lộ trình B: tiếng Trung IT.

```bash
npm install
npm run dev        # chạy thử
npm test           # unit test
npm run validate   # kiểm tra schema + trùng id mọi dữ liệu (HSK, IT, hội thoại, ngữ pháp...)
npm run data       # dựng lại hội thoại + ngữ pháp HSK từ file nguồn rồi validate
npm run audit      # in danh sách chữ đa âm trong hội thoại để rà soát pinyin
```

## Nội dung chính: HSK 1–5
- **Từ vựng HSK 1–5** (2491 từ): flashcard SM-2, tập viết, nghe gõ, thi thử. Thẻ HSK có câu ví dụ lấy từ kho hội thoại nhà máy.
- **Hội thoại nhà máy**: 567 đoạn (2268 câu) trong 29 chủ đề (chấm công, đổi ca, an toàn, vận hành và sửa máy, kho, chất lượng, tăng ca, lương, ký túc xá, đời sống...), mỗi đoạn có cấp HSK. Nguồn nằm ở `src/data/dialogues-src/*.txt`, chạy `npm run data` để dựng `src/data/dialogues.json`.
- **Luyện đọc**: bấm từ trong hội thoại để xem pinyin, nghĩa và cấp HSK (tự tách từ theo danh sách HSK).
- **Ngữ pháp**: 30 mẫu HSK 1–5 (`src/data/grammar-hsk-src.json`) và 10 mẫu công sở, đều có lỗi người Việt hay mắc và bài sắp xếp câu.
- Tiếng Trung IT (332 thuật ngữ trong 8 nhóm, 7 mẫu tin nhắn) là lộ trình phụ.

## Tiến độ (bước)
- [x] 1. Khung, routing, store, schema HSK + IT, validate dữ liệu, lưu DB cục bộ
- [x] 2. SRS SM-2 dùng chung HSK + IT, flashcard HSK1–5 và 40 thuật ngữ IT (devices, support)
- [x] 3. Tập viết, nghe gõ, đọc tài liệu, tra cứu; thiết kế lại giao diện
- [x] 4. 20 kịch bản hội thoại đóng vai, 7 mẫu tin nhắn WeChat/email điền biến + sao chép; giao diện full màn, combo box tự vẽ
- [x] 5. Ngữ pháp công sở (10 mẫu, 12 bài sắp xếp câu kéo thả), kiểm tra HSK mô phỏng có đồng hồ, mở khóa cấp, thi xếp lớp
- [x] 6. Dashboard (biểu đồ ôn 30 ngày, tiến độ theo cấp HSK và nhóm IT, ước tính ngày đạt mục tiêu), PWA offline
- [x] 7. Chuyển trọng tâm sang HSK 1–5: 567 hội thoại nhà máy theo cấp HSK, luyện đọc/nghe/ngữ pháp theo cấp, 8 nhóm IT đủ từ 40 thuật ngữ
- [x] Giai đoạn 0 (`/start`): bảng 21 thanh mẫu và 35 vận mẫu có âm thanh, 4 thanh + thanh nhẹ, biến điệu thanh 3 / 不 / 一, 8 nét cơ bản và 8 quy tắc thứ tự nét, 30 bộ thủ, 30 chữ đầu tiên (bộ thẻ riêng cho flashcard, tập viết, in phiếu)
- [x] Ô gõ pinyin hiện ngay dạng có dấu khi gõ số thanh (`usePinyinInput`); phím tắt `/` và Alt+1..5
- [x] Kiểm duyệt nội dung (`/review`): đánh dấu đã kiểm duyệt, ghi chú sửa, xuất CSV các mục chưa kiểm duyệt, nhập lại CSV đã điền
- [x] In phiếu tập viết (`/print`): phiếu A4 có chữ mẫu, chữ mờ, ô mễ hoặc ô điền, thứ tự nét, pinyin và nghĩa
- [x] Sau bài thi (`/exam`) có nút đưa các từ làm sai vào lịch ôn hôm nay (tạo thẻ mới hoặc kéo thẻ chưa đến hạn về hôm nay)
- [x] Mục tiêu số ngày học mỗi tuần (Cài đặt) và tiến độ tuần trên trang Hôm nay
- [x] Đọc thử bằng micro (thẻ ôn và hội thoại): chấm từng chữ theo âm và thanh bằng nhận dạng giọng nói của trình duyệt
- [x] Gói âm thanh người thật: phát file thu âm nếu có, không thì dùng giọng máy
- [x] Máy chủ ASP.NET Core + SQL Server (`server/`): tài khoản, phân quyền, tiến độ học; giao diện chuyển sang dùng khi đặt `VITE_API_URL`
- [x] Video của tôi (`/videos`): mỗi người tự lưu link YouTube, xem ngay trong ứng dụng, gán cấp HSK và ghi chú
- [x] HSK 6: thêm 2500 từ HSK 2.0 cấp 6 (`src/data/hsk6.json`, `npm run hsk6`), có trong thẻ ôn, thi cuối cấp, tra cứu, nghe từ, tiến độ và video
- [x] Thi thử HSK (`/mock`): khung thi đúng cấu trúc HSK 1–6 (nghe, đọc, viết, tính giờ từng phần, thang điểm 200/300, ngưỡng đạt), lưu kết quả kèm điểm từng phần
- [x] Nghĩa tiếng Việt và âm Hán Việt cho toàn bộ 4991 từ HSK 1–6 (bản nháp AI, chưa kiểm duyệt); sửa 259 từ nhiều âm bị lấy nhầm cách đọc; thanh bên thu gọn được
- [ ] (đã gỡ khỏi menu theo yêu cầu) Giáo trình HSK1 (`/course`): mã và dữ liệu `src/features/course`, `src/data/course-hsk1.json` vẫn còn, đường dẫn và mục menu đã bỏ
- [x] Đăng nhập (`/login`) và quản lý tài khoản (`/admin`): mỗi người một kho tiến độ riêng, người đầu tiên là quản trị viên, tự đăng xuất khi không thao tác 30 phút (nếu không chọn "ghi nhớ")

## Giáo trình HSK1 (Khóa Đi Làm)
Dữ liệu ở `src/data/course-hsk1.json`, tách từ các PDF trong thư mục giáo trình (bài 1 đến 15, cùng thư mục `Tổng hợp ôn tập`). Đây là bộ giáo trình Hán ngữ quyển 1 do khóa học của bạn dùng; **thư mục không có tài liệu bài 6, 7, 8** nên các bài đó hiện mờ, chưa có nội dung.
- **Cách tách**: các PDF này có lớp chữ nên tách được bằng `pypdfium2` (không cần OCR); chữ Hán và pinyin tách đáng tin, nghĩa tiếng Việt chỉ lấy khi rõ ràng (bài 10 đến 15), còn lại lấy từ bộ từ HSK của ứng dụng theo chữ Hán. Hai file ảnh quét (giới thiệu bản thân, bài tập ngày 16+17) không có chữ nên chưa đọc được. Danh sách từ của bài 3, 4, 9, 14 có thể thiếu vài từ ở các trang sau; hãy đối chiếu rồi sửa trực tiếp trong JSON.
- **Chức năng**: danh sách bài kèm vòng tiến độ; trong mỗi bài có từ mới (nghe phát âm, báo từ nào chưa có trong bộ HSK), nút **Thêm từ vào thẻ ôn** (chỉ tạo thẻ cho từ có trong bộ HSK, hiện 72% số từ; số còn lại hiện nhãn "chưa có thẻ"), **Kiểm tra từ mới** 10 câu xen kẽ chữ Hán sang nghĩa và nghĩa sang chữ Hán (đạt từ 80%), và 3 ô tự đánh dấu (xem bài giảng, học từ mới, làm bài tập).
- **Ngữ pháp**: bài 10, 11, 12, 13 và 15 có mục ngữ pháp (quy tắc ngắn và ví dụ có nút nghe). Phần này là **tóm tắt bằng lời của tôi** dựa trên các mục trong PDF, không chép nguyên văn; bài 11 chỉ có hai mục vì PDF của bài này chỉ nêu trạng ngữ, 也 và 都. Các bài 1 đến 9 và 14 chưa có vì tài liệu ở dạng bảng từ vựng, chưa có phần ngữ pháp riêng; hãy đối chiếu với giáo viên trước khi dùng chính thức.
- **Lưu tiến độ**: cờ đánh dấu lưu như phần chỉnh sửa riêng của người dùng (khóa `course:<bài>:<bước>`), điểm kiểm tra lưu cùng nơi với điểm hội thoại (`course:<bài>:quiz`), nên dùng được cả ở chế độ trình duyệt lẫn máy chủ mà không cần đổi cơ sở dữ liệu.
- **Tài liệu gốc**: ứng dụng không chứa PDF và video (khoảng 1,5 GB, phần lớn video tải từ nguồn bên thứ ba). Trang chỉ liệt kê tên tài liệu của từng bài để biết mở file nào trong thư mục. Muốn xem video ngay trong ứng dụng thì lưu link YouTube gốc ở mục Video của tôi.

## Video YouTube tự lưu
Trang **Video của tôi** (`/videos`): dán link YouTube, ứng dụng lưu vào danh sách riêng của tài khoản (không ai khác thấy), phát ngay trong trang, kèm cấp HSK và ghi chú.
- Nhận link `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/` và mốc `t=90` / `t=1m30s`. Tên miền được kiểm tra chính xác (`youtube.com.evil.com` bị từ chối); mã video phải đúng 11 ký tự. Chưa nhận link danh sách phát (playlist).
- Phát bằng `youtube-nocookie.com` trong iframe có `sandbox`. Tên video tự lấy qua oEmbed của YouTube nếu để trống (không được thì dùng mã video, vẫn đặt tên tay được).
- Video không được tải về hay cache: **cần Internet để xem**; offline vẫn xem được danh sách và ghi chú. Một số video chủ kênh không cho nhúng sẽ báo lỗi ngay trong khung phát, khi đó dùng liên kết "Mở trên YouTube".
- **Mốc cần nghe lại**: mỗi video có tối đa 50 mốc (thời điểm kèm ghi chú). Gõ mốc theo khung phát (`1:15`, `1:02:03`, `75`), bấm nút mốc để phát lại từ đó. Ứng dụng không đọc được thời điểm đang phát của khung YouTube nên mốc phải gõ tay.
- Dữ liệu nằm trong kho tiến độ của người dùng (IndexedDB bản 5 hoặc bảng `Videos` trên máy chủ), nên đi theo xuất/nhập tiến độ; tối đa 2000 video mỗi người.

## Máy chủ (ASP.NET Core + SQL Server)
Mặc định ứng dụng chạy hoàn toàn trên trình duyệt (xem mục Tài khoản). Muốn dùng máy chủ để đăng nhập thật và đồng bộ tiến độ giữa các máy:

1. **Chạy máy chủ** (cần .NET 8 SDK; mặc định dùng SQL Server LocalDB, tự tạo DB và bảng ở lần chạy đầu):
   `npm run server` (cổng 5080, môi trường Development). Đổi chuỗi kết nối ở `server/src/HocTrungIt.Api/appsettings.json` (`ConnectionStrings:Default`).
2. **Chạy giao diện trỏ vào máy chủ**: tạo `.env.local` chứa `VITE_API_URL=http://localhost:5080` (xem `.env.example`) rồi `npm run dev`. Bỏ biến này thì giao diện quay về chế độ chạy trên trình duyệt.
3. **Kiểm thử máy chủ**: `npm run server:test` (24 test tích hợp qua HTTP trên SQLite).

Cấu trúc: `server/src/HocTrungIt.Api` (minimal API, EF Core, migration trong `Data/Migrations`), `server/tests/HocTrungIt.Tests`.
- **Đăng nhập**: JWT (HS256). Mật khẩu băm PBKDF2-SHA256, 210.000 vòng, muối riêng, so sánh hằng thời gian; sai 5 lần thì khóa tạm 30 giây gấp đôi mỗi lần (tối đa 15 phút); giới hạn 30 yêu cầu/phút/IP cho đăng nhập và đăng ký; thông báo sai đăng nhập không cho biết tên có tồn tại hay không.
- **Thu hồi phiên ngay**: mỗi người có `TokenVersion`; đổi mật khẩu, đặt lại, đổi vai trò, vô hiệu hóa hoặc xóa tài khoản thì token cũ bị từ chối ở yêu cầu kế tiếp, giao diện đưa về trang đăng nhập.
- **Phân quyền**: `/api/admin/*` chỉ quản trị viên. `/api/me/*` luôn lấy id người dùng từ token, không nhận id từ yêu cầu, nên không đọc được dữ liệu người khác. Xóa tài khoản xóa theo toàn bộ tiến độ (khóa ngoại cascade). Không thể xóa, hạ quyền hay vô hiệu hóa quản trị viên cuối cùng.
- **Dữ liệu**: bảng `Users`, `AppSettings`, `UserSettings`, `Cards`, `ReviewLogs`, `Overrides`, `Dialogues`, `Exams`. Nhập tiến độ chạy trong một giao dịch: lỗi thì giữ nguyên dữ liệu cũ. Nội dung gốc (từ HSK, thuật ngữ IT, hội thoại) vẫn nằm trong ứng dụng, không lên máy chủ.
- **Triển khai thật**: đặt khóa ký bằng biến môi trường `Jwt__Key` (ít nhất 32 ký tự, khóa trong `appsettings.Development.json` chỉ để phát triển; máy chủ không khởi động nếu thiếu), chạy sau HTTPS, đặt `Cors__Origins__0` là địa chỉ giao diện. Token nằm trong localStorage/sessionStorage của trình duyệt nên cần HTTPS và chặn XSS như mọi ứng dụng SPA.
- **Chưa làm**: chuyển tiến độ từ chế độ trình duyệt lên máy chủ tự động (dùng được nút xuất/nhập JSON trong Cài đặt, hoặc ô giữ tiến độ cũ khi tạo quản trị viên đầu tiên), đặt lại mật khẩu qua email, đăng nhập một lần (SSO/AD).

## Tài khoản
- Tài khoản lưu trong IndexedDB `hoc-trung-it-auth`; mật khẩu băm PBKDF2-SHA256 (210.000 vòng, muối ngẫu nhiên), không lưu chữ thường. Sai 5 lần liên tiếp thì khóa 30 giây, gấp đôi mỗi lần sau, tối đa 15 phút.
- Mỗi người có DB riêng `hoc-trung-it-u-<id>`; xóa tài khoản là xóa luôn DB này.
- Người đầu tiên tạo tài khoản thành quản trị viên và có thể chuyển tiến độ cũ (DB `hoc-trung-it` từ bản chưa có đăng nhập) vào tài khoản của mình. Quản trị viên tạo tài khoản, đặt lại mật khẩu, vô hiệu hóa, đổi vai trò, xóa, xuất tiến độ từng người, và tắt/mở đăng ký tự do. Không thể xóa hoặc hạ quyền quản trị viên cuối cùng.
- **Giới hạn thật**: dữ liệu vẫn nằm trên chính trình duyệt của máy đó, nên đây là cách tách tiến độ giữa nhiều người dùng chung máy, không phải bảo mật chống người có quyền vào máy (mở DevTools là sửa được). Chưa đồng bộ giữa các máy. Quên mật khẩu thì nhờ quản trị viên đặt lại; quản trị viên duy nhất quên mật khẩu thì phải xóa dữ liệu trình duyệt.
- Điểm thay thế: interface `AuthService` ở `src/lib/auth.service.ts` (hiện là `LocalAuthService`); khi có ASP.NET Core thì viết lớp gọi API và đưa vào `setAuthService()` ở `auth.instance.ts`, cùng với `Storage` phía server.

## Đọc thử và âm thanh người thật
- **Đọc thử** dùng Web Speech API (`SpeechRecognition`, zh-CN) nên chỉ chạy trên Chrome và Edge, cần Internet, và Chrome gửi âm thanh lên máy chủ của Google. Máy trả về chữ nghe được, ta so với câu mẫu từng chữ (`src/lib/pronounce.ts`): cùng âm cùng thanh là đúng, đúng âm sai thanh là "tone", còn lại là sai hoặc thiếu. Đây là công cụ tham khảo: máy nhận dạng hay đoán đúng theo ngữ cảnh nên có thể bỏ qua lỗi thanh điệu. Không thay được giáo viên.
- **Gói âm thanh**: ứng dụng không kèm file thu âm. Để thêm: `npm run audio -- list` (thêm `--kind=dialogue` hoặc `--level=2` để thu theo đợt) ghi `audio-todo.csv` gồm tên file, chữ Hán, pinyin, nghĩa của từng câu; thu âm rồi lưu mp3/ogg/m4a/wav vào `public/audio/` đúng tên file; chạy `npm run audio -- manifest` để tạo `public/audio/manifest.json` và xem độ phủ. Tên file là mã băm của chính câu chữ Hán (bỏ dấu câu), nên sửa câu thì mã đổi và file cũ bị báo là thừa thay vì phát nhầm. Câu chưa có file vẫn dùng giọng máy. File thu âm được cache dần để nghe offline.
- Có hiện 5014 mục khác nhau (từ HSK, thuật ngữ IT, câu hội thoại). Nên thu hội thoại HSK 1–2 trước.

## Lưu trữ
Mọi thứ nằm trong IndexedDB cục bộ của trình duyệt (Dexie, mỗi tài khoản một DB `hoc-trung-it-u-<id>`; DB `hoc-trung-it` là kho chung của bản cũ):
`settings`, `cards`, `log`, `overrides` (phần bạn sửa), cùng `hsk`, `it`, `meta` (nội dung gốc nạp từ JSON ở lần chạy đầu, nạp lại khi dữ liệu đổi; không đè `overrides`).
UI chỉ dùng interface `Storage` ở `src/lib/storage.ts`; thay bằng API ASP.NET Core + SQL Server bằng cách viết lớp mới implement interface này và gọi `setStorage()`.
Cài đặt có nút xuất/nhập tiến độ ra file JSON.

## Thiết kế
Ý tưởng "mực và ấn đỏ": nền sương xanh (sáng) hoặc chàm đậm (tối), chữ Hán lớn bằng Noto Serif SC, con dấu đỏ trên mỗi thẻ ghi cấp HSK hoặc nhóm IT, pinyin tô màu theo thanh điệu (đỏ thanh 1, hổ phách thanh 2, xanh lục thanh 3, xanh dương thanh 4, xám thanh nhẹ). Giao diện chữ dùng Be Vietnam Pro. Mobile-first: thanh tab dưới trên điện thoại, thanh bên trên desktop. Token màu nằm ở `src/style.css`.

## Giả định
- Dự án nằm ở thư mục con `hoc-trung-it`; dữ liệu HSK lấy từ `hsk-data/hsk-data/*.json` (2491 từ: 150/147/298/598/1298). **Đã đối chiếu với danh sách HSK 2.0 chính thức cấp 1–5 của drkameleon/complete-hsk-vocabulary: khớp 100%, không thiếu từ nào, không lệch cấp.** Con số 2491 thấp hơn mức 2500 danh nghĩa (150/150/300/600/1300) vì 9 từ trùng chữ Hán giữa các cấp chỉ được tính một lần. Con số 5000 là của HSK 1–6 cộng dồn, không phải 1–5.
- `id` HSK dạng chuỗi `hsk1-0001`; id IT dạng `it-<domain>-NNN`, domain là: `network, server, database, dev, erp_mes, devices, support, comms`.
- `hsk_max` của thuật ngữ IT: 1–5, hoặc 6 = có chữ ngoài HSK1–5. Tính bằng `npx tsx scripts/compute-hsk-max.ts --write` (cấp của chữ = cấp thấp nhất của từ HSK chứa chữ đó; xấp xỉ).
- `pinyin` IT ghi tay, tách âm tiết bằng dấu cách, giữ chữ Latin (`ERP xì tǒng`). Validator kiểm số âm tiết khớp số chữ Hán + cụm Latin, không kiểm đúng thanh.
- Thuật ngữ IT: 332 mục, pinyin ghi tay, mỗi nhóm từ 40 trở lên. Bài đọc kỹ thuật: 5 đoạn, pinyin từng từ ghi tay.
- **Pinyin của kho hội thoại và ngữ pháp HSK được sinh bằng `pinyin-pro`, không ghi tay từng câu.** Để kiểm soát chữ đa âm: `npm run audit` liệt kê mọi chữ có từ hai âm đọc khác nhau kèm ngữ cảnh; những chỗ sai được sửa bằng bảng ghi đè viết tay `src/data/pinyin-overrides.json` (ví dụ 我得 děi, 说得 de, 只剩 zhǐ, 不转 zhuàn, 天假 jià). Đã rà soát một lượt toàn bộ danh sách hiện tại, nhưng vẫn còn rủi ro sót; nội dung giữ nhãn chưa kiểm duyệt.
- Cấp HSK của đoạn thoại: cấp nhỏ nhất mà các chữ HSK ≤ cấp đó bao phủ từ 90% số chữ (`level`), kèm cấp của chữ khó nhất (`maxLevel`). Cấp của từng chữ = cấp thấp nhất của từ HSK chứa chữ đó, nên là xấp xỉ.
- Phân bố hội thoại theo cấp: HSK 1: 37, HSK 2: 99, HSK 3: 101, HSK 4: 236, HSK 5: 92, trên HSK 5: 2. Từ vựng nhà máy (设备, 质量, 仓库...) vốn thuộc cấp cao nên cấp 4–5 dày hơn.
- Biến điệu 一 và 不: pinyin dùng dạng biến điệu (yí gè, bú shì); khi chấm, người học gõ dạng gốc hay biến điệu đều đúng.
- Giai đoạn 0: nội dung (`src/data/stage0.json`) viết tay và được test đối chiếu từng chữ ví dụ với `pinyin-pro`. Mô tả cách đọc thanh mẫu bằng tiếng Việt chỉ là so sánh gần đúng, nên nghe âm thanh làm chuẩn. Giọng đọc dùng Web Speech nên chất lượng phụ thuộc máy. Bài đoán bộ thủ lấy chữ và bộ từ trường `radical` của dữ liệu HSK 1–3 (dữ liệu dùng dạng biến thể như 亻 氵 扌). Ví dụ của từng bộ thủ cũng tự lấy từ dữ liệu HSK, mỗi bộ có ít nhất 3 chữ.
- Pinyin biến điệu: thanh 3 liền thanh 3 viết dạng gốc (nǐ hǎo) theo thông lệ sách giáo khoa; 不 và 一 viết dạng đã biến điệu.
- Kiểm duyệt: gom 951 mục (332 thuật ngữ, 567 hội thoại, 5 bài đọc, 40 mẫu ngữ pháp, 7 mẫu tin). Trạng thái và ghi chú lưu trong bảng `overrides` của DB cục bộ (khóa dạng `dl:dl-0001`) nên không đè dữ liệu gốc và đi theo file xuất tiến độ. CSV xuất ra có BOM UTF-8 để Excel mở đúng chữ Hán và tiếng Việt; nhập lại cần các cột `key`, `đã kiểm duyệt (Y/N)`, `ghi chú sửa`, dòng có key lạ bị bỏ qua.
- In phiếu tập viết: dùng `window.print()` với CSS `@media print` (khổ A4, bỏ toàn bộ khung giao diện, nền trắng mực đen dù đang ở chế độ tối). Mỗi hàng một chữ: ô mẫu đậm, các ô chữ mờ để tô theo, ô trống, kèm dải thứ tự nét (vẽ từ dữ liệu hanzi-writer, cần mạng lần đầu hoặc đã tải sẵn trong Cài đặt). Số hàng mỗi trang tính theo cỡ ô để không tràn. Font chữ mẫu ưu tiên KaiTi (楷体) nếu máy có, nếu không dùng Noto Serif SC. Pinyin từng chữ tách từ pinyin của từ khi số âm tiết khớp số chữ.
- Nếu `npm run dev` báo "Port 5173 is already in use" hoặc trang báo "504 Outdated Optimize Dep": còn một tiến trình Vite cũ đang chạy; tắt hết terminal cũ rồi chạy lại.
- Vite dev: đã khai báo `optimizeDeps.include` để tránh lỗi "504 Outdated Optimize Dep" khi mở trang lần đầu.
- SM-2: Quên→q2 (reset, gặp lại cuối phiên, hạn mai), Khó→q3 (khoảng cách ×1.2), Được→q4, Dễ→q5 (×1.3). Ngày tính theo giờ địa phương.
- Tập viết dùng hanzi-writer, tải dữ liệu nét từ CDN jsDelivr nên cần mạng lần đầu (bước PWA sẽ cache lại để dùng offline).
- Giọng đọc dùng Web Speech zh-CN của trình duyệt; chất lượng phụ thuộc máy. Có chỗ cắm mp3 qua `registerAudioSource` trong `src/composables/useSpeech.ts`.
- Hội thoại: mỗi kịch bản 4 câu (2 câu của bạn), pinyin ghi tay và được validator kiểm số âm tiết. Phương án nhiễu trong chế độ "Chọn" lấy tự động từ câu của bạn ở các kịch bản khác, nên chưa sát ngữ cảnh bằng nhiễu soạn tay. Kết quả đóng vai chưa lưu vào DB.
- Mẫu tin nhắn: mỗi biến có danh sách gợi ý (Trung + Việt) hoặc "Tự nhập"; bản Việt dùng lại giá trị Trung khi tự nhập (tên hệ thống, giờ). Chưa có pinyin cho nội dung điền.
- Bài kiểm tra HSK: đề trắc nghiệm tự sinh từ từ vựng HSK thật (chọn nghĩa, chọn pinyin, chọn chữ Hán), không có phần nghe và đọc hiểu như kỳ thi chính thức. Nghĩa dùng tiếng Việt bạn đã nhập, nếu chưa có thì dùng nghĩa tiếng Anh đầu tiên. Cuối cấp: 30 câu, 20 phút, đạt từ 80%. Thi xếp lớp: 5 câu mỗi cấp, 15 phút; cấp được đề xuất là cấp đầu tiên đạt dưới 70%.
- Khóa cấp: HSK 1 luôn mở; HSK n+1 mở khi đạt bài cuối cấp n hoặc thi xếp lớp đề xuất từ n+1. Chỉ áp dụng cho bộ thẻ HSK ở chế độ đầy đủ; thuật ngữ IT luôn mở. Kết quả thi lưu trong bảng `exams` của DB cục bộ và có trong file xuất tiến độ.
- Ngữ pháp: nội dung do AI soạn, đánh dấu chưa kiểm duyệt. Bài sắp xếp câu có thể kéo thả hoặc bấm từng mảnh (dùng được trên điện thoại).
- Dashboard: "đã thuộc" = khoảng ôn kế tiếp từ 21 ngày; mục tiêu là học hết thẻ của một bộ (IT hoặc một cấp HSK). Ngày dự kiến = số thẻ còn lại chia nhịp thẻ mới/ngày trung bình 14 ngày qua (tính cả ngày nghỉ), kèm một ước tính theo số thẻ mới mỗi ngày trong Cài đặt.
- PWA (vite-plugin-pwa, `autoUpdate`): precache toàn bộ giao diện và dữ liệu HSK/IT (khoảng 1,5 MB); nét chữ hanzi-writer và font Google cache dần khi dùng, hoặc bấm "Tải nét chữ" trong Cài đặt. Service worker chỉ chạy ở bản build (`npm run build && npm run preview`), không chạy ở `npm run dev`. Chưa kiểm tra đăng ký service worker trên trình duyệt thật (khung trình duyệt trong ứng dụng chặn service worker); đã kiểm tra tĩnh `sw.js` và manifest.
- Biểu tượng ứng dụng sinh từ `public/icon.svg` bằng `npx tsx scripts/make-icons.ts` (cần chữ Hán trong font hệ thống để vẽ 学).
- Chuyển trang dùng animation CSS thuần (không dùng Vue Transition) để không bị treo khi tab ẩn.
- Nghe gõ chỉ dùng thuật ngữ IT (10 câu mỗi lượt); nghĩa trong HSK để trống thì dùng nghĩa tiếng Anh đầu tiên.
- Router dùng hash history (chạy được khi mở file tĩnh / PWA mà không cần cấu hình server).
- Tailwind v3, TypeScript 5.9 (vue-tsc chưa chạy với TypeScript 6).

## Thi thử HSK (theo cấu trúc đề)
Trang **Thi thử HSK** (`/mock`) mô phỏng *cấu trúc* bài thi HSK 2.0, lõi ở `src/lib/mock.ts`:

| Cấp | Phần | Số câu | Thời gian | Điểm |
|---|---|---|---|---|
| HSK 1 | Nghe, Đọc | 20 + 20 | 15 + 17 phút | tối đa 200, đạt từ 120 |
| HSK 2 | Nghe, Đọc | 35 + 25 | 25 + 22 phút | tối đa 200, đạt từ 120 |
| HSK 3 | Nghe, Đọc, Viết | 40 + 30 + 10 | 35 + 30 + 15 phút | tối đa 300, đạt từ 180 |
| HSK 4 | Nghe, Đọc, Viết | 45 + 40 + 15 | 30 + 40 + 25 phút | tối đa 300, đạt từ 180 |
| HSK 5 | Nghe, Đọc, Viết | 45 + 45 + 10 | 30 + 45 + 40 phút | tối đa 300, đạt từ 180 |
| HSK 6 | Nghe, Đọc | 50 + 50 | 35 + 50 phút | tối đa 200, đạt từ 120 |

Mỗi phần tối đa 100 điểm. Số câu, thang điểm và ngưỡng đạt tôi ghi theo cấu trúc HSK 2.0 đã công bố rộng rãi **theo trí nhớ, chưa đối chiếu với tài liệu chính thức của Hán Ban, hãy kiểm tra lại**. Thời gian từng phần là thời gian làm bài, chưa tính các phút điền phiếu trả lời và thông tin thí sinh của kỳ thi thật.
- **Nội dung câu hỏi không phải đề thật**: ứng dụng tự dựng từ kho hội thoại nhà máy và từ vựng HSK của chính nó (đề thật có bản quyền nên không đưa vào). Dạng câu: nghe câu chọn nghĩa, nghe câu hỏi chọn câu trả lời, đọc câu chọn nghĩa, điền từ vào chỗ trống, đọc câu hỏi chọn câu trả lời, sắp xếp từ thành câu (HSK 3). Mỗi lần dựng một đề mới, không lặp câu trong cùng đề.
- **Khác với thi thật**: phần nghe dùng giọng đọc của trình duyệt (hoặc file thu âm nếu có trong gói âm thanh), mỗi câu nghe tối đa 2 lần; không có câu hỏi dạng ghép tranh, đọc đoạn văn dài hay viết chữ Hán; hết giờ một phần thì tự chuyển phần sau và không quay lại được. Điểm chỉ để tham khảo, không dự đoán được kết quả thi thật.
- **HSK 4–6**: có thêm dạng câu nghe cả đoạn hội thoại rồi chọn tiêu đề phù hợp và đọc cả đoạn rồi chọn tiêu đề (mỗi hội thoại 4 dòng, tiêu đề lấy từ chính kho hội thoại); câu điền từ ưu tiên khoét từ thuộc cấp gần cấp thi; câu sắp xếp từ dài đến 9 từ. Hội thoại lấy từ cấp thi và cấp liền dưới (HSK 6: cấp 5 và 6, vì kho chỉ có 2 hội thoại gán nhãn cấp 6).
- **Khác đề thật ở HSK 4–6**: phần viết chỉ có sắp xếp từ thành câu (đề thật HSK 4 còn có viết câu theo từ cho sẵn, HSK 5 có viết đoạn ngắn, HSK 6 có viết bài tóm tắt 400 chữ, đều không chấm tự động được). **HSK 6 vì vậy chỉ có nghe và đọc, thang 200, đạt từ 60%, không phải thang 300 của đề thật.** Các bài đọc và nghe của đề thật dài và khó hơn nhiều so với hội thoại 4 dòng ở đây, nên kết quả thi thử cấp cao dễ cao hơn kết quả thật.
- Kết quả lưu như một bài thi (`kind: mock`, kèm điểm từng phần trong `detail`), không ảnh hưởng việc mở khóa cấp.
- **Đối chiếu cấu trúc với nguồn trên mạng** (ngày 14/10/2026, chỉ có các trang của bên thứ ba, không tìm được tài liệu chính thức của Hán Ban/CLEC để mở): HSK 4 (45 nghe + 40 đọc + 15 viết, khoảng 100 phút chưa kể điền thông tin) và HSK 5 (45 nghe 30 phút + 45 đọc 45 phút + 10 viết 40 phút, 300 điểm, đạt 180) **khớp** với bảng trên. HSK 6 các nguồn **mâu thuẫn nhau** (một nguồn ghi 50 nghe + 50 đọc + 1 viết, 135 phút; nguồn khác ghi 35 nghe + 40 đọc + 2 bài viết, 140 phút); bảng trên theo nguồn đầu. Cần đối chiếu với tài liệu chính thức nếu dùng để quyết định gì quan trọng.

### Nạp đề từ file
Ứng dụng **không kèm đề HSK thật** (có bản quyền). Ở sảnh Thi thử HSK có mục **Nạp đề từ file** để thi bằng đề do bạn hoặc giáo viên cung cấp (đề tự soạn, đề mẫu tải từ trang chính thức của kỳ thi cho mục đích học cá nhân): bấm **Tải file mẫu** để lấy mẫu JSON, sửa lại, rồi **Chọn file đề**. Chỉ nạp đề bạn có quyền sử dụng.
- Định dạng (xem `PAPER_TEMPLATE` trong `src/lib/mock-paper.ts`): `title`, `level` 1–6, `pass` (tùy chọn, mặc định 60%), `source` (tùy chọn, ghi nguồn và giấy phép), `sections[]` gồm `skill` (listening/reading/writing), `minutes`, `questions[]`. Mỗi câu có `kind`, `ask`, và: câu nghe cần `audio`; câu đọc cần `text`; câu trắc nghiệm cần `options` (2–6) và `answer` (từ 0); câu sắp xếp (`reorder`) cần `tokens` (và `bank` tùy chọn).
- File được kiểm tra kỹ và báo lỗi theo vị trí (ví dụ "Phần 1, câu 3: ..."); tối đa 300 câu, 2 MB. Điểm mỗi phần quy về 100 như đề dựng sẵn.
- Hạn chế: phần nghe vẫn đọc bằng giọng máy từ trường `audio` (chưa gắn file mp3 riêng cho từng câu), đề không được lưu lại sau khi thi nên lần sau phải nạp lại file, và không tự chuyển PDF của đề thành JSON.

## Nghĩa tiếng Việt và âm Hán Việt
Từ vựng HSK 1–6 (4991 từ) có nghĩa tiếng Việt (`meaning_vi`) và âm Hán Việt (`han_viet`, thiếu 19 từ vì là từ mượn hoặc trợ từ không có âm Hán Việt rõ ràng). **Đây là bản nháp do AI soạn, chưa giáo viên nào kiểm duyệt**: nghĩa có thể thiếu sắc thái, âm Hán Việt có thể sai ở vài từ.
- Nguồn để sửa nằm ở `src/data/vi-src/hsk<N>.txt`, mỗi dòng `số|chữ Hán|nghĩa|âm Hán Việt`. Sửa file rồi chạy `npm run vi` (có `-- --check` để chỉ kiểm tra) để ghi vào dữ liệu; script báo lỗi nếu lệch chữ Hán hoặc thiếu từ. Test `tests/vi.test.ts` giữ cho nguồn và dữ liệu luôn khớp.
- Người học vẫn tự sửa từng thẻ ngay trong ứng dụng; bản sửa của họ được ưu tiên hơn dữ liệu gốc (`overrides`).
- Thẻ ôn, bài thi cuối cấp và thi xếp lớp, nghe từ, tra cứu, in phiếu, nhập môn đều dùng nghĩa tiếng Việt; thẻ ôn hiện thêm âm Hán Việt.
- Đã sửa dữ liệu gốc bị lấy nhầm cách đọc ở chữ nhiều âm (ví dụ 都 từng hiện "Dū, họ Đỗ", 看 hiện "kān", 个 hiện "gě"): `npx tsx scripts/fix-hsk-readings.ts` đối chiếu với cách đọc phổ biến của pinyin-pro, loại các dạng họ, biến thể, từ cổ và có danh sách ngoại lệ thủ công (了 giữ `le`, 地 và 只 giữ nguyên). Đã đổi 259 từ, sửa ký hiệu `lu:è` thành `lüè` ở 8 từ.

## HSK 6
Cấp 6 gồm 2500 từ HSK 2.0 (tổng HSK 1–6 là 4991 từ), tải bằng `npm run hsk6` từ cùng nguồn MIT và đối chiếu: không trùng chữ với cấp 1–5, đủ pinyin và nghĩa tiếng Anh. **Chưa có nghĩa tiếng Việt và âm Hán Việt** (để trống, tự điền ở thẻ ôn), và **chưa có** hội thoại, ngữ pháp, giáo trình hay đoạn đọc riêng cho cấp 6.
- Thi cuối cấp có cấp 6 (30 câu trắc nghiệm từ vựng, 20 phút); cấp 6 mở khóa khi đạt 80% bài thi cấp 5. Thi xếp lớp vẫn chỉ trải đều cấp 1–5.
- Các hội thoại "cấp 6" trong kho hiện có (2 đoạn) vẫn mang nghĩa cũ là "trên HSK 5", chưa tính lại theo từ HSK 6. `hsk_max` = 6 của thuật ngữ IT nghĩa là có chữ ngoài HSK 1–5 (HSK 6 trở lên).

## HSK 2.0 và HSK 3.0
Ứng dụng học theo **HSK 2.0** (6 cấp, bộ từ 1–5 gồm 2491 từ). Thẻ ôn hiện thêm dòng "HSK 3.0: cấp N" cho từng từ theo danh sách HSK 3.0 (chuẩn mới, 9 cấp). Đối chiếu 2491 từ: 2417 từ có trong HSK 3.0 nhưng **chỉ 587 từ giữ nguyên cấp**, 1363 từ xuống cấp thấp hơn và 467 từ lên cấp cao hơn, nên không thể coi hai chuẩn là một. Tùy kỳ thi bạn hướng tới (HSK 2.0 hay 3.0) mà ôn theo chuẩn tương ứng. Ứng dụng chưa có chế độ học theo cấp HSK 3.0.

## Nguồn dữ liệu
- [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT): từ HSK 2.0 cấp 1–5 và danh sách HSK 3.0 (`npm run hsk30` tải lại `src/data/hsk30.json`)
- [CC-CEDICT](https://cc-cedict.org) (CC BY-SA 4.0)
- [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data) (nét chữ)

### Lưu đề đã nạp và gắn mp3

- Sau khi nạp đề từ file, đề được lưu vào **tài khoản** (tối đa 30 đề, mỗi đề tối đa 300.000 ký tự) và hiện ở mục "Đề đã lưu" để làm lại hoặc xóa. Chế độ trình duyệt lưu trong IndexedDB riêng từng người (Dexie v6, bảng `papers`); chế độ máy chủ lưu ở bảng `Papers` (`GET/PUT /api/me/papers`, `GET/DELETE /api/me/papers/{id}`), có trong xuất/nhập dữ liệu và xóa theo tài khoản.
- Câu nghe có thể ghi `"mp3": "cau01.mp3"`. Khi nạp đề, bấm "Chọn file mp3" để chọn các file tương ứng (tối đa 80 MB); câu nào có file thì phát file, không có thì dùng giọng máy. **File mp3 chỉ giữ trong phiên** và không được lưu vào tài khoản (dung lượng lớn), lần sau cần chọn lại.
- Thư mục `samples/` có 2 đề mẫu **tự soạn** (HSK 3 chủ đề nhà máy, HSK 4 bài đọc ngắn) để thử; không phải đề thi thật. Ứng dụng vẫn không kèm đề HSK thật vì bản quyền.

## Đưa lên mạng (chỉ giao diện)

Ứng dụng là web tĩnh (router dạng hash, `base: './'`), chạy ở chế độ trình duyệt: dữ liệu và tài khoản nằm trong IndexedDB của từng máy, không dùng chung giữa các máy.

- **Netlify:** vào app.netlify.com → Add new site → Deploy manually, kéo thả thư mục `dist` (sau `npm run build`); hoặc nối repo, `netlify.toml` đã có sẵn lệnh build và thư mục `dist`.
- **Vercel:** nối repo hoặc chạy `npx vercel` trong thư mục dự án; `vercel.json` đã có sẵn.
- Cần HTTPS để dùng micro và cài PWA; cả hai nơi đều cấp HTTPS miễn phí.
- Không đặt `VITE_API_URL` thì chạy chế độ trình duyệt. Muốn dùng máy chủ .NET phải triển khai riêng và đặt biến này trước khi build.
