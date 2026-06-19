# Claude Code Prompt: ระบบตรวจสอบ Transcript เทียบกับโครงสร้างหลักสูตร IoT (KMITL)

คัดลอกพรอมป์ด้านล่างทั้งหมดไปวางใน Claude Code (รันจาก root ของโปรเจกต์ใหม่ หรือโฟลเดอร์เปล่า)

---

## วาง curriculum_seed.json ก่อนรัน

ก่อนรันพรอมป์นี้ ให้นำไฟล์ `curriculum_seed.json` (ที่แปลงจาก Excel โครงสร้างหลักสูตรไว้แล้ว) ไปวางไว้ที่
`./data/curriculum_seed.json` ในโฟลเดอร์โปรเจกต์ — Claude Code จะอ่านไฟล์นี้เพื่อสร้าง seed data ให้ตรงกับ
หลักสูตรจริง (135 หน่วยกิต, 113 รายวิชา, 23 หมวดหมู่, แผนการศึกษา 4 ปี)

---

## พรอมป์

```
สร้างเว็บแอป Next.js (App Router, TypeScript) สำหรับนักศึกษาวิศวกรรมระบบไอโอทีและสารสนเทศ (KMITL)
อัปโหลด transcript เพื่อตรวจสอบหน่วยกิตและสถานะรายวิชาเทียบกับโครงสร้างหลักสูตร

## เทคสแตก
- Next.js 14+ (App Router), TypeScript
- Prisma ORM + SQLite (ไฟล์ dev.db, ไม่ใช้ DB server แยก)
- Tailwind CSS + shadcn/ui
- ไม่ต้องทำ authentication ในรอบแรก (ใช้ session แบบง่าย หรือไม่ผูก user ก็ได้ — เน้น core
  feature ก่อน เก็บ auth ไว้ทำใน phase ถัดไป)

## ภาพรวมระบบ
นักศึกษาอัปโหลดไฟล์ transcript (รูปภาพหรือ PDF) → ระบบเรียก LLM API (Anthropic Claude) เพื่อ OCR/
แยกรายวิชาที่ลงทะเบียนพร้อมเกรดออกมาเป็นข้อมูลโครงสร้าง → ระบบเทียบรายวิชาที่อ่านได้กับโครงสร้างหลักสูตร
แล้วแสดงผล: วิชาที่เรียนผ่านแล้ว, วิชาที่กำลังเรียน (เกรดยังไม่ออก/ระบุว่า "กำลังศึกษา"), วิชาที่ยังไม่ได้เรียน,
และสรุปหน่วยกิตแต่ละหมวดเทียบกับเกณฑ์ที่ต้องการ

## โครงสร้างข้อมูลหลักสูตร (สำคัญมาก — seed จากไฟล์จริง)
อ่านไฟล์ `./data/curriculum_seed.json` ที่มีอยู่แล้วในโปรเจกต์ (โครงสร้าง: { categories, courses, studyPlan })
แล้วเขียน Prisma schema และ seed script ให้ตรงกับข้อมูลนี้ทั้งหมด ห้ามแต่งข้อมูลรายวิชาขึ้นมาเอง
ให้ใช้ข้อมูลจากไฟล์นี้เป็นแหล่งเดียว (single source of truth)

### Prisma schema (ปรับ field ตามที่เห็นสมควรแต่ต้องครอบคลุมสิ่งเหล่านี้)

1. **Category** — หมวดหมู่วิชา (จาก categories ใน seed)
   - id (string, primary key, เช่น "SPEC_CORE")
   - nameTh, nameEn
   - parentId (self-relation, nullable — มี nested category เช่น MAJORELEC_1..7 อยู่ใต้ SPEC_MAJORELEC)
   - requiredCredits (nullable — บาง category ไม่มีเกณฑ์หน่วยกิตของตัวเอง เพราะเป็นแค่กลุ่มย่อยให้เลือก)

2. **Course** — รายวิชา (จาก courses ใน seed)
   - code (string, primary key, รูปแบบ 8 หลัก เช่น "01236255" — เก็บเป็น string เสมอ ห้ามแปลงเป็น
     number เด็ดขาด เพราะจะเสีย leading zero)
   - nameTh, nameEn
   - credits, lectureHours, labHours, selfStudyHours (int)
   - categoryId (FK -> Category)
   - courseType (enum หรือ string: required, mandatory_elective, elective, lab, project, ge, free_elective)
   - note (string, nullable)
   - prerequisites (เก็บเป็น JSON array ของ course code string ในฟิลด์เดียว เนื่องจาก SQLite ไม่มี
     native array — ปัจจุบันใน seed เป็น array ว่างทั้งหมด เตรียม field ไว้ใช้ในอนาคต)

3. **StudyPlanEntry** — แผนการศึกษารายปี/เทอม (จาก studyPlan ใน seed)
   - id (autoincrement)
   - year (int 1-4), semester (int 1-3, semester 3 = ภาคฤดูร้อน)
   - courseCode (string — อาจเป็น placeholder เช่น "01xxxxxx", "90xxxxxx", "0123xxxx", "xxxxxxxx"
     ซึ่งไม่ตรงกับ Course.code ใดๆ จริง ห้ามตั้งเป็น FK บังคับ ต้องเป็น string เปล่าๆ)
   - label (ชื่อวิชา/คำอธิบายที่แสดงในแผน)
   - credits (float, nullable)
   - note (string, nullable)
   - isPlaceholder (boolean — true ถ้า courseCode เป็นรหัส placeholder ที่ต้องให้ผู้ใช้เลือกวิชาเองจาก
     หมวดหมู่ที่เกี่ยวข้อง)

4. **Student** (โครงร่างเบื้องต้น เผื่อทำ auth ต่อใน phase หน้า)
   - id, name (nullable), studentCode (nullable), createdAt

5. **TranscriptUpload**
   - id, studentId (FK -> Student, nullable ได้ถ้ายังไม่มี auth)
   - fileName, uploadedAt
   - rawLlmResponse (text — เก็บ JSON ที่ LLM ตอบกลับมาทั้งดิบ ไว้ debug/ตรวจสอบย้อนหลัง)
   - status (enum: processing, completed, failed)

6. **TranscriptEntry** — ผลลัพธ์ที่ parse ได้จาก transcript แต่ละวิชา
   - id, uploadId (FK -> TranscriptUpload)
   - courseCode (string — ผลจับคู่กับ Course.code ถ้าจับคู่ได้)
   - courseCodeRaw (string — รหัสวิชาดิบที่ OCR อ่านได้ ก่อน normalize/จับคู่ เก็บไว้เทียบ debug)
   - courseNameRaw (string)
   - grade (string, nullable — เช่น "A", "B+", "W", "I", null ถ้ายังไม่มีเกรด)
   - semesterLabel (string, nullable — เช่น "1/2566" ถ้า OCR อ่านได้)
   - status (enum: completed, in_progress, withdrawn, failed_grade — อนุมานจาก grade: ถ้า grade
     เป็น F ให้ status = failed_grade [ต้องเรียนใหม่], ถ้า grade เป็น W ให้เป็น withdrawn, ถ้าไม่มี grade
     เลยและอยู่ในเทอมล่าสุดให้เป็น in_progress, อื่นๆ เป็น completed)
   - matchConfidence (float, nullable — ความมั่นใจในการจับคู่กับ Course.code, 0-1)
   - matchedCourseId (FK -> Course, nullable — null ถ้าจับคู่ไม่ได้)

## Flow การทำงานหลัก

### 1. หน้าอัปโหลด (/upload)
- มี dropzone สำหรับอัปโหลดไฟล์ (รับ .pdf, .jpg, .jpeg, .png) ใช้ shadcn/ui components
- แสดง preview ไฟล์ที่เลือกก่อน submit
- หลัง submit: เรียก API route /api/transcript/upload

### 2. API Route: POST /api/transcript/upload
- รับไฟล์ที่อัปโหลด แปลงเป็น base64
- เรียก Anthropic API (https://api.anthropic.com/v1/messages) ด้วย model "claude-sonnet-4-6"
  ส่งไฟล์เป็น content block แบบ document (PDF) หรือ image (รูปภาพ) ตามชนิดไฟล์
- เขียน system prompt ให้ LLM extract ข้อมูลออกมาเป็น JSON array ของรายวิชาที่พบใน transcript เท่านั้น
  (ไม่มี markdown, ไม่มี preamble) โดยแต่ละ item มี: courseCode (รหัสวิชาที่อ่านได้ ดิบๆ), courseName,
  credits (ถ้าอ่านได้), grade (null ถ้าไม่มี/กำลังเรียน), semesterLabel (ถ้าอ่านได้)
- parse JSON response (ดัก fence ```json ถ้ามี ก่อน parse)
- สร้าง TranscriptUpload record + TranscriptEntry records ทุกแถว
- ทำการ "จับคู่" (matching) courseCode ดิบกับ Course.code ในฐานข้อมูล:
  - จับคู่ตรงตัวก่อน (exact match บนรหัส 8 หลัก)
  - ถ้าไม่ตรง ให้ลอง normalize (เอาเฉพาะตัวเลข, ตัด whitespace, เทียบกับ Course.code ที่ลบ
    leading zero ออกทั้งสองฝั่งก่อนเทียบ เผื่อ OCR อ่านเลข 0 ตัวแรกตกหรือเกิน)
  - ถ้ายังไม่เจอ ให้ลองจับคู่จากชื่อวิชา (คล้ายกันแบบ fuzzy/substring เทียบ nameTh/nameEn) เป็น
    fallback และตั้ง matchConfidence ต่ำกว่าการจับคู่ด้วยรหัส
  - บันทึก matchConfidence ตามวิธีที่ใช้จับคู่สำเร็จ (รหัสตรง = 1.0, รหัส normalize = 0.8,
    ชื่อ fuzzy = 0.5 หรือต่ำกว่า)
