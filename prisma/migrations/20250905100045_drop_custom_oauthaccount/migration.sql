/*
  Warnings:

  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `pictureUrl` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "name",
DROP COLUMN "pictureUrl",
DROP COLUMN "role",
ALTER COLUMN "username" DROP NOT NULL;

-- DropEnum
DROP TYPE "public"."UserRole";
