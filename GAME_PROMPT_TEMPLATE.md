# Prompt Template — Vibe-Coding a 2D Game (Phaser 4 + Vite + TS)

Đây là file "prompt chuẩn" đúc kết từ kiến trúc thực tế của **Vibe Fighter**
(`src/game`, `src/scenes`) và bản prompt recipe gốc (`prompts.pdf`). Dùng file
này làm điểm xuất phát khi bắt đầu một dự án game 2D mới với AI (Cursor,
Claude Code, Codex...). Copy toàn bộ phần "PROMPT" bên dưới, điền vào các chỗ
`<...>`, rồi đưa cho agent theo đúng thứ tự các bước.

---

## 0. Stack & quy ước dự án (giữ nguyên trừ khi có lý do đổi)

- **Engine**: Phaser 4, TypeScript, Vite (dev server + build), Vitest cho unit
  test nhỏ (config/format logic, không test rendering).
- **Scripts chuẩn**: `npm run dev`, `npm run build` (chạy `tsc --noEmit` trước
  khi build), `npm run typecheck`, `npm test`.
- **Cấu trúc thư mục**:
  - `src/scenes/*Scene.ts` — mỗi màn hình/flow là một Scene riêng
    (Boot, Splash, MainMenu, ModeSelect, LevelSelect, CharacterSelect, Match,
    Settings...). `BaseScene.ts` chứa hành vi dùng chung.
  - `src/game/*Config.ts` — **mọi dữ liệu cân bằng/asset đều là config**, không
    hard-code trong logic: `characterConfig.ts`, `fighterConfig.ts`,
    `stageConfig.ts`, `backgroundConfig.ts`, `tileConfig.ts`. Config nặng
    (được chỉnh tay qua tool debug) được persist ra `public/configs/*.json`.
  - `src/game/assets.ts`, `generatedAssets.ts` — khai báo đường dẫn asset tập
    trung, tự động wire vào preload.
  - `src/shell/` — app shell / debug panel (UI ngoài canvas, ví dụ sidebar
    chỉnh số liệu live).
  - `public/assets/<character-or-stage-name>/` — asset theo từng nhân vật/màn
    chơi, cộng với `public/assets/index.json` liệt kê tổng.
- **Nguyên tắc kiến trúc cốt lõi**: mọi hộp va chạm/gameplay-critical đều là
  **config theo từng frame** (`hit box`, `hurt box`, `attack box`, `guard
  box`...), có thể chỉnh bằng gizmo trong dev tool và ngay lập tức phản ánh
  vào gameplay thật — không tách rời "data để test" và "data để chạy thật".
- **Dev/debug tooling đi trước gameplay**: xây trước các "gym"/"playground"
  scene (sandbox cô lập một hệ thống — animation, hitbox, stage, tile...) rồi
  mới lắp chúng vào flow chính. Điều này giúp debug nhanh và tách rời rủi ro.

---

## 1. Cách dùng file này

1. Điền vào phần **THAM SỐ DỰ ÁN** bên dưới.
2. Đưa từng bước trong **CHUỖI PROMPT** cho agent theo đúng thứ tự — **không
   gộp nhiều bước lớn vào một prompt**. Mỗi bước là một lần lặp: agent audit
   → lên plan → build → bạn test → sang bước tiếp theo.
3. Với các bước sinh ảnh (`$imagegen` hoặc tool tương đương), luôn yêu cầu
   agent **lưu asset + prompt gốc đã dùng** vào một thư mục có timestamp, để
   có thể tái tạo/chỉnh sau này.
4. Luôn yêu cầu "audit trước, code sau" ở các bước kiến trúc lớn — bắt agent
   liệt kê những gì starter/project hiện có, thiếu gì, rồi mới viết plan chi
   tiết.

---

## 2. THAM SỐ DỰ ÁN (điền trước khi dùng)