- คืนค่า uploadId กลับไปให้ frontend เพื่อ redirect ไปหน้าผลลัพธ์

### 3. หน้าผลลัพธ์ (/results/[uploadId])
แสดงผล 3 ส่วนหลัก:

**ก. สรุปหน่วยกิตรายหมวด (Progress overview)**
- แสดงเป็น progress bar หรือ card ต่อหมวดหมู่ระดับบนสุด (GE, SPEC, FREE) และหมวดย่อย
  (GE_BASE, SPEC_MATHSCI, SPEC_CORE, ฯลฯ)
- แต่ละหมวดแสดง: หน่วยกิตที่ "เรียนผ่านแล้ว" (status=completed) / หน่วยกิตที่ "กำลังเรียน"
  (status=in_progress) / หน่วยกิตที่ต้องการ (requiredCredits) — แสดงเป็น "X / Y หน่วยกิต"
- รวมหน่วยกิตทั้งหมดเทียบกับ 135 หน่วยกิตที่ต้องจบ
- ถ้าหมวดไหนมี requiredCredits เป็น null (เช่นหมวดย่อยของ MAJORELEC ที่ไม่มีเกณฑ์ตายตัว
  เฉพาะตัวเอง) ให้ไม่ต้องแสดง progress bar ของหมวดนั้น แต่ยังคงรวมหน่วยกิตขึ้นไปที่หมวดแม่ (parentId)

