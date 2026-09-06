# Database Design (ฉบับร่าง — รอ Phase 0)

> สถานะ: **draft/proposed** ยังไม่ได้ implement จริง เขียนไว้ล่วงหน้าเพื่อให้เห็นภาพว่าฟีเจอร์ที่คุยกันจะแมปกับ schema ยังไง จะปรับเมื่อเริ่มลงมือ Phase 0 จริง — เลือก MongoDB ตาม [decision-log.md#adr-003](./decision-log.md)

## คำถามที่ต้องตอบก่อนเริ่ม implement จริง

1. รองรับ multi-tenant (`Club`) ตั้งแต่วันแรก หรือ 1 deployment ต่อ 1 ชมรมพอในตอนนี้? (ส่งผลกับทุก collection ด้านล่างว่าต้องมี `clubId` หรือไม่)
2. `Player` เป็น roster ถาวรของชมรม (ชื่อเดิมกลับมาเล่นซ้ำได้โดยไม่ต้องพิมพ์ใหม่) หรือสร้างใหม่ทุก session?
3. เก็บผลแพ้ชนะ (win/loss/score) ของ casual play ด้วยไหม หรือจะนับคะแนนเฉพาะ tournament mode เท่านั้น?

## Collections (ฉบับร่าง)

### `clubs` (ถ้าตัดสินใจรองรับ multi-tenant)

```ts
{
  _id: ObjectId,
  name: string,
  createdAt: Date,
}
```

### `sessions` — 1 session คือ 1 วันที่มาเล่น (แทนที่แนวคิด "ทั้งแอป = 1 session" ของเดิม)

```ts
{
  _id: ObjectId,
  clubId: ObjectId,
  date: Date,
  mode: 'singles' | 'doubles',
  status: 'open' | 'closed',
  createdAt: Date,
}
```

### `courtBookings` — รองรับฟีเจอร์ "รวมคอร์ด" (ADR-004)

```ts
{
  _id: ObjectId,
  sessionId: ObjectId,
  court: number,
  startTime: Date,
  endTime: Date,          // ใช้เตือน/auto-trigger เมื่อใกล้หมดเวลา
  mergedIntoCourt?: number, // ถ้าถูกรวมเข้าคอร์ดอื่นแล้ว
  status: 'active' | 'merged' | 'closed',
}
```

### `players` — roster ต่อชมรม (persistent ข้ามหลาย session ถ้าตอบคำถามข้อ 2 ว่า "ใช่")

```ts
{
  _id: ObjectId,
  clubId: ObjectId,
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
  checkedInAt?: Date,       // ใช้เป็น wait-time fairness tie-breaker
  matchesPlayedInSession: number,
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
  clubId: ObjectId,
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
  clubId: ObjectId,
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
- `players`: unique `{ clubId: 1, name: 1 }` (กันชื่อซ้ำในชมรมเดียวกัน เหมือน validation เดิมที่มีอยู่แล้วใน localStorage version)
