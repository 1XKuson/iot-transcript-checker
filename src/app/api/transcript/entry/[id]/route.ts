import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/transcript/entry/[id]">
) {
  try {
    const { id } = await ctx.params
    const body = await request.json()
    const { matchedCourseId } = body

    if (!matchedCourseId || typeof matchedCourseId !== "string") {
      return Response.json(
        { error: "matchedCourseId is required" },
        { status: 400 }
      )
    }

    // Validate course exists
    const course = await prisma.course.findUnique({
      where: { code: matchedCourseId },
    })

    if (!course) {
      return Response.json(
        { error: "ไม่พบวิชาในระบบ" },
        { status: 404 }
      )
    }

    const updated = await prisma.transcriptEntry.update({
      where: { id },
      data: {
        matchedCourseId,
        matchConfidence: 1.0,
      },
      include: {
        matchedCourse: {
          include: { category: true },
        },
      },
    })

    return Response.json(updated)
  } catch (error) {
    console.error("PATCH entry error:", error)
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    )
  }
}
