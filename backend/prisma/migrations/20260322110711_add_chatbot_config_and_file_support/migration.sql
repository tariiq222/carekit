-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "intent" TEXT,
ADD COLUMN     "token_count" INTEGER,
ADD COLUMN     "tool_name" TEXT;

-- AlterTable
ALTER TABLE "chat_sessions" ADD COLUMN     "language" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "knowledge_base" ADD COLUMN     "chunk_index" INTEGER,
ADD COLUMN     "file_id" TEXT,
ADD COLUMN     "source" TEXT;

-- CreateTable
CREATE TABLE "chatbot_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base_files" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "chunks_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_config_key_key" ON "chatbot_config"("key");

-- CreateIndex
CREATE INDEX "chatbot_config_category_idx" ON "chatbot_config"("category");

-- CreateIndex
CREATE INDEX "knowledge_base_source_idx" ON "knowledge_base"("source");

-- CreateIndex
CREATE INDEX "knowledge_base_file_id_idx" ON "knowledge_base"("file_id");

-- AddForeignKey
ALTER TABLE "knowledge_base_files" ADD CONSTRAINT "knowledge_base_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
