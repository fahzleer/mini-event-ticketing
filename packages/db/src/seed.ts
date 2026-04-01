import { db } from "./client"
import { events } from "./schema"

async function seed() {
  console.log("🌱 Seeding database...")

  await db.delete(events)

  await db.insert(events).values([
    {
      name: "Bangkok Tech Summit 2025",
      description:
        "Thailand's biggest gathering of developers and tech professionals. Expect world-class speakers and plenty of hands-on workshops.",
      totalTickets: 500,
      remainingTickets: 500,
      eventDate: new Date("2025-06-15T09:00:00Z"),
      venue: "BITEC Bang Na, Bangkok",
    },
    {
      name: "React & TypeScript Workshop",
      description:
        "A full-day intensive for devs who want to properly get to grips with React and TypeScript. Bring your laptop.",
      totalTickets: 50,
      remainingTickets: 50,
      eventDate: new Date("2025-07-20T08:00:00Z"),
      venue: "True Digital Park, Bangkok",
    },
    {
      name: "AI & Machine Learning Conference",
      description:
        "A regional conference on AI and ML. Meet researchers and engineers who are actually building this stuff.",
      totalTickets: 200,
      remainingTickets: 12,
      eventDate: new Date("2025-08-10T09:00:00Z"),
      venue: "Centara Grand, Bangkok",
    },
    {
      name: "Startup Pitch Night",
      description:
        "Founders pitch live to a room of 50+ investors. Whether you're pitching or watching, it's a good night.",
      totalTickets: 100,
      remainingTickets: 100,
      eventDate: new Date("2025-09-05T18:00:00Z"),
      venue: "WeWork Sathorn, Bangkok",
    },
    {
      name: "Cloud Native Day Thailand",
      description:
        "A deep dive into Kubernetes, Docker, and Cloud Native tech — led by engineers from the CNCF community.",
      totalTickets: 150,
      remainingTickets: 0,
      eventDate: new Date("2025-05-01T09:00:00Z"),
      venue: "AIS D.C. Building, Bangkok",
    },
  ])

  console.log("✅ Seeding complete!")
  process.exit(0)
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
