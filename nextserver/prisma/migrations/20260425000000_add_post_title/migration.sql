-- Add optional `title` column to community_posts.
-- Length capped at 100 chars; whitespace-only / empty-string are rejected
-- by the API but the DB still accepts a non-null length-1 minimum to be safe.

-- AlterTable
ALTER TABLE "public"."community_posts"
  ADD COLUMN "title" VARCHAR(100);

-- AddCheckConstraint
ALTER TABLE "public"."community_posts"
  ADD CONSTRAINT "community_posts_title_length"
  CHECK ("title" IS NULL OR length("title") BETWEEN 1 AND 100);
