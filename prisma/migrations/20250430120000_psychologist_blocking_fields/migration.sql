-- AlterTable
ALTER TABLE "Psychologists" ADD COLUMN "blockedUntil" TIMESTAMPTZ(6),
ADD COLUMN "blockedPermanently" BOOLEAN NOT NULL DEFAULT false;