```
Tên game:            <...>
Thể loại:            <ví dụ: 2D fighting game kiểu Street Fighter>
Góc nhìn/kiểu chơi:  <ví dụ: side-scrolling, fixed-axis, top-down...>
Số người chơi:       <ví dụ: 2 local trên cùng bàn phím, 1vCPU>
Phong cách art:      <ví dụ: SNES pixel art, không quá phức tạp — demo kỹ thuật>
Nhân vật/thực thể:   <liệt kê, ví dụ: 3 fighter — red brawler, green boxer, jiu-jitsu fighter>
Bối cảnh/stage:      <ví dụ: rooftop dusk, rooftop sunset>
Cơ chế cốt lõi:      <ví dụ: light/heavy attack, block, meter special, combo>
```

---

## 3. CHUỖI PROMPT (đưa từng bước một)

### Bước 1 — Audit starter & lên kiến trúc

```
Chúng ta coi project hiện tại là một template. Ta muốn xây <thể loại game>
kiểu <tham chiếu game nổi tiếng> trên nền starter này. Trước khi viết code,
hãy audit những gì starter đã có (scenes, config pattern, debug tooling) và
cho tôi biết còn thiếu gì để làm được <thể loại game>.

Sau đó viết một implementation plan chi tiết. Ưu tiên kiến trúc tối giản
nhưng "thật" (representative) — tập trung vào animation + collision +
gameplay logic cốt lõi, không cần đủ mọi state ngay từ đầu (ví dụ với fighting
game: không cần block cao/thấp riêng biệt, đủ animation cơ bản là được cho
pass đầu).

Ràng buộc cho pass đầu tiên:
- <ràng buộc 1, ví dụ: 2 người chơi local dùng chung 1 bàn phím>
- <ràng buộc 2, ví dụ: 2 nút tấn công — nhẹ và mạnh>
- <ràng buộc 3, ví dụ: một scene chính dành riêng cho trận đấu>
Viết plan trước, sau đó build từng phần một (incremental), không build hết
một lần.
```

### Bước 2 — Concept mockup (art direction)

```
$imagegen — tạo 4 concept mockup cho <thể loại game>. Lưu vào
concepts/mockups/<timestamp>/ kèm đúng prompt đã dùng để sinh ảnh.

Tập trung vào art style và cảm giác tổng thể — đây là demo kỹ thuật, không
cần quá phức tạp. Ảnh phải dễ nhận ra là <thể loại/tham chiếu game>, phong
cách <phong cách art đã điền ở THAM SỐ DỰ ÁN>. Tạo 4 phiên bản khác nhau.
```

### Bước 3 — Tách lớp background/parallax

```
Chọn hướng <tên background đã chốt>. Tách thành các PNG riêng có nền trong
suốt để layer chồng lên nhau: far (xa nhất), medium, main (khu vực chơi
chính), near (vẽ đè lên trước main + nhân vật). Dùng $imagegen sinh từng lớp
riêng, lưu vào concepts/backgrounds/<tên-stage>/.

Nếu lớp main không full-width sát mép canvas, nó sẽ bị hở khi tile/scroll —
yêu cầu regenerate full-width khi phát hiện lỗi này.
```

### Bước 4 — Reference nhân vật (full-body)

```
Tạo ảnh reference full-body sạch cho nhân vật gốc <mô tả nhân vật chi tiết:
dáng người, tóc, trang phục, phụ kiện, tư thế>. Isolated full-body, tư thế
3/4 nghiêng, căn giữa với padding rộng, không có stage/HUD/đối thủ, không
logo/chữ. Lưu vào concepts/characters/<timestamp>/ kèm prompt.

Nếu có nhiều nhân vật: dùng sub-agent để sinh song song các nhân vật còn lại,
mỗi nhân vật lấy cảm hứng từ đúng mockup tương ứng đã chọn ở Bước 2. Cùng
phong cách, cùng convention isolated full-body. Lưu kèm cả prompt nháp và
prompt cuối.
```

