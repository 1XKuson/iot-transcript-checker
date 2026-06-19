-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "parentId" TEXT,
    "requiredCredits" REAL,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Course" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "lectureHours" INTEGER NOT NULL,
    "labHours" INTEGER NOT NULL,
    "selfStudyHours" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "courseType" TEXT NOT NULL,
    "note" TEXT,
    "prerequisites" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "Course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudyPlanEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "courseCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "credits" REAL,
    "note" TEXT,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "studentCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TranscriptUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT,
    "fileName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawLlmResponse" TEXT,
    "status" TEXT NOT NULL,
    CONSTRAINT "TranscriptUpload_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranscriptEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadId" TEXT NOT NULL,
    "courseCode" TEXT,
    "courseCodeRaw" TEXT NOT NULL,
    "courseNameRaw" TEXT NOT NULL,
    "grade" TEXT,
    "semesterLabel" TEXT,
    "status" TEXT NOT NULL,
    "matchConfidence" REAL,
    "matchedCourseId" TEXT,
    CONSTRAINT "TranscriptEntry_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "TranscriptUpload" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TranscriptEntry_matchedCourseId_fkey" FOREIGN KEY ("matchedCourseId") REFERENCES "Course" ("code") ON DELETE SET NULL ON UPDATE CASCADE
);
