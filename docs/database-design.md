# Database Design (ฉบับร่าง — รอ Phase 0)

> สถานะ: **draft/proposed** ยังไม่ได้ implement จริง เขียนไว้ล่วงหน้าเพื่อให้เห็นภาพว่าฟีเจอร์ที่คุยกันจะแมปกับ schema ยังไง จะปรับเมื่อเริ่มลงมือ Phase 0 จริง — เลือก MongoDB ตาม [decision-log.md#adr-003](./decision-log.md)
>
> **อัปเดต 2026-09-06:** ตัดสินใจแล้วว่าเป็น **1 deployment ต่อ 1 ชมรม** (ไม่มี multi-tenant/`clubId`) และ auth แอดมินใช้ **PIN ต่อ session** — ดู [decision-log.md#adr-006](./decision-log.md) และ [#adr-007](./decision-log.md) ปรับ schema ด้านล่างตามนี้แล้ว
>
> **อัปเดต 2026-09-06 (2):** `sessions`, `players`, `sessionPlayers`, `matches`, `partnerHistory` implement เป็น mongoose model จริงแล้วใน `src/lib/db/models/` พร้อม API endpoint ครบ (ดู [roadmap.md](./roadmap.md)) — schema ด้านล่างตรงกับโค้ดจริงแล้ว ยกเว้น `posts`, `tournaments`/`tournamentMatches` ที่ยังเป็นแค่แผน (Phase 3, Phase 5 ตามลำดับ) — `courtBookings` ที่เคยร่างไว้ถูกตัดออกแล้ว (ดู ADR-010)

## คำถามที่ยังต้องตอบก่อนเริ่ม implement จริง

1. `Player` เป็น roster ถาวรของชมรม (ชื่อเดิมกลับมาเล่นซ้ำได้โดยไม่ต้องพิมพ์ใหม่) หรือสร้างใหม่ทุก session?
2. เก็บผลแพ้ชนะ (win/loss/score) ของ casual play ด้วยไหม หรือจะนับคะแนนเฉพาะ tournament mode เท่านั้น?

## Collections (ฉบับร่าง)

### `sessions` — 1 session คือ 1 วันที่มาเล่น (แทนที่แนวคิด "ทั้งแอป = 1 session" ของเดิม)

```ts
{
  _id: ObjectId,
  mode: 'singles' | 'doubles',
  status: 'open' | 'closed',
  adminPinHash: string,     // PIN ที่แอดมินตั้งตอนสร้าง session (hash ไว้ ไม่เก็บ plain text)
  activeCourts: number[],   // ค่า default สำหรับคอร์ดที่จะใช้ตอนสร้างแมตช์ใหม่ (แก้ผ่าน "ปรับรอบถัดไป"/"ปิดคอร์ด")
  targetScore: number,      // ค่า default คะแนนเป้าหมายต่อเกมสำหรับแมตช์ใหม่ (ดู ADR-014)
  createdAt: Date,
}
```

### ~~`courtBookings`~~ — ไม่ทำแล้ว (ADR-010)

> เดิมเสนอไว้รองรับฟีเจอร์ "รวมคอร์ด" แบบ auto-trigger ตามเวลาจองจริง แต่ตัดสินใจแล้วว่าใช้ manual close-court ล้วนพอ (ดู [decision-log.md#adr-010](./decision-log.md)) — ฟีเจอร์ "รวมคอร์ด" (ปิดคอร์ด) implement จริงแล้วโดยไม่ต้องมี collection นี้ ผ่าน `POST /api/sessions/:id/close-court` ที่แก้ `Session.activeCourts` ตรง ๆ

### `players` — roster ของชมรม (persistent ข้ามหลาย session ถ้าตอบคำถามข้อ 1 ว่า "ใช่")

```ts
{
  _id: ObjectId,
  name: string,
  createdAt: Date,
  // สถิติสะสมข้ามทุก session (ถ้าต้องการ)
  totalMatchesPlayed: number,
}
```

### `sessionPlayers` — สถานะผู้เล่นภายใน 1 session (รองรับ 2-step check-in + QR self check-in)

```ts
{
  _id: ObjectId,
  sessionId: ObjectId,
  playerId: ObjectId,       // อ้าง players._id ถ้ามาจากลงทะเบียนล่วงหน้า
  guestName?: string,       // ถ้ามาจาก QR self check-in โดยไม่มี playerId
  status: 'registered' | 'checked_in' | 'resting' | 'playing',
  registeredAt: Date,
  checkedInAt?: Date,
  matchesPlayedInSession: number,
  queuedAt: Date,           // เวลาที่เริ่มรอคิวล่าสุด — wait-time fairness tie-breaker (reset ทุกครั้งที่จบแมตช์/ถูกเปลี่ยนตัวออก)
}
```

### `matches`

```ts
{
  _id: ObjectId,
  sessionId: ObjectId,
  court: number,
  mode: 'singles' | 'doubles',
  teamA: ObjectId[],        // อ้าง sessionPlayers._id
  teamB: ObjectId[],
  status: 'ready' | 'playing' | 'done',
  startedAt?: Date,
  finishedAt?: Date,
  statsCounted: boolean,    // true ถ้า transition ไป 'done' นี้ bump สถิติ/partnerHistory ไปแล้ว (ใช้ตอน undo-finish)
  scoreA: number,           // คะแนนเกมปัจจุบัน (นับเกมเดียว ไม่ track best-of-3 — ดู ADR-013)
  scoreB: number,
  targetScore: number,      // snapshot จาก session.targetScore ตอนสร้างแมตช์ (เหมือน mode — ดู ADR-014)
}
```

### `partnerHistory` — รองรับ fairness algorithm ใหม่ (ดู [matching-algorithm.md](./matching-algorithm.md))

```ts
{
  _id: ObjectId,
  sessionId: ObjectId,       // scope ต่อ session (ไม่ carry ข้าม session อื่น เว้นแต่ตัดสินใจอื่น)
  pairKey: string,           // sorted playerId คู่กัน เช่น "id1_id2"
  timesPlayedTogether: number,
  lastPlayedAt: Date,
}
```

### `posts` — Webboard (Phase 3)

```ts
{
  _id: ObjectId,
  sessionId?: ObjectId,
  authorId: ObjectId,        // admin/member ที่โพสต์
  text: string,
  photoUrls: string[],       // ที่อยู่ไฟล์บน storage ที่เลือก (TBD)
  createdAt: Date,
}
```

### `tournaments` / `tournamentMatches` — Tournament mode (Phase 5)

```ts
// tournaments
{
  _id: ObjectId,
  name: string,               // เช่น "กีฬาสี 2026"
  type: 'singles' | 'doubles',
  bracketType: 'single_elimination' | 'double_elimination' | 'round_robin',
  status: 'draft' | 'in_progress' | 'done',
}

// tournamentMatches
{
  _id: ObjectId,
  tournamentId: ObjectId,
  round: number,
  teamA: ObjectId[],
  teamB: ObjectId[],
  scoreA?: number,
  scoreB?: number,
  winner?: 'A' | 'B',
  court?: number,
  status: 'pending' | 'playing' | 'done',
}
```

## Index ที่คาดว่าจะต้องมี

- `sessionPlayers`: `{ sessionId: 1, status: 1 }` (query pool คนพร้อมสุ่มบ่อย)
- `matches`: `{ sessionId: 1, status: 1 }`, `{ sessionId: 1, court: 1 }`
- `partnerHistory`: unique `{ sessionId: 1, pairKey: 1 }`
- `players`: unique `{ name: 1 }` (กันชื่อซ้ำในระบบ เหมือน validation เดิมที่มีอยู่แล้วใน localStorage version)
