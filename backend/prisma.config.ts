import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  // 1. スキーマファイルの場所（ちゃんと文字で指定！）
  schema: "prisma/schema.prisma",
  
  // 2. データベースの接続設定
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
