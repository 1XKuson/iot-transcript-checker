import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import Tesseract from "tesseract.js"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"]
const GRADES = new Set(["A", "B+", "B", "C+", "C", "D+", "D", "F", "W", "S", "U", "I", "P", "IP"])

interface CourseEntry {
  courseCode: string
  courseName: string
  credits: number | null
  grade: string | null
  semesterLabel: string | null
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    return result.text
  }

  const worker = await Tesseract.createWorker("tha+eng")
  try {
    const { data } = await worker.recognize(buffer)
    return data.text
  } finally {
    await worker.terminate()
  }
}

function parseTranscriptText(text: string): CourseEntry[] {
  const entries: CourseEntry[] = []
  const normalized = text.replace(/\r\n/g, "\n")

  const codeMatches = [...normalized.matchAll(/\b(\d{7,8})\b/g)]

  for (let i = 0; i < codeMatches.length; i++) {
    const codeMatch = codeMatches[i]
    const code = codeMatch[1]
    const startIdx = codeMatch.index! + code.length
    const endIdx = codeMatches[i + 1]?.index ?? normalized.length

    const tokens = normalized
      .slice(startIdx, endIdx)
      .trim()
      .split(/\s+/)
      .filter(Boolean)

    const remaining = [...tokens]
    let grade: string | null = null
    let credits: number | null = null
    let semesterLabel: string | null = null

    // Extract semester (e.g. "1/2565")
    const semIdx = remaining.findIndex((t) => /^\d\/\d{4}$/.test(t))
    if (semIdx !== -1) {
      semesterLabel = remaining.splice(semIdx, 1)[0]
    }

    // Extract grade — last token from right that matches
    for (let j = remaining.length - 1; j >= 0; j--) {
      if (GRADES.has(remaining[j])) {
        grade = remaining.splice(j, 1)[0]
        break
      }
    }

    // Extract credits — last numeric token from right in range 1–9
    for (let j = remaining.length - 1; j >= 0; j--) {
      const num = parseFloat(remaining[j])
      if (!isNaN(num) && num >= 1 && num <= 9 && /^\d+(?:\.\d+)?$/.test(remaining[j])) {
        credits = num
        remaining.splice(j, 1)
        break
      }
    }

    entries.push({
      courseCode: code,
      courseName: remaining.join(" ").trim(),
      credits,
      grade,
      semesterLabel,
    })
  }

  return entries
}

export interface RawEntry {
  id: string
  courseCodeRaw: string
  courseNameRaw: string
  grade: string | null
  credits: number | null
  semesterLabel: string | null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return Response.json({ error: "ไม่พบไฟล์" }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)" },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: "รองรับเฉพาะไฟล์ PDF, JPG, และ PNG เท่านั้น" },
        { status: 400 }
      )
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return Response.json({ error: "นามสกุลไฟล์ไม่ถูกต้อง" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    let student = await prisma.student.findFirst({ where: { name: "anonymous" } })
    if (!student) {
      student = await prisma.student.create({ data: { name: "anonymous" } })
    }

    const upload = await prisma.transcriptUpload.create({
      data: { studentId: student.id, fileName: file.name, status: "processing" },
    })

    let rawText: string
    try {
      rawText = await extractText(buffer, file.type)
    } catch (err) {
      console.error("OCR error:", err)
      await prisma.transcriptUpload.update({
        where: { id: upload.id },
        data: { status: "failed" },
      })
      return Response.json(
        { error: "ไม่สามารถอ่านเอกสารได้ กรุณาลองใหม่อีกครั้ง" },
        { status: 500 }
      )
    }

    if (!rawText.trim()) {
      await prisma.transcriptUpload.update({
        where: { id: upload.id },
        data: { status: "failed", rawLlmResponse: rawText },
      })
      return Response.json(
        { error: "ไม่พบข้อความในเอกสาร กรุณาลองใหม่อีกครั้ง" },
        { status: 422 }
      )
    }

    const parsedEntries = parseTranscriptText(rawText)

    if (parsedEntries.length === 0) {
      await prisma.transcriptUpload.update({
        where: { id: upload.id },
        data: { status: "failed", rawLlmResponse: rawText },
      })
      return Response.json(
        { error: "ไม่พบรายวิชาในเอกสาร กรุณาตรวจสอบไฟล์แล้วลองใหม่อีกครั้ง" },
        { status: 422 }
      )
    }

    // Create entries with pending_review status — no matching yet
    const createdEntries = await Promise.all(
      parsedEntries.map((entry) =>
        prisma.transcriptEntry.create({
          data: {
            uploadId: upload.id,
            courseCode: null,
            courseCodeRaw: (entry.courseCode ?? "").trim(),
            courseNameRaw: (entry.courseName ?? "").trim(),
            grade: entry.grade?.trim() ?? null,
            semesterLabel: entry.semesterLabel ?? null,
            status: "pending_review",
            matchedCourseId: null,
            matchConfidence: null,
          },
        })
      )
    )

    await prisma.transcriptUpload.update({
      where: { id: upload.id },
      data: { status: "pending_review", rawLlmResponse: rawText },
    })

    const entries: RawEntry[] = createdEntries.map((e) => ({
      id: e.id,
      courseCodeRaw: e.courseCodeRaw,
      courseNameRaw: e.courseNameRaw,
      grade: e.grade,
      credits: parsedEntries.find((p) => p.courseCode === e.courseCodeRaw)?.credits ?? null,
      semesterLabel: e.semesterLabel,
    }))

    return Response.json({ uploadId: upload.id, entries })
  } catch (error) {
    console.error("Upload error:", error)
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    )
  }
}
