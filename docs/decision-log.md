# Decision Log

บันทึกการตัดสินใจสำคัญแบบ ADR (Architecture Decision Record) แบบย่อ เรียงตามเวลา ใหม่สุดอยู่บนสุด แต่ละอันมี Context / Decision / Status / Consequences

สถานะที่ใช้: `decided` (ตัดสินใจแล้ว ยึดตามนี้), `proposed` (ข้อเสนอจากการวิเคราะห์ ยังไม่ยืนยัน), `superseded` (เคยตัดสินใจแล้วแต่ถูกแทนที่)

---

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
