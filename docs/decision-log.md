# Decision Log

บันทึกการตัดสินใจสำคัญแบบ ADR (Architecture Decision Record) แบบย่อ เรียงตามเวลา ใหม่สุดอยู่บนสุด แต่ละอันมี Context / Decision / Status / Consequences

สถานะที่ใช้: `decided` (ตัดสินใจแล้ว ยึดตามนี้), `proposed` (ข้อเสนอจากการวิเคราะห์ ยังไม่ยืนยัน), `superseded` (เคยตัดสินใจแล้วแต่ถูกแทนที่)

---

## ADR-008 — Dev เชื่อม MongoDB ผ่าน container ที่มีอยู่แล้วในเครื่อง ไม่สร้าง docker-compose ใหม่

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** ตอนแรกวางแผนสร้าง `docker-compose.yml` แยกสำหรับโปรเจกต์นี้ แต่พบว่าเครื่อง dev มี container ชื่อ `mongodb` (image `mongo:latest`) รันอยู่แล้วที่ port 27017 ใช้ร่วมกันหลายโปรเจกต์ ถ้าสร้าง compose ใหม่จะชน port กัน (credential ของ container นี้ไม่เขียนไว้ในเอกสารนี้โดยตั้งใจ — เก็บไว้แค่ใน `.env` ของเครื่อง dev เท่านั้น)
- **Decision:** ใช้ container ที่มีอยู่แล้ว เชื่อมด้วย database แยกชื่อ `badminton-matcher` (คนละ database จากโปรเจกต์อื่นบน container เดียวกัน เช่น `obstack`) ผ่าน `.env` (ไม่ใช่ `.env.local`) ที่มี `MONGODB_USERNAME`, `MONGODB_PASSWORD`, `MONGODB_URI`
- **Consequences:** ไม่มี `docker-compose.yml`/`db:up`/`db:down` script ในโปรเจกต์นี้ — เอกสาร setup ต้องบอกให้ผู้เล่นคนอื่นที่ clone repo นี้รู้ว่าต้องมี MongoDB รันเองอยู่แล้ว (local container หรือ Atlas) ก่อน ไม่ได้ auto-provision ให้ — ถ้าย้ายไป production จริงจะใช้ MongoDB Atlas แยกต่างหาก ไม่เกี่ยวกับ container นี้

## ADR-007 — Auth ขั้นต่ำสำหรับ Phase 0 คือ PIN ต่อ session

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** ต้องแยกสิทธิ์แอดมิน (กดจับคู่/จบแมตช์/ปิดคอร์ด) ออกจากผู้เล่นทั่วไป โดยไม่ทำให้ setup ยุ่งยากเกินความจำเป็นสำหรับ use case จริง (คนเดียว/ไม่กี่คนคุมหน้าคอร์ด)
- **Decision:** ใช้ PIN ต่อ session แทน email/password หรือ LINE Login — ตั้ง PIN ตอนเปิด session ใหม่ ใครมี PIN กดจัดการได้
- **Consequences:** ไม่ต้องมี user account/database ของผู้ใช้แยกต่างหากใน Phase 0 ลด scope ลงมาก แต่ต้องคิดเรื่อง PIN เก็บที่ไหน (hash ใน `sessions` collection), ส่งให้แอดมินยังไง (แสดงบนจอตอนสร้าง session), และ rate-limit การเดา PIN

## ADR-006 — ไม่ทำ multi-tenant (`Club`) ใน Phase 0

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** [database-design.md](./database-design.md) เดิมเสนอให้มี `clubId` ในแทบทุก collection เผื่อรองรับหลายชมรมในระบบเดียว แต่ยังไม่มี use case จริงที่ต้องการแบบนั้นตอนนี้
- **Decision:** ทำแบบ 1 deployment ต่อ 1 ชมรมไปก่อน ไม่ใส่ `clubId`/`clubs` collection ใน Phase 0
- **Consequences:** Schema เรียบง่ายขึ้นมาก (ดูฉบับปรับใน [database-design.md](./database-design.md)) — ถ้าอนาคตต้องรองรับหลายชมรมจริง จะต้อง migrate เพิ่ม `clubId` ทีหลัง ซึ่งทำได้แต่ต้องแก้ query/index ที่มีอยู่แล้วทั้งหมด

## ADR-005 — ลำดับความสำคัญ Phase 1 คือแก้ logic จับคู่ก่อน

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** หลัง Phase 0 (backend) ยังมีฟีเจอร์รออีกหลายอันที่ไม่ dependent กับ backend (fairness fix, court merge, webboard, tournament, scoreboard)
- **Decision:** เริ่มทำ "แก้ logic จับคู่ให้แฟร์" ก่อนเป็นอันดับแรกหลัง Phase 0 เพราะเป็น pure logic ไม่ต้องรอ backend เสร็จก็เริ่มได้ และแก้ pain point ที่ผู้ใช้บ่นมากที่สุด (คู่ไม่เปลี่ยน, คนมาก่อนไม่ได้เปรียบ)
- **Consequences:** ฟีเจอร์ "รวมคอร์ด" (ADR-004) ถูก bundle เข้ามาทำพร้อมกันใน Phase 1 เพราะอยู่ใน matching engine เดียวกัน (`buildMatchesFromPlayers` และการจัดการ court ids) — ดูรายละเอียด logic ที่ [matching-algorithm.md](./matching-algorithm.md)

