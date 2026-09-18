import {
  pgTable,text,uuid,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations, users } from "./shared";

export const screeningEntityTypeEnum = pgEnum("screening_entity_type", ["partner","vendor","beneficiary","employee"]);
export const screeningResultEnum = pgEnum("screening_result", ["clear","potential_match","confirmed_match","pending_review"]);
export const screeningListEnum = pgEnum("screening_list", [
  "un_consolidated_list","ofac_sdn","eu_sanctions_list","uk_hmt_list","national_list","other",
]);

export const screeningRecords = pgTable("screening_records",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  entityType:     screeningEntityTypeEnum("entity_type").notNull(),
  entityId:       uuid("entity_id").notNull(),
  entityNameSnapshot: text("entity_name_snapshot").notNull(),
  screenedAgainst: screeningListEnum("screened_against").notNull(),
  screeningDate:  timestamp("screening_date",{withTimezone:true}).default(sql`now()`).notNull(),
  screenedBy:     uuid("screened_by").references(()=>users.id).notNull(),
  result:         screeningResultEnum("result").notNull(),
  referenceNumber: text("reference_number"),
  screeningNotes: text("screening_notes"),
  nextScreeningDue: timestamp("next_screening_due",{withTimezone:true}),
},(t)=>({
  orgIdx:    index("screening_org_idx").on(t.organizationId),
  entityIdx: index("screening_entity_idx").on(t.entityType, t.entityId),
}));
