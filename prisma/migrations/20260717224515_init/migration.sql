-- CreateTable
CREATE TABLE "Host" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "feedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Host_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventType" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "durationMin" INTEGER NOT NULL,
    "bufferBeforeMin" INTEGER NOT NULL,
    "bufferAfterMin" INTEGER NOT NULL,
    "minNoticeMin" INTEGER NOT NULL,
    "maxDaysAhead" INTEGER NOT NULL,
    "reminderLeadMin" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateOverride" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "DateOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackoutDate" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "BlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "inviteeName" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviteeTimezone" TEXT NOT NULL,
    "startUtc" TIMESTAMPTZ(3) NOT NULL,
    "endUtc" TIMESTAMPTZ(3) NOT NULL,
    "blockStartUtc" TIMESTAMPTZ(3) NOT NULL,
    "blockEndUtc" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "icsUid" TEXT NOT NULL,
    "icsSequence" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,
    "cancelledBy" TEXT,
    "reminderSentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Host_email_key" ON "Host"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Host_feedToken_key" ON "Host"("feedToken");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_slug_key" ON "EventType"("slug");

-- CreateIndex
CREATE INDEX "EventType_hostId_idx" ON "EventType"("hostId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_hostId_idx" ON "AvailabilityRule"("hostId");

-- CreateIndex
CREATE INDEX "DateOverride_hostId_date_idx" ON "DateOverride"("hostId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BlackoutDate_hostId_date_key" ON "BlackoutDate"("hostId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_icsUid_key" ON "Booking"("icsUid");

-- CreateIndex
CREATE INDEX "Booking_hostId_status_idx" ON "Booking"("hostId", "status");

-- CreateIndex
CREATE INDEX "Booking_eventTypeId_idx" ON "Booking"("eventTypeId");

-- CreateIndex
CREATE INDEX "Booking_startUtc_idx" ON "Booking"("startUtc");

-- AddForeignKey
ALTER TABLE "EventType" ADD CONSTRAINT "EventType_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateOverride" ADD CONSTRAINT "DateOverride_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackoutDate" ADD CONSTRAINT "BlackoutDate_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "Host"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Raw SQL below cannot be expressed in the Prisma schema DSL.

-- Constrain status to the known set (kept as a CHECK, not an enum, so new
-- states are a migration away).
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_status_check"
  CHECK ("status" IN ('confirmed', 'cancelled'));

-- Range operators over gist plus an equality column need btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- The authoritative double-booking guard: no two confirmed bookings for the
-- same host may have overlapping buffered block ranges. Buffers are frozen into
-- blockStartUtc/blockEndUtc at booking time, so "no overlap" means "buffers
-- respected". Cancelled rows leave the constraint's scope and free their slot.
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "hostId" WITH =,
    tstzrange("blockStartUtc", "blockEndUtc") WITH &&
  ) WHERE ("status" = 'confirmed');
