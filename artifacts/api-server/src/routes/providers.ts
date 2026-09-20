import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  appUsersTable,
  categoriesTable,
  enquiriesTable,
  providerPhotosTable,
  providerProfilesTable,
  providerServicesTable,
  reviewsTable,
  servicesTable,
  workingHoursTable,
} from "@workspace/db";
import {
  CreateEnquiryBody,
  CreateAdminCategoryBody,
  CreateProviderBody,
  GetProviderParams,
  ListAdminProvidersQueryParams,
  ListProvidersQueryParams,
  UpdateProviderBody,
  UpdateAdminCategoryBody,
  UpdateAdminCategoryParams,
  UpdateProviderParams,
  UpdateProviderStatusBody,
  UpdateProviderStatusParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type AuthenticatedRequest = Request & { userId?: string };

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const userId =
    auth?.userId || (auth?.sessionClaims?.userId as string | undefined);
  if (!userId) {
    res.status(401).json({ error: "Sign in is required for this action." });
    return;
  }
  req.userId = userId;
  next();
}

async function getLocalUserId(clerkUserId: string) {
  const rows = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.clerkUserId, clerkUserId))
    .limit(1);
  if (rows[0]) return rows[0].id;
  const created = await db
    .insert(appUsersTable)
    .values({
      clerkUserId,
      email: `${clerkUserId}@clerk.local`,
      role: "provider",
    })
    .returning({ id: appUsersTable.id });
  return created[0].id;
}

async function isAdmin(req: AuthenticatedRequest) {
  if (!req.userId) return false;
  const auth = getAuth(req);
  const claims = auth?.sessionClaims as
    | { metadata?: { role?: string }; publicMetadata?: { role?: string } }
    | undefined;
  if (
    claims?.metadata?.role === "admin" ||
    claims?.publicMetadata?.role === "admin" ||
    process.env.ADMIN_CLERK_USER_ID === req.userId
  ) {
    return true;
  }
  const user = await db
    .select({ role: appUsersTable.role })
    .from(appUsersTable)
    .where(eq(appUsersTable.clerkUserId, req.userId))
    .limit(1);
  return user[0]?.role === "admin";
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : new Date().toISOString();
}

async function providerResponse(providerId: number) {
  const rows = await db
    .select({
      provider: providerProfilesTable,
      category: categoriesTable,
      serviceName: servicesTable.name,
      priceFrom: providerServicesTable.priceFrom,
      photoUrl: providerPhotosTable.url,
      photoOrder: providerPhotosTable.sortOrder,
      hour: workingHoursTable,
      review: reviewsTable,
      ownerEmail: appUsersTable.email,
    })
    .from(providerProfilesTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, providerProfilesTable.categoryId))
    .innerJoin(appUsersTable, eq(appUsersTable.id, providerProfilesTable.ownerId))
    .leftJoin(providerServicesTable, eq(providerServicesTable.providerId, providerId))
    .leftJoin(servicesTable, eq(servicesTable.id, providerServicesTable.serviceId))
    .leftJoin(providerPhotosTable, eq(providerPhotosTable.providerId, providerId))
    .leftJoin(workingHoursTable, eq(workingHoursTable.providerId, providerId))
    .leftJoin(reviewsTable, eq(reviewsTable.providerId, providerId))
    .where(eq(providerProfilesTable.id, providerId));

  const first = rows[0];
  if (!first) return null;
  const services = new Map<string, { name: string; priceFrom: number | null }>();
  const photos = new Map<number, string>();
  const hours = new Map<string, typeof first.hour>();
  const reviews = new Map<number, typeof first.review>();
  for (const row of rows) {
    if (row.serviceName) services.set(row.serviceName, { name: row.serviceName, priceFrom: row.priceFrom });
    if (row.photoUrl !== null) photos.set(row.photoOrder ?? 0, row.photoUrl);
    if (row.hour) hours.set(row.hour.day, row.hour);
    if (row.review) reviews.set(row.review.id, row.review);
  }
  return {
    id: first.provider.id,
    name: first.provider.name,
    shopName: first.provider.shopName,
    slug: first.provider.slug,
    category: {
      id: first.category.id,
      name: first.category.name,
      slug: first.category.slug,
      icon: first.category.icon,
      providerCount: 0,
    },
    services: [...services.values()],
    experienceYears: first.provider.experienceYears,
    phone: first.provider.phone,
    address: first.provider.address,
    city: first.provider.city,
    description: first.provider.description,
    profilePhoto: first.provider.profilePhoto,
    shopPhotos: [...photos.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, url]) => url),
    rating: first.provider.rating,
    reviewCount: first.provider.reviewCount,
    distanceKm: null,
    availability: first.provider.availability,
    verified: first.provider.status === "approved",
    status: first.provider.status,
    workingHours: [...hours.values()].map((hour) => ({
      day: hour!.day,
      open: hour!.open,
      close: hour!.close,
      closed: hour!.closed,
    })),
    reviews: [...reviews.values()].map((review) => ({
      id: review!.id,
      author: review!.author,
      rating: review!.rating,
      body: review!.body,
      createdAt: toIso(review!.createdAt),
    })),
    coordinates: {
      lat: first.provider.latitude,
      lng: first.provider.longitude,
    },
    ownerEmail: first.ownerEmail,
    submittedAt: toIso(first.provider.submittedAt),
  };
}