**ข. ตารางรายวิชา 3 สถานะ แยก tab หรือ filter**
- Tab "เรียนแล้ว" (completed): ตารางรหัสวิชา, ชื่อวิชา, หน่วยกิต, เกรด, หมวดหมู่
- Tab "กำลังเรียน" (in_progress): เหมือนกันแต่ไม่มีเกรด
- Tab "ยังไม่ได้เรียน" (not_taken): คำนวณจาก Course ทั้งหมดในหลักสูตร ลบรายวิชาที่มีอยู่ใน
  completed/in_progress ของ upload นั้น — แยกตาม courseType (required ก่อน ตามด้วย
  mandatory_elective, elective) และเรียงตามแผนการศึกษา (studyPlan) ว่าอยู่ปี/เทอมไหน
- ถ้ามีวิชาที่ grade=F (failed_grade) ให้ไฮไลต์เป็นสีแดงและขึ้นเตือนว่าต้องลงทะเบียนใหม่
  (และไม่นับหน่วยกิตของวิชานั้นเป็น completed)

**ค. รายการที่ต้องตรวจสอบ (Needs review)**
- แสดงรายวิชาที่ matchConfidence ต่ำ (<0.8) หรือจับคู่ไม่ได้เลย (matchedCourseId = null)
  พร้อมให้ผู้ใช้กดเลือกจับคู่กับ Course ที่ถูกต้องด้วยตนเองผ่าน dropdown/combobox (shadcn Command/
  Popover) — เมื่อเลือกแล้วให้ PATCH ไปอัปเดต TranscriptEntry ผ่าน API route /api/transcript/
  entry/[id] แล้ว re-render สรุปหน่วยกิตใหม่

### 4. หน้าแผนการศึกษา (/study-plan)
- แสดงแผนการศึกษา 4 ปี (จาก studyPlan ใน seed) เป็นตารางหรือ timeline แยกตามปี/เทอม
- ถ้ามี uploadId ใน query param ให้ไฮไลต์รายวิชาที่เรียนผ่านแล้ว (เขียว), กำลังเรียน (เหลือง),
  ยังไม่เรียน (เทา) ทับบนแผนเดิม
- แถวที่เป็น placeholder (isPlaceholder=true) ให้แสดง badge "เลือกได้" พร้อม tooltip บอก note
  (เช่น "เลือกจาก SPEC_MANDELEC") แทนชื่อวิชาตายตัว

## UI/Design
- ใช้ shadcn/ui components: Card, Tabs, Progress, Table, Badge, Dialog, Command/Popover (สำหรับ
  manual matching), Toast (สำหรับแจ้งผล upload สำเร็จ/ล้มเหลว)
