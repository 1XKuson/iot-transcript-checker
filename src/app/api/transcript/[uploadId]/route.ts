import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/transcript/[uploadId]">
) {
  try {
    const { uploadId } = await ctx.params

    const upload = await prisma.transcriptUpload.findUnique({
      where: { id: uploadId },
      include: {
        entries: {
          include: {
            matchedCourse: {
              include: { category: true },
            },
          },
        },
      },
    })

    if (!upload) {
      return Response.json(
        { error: "ไม่พบข้อมูล" },
        { status: 404 }
      )
    }

    const allCourses = await prisma.course.findMany({
      include: { category: true },
    })

    return Response.json({ upload, allCourses })
  } catch (error) {
    console.error("GET upload error:", error)
    return Response.json(
      { error: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" },
      { status: 500 }
    )
  }
}
