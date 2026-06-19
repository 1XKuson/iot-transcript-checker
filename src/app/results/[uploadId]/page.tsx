import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { NeedsReviewSection } from "@/components/NeedsReviewSection"

type Props = {
  params: Promise<{ uploadId: string }>
}

interface CategoryNode {
  id: string
  nameTh: string
  nameEn: string
  parentId: string | null
  requiredCredits: number | null
  earnedCredits: number
  inProgressCredits: number
  children: CategoryNode[]
}

type UploadWithEntries = Awaited<
  ReturnType<typeof prisma.transcriptUpload.findUnique>
> & {
  entries: Array<{
    id: string
    status: string
    matchedCourseId: string | null
    matchedCourse: {
      code: string
      nameTh: string
      nameEn: string
      credits: number
      categoryId: string
      category: { nameTh: string } | null
    } | null
    courseCodeRaw: string
    courseNameRaw: string
    grade: string | null
    semesterLabel: string | null
    matchConfidence: number | null
    uploadId: string
    courseCode: string | null
  }>
}

export default async function ResultsPage({ params }: Props) {
  const { uploadId } = await params

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

  if (!upload) notFound()

  const typedUpload = upload as UploadWithEntries

  const allCourses = await prisma.course.findMany({
    include: { category: true },
  })

  const allCategories = await prisma.category.findMany()

  // Classify entries
  const completedEntries = typedUpload.entries.filter(
    (e) => e.status === "completed"
  )
  const inProgressEntries = typedUpload.entries.filter(
    (e) => e.status === "in_progress"
  )
  const failedEntries = typedUpload.entries.filter(
    (e) => e.status === "failed_grade"
  )
  const withdrawnEntries = typedUpload.entries.filter(
    (e) => e.status === "withdrawn"
  )

  // Completed and in-progress matched course IDs
  const takenIds = new Set(
    [...completedEntries, ...inProgressEntries]
      .map((e) => e.matchedCourseId)
      .filter((id): id is string => id !== null)
  )

  const notTakenCourses = allCourses.filter((c) => !takenIds.has(c.code))

  // Load study plan for ordering
  const studyPlan = await prisma.studyPlanEntry.findMany({
    orderBy: [{ year: "asc" }, { semester: "asc" }],
  })

  // Build studyPlan lookup: courseCode -> { year, semester }
  const planLookup: Record<string, { year: number; semester: number }> = {}
  for (const entry of studyPlan) {
    if (!entry.isPlaceholder && !planLookup[entry.courseCode]) {
      planLookup[entry.courseCode] = { year: entry.year, semester: entry.semester }
    }
  }

  // Build category credit tree
  const categoryMap = new Map<string, CategoryNode>()
  for (const cat of allCategories) {
    categoryMap.set(cat.id, {
      id: cat.id,
      nameTh: cat.nameTh,
      nameEn: cat.nameEn,
      parentId: cat.parentId,
      requiredCredits: cat.requiredCredits,
      earnedCredits: 0,
      inProgressCredits: 0,
      children: [],
    })
  }

  // Sum credits to leaf categories from completed entries
  for (const entry of completedEntries) {
    if (entry.matchedCourse) {
      const node = categoryMap.get(entry.matchedCourse.categoryId)
      if (node) {
        node.earnedCredits += entry.matchedCourse.credits
      }
    }
  }
  for (const entry of inProgressEntries) {
    if (entry.matchedCourse) {
      const node = categoryMap.get(entry.matchedCourse.categoryId)
      if (node) {
        node.inProgressCredits += entry.matchedCourse.credits
      }
    }
  }

  // Build tree
  const rootCategories: CategoryNode[] = []
  for (const [, node] of categoryMap) {
    if (node.parentId) {
      const parent = categoryMap.get(node.parentId)
      if (parent) parent.children.push(node)
    } else {
      rootCategories.push(node)
    }
  }

  // Roll up credits to ancestors
  function rollupCredits(node: CategoryNode) {
    for (const child of node.children) {
      rollupCredits(child)
      node.earnedCredits += child.earnedCredits
      node.inProgressCredits += child.inProgressCredits
    }
  }
  for (const root of rootCategories) {
    rollupCredits(root)
  }

  const totalEarned = rootCategories.reduce((sum, r) => sum + r.earnedCredits, 0)
  const totalRequired = 135

  // Needs review: low confidence or no match
  const needsReview = typedUpload.entries.filter(
    (e) =>
      e.matchConfidence === null || e.matchConfidence < 0.8 || e.matchedCourseId === null
  )

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">ผลการตรวจสอบ Transcript</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ไฟล์: {upload.fileName} — อัปโหลดเมื่อ{" "}
          {new Date(upload.uploadedAt).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Section A: Credit Progress */}
      <section>
        <h2 className="text-lg font-semibold mb-4">ความก้าวหน้าหน่วยกิต</h2>
        <Card className="p-6 space-y-6">
          {/* Grand total */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">รวมทุกหมวด</span>
              <span className="text-muted-foreground">
                {totalEarned} / {totalRequired} หน่วยกิต
              </span>
            </div>
            <Progress value={(totalEarned / totalRequired) * 100} />
          </div>

          <Separator />

          {rootCategories.map((root) => (
            <div key={root.id} className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{root.nameTh}</span>
                  <span className="text-muted-foreground text-xs">
                    {root.earnedCredits}
                    {root.requiredCredits ? ` / ${root.requiredCredits}` : ""} หน่วยกิต
                    {root.inProgressCredits > 0 && (
                      <span className="text-yellow-600 ml-2">
                        (+{root.inProgressCredits} กำลังเรียน)
                      </span>
                    )}
                  </span>
                </div>
                {root.requiredCredits && (
                  <Progress
                    value={Math.min(
                      (root.earnedCredits / root.requiredCredits) * 100,
                      100
                    )}
                  />
                )}
              </div>

              {root.children.length > 0 && (
                <div className="pl-4 space-y-3">
                  {root.children.map((child) => (
                    <div key={child.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{child.nameTh}</span>
                        <span className="text-muted-foreground">
                          {child.earnedCredits}
                          {child.requiredCredits ? ` / ${child.requiredCredits}` : ""} หน่วยกิต
                          {child.inProgressCredits > 0 && (
                            <span className="text-yellow-600 ml-1">
                              (+{child.inProgressCredits})
                            </span>
                          )}
                        </span>
                      </div>
                      {child.requiredCredits && (
                        <Progress
                          value={Math.min(
                            (child.earnedCredits / child.requiredCredits) * 100,
                            100
                          )}
                        />
                      )}
                      {child.children.length > 0 && (
                        <div className="pl-4 space-y-1 pt-1">
                          {child.children.map((grandchild) => (
                            <div
                              key={grandchild.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <span className="text-muted-foreground">
                                {grandchild.nameTh}
                              </span>
                              <span className="text-muted-foreground">
                                {grandchild.earnedCredits} หน่วยกิต
                                {grandchild.inProgressCredits > 0 && (
                                  <span className="text-yellow-600 ml-1">
                                    (+{grandchild.inProgressCredits})
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      </section>

      {/* Section B: Course Tables */}
      <section>
        <h2 className="text-lg font-semibold mb-4">รายวิชา</h2>
        <Tabs defaultValue="completed">
          <TabsList>
            <TabsTrigger value="completed">
              เรียนแล้ว ({completedEntries.length + failedEntries.length + withdrawnEntries.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              กำลังเรียน ({inProgressEntries.length})
            </TabsTrigger>
            <TabsTrigger value="not_taken">
              ยังไม่ได้เรียน ({notTakenCourses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="completed" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสวิชา</TableHead>
                  <TableHead>ชื่อวิชา</TableHead>
                  <TableHead>หน่วยกิต</TableHead>
                  <TableHead>เกรด</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...completedEntries, ...failedEntries, ...withdrawnEntries].map(
                  (entry) => (
                    <TableRow
                      key={entry.id}
                      className={
                        entry.status === "failed_grade"
                          ? "bg-red-50 dark:bg-red-950/20"
                          : ""
                      }
                    >
                      <TableCell className="font-mono text-xs">
                        {entry.matchedCourse?.code ?? entry.courseCodeRaw}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          {entry.matchedCourse?.nameTh ?? entry.courseNameRaw}
                          {entry.status === "failed_grade" && (
                            <Badge variant="destructive">ต้องเรียนซ้ำ</Badge>
                          )}
                          {entry.status === "withdrawn" && (
                            <Badge variant="outline">ถอน</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.matchedCourse?.credits ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {entry.grade ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.matchedCourse?.category?.nameTh ?? "-"}
                      </TableCell>
                    </TableRow>
                  )
                )}
                {completedEntries.length === 0 &&
                  failedEntries.length === 0 &&
                  withdrawnEntries.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground text-sm py-8"
                      >
                        ไม่มีรายการ
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="in_progress" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสวิชา</TableHead>
                  <TableHead>ชื่อวิชา</TableHead>
                  <TableHead>หน่วยกิต</TableHead>
                  <TableHead>ภาคเรียน</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inProgressEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">
                      {entry.matchedCourse?.code ?? entry.courseCodeRaw}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.matchedCourse?.nameTh ?? entry.courseNameRaw}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.matchedCourse?.credits ?? "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.semesterLabel ?? "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.matchedCourse?.category?.nameTh ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {inProgressEntries.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground text-sm py-8"
                    >
                      ไม่มีรายการ
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="not_taken" className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รหัสวิชา</TableHead>
                  <TableHead>ชื่อวิชา</TableHead>
                  <TableHead>หน่วยกิต</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>แผนการศึกษา</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notTakenCourses
                  .sort((a, b) => {
                    const planA = planLookup[a.code]
                    const planB = planLookup[b.code]
                    if (planA && planB) {
                      if (planA.year !== planB.year) return planA.year - planB.year
                      return planA.semester - planB.semester
                    }
                    if (planA) return -1
                    if (planB) return 1
                    const typeOrder = [
                      "required",
                      "lab",
                      "mandatory_elective",
                      "ge",
                      "elective",
                      "project",
                      "free_elective",
                    ]
                    return (
                      typeOrder.indexOf(a.courseType) -
                      typeOrder.indexOf(b.courseType)
                    )
                  })
                  .map((course) => {
                    const plan = planLookup[course.code]
                    return (
                      <TableRow key={course.code}>
                        <TableCell className="font-mono text-xs">
                          {course.code}
                        </TableCell>
                        <TableCell className="text-sm">{course.nameTh}</TableCell>
                        <TableCell className="text-sm">{course.credits}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {course.category?.nameTh}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {plan ? `ปี ${plan.year} เทอม ${plan.semester}` : "-"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                {notTakenCourses.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground text-sm py-8"
                    >
                      ไม่มีรายการ
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </section>

      {/* Section C: Needs Review */}
      {needsReview.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">ต้องตรวจสอบ</h2>
          <p className="text-sm text-muted-foreground mb-4">
            รายการที่มีความแม่นยำต่ำกว่า 80% หรือไม่พบวิชาที่ตรงกัน —
            กรุณาเลือกวิชาด้วยตนเอง
          </p>
          <NeedsReviewSection
            entries={needsReview.map((e) => ({
              id: e.id,
              courseCodeRaw: e.courseCodeRaw,
              courseNameRaw: e.courseNameRaw,
              matchConfidence: e.matchConfidence,
              matchedCourseId: e.matchedCourseId,
              matchedCourse: e.matchedCourse
                ? {
                    code: e.matchedCourse.code,
                    nameTh: e.matchedCourse.nameTh,
                    nameEn: e.matchedCourse.nameEn,
                    credits: e.matchedCourse.credits,
                  }
                : null,
            }))}
            allCourses={allCourses.map((c) => ({
              code: c.code,
              nameTh: c.nameTh,
              nameEn: c.nameEn,
              credits: c.credits,
            }))}
          />
        </section>
      )}
    </div>
  )
}