async function categoryResponse(categoryId: number) {
  const [row] = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      icon: categoriesTable.icon,
      providerCount: count(providerProfilesTable.id),
    })
    .from(categoriesTable)
    .leftJoin(
      providerProfilesTable,
      and(
        eq(providerProfilesTable.categoryId, categoriesTable.id),
        eq(providerProfilesTable.status, "approved"),
      ),
    )
    .where(eq(categoriesTable.id, categoryId))
    .groupBy(categoriesTable.id)
    .limit(1);
  return row ?? null;
}

router.get("/categories", async (_req, res) => {
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      icon: categoriesTable.icon,
      providerCount: count(providerProfilesTable.id),
    })
    .from(categoriesTable)
    .leftJoin(
      providerProfilesTable,
      and(
        eq(providerProfilesTable.categoryId, categoriesTable.id),
        eq(providerProfilesTable.status, "approved"),
      ),
    )
    .where(eq(categoriesTable.active, true))
    .groupBy(categoriesTable.id)
    .orderBy(asc(categoriesTable.id));
  res.json(rows);
});

router.get("/providers", async (req, res) => {
  const query = ListProvidersQueryParams.parse(req.query);
  const filters = [
    eq(providerProfilesTable.status, "approved"),
    query.city ? eq(providerProfilesTable.city, query.city) : undefined,
    query.category ? eq(categoriesTable.slug, query.category) : undefined,
    query.minRating !== undefined
      ? sql`${providerProfilesTable.rating} >= ${query.minRating}`
      : undefined,
    query.openNow ? eq(providerProfilesTable.availability, "available") : undefined,
    query.q
      ? or(
          ilike(providerProfilesTable.name, `%${query.q}%`),
          ilike(providerProfilesTable.shopName, `%${query.q}%`),
          ilike(providerProfilesTable.description, `%${query.q}%`),
          ilike(providerProfilesTable.city, `%${query.q}%`),
          ilike(servicesTable.name, `%${query.q}%`),
        )
      : undefined,
  ].filter(Boolean);
  const providerRows = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .innerJoin(categoriesTable, eq(categoriesTable.id, providerProfilesTable.categoryId))
    .leftJoin(providerServicesTable, eq(providerServicesTable.providerId, providerProfilesTable.id))
    .leftJoin(servicesTable, eq(servicesTable.id, providerServicesTable.serviceId))
    .where(and(...filters))
    .groupBy(providerProfilesTable.id)
    .orderBy(desc(providerProfilesTable.rating))
    .limit(query.limit ?? 24);
  const items = (
    await Promise.all(providerRows.map((row) => providerResponse(row.id)))
  ).filter(Boolean);
  const citiesRows = await db
    .selectDistinct({ city: providerProfilesTable.city })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.status, "approved"))
    .orderBy(asc(providerProfilesTable.city));
  res.json({ items, total: items.length, cities: citiesRows.map((row) => row.city) });
});

router.get("/providers/mine", requireAuth, async (req: AuthenticatedRequest, res) => {
  const localUserId = await getLocalUserId(req.userId!);
  const [row] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.ownerId, localUserId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No provider profile found." });
    return;
  }
  const provider = await providerResponse(row.id);
  res.json(provider);
});

router.get("/providers/:providerId", async (req, res) => {
  const params = GetProviderParams.parse(req.params);
  const provider = await providerResponse(params.providerId);
  if (!provider || (provider.status !== "approved" && provider.status !== "pending")) {
    res.status(404).json({ error: "Provider not found." });
    return;
  }
  res.json(provider);
});