## ADR-004 — "ปัญหาจองคอร์ด 1hr/2hr" คือฟีเจอร์ Court Merge ไม่ใช่ปฏิทินจองคอร์ด

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** โจทย์เดิมกำกวมว่า "ชมรมจองได้ 2 คอร์ด แต่ได้คอร์สนึง 1 ชม. อีกคอร์ส 2 ชม." อาจตีความได้ทั้งเป็นปัญหา conflict การจองคอร์ดข้ามชมรม หรือปัญหาเรื่องเวลาไม่เท่ากันระหว่างคอร์ด
- **Decision:** ยืนยันจากผู้ใช้แล้วว่าหมายถึง: คอร์ดที่จองไว้ 1 ชม. จะหมดเวลาก่อนคอร์ดที่จองไว้ 2 ชม. เมื่อถึงเวลานั้นต้องรวมผู้เล่นจากคอร์ดที่หมดเวลาเข้าไปเล่นในคอร์ดที่ยังเหลือเวลาแทนที่จะปล่อยให้กลุ่มนั้นไม่มีที่เล่นต่อ
- **Consequences:** ไม่ต้องทำ court-booking calendar/conflict system เต็มรูปแบบ — ต้องการแค่ (1) เก็บเวลาสิ้นสุดต่อคอร์ด (2) ปุ่ม/trigger "ปิดคอร์ดนี้ → รวมคนเข้าคอร์ดอื่น" งานส่วน manual-trigger ทำได้ใน Phase 1 เลย ส่วน auto-timer ตามเวลาจองจริงต้องรอ Phase 0 มี DB เก็บเวลาก่อน

## ADR-003 — เลือกใช้ MongoDB เป็น database (แทนที่ Supabase ที่เคยระบุใน README เดิม)

- **วันที่:** 2026-09-06
- **สถานะ:** decided (superseded ADR-เดิมที่ไม่เคยบันทึกอย่างเป็นทางการ)
- **Context:** README.md เดิมมี section "Roadmap v2 (Supabase Integration)" ที่ระบุแผนจะใช้ Supabase (Postgres + Auth + Realtime สำเร็จรูป) แต่ผู้ใช้ระบุในการคุยรอบนี้ชัดเจนว่าต้องการย้ายไป MongoDB
- **Decision:** ใช้ MongoDB ตามที่ผู้ใช้ระบุ
- **Consequences:**
  - เสีย Auth/Realtime/Storage สำเร็จรูปที่ Supabase ให้ฟรี — ต้องเลือก/ต่อเองสำหรับ auth (เช่น NextAuth), realtime (เช่น Pusher/Ably/self-host WS สำหรับ live scoreboard), file storage สำหรับรูป webboard (เช่น Vercel Blob/Cloudinary/S3)
  - ต้อง track เพิ่มว่าทำไมเปลี่ยนใจจาก Supabase → MongoDB (เหตุผลด้าน cost/preference/ทีมคุ้นเคย) — **ยังไม่มีข้อมูล ควรถามผู้ใช้เพิ่มถ้าต้องการบันทึกไว้ให้ครบ**
  - ต้องอัปเดต README.md ส่วน "Roadmap v2 (Supabase Integration)" ให้ตรงกับทิศทางใหม่ (ตอนเริ่ม Phase 0 จริง)

## ADR-002 — เสนอให้อยู่ใน Next.js repo เดียว ใช้ API Routes แทนแยก backend service

- **วันที่:** 2026-09-06
- **สถานะ:** proposed (ยังไม่ได้ confirm จากผู้ใช้)
- **Context:** ต้องมี backend สำหรับ MongoDB + auth + (ในอนาคต) realtime ต้องตัดสินใจว่าจะแยกเป็น service ต่างหากหรือใช้ Next.js API Routes/Route Handlers ในโปรเจกต์เดิม
- **Decision (เสนอ):** ใช้ Next.js API Routes/Route Handlers ในโปรเจกต์เดียวกันไปก่อน เพราะขนาดทีม/โปรเจกต์เล็ก ไม่มีเหตุผลต้อง over-engineer แยก service ตอนนี้
- **Consequences:** ถ้า realtime/live scoreboard ต้องการ persistent WebSocket connection ที่ serverless function (Vercel) รองรับได้จำกัด อาจต้องพึ่ง third-party realtime service (Pusher/Ably) แทนการ self-host WS ในตัว Next.js เอง

## ADR-001 — Phase 0 (backend) เป็น prerequisite ของแทบทุกฟีเจอร์ใหม่

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** วิเคราะห์ฟีเจอร์ที่ขอทั้งหมด (เช็คอิน multi-device, webboard, tournament, live score, QR self check-in) พบว่าเกือบทั้งหมดต้องมีคนหลายคน/หลายอุปกรณ์เห็นข้อมูลชุดเดียวกันพร้อมกัน ซึ่งเป็นไปไม่ได้กับสถาปัตยกรรม client-only + localStorage ปัจจุบัน
- **Decision:** จัดลำดับ backend foundation (MongoDB + API + auth ขั้นต่ำ) เป็น Phase 0 ที่ต้องทำก่อนฟีเจอร์ multi-device ใด ๆ ยกเว้น "แก้ logic จับคู่" ที่เป็น pure logic ทำได้โดยไม่ต้องรอ
- **Consequences:** ดูรายละเอียดลำดับเฟสทั้งหมดที่ [roadmap.md](./roadmap.md)
