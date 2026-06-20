export type EntryStatus = "completed" | "in_progress" | "withdrawn" | "failed_grade"

export interface CategoryWithCredits {
  id: string
  nameTh: string
  nameEn: string
  parentId: string | null
  requiredCredits: number | null
  earnedCredits: number
  inProgressCredits: number
  children: CategoryWithCredits[]
}

// ─── Results page types ───────────────────────────────────────────────────────

export type CourseStatus =
  | "completed"
  | "in_progress"
  | "failed_grade"
  | "not_taken"
  | "withdrawn"

export interface CourseSummary {
  code: string
  nameTh: string
  nameEn: string
  credits: number
  courseType: string
  status: CourseStatus
  grade: string | null
  semesterLabel: string | null
  planYear: number | null
  planSemester: number | null
}

export interface CategorySummary {
  id: string
  nameTh: string
  nameEn: string
  requiredCredits: number | null
  earnedCredits: number
  inProgressCredits: number
  courses: CourseSummary[]
  children: CategorySummary[]
}

export interface NeedsReviewEntry {
  id: string
  courseCodeRaw: string
  courseNameRaw: string
  matchConfidence: number | null
  matchedCourseId: string | null
  matchedCourse: {
    code: string
    nameTh: string
    nameEn: string
    credits: number
  } | null
}

export interface ResultsData {
  uploadId: string
  fileName: string
  uploadedAt: string
  totalRequired: number
  totalEarned: number
  totalInProgress: number
  categories: CategorySummary[]
  needsReviewEntries: NeedsReviewEntry[]
  failedCount: number
  allCourses: { code: string; nameTh: string; nameEn: string; credits: number }[]
}
