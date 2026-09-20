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
import { count } from "drizzle-orm";
import { logger } from "./logger";

const imageUrls = [
  "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1504222490345-c075b600a6e2?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c7?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&w=900&q=80",
];

const categorySeeds = [
  ["Car Mechanic", "car-mechanic", "car"],
  ["Bike Mechanic", "bike-mechanic", "bike"],
  ["Auto / Rickshaw", "auto-rickshaw", "truck"],
  ["Truck", "truck", "truck"],
  ["Tyre & Wheel", "tyre-wheel", "circle"],
  ["Battery / Electrical", "battery-electrical", "battery"],
  ["AC Repair", "ac-repair", "snowflake"],
  ["Washing & Detailing", "washing-detailing", "droplets"],
  ["Denting / Painting", "denting-painting", "paintbrush"],
  ["General Repair", "general-repair", "wrench"],
] as const;

const serviceSeeds: Record<string, string[]> = {
  "car-mechanic": ["Engine diagnostics", "Oil change", "Brake service"],
  "bike-mechanic": ["Bike servicing", "Chain & clutch", "Puncture repair"],
  "auto-rickshaw": ["Auto repair", "CNG tuning", "Electrical work"],
  truck: ["Fleet servicing", "Engine overhaul", "Roadside repair"],
  "tyre-wheel": ["Wheel alignment", "Tyre replacement", "Puncture repair"],
  "battery-electrical": ["Battery replacement", "Alternator repair", "Jump start"],
  "ac-repair": ["Car AC service", "Gas refill", "Compressor repair"],
  "washing-detailing": ["Foam wash", "Interior detailing", "Ceramic coating"],
  "denting-painting": ["Dent removal", "Panel paint", "Bumper repair"],
  "general-repair": ["Multi-brand service", "Vehicle inspection", "Roadside help"],
};

const providerSeeds = [
  ["Harpreet Singh", "Singh Auto Care", "car-mechanic", "Patiala", 4.9, 128, "available", "approved"],
  ["Manpreet Kaur", "Kaur Motors", "car-mechanic", "Chandigarh", 4.8, 94, "available", "approved"],
  ["Gurpreet Saini", "Saini Car Clinic", "car-mechanic", "Mohali", 4.7, 76, "busy", "approved"],
  ["Rohit Sharma", "Sharma Auto Works", "car-mechanic", "Ludhiana", 4.6, 61, "available", "approved"],
  ["Amandeep Gill", "Gill Motor Garage", "bike-mechanic", "Amritsar", 4.9, 142, "available", "approved"],
  ["Jaskaran Bedi", "Bedi Two Wheeler Point", "bike-mechanic", "Patiala", 4.7, 88, "available", "approved"],
  ["Navjot Singh", "Navjot Bike House", "bike-mechanic", "Chandigarh", 4.5, 52, "closed", "approved"],
  ["Balwinder Kumar", "City Auto Experts", "auto-rickshaw", "Ludhiana", 4.8, 67, "available", "approved"],
  ["Sukhchain Singh", "Sukhchain Auto Service", "auto-rickshaw", "Mohali", 4.6, 45, "available", "approved"],
  ["Deepak Verma", "Verma Commercial Motors", "truck", "Amritsar", 4.8, 39, "busy", "approved"],
  ["Kamaljit Singh", "Kamal Truck Care", "truck", "Patiala", 4.4, 31, "available", "approved"],
  ["Ravinder Arora", "Arora Tyre House", "tyre-wheel", "Chandigarh", 4.9, 203, "available", "approved"],
  ["Simranjeet Kaur", "Simran Tyres & Wheels", "tyre-wheel", "Mohali", 4.7, 112, "available", "approved"],
  ["Pardeep Singh", "Pardeep Battery Point", "battery-electrical", "Ludhiana", 4.8, 87, "available", "approved"],
  ["Yuvraj Malhotra", "Malhotra Auto Electrics", "battery-electrical", "Amritsar", 4.5, 58, "closed", "approved"],
  ["Arjun Mehta", "CoolDrive AC Care", "ac-repair", "Chandigarh", 4.9, 124, "available", "approved"],
  ["Taranjit Singh", "Taran AC & Electrical", "ac-repair", "Patiala", 4.6, 70, "busy", "approved"],
  ["Karan Bansal", "ShineRide Detailing", "washing-detailing", "Mohali", 4.9, 156, "available", "approved"],
  ["Sahil Kapoor", "Kapoor Car Spa", "washing-detailing", "Amritsar", 4.6, 82, "available", "pending"],
  ["Vikram Ahuja", "Ahuja Denting Studio", "denting-painting", "Ludhiana", 4.8, 63, "available", "approved"],
  ["Mandeep Brar", "Brar Bodyworks", "denting-painting", "Patiala", 4.5, 48, "busy", "pending"],
  ["Gagandeep Sidhu", "Sidhu General Repairs", "general-repair", "Chandigarh", 4.7, 96, "available", "pending"],
] as const;

