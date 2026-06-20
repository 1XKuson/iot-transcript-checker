import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { matchAndUpdateEntries } from "@/lib/matchEntries"

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/transcript/[uploadId]/confirm">
) {
  try {
    const { uploadId } = await ctx.params

    const upload = await prisma.transcriptUpload.findUnique({
      where: { id: uploadId },
    })

    if (!upload) {
      return Response.json({ error: "ไม่พบข้อมูลการอัปโหลด" }, { status: 404 })
    }

    if (upload.status !== "pending_review") {
      return Response.json(
        { error: "สถานะไม่ถูกต้องสำหรับการยืนยัน" },
        { status: 409 }
      )
    }

    interface EntryEdit {
      courseCodeRaw?: string
      courseNameRaw?: string
      grade?: string | null
      semesterLabel?: string | null
    }

    const body = await request.json() as { keepIds?: unknown; edits?: unknown }
    const { keepIds, edits } = body

    if (!Array.isArray(keepIds) || keepIds.some((id) => typeof id !== "string")) {
      return Response.json(
        { error: "keepIds ต้องเป็น array ของ string" },
        { status: 400 }
      )
    }

    const validKeepIds = keepIds as string[]
    const validEdits = (edits && typeof edits === "object" && !Array.isArray(edits))
      ? edits as Record<string, EntryEdit>
      : {}

    // Delete entries the user deselected
    await prisma.transcriptEntry.deleteMany({
      where: { uploadId, id: { notIn: validKeepIds } },
    })

    // Apply user edits to remaining entries
    for (const [entryId, entryEdit] of Object.entries(validEdits)) {
      if (!validKeepIds.includes(entryId)) continue
      await prisma.transcriptEntry.update({
        where: { id: entryId },
        data: {
          ...(entryEdit.courseCodeRaw !== undefined && { courseCodeRaw: entryEdit.courseCodeRaw, courseCode: entryEdit.courseCodeRaw || null }),
          ...(entryEdit.courseNameRaw !== undefined && { courseNameRaw: entryEdit.courseNameRaw }),
          ...(entryEdit.grade !== undefined && { grade: entryEdit.grade }),
          ...(entryEdit.semesterLabel !== undefined && { semesterLabel: entryEdit.semesterLabel }),
        },
      })
    }

    // Run course matching on remaining (edited) entries
    await matchAndUpdateEntries(uploadId)

    await prisma.transcriptUpload.update({
      where: { id: uploadId },
      data: { status: "completed" },
    })

    return Response.json({ uploadId })
  } catch (error) {
    console.error("Confirm error:", error)
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    )
  }
}
