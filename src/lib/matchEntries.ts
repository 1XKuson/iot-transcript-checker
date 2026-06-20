import { prisma } from "@/lib/prisma"
import { stringSimilarity } from "string-similarity-js"

function deriveStatus(grade: string | null): string {
  if (grade === "F") return "failed_grade"
  if (grade === "W") return "withdrawn"
  if (grade === null || grade === "") return "in_progress"
  return "completed"
}

function normalizeCode(code: string): string {
  return code.replace(/\D/g, "").padStart(8, "0")
}

export async function matchAndUpdateEntries(uploadId: string): Promise<void> {
  const allCourses = await prisma.course.findMany()
  const entries = await prisma.transcriptEntry.findMany({ where: { uploadId } })

  for (const entry of entries) {
    const rawCode = (entry.courseCodeRaw ?? "").trim()
    const rawName = (entry.courseNameRaw ?? "").trim()
    const grade = entry.grade?.trim() ?? null
    const status = deriveStatus(grade)

    let matchedCourseId: string | null = null
    let matchConfidence: number | null = null

    // 1. Exact code match
    const exactMatch = allCourses.find((c) => c.code === rawCode)
    if (exactMatch) {
      matchedCourseId = exactMatch.code
      matchConfidence = 1.0
    }

    // 2. Normalized code match
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

    // 3. Fuzzy name match
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

    await prisma.transcriptEntry.update({
      where: { id: entry.id },
      data: {
        courseCode: rawCode || null,
        matchedCourseId,
        matchConfidence,
        status,
      },
    })
  }
}