### Bước 4b — Reference → spritesheet từng action → đăng ký vào game

Đây là bước nặng nhất và dễ hỏng nhất: từ **một ảnh reference** phải ra **~13
spritesheet action** khớp đúng quy ước của game. Làm từng action một, không
sinh cả bộ cùng lúc. Cần `pip install -r scripts/sprites/requirements.txt`.

**Quy ước sheet** (đo trực tiếp từ 3 fighter đang có, script dùng làm mặc định):

- Ô 256×256, sheet rộng 1280 (5 cột), đọc theo hàng, ô trống ở cuối nếu thiếu.
- Chân đứng trên dòng y = 227, tâm chân x ≈ 125, đứng cao ≈ 196px. Nhờ vậy mọi
  fighter chạm cùng một mặt đất và cùng tỉ lệ.
- Nhân vật **quay mặt sang trái (West)**. Nếu ảnh nguồn quay phải, thêm `--flip`.
- Mọi action của một nhân vật dùng **chung một scale** (lưu ở `scale.json`),
  nên luôn làm **idle trước**.

**Số frame/fps gợi ý** (lấy từ `redBrawler.ts`; số frame thật là do bạn khai
báo trong config, script in ra số frame thực tế):

| Action | Frame | fps | Lặp | `--align` | Gợi ý pose |
|---|---|---|---|---|---|
| idle | 12 | 8 | có | feet | thở nhẹ, lên xuống vài px, không đổi tư thế |
| walk-forward / walk-backward | 8 | 8 | có | centroid | chu kỳ bước chân đầy đủ |
| crouch | 5 | 10 | không | feet | hạ dần xuống tư thế ngồi thấp |
| jump | 8 | 10 | không | fixed | ngồi lấy đà → bật → đỉnh → rơi → chạm đất |
| block-high / block-low | 4 | 10 | không | feet | giơ tay che tầm cao / hạ thấp che tầm thấp |
| hit-high | 6 | 12 | không | feet | giật lùi khi trúng đòn |
| light-punch | 6 | 14 | không | fixed | co → vung → đánh trúng (frame 2–3) → thu |
| heavy-kick | 10 | 12 | không | fixed | dồn lực dài, đòn trúng ở giữa |
| special-charge | 5 | 14 | không | feet | gồng/nạp lực |
| special | 12 | 16 | không | fixed | nhiều đợt đánh, xen frame nghỉ giữa các đợt |
| knockdown | 10 | 10 | không | fixed | ngã ra sau và nằm xuống |

Ý nghĩa `--align`: `feet` = mỗi frame tự đặt chân xuống mặt đất (idle, đỡ đòn);
`centroid` = như `feet` nhưng căn theo khối thân, đỡ giật ở chu kỳ đi bộ;
`fixed` = giữ nguyên chuyển động trong ô so với frame 1, để cú nhảy, cú lao
người, cú ngã không bị "dán" xuống đất.

**Cách nhanh cho cả nhân vật: `scripts/sprites/character.py`.** Mô tả nhân vật
trong một manifest JSON (mẫu:
[viking-berserker.json](scripts/sprites/characters/viking-berserker.json) gồm ngoại
hình, danh sách action, pose từng frame, box placeholder, giới hạn bề rộng
hurtbox, `overflowParts` = những phần dễ tràn ô như vũ khí/khăn/tóc). Mẫu thứ hai không
cầm vũ khí dài: [kunoichi.json](scripts/sprites/characters/kunoichi.json). Lưu ý
engine coi `light-punch` là đòn **cao** và đòn nặng (`heavy-kick`/`heavy-punch`) là
đòn **thấp** (`fighter.ts`, `currentAttackKind`), nên thiết kế đòn nặng nhắm tầm thấp. Rồi chạy:

