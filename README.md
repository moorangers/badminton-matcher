# Badminton Matcher

แอปสำหรับช่วยจัดคู่แบดมินตันแบบรวดเร็วและยุติธรรม รองรับทั้ง 1v1 และ 2v2 พร้อมเลือกจำนวนคอร์ด สุ่มผู้เล่นลงสนาม และบันทึกข้อมูลอัตโนมัติ

พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS + ชุดคอมโพเนนต์แนว shadcn/ui

## Features

- เพิ่ม/ลบรายชื่อผู้เล่นแบบทันที
- ตรวจจับชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
- เลือกโหมดการเล่น `Singles` หรือ `Doubles`
- เลือกจำนวนคอร์ดได้ `1-4` คอร์ด
- จับคู่โดยให้ความสำคัญกับผู้เล่นที่ลงน้อยก่อน (fair rotation)
- **Deprioritize คนที่เพิ่งเล่น** — ภายในกลุ่มที่มี match count เท่ากัน ระบบจะจัดคนที่ยังไม่ได้เล่นรอบล่าสุดขึ้นก่อนเสมอ
- จัดการสถานะแมตช์ต่อคอร์ด (`พร้อมเริ่ม`, `กำลังเล่น`, `จบแล้ว`)
- มี quick actions ต่อคอร์ด (`เริ่ม`, `จบแมตช์`)
- มีตัวอย่าง `คู่ถัดไป` และรองรับเลื่อนรอบอัตโนมัติเมื่อจบครบทุกคอร์ด
- แสดงผู้เล่นที่กำลังพัก และจำนวนแมตช์สะสมของแต่ละคน
- **เพิ่มผู้เล่นระหว่างเกม** — คู่ถัดไปจะถูก regenerate ทันทีโดยผู้เล่นใหม่จะถูก prioritize เข้าสนามก่อน
- **ลบผู้เล่นระหว่างเกม** — ถ้าผู้เล่นไม่ได้อยู่ใน active match จะลบได้ทันที และ regenerate คู่ถัดไป / ถ้าอยู่ใน active match จะเปิด flow เปลี่ยนตัวก่อน
- **Substitute Player** — กดไอคอน `⇄` ที่ชื่อผู้เล่นใน court card ได้โดยตรง ระบบจะ confirm แล้วสุ่มคนพักมาแทนอัตโนมัติ คนที่ถูกแทนจะถูกลบออกจากรายชื่อ และ match count ของรอบนั้นยังคงนับ
- ปุ่มรีเซ็ตสถิติ และปุ่มล้างข้อมูลทั้งหมด
- **บันทึกอัตโนมัติ (localStorage)** — สถานะทั้งหมด (โหมด, คอร์ด, ผู้เล่น, แมตช์) จะถูกบันทึกไว้ใน browser อัตโนมัติ ปิด-เปิดหน้าใหม่ได้โดยไม่สูญข้อมูล
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

## Available Scripts

- `yarn dev` รันโหมดพัฒนา
- `yarn build` สร้าง production build
- `yarn compile` alias ของ `yarn build`
- `yarn start` รัน production server
- `yarn lint` ตรวจ lint

## How Match Generation Works

เมื่อกดปุ่มจับคู่ ระบบจะ:

1. ตรวจว่ามีผู้เล่นขั้นต่ำตามโหมดที่เลือก
2. เรียงผู้เล่นตามจำนวนแมตช์จากน้อยไปมาก
3. ภายในกลุ่มที่มีจำนวนแมตช์เท่ากัน แบ่งเป็น "คนที่ไม่ได้เพิ่งเล่น" (ขึ้นก่อน) และ "คนที่เพิ่งเล่นรอบล่าสุด" (ขึ้นหลัง) แล้วสุ่มแต่ละกลุ่มแยกกัน
4. จัดผู้เล่นลงแต่ละคอร์ดตามจำนวนที่ต้องใช้ต่อแมตช์
5. เพิ่มสถิติ `matches` ให้เฉพาะผู้เล่นที่ถูกเลือกลงสนาม

## Notes

- UI หลักเป็นภาษาไทย
- ฟอนต์หลักของทั้งโปรเจกต์ใช้ `Noto Sans Thai` ผ่าน `next/font`

## Roadmap v2 (Supabase Integration)

> feature ชุดนี้รอ implement เชื่อม Supabase backend

- [ ] **Session / Room system** — สร้าง room แชร์ลิงก์ให้เพื่อนร่วม session เดียวกันได้ (แทน localStorage)
- [ ] **Persistent Player List** — บันทึกรายชื่อผู้เล่นประจำไว้ใน DB ไม่ต้องพิมพ์ใหม่ทุกครั้ง
- [ ] **Match History** — เก็บ log แมตช์ทั้งหมดต่อ session พร้อมดูย้อนหลังได้
- [ ] **Player Stats** — สถิติสะสมรายคน เช่น จำนวนแมตช์ทั้งหมด, win/loss (ถ้ามีระบบบันทึกผล)
- [ ] **Real-time Sync** — ใช้ Supabase Realtime ให้ทุกคนในห้องเห็นสถานะแมตช์พร้อมกัน
- [ ] **Auth (optional)** — login เพื่อผูก player list กับบัญชี ไม่ผูกกับ browser
