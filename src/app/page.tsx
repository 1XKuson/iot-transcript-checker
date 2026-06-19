import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-20">
      <div className="flex flex-col items-center text-center gap-6">
        <h1 className="text-4xl font-bold tracking-tight">
          IoT Transcript Checker
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          ระบบตรวจสอบใบแสดงผลการเรียนสำหรับนักศึกษาหลักสูตรวิศวกรรมระบบไอโอทีและสารสนเทศ
          ตรวจสอบหน่วยกิตที่เรียนแล้วและยังขาดอยู่อย่างรวดเร็ว
        </p>
        <div className="flex gap-4 mt-4">
          <Link href="/upload">
            <Button size="lg">อัปโหลด Transcript</Button>
          </Link>
          <Link href="/study-plan">
            <Button variant="outline" size="lg">
              ดูแผนการศึกษา
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12 w-full text-left">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">1. อัปโหลด Transcript</h3>
            <p className="text-sm text-muted-foreground">
              อัปโหลดไฟล์ PDF หรือรูปภาพของ Transcript จากระบบของมหาวิทยาลัย
            </p>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">2. AI วิเคราะห์</h3>
            <p className="text-sm text-muted-foreground">
              ระบบ AI จะอ่านและแยกข้อมูลรายวิชาและเกรดออกจาก Transcript โดยอัตโนมัติ
            </p>
          </div>
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">3. ดูผลลัพธ์</h3>
            <p className="text-sm text-muted-foreground">
              ตรวจสอบความก้าวหน้า หน่วยกิตที่เรียนแล้ว และวิชาที่ยังไม่ได้เรียน
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