```
python scripts/sprites/character.py reference scripts/sprites/characters/<id>.json
#   -> chỉ cho nhân vật mới chưa có ảnh reference: in prompt sinh reference (prompts/00-reference.txt)
python scripts/sprites/character.py prompts scripts/sprites/characters/<id>.json
#   -> <conceptDir>/prompts/: 1 file prompt cho mỗi action + portrait, và README.md (checklist)
#   ... dán từng prompt vào Gemini, lưu ảnh thành <conceptDir>/raw/<action>.png ...
python scripts/sprites/character.py build scripts/sprites/characters/<id>.json
#   -> public/assets/<id>/ (sheet, gif, anchor-w.png, portrait.png) + src/game/<tên>.ts
```

`build` chạy lại bao nhiêu lần cũng được: nó xử lý những gì đang có trong `raw/`
và báo action nào thiếu hoặc sai số frame. Nó chỉ sinh file `.ts` khi đã đủ mọi
action và portrait (dùng `--force-ts` để sinh lại, sẽ ghi đè box đã chỉnh tay),
và tự làm `anchor-w.png` từ ảnh reference. Sau đó chỉ còn nối dây như mục 3.
Các mục 1–3 bên dưới là cách làm thủ công tương đương, kèm giải thích chi tiết.

**Bài học khi làm Viking Berserker + Kunoichi (2026-10)** — các field manifest dưới đây
đều do `character.py` hỗ trợ:

- **Dùng lưới 3×2 (6 frame) cho hầu hết action.** Gemini luôn vẽ kín ô, nên ở lưới 4×2
  (ô 704px) vũ khí dài vắt qua đường lưới và bị cắt. Trong một cuộc chat dài, Gemini còn
  **bắt chước lưới của sheet trước** (xin 2×2 lại trả 3×2/3×3): khi đó cứ sửa `grid`/`frames`
  trong manifest theo ảnh nhận được thay vì sinh lại.
- **Gemini bỏ qua "faces LEFT" và vẽ theo hướng của ảnh reference.** Kiểm tra hướng mặt
  ngay ở idle. Nếu quay phải: đặt `"drawFacing": "RIGHT"` (prompt đổi theo và build tự lật
  mọi sheet), portrait thì `portrait.flip`. Frame lẻ quay sai trong một sheet: `flipFrames`.
- **Pose khác biệt nhỏ ("thấp hơn 15%") thường bị vẽ giống hệt nhau**; mô tả tư thế khác hẳn
  ("quỳ một gối") và mở chat mới nếu chat cũ toàn sheet đứng.
- Gemini hay vẽ **đường lưới đen**, **bóng magenta sẫm dưới chân** và đôi khi **nền magenta
  lệch màu** — script tự xử lý (`remove_grid_lines`, `despill_magenta`, `"background": "auto"`).
- **Tỉ lệ tính theo từng sheet** (độ phân giải/lưới Gemini trả về thay đổi): mặc định theo
  chiều cao ô so với idle; `scaleFrom: <frame>` khi sheet có một frame đứng thủ thế.
- Vũ khí dài: `frameWidth` (Viking 352px, Kunoichi 320px — engine hỗ trợ qua
  `FighterCharacterConfig.frameWidth`). Hurtbox bám thân: `visualWidthCap`; tư thế
  ngồi/nằm: `visualFrom: -1`.
- **Hitbox tấn công được đo từ sprite** (phần chìa ra trước thân ở các frame ra đòn); khi
  hiệu ứng đè lên thân (chữ X nổ) thì đặt tay bằng `frameBounds`.
- `align`: `feet` cho đòn đứng tại chỗ, `fixed-y` cho nhảy/ngã (giữ độ cao, căn ngang),
  `fixed` chỉ khi Gemini giữ nhân vật đứng yên trong ô (thường không). `dropFrames` để bỏ
  frame hỏng thay vì sinh lại.
- Trong trận, `MatchScene` **tắt ngồi** (crouch/block-low chỉ thấy ở Playground) và đi lùi
  phát ngược `walk-forward` khi bật `fighterPlayground.reverseWalk`.

