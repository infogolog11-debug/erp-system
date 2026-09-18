import { text, timestamp, boolean, uuid, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const recordStatusEnum = pgEnum("record_status", [
  "draft","submitted","approved","rejected","done","cancelled",
]);

export const baseColumns = {
  id:         uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  status:     recordStatusEnum("status").default("draft").notNull(),
  createdBy:  uuid("created_by").notNull(),
  updatedBy:  uuid("updated_by"),
  createdAt:  timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
  updatedAt:  timestamp("updated_at",{withTimezone:true}).default(sql`now()`).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  archivedAt: timestamp("archived_at",{withTimezone:true}),
  archivedBy: uuid("archived_by"),
  notes:      text("notes"),
};
