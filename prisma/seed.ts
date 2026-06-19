import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import path from "path"
import fs from "fs"

const dbPath = path.resolve(process.cwd(), "prisma/dev.db")
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` })
const prisma = new PrismaClient({ adapter })

interface CategorySeed {
  id: string
  nameTh: string
  nameEn: string
  parentId: string | null
  requiredCredits: number | null
}

interface CourseSeed {
  code: string
  nameTh: string
  nameEn: string
  credits: number
  lectureHours: number
  labHours: number
  selfStudyHours: number
  categoryId: string
  courseType: string
  note: string | null
  prerequisites: string[]
}

interface StudyPlanSeed {
  year: number
  semester: number
  courseCode: string
  label: string
  credits: number | null
  note: string | null
  isPlaceholder: boolean
}

interface SeedData {
  categories: CategorySeed[]
  courses: CourseSeed[]
  studyPlan: StudyPlanSeed[]
}

async function main() {
  const seedFile = path.resolve(process.cwd(), "data/curriculum_seed.json")
  const rawData: SeedData = JSON.parse(fs.readFileSync(seedFile, "utf-8"))

  // 1. Insert root categories (parentId === null)
  const rootCategories = rawData.categories.filter((c) => c.parentId === null)
  for (const cat of rootCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        nameTh: cat.nameTh,
        nameEn: cat.nameEn,
        parentId: null,
        requiredCredits: cat.requiredCredits,
      },
    })
  }
  console.log(`Inserted ${rootCategories.length} root categories`)

  // 2. Insert child categories (parentId !== null)
  const childCategories = rawData.categories.filter((c) => c.parentId !== null)
  for (const cat of childCategories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        nameTh: cat.nameTh,
        nameEn: cat.nameEn,
        parentId: cat.parentId,
        requiredCredits: cat.requiredCredits,
      },
    })
  }
  console.log(`Inserted ${childCategories.length} child categories`)

  // 3. Insert courses
  for (const course of rawData.courses) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: {},
      create: {
        code: course.code,
        nameTh: course.nameTh,
        nameEn: course.nameEn,
        credits: course.credits,
        lectureHours: course.lectureHours,
        labHours: course.labHours,
        selfStudyHours: course.selfStudyHours,
        categoryId: course.categoryId,
        courseType: course.courseType,
        note: course.note,
        prerequisites: JSON.stringify(course.prerequisites),
      },
    })
  }
  console.log(`Inserted ${rawData.courses.length} courses`)

  // 4. Insert study plan entries (clear first to avoid duplicates on re-seed)
  await prisma.studyPlanEntry.deleteMany()
  for (const entry of rawData.studyPlan) {
    await prisma.studyPlanEntry.create({
      data: {
        year: entry.year,
        semester: entry.semester,
        courseCode: entry.courseCode,
        label: entry.label,
        credits: entry.credits,
        note: entry.note,
        isPlaceholder: entry.isPlaceholder,
      },
    })
  }
  console.log(`Inserted ${rawData.studyPlan.length} study plan entries`)

  // Verify counts
  const catCount = await prisma.category.count()
  const courseCount = await prisma.course.count()
  const planCount = await prisma.studyPlanEntry.count()
  console.log(`\nVerification:`)
  console.log(`  Categories: ${catCount} (expected 23)`)
  console.log(`  Courses: ${courseCount} (expected 113)`)
  console.log(`  StudyPlan: ${planCount} (expected 51)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
