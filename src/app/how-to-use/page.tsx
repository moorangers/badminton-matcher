import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { Icon } from '@iconify/react';

export const metadata: Metadata = {
  title: 'วิธีใช้งาน · Badminton Matcher',
  description: 'คู่มือใช้งาน Badminton Matcher ฉบับย่อ',
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-3xl border border-border bg-card p-5 shadow-soft sm:p-6">
    <h2 className="font-display text-base font-extrabold text-foreground">
      {title}
    </h2>
    <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  </section>
);

export default function HowToUsePage() {
  return (
    <div className="min-h-dvh bg-gradient-surface pb-16">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
            aria-label="กลับหน้าหลัก"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary shadow-dark">
              <Icon
                icon="mdi:badminton"
                width="20"
                height="20"
                className="text-primary"
              />
            </div>
            <div>
              <h1 className="font-display text-base font-extrabold leading-tight text-foreground">
                วิธีใช้งาน
              </h1>
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Badminton Matcher
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-8">
        <Section title="แอปนี้ทำอะไรให้">
          <p>
            ช่วยจัดคู่ผู้เล่นแบดมินตันแบบสุ่มให้แฟร์ที่สุด ไม่ต้องมีคนคอยจดว่าใครเล่นไปกี่รอบแล้ว
            รองรับทั้ง <strong className="text-foreground">Singles (1v1)</strong> และ{' '}
            <strong className="text-foreground">Doubles (2v2)</strong> พร้อมกันได้สูงสุด 3 คอร์ด
          </p>
          <p>
            ข้อมูลผู้เล่น/แมตช์ทั้งหมดเก็บไว้บนเซิร์ฟเวอร์ (ไม่ใช่แค่ในเบราว์เซอร์เครื่องเดียวอีกต่อไป)
            ผูกกับ <strong className="text-foreground">session</strong> ที่มี PIN ป้องกันไว้
          </p>
        </Section>

        <Section title="1. เริ่มต้น: สร้างหรือเข้า session">
          <p>
            เปิดแอปครั้งแรกจะเจอหน้า <strong className="text-foreground">สร้าง session ใหม่</strong> —
            เลือกโหมด (Singles/Doubles), จำนวนคอร์ดเริ่มต้น, แล้วตั้ง <strong className="text-foreground">PIN 4-6 หลัก</strong>
          </p>
          <div className="rounded-2xl border border-secondary/40 bg-secondary/10 p-3 text-xs">
            <p className="font-display font-bold uppercase tracking-wide text-foreground/80">
              ⚠️ เก็บ PIN ให้ดี
            </p>
            <p className="mt-1">
              PIN คือกุญแจเดียวที่ใช้กลับเข้า session นี้ได้ (บนเครื่องอื่นก็เข้าได้ถ้ารู้ PIN) —
              ถ้าลืม PIN จะกู้คืนผ่านหน้านี้ไม่ได้ ต้องสร้าง session ใหม่แทน
            </p>
          </div>
          <p>
            ถ้าเคยสร้าง session บนเครื่องนี้ไว้แล้ว เปิดแอปครั้งต่อไปจะขึ้นหน้า{' '}
            <strong className="text-foreground">ใส่ PIN เพื่อเข้าใช้งาน</strong> แทน (ต้องใส่ PIN ใหม่ทุกครั้งที่ปิด-เปิดหน้าเว็บ
            เพื่อความปลอดภัย)
          </p>
        </Section>

        <Section title="2. เพิ่มผู้เล่น">
          <p>
            พิมพ์ชื่อในช่อง “เพิ่มชื่อผู้เล่น” เว้นวรรคหลายชื่อพร้อมกันได้ในครั้งเดียว เช่น{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">John Jane Doe</code>
          </p>
          <p>ชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) จะถูกข้ามให้อัตโนมัติพร้อมแจ้งเตือน</p>
          <p>
            กดไอคอนดินสอที่ชื่อผู้เล่นเพื่อ <strong className="text-foreground">แก้ชื่อ</strong> หรือ{' '}
            <strong className="text-foreground">ลบผู้เล่น</strong> ออกจากรายชื่อ (ลบไม่ได้ถ้าผู้เล่นกำลังอยู่ในแมตช์ที่ยังไม่จบ
            ต้องเปลี่ยนตัวออกก่อน)
          </p>
        </Section>

        <Section title="3. เริ่มจับคู่">
          <p>
            เมื่อมีผู้เล่นพอแล้ว เลือกโหมดและจำนวนคอร์ด แล้วกด{' '}
            <strong className="text-foreground">“เริ่มจับคู่”</strong> ระบบจะสุ่มจัดคู่ให้ทันทีตามหลักความแฟร์
            (อธิบายด้านล่าง)
          </p>
          <p>
            แต่ละคอร์ดมีปุ่ม <strong className="text-foreground">“เริ่ม”</strong> (เริ่มแข่งจริง) และ{' '}
            <strong className="text-foreground">“จบแมตช์”</strong> — พอจบแมตช์ ระบบจะดึงคู่ถัดไปขึ้นคอร์ดนั้นให้อัตโนมัติทันที
            ไม่ต้องกดจับคู่ใหม่เอง
          </p>
        </Section>

        <Section title="ฟีเจอร์เสริมระหว่างเล่น">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">เปลี่ยนตัว (⇄)</strong> — กดที่ชื่อผู้เล่นในคอร์ด
              ระบบจะสุ่มคนที่กำลังพักมาเปลี่ยนแทน คนเดิมจะไปพัก (ไม่ถูกลบออกจากรายชื่อ)
            </li>
            <li>
              <strong className="text-foreground">ปิดคอร์ด</strong> — ใช้เมื่อคอร์ดนั้นหมดเวลาที่จองไว้ก่อนคอร์ดอื่น
              ระบบจะจบแมตช์ที่กำลังเล่นทันที ปิดคอร์ดนั้นสำหรับรอบนี้ แล้วย้ายผู้เล่นไปรวมคิวกับคอร์ดที่เหลือ
            </li>
            <li>
              <strong className="text-foreground">ปรับรอบถัดไป</strong> — เปลี่ยนโหมด/จำนวนคอร์ดสำหรับรอบถัดไป
              โดยไม่กระทบแมตช์ที่กำลังเล่นอยู่
            </li>
            <li>
              <strong className="text-foreground">ย้อนกลับคอร์ดนี้</strong> — ใช้ได้เฉพาะคอร์ดที่เพิ่งกด “จบแมตช์” ล่าสุดจริง ๆ
              เท่านั้น (กดผิดแก้ทันได้ แต่ถ้าคนในแมตช์นั้นถูกจัดลงแมตช์อื่นไปแล้วจะย้อนไม่ได้)
            </li>
            <li>
              <strong className="text-foreground">รีเซ็ตทั้งหมด</strong> — ล้างแมตช์และสถิติทั้งหมด
              เริ่มนับใหม่ตั้งแต่ 0 แต่รายชื่อผู้เล่นยังอยู่
            </li>
            <li>
              <strong className="text-foreground">ล้างทั้งหมด</strong> — ออกจาก session นี้บนเครื่องนี้เท่านั้น
              (ข้อมูลบนเซิร์ฟเวอร์ยังอยู่ ถ้ามี PIN สามารถกลับเข้ามาดูได้อีก)
            </li>
          </ul>
        </Section>

        <Section title="หลักการจับคู่ให้แฟร์">
          <ul className="list-disc space-y-2 pl-5">
            <li>ใครเล่นน้อยรอบกว่า ได้ลงคอร์ดก่อนเสมอ</li>
            <li>ถ้าเล่นมาเท่ากัน คนที่รอคิว/พักมานานกว่า จะได้ลงก่อน (มาก่อนได้เปรียบ)</li>
            <li>
              ตอนจับทีมคู่ (Doubles) ระบบจะเลี่ยงจับคนที่เพิ่งเป็นคู่กันมา พยายามสลับคู่ให้หลากหลายที่สุด
              ไม่ใช่จับคู่เดิมซ้ำ ๆ
            </li>
          </ul>
        </Section>

        <Section title="คำถามที่พบบ่อย">
          <div>
            <p className="font-medium text-foreground">ลืม PIN ทำยังไง?</p>
            <p>กู้คืนไม่ได้ ต้องสร้าง session ใหม่ และพิมพ์รายชื่อผู้เล่นใหม่</p>
          </div>
          <div>
            <p className="font-medium text-foreground">
              เปิดจากหลายเครื่องพร้อมกันได้ไหม?
            </p>
            <p>
              ได้ ถ้ารู้ PIN เดียวกัน แต่ตอนนี้ยังไม่อัปเดตแบบเรียลไทม์ข้ามเครื่อง — ต้อง refresh หน้าเองถึงจะเห็นข้อมูลล่าสุดจากเครื่องอื่น
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">รองรับกี่คอร์ด?</p>
            <p>สูงสุด 3 คอร์ดพร้อมกันต่อ session</p>
          </div>
        </Section>
      </main>
    </div>
  );
}
