# Badminton Matcher

แอปสำหรับช่วยจัดคู่แบดมินตันแบบรวดเร็วและยุติธรรม รองรับทั้ง 1v1 และ 2v2 พร้อมเลือกจำนวนคอร์ด สุ่มผู้เล่นลงสนาม และบันทึกข้อมูลลง MongoDB จริง (แชร์ session เดียวกันได้)

พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS + ชุดคอมโพเนนต์แนว shadcn/ui

> Current Version: v0.5.0

## การอัปเดตเวอร์ชัน (Versioning Workflow)

1. **เมื่อไหร่ควรอัปเวอร์ชัน?**

- ทุกครั้งที่มีการเพิ่มฟีเจอร์ใหม่, ปรับ UI/UX สำคัญ, หรือแก้ไขบั๊กที่กระทบผู้ใช้
- ก่อนจะ merge หรือปล่อย production ทุกครั้ง

2. **ขั้นตอนการอัปเดตเวอร์ชัน**

- ใช้ `yarn version --patch` หรือ `yarn version --minor` เพื่อแก้ไขเลขเวอร์ชันใน `package.json`
- เพิ่ม/แก้ไขรายละเอียดใน `CHANGELOG.md` (เพิ่มหัวข้อเวอร์ชันใหม่และสรุปสิ่งที่เปลี่ยนแปลง)
- รันคำสั่ง `yarn version:sync` เพื่อ sync เวอร์ชันไปที่ README.md และหัวข้อ changelog อัตโนมัติ
- Commit และ push code ตามปกติ

ดูรายละเอียดการเปลี่ยนแปลงทั้งหมดที่ CHANGELOG.md

## Features

- **สร้าง/เข้า session ด้วย PIN** — สร้าง session ใหม่ (เลือกโหมด+จำนวนคอร์ด+ตั้ง PIN 4-6 หลัก) หรือกลับเข้า session เดิมบนเครื่องเดิมโดยใส่ PIN ยืนยันอีกครั้งหลัง refresh หน้า
- เพิ่มผู้เล่นแบบทันที
- จัดการผู้เล่นผ่าน Modal (`แก้ชื่อ` / `ลบผู้เล่น`)
- ตรวจจับชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
- ตรวจสอบชื่อก่อนบันทึก (ห้ามว่าง, ห้ามชื่อซ้ำ, กด Enter เพื่อบันทึก / Esc เพื่อปิด)
- เลือกโหมดการเล่น `Singles` หรือ `Doubles`
- เลือกจำนวนคอร์ดได้ `1-4` คอร์ด
- จับคู่โดยให้ความสำคัญกับผู้เล่นที่ลงน้อยก่อน (fair rotation)
- **Wait-time fairness** — ภายในกลุ่มที่มี match count เท่ากัน ระบบจะจัดคนที่เข้าคิว/พักมานานกว่าขึ้นก่อนเสมอ (ไม่ใช่แค่สุ่มล้วน)
- **Partner-history balancing** — ตอนจับทีมในกลุ่มที่ลงคอร์ด ระบบจะเลือกจับคู่ที่เคยเป็นทีมเดียวกันน้อยที่สุดก่อน ลดโอกาสได้จับคู่เดิมซ้ำ ๆ
- จัดการสถานะแมตช์ต่อคอร์ด (`พร้อมเริ่ม`, `กำลังเล่น`, `จบแล้ว`)
- มี quick actions ต่อคอร์ด (`เริ่ม`, `จบแมตช์`)
- **ปิดคอร์ด** — บังคับจบแมตช์ที่กำลังเล่นในคอร์ดนั้นทันที ปิดคอร์ดถาวรสำหรับรอบนั้น แล้วย้ายผู้เล่นไปรวมคิวกับคอร์ดที่เหลือ (เช่น คอร์ดที่จองเวลาสั้นกว่าหมดเวลาก่อน) มี modal ยืนยันก่อนทุกครั้ง
- มีตัวอย่าง `คู่ถัดไป` และรองรับเลื่อนรอบอัตโนมัติเมื่อจบครบทุกคอร์ด
- แสดงผู้เล่นที่กำลังพัก และจำนวนแมตช์สะสมของแต่ละคน
- แสดงจำนวน `แมตช์รวมที่เล่นไปแล้ว` แบบสะสม
- **เพิ่มผู้เล่นระหว่างเกม** — คู่ถัดไปจะถูก regenerate ทันทีโดยผู้เล่นใหม่จะถูก prioritize เข้าสนามก่อน
- **ลบผู้เล่นระหว่างเกม** — ถ้าผู้เล่นไม่ได้อยู่ใน active match จะลบได้ทันที และ regenerate คู่ถัดไป / ถ้าอยู่ใน active match จะเปิด flow เปลี่ยนตัวก่อน
- **Substitute Player** — กดไอคอน `⇄` ที่ชื่อผู้เล่นใน court card ได้โดยตรง ระบบจะ confirm แล้วสุ่มคนพักมาแทนอัตโนมัติ ผู้เล่นเดิมจะ `ไปพัก` (ไม่ถูกลบจากรายชื่อ)
- ปุ่มรีเซ็ตสถิติ (ล้างแมตช์/สถิติ แต่คง session ไว้) และปุ่มออกจาก session (ลืม session บนเครื่องนี้ ไม่ลบข้อมูลบนเซิร์ฟเวอร์)
- **บันทึกลง MongoDB จริง** — ผู้เล่น/แมตช์/สถิติ/partner history ทั้งหมดอยู่บนเซิร์ฟเวอร์ผูกกับ session id ไม่ใช่ browser เดียวอีกต่อไป ปิด-เปิดหน้าใหม่ (ใส่ PIN ยืนยันอีกครั้ง) ข้อมูลยังอยู่ครบ
- **ย้อนกลับล่าสุด (Undo)** — ปุ่ม `ย้อนกลับคอร์ดนี้` โผล่เฉพาะคอร์ดที่กด `จบแมตช์` ล่าสุดจริง ๆ เท่านั้น (ครั้งเดียว ไม่ใช่ stack หลายขั้น) ยกเลิกไม่ได้ถ้ามีคนถูกจัดลงแมตช์อื่นไปแล้วหลังจากนั้น
- แจ้งเตือนแบบ toast (top-right) ด้วย Sonner และหายอัตโนมัติใน 3000ms