router.post("/providers", requireAuth, async (req: AuthenticatedRequest, res) => {
  const data = CreateProviderBody.parse(req.body);
  const localUserId = await getLocalUserId(req.userId!);
  const existing = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.ownerId, localUserId))
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "You already have a provider profile." });
    return;
  }
  const category = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.slug, data.categorySlug))
    .limit(1);
  if (!category[0]) {
    res.status(400).json({ error: "Choose a valid category." });
    return;
  }
  const created = await db
    .insert(providerProfilesTable)
    .values({
      ownerId: localUserId,
      categoryId: category[0].id,
      name: data.name,
      shopName: data.shopName,
      slug: `${data.shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
      experienceYears: data.experienceYears,
      phone: data.phone,
      address: data.address,
      city: data.city,
      description: data.description,
      profilePhoto: data.profilePhoto,
      latitude: 30.7333,
      longitude: 76.7794,
      availability: data.availability,
      status: "pending",
    })
    .returning({ id: providerProfilesTable.id });
  const providerId = created[0].id;
  const services = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.categoryId, category[0].id));
  const selectedServices = services.filter((service) => data.serviceNames.includes(service.name));
  if (selectedServices.length) {
    await db.insert(providerServicesTable).values(
      selectedServices.map((service) => ({ providerId, serviceId: service.id })),
    );
  }
  await db.insert(providerPhotosTable).values(
    data.shopPhotos.map((url, sortOrder) => ({ providerId, url, sortOrder })),
  );
  await db.insert(workingHoursTable).values(
    data.workingHours.map((hour) => ({ providerId, ...hour })),
  );
  res.status(201).json(await providerResponse(providerId));
});

router.patch("/providers/:providerId/edit", requireAuth, async (req: AuthenticatedRequest, res) => {
  const params = UpdateProviderParams.parse(req.params);
  const data = UpdateProviderBody.parse(req.body);
  const localUserId = await getLocalUserId(req.userId!);
  const owned = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(and(eq(providerProfilesTable.id, params.providerId), eq(providerProfilesTable.ownerId, localUserId)))
    .limit(1);
  if (!owned[0]) {
    res.status(403).json({ error: "You can only edit your own profile." });
    return;
  }
  await db
    .update(providerProfilesTable)
    .set({
      name: data.name,
      shopName: data.shopName,
      experienceYears: data.experienceYears,
      phone: data.phone,
      address: data.address,
      city: data.city,
      description: data.description,
      profilePhoto: data.profilePhoto,
      availability: data.availability,
      status: "pending",
    })
    .where(eq(providerProfilesTable.id, params.providerId));
  res.json(await providerResponse(params.providerId));
});

router.get("/dashboard/stats", async (_req, res) => {
  const [total] = await db.select({ value: count() }).from(providerProfilesTable);
  const [verified] = await db
    .select({ value: count() })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.status, "approved"));
  const [pending] = await db
    .select({ value: count() })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.status, "pending"));
  const [cities] = await db
    .select({ value: sql<number>`count(distinct ${providerProfilesTable.city})` })
    .from(providerProfilesTable);
  const [reviews] = await db.select({ value: count() }).from(reviewsTable);
  res.json({
    totalProviders: total.value,
    verifiedProviders: verified.value,
    pendingProviders: pending.value,
    citiesCovered: Number(cities.value),
    totalReviews: reviews.value,
  });
});

router.post("/admin/categories", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }
  const data = CreateAdminCategoryBody.parse(req.body);
  const [category] = await db
    .insert(categoriesTable)
    .values({
      name: data.name,
      slug: data.slug,
      icon: data.icon,
      active: data.active ?? true,
    })
    .returning({ id: categoriesTable.id });
  res.status(201).json(await categoryResponse(category.id));
});

router.patch("/admin/categories/:categoryId", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }
  const params = UpdateAdminCategoryParams.parse(req.params);
  const data = UpdateAdminCategoryBody.parse(req.body);
  const [updated] = await db
    .update(categoriesTable)
    .set(data)
    .where(eq(categoriesTable.id, params.categoryId))
    .returning({ id: categoriesTable.id });
  if (!updated) {
    res.status(404).json({ error: "Category not found." });
    return;
  }
  res.json(await categoryResponse(updated.id));
});

router.get("/admin/providers", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }
  const query = ListAdminProvidersQueryParams.parse(req.query);
  const statusFilter = query.status && query.status !== "all" ? eq(providerProfilesTable.status, query.status) : undefined;
  const rows = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(statusFilter);
  const providers = await Promise.all(rows.map((row) => providerResponse(row.id)));
  res.json(providers.filter(Boolean));
});

router.patch("/admin/providers/:providerId/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!(await isAdmin(req))) {
    res.status(403).json({ error: "Admin access is required." });
    return;
  }
  const params = UpdateProviderStatusParams.parse(req.params);
  const data = UpdateProviderStatusBody.parse(req.body);
  const updated = await db
    .update(providerProfilesTable)
    .set({ status: data.status })
    .where(eq(providerProfilesTable.id, params.providerId))
    .returning({ id: providerProfilesTable.id });
  if (!updated[0]) {
    res.status(404).json({ error: "Provider not found." });
    return;
  }
  res.json(await providerResponse(params.providerId));
});

router.post("/enquiries", async (req, res) => {
  const data = CreateEnquiryBody.parse(req.body);
  const provider = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.id, data.providerId))
    .limit(1);
  if (!provider[0]) {
    res.status(400).json({ error: "Provider not found." });
    return;
  }
  const [created] = await db.insert(enquiriesTable).values(data).returning();
  logger.info({ providerId: data.providerId }, "New FixFinder enquiry received");
  res.status(201).json({
    ...created,
    createdAt: toIso(created.createdAt),
  });
});

export default router;