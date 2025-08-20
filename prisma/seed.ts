import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Crear conductor Jordan Talahua
  const driver = await prisma.driver.upsert({
    where: { phone: "0983983250" },
    update: {},
    create: {
      name: "Jordan Talahua",
      phone: "0983983250",
      plate: "ABC-123",
      location: "Latitud: -0.30244 | Longitud: -78.55807",
      isActive: true,
    },
  });

  console.log("✅ Driver created:", driver);
  console.log("🎉 Database seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error during seeding:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