## Tech Stack

- `next@14` (App Router)
- `react@18`
- `typescript@5`
- `tailwindcss@3`
- `sonner` (toast notifications)
- `lucide-react` + `@iconify/react` (icons)

## Project Structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
    not-found.tsx
    api/
      health/route.ts
      players/[playerId]/route.ts
      sessions/route.ts
      sessions/[id]/route.ts
      sessions/[id]/close-court/route.ts
      sessions/[id]/reset-stats/route.ts
      sessions/[id]/players/route.ts
      sessions/[id]/players/[sessionPlayerId]/route.ts
      sessions/[id]/matches/route.ts
      sessions/[id]/matches/[matchId]/route.ts
      sessions/[id]/matches/[matchId]/substitute/route.ts
      sessions/[id]/matches/[matchId]/undo-finish/route.ts
      sessions/[id]/partner-history/route.ts
  features/
    home/home-page.tsx
  components/
    CourtSelector.tsx
    MatchBoard.tsx
    ModeSelector.tsx
    PlayerList.tsx
    ui/
      button.tsx
      card.tsx
      input.tsx
      sonner.tsx
  lib/
    utils.ts
    appVersion.ts
    api/sessionApi.ts       # typed fetch client the UI uses to call the API above
    auth/pin.ts             # PIN hash/verify (bcrypt)
    db/
      mongodb.ts            # connection singleton
      models/               # mongoose schemas (session, player, sessionPlayer, match, partnerHistory)
      services/matchLifecycle.ts  # shared stat/partner-history bump+revert logic
  types/
    styles.d.ts
public/
  favicon.ico
  robots.txt
```

## Getting Started

### Requirements

- Node.js 18+ (แนะนำ LTS)
- Yarn 1.x

### Install & Run (Development)

```bash
yarn install
yarn dev
```

เปิดเบราว์เซอร์ที่ `http://localhost:3000`

### Backend (MongoDB — ต้อง setup ก่อนรัน)

หน้าเว็บหลักเรียก API จริงแล้ว (ไม่ใช่ localStorage) — ทุก action (เพิ่มผู้เล่น, จับคู่, จบแมตช์, ปิดคอร์ด ฯลฯ) ต้องมี MongoDB ต่ออยู่ถึงจะใช้งานได้ รายละเอียด endpoint ทั้งหมดดู [docs/roadmap.md](docs/roadmap.md) และ [docs/database-design.md](docs/database-design.md)

