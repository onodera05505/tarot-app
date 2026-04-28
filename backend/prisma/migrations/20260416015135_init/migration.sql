-- CreateTable
CREATE TABLE "tarot_cards" (
    "id" SERIAL NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameJa" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "arcanaType" TEXT NOT NULL,
    "meaningUpright" TEXT NOT NULL,
    "meaningReversed" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarot_cards_pkey" PRIMARY KEY ("id")
);
