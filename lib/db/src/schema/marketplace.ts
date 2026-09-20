import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerStatusEnum = pgEnum("provider_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);

export const availabilityEnum = pgEnum("availability", [
  "available",
  "busy",
  "closed",
]);

export const appUsersTable = pgTable(
  "app_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: varchar("clerk_user_id", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull().default("customer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("app_users_clerk_user_id_idx").on(table.clerkUserId),
    uniqueIndex("app_users_email_idx").on(table.email),
  ],
);

export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    icon: varchar("icon", { length: 40 }).notNull().default("wrench"),
    active: boolean("active").notNull().default(true),
  },
  (table) => [uniqueIndex("categories_slug_idx").on(table.slug)],
);

export const servicesTable = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (table) => [
    uniqueIndex("services_category_name_idx").on(table.categoryId, table.name),
  ],
);

export const providerProfilesTable = pgTable(
  "provider_profiles",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => appUsersTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id),
    name: varchar("name", { length: 140 }).notNull(),
    shopName: varchar("shop_name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 200 }).notNull(),
    experienceYears: integer("experience_years").notNull().default(0),
    phone: varchar("phone", { length: 30 }).notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 80 }).notNull(),
    description: text("description").notNull(),
    profilePhoto: text("profile_photo").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    status: providerStatusEnum("status").notNull().default("pending"),
    availability: availabilityEnum("availability").notNull().default("available"),
    rating: doublePrecision("rating").notNull().default(0),
    reviewCount: integer("review_count").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("provider_profiles_slug_idx").on(table.slug),
    index("provider_profiles_city_idx").on(table.city),
    index("provider_profiles_status_idx").on(table.status),
    index("provider_profiles_category_idx").on(table.categoryId),
  ],
);

export const providerServicesTable = pgTable(
  "provider_services",
  {
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    serviceId: integer("service_id")
      .notNull()
      .references(() => servicesTable.id, { onDelete: "cascade" }),
    priceFrom: integer("price_from"),
  },
  (table) => [
    uniqueIndex("provider_services_pk").on(table.providerId, table.serviceId),
  ],
);

export const providerPhotosTable = pgTable(
  "provider_photos",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("provider_photos_provider_idx").on(table.providerId)],
);

export const workingHoursTable = pgTable(
  "working_hours",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    day: varchar("day", { length: 12 }).notNull(),
    open: varchar("open", { length: 8 }).notNull(),
    close: varchar("close", { length: 8 }).notNull(),
    closed: boolean("closed").notNull().default(false),
  },
  (table) => [
    uniqueIndex("working_hours_provider_day_idx").on(table.providerId, table.day),
  ],
);

export const reviewsTable = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    author: varchar("author", { length: 120 }).notNull(),
    rating: doublePrecision("rating").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reviews_provider_idx").on(table.providerId)],
);

export const enquiriesTable = pgTable(
  "enquiries",
  {
    id: serial("id").primaryKey(),
    providerId: integer("provider_id")
      .notNull()
      .references(() => providerProfilesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("enquiries_provider_idx").on(table.providerId)],
);

export const insertProviderSchema = createInsertSchema(providerProfilesTable);
export const insertEnquirySchema = createInsertSchema(enquiriesTable);
export type AppUser = typeof appUsersTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type ProviderProfile = typeof providerProfilesTable.$inferSelect;
export type ProviderService = typeof providerServicesTable.$inferSelect;
export type WorkingHour = typeof workingHoursTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type Enquiry = typeof enquiriesTable.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;