**1) Sinh ảnh thô cho từng action.** Truyền ảnh reference vào (`--ref`) và mô tả
pose *từng frame một* — đừng chỉ ghi "8 frame idle":

```
node --env-file=.env.local scripts/genart/generate-image.mjs \
  --ref concepts/characters/<timestamp>/<nhân-vật>-ref.png \
  --out concepts/characters/<timestamp>/idle-raw.png \
  --prompt "<PROMPT bên dưới>"
```

```
Using the attached character reference exactly (same design, colours,
proportions, pixel-art style), draw a sprite sheet of the <action> animation:
<N> frames in a <C>x<R> grid, left-to-right then top-to-bottom, every frame the
same size, the same scale and the same ground line, character facing LEFT.
Frame 1: <pose>. Frame 2: <pose>. ... Frame <N>: <pose>.
Each frame must sit fully inside its own cell with padding: no part of the
character or weapon may cross into a neighbouring cell. Flat solid magenta
(#ff00ff) background, no shadow, no text, no numbers, no grid lines, no logo.
```

Bài học từ lần thử Thor (`concepts/characters/2026-09-17-thor-brawler/`):

- Nếu chỉ ghi "8 frame idle", model trả về **8 frame gần như giống hệt nhau** →
  preview GIF đứng yên. Phải mô tả pose khác nhau cho từng frame.
- **Dùng nền magenta thay vì trắng** khi nhân vật có vũ khí kim loại/nhiều chi
  tiết sáng. Với nền trắng, lưỡi rìu sáng bị nuốt và lộ viền mờ.
- Vũ khí dài thường **tràn sang ô bên cạnh**. Script xử lý được (gán theo tâm
  từng mảnh), nhưng vẫn nên yêu cầu chừa lề trong prompt.
- Tên/khái niệm thương hiệu (ví dụ "Thor + búa + sét") có thể bị filter chặn.
  Diễn đạt thành archetype chung (Viking berserker + rìu).
- Ảnh tải từ web Gemini có watermark ✦ mờ ở góc phải dưới. Script chỉ bỏ được
  nó khi nó tách rời khỏi nhân vật; nếu nó đè lên nhân vật (như ở sheet Thor,
  nó nằm trên đầu gối) sẽ để lại vệt xám nhạt — sinh lại hoặc dọn tay.
- Sinh thử **một action, xem GIF, rồi mới sinh tiếp**. Đừng sinh 13 sheet trước
  khi chắc idle đã ổn.

**2) Xử lý: xóa nền → cắt frame → chuẩn hóa → ghép sheet** (một lệnh):

```
python scripts/sprites/sprites.py run concepts/characters/<timestamp>/idle-raw.png \
  --action idle --grid 4x2 --bg magenta --expect 8 \
  --out public/assets/<character-id>
```

Kết quả: `public/assets/<character-id>/idle.png`, `idle-preview.gif` (nền tối,
vạch hồng = mặt đất, chữ thập xanh = tâm chân) và `scale.json`. Ảnh trung gian
nằm ở `idle-raw-work/idle/` (`keyed.png`, `frame-NN.png`, `frames.json`) để
kiểm tra khi có lỗi. Script cũng in sẵn đoạn config cần dán ở bước 3.

Cờ hay dùng:

- `--grid CxR` — luôn nên khai báo lưới đã yêu cầu khi sinh ảnh. Không có nó
  script tự đoán hàng/cột và không dùng được `--align fixed`.
- `--bg white` / `#rrggbb`, `--tol N` — dung sai nền. Nền trắng + vũ khí sáng:
  thử `--tol 14 --holes 150` (`--holes` xóa cả các "túi" nền bị kẹt giữa cánh
  tay và vũ khí).
- `--expect N` — fail nếu số frame tìm được ≠ N (bắt sớm lỗi cắt sai).
- `--target-height`, `--scale`, `--reset-scale` — chỉnh tỉ lệ. Mỗi lần Gemini vẽ
  nhân vật hơi to/nhỏ khác nhau giữa các sheet, nên **xem lại GIF của từng
  action** và dùng `--scale` để ép về cùng cỡ nếu lệch.
