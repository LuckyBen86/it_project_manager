-- Migration: add logged_out_at to ressources for server-side JWT invalidation
ALTER TABLE "ressources" ADD COLUMN "logged_out_at" TIMESTAMP(3);
