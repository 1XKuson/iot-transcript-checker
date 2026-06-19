import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { stringSimilarity } from "string-similarity-js"
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

function deriveStatus(grade: string | null): string {
  if (grade === "F") return "failed_grade"
  if (grade === "W") return "withdrawn"
  if (grade === null || grade === "") return "in_progress"
  return "completed"
}

function normalizeCode(code: string): string {
  return code.replace(/\D/g, "").padStart(8, "0")
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    const text = result.text
    return text
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

    await processEntries(upload.id, parsedEntries)

    await prisma.transcriptUpload.update({
      where: { id: upload.id },
      data: { status: "completed", rawLlmResponse: rawText },
    })

    return Response.json({ uploadId: upload.id })
  } catch (error) {
    console.error("Upload error:", error)
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    )
  }
}

async function processEntries(uploadId: string, entries: CourseEntry[]) {
  const allCourses = await prisma.course.findMany()

  for (const entry of entries) {
    const rawCode = (entry.courseCode ?? "").toString().trim()
    const rawName = (entry.courseName ?? "").trim()
    const grade = entry.grade?.trim() || null
    const status = deriveStatus(grade)

    let matchedCourseId: string | null = null
    let matchConfidence: number | null = null

    const exactMatch = allCourses.find((c) => c.code === rawCode)
    if (exactMatch) {
      matchedCourseId = exactMatch.code
      matchConfidence = 1.0
    }

    if (!matchedCourseId && rawCode) {
      const normalizedRaw = normalizeCode(rawCode)
      const normalizedMatch = allCourses.find(
        (c) => normalizeCode(c.code) === normalizedRaw
      )
      if (normalizedMatch) {
        matchedCourseId = normalizedMatch.code
        matchConfidence = 0.8
      }
    }

    if (!matchedCourseId && rawName) {
      let bestScore = 0
      let bestCourse = null
      for (const course of allCourses) {
        const scoreTh = stringSimilarity(rawName, course.nameTh)
        const scoreEn = stringSimilarity(rawName, course.nameEn)
        const score = Math.max(scoreTh, scoreEn)
        if (score > bestScore) {
          bestScore = score
          bestCourse = course
        }
      }
      if (bestCourse && bestScore > 0.3) {
        matchedCourseId = bestCourse.code
        matchConfidence = bestScore * 0.6
      }
    }

    await prisma.transcriptEntry.create({
      data: {
        uploadId,
        courseCode: rawCode || null,
        courseCodeRaw: rawCode,
        courseNameRaw: rawName,
        grade,
        semesterLabel: entry.semesterLabel || null,
        status,
        matchedCourseId,
        matchConfidence,
      },
    })
  }
}