- `--resample nearest` — giữ pixel cứng nếu art là pixel-art thật sự; mặc định
  `lanczos` cho ra kết quả mượt giống các fighter hiện có.

Đọc bảng in ra: cột `clipped-px` > 20 nghĩa là frame đó **bị cắt ở mép ô 256×256**
(thường là vũ khí dài). Giảm `--target-height`/`--scale`, hoặc `--reset-scale`
từ idle. Nhân vật cầm vũ khí rộng sẽ chiếm gần hết ô, đó là giới hạn của định
dạng 256×256.

**3) Đăng ký nhân vật vào game.** Cần đủ ba thứ:

- `public/assets/<character-id>/anchor-w.png` (ảnh reference đã xóa nền, resize
  về 1024×1024) và `portrait.png` (Bước 5, 1254×1254). Thiếu là lỗi load ảnh.
- Một file `src/game/<tênNhânVật>.ts` theo mẫu
  [jiujitsuFighter.ts](src/game/jiujitsuFighter.ts): danh sách `FighterActionSpec`
  (dán đoạn config script đã in, thêm `attack`/`attackSpans`/`guard` cho các
  action đánh/đỡ) rồi gọi `buildFighterCharacter({ id, label, assetRoot, anchorUsage, actions })`.
  Box đặt ở đây chỉ là placeholder, tinh chỉnh ở Bước 7.
- Ba chỗ nối dây:
  1. `src/game/hero.ts` — thêm vào mảng `CHARACTER_DEFINITIONS`.
  2. `src/scenes/CharacterSelectScene.ts` — thêm id vào `SELECTABLE_FIGHTER_IDS`
     nếu muốn chọn được trong màn chọn nhân vật (nhân vật không có ở đây chỉ
     xuất hiện trong Playground).
  3. `src/game/fighterConfig.ts` — *tuỳ chọn*: thêm entry trong
     `FIGHTER_STAT_OVERRIDES` / `FIGHTER_COMBAT_OVERRIDES` nếu muốn chỉ số riêng
     (không có entry thì dùng mặc định).

Rồi chạy `npm run typecheck`, `npm run dev`, và chơi thử nhân vật mới ở đúng
các action vừa thêm — xem có trượt chân, lệch tỉ lệ so với các fighter khác,
hoặc bị cắt mép không.

### Bước 5 — Portrait cho màn chọn nhân vật

```
Từ các ảnh reference, tạo portrait cách điệu cho từng nhân vật (khung từ
thân trên đến đầu, tư thế đặc trưng riêng) để dùng cho màn character-select
dạng big card. Giữ đúng phong cách art đã chốt, chỉ tăng độ chi tiết cho
portrait mà không phá vỡ vibe.
```

### Bước 6 — UI atlas + prop atlas

```
Tạo UI atlas: <liệt kê thành phần UI cần, ví dụ: health bar có vùng trong
suốt để fill động, khung portrait>. Dùng nền chroma magenta (#ff00ff) cho
vùng cần trong suốt để key out thủ công sau.

Song song, tạo atlas prop động cho stage <tên stage> — các chi tiết làm nền
có chiều sâu (ví dụ: đám đông, đèn hiệu, hơi nước, quạt thông gió...).
```

### Bước 7 — Đăng ký entity + author hitbox/hurtbox theo từng frame

```
Tích hợp asset các entity đã có vào dev-gym (sandbox riêng để test). Mỗi
entity là MỘT config entry (id, đường dẫn asset, animation keys, fps, kích
thước frame, anchor) để tự động wire vào preload, animation registry, và
dropdown chọn trong gym. KHÔNG auto-fit bounds từ alpha của sprite — để
placeholder box, tôi sẽ tự chỉnh tay và lưu vào public/configs/<ten>.json.

Thêm chế độ chỉnh bounds kiểu gizmo (như Unreal/Unity/Blender) — mũi tên
2 trục để di chuyển, phím tắt chuyển translate/scale. Khi kéo một box thì tự
pause ở frame hiện tại và ghi thẳng vào file config, đồng bộ 2 chiều với
sidebar và với gameplay thật.
```

