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
