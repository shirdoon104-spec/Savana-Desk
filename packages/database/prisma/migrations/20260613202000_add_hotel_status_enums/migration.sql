-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('available', 'occupied', 'cleaning', 'maintenance', 'out_of_order');

-- CreateEnum
CREATE TYPE "StayStatus" AS ENUM ('active', 'checked_out');

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Room" ALTER COLUMN "status" TYPE "RoomStatus" USING "status"::"RoomStatus";
ALTER TABLE "Room" ALTER COLUMN "status" SET DEFAULT 'available';

-- AlterTable
ALTER TABLE "Stay" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Stay" ALTER COLUMN "status" TYPE "StayStatus" USING "status"::"StayStatus";
ALTER TABLE "Stay" ALTER COLUMN "status" SET DEFAULT 'active';
