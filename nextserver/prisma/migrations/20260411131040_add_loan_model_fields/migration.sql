-- CreateEnum
CREATE TYPE "transaction_type" AS ENUM ('purchase', 'booking', 'loan', 'free');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "booking_status" ADD VALUE 'loaned_out';
ALTER TYPE "booking_status" ADD VALUE 'returned';
ALTER TYPE "booking_status" ADD VALUE 'overdue';

-- AlterTable
ALTER TABLE "availability_schedules" ADD COLUMN     "loan_duration_days" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "loan_max_duration_days" INTEGER;

-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN     "deposit_amount" DECIMAL(10,2),
ADD COLUMN     "is_loan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loan_due_date" DATE,
ADD COLUMN     "loan_returned_at" TIMESTAMPTZ(6),
ADD COLUMN     "loan_start_date" DATE,
ADD COLUMN     "snapshot_transaction_type" "transaction_type";

-- AlterTable
ALTER TABLE "booking_schedule_snapshots" ADD COLUMN     "exception_override_loan_duration_days" INTEGER,
ADD COLUMN     "snapshot_loan_duration_days" INTEGER,
ADD COLUMN     "snapshot_loan_max_duration_days" INTEGER;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "deposit_status" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "deposit_total" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "offerings" ADD COLUMN     "deposit_amount" DECIMAL(10,2),
ADD COLUMN     "requires_deposit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transaction_type" "transaction_type" NOT NULL DEFAULT 'purchase';

-- AlterTable
ALTER TABLE "schedule_exceptions" ADD COLUMN     "override_loan_duration_days" INTEGER,
ADD COLUMN     "override_loan_max_duration_days" INTEGER;
