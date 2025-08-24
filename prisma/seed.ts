import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Array de conductores a insertar
  const drivers = [
    /*{
      name: "Jordan Talahua",
      phone: "0969183227",
      plate: "XAA-123",
      location: null,
      isActive: true,
    },*/
    {
      name: "Edison Chavez",
      phone: "0983115611",
      plate: "MBG-7427",
      location: null,
      isActive: true,
    },
    {
      name: "Luis Enrique Cofre Guanoluisa",
      phone: "0998647904",
      plate: "PBR-1467",
      location: null,
      isActive: true,
    },
    {
      name: "Alcides Puruncajas",
      phone: "0981543131",
      plate: "XBB4481",
      location: null,
      isActive: true,
    },
    {
      name: "Marcelo Chasi",
      phone: "0984801014",
      plate: "XBB 6372",
      location: null,
      isActive: true,
    },
    {
      name: "Paco Arturo Ruiz Molina",
      phone: "0998006521",
      plate: "PDN 8981",
      location: null,
      isActive: true,
    },
    {
      name: "Dario Amores",
      phone: "0979372301",
      plate: "XAA.1846",
      location: null,
      isActive: true,
    },
    {
      name: "Jorge Chasi",
      phone: "0984834689",
      plate: "PCM 8823",
      location: null,
      isActive: true,
    },
    {
      name: "Jaime Pazuña",
      phone: "0987907957",
      plate: "PCY8314",
      location: null,
      isActive: true,
    },
    {
      name: "Luis Chasi",
      phone: "0986495984",
      plate: "XBC 3198",
      location: null,
      isActive: true,
    },
    {
      name: "Luis Guanoluisa",
      phone: "0969097240",
      plate: "PCV 6116",
      location: null,
      isActive: true,
    },
    {
      name: "Freddy Toapanta",
      phone: "0984921872",
      plate: "XAI 367",
      location: null,
      isActive: true,
    },
    {
      name: "Gregorio Pacheco Calvopiña",
      phone: "0984612874",
      plate: "XBA_3753",
      location: null,
      isActive: true,
    },
  ];

  console.log(`📝 Insertando ${drivers.length} conductores...`);

  // Insertar todos los conductores usando upsert para evitar duplicados
  for (const driverData of drivers) {
    const driver = await prisma.driver.upsert({
      where: { phone: driverData.phone },
      update: {
        name: driverData.name,
        plate: driverData.plate,
        location: driverData.location,
        isActive: driverData.isActive,
      },
      create: driverData,
    });
    console.log(`✅ Conductor creado/actualizado: ${driver.name} (${driver.plate})`);
  }

  console.log("🎉 Database seeding completed!");
  console.log(`📊 Total de conductores en la base de datos: ${await prisma.driver.count()}`);
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
