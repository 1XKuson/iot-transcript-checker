import { prisma } from "@/lib/prisma"
import { StudyPlanCard } from "@/components/StudyPlanCard"

type SearchParams = Promise<{ uploadId?: string }>
type CourseStatus = "completed" | "in_progress" | "failed_grade" | "not_taken"

const semesterLabels: Record<number, string> = {
  1: "ภาคเรียนที่ 1",
  2: "ภาคเรียนที่ 2",
  3: "ภาคฤดูร้อน",
}

export default async function StudyPlanPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { uploadId } = await searchParams

  const studyPlan = await prisma.studyPlanEntry.findMany({
    orderBy: [{ year: "asc" }, { semester: "asc" }],
  })

  // Load transcript entries if uploadId provided
  const matchedMap: Record<string, CourseStatus> = {}
  if (uploadId) {
    const upload = await prisma.transcriptUpload.findUnique({
      where: { id: uploadId },
      include: { entries: true },
    })
    if (upload) {
      for (const entry of upload.entries) {
        if (entry.matchedCourseId) {
          matchedMap[entry.matchedCourseId] = entry.status as CourseStatus
        }
      }
    }
  }

  // Group by year and semester
  type PlanEntry = (typeof studyPlan)[number]
  const grouped: Record<number, Record<number, PlanEntry[]>> = {}
  for (const entry of studyPlan) {
    if (!grouped[entry.year]) grouped[entry.year] = {}
    if (!grouped[entry.year][entry.semester]) grouped[entry.year][entry.semester] = []
    grouped[entry.year][entry.semester].push(entry)
  }

  const years = [1, 2, 3, 4]
  const allSemesters = Array.from(new Set(studyPlan.map((e) => e.semester))).sort()

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">แผนการศึกษา</h1>
        <p className="text-sm text-muted-foreground mt-1">
          แผนการเรียนตลอดหลักสูตรวิศวกรรมระบบไอโอทีและสารสนเทศ
          {uploadId && " — แสดงสถานะตาม Transcript ที่อัปโหลด"}
        </p>
        {uploadId && (
          <div className="flex gap-4 mt-3 text-xs flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-green-400 inline-block" />
              ผ่านแล้ว
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-yellow-400 inline-block" />
              กำลังเรียน
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-red-400 inline-block" />
              ต้องเรียนซ้ำ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-gray-300 inline-block dark:bg-gray-600" />
              ยังไม่ได้เรียน
            </span>
          </div>
        )}
      </div>

      {allSemesters.map((semester) => (
        <div key={semester} className="mb-10">
          <h2 className="text-base font-semibold mb-4 text-muted-foreground">
            {semesterLabels[semester] ?? `ภาคเรียน ${semester}`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {years.map((year) => {
              const entries = grouped[year]?.[semester] ?? []
              if (entries.length === 0) {
                return (
                  <div key={year} className="min-h-[60px]">
                    <h3 className="text-sm font-medium mb-2 text-muted-foreground/50">
                      ปีที่ {year}
                    </h3>
                  </div>
                )
              }
              return (
                <div key={year}>
                  <h3 className="text-sm font-medium mb-2">ปีที่ {year}</h3>
                  <div className="space-y-2">
                    {entries.map((entry) => {
                      const status: CourseStatus = entry.isPlaceholder
                        ? "not_taken"
                        : uploadId
                        ? matchedMap[entry.courseCode] ?? "not_taken"
                        : "not_taken"

                      return (
                        <StudyPlanCard
                          key={entry.id}
                          entry={{
                            id: entry.id,
                            courseCode: entry.courseCode,
                            label: entry.label,
                            credits: entry.credits,
                            note: entry.note,
                            isPlaceholder: entry.isPlaceholder,
                          }}
                          status={status}
                          showStatus={!!uploadId}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
