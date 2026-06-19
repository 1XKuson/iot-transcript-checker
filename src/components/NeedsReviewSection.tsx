"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { ChevronsUpDownIcon, CheckIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Course {
  code: string
  nameTh: string
  nameEn: string
  credits: number
}

interface Entry {
  id: string
  courseCodeRaw: string
  courseNameRaw: string
  matchConfidence: number | null
  matchedCourseId: string | null
  matchedCourse: Course | null
}

interface Props {
  entries: Entry[]
  allCourses: Course[]
}

export function NeedsReviewSection({ entries: initialEntries, allCourses }: Props) {
  const [entries, setEntries] = useState(initialEntries)

  async function handleCourseSelect(entryId: string, courseCode: string) {
    try {
      const res = await fetch(`/api/transcript/entry/${entryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchedCourseId: courseCode }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? "เกิดข้อผิดพลาด")
        return
      }

      const updated = await res.json()
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                matchedCourseId: updated.matchedCourseId,
                matchedCourse: updated.matchedCourse,
                matchConfidence: updated.matchConfidence,
              }
            : e
        )
      )
      toast.success("อัปเดตวิชาสำเร็จ")
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้")
    }
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        ไม่มีรายการที่ต้องตรวจสอบ
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-mono font-medium">{entry.courseCodeRaw || "(ไม่มีรหัส)"}</p>
              <p className="text-sm text-muted-foreground">{entry.courseNameRaw || "(ไม่มีชื่อ)"}</p>
              {entry.matchedCourse && (
                <p className="text-xs text-green-600 mt-1">
                  จับคู่กับ: {entry.matchedCourse.code} - {entry.matchedCourse.nameTh}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {entry.matchConfidence !== null && (
                <Badge variant={entry.matchConfidence >= 0.8 ? "default" : "destructive"}>
                  {Math.round(entry.matchConfidence * 100)}%
                </Badge>
              )}
            </div>
          </div>
          <CourseCombobox
            allCourses={allCourses}
            currentCode={entry.matchedCourseId}
            onSelect={(code) => handleCourseSelect(entry.id, code)}
          />
        </div>
      ))}
    </div>
  )
}

function CourseCombobox({
  allCourses,
  currentCode,
  onSelect,
}: {
  allCourses: Course[]
  currentCode: string | null
  onSelect: (code: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = allCourses.find((c) => c.code === currentCode)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between text-sm h-9"
        )}
      >
        {current ? `${current.code} - ${current.nameTh}` : "เลือกวิชา..."}
        <ChevronsUpDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="ค้นหาวิชา..." />
          <CommandList>
            <CommandEmpty>ไม่พบวิชา</CommandEmpty>
            <CommandGroup>
              {allCourses.map((course) => (
                <CommandItem
                  key={course.code}
                  value={`${course.code} ${course.nameTh} ${course.nameEn}`}
                  onSelect={() => {
                    onSelect(course.code)
                    setOpen(false)
                  }}
                  data-checked={course.code === currentCode}
                >
                  <span className="font-mono text-xs mr-2 text-muted-foreground">
                    {course.code}
                  </span>
                  <span className="flex-1 truncate">{course.nameTh}</span>
                  {course.code === currentCode && (
                    <CheckIcon className="ml-2 size-4 shrink-0" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