- ใช้ภาษาไทยเป็นหลักในการแสดงผล UI (ชื่อหมวดหมู่, label, ปุ่ม) แต่โค้ด/variable name เป็นภาษาอังกฤษ
- Responsive: ใช้งานได้ดีทั้ง desktop และ mobile (นักศึกษาอาจอัปโหลดรูปจากมือถือ)
- ใช้ skeleton loading ระหว่างรอผล OCR (อาจใช้เวลาหลายวินาที) พร้อมข้อความบอกสถานะ

## Error handling ที่ต้องมี
- ถ้า LLM ตอบกลับมาไม่ใช่ JSON ที่ parse ได้ ให้เก็บ status=failed พร้อม error message ที่ชัดเจน
  และยังคง rawLlmResponse ไว้ดู ไม่ throw error ที่ทำให้หน้าเว็บพังทั้งหน้า
- จำกัดขนาดไฟล์อัปโหลด (เช่น ไม่เกิน 10MB) และตรวจชนิดไฟล์ฝั่ง client ก่อนส่ง รวมถึง validate
  อีกชั้นฝั่ง server
- ใส่ environment variable ANTHROPIC_API_KEY ผ่าน .env (อย่า hardcode key ในโค้ด) และสร้าง
  .env.example ไว้เป็นตัวอย่าง

## ขั้นตอนการทำงาน
1. สร้างโปรเจกต์ Next.js + ติดตั้ง dependencies ทั้งหมด (prisma, @prisma/client, shadcn/ui ที่จำเป็น)
2. เขียน Prisma schema ตามที่ระบุ แล้ว generate + migrate
3. เขียน seed script (prisma/seed.ts) ที่อ่าน ./data/curriculum_seed.json แล้ว insert เข้า
   Category, Course, StudyPlanEntry ตามลำดับ (Category ก่อน เพราะ Course อ้าง FK กลับไป และต้อง
   insert Category ที่ parentId เป็น null ก่อนตัวที่มี parentId อ้างถึงมัน)
4. รัน seed แล้วตรวจสอบด้วย Prisma Studio หรือ query ตรวจนับแถวว่าตรงกับไฟล์ JSON (23 categories,
   113 courses, 51 study plan entries)
5. สร้าง API route อัปโหลด + เรียก Anthropic API + matching logic
6. สร้างหน้า /upload, /results/[uploadId], /study-plan ตามที่ระบุ
7. ทดสอบ flow ทั้งหมดด้วยภาพ transcript ตัวอย่าง (ถ้าไม่มีไฟล์ตัวอย่าง ให้ mock LLM response
   ก่อนเพื่อทดสอบ UI ส่วนแสดงผล แล้วค่อยต่อ API จริง)
8. สรุปรายงานท้ายงาน: ไฟล์ที่สร้าง, คำสั่งที่ต้องรันเพื่อ setup (npm install, prisma migrate,
   prisma db seed, npm run dev), และสิ่งที่ยังไม่ได้ทำ/ควรทำต่อ (เช่น auth, การจับคู่ courseCode
   ที่แม่นยำขึ้น, รองรับหลายหลักสูตร)

ทำตามลำดับนี้ทีละขั้น และรายงานความคืบหน้าเป็นระยะ ห้ามสรุปว่าทำเสร็จถ้ายังไม่ได้รันและตรวจสอบจริง
```

---

## หมายเหตุการใช้งานพรอมป์นี้

- **ก่อนรัน**: ต้องมีไฟล์ `curriculum_seed.json` (แปลงจาก Excel ที่สร้างไว้ก่อนหน้า) อยู่ที่ `./data/curriculum_seed.json` ในโฟลเดอร์โปรเจกต์ก่อนเริ่ม
- **API Key**: ต้องมี `ANTHROPIC_API_KEY` พร้อมใช้ — Claude Code จะสร้าง `.env.example` ให้ แต่ค่าจริงต้องเติมเอง
- **scope รอบแรก**: พรอมป์นี้ตัด authentication ออกเพื่อให้ Claude Code โฟกัส core matching/reporting logic ก่อน ถ้าต้องการเพิ่ม auth (เช่น NextAuth ผูกกับ Google/KMITL email) แจ้งเป็นรอบถัดไปได้
- **จุดที่ควรตรวจเองหลัง Claude Code ทำเสร็จ**: ตรวจ matching logic กับ transcript จริงสักใบ เพราะรูปแบบรหัสวิชาที่ OCR อ่านได้อาจมี edge case ที่ prompt ทำนายไว้ไม่ครอบคลุมทั้งหมด (เช่น รหัสวิชาที่ติดกันแบบไม่มีเว้นวรรคกับชื่อวิชา)