### Bước 8 — Playground / sandbox để cảm nhận nhân vật

```
Thêm scene Playground: lấy entity + stage hiện có, cho phép di chuyển trên
trục cố định và thực hiện mọi hành động của entity đó.

Cho phép chọn entity trong cả Playground và Gym. Trong Playground, expose các
chỉ số riêng theo entity ở debug panel (tốc độ, nhảy, trọng lực, scale...) có
thể persist ra config để cân bằng và áp dụng luôn vào game chính.

Khi đang gõ trong debug panel, input không được vô tình tác động lên
entity/game. Sau khi chỉnh xong và click lại vào canvas, điều khiển bàn phím
phải hoạt động lại bình thường.

Thêm toggle để hiển thị mọi loại bounds (hit/attack/collision...), mỗi loại
một màu, có nút toggle-all. Với bounds chỉ active ở một số frame nhất định:
hiển thị mờ khi không active, hiển thị rõ/đậm khi active.
```

### Bước 9 — Nối flow chính (menu → chọn mode/stage/entity → trận đấu)

```
Lắp flow chính: Play -> <các mode, ví dụ: 1v1 / 1vCPU> -> chọn stage bằng
card đẹp có tên -> chọn entity. <Mô tả input scheme cho từng người chơi nếu
multiplayer local, ví dụ: WASD cho P1, phím mũi tên cho P2, không được chọn
trùng entity>. Thêm hiệu ứng chọn xong (chớp sáng để "lock in").

Bắt đầu trận với một đoạn intro text (ví dụ "Round 1... Fight!") trước khi
người chơi được di chuyển/hành động.

Đảm bảo Playground/Gym có thể lưu config ra file và load lại được, để áp dụng
thẳng vào game chính (kiểm tra kỹ trường hợp lưu bị lỗi "target not found"
hoặc tương tự).
```

### Bước 10 — Core gameplay loop (va chạm thật, "rounds", camera, z-order)

```
Xử lý z-ordering: entity di chuyển gần đây nhất/ở dưới nhất được vẽ đè lên
trên (tuỳ game). Khi 2 entity đổi vị trí tương đối, sprite + collider phải
lật hướng để quay mặt vào nhau.

Implement core: nhận damage, phát hiện va chạm theo box đã author ở Bước 7,
knockdown/knockback. Có thể cấu hình theo từng entity (ví dụ: đòn cao/thấp
khác nhau), ghi ra config và chỉnh được.

Nếu có nhiều "round"/"level" trong một trận: thêm số round cần thắng, rồi
rematch hoặc quay về main menu.

Nếu stage lớn hơn viewport: thêm camera khoá theo nhóm (group camera) —
camera đứng yên cho đến khi một bên "nhường" thì mới scroll theo. Thêm
timer nếu cần giới hạn thời gian mỗi round.
```

### Bước 11 — Cơ chế phòng thủ/geometry-based resolution (nếu áp dụng)

```
Model việc phòng thủ bằng hình học, không dùng nhãn cao/thấp cứng. Thêm một
loại "guard box" cho animation phòng thủ. Một đòn bị BLOCK khi hitbox của
bên tấn công overlap với guard box của bên phòng thủ; cao/thấp chỉ là vị trí
của box đó. Resolve một đòn đánh qua 2 check độc lập:
(1) hình học — hitbox có overlap hurtbox không, không thì whiff;
(2) guard — đúng tư thế phòng thủ đang bật không, không thì trúng đòn.
Đảm bảo box đã lưu trong Gym được pipe thẳng vào combat thật — chỉnh trong
Gym là thấy hiệu quả ngay trong trận đấu.
```

