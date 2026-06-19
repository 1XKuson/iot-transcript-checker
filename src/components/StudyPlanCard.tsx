"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type CourseStatus = "completed" | "in_progress" | "failed_grade" | "not_taken"

interface PlanEntry {
  id: number
  courseCode: string
  label: string
  credits: number | null
  note: string | null
  isPlaceholder: boolean
}

interface Props {
  entry: PlanEntry
  status: CourseStatus
  showStatus: boolean
}

function getStatusClasses(status: CourseStatus): string {
  switch (status) {
    case "completed":
      return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
    case "in_progress":
      return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
    case "failed_grade":
      return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
    default:
      return "bg-muted/50 border-muted"
  }
}

function getStatusLabel(status: CourseStatus): string {
  switch (status) {
    case "completed":
      return "ผ่านแล้ว"
    case "in_progress":
      return "กำลังเรียน"
    case "failed_grade":
      return "ต้องเรียนซ้ำ"
    default:
      return "ยังไม่ได้เรียน"
  }
}

export function StudyPlanCard({ entry, status, showStatus }: Props) {
  return (
    <TooltipProvider>
      <div
        className={`border rounded-md px-3 py-2 text-xs leading-tight ${getStatusClasses(status)}`}
      >
        {entry.isPlaceholder ? (
          <div className="flex items-start justify-between gap-1">
            <p className="italic text-muted-foreground flex-1">
              {entry.label.split("/")[0].trim()}
            </p>
            {entry.note ? (
              <Tooltip>
                <TooltipTrigger className="cursor-default inline-flex shrink-0">
                  <Badge variant="outline" className="text-xs cursor-default pointer-events-none">
                    เลือกได้
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">{entry.note}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Badge variant="outline" className="text-xs shrink-0">
                เลือกได้
              </Badge>
            )}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs/tight text-muted-foreground">
                {entry.courseCode}
              </p>
              <p
                className="text-xs leading-tight mt-0.5 truncate"
                title={entry.label.split("/")[0].trim()}
              >
                {entry.label.split("/")[0].trim()}
              </p>
            </div>
            {showStatus && status !== "not_taken" && (
              <span
                className={`text-xs shrink-0 font-medium ${
                  status === "completed"
                    ? "text-green-700 dark:text-green-400"
                    : status === "in_progress"
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "text-red-700 dark:text-red-400"
                }`}
              >
                {getStatusLabel(status)}
              </span>
            )}
          </div>
        )}
        {entry.credits !== null && entry.credits !== undefined && (
          <p className="text-muted-foreground mt-1">{entry.credits} หน่วยกิต</p>
        )}
      </div>
    </TooltipProvider>
  )
}
