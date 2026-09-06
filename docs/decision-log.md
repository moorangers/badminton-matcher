# Decision Log

บันทึกการตัดสินใจสำคัญแบบ ADR (Architecture Decision Record) แบบย่อ เรียงตามเวลา ใหม่สุดอยู่บนสุด แต่ละอันมี Context / Decision / Status / Consequences

สถานะที่ใช้: `decided` (ตัดสินใจแล้ว ยึดตามนี้), `proposed` (ข้อเสนอจากการวิเคราะห์ ยังไม่ยืนยัน), `superseded` (เคยตัดสินใจแล้วแต่ถูกแทนที่)

---

## ADR-018 — หน้าแรกเหลือแค่การ์ด "Session ล่าสุด" (grid สี่เหลี่ยมจัตุรัส), ย้ายสร้าง session ไปเป็น modal, ตัดโหมด/คอร์ด/คะแนนออกจากตอนสร้าง

- **วันที่:** 2026-09-06
- **สถานะ:** decided (revise 2 ครั้งในวันเดียวกัน — เริ่มจากการ์ดเดียวรวมทุกอย่าง → 2 การ์ดซ้าย-ขวา (สร้างใหม่/ประวัติ) → เวอร์ชันสุดท้ายนี้ที่ย้าย "สร้างใหม่" ออกไปเป็น modal ทั้งหมด เหลือแค่การ์ด history เป็น content หลักของหน้า)
- **Context:** หน้าสร้าง session เดิม (การ์ดเดียว) เริ่มแน่นเกินไปหลังเพิ่ม field ชื่อ + ตัวเลือก mode/court/score + PIN + list "session ที่มีอยู่แล้ว" ทั้งหมดในการ์ดเดียว ลองแยกเป็น 2 การ์ดซ้าย-ขวาก่อน แต่ผู้ใช้ตัดสินใจว่าอยากให้หน้าแรกเน้นโชว์ "ก้อน session" เป็นหลัก โดยย้ายฟอร์มสร้าง session ไปเป็น modal เปิดจากปุ่มในเฮดเดอร์แทน ไม่ต้องมีการ์ดสร้าง session ค้างอยู่บนหน้าตลอด
- **Decision:** (1) ตัด ModeSelector/CourtSelector/TargetScoreSelector ออกจากตอนสร้าง session ทั้งหมด — สร้างด้วยค่า default เสมอ (`doubles`, คอร์ด `[1]`, คะแนนเป้าหมาย `11`) แล้วให้ไปปรับที่การ์ด pre-game บน dashboard แทน (มีอยู่แล้ว รองรับปรับก่อนกด "เริ่มจับคู่" ครั้งแรกอยู่แล้วโดยไม่ต้องแก้อะไรเพิ่ม); (2) ถ้าไม่ตั้งชื่อตอนสร้าง ใช้วันที่-เวลาปัจจุบัน (`formatSessionDate`) เป็นชื่อจริงที่บันทึกลง DB เลย (เปลี่ยนจาก ADR-017 ที่แค่โชว์วันที่เป็น fallback ตอน render ไม่ได้เก็บเป็นชื่อจริง); (3) ฟอร์มสร้าง session (ชื่อ+PIN+ปุ่มสร้าง) ย้ายเข้า modal เปิดจากปุ่ม "สร้าง session" ในเฮดเดอร์ (โชว์เฉพาะไอคอนบนมือถือ); (4) หน้าแรกเหลือการ์ดใหญ่การ์ดเดียว "Session ล่าสุด" กรองเอาเฉพาะที่สร้างภายใน 24 ชม.ที่ผ่านมา แสดงเป็น grid กล่องสี่เหลี่ยมจัตุรัส (`aspect-square`) 2 คอลัมน์บนมือถือ, 3 บน `sm`, 4 บน `md`+ ทีละ 8 รายการ (2 แถว x 4 คอลัมน์พอดีตอน desktop) มี pagination ก่อนหน้า/ถัดไปถ้าเกิน; (5) หน้าใช้ `<header>`/`<main>`/`<footer>` โครงเดียวกับ dashboard (เต็มความกว้างจอ, sticky header, fixed footer) แทนการ์ดลอยกลางจอแบบเดิมสุด
- **Consequences:** ต้องแก้ E2E test helper (`tests/e2e/helpers.ts`) 2 รอบ — รอบแรกเพราะเลือกโหมดตอนสร้างไม่ได้แล้ว (ย้ายไปเลือกบน dashboard's pre-game แทน) รอบสองเพราะปุ่ม submit ในตัว modal ("สร้าง session") ชื่อชนกับปุ่ม trigger ในเฮดเดอร์ที่ใช้ข้อความเดียวกัน ต้องเพิ่ม `data-testid="submit-create-session"` ให้ปุ่ม submit เพื่อกดแบบไม่กำกวม — ข้อมูลทดสอบที่สะสมมาจากการพัฒนาฟีเจอร์นี้ทั้งวัน (20+ sessions ใน local dev DB) ทำให้การ์ด "Session ล่าสุด" ตอนนี้มีหลายหน้า เป็นแค่ dev noise ไม่กระทบ production

## ADR-017 — ตั้งชื่อ session ได้ (ไม่บังคับ) + เลือกเข้า session เดิมจากหน้าแรกได้

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** ผู้ใช้กังวลว่าจะสับสนว่ากำลังเข้า session ไหนอยู่ ถามว่า "มี DB แล้วน่าจะมีได้มากกว่า 1 session" — พบว่า backend มี `GET /api/sessions` (list ล่าสุด 20 อัน ไม่โชว์ PIN hash) เตรียมไว้ตั้งแต่ Phase 0 แล้วแต่ไม่เคยถูกเรียกใช้จาก UI เลย เพราะ browser จำ session ได้แค่ 1 อันผ่าน localStorage เท่านั้น ไม่มีหน้า list/เลือก session ให้ใช้งาน
- **Decision:** (1) เพิ่ม `Session.name` (optional, trim, สูงสุด 60 ตัวอักษร) ตั้งได้ตอนสร้าง session เท่านั้น (ยังไม่รองรับเปลี่ยนชื่อทีหลัง); (2) หน้าสร้าง session เพิ่มส่วน "หรือเข้า session ที่มีอยู่แล้ว" ดึงจาก `GET /api/sessions` ที่มีอยู่แล้ว โชว์ชื่อ+โหมด+คอร์ด+วันที่ (ถ้าไม่ตั้งชื่อ fallback โชว์วันที่แทนชื่อ) กดแล้วพาไปหน้า PIN gate ของ session นั้น (เหมือน flow bootstrap จาก localStorage เดิม ไม่ได้ authenticate ทันที ยังต้องใส่ PIN) — โชว์แบบสาธารณะได้เลยไม่ต้องมี auth เพิ่มเพราะเป็น "1 deployment ต่อ 1 ชมรม" (ADR-006) sessions ทั้งหมดในนี้เป็นของชมรมเดียวกันอยู่แล้ว; (3) โชว์ชื่อ+วันที่ของ session ปัจจุบันในหัวหน้า dashboard และหน้า PIN gate ด้วย
- **Consequences:** ต้องแก้ E2E test helper (`tests/e2e/helpers.ts`) เพราะ list ที่โตขึ้นเรื่อย ๆ ทำให้ accessible name ของปุ่ม Mode ("Singles"/"Doubles") ชนกับข้อความในการ์ด session เก่า ๆ ที่ก็มีคำว่า "Doubles"/"Singles" อยู่ด้วย (เจอจริงตอนรัน test หลังมี session สะสมในเครื่อง dev เกิน 10 อัน) แก้โดยเพิ่ม `data-testid` ให้ปุ่ม mode ใน `ModeSelector.tsx` แทนการอิง accessible name — บทเรียน: ตัวเลือกที่ทดสอบด้วย role+name เสี่ยงชนกับ list ข้อมูลที่โตขึ้นเรื่อย ๆ ควรใช้ `data-testid` สำหรับปุ่มที่ค่อนข้างแน่นอนว่าจะมีข้อความซ้ำกับข้อมูลอื่นในหน้า

## ADR-016 — แก้บั๊ก "รีเซ็ตทั้งหมด" เตะผู้เล่นออกจากพูลจับคู่ + ย้ายปุ่มให้ไม่ผูกกับ active matches

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** `POST /api/sessions/:id/reset-stats` (ปุ่ม "รีเซ็ตทั้งหมด") เดิมตั้ง `status: 'registered'` ให้ผู้เล่นทุกคนหลังล้างแมตช์/ประวัติ ซึ่งเขียนไว้ก่อน Phase 2 (เช็คอิน 2 ขั้น) จะมี — ผลคือกดรีเซ็ตกลางวงจะเตะทุกคนออกจากพูลจับคู่ทันที ต้องเช็คอินใหม่หมดถึงจะจับคู่ต่อได้ ผู้ใช้ยืนยันว่าไม่ใช่พฤติกรรมที่ต้องการ ("ควรรีเซ็ตเฉพาะแมตช์ ผู้เล่นที่เช็คอินแล้วต้องยังใช้ได้ต่อ") — ระหว่างตรวจโค้ดยังพบด้วยว่าปุ่ม "รีเซ็ตทั้งหมด" และ "ล้างทั้งหมด" (ออกจาก session บนเครื่องนี้) ทั้งคู่ถูกฝังอยู่ใน `{activeMatches.length > 0 && (...)}` ทำให้เข้าถึงไม่ได้เลยถ้ายังไม่เคยกด "เริ่มจับคู่" ในรอบนั้น
- **Decision:** (1) แก้ `reset-stats` ให้ไม่แตะ `status` ของผู้เล่นที่ `checked_in`/`resting`/`registered` เลย เปลี่ยนแค่คนที่ `playing` ให้กลับเป็น `checked_in` (เพราะแมตช์เดิมถูกลบไปแล้ว) ส่วน `matchesPlayedInSession`/`queuedAt` ยังรีเซ็ตเหมือนเดิม; (2) ย้าย "ล้างทั้งหมด" (ออกจาก session) ไปเป็นปุ่มในเฮดเดอร์ (คู่กับจอคะแนนสด/กระดานข่าว/วิธีใช้งาน) แสดงตลอดเวลาไม่ผูกกับ active matches; (3) ปุ่ม "รีเซ็ตสถิติ/แมตช์" (เปลี่ยนชื่อจาก "รีเซ็ตทั้งหมด" — ผู้ใช้ชี้ว่าชื่อเดิมฟังดูเหมือนเคลียร์คนด้วย ทั้งที่จริงเคลียร์แค่แมตช์/สถิติ) ย้ายไปอยู่ในหัว MatchBoard คู่กับปุ่ม "ปรับรอบถัดไป" แทน (ตามที่ผู้ใช้ให้เหตุผลว่าเป็นการจัดการรอบ/แมตช์เหมือนกัน) — จุดนี้แปลว่ากลับไปผูกกับ `activeMatches.length > 0` เหมือนเดิม (เป็นการตัดสินใจที่ตั้งใจ ไม่ใช่ regression) — เอา `overflow-x-auto`/`min-w-max` ออกจาก stats bar ด้วยเพราะพอไม่มีปุ่มสองอันแล้วเหลือแค่ตัวเลข 3 ค่าสั้น ๆ พอดีแถวเดียว
- **Consequences:** ผู้เล่นที่กำลังเล่นอยู่ตอนกดรีเซ็ตจะโดนดึงออกจากคอร์ด (เพราะแมตช์ถูกลบ) แต่ยังอยู่ในพูลจับคู่ต่อได้ทันที ไม่ต้องเช็คอินใหม่ — "ล้างทั้งหมด" แสดงตลอดตั้งแต่สร้าง session เสร็จ ส่วน "รีเซ็ตสถิติ/แมตช์" แสดงเฉพาะตอนมี active matches เท่านั้น (เหมือนปุ่ม "ปรับรอบถัดไป" ที่อยู่ข้าง ๆ กัน)

## ADR-015 — เพิ่ม automated test 2 ระดับ (Vitest unit + Playwright E2E) หลังเจอบั๊ก state machine 2 ตัวติด

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** เจอบั๊กจริง 2 ตัวติดกันในวันเดียว (undo-finish ใช้งานไม่ได้เลยเพราะ auto-fill บล็อกตัวเอง — แก้แล้วดู v0.9.14 ใน CHANGELOG; เพิ่มคอร์ดกลางเกมไม่สร้างแมตช์จริงให้ — แก้แล้วดู v0.9.15) ทั้งสองอันเป็น "state transition ที่ไม่มีใครต่อสาย action ให้" ไม่ใช่บัค algorithm ผิด และก่อนหน้านี้ repo นี้ไม่มี test/CI เลย บัคแบบนี้จะถูกจับได้ก็ต่อเมื่อมีคนบังเอิญคลิกไปเจอเท่านั้น
- **Decision:** เพิ่ม test 2 ระดับแยกจุดประสงค์กันชัดเจน — (1) **Vitest** unit test (`src/**/*.test.ts`) เทส pure function ล้วน (`buildMatchesFromPlayers`, `assignTeams`, `getGameWinner`) ไม่ต้องมี server/DB รันเร็ว จับบัคเรื่อง algorithm/scoring ผิด — ต้องแยก matching algorithm ออกจาก `home-page.tsx` ไปเป็น `src/lib/matching.ts` ก่อนถึงจะ import มาเทสได้ (เดิมเป็น local function ในไฟล์ component); (2) **Playwright** E2E test (`tests/e2e/*.spec.ts`) จำลอง flow เต็มผ่านเบราว์เซอร์จริง+server+DB จริง (local Docker mongo) จับบัคระดับ state machine ที่ unit test จับไม่ได้ — เพิ่ม regression test ให้ 2 บัคที่เพิ่งเจอไว้แล้ว (`undo-finish.spec.ts`, `add-court.spec.ts`)
- **Consequences:** เทสที่เขียนไว้ตอนนี้เป็นแค่จุดเริ่มต้น (ครอบคลุมแค่ 2 บัคที่เจอจริง ไม่ใช่ทุก use case) — ยังไม่มี CI รันอัตโนมัติ (ต้องรัน `yarn test`/`yarn test:e2e` มือเอง) ยังไม่ได้ map state machine ของ Match/Court เป็นเอกสารทั้งระบบ (ตกลงว่าจะวางแผนทีละ use case ต่อไป) — E2E test สร้าง/แก้ข้อมูลจริงใน MongoDB ที่ `.env` ชี้ไป ต้องเช็คว่าเป็น local เสมอก่อนรัน (เหมือน ADR-012)

## ADR-014 — คะแนนเป้าหมายต่อเกมปรับได้ (ไม่ fix ที่ 21) — snapshot ต่อแมตช์เหมือน mode

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** ตามมาจาก ADR-013 ที่นับคะแนนแบบเกมเดียว fix ไว้ที่ 21 แต้ม ผู้ใช้ถามว่าปรับได้ไหม ("จะเล่นกี่แต้ม") — ยืนยันแล้วว่าหมายถึงคะแนนเป้าหมายต่อเกม (เช่น 11/15/21) ไม่ใช่จำนวนเกมต่อแมตช์ (best-of-N ยังไม่ทำ ตามที่ตัดสินใจไว้ใน ADR-013)
- **Decision:** เพิ่ม `Session.targetScore` (ตั้งตอนสร้าง session หรือแก้ทีหลังผ่านตัวเลือกก่อนเริ่มจับคู่ / "ปรับรอบถัดไป") เป็นค่า default สำหรับแมตช์ใหม่ที่จะสร้าง — แต่ **แมตช์แต่ละอันเก็บ `targetScore` เป็น snapshot ของตัวเอง** ตอนถูกสร้าง (เหมือนที่ `mode` ทำอยู่แล้ว) ไม่ได้อ่านค่าจาก session แบบ live ตลอดเวลา
- **Consequences:** เปลี่ยน session.targetScore ระหว่างเล่นจะไม่กระทบแมตช์ที่กำลังเล่นอยู่ (กันเหตุการณ์แปลก ๆ เช่น ลดคะแนนเป้าหมายกลางเกมแล้วจู่ ๆ ระบบประกาศผู้ชนะทันทีทั้งที่ยังเล่นไม่จบ) มีผลแค่กับแมตช์รอบถัดไปที่ยังไม่ถูกสร้าง — cap การจบเกมแบบ "ชนะขาด" ใช้สูตร `targetScore + 9` ทั่วไป (ขยายจากอัตราส่วน 21/30 ของกติกาทางการ) ไม่ได้อ้างอิงกติกาทางการจริงสำหรับคะแนนเป้าหมายอื่นนอกจาก 21

> **อัปเดต 2026-09-06:** เปลี่ยนค่า default จาก 21 เป็น **11** ทั้งฝั่ง client (`createTargetScore`/`draftTargetScore`) และ schema default (`Session.targetScore`, `Match.targetScore`, `POST /api/sessions` fallback, `getGameWinner()` default param) — เหตุผลคือกลุ่มที่เล่นแบบ walk-in ส่วนใหญ่นิยมเล่นสั้น (11 แต้ม) มากกว่ากติกาทางการ 21 แต้ม ไม่กระทบ session ที่สร้างไปแล้วเพราะ targetScore เป็น snapshot ต่อ session/แมตช์อยู่แล้ว preset ยังเป็น 11/15/21 เท่าเดิม (เคยลองเพิ่ม 7/9 แล้วถอดออก — ผู้ใช้แค่เข้าใจผิดว่ากรอกเองไม่ได้ ไม่ได้อยากได้ preset เพิ่ม) แก้โดยเพิ่ม label "กำหนดเอง" กำกับช่องกรอกตัวเลขแทน

## ADR-013 — Live scoreboard ใช้ polling (ไม่ใช้ Pusher/Ably), นับคะแนนแบบเกมเดียว

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** Phase 4 ต้องตัดสินใจ 2 เรื่อง: (1) realtime layer สำหรับ live scoreboard — polling ธรรมดา vs 3rd-party service (Pusher/Ably); (2) ระบบนับคะแนนควรซับซ้อนแค่ไหน — เกมเดียวถึง 21 แต้ม vs best-of-3 เกมแบบทัวร์นาเมนต์
- **Decision:** เลือก polling ทุก 2 วินาที (ไม่ต้องสมัครบัญชี 3rd-party เพิ่ม ไม่ต้องกังวลเรื่อง Vercel serverless ไม่รองรับ WebSocket ค้างนาน ๆ) และเลือกนับคะแนนแบบ**เกมเดียว** (21 แต้ม, win-by-2, cap ที่ 30) ไม่ track หลายเกมต่อแมตช์
- **Consequences:** หน้า `/scoreboard/[sessionId]` เห็นคะแนนช้ากว่าความเป็นจริงได้สูงสุด ~2 วินาที (ยอมรับได้สำหรับ casual play ไม่ใช่ broadcast มืออาชีพ) — ถ้าต้องการ best-of-3 (เช่นตอนทำ Phase 5 tournament) ต้องขยาย schema เพิ่ม (เก็บ array ของเกมที่จบไปแล้ว + ตัวนับเกมที่ชนะของแต่ละทีม) ไม่ใช่แค่ scoreA/scoreB ตัวเดียวแบบตอนนี้
- **บั๊กที่เจอระหว่าง implement:** ตอนแรกใช้ pattern read-modify-write (`match.scoreA = match.scoreA + delta; await match.save()`) ซึ่งเจอ race condition จริงตอนทดสอบกดปุ่ม +1 รัว ๆ (3 requests concurrent กัน ทำให้ผลรวมคะแนนหายไปบางส่วน) แก้เป็น atomic `$inc` ผ่าน `findOneAndUpdate` แทน (ฝั่งลบคะแนนใช้ filter `{$gt: 0}` กันติดลบในตัว query เดียวกันแบบ atomic)

## ADR-012 — Local `.env` ต้องชี้ local Docker mongo เสมอ ไม่ใช้ Atlas จริงตอน dev

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** ระหว่างแก้ปัญหา deploy Vercel + Atlas ก่อนหน้านี้ local `.env` ถูกแก้ให้ชี้ไปที่ Atlas cluster จริง (แทนที่ container local) เพื่อ debug — แต่ไม่มีใครสังเกตว่ายังชี้ค้างอยู่แบบนั้น ทำให้การทดสอบ Phase 2/3 ในเซสชันถัดมา (สร้าง session ทดสอบ, ลบ/ล้างข้อมูลด้วย `dropDatabase()` ระหว่างเทส) ไปกระทบ **database จริงที่ deploy ใช้งานอยู่** โดยไม่ได้ตั้งใจ จนไปเจอเข้าตอนทดสอบ webboard (โพสต์เก่าที่ลบไปแล้วจาก session ก่อนหน้ายังโผล่มา เพราะ dropDatabase ที่รันไปนั้น ๆ ไปโดน local container เปล่า ๆ ไม่ใช่ตัวจริงที่แอปต่ออยู่) เมื่อตรวจสอบพบว่ามีข้อมูลจริงของผู้ใช้ปนอยู่ด้วย (ผู้เล่นชื่อ "หมู" ที่ไม่ใช่ชื่อทดสอบ) ผู้ใช้ยืนยันให้ล้าง database Atlas ทั้งหมดทิ้ง (ไม่มีข้อมูลสำคัญอยู่ ณ ตอนนั้น)
- **Decision:** local `.env` ต้องชี้ไปที่ container mongo local (`localhost:27017`) เสมอสำหรับ dev/ทดสอบ — ค่า connection string ของ Atlas จริงเก็บไว้ที่ Vercel Environment Variables เท่านั้น ไม่เอามาใส่ใน `.env` ของเครื่อง dev
- **Consequences:** ก่อนรันคำสั่งที่ทำลายข้อมูล (`dropDatabase()`, `db:xxx` ทดสอบ) ทุกครั้งควร `cat .env` เช็คว่า `MONGODB_URI` ยังชี้ `localhost` อยู่ก่อนเสมอ — เพิ่มไว้ใน README ส่วน Troubleshooting ด้วย

## ADR-011 — เลือก Vercel Blob เป็น file storage สำหรับ Phase 3 (webboard)

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** Phase 3 (webboard) ต้องเก็บรูปภาพที่แนบมากับโพสต์ ตัวเลือกที่เคยร่างไว้คือ Vercel Blob / Cloudinary / S3
- **Decision:** เลือก Vercel Blob เพราะโปรเจกต์ deploy บน Vercel อยู่แล้ว ไม่ต้องสมัครบัญชีที่สามเพิ่ม ผูกกับ project ได้ตรง ๆ ผ่าน dashboard
- **Consequences:** ต้อง enable Blob storage ในโปรเจกต์ Vercel (Storage tab) แล้วจะได้ `BLOB_READ_WRITE_TOKEN` มาตั้งเป็น env var อัตโนมัติบน Vercel — สำหรับ local dev ต้องคัดลอก token นั้นมาใส่ `.env` เองถ้าอยากทดสอบอัปโหลดรูปจริงในเครื่อง (ยังไม่ได้ทำในเซสชันนี้ ทดสอบได้แค่ path โพสต์ข้อความล้วน) ใช้ client-side direct upload (`@vercel/blob/client`) แทนที่จะอัปโหลดผ่าน server เพื่อเลี่ยง serverless request body size limit

## ADR-010 — ไม่ทำ auto-trigger ปิดคอร์ดตามเวลาจองจริง เก็บไว้แค่ manual

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** [roadmap.md](./roadmap.md) Phase 1 เคยเสนอให้มี auto-trigger ปิดคอร์ดอัตโนมัติเมื่อถึงเวลาที่จองไว้ (ต้องเพิ่ม `courtBookings.endTime` ตาม [database-design.md](./database-design.md)) เสนอ 3 ทางเลือกให้ผู้ใช้เลือก: (1) manual ล้วนเหมือนเดิม (2) countdown badge + เตือนเมื่อหมดเวลา แต่ยังต้องกดปิดเอง (3) auto-close จริงไม่ต้องกดยืนยัน (เสี่ยงเพราะ client-side timer ไม่แม่นยำถ้าไม่มีคนเปิดแอปค้างไว้ ถ้าจะแม่นจริงต้องมี server cron แยกต่างหาก)
- **Decision:** เลือกทางเลือก (1) — manual ล้วน ไม่ทำ auto-trigger หรือ countdown ใด ๆ ในตอนนี้ ปุ่ม "ปิดคอร์ด" ที่มีอยู่แล้วตอบโจทย์พอ
- **Consequences:** ปิด Phase 1 เป็น done ทั้งหมด ไม่มี `courtBookings` collection ที่เคยร่างไว้ใน database-design.md — ถ้าอนาคตอยากได้ auto-reminder (ทางเลือก 2) กลับมาทำได้โดยไม่กระทบโค้ดเดิม เพราะ manual close-court endpoint ที่มีอยู่ไม่ต้องแก้อะไรเพิ่ม

## ADR-009 — Admin-added players are `checked_in` immediately, only public self-registration creates `registered`

- **วันที่:** 2026-09-06
- **สถานะ:** decided
- **Context:** Phase 2 เพิ่มสถานะ `registered` (ลงชื่อล่วงหน้า ยังไม่ยืนยันว่าถึงคอร์ด) แต่ workflow เดิม (แอดมินพิมพ์ชื่อเพิ่มตรงหน้าคอร์ด) ก็ยังต้องใช้งานได้เหมือนเดิมโดยไม่มีขั้นตอนเพิ่ม
- **Decision:** ผู้เล่นที่แอดมินเพิ่มผ่าน `POST /api/sessions/:id/players` (หน้า dashboard) ได้ status `checked_in` ทันที — เพราะแอดมินเพิ่มตรงหน้าคอร์ดแปลว่าคนนั้นอยู่ที่นั่นจริงอยู่แล้ว ไม่ต้องเช็คอินซ้ำ ส่วน status `registered` เกิดได้ทางเดียวคือผ่าน public endpoint `POST /api/sessions/:id/register` (คนลงชื่อเองล่วงหน้าจากที่ไหนก็ได้ ยังไม่ยืนยันว่าถึงคอร์ดแล้ว)
- **Consequences:** UX เดิมของแอดมินไม่เปลี่ยนแปลงเลย (ไม่มีขั้นตอนเช็คอินเพิ่มสำหรับคนที่แอดมินเพิ่มเอง) — ฟีเจอร์เช็คอิน 2 ขั้นมีผลเฉพาะกับคนที่ลงชื่อผ่านลิงก์/QR สาธารณะเท่านั้น ตรงกับโจทย์เดิม "ลงชื่อมาก่อน แล้วที่หน้าคอร์ดก็ค่อยเชคอินอีกครั้ง"

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
