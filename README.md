# Badminton Matcher

แอปสำหรับช่วยจัดคู่แบดมินตันแบบรวดเร็วและยุติธรรม รองรับทั้ง 1v1 และ 2v2 พร้อมเลือกจำนวนคอร์ด และสุ่มผู้เล่นลงสนาม

พัฒนาด้วย Next.js (App Router) + TypeScript + Tailwind CSS + ชุดคอมโพเนนต์แนว shadcn/ui

## Features

- เพิ่ม/ลบรายชื่อผู้เล่นแบบทันที
- ตรวจจับชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
- เลือกโหมดการเล่น `Singles` หรือ `Doubles`
- เลือกจำนวนคอร์ดได้ `1-4` คอร์ด
- จับคู่โดยให้ความสำคัญกับผู้เล่นที่ลงน้อยก่อน (fair rotation)
- จัดการสถานะแมตช์ต่อคอร์ด (`พร้อมเริ่ม`, `กำลังเล่น`, `จบแล้ว`)
- มี quick actions ต่อคอร์ด (`เริ่ม`, `จบแมตช์`, `รีแมตช์`, `ยกเลิกคอร์ด`)
- มีตัวอย่าง `คู่ถัดไป` และรองรับเลื่อนรอบอัตโนมัติเมื่อจบครบทุกคอร์ด
- แสดงผู้เล่นที่กำลังพัก และจำนวนแมตช์สะสมของแต่ละคน
- ปุ่มรีเซ็ตสถิติ และปุ่มล้างข้อมูลทั้งหมด
- แจ้งเตือนรีเซ็ตแบบ snackbar (top-center) และหายอัตโนมัติใน 3000ms

## Tech Stack

- `next@14` (App Router)
- `react@18`
- `typescript@5`
- `tailwindcss@3`
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
  lib/
    utils.ts
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
3. สุ่มลำดับภายในกลุ่มที่มีจำนวนแมตช์เท่ากัน
4. จัดผู้เล่นลงแต่ละคอร์ดตามจำนวนที่ต้องใช้ต่อแมตช์
5. เพิ่มสถิติ `matches` ให้เฉพาะผู้เล่นที่ถูกเลือกลงสนาม

## Notes

- UI หลักเป็นภาษาไทย
- ฟอนต์หลักของทั้งโปรเจกต์ใช้ `Noto Sans Thai` ผ่าน `next/font`