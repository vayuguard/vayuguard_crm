-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "departmentSubtype" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_department_idx" ON "Contact"("department");
