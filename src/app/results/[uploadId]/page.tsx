import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ResultsClient } from "@/components/results/ResultsClient"
import type {
  ResultsData,
  CategorySummary,
  CourseSummary,
  CourseStatus,
  NeedsReviewEntry,
} from "@/lib/types"

type Props = {
  params: Promise<{ uploadId: string }>
}

// Status priority for deduplication: prefer the best outcome per course
const STATUS_PRIORITY: Record<string, number> = {
  completed: 0,
  in_progress: 1,
  failed_grade: 2,
  withdrawn: 3,
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

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [allCourses, allCategories, studyPlan] = await Promise.all([
    prisma.course.findMany({ orderBy: { code: "asc" } }),
    prisma.category.findMany(),
    prisma.studyPlanEntry.findMany({
      orderBy: [{ year: "asc" }, { semester: "asc" }],
    }),
  ])

  // ── Build lookup: courseCode → best transcript entry ──────────────────────
  const entryByCourseId = new Map<string, typeof upload.entries[number]>()
  for (const entry of upload.entries) {
    if (!entry.matchedCourseId) continue
    const existing = entryByCourseId.get(entry.matchedCourseId)
    const priority = STATUS_PRIORITY[entry.status] ?? 99
    const existingPriority = existing ? (STATUS_PRIORITY[existing.status] ?? 99) : Infinity
    if (priority < existingPriority) {
      entryByCourseId.set(entry.matchedCourseId, entry)
    }
  }

  // ── Build lookup: courseCode → study plan position ────────────────────────
  const planLookup = new Map<string, { year: number; semester: number }>()
  for (const entry of studyPlan) {
    if (!entry.isPlaceholder && !planLookup.has(entry.courseCode)) {
      planLookup.set(entry.courseCode, { year: entry.year, semester: entry.semester })
    }
  }

  // ── Resolve course status ─────────────────────────────────────────────────
  function resolveCourseStatus(courseCode: string): CourseStatus {
    const entry = entryByCourseId.get(courseCode)
    if (!entry) return "not_taken"
    const s = entry.status
    if (s === "completed") return "completed"
    if (s === "in_progress") return "in_progress"
    if (s === "failed_grade") return "failed_grade"
    if (s === "withdrawn") return "withdrawn"
    return "not_taken"
  }

  // ── Build course summaries per category ───────────────────────────────────
  const coursesByCategory = new Map<string, typeof allCourses>()
  for (const course of allCourses) {
    const arr = coursesByCategory.get(course.categoryId) ?? []
    arr.push(course)
    coursesByCategory.set(course.categoryId, arr)
  }

  // Sort order for course chips: not_taken/failed first (gaps visible first)
  const STATUS_SORT: Record<CourseStatus, number> = {
    not_taken: 0,
    failed_grade: 1,
    in_progress: 2,
    withdrawn: 3,
    completed: 4,
  }

  function buildCourseSummaries(categoryId: string): CourseSummary[] {
    const courses = coursesByCategory.get(categoryId) ?? []
    return courses
      .map((course): CourseSummary => {
        const status = resolveCourseStatus(course.code)
        const entry = entryByCourseId.get(course.code)
        const plan = planLookup.get(course.code)
        return {
          code: course.code,
          nameTh: course.nameTh,
          nameEn: course.nameEn,
          credits: course.credits,
          courseType: course.courseType,
          status,
          grade: entry?.grade ?? null,
          semesterLabel: entry?.semesterLabel ?? null,
          planYear: plan?.year ?? null,
          planSemester: plan?.semester ?? null,
        }
      })
      .sort((a, b) => {
        if (STATUS_SORT[a.status] !== STATUS_SORT[b.status]) {
          return STATUS_SORT[a.status] - STATUS_SORT[b.status]
        }
        const planA = planLookup.get(a.code)
        const planB = planLookup.get(b.code)
        if (planA && planB) {
          if (planA.year !== planB.year) return planA.year - planB.year
          return planA.semester - planB.semester
        }
        if (planA) return -1
        if (planB) return 1
        return a.code.localeCompare(b.code)
      })
  }

  // ── Build CategorySummary tree recursively ────────────────────────────────
  const catMap = new Map<string, typeof allCategories[number]>()
  for (const cat of allCategories) {
    catMap.set(cat.id, cat)
  }

  const childrenByParent = new Map<string, typeof allCategories>()
  for (const cat of allCategories) {
    if (cat.parentId) {
      const arr = childrenByParent.get(cat.parentId) ?? []
      arr.push(cat)
      childrenByParent.set(cat.parentId, arr)
    }
  }

  function buildCategorySummary(catId: string): CategorySummary {
    const cat = catMap.get(catId)!
    const directCourses = buildCourseSummaries(catId)
    const childCats = (childrenByParent.get(catId) ?? []).sort((a, b) =>
      a.id.localeCompare(b.id)
    )
    const children = childCats.map((c) => buildCategorySummary(c.id))

    // Earned = direct completions + children completions (rolled up)
    const directEarned = directCourses
      .filter((c) => c.status === "completed")
      .reduce((s, c) => s + c.credits, 0)
    const directInProgress = directCourses
      .filter((c) => c.status === "in_progress")
      .reduce((s, c) => s + c.credits, 0)

    const childrenEarned = children.reduce((s, c) => s + c.earnedCredits, 0)
    const childrenInProgress = children.reduce(
      (s, c) => s + c.inProgressCredits,
      0
    )

    return {
      id: cat.id,
      nameTh: cat.nameTh,
      nameEn: cat.nameEn,
      requiredCredits: cat.requiredCredits ?? null,
      earnedCredits: directEarned + childrenEarned,
      inProgressCredits: directInProgress + childrenInProgress,
      courses: directCourses,
      children,
    }
  }

  // Root categories (parentId === null), sorted by id
  const rootCategoryIds = allCategories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => c.id)

  const categories: CategorySummary[] = rootCategoryIds.map((id) =>
    buildCategorySummary(id)
  )

  // ── Aggregate totals ──────────────────────────────────────────────────────
  const totalEarned = categories.reduce((s, c) => s + c.earnedCredits, 0)
  const totalInProgress = categories.reduce(
    (s, c) => s + c.inProgressCredits,
    0
  )
  const totalRequired = 135

  // ── Failed count ──────────────────────────────────────────────────────────
  const failedCount = upload.entries.filter(
    (e) => e.status === "failed_grade"
  ).length

  // ── Needs review entries ──────────────────────────────────────────────────
  const needsReviewEntries: NeedsReviewEntry[] = upload.entries
    .filter(
      (e) =>
        e.matchedCourseId === null ||
        e.matchConfidence === null ||
        e.matchConfidence < 0.8
    )
    .map((e) => ({
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
    }))

  // ── All courses for NeedsReviewSection combobox ───────────────────────────
  const allCoursesSimple = allCourses.map((c) => ({
    code: c.code,
    nameTh: c.nameTh,
    nameEn: c.nameEn,
    credits: c.credits,
  }))

  // ── Compose ResultsData ───────────────────────────────────────────────────
  const resultsData: ResultsData = {
    uploadId,
    fileName: upload.fileName,
    uploadedAt: upload.uploadedAt.toISOString(),
    totalRequired,
    totalEarned,
    totalInProgress,
    categories,
    needsReviewEntries,
    failedCount,
    allCourses: allCoursesSimple,
  }

  return <ResultsClient data={resultsData} />
}
