-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskAssignmentEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedToId" TEXT,
    "previousAssigneeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskAssignmentEvent_taskId_createdAt_idx" ON "TaskAssignmentEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskAssignmentEvent_assignedById_idx" ON "TaskAssignmentEvent"("assignedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskAssignmentEvent_assignedToId_idx" ON "TaskAssignmentEvent"("assignedToId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TaskAssignmentEvent" ADD CONSTRAINT "TaskAssignmentEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskAssignmentEvent" ADD CONSTRAINT "TaskAssignmentEvent_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskAssignmentEvent" ADD CONSTRAINT "TaskAssignmentEvent_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TaskAssignmentEvent" ADD CONSTRAINT "TaskAssignmentEvent_previousAssigneeId_fkey" FOREIGN KEY ("previousAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
