"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { UploadIcon, FileIcon, XIcon } from "lucide-react"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

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

    // Generate preview for images
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

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "เกิดข้อผิดพลาดในการอัปโหลด")
        return
      }

      toast.success("วิเคราะห์ Transcript สำเร็จ")
      router.push(`/results/${data.uploadId}`)
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsUploading(false)
    }
  }

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
