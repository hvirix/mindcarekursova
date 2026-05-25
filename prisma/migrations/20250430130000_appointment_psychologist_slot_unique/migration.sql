-- DropIndex
DROP INDEX IF EXISTS "Appointments_psychologistId_appointmentDateTime_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Appointments_psychologistId_appointmentDateTime_key" ON "Appointments"("psychologistId", "appointmentDateTime");