### Bước 12 — HUD

```
Lắp UI atlas vào game: health bar + portrait cho các entity, layout đẹp.
Health bar đổi màu theo % còn lại, nhấp nháy khi thấp. Thêm chuyển động vào
lúc bắt đầu trận (fill dần, UI trượt vào) — tốc độ vừa phải, không quá
nhanh/giật.
```

### Bước 13 — Hệ thống đặc biệt (meter/special/combo) — nếu áp dụng

```
Thêm hệ thống "special move" kích hoạt khi thanh meter đầy. Định nghĩa
special riêng cho từng entity, mỗi cái cần animation "charge" và animation
"execute". Vấn đề kỹ thuật cần giải quyết: cách đăng ký NHIỀU lần trúng đòn
trong một animation (thay vì 1 hit/1 animation như đòn thường), vì special
thường là combo nhiều hit. Cân nhắc hiệu ứng on-screen đi kèm.

Thêm một "dummy" trong Playground có health tự hồi sau khi bị đánh, và một
debug toggle để fill sẵn thanh meter — để test riêng hệ thống special mà
không cần chơi thật.
```

---

## 3b. Nếu dùng Gemini (gemini.google.com) thay vì `$imagegen`

Đã test và hoạt động tốt cho các bước 2–5 (mockup, reference, portrait). Cách làm:

1. Mở gemini.google.com (đăng nhập tài khoản Google có Gemini), tạo chat mới.
2. Dán nguyên prompt từ Bước 2–5 ở trên, gửi.
3. Bấm nút Download trên ảnh kết quả — file rơi vào thư mục Downloads mặc định của
   Windows (`C:\Users\<user>\Downloads\Gemini_Generated_Image_*.png`).
4. Copy/move file đó vào đúng thư mục convention (`concepts/characters/<timestamp>/`,
   `concepts/mockups/<timestamp>/`...) và lưu kèm 1 file `prompt.txt` ghi lại đúng
   prompt đã dùng.

**Lưu ý quan trọng**: ảnh Gemini trả về có **nền trắng phẳng, không phải alpha
trong suốt** — khác với ảnh `$imagegen` vốn xin được nền trong suốt trực tiếp.
Với ảnh cần trong suốt (spritesheet nhân vật, UI atlas), phải thêm bước hậu kỳ
key/remove nền trắng (rembg, remove.bg, hoặc Photoshop) trước khi đưa vào
`public/assets/`.

Nếu muốn tự động hoá qua API thay vì thao tác tay trên web: Gemini có model sinh
ảnh `gemini-2.5-flash-image` qua REST API (script mẫu ở
`scripts/genart/generate-image.mjs`), nhưng model này **không nằm trong free
tier** — Google Cloud project gắn với API key phải bật billing (limit mặc định
là 0 nếu chưa bật), khác với model text thông thường.

## 4. Nguyên tắc lặp lại xuyên suốt mọi bước

- **Audit trước khi build** ở mọi bước kiến trúc lớn.
- **Plan trước, code sau**, build incremental — không yêu cầu "làm hết một
  lần".
- **Mọi số liệu cân bằng/box va chạm là config**, chỉnh được qua dev tool, tự
  đồng bộ 2 chiều với gameplay thật (không có bản "giả" riêng cho debug).
- **Xây dev tooling (gym/playground) trước**, gắn vào flow chính sau.
- **Sinh asset luôn kèm lưu lại prompt gốc** trong thư mục có timestamp, để
  có thể tái sinh/chỉnh sau.
- Sau mỗi bước lớn: build thật, tự chơi/test bằng tay trước khi coi là xong —
  không chỉ dựa vào việc code chạy không lỗi.

---

*File này được đúc kết từ kiến trúc của Vibe Fighter (`src/game`,
`src/scenes`) và bản gốc `prompts.pdf` trong repo. Cập nhật file này nếu quy
ước dự án thay đổi.*
