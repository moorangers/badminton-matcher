# Badminton Matcher

แอปสำหรับช่วยจัดคู่แบดมินตันแบบรวดเร็วและยุติธรรม รองรับทั้ง 1v1 และ 2v2 พร้อมเลือกจำนวนคอร์ด สุ่มผู้เล่นลงสนาม และบันทึกข้อมูลอัตโนมัติ

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
- ปุ่มรีเซ็ตสถิติ และปุ่มล้างข้อมูลทั้งหมด
- **บันทึกอัตโนมัติ (localStorage)** — สถานะทั้งหมด (โหมด, คอร์ด, ผู้เล่น, แมตช์, คู่ถัดไป, แมตช์รวมที่เล่นไปแล้ว) จะถูกบันทึกไว้ใน browser อัตโนมัติ ปิด-เปิดหน้าใหม่ได้โดยไม่สูญข้อมูล
- **ย้อนกลับล่าสุด (Undo)** — ปุ่ม `ย้อนกลับล่าสุด` อยู่ข้างปุ่ม `จบแมตช์` แต่ละคอร์ด กดเพื่อยกเลิกการกด "จบแมตช์" ครั้งล่าสุดได้ทันที รองรับย้อนกลับต่อเนื่องได้สูงสุด 5 ครั้ง
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
    useLocalStorage.ts
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

### Backend (Phase 0 — เริ่ม implement แล้ว)

หน้าเว็บหลักยังใช้ localStorage เหมือนเดิม แต่เริ่มมี API routes ที่ต่อ MongoDB จริงแล้ว (`/api/sessions`, `/api/sessions/:id/verify-pin`, `/api/sessions/:id/players`) รายละเอียดดู [docs/roadmap.md](docs/roadmap.md) และ [docs/database-design.md](docs/database-design.md)

1. ต้องมี MongoDB รันอยู่แล้ว (local container หรือ Atlas ก็ได้ — โปรเจกต์นี้ไม่มี docker-compose ของตัวเอง เพราะ dev เครื่องนี้ใช้ container ที่มีอยู่แล้วร่วมกับโปรเจกต์อื่น ดู [docs/decision-log.md#adr-008](docs/decision-log.md#adr-008))
2. คัดลอก `.env.example` เป็น `.env` แล้วปรับ `MONGODB_URI` ให้ชี้ไปที่ MongoDB ของตัวเอง (ใช้ database name แยกจากโปรเจกต์อื่น)
3. `yarn dev` ตามปกติ แล้วลองยิง `GET /api/health` เพื่อเช็คว่าเชื่อม MongoDB สำเร็จ

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

- [ ] **Backend foundation** — MongoDB + API + auth ขั้นต่ำ (prerequisite ของรายการด้านล่างเกือบทั้งหมด)
- [ ] **Session / Room system** — สร้าง room แชร์ลิงก์ให้เพื่อนร่วม session เดียวกันได้ (แทน localStorage)
- [ ] **Persistent Player List** — บันทึกรายชื่อผู้เล่นประจำไว้ใน DB ไม่ต้องพิมพ์ใหม่ทุกครั้ง
- [ ] **Match History** — เก็บ log แมตช์ทั้งหมดต่อ session พร้อมดูย้อนหลังได้
- [ ] **Player Stats** — สถิติสะสมรายคน เช่น จำนวนแมตช์ทั้งหมด, win/loss (ถ้ามีระบบบันทึกผล)
- [ ] **Real-time Sync** — ให้ทุกคนในห้องเห็นสถานะแมตช์พร้อมกัน (เทคโนโลยียังไม่ confirm)
- [ ] **Auth (optional)** — login เพื่อผูก player list กับบัญชี ไม่ผูกกับ browser
