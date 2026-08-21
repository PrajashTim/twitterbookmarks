import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // D1 is configured by Wrangler at runtime. This local URL is only used by
    // Prisma's schema tooling when it needs a datasource value.
    url: "file:./prisma/dev.db",
  },
});
