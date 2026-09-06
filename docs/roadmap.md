# Roadmap

แผนฟีเจอร์แบ่งเฟส มาจากการวิเคราะห์ codebase ปัจจุบันเทียบกับ feature request วันที่ 2026-09-06 — แต่ละเฟสมี dependency ต่อกัน อ่านคู่กับ [decision-log.md](./decision-log.md) สำหรับเหตุผลของลำดับ

สถานะที่ใช้: `not-started`, `in-progress`, `done`

## Phase 0 — Backend Foundation

**สถานะ:** done (2026-09-06) — เหลือแค่ deploy MongoDB จริงสำหรับ production เป็น follow-up นอก scope เดิม
**ทำไมต้องทำ:** ทุกฟีเจอร์ multi-device (เช็คอินคนละเครื่อง, webboard, live score, QR check-in) เป็นไปไม่ได้บนสถาปัตยกรรม client-only + localStorage ปัจจุบัน — ดู [decision-log.md#adr-001](./decision-log.md)

- [x] ตัดสินใจเรื่อง multi-tenant: 1 deployment ต่อ 1 ชมรม ([decision-log.md#adr-006](./decision-log.md))
- [x] ตัดสินใจเรื่อง auth: PIN ต่อ session ([decision-log.md#adr-007](./decision-log.md))
- [x] ตั้ง MongoDB connection layer — ใช้ container ที่มีอยู่แล้วในเครื่อง dev แทนสร้าง docker-compose ใหม่ ([decision-log.md#adr-008](./decision-log.md)) — `src/lib/db/mongodb.ts`
- [x] Schema เริ่มต้น: `sessions`, `players`, `sessionPlayers`, `matches`, `partnerHistory` (mongoose models ใน `src/lib/db/models/`)
- [x] PIN auth ขั้นต่ำ: ตั้ง PIN ตอนสร้าง session (`POST /api/sessions`), ตรวจสอบผ่าน `POST /api/sessions/:id/verify-pin` (`src/lib/auth/pin.ts`, bcrypt hash)
- [x] API Routes พื้นฐาน: `GET/POST /api/sessions`, `POST /api/sessions/:id/verify-pin`, `GET/POST /api/sessions/:id/players` — ทดสอบ end-to-end กับ MongoDB จริงแล้ว (สร้าง session, verify pin ถูก/ผิด, เพิ่มผู้เล่น, กันชื่อซ้ำ case-insensitive)
- [x] API สำหรับ `matches`: `GET/POST /api/sessions/:id/matches`, `PATCH /api/sessions/:id/matches/:matchId` — บังคับกฎ 1 คนไม่อยู่ 2 แมตช์พร้อมกัน, 1 คอร์ดมีได้แค่ 1 แมตช์ที่ยังไม่จบ, `done` จะ bump `matchesPlayedInSession` + partner history ให้อัตโนมัติ (ทดสอบ end-to-end กับ MongoDB จริงแล้ว)
- [x] API สำหรับ `partnerHistory`: `GET /api/sessions/:id/partner-history` (resolve ชื่อผู้เล่นคืนมาด้วย, เขียนได้ทางเดียวผ่าน side-effect ตอนจบแมตช์เท่านั้น ไม่มี endpoint เขียนตรง)
- [x] ย้าย UI เดิม (`home-page.tsx`) จาก localStorage มาเรียก API จริง — เสร็จแล้ว (2026-09-06) รวม session bootstrap (สร้าง/PIN gate), algorithm การจับคู่ยังอยู่ฝั่ง client เหมือนเดิม (อ่าน/เขียนผ่าน API แทน localStorage), ลบ `useLocalStorage.ts` ที่ไม่ใช้แล้วออก, ทดสอบ end-to-end ผ่าน Playwright จริง (สร้าง session → เพิ่มผู้เล่น → จับคู่ → เริ่ม/จบแมตช์ → auto-fill → substitute → ปิดคอร์ด → reload+PIN แล้วข้อมูลยังอยู่ครบ) ไม่มี console error
- [ ] Deploy MongoDB จริงสำหรับ production (ตอนนี้ dev ใช้ container ในเครื่องเท่านั้น ยังไม่มีแผน production DB)

## Phase 1 — แก้ Matching Fairness + Court Merge

**สถานะ:** in-progress (manual ส่วน client-side เสร็จแล้ว 2026-09-06, ตอนนี้ผูกกับ MongoDB ผ่าน Phase 0 แล้ว เหลือแค่ auto-trigger)
**Dependency:** ไม่ต้องรอ Phase 0 เสร็จ (เป็น pure logic) — bundle 2 ฟีเจอร์นี้เพราะอยู่ใน matching engine เดียวกัน (ดู [decision-log.md#adr-005](./decision-log.md))

- [x] เพิ่ม `queuedAt` เป็น tie-breaker รองจากจำนวนแมตช์ (คนรอนานกว่าได้คิวก่อน) — แก้ปัญหา "มาคอร์สไม่พร้อมกัน อยากแฟร์กับคนมาก่อน"
- [x] เพิ่ม partner-history penalty ตอนสุ่มจับคู่ — แก้ปัญหา "คู่แทบไม่เปลี่ยนเลย"
- [x] ปุ่ม "ปิดคอร์ด/รวมคอร์ด" แบบ manual — คอร์ดที่ถูกปิด: match ที่กำลังเล่นจบทันที คนไปรวมคิวคอร์ดที่เหลือ (แก้ปัญหา "จองคอร์ด 1hr/2hr")
- [ ] auto-trigger รวมคอร์ดตามเวลาจองจริง แทน manual (ต้องเพิ่ม `courtBookings.endTime` ตาม [database-design.md](./database-design.md) ที่ยังไม่ implement)
- รายละเอียด logic เดิม vs ที่เสนอใหม่ ดู [matching-algorithm.md](./matching-algorithm.md)
- ยังไม่ได้ bump version/CHANGELOG สำหรับงานนี้ — รอ confirm จากผู้ใช้ก่อน

## Phase 2 — เช็คอิน 2 ขั้น + QR Self Check-in

**สถานะ:** not-started (unblocked — Phase 0 เสร็จแล้ว)
**Dependency:** Phase 0 (ต้อง multi-device เห็น session เดียวกัน) ✅

- [ ] แยกสถานะผู้เล่น: `registered` → `checked_in` → เข้า pool สุ่มได้
- [ ] หน้าเช็คอินสำหรับผู้เล่น (มือถือตัวเอง)
- [ ] QR code ต่อ session ชี้ไปหน้า public form (กรอกชื่อ ไม่ต้องลงทะเบียนล่วงหน้า)
- [ ] กัน spam/ชื่อมั่ว (rate limit หรือ validation เพิ่มเติม)

## Phase 3 — Webboard / Post Report

**สถานะ:** not-started
**Dependency:** Phase 0 ✅ + เลือก file storage (Vercel Blob/Cloudinary/S3 — ยังไม่ confirm)

- [ ] โพสต์ข้อความ + รูปภาพต่อ session/club
- [ ] หน้า feed แสดงโพสต์ย้อนหลัง
- [ ] Auth สำหรับคนโพสต์ (admin หรือสมาชิกทุกคนโพสต์ได้ — ยังไม่ confirm)

## Phase 4 — ระบบนับคะแนน + Live Scoreboard

**สถานะ:** not-started
**Dependency:** Phase 0 ✅ + เลือก realtime layer (ยังไม่ confirm — ดู open question ใน [architecture-design.md](./architecture-design.md))

- [ ] UI นับคะแนนต่อแมตช์ (ใช้ได้ทั้ง casual play และ tournament mode)
- [ ] หน้า display แยกสำหรับขึ้นจอ/โปรเจกเตอร์ อัปเดตสดไม่ต้อง refresh

## Phase 5 — Tournament Mode

**สถานะ:** not-started
**Dependency:** อิสระจากเฟสอื่น (ใช้ engine คนละส่วนกับ casual matching) แต่ได้ประโยชน์ถ้า Phase 4 (scoring) เสร็จก่อน

- [ ] สร้างทัวร์นาเมนต์ ประเภทเดี่ยว/คู่
- [ ] เลือกรูปแบบสาย: single elimination / double elimination / round robin
- [ ] Bracket generation + จัดคอร์ดต่อแมตช์
- [ ] เชื่อมกับ scoring (Phase 4) ถ้าเสร็จแล้ว

## ฟีเจอร์ที่เสนอเพิ่ม (ยังไม่จัดลำดับ — รอผู้ใช้ prioritize)

- LINE OA / LINE LIFF สำหรับเช็คอินและดู live score (เข้ากับ target user คนไทยมากกว่าทำ auth เอง)
- Player profile ข้ามหลาย session (สถิติมาบ่อยแค่ไหน, MVP) — เก็บได้แทบฟรีถ้า Phase 0 มี persistent roster แล้ว