const cityCoordinates: Record<string, [number, number]> = {
  Patiala: [30.3398, 76.3869],
  Chandigarh: [30.7333, 76.7794],
  Mohali: [30.7046, 76.7179],
  Ludhiana: [30.901, 75.8573],
  Amritsar: [31.634, 74.8723],
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function seedDatabase() {
  const [{ value: existingProviders }] = await db
    .select({ value: count() })
    .from(providerProfilesTable);
  if (existingProviders > 0) return;

  await db.transaction(async (tx) => {
    const categoryRows = await tx
      .insert(categoriesTable)
      .values(
        categorySeeds.map(([name, slug, icon]) => ({ name, slug, icon })),
      )
      .returning();
    const categoryBySlug = new Map(categoryRows.map((row) => [row.slug, row]));

    const allServices = categorySeeds.flatMap(([, slug]) =>
      serviceSeeds[slug].map((name) => ({ categorySlug: slug, name })),
    );
    const serviceRows = await tx
      .insert(servicesTable)
      .values(
        allServices.map(({ categorySlug, name }) => ({
          categoryId: categoryBySlug.get(categorySlug)!.id,
          name,
        })),
      )
      .returning();
    const serviceByKey = new Map(
      serviceRows.map((row) => {
        const category = categoryRows.find((item) => item.id === row.categoryId)!;
        return [`${category.slug}:${row.name}`, row];
      }),
    );

    for (let i = 0; i < providerSeeds.length; i += 1) {
      const [name, shopName, categorySlug, city, rating, reviewCount, availability, status] =
        providerSeeds[i];
      const [latitude, longitude] = cityCoordinates[city];
      const owner = await tx
        .insert(appUsersTable)
        .values({
          clerkUserId: `seed_user_${i + 1}`,
          email: `owner${i + 1}@fixfinder.example`,
          role: "provider",
        })
        .returning({ id: appUsersTable.id });
      const provider = await tx
        .insert(providerProfilesTable)
        .values({
          ownerId: owner[0].id,
          categoryId: categoryBySlug.get(categorySlug)!.id,
          name,
          shopName,
          slug: slugify(shopName),
          experienceYears: 5 + (i % 13),
          phone: `+91 98${String(10000000 + i * 37123).slice(-8)}`,
          address: `${12 + i}, ${city} Service Road`,
          city,
          description: `${shopName} is a trusted local workshop helping drivers across ${city} with dependable repairs, clear advice, and same-day service when available.`,
          profilePhoto: imageUrls[i % imageUrls.length],
          latitude: latitude + (i % 3) * 0.004,
          longitude: longitude + (i % 4) * 0.004,
          rating,
          reviewCount,
          availability: availability as "available" | "busy" | "closed",
          status: status as "pending" | "approved",
        })
        .returning({ id: providerProfilesTable.id });
      const providerId = provider[0].id;
      await tx.insert(providerServicesTable).values(
        serviceSeeds[categorySlug].map((serviceName, serviceIndex) => ({
          providerId,
          serviceId: serviceByKey.get(`${categorySlug}:${serviceName}`)!.id,
          priceFrom: 350 + serviceIndex * 250 + (i % 4) * 50,
        })),
      );
      await tx.insert(providerPhotosTable).values([
        { providerId, url: imageUrls[i % imageUrls.length], sortOrder: 0 },
        { providerId, url: imageUrls[(i + 2) % imageUrls.length], sortOrder: 1 },
      ]);
      await tx.insert(workingHoursTable).values(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
          (day) => ({
            providerId,
            day,
            open: day === "Sunday" ? "10:00" : "09:00",
            close: day === "Sunday" ? "16:00" : "19:00",
            closed: false,
          }),
        ),
      );
      await tx.insert(reviewsTable).values([
        {
          providerId,
          author: ["Rahul", "Jaspreet", "Aarav", "Neha"][i % 4],
          rating: Math.min(5, rating),
          body: "Clear communication, fair pricing, and the work was done when promised.",
        },
        {
          providerId,
          author: ["Mehak", "Karan", "Sonia", "Harman"][(i + 1) % 4],
          rating: Math.max(4, rating - 0.4),
          body: "A helpful local team. They explained the issue before starting the repair.",
        },
      ]);
    }
  });
  logger.info("FixFinder demo marketplace data seeded");
}