import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { stringSimilarity } from "string-similarity-js"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"]

interface LlmCourseEntry {
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
  // Strip all non-digit chars, then pad back to 8 digits
  return code.replace(/\D/g, "").padStart(8, "0")
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return Response.json({ error: "ไม่พบไฟล์" }, { status: 400 })
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)" },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: "รองรับเฉพาะไฟล์ PDF, JPG, และ PNG เท่านั้น" },
        { status: 400 }
      )
    }

    // Validate extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return Response.json(
        { error: "นามสกุลไฟล์ไม่ถูกต้อง" },
        { status: 400 }
      )
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")

    // Create student (anonymous shared)
    let student = await prisma.student.findFirst({
      where: { name: "anonymous" },
    })
    if (!student) {
      student = await prisma.student.create({
        data: { name: "anonymous" },
      })
    }

    // Create upload record
    const upload = await prisma.transcriptUpload.create({
      data: {
        studentId: student.id,
        fileName: file.name,
        status: "processing",
      },
    })

    // Call Gemini API
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === "your-api-key-here") {
      // Return mock data for UI testing
      const mockEntries: LlmCourseEntry[] = [
        {
          courseCode: "01006030",
          courseName: "แคลคูลัส 1",
          credits: 3,
          grade: "A",
          semesterLabel: "1/2565",
        },
        {
          courseCode: "01006012",
          courseName: "การเขียนโปรแกรมคอมพิวเตอร์",
          credits: 3,
          grade: "B+",
          semesterLabel: "1/2565",
        },
        {
          courseCode: "01006020",
          courseName: "ฟิสิกส์ทั่วไป 1",
          credits: 3,
          grade: "B",
          semesterLabel: "1/2565",
        },
        {
          courseCode: "01236255",
          courseName: "พื้นฐานระบบไอโอที",
          credits: 3,
          grade: "A",
          semesterLabel: "1/2565",
        },
        {
          courseCode: "90642118",
          courseName: "โปรแกรมคอมพิวเตอร์ประยุกต์ทางธุรกิจ",
          credits: 2,
          grade: "B",
          semesterLabel: "1/2565",
        },
        {
          courseCode: "01236254",
          courseName: "วงจรไฟฟ้าและอิเล็กทรอนิกส์",
          credits: 3,
          grade: "C+",
          semesterLabel: "1/2565",
        },
        {
          courseCode: "01236257",
          courseName: "การเขียนโปรแกรมเชิงวัตถุ",
          credits: 3,
          grade: null,
          semesterLabel: "2/2566",
        },
      ]

      await processEntries(upload.id, mockEntries)

      await prisma.transcriptUpload.update({
        where: { id: upload.id },
        data: { status: "completed", rawLlmResponse: "MOCK_DATA" },
      })

      return Response.json({ uploadId: upload.id })
    }

    // Determine inline_data mime type
    const mimeType =
      file.type === "application/pdf"
        ? "application/pdf"
        : file.type === "image/png"
        ? "image/png"
        : "image/jpeg"

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: 'You are an OCR assistant. Extract all courses from this Thai university transcript and return ONLY a JSON array (no markdown, no explanation). Each item: { courseCode: string, courseName: string, credits: number|null, grade: string|null, semesterLabel: string|null }. courseCode is the 8-digit Thai university course code.',
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  inline_data: { mime_type: mimeType, data: base64 },
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 4096 },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      await prisma.transcriptUpload.update({
        where: { id: upload.id },
        data: { status: "failed", rawLlmResponse: errText },
      })
      return Response.json(
        { error: `Gemini API error: ${geminiResponse.status}` },
        { status: 502 }
      )
    }

    const geminiData = await geminiResponse.json()
    const rawLlmResponse =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ??
      JSON.stringify(geminiData)

    // Parse JSON response
    let parsedEntries: LlmCourseEntry[]
    try {
      // Strip markdown fences if present
      let jsonText = rawLlmResponse.trim()
      jsonText = jsonText.replace(/^```json\s*/i, "").replace(/\s*```$/, "")
      parsedEntries = JSON.parse(jsonText)
    } catch (parseError) {
      await prisma.transcriptUpload.update({
        where: { id: upload.id },
        data: { status: "failed", rawLlmResponse },
      })
      return Response.json(
        {
          error: "ไม่สามารถแปลงผลลัพธ์จาก AI ได้ กรุณาลองใหม่อีกครั้ง",
          rawLlmResponse,
        },
        { status: 422 }
      )
    }

    await processEntries(upload.id, parsedEntries)

    await prisma.transcriptUpload.update({
      where: { id: upload.id },
      data: { status: "completed", rawLlmResponse },
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

async function processEntries(uploadId: string, entries: LlmCourseEntry[]) {
  // Load all courses for matching
  const allCourses = await prisma.course.findMany()

  for (const entry of entries) {
    const rawCode = (entry.courseCode ?? "").toString().trim()
    const rawName = (entry.courseName ?? "").trim()
    const grade = entry.grade?.trim() || null
    const status = deriveStatus(grade)

    // Matching logic
    let matchedCourseId: string | null = null
    let matchConfidence: number | null = null

    // 1. Exact match
    const exactMatch = allCourses.find((c) => c.code === rawCode)
    if (exactMatch) {
      matchedCourseId = exactMatch.code
      matchConfidence = 1.0
    }

    // 2. Normalize match (strip non-digits, pad to 8)
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

    // 3. Name fuzzy match
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
