"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { NeedsReviewSection } from "@/components/NeedsReviewSection"
import {
  CheckCircle2,
  AlertCircle,
  Star,
  AlertTriangle,
  CalendarDays,
} from "lucide-react"
import type {
  ResultsData,
  CategorySummary,
  CourseSummary,
  CourseStatus,
} from "@/lib/types"

// ─── Status helpers ──────────────────────────────────────────────────────────

function getStatusStyle(status: CourseStatus): React.CSSProperties {
  switch (status) {
    case "completed":
      return {
        borderColor: "var(--status-completed-border)",
        backgroundColor: "var(--status-completed-bg)",
        color: "var(--status-completed)",
      }
    case "in_progress":
      return {
        borderColor: "var(--status-in-progress-border)",
        backgroundColor: "var(--status-in-progress-bg)",
        color: "var(--status-in-progress)",
      }
    case "failed_grade":
      return {
        borderColor: "var(--status-failed-border)",
        backgroundColor: "var(--status-failed-bg)",
        color: "var(--status-failed)",
      }
    case "withdrawn":
    case "not_taken":
    default:
      return {
        borderColor: "var(--status-not-taken-border)",
        backgroundColor: "var(--status-not-taken-bg)",
        color: "var(--status-not-taken)",
      }
  }
}

function statusLabel(status: CourseStatus): string {
  switch (status) {
    case "completed":
      return "ผ่านแล้ว"
    case "in_progress":
      return "กำลังเรียน"
    case "failed_grade":
      return "ต้องเรียนซ้ำ"
    case "withdrawn":
      return "ถอน"
    case "not_taken":
      return "ยังไม่ได้เรียน"
  }
}

// ─── Segmented Progress Bar ──────────────────────────────────────────────────

function SegmentedBar({
  earned,
  inProgress,
  total,
  height = "h-3",
}: {
  earned: number
  inProgress: number
  total: number
  height?: string
}) {
  const earnedPct = Math.min((earned / total) * 100, 100)
  const inProgressPct = Math.min((inProgress / total) * 100, 100 - earnedPct)

  return (
    <div
      className={`w-full ${height} rounded-full overflow-hidden flex`}
      style={{ backgroundColor: "var(--status-not-taken-bg)", border: "1px solid var(--status-not-taken-border)" }}
    >
      {earnedPct > 0 && (
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${earnedPct}%`,
            backgroundColor: "var(--status-completed)",
          }}
        />
      )}
      {inProgressPct > 0 && (
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${inProgressPct}%`,
            backgroundColor: "var(--status-in-progress)",
          }}
        />
      )}
    </div>
  )
}

// ─── Mini bar (inside accordion trigger) ─────────────────────────────────────

function MiniBar({
  earned,
  inProgress,
  total,
}: {
  earned: number
  inProgress: number
  total: number | null
}) {
  if (!total) return null
  return (
    <SegmentedBar
      earned={earned}
      inProgress={inProgress}
      total={total}
      height="h-1.5"
    />
  )
}

// ─── CourseStatusChip ─────────────────────────────────────────────────────────

