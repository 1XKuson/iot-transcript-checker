import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "IoT Transcript Checker",
  description: "ตรวจสอบใบแสดงผลการเรียนสำหรับวิศวกรรมระบบไอโอทีและสารสนเทศ",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
          <nav className="container mx-auto flex h-14 max-w-6xl items-center px-4">
            <Link
              href="/"
              className="mr-6 flex items-center font-semibold text-sm"
            >
              IoT Transcript Checker
            </Link>
            <div className="flex gap-6 text-sm">
              <Link
                href="/"
                className="text-foreground/70 hover:text-foreground transition-colors"
              >
                หน้าหลัก
              </Link>
              <Link
                href="/upload"
                className="text-foreground/70 hover:text-foreground transition-colors"
              >
                อัปโหลด
              </Link>
              <Link
                href="/study-plan"
                className="text-foreground/70 hover:text-foreground transition-colors"
              >
                แผนการศึกษา
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <Toaster />
      </body>
    </html>
  )
}