1. ต้องมี MongoDB รันอยู่แล้ว (local container หรือ Atlas ก็ได้ — โปรเจกต์นี้ไม่มี docker-compose ของตัวเอง เพราะ dev เครื่องนี้ใช้ container ที่มีอยู่แล้วร่วมกับโปรเจกต์อื่น ดู [docs/decision-log.md#adr-008](docs/decision-log.md#adr-008))
2. คัดลอก `.env.example` เป็น `.env` แล้วปรับ `MONGODB_URI` ให้ชี้ไปที่ MongoDB ของตัวเอง (ใช้ database name แยกจากโปรเจกต์อื่น)
3. `yarn dev` แล้วลองยิง `GET /api/health` เพื่อเช็คว่าเชื่อม MongoDB สำเร็จ ก่อนเปิดหน้าเว็บหลัก

## Available Scripts

- `yarn dev` รันโหมดพัฒนา
- `yarn build` สร้าง production build
- `yarn compile` alias ของ `yarn build`
- `yarn start` รัน production server
- `yarn lint` ตรวจ lint

## How Match Generation Works

เมื่อกดปุ่มจับคู่ ระบบจะ:

1. ตรวจว่ามีผู้เล่นขั้นต่ำตามโหมดที่เลือก
2. เรียงผู้เล่นตามจำนวนแมตช์จากน้อยไปมาก แล้วภายในกลุ่มที่จำนวนแมตช์เท่ากัน เรียงตามเวลาที่เข้าคิว/พักล่าสุดจากเก่าไปใหม่ (`queuedAt`) — เท่ากันเป๊ะจริง ๆ ค่อยสุ่ม
3. จัดผู้เล่นลงแต่ละคอร์ดตามจำนวนที่ต้องใช้ต่อแมตช์ (Doubles: จัดทีมโดยเลือก combination ที่ผู้เล่นเคยจับคู่กันมาก่อนน้อยที่สุด)
4. เมื่อกด `จบแมตช์` (หรือ `ปิดคอร์ด` ระหว่างกำลังเล่น) เพิ่มสถิติ `matches`, บันทึกประวัติการจับคู่ (partner history), และรีเซ็ต `queuedAt` ให้ผู้เล่นที่อยู่ในคอร์ดนั้น ณ เวลานั้น

## Notes

- UI หลักเป็นภาษาไทย
- ฟอนต์หลักของทั้งโปรเจกต์ใช้ `Noto Sans Thai` ผ่าน `next/font`

## Roadmap v2 (MongoDB Backend)

> แผนเดิมเคยระบุ Supabase ไว้ตรงนี้ แต่เปลี่ยนมาใช้ **MongoDB** แทนแล้ว (เหตุผล/รายละเอียดดู [docs/decision-log.md](docs/decision-log.md#adr-003)) แผนฉบับเต็มพร้อมลำดับเฟสอยู่ที่ [docs/roadmap.md](docs/roadmap.md) — สรุปสั้น ๆ ด้านล่าง

- [x] **Backend foundation** — MongoDB + API + PIN auth + หน้าเว็บหลักย้ายมาเรียก API จริงหมดแล้ว
- [ ] **Session / Room system** — ตอนนี้แชร์ session ได้ผ่าน session id + PIN เดียวกัน แต่ยังไม่มีลิงก์เชิญ/QR หรือ real-time sync ข้ามอุปกรณ์ (ดู Real-time Sync ด้านล่าง)
- [ ] **Persistent Player List** — บันทึกรายชื่อผู้เล่นประจำไว้ใน DB ไม่ต้องพิมพ์ใหม่ทุกครั้ง
- [ ] **Match History** — เก็บ log แมตช์ทั้งหมดต่อ session พร้อมดูย้อนหลังได้
- [ ] **Player Stats** — สถิติสะสมรายคน เช่น จำนวนแมตช์ทั้งหมด, win/loss (ถ้ามีระบบบันทึกผล)
- [ ] **Real-time Sync** — ให้ทุกคนในห้องเห็นสถานะแมตช์พร้อมกัน (เทคโนโลยียังไม่ confirm)
- [ ] **Auth (optional)** — login เพื่อผูก player list กับบัญชี ไม่ผูกกับ browser