function CourseStatusChip({
  course,
  uploadId,
  activeFilters,
}: {
  course: CourseSummary
  uploadId: string
  activeFilters: Set<CourseStatus>
}) {
  const style = getStatusStyle(course.status)
  const isVisible = activeFilters.size === 0 || activeFilters.has(course.status)
  const isRequired =
    course.courseType === "required" ||
    course.courseType === "mandatory_elective"

  const chipContent = (
    <>
      {/* Credits badge top-right */}
      <span
        className="absolute top-1.5 right-2 text-xs font-medium opacity-70"
        aria-label={`${course.credits} หน่วยกิต`}
      >
        {course.credits}
      </span>

      {/* Required/elective star icon bottom-right */}
      {course.status === "not_taken" && (
        <span className="absolute bottom-1.5 right-2">
          {isRequired ? (
            <Star className="w-2.5 h-2.5 fill-current opacity-60" />
          ) : (
            <Star className="w-2.5 h-2.5 opacity-30" />
          )}
        </span>
      )}

      {/* Course code */}
      <p className="font-mono font-bold text-sm leading-tight pr-7">
        {course.code}
      </p>

      {/* Course name */}
      <p
        className="text-xs truncate mt-0.5 opacity-80"
        title={course.nameTh}
      >
        {course.nameTh}
      </p>

      {/* Grade for completed/failed */}
      {course.grade && (
        <span className="inline-block text-xs font-bold mt-1 opacity-90">
          {course.grade}
        </span>
      )}

      {/* Status label for non-completed, non-not_taken */}
      {course.status !== "not_taken" && course.status !== "completed" && (
        <span className="block text-xs mt-0.5 opacity-70 font-medium">
          {statusLabel(course.status)}
        </span>
      )}
    </>
  )

  const chipClasses = [
    "relative border rounded-lg px-3 py-2 text-left transition-opacity duration-200 select-none",
    isVisible ? "opacity-100" : "opacity-30 pointer-events-none",
  ].join(" ")

  if (course.status === "not_taken") {
    return (
      <Popover>
        <PopoverTrigger
          className={[
            chipClasses,
            "cursor-pointer w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
          ].join(" ")}
          style={{
            ...style,
            // Override focus ring color
          }}
          data-failed-course={undefined}
        >
          {chipContent}
        </PopoverTrigger>
        <PopoverContent side="top" className="w-64 p-3">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CalendarDays className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{course.code}</p>
                <p className="text-xs text-muted-foreground">{course.nameTh}</p>
              </div>
            </div>
            {course.planYear !== null && course.planSemester !== null ? (
              <p className="text-sm text-muted-foreground">
                ตามแผน:{" "}
                <span className="font-medium text-foreground">
                  ปี {course.planYear} เทอม {course.planSemester}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                ไม่มีในแผนการเรียน
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {course.credits} หน่วยกิต •{" "}
              {isRequired ? "วิชาบังคับ" : "วิชาเลือก"}
            </p>
            <Link
              href={`/study-plan?uploadId=${uploadId}`}
              className="flex items-center justify-center w-full mt-1 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ดูแผนการเรียน
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div
      className={chipClasses}
      style={style}
      data-failed-course={course.status === "failed_grade" ? "true" : undefined}
    >
      {chipContent}
    </div>
  )
}

// ─── Course chip grid ─────────────────────────────────────────────────────────

function CourseChipGrid({
  courses,
  uploadId,
  activeFilters,
}: {
  courses: CourseSummary[]
  uploadId: string
  activeFilters: Set<CourseStatus>
}) {
  if (courses.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
      {courses.map((course) => (
        <CourseStatusChip
          key={course.code}
          course={course}
          uploadId={uploadId}
          activeFilters={activeFilters}
        />
      ))}
    </div>
  )
}

// ─── Category Gap Tree ────────────────────────────────────────────────────────

function computeIsComplete(cat: CategorySummary): boolean {
  if (cat.requiredCredits === null) return true
  return cat.earnedCredits >= cat.requiredCredits
}

function CategoryAccordion({
  categories,
  uploadId,
  activeFilters,
  depth,
}: {
  categories: CategorySummary[]
  uploadId: string
  activeFilters: Set<CourseStatus>
  depth: number
}) {
  // Auto-expand incomplete categories
  const defaultOpen = categories
    .filter((cat) => !computeIsComplete(cat))
    .map((cat) => cat.id)

  if (categories.length === 0) return null

  return (
    <Accordion multiple defaultValue={defaultOpen} className="w-full">
      {categories.map((cat) => {
        const isComplete = computeIsComplete(cat)
        const hasChildren = cat.children.length > 0
        // MAJORELEC pattern: children exist but none have requiredCredits
        const isMajorElecParent =
          hasChildren && cat.children.every((c) => c.requiredCredits === null)

        return (
          <AccordionItem
            key={cat.id}
            value={cat.id}
            className={
              depth === 0
                ? "border-b last:border-b-0"
                : "border-b border-dashed border-muted last:border-b-0"
            }
          >
            <AccordionTrigger
              className={[
                "hover:no-underline gap-3 px-4",
                depth === 0 ? "py-3 text-base" : "py-2 text-sm",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 text-left">
                {isComplete ? (
                  <CheckCircle2
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--status-completed)" }}
                  />
                ) : (
                  <AlertCircle
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--status-in-progress)" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      "truncate",
                      depth === 0 ? "font-semibold" : "font-medium",
                      isComplete ? "text-muted-foreground" : "text-foreground",
                    ].join(" ")}
                  >
                    {cat.nameTh}
                  </p>
                  {cat.requiredCredits !== null && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-32">
                        <MiniBar
                          earned={cat.earnedCredits}
                          inProgress={cat.inProgressCredits}
                          total={cat.requiredCredits}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {cat.earnedCredits}
                        {cat.inProgressCredits > 0 && (
                          <span
                            style={{ color: "var(--status-in-progress)" }}
                          >
                            {" "}
                            +{cat.inProgressCredits}
                          </span>
                        )}{" "}
                        / {cat.requiredCredits} หน่วยกิต
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3 pt-1">
                {/* Direct courses in this category */}
                {cat.courses.length > 0 && (
                  <CourseChipGrid
                    courses={cat.courses}
                    uploadId={uploadId}
                    activeFilters={activeFilters}
                  />
                )}

                {/* Children categories */}
                {hasChildren && (
                  <div
                    className={
                      depth === 0
                        ? "pl-4 border-l-2 border-muted space-y-1 mt-2"
                        : "pl-2 border-l border-muted/50 space-y-1 mt-2"
                    }
                  >
                    {isMajorElecParent ? (
                      // Special render for MAJORELEC sub-groups (no individual requiredCredits)
                      <div className="space-y-4">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-1">
                          กลุ่มให้เลือก — เลือกรวม{" "}
                          {cat.requiredCredits ?? "?"} หน่วยกิตจากกลุ่มใดก็ได้
                        </p>
                        {cat.children.map((child) => {
                          const childEarned = child.earnedCredits
                          const childInProgress = child.inProgressCredits
                          const hasActivity =
                            childEarned > 0 || childInProgress > 0
                          return (
                            <div key={child.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-muted-foreground flex-1">
                                  {child.nameTh}
                                </p>
                                {hasActivity && (
                                  <span
                                    className="text-xs border rounded-full px-2 py-0.5 shrink-0"
                                    style={{
                                      color: "var(--status-completed)",
                                      borderColor:
                                        "var(--status-completed-border)",
                                    }}
                                  >
                                    {childEarned > 0 &&
                                      `${childEarned}cr ผ่าน`}
                                    {childInProgress > 0 &&
                                      ` +${childInProgress}cr กำลังเรียน`}
                                  </span>
                                )}
                              </div>
                              {child.courses.length > 0 && (
                                <CourseChipGrid
                                  courses={child.courses}
                                  uploadId={uploadId}
                                  activeFilters={activeFilters}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <CategoryAccordion
                        categories={cat.children}
                        uploadId={uploadId}
                        activeFilters={activeFilters}
                        depth={depth + 1}
                      />
                    )}
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

// ─── Failed FAB ──────────────────────────────────────────────────────────────

function FailedFAB({ failedCount }: { failedCount: number }) {
  const handleClick = useCallback(() => {
    const el = document.querySelector("[data-failed-course]")
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("animate-pulse")
    setTimeout(() => el.classList.remove("animate-pulse"), 1000)
  }, [])

  if (failedCount === 0) return null

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-transform hover:scale-105 active:scale-95"
      style={{
        backgroundColor: "var(--status-failed)",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--tw-ring-color" as any]: "var(--status-failed)",
      }}
      aria-label={`มี ${failedCount} วิชาที่ต้องลงทะเบียนใหม่`}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      มี {failedCount} วิชาที่ต้องลงทะเบียนใหม่
    </button>
  )
}

// ─── Filter types ─────────────────────────────────────────────────────────────

type FilterKey = "not_taken" | "in_progress" | "completed"

const FILTER_OPTIONS: {
  value: FilterKey
  label: string
  status: CourseStatus
}[] = [
  { value: "not_taken", label: "ยังไม่ได้เรียน", status: "not_taken" },
  { value: "in_progress", label: "กำลังเรียน", status: "in_progress" },
  { value: "completed", label: "เรียนแล้ว", status: "completed" },
]

// ─── Hero Summary Bar ─────────────────────────────────────────────────────────

function HeroSummaryBar({
  data,
}: {
  data: Pick<
    ResultsData,
    | "totalEarned"
    | "totalInProgress"
    | "totalRequired"
    | "categories"
    | "fileName"
    | "uploadedAt"
  >
}) {
  const { totalEarned, totalInProgress, totalRequired, categories } = data
  const gap = Math.max(0, totalRequired - totalEarned)

  const incompleteCategories = categories.filter(
    (c) => c.requiredCredits !== null && c.earnedCredits < c.requiredCredits
  )
  const gapLine =
    incompleteCategories.length > 0
      ? `ขาดอีก ${gap} หน่วยกิต ใน ${incompleteCategories.length} หมวด: ${incompleteCategories.map((c) => c.nameTh).join(", ")}`
      : gap === 0
        ? "ครบทุกหมวดแล้ว"
        : `ขาดอีก ${gap} หน่วยกิต`

  const uploadDate = new Date(data.uploadedAt).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const remainingNotTaken = Math.max(
    0,
    totalRequired - totalEarned - totalInProgress
  )

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">
            ไฟล์: {data.fileName} — {uploadDate}
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-extrabold tabular-nums"
              style={{
                color:
                  totalEarned >= totalRequired
                    ? "var(--status-completed)"
                    : "var(--status-not-taken)",
              }}
            >
              {totalEarned}
            </span>
            <span className="text-xl text-muted-foreground font-medium">
              / {totalRequired} หน่วยกิต
            </span>
          </div>
        </div>

        {/* Legend pills */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: "var(--status-completed)" }}
            />
            <span style={{ color: "var(--status-completed)" }}>
              ผ่าน ({totalEarned})
            </span>
          </span>
          {totalInProgress > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: "var(--status-in-progress)" }}
              />
              <span style={{ color: "var(--status-in-progress)" }}>
                กำลังเรียน ({totalInProgress})
              </span>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: "var(--status-not-taken-border)" }}
            />
            <span style={{ color: "var(--status-not-taken)" }}>
              ยังขาด ({remainingNotTaken})
            </span>
          </span>
        </div>
      </div>

      {/* Segmented bar */}
      <SegmentedBar
        earned={totalEarned}
        inProgress={totalInProgress}
        total={totalRequired}
        height="h-4"
      />

      {/* Gap summary line */}
      <p
        className="text-sm font-medium"
        style={{
          color:
            gap === 0
              ? "var(--status-completed)"
              : "var(--status-in-progress)",
        }}
      >
        {gapLine}
      </p>
    </div>
  )
}

// ─── Main ResultsClient ───────────────────────────────────────────────────────

export function ResultsClient({ data }: { data: ResultsData }) {
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([
    "not_taken",
    "in_progress",
  ])

  // Map filter keys to CourseStatus values (not_taken filter also shows failed/withdrawn)
  const activeStatusSet = new Set<CourseStatus>(
    activeFilters.flatMap((f): CourseStatus[] => {
      if (f === "not_taken")
        return ["not_taken", "withdrawn", "failed_grade"]
      if (f === "in_progress") return ["in_progress"]
      if (f === "completed") return ["completed"]
      return []
    })
  )

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* A. Hero summary bar */}
      <HeroSummaryBar data={data} />

      {/* B. Filter toggle row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground shrink-0">แสดง:</span>
        <ToggleGroup
          multiple
          value={activeFilters}
          onValueChange={(val) => setActiveFilters(val as FilterKey[])}
          className="flex gap-2 flex-wrap"
        >
          {FILTER_OPTIONS.map((opt) => {
            const isActive = activeFilters.includes(opt.value)
            const chipStyle = getStatusStyle(opt.status)
            return (
              <ToggleGroupItem
                key={opt.value}
                value={opt.value}
                aria-label={opt.label}
                className="rounded-full px-3 py-1 h-auto text-sm border focus-visible:ring-2 focus-visible:ring-offset-2 transition-colors"
                style={
                  isActive
                    ? {
                        backgroundColor: chipStyle.borderColor,
                        color: "white",
                        borderColor: chipStyle.borderColor,
                      }
                    : {
                        borderColor: chipStyle.borderColor,
                        color: chipStyle.color,
                        backgroundColor: "transparent",
                      }
                }
              >
                {opt.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      {/* C. Category gap tree */}
      <section>
        <h2 className="text-lg font-semibold mb-3">ผลเทียบหลักสูตร</h2>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CategoryAccordion
            categories={data.categories}
            uploadId={data.uploadId}
            activeFilters={activeStatusSet}
            depth={0}
          />
        </div>
      </section>

      {/* F. NeedsReviewSection (bottom) */}
      {data.needsReviewEntries.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">ต้องตรวจสอบ</h2>
          <p className="text-sm text-muted-foreground mb-4">
            รายการที่มีความแม่นยำต่ำกว่า 80% หรือไม่พบวิชาที่ตรงกัน —
            กรุณาเลือกวิชาด้วยตนเอง
          </p>
          <NeedsReviewSection
            entries={data.needsReviewEntries}
            allCourses={data.allCourses}
          />
        </section>
      )}

      {/* E. Floating FAB */}
      <FailedFAB failedCount={data.failedCount} />
    </div>
  )
}
