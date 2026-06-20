"use client"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UploadIcon, FileIcon, XIcon, ArrowLeftIcon } from "lucide-react"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface RawEntry {
  id: string
  courseCodeRaw: string
  courseNameRaw: string
  grade: string | null
  credits: number | null
  semesterLabel: string | null
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step state
  const [step, setStep] = useState<"select" | "review">("select")

  // Select-step state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Review-step state
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [extractedEntries, setExtractedEntries] = useState<RawEntry[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [editedEntries, setEditedEntries] = useState<Record<string, Partial<RawEntry>>>({})
  const [isConfirming, setIsConfirming] = useState(false)

  // Object URL for file preview in review step
  const objectUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFile]
  )

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) {
      return "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)"
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "รองรับเฉพาะไฟล์ PDF, JPG, และ PNG เท่านั้น"
    }
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return "นามสกุลไฟล์ไม่ถูกต้อง"
    }
    return null
  }

  function handleFileSelect(file: File) {
    const error = validateFile(file)
    if (error) {
      toast.error(error)
      return
    }
    setSelectedFile(file)

    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  async function handleSubmit() {
    if (!selectedFile) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch("/api/transcript/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json() as { uploadId?: string; entries?: RawEntry[]; error?: string }

      if (!res.ok) {
        toast.error(data.error ?? "เกิดข้อผิดพลาดในการอัปโหลด")
        return
      }

      if (!data.uploadId || !data.entries) {
        toast.error("ข้อมูลที่ได้รับไม่ถูกต้อง")
        return
      }

      setUploadId(data.uploadId)
      setExtractedEntries(data.entries)
      setCheckedIds(new Set(data.entries.map((e) => e.id)))
      setEditedEntries({})
      setStep("review")
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsUploading(false)
    }
  }

  async function handleConfirm() {
    if (!uploadId) return
    setIsConfirming(true)
    try {
      const res = await fetch(`/api/transcript/${uploadId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepIds: [...checkedIds], edits: editedEntries }),
      })
      const data = await res.json() as { uploadId?: string; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? "เกิดข้อผิดพลาด")
        setIsConfirming(false)
        return
      }
      router.push(`/results/${data.uploadId}`)
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง")
      setIsConfirming(false)
    }
  }

  function toggleEntry(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    if (checkedIds.size === extractedEntries.length) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(extractedEntries.map((e) => e.id)))
    }
  }

  function updateEntry<K extends keyof RawEntry>(id: string, field: K, value: RawEntry[K]) {
    setEditedEntries((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  // ---- REVIEW STEP ----
  if (step === "review") {
    const isPdf = selectedFile?.type === "application/pdf"
    const allChecked = checkedIds.size === extractedEntries.length

    return (
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Header bar */}
        <div className="border-b px-6 py-3 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setStep("select")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeftIcon className="size-4" />
            แก้ไขไฟล์
          </button>
          <h1 className="text-lg font-semibold">ตรวจสอบรายวิชาที่ดึงมาได้</h1>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: file preview (~45%) */}
          <div className="w-[45%] shrink-0 border-r p-4 flex flex-col sticky top-0 overflow-auto">
            <p className="text-sm font-medium mb-2 text-muted-foreground">
              {selectedFile?.name}
            </p>
            {objectUrl && (
              isPdf ? (
                <object
                  data={objectUrl}
                  type="application/pdf"
                  className="w-full h-[70vh] rounded border"
                >
                  <p className="text-sm text-muted-foreground p-4">
                    ไม่สามารถแสดง PDF ได้ในเบราว์เซอร์นี้
                  </p>
                </object>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={objectUrl}
                  alt="preview"
                  className="w-full max-h-[70vh] object-contain rounded border"
                />
              )
            )}
          </div>

          {/* Right panel: editable table (~55%) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Select all toggle */}
            <div className="px-4 pt-4 pb-2 shrink-0 flex items-center gap-3 border-b">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="size-4 accent-primary"
                />
                {allChecked ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
              </label>
            </div>

            {/* Scrollable table */}
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">✓</TableHead>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อวิชา</TableHead>
                    <TableHead className="text-right">หน่วยกิต</TableHead>
                    <TableHead className="text-center">เกรด</TableHead>
                    <TableHead>ภาคเรียน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedEntries.map((entry) => {
                    const checked = checkedIds.has(entry.id)
                    const edits = editedEntries[entry.id] ?? {}
                    const val = {
                      courseCodeRaw: edits.courseCodeRaw ?? entry.courseCodeRaw,
                      courseNameRaw: edits.courseNameRaw ?? entry.courseNameRaw,
                      grade: edits.grade !== undefined ? edits.grade : entry.grade,
                      credits: edits.credits !== undefined ? edits.credits : entry.credits,
                      semesterLabel: edits.semesterLabel !== undefined ? edits.semesterLabel : entry.semesterLabel,
                    }
                    const cellCls = `w-full bg-transparent outline-none rounded px-1 py-0.5 text-sm
                      focus:ring-1 focus:ring-primary focus:bg-background
                      ${checked ? "" : "line-through opacity-60"}`
                    return (
                      <TableRow
                        key={entry.id}
                        className={`transition-opacity ${checked ? "" : "opacity-50"}`}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEntry(entry.id)}
                            className="size-4 accent-primary cursor-pointer"
                          />
                        </TableCell>
                        <TableCell className="w-28">
                          <input
                            className={`${cellCls} font-mono`}
                            value={val.courseCodeRaw}
                            onChange={(e) => updateEntry(entry.id, "courseCodeRaw", e.target.value)}
                            placeholder="รหัสวิชา"
                            maxLength={10}
                          />
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <input
                            className={cellCls}
                            value={val.courseNameRaw}
                            onChange={(e) => updateEntry(entry.id, "courseNameRaw", e.target.value)}
                            placeholder="ชื่อวิชา"
                          />
                        </TableCell>
                        <TableCell className="w-20">
                          <select
                            className={`${cellCls} cursor-pointer`}
                            value={val.credits ?? ""}
                            onChange={(e) =>
                              updateEntry(entry.id, "credits", e.target.value ? parseInt(e.target.value) : null)
                            }
                          >
                            <option value="">-</option>
                            {[1,2,3,4,5,6,7,8,9].map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="w-20">
                          <select
                            className={`${cellCls} cursor-pointer`}
                            value={val.grade ?? ""}
                            onChange={(e) =>
                              updateEntry(entry.id, "grade", e.target.value || null)
                            }
                          >
                            <option value="">-</option>
                            <option value="A">A</option>
                            <option value="B+">B+</option>
                            <option value="B">B</option>
                            <option value="C+">C+</option>
                            <option value="C">C</option>
                            <option value="D+">D+</option>
                            <option value="D">D</option>
                          </select>
                        </TableCell>
                        <TableCell className="w-24">
                          <input
                            className={cellCls}
                            value={val.semesterLabel ?? ""}
                            onChange={(e) =>
                              updateEntry(entry.id, "semesterLabel", e.target.value || null)
                            }
                            placeholder="1/2568"
                            maxLength={8}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Bottom action bar */}
            <div className="border-t px-4 py-3 flex items-center justify-between shrink-0">
              <p className="text-sm text-muted-foreground">
                {checkedIds.size} / {extractedEntries.length} รายวิชาที่เลือก
              </p>
              <Button
                onClick={handleConfirm}
                disabled={isConfirming || checkedIds.size === 0}
                size="lg"
              >
                {isConfirming ? "กำลังประมวลผล..." : "ยืนยันและดูผล"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---- SELECT STEP ----
  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">อัปโหลด Transcript</h1>
      <p className="text-muted-foreground mb-8">
        รองรับไฟล์ PDF, JPG, JPEG, PNG ขนาดไม่เกิน 10MB
      </p>

      {isUploading ? (
        <div className="border rounded-lg p-8 space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <p className="text-sm text-muted-foreground text-center mt-4">
            กำลังวิเคราะห์ Transcript...
          </p>
        </div>
      ) : (
        <>
          <div
            className={`border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon className="size-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, JPG, PNG (สูงสุด 10MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelect(file)
              }}
            />
          </div>

          {selectedFile && (
            <div className="mt-4 border rounded-lg p-4 flex items-start gap-3">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="preview"
                  className="size-16 object-cover rounded border"
                />
              ) : (
                <FileIcon className="size-8 text-muted-foreground mt-1 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedFile(null)
                  setImagePreview(null)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
                className="shrink-0 p-1 rounded hover:bg-muted"
              >
                <XIcon className="size-4 text-muted-foreground" />
              </button>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!selectedFile}
              size="lg"
            >
              วิเคราะห์ Transcript
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
