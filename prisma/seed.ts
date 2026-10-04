import {
  CampaignChannel,
  CampaignStatus,
  InvoiceStatus,
  LeadStatus,
  PaymentStatus,
  PrismaClient,
  Priority,
  QuotationStatus,
  RoleSlug,
  TaskStatus,
  TaskType,
  TicketStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  ROLE_PERMISSION_MAP,
} from "../src/lib/permissions";

const prisma = new PrismaClient();

const ROLE_DEFS: { slug: RoleSlug; name: string; description: string }[] = [
  { slug: "SUPER_ADMIN", name: "Super Admin", description: "Full system access" },
  { slug: "ADMIN", name: "Admin", description: "Administrative access" },
  { slug: "SALES_MANAGER", name: "Sales Manager", description: "Manages sales team" },
  { slug: "SALES_EXECUTIVE", name: "Sales Executive", description: "Handles leads and deals" },
  { slug: "MARKETING", name: "Marketing", description: "Campaigns and lead sources" },
  { slug: "SUPPORT", name: "Support", description: "Customer support tickets" },
  { slug: "ACCOUNTANT", name: "Accountant", description: "Invoices and payments" },
  { slug: "VIEWER", name: "Viewer", description: "Read-only access" },
];

async function seedPermissionsAndRoles() {
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, module: perm.module },
      create: {
        key: perm.key,
        name: perm.name,
        module: perm.module,
        description: perm.name,
      },
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const byKey = Object.fromEntries(permissionRows.map((p) => [p.key, p.id]));

  for (const role of ROLE_DEFS) {
    const created = await prisma.role.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description },
      create: role,
    });

    const map = ROLE_PERMISSION_MAP[role.slug];
    const keys =
      map === "*" ? ([...ALL_PERMISSION_KEYS] as string[]) : (map as string[]);

    await prisma.rolePermission.deleteMany({ where: { roleId: created.id } });
    await prisma.rolePermission.createMany({
      data: keys.map((key) => ({
        roleId: created.id,
        permissionId: byKey[key],
      })),
      skipDuplicates: true,
    });
  }
}

async function seedUsers() {
  const roles = await prisma.role.findMany();
  const roleBySlug = Object.fromEntries(roles.map((r) => [r.slug, r.id]));
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const users = [
    { email: "admin@vayuguard.com", name: "Super Admin", role: "SUPER_ADMIN" as RoleSlug, dept: "Management", designation: "CEO" },
    { email: "manager@vayuguard.com", name: "Priya Patel", role: "SALES_MANAGER" as RoleSlug, dept: "Sales", designation: "Sales Manager" },
    { email: "sales1@vayuguard.com", name: "Rohan Mehta", role: "SALES_EXECUTIVE" as RoleSlug, dept: "Sales", designation: "Sales Executive" },
    { email: "sales2@vayuguard.com", name: "Neha Gupta", role: "SALES_EXECUTIVE" as RoleSlug, dept: "Sales", designation: "Sales Executive" },
    { email: "marketing@vayuguard.com", name: "Kabir Singh", role: "MARKETING" as RoleSlug, dept: "Marketing", designation: "Marketing Lead" },
    { email: "support@vayuguard.com", name: "Ananya Iyer", role: "SUPPORT" as RoleSlug, dept: "Support", designation: "Support Lead" },
    { email: "accounts@vayuguard.com", name: "Vikram Rao", role: "ACCOUNTANT" as RoleSlug, dept: "Finance", designation: "Accountant" },
    { email: "viewer@vayuguard.com", name: "Sana Khan", role: "VIEWER" as RoleSlug, dept: "Operations", designation: "Analyst" },
  ];

  const createdUsers = [];
  for (const [index, u] of users.entries()) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        roleId: roleBySlug[u.role],
        isActive: true,
      },
      create: {
        email: u.email,
        name: u.name,
        passwordHash,
        roleId: roleBySlug[u.role],
        isActive: true,
      },
    });

    await prisma.employeeProfile.upsert({
      where: { userId: user.id },
      update: {
        department: u.dept,
        designation: u.designation,
        employeeCode: `VG-${1001 + index}`,
        phone: `98765${String(10000 + index).slice(-5)}`,
        joiningDate: new Date("2024-01-15"),
      },
      create: {
        userId: user.id,
        department: u.dept,
        designation: u.designation,
        employeeCode: `VG-${1001 + index}`,
        phone: `98765${String(10000 + index).slice(-5)}`,
        joiningDate: new Date("2024-01-15"),
      },
    });

    createdUsers.push(user);
  }

  return createdUsers;
}

async function seedPipeline() {
  const pipeline = await prisma.pipeline.upsert({
    where: { id: "default-pipeline" },
    update: { name: "Default Sales Pipeline", isDefault: true },
    create: {
      id: "default-pipeline",
      name: "Default Sales Pipeline",
      description: "Standard VayuGuard sales stages",
      isDefault: true,
    },
  });

  const stages = [
    { name: "New Lead", slug: "new_lead", probability: 10, position: 1 },
    { name: "Contacted", slug: "contacted", probability: 20, position: 2 },
    { name: "Qualified", slug: "qualified", probability: 40, position: 3 },
    { name: "Proposal Sent", slug: "proposal_sent", probability: 60, position: 4 },
    { name: "Negotiation", slug: "negotiation", probability: 75, position: 5 },
    { name: "Won", slug: "won", probability: 100, position: 6, isWon: true },
    { name: "Lost", slug: "lost", probability: 0, position: 7, isLost: true },
    { name: "Hold", slug: "hold", probability: 30, position: 8 },
  ];

  for (const stage of stages) {
    await prisma.pipelineStage.upsert({
      where: {
        pipelineId_slug: { pipelineId: pipeline.id, slug: stage.slug },
      },
      update: {
        name: stage.name,
        probability: stage.probability,
        position: stage.position,
        isWon: stage.isWon ?? false,
        isLost: stage.isLost ?? false,
      },
      create: {
        pipelineId: pipeline.id,
        name: stage.name,
        slug: stage.slug,
        probability: stage.probability,
        position: stage.position,
        isWon: stage.isWon ?? false,
        isLost: stage.isLost ?? false,
      },
    });
  }

  return pipeline;
}

async function main() {
  console.log("Seeding VayuGuard CRM...");

  await seedPermissionsAndRoles();
  const users = await seedUsers();
  void users;

  await prisma.companySettings.upsert({
    where: { id: "company-settings" },
    update: {
      companyName: "VayuGuard",
      brandPrimary: "#0d9488",
      brandSecondary: "#0f766e",
      gstNumber: "27AABCV1234A1Z5",
      panNumber: "AABCV1234A",
      currency: "INR",
      timezone: "Asia/Kolkata",
      email: "hello@vayuguard.com",
      phone: "+91 98765 43210",
      address: "Pune, Maharashtra, India",
      featureFlags: {
        aiEnabled: false,
        googleCalendarSync: true,
        whatsappCampaigns: true,
      },
    },
    create: {
      id: "company-settings",
      companyName: "VayuGuard",
      brandPrimary: "#0d9488",
      brandSecondary: "#0f766e",
      gstNumber: "27AABCV1234A1Z5",
      panNumber: "AABCV1234A",
      currency: "INR",
      timezone: "Asia/Kolkata",
      email: "hello@vayuguard.com",
      phone: "+91 98765 43210",
      address: "Pune, Maharashtra, India",
      featureFlags: {
        aiEnabled: false,
        googleCalendarSync: true,
        whatsappCampaigns: true,
      },
    },
  });

  const pipeline = await seedPipeline();

  // Production / default: system data only (roles, users, settings, pipeline).
  // Sample leads/customers/invoices etc. only when SEED_DEMO=true.
  if (process.env.SEED_DEMO !== "true") {
    console.log("System seed complete — no demo CRM records created.");
    console.log("Tip: set SEED_DEMO=true to also load sample data.");
    console.log("Login: admin@vayuguard.com / Password@123");
    return;
  }

  console.log("SEED_DEMO=true — loading sample CRM data…");
  const admin = users[0];
  const sales1 = users[2];
  const sales2 = users[3];
  const support = users[5];

  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { position: "asc" },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-1" },
    update: {},
    create: {
      id: "seed-campaign-1",
      name: "Q1 Air Quality Awareness",
      channel: CampaignChannel.EMAIL,
      status: CampaignStatus.COMPLETED,
      subject: "Protect your facility air quality",
      content: "Discover VayuGuard industrial air monitoring solutions.",
      budget: 150000,
      spent: 98000,
      createdById: admin.id,
      startedAt: new Date("2026-01-10"),
      completedAt: new Date("2026-02-15"),
      metrics: {
        create: {
          sentCount: 1200,
          openCount: 540,
          clickCount: 180,
          replyCount: 42,
          leadCount: 65,
          revenue: 420000,
        },
      },
    },
  });

  const categories = ["Sensors", "Software", "Services", "Accessories"];
  for (const name of categories) {
    await prisma.productCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  const sensorCat = await prisma.productCategory.findUniqueOrThrow({
    where: { name: "Sensors" },
  });
  const softwareCat = await prisma.productCategory.findUniqueOrThrow({
    where: { name: "Software" },
  });

  const products = [
    {
      sku: "VG-AQ-100",
      name: "AirGuard Pro Sensor",
      price: 45000,
      gstPercent: 18,
      categoryId: sensorCat.id,
      inventory: 120,
      description: "Industrial-grade multi-gas air quality sensor",
    },
    {
      sku: "VG-AQ-200",
      name: "AirGuard Ultra Hub",
      price: 89000,
      gstPercent: 18,
      categoryId: sensorCat.id,
      inventory: 45,
      description: "Central hub with edge analytics",
    },
    {
      sku: "VG-SW-CLOUD",
      name: "VayuCloud Analytics",
      price: 25000,
      gstPercent: 18,
      categoryId: softwareCat.id,
      inventory: 999,
      description: "Annual cloud analytics subscription",
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: p,
      create: { ...p, images: [], isActive: true, createdById: admin.id },
    });
  }

  const tags = ["Hot", "Enterprise", "SME", "Government", "Follow-up"];
  for (const name of tags) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  const allTags = await prisma.tag.findMany();

  const companies = [
    "GreenForge Industries",
    "Nimbus Manufacturing",
    "Aether Labs",
    "Pinnacle Pharma",
    "Urban Metro Corp",
    "Solaris Energy",
    "Harbor Logistics",
    "Crest Healthcare",
    "Vertex Automotive",
    "Indigo Textiles",
  ];

  const sources = ["Website", "Referral", "LinkedIn", "Campaign", "Cold Call", "Trade Show"];
  const statuses = Object.values(LeadStatus);
  const leadIds: string[] = [];

  for (let i = 1; i <= 55; i++) {
    const company = companies[i % companies.length];
    const status = statuses[i % statuses.length];
    const assignee = i % 2 === 0 ? sales1 : sales2;
    const lead = await prisma.lead.upsert({
      where: { leadNumber: `LD-2026-${String(i).padStart(4, "0")}` },
      update: {},
      create: {
        leadNumber: `LD-2026-${String(i).padStart(4, "0")}`,
        name: `Contact ${i}`,
        company,
        industry: i % 3 === 0 ? "Manufacturing" : "Healthcare",
        email: `contact${i}@${company.toLowerCase().replace(/\s+/g, "")}.com`,
        phone: `98${String(70000000 + i).slice(-8)}`,
        whatsapp: `98${String(70000000 + i).slice(-8)}`,
        website: `https://www.${company.toLowerCase().replace(/\s+/g, "")}.com`,
        address: `${i} Industrial Park`,
        city: i % 2 === 0 ? "Pune" : "Bengaluru",
        state: i % 2 === 0 ? "Maharashtra" : "Karnataka",
        country: "India",
        pinCode: i % 2 === 0 ? "411001" : "560001",
        source: sources[i % sources.length],
        campaignId: i % 4 === 0 ? campaign.id : null,
        status,
        priority: i % 5 === 0 ? Priority.HIGH : Priority.MEDIUM,
        estimatedDealValue: 50000 + i * 7500,
        expectedClosingDate: new Date(Date.now() + i * 86400000 * 3),
        notes: `Seeded opportunity for ${company}`,
        assignedToId: assignee.id,
        createdById: admin.id,
        updatedById: admin.id,
        tags: {
          create: [{ tagId: allTags[i % allTags.length].id }],
        },
        activities: {
          create: [
            {
              type: "NOTE",
              title: "Lead created",
              description: "Lead imported from seed data",
              userId: admin.id,
            },
            {
              type: "STATUS",
              title: `Status set to ${status}`,
              userId: assignee.id,
            },
          ],
        },
      },
    });
    leadIds.push(lead.id);
  }

  const customers = [];
  for (let i = 1; i <= 12; i++) {
    const company = companies[(i - 1) % companies.length];
    const customer = await prisma.customer.upsert({
      where: { customerNumber: `CU-2026-${String(i).padStart(4, "0")}` },
      update: {},
      create: {
        customerNumber: `CU-2026-${String(i).padStart(4, "0")}`,
        name: company,
        legalName: `${company} Pvt Ltd`,
        industry: "Manufacturing",
        email: `accounts@${company.toLowerCase().replace(/\s+/g, "")}.com`,
        phone: `91${String(80000000 + i).slice(-8)}`,
        gstNumber: `27AABC${String(1000 + i)}A1Z5`,
        panNumber: `AABC${String(1000 + i)}A`,
        billingAddress: `${i} Business Avenue`,
        billingCity: "Pune",
        billingState: "Maharashtra",
        billingCountry: "India",
        billingPinCode: "411001",
        shippingAddress: `${i} Warehouse Road`,
        shippingCity: "Pune",
        shippingState: "Maharashtra",
        shippingCountry: "India",
        shippingPinCode: "411014",
        notes: "Key strategic account",
        assignedToId: sales1.id,
        createdById: admin.id,
        updatedById: admin.id,
        contacts: {
          create: [
            {
              name: `Decision Maker ${i}`,
              designation: "Plant Head",
              email: `dm${i}@example.com`,
              phone: `99${String(60000000 + i).slice(-8)}`,
              whatsapp: `99${String(60000000 + i).slice(-8)}`,
              department: "Operations",
              relationshipScore: 60 + (i % 30),
              linkedinUrl: "https://linkedin.com",
            },
          ],
        },
        projects: {
          create: [
            {
              name: `${company} Monitoring Rollout`,
              description: "Phase-1 sensor deployment",
              status: "ACTIVE",
              startDate: new Date("2026-01-01"),
            },
          ],
        },
      },
      include: { contacts: true },
    });
    customers.push(customer);
  }

  for (let i = 0; i < 20; i++) {
    const stage = stages[i % stages.length];
    await prisma.deal.create({
      data: {
        title: `Deal ${i + 1} - ${companies[i % companies.length]}`,
        pipelineId: pipeline.id,
        stageId: stage.id,
        leadId: leadIds[i],
        customerId: customers[i % customers.length]?.id,
        assignedToId: i % 2 === 0 ? sales1.id : sales2.id,
        expectedRevenue: 100000 + i * 25000,
        probability: stage.probability,
        expectedCloseDate: new Date(Date.now() + (i + 5) * 86400000),
        position: i,
        createdById: admin.id,
        updatedById: admin.id,
        stageHistory: {
          create: {
            toStageId: stage.id,
            changedById: admin.id,
            note: "Initial stage",
          },
        },
      },
    });
  }

  for (let i = 1; i <= 25; i++) {
    await prisma.task.create({
      data: {
        title: `Follow up task #${i}`,
        description: "Call the prospect and update notes",
        type: i % 3 === 0 ? TaskType.CALL : TaskType.FOLLOW_UP,
        status: i % 4 === 0 ? TaskStatus.DONE : TaskStatus.TODO,
        priority: i % 5 === 0 ? Priority.HIGH : Priority.MEDIUM,
        dueAt: new Date(Date.now() + (i - 5) * 86400000),
        assignedToId: i % 2 === 0 ? sales1.id : sales2.id,
        leadId: leadIds[i % leadIds.length],
        createdById: admin.id,
      },
    });
  }

  await prisma.todoList.create({
    data: {
      name: "Weekly Sales Checklist",
      ownerId: sales1.id,
      items: {
        create: [
          { title: "Review pipeline", position: 1 },
          { title: "Send pending quotes", position: 2 },
          { title: "Update CRM notes", position: 3, isDone: true },
        ],
      },
    },
  });

  for (let i = 1; i <= 8; i++) {
    const start = new Date();
    start.setDate(start.getDate() + i);
    start.setHours(11, 0, 0, 0);
    const end = new Date(start);
    end.setHours(12, 0, 0, 0);
    await prisma.meeting.create({
      data: {
        title: `Discovery call ${i}`,
        description: "Product walkthrough",
        startsAt: start,
        endsAt: end,
        location: "Google Meet",
        meetingUrl: "https://meet.google.com/vayuguard",
        organizerId: sales1.id,
        leadId: leadIds[i],
        createdById: admin.id,
      },
    });
  }

  const product = await prisma.product.findFirstOrThrow();
  const customer = customers[0];

  const quotation = await prisma.quotation.create({
    data: {
      quoteNumber: "QT-2026-0001",
      customerId: customer.id,
      status: QuotationStatus.SENT,
      subtotal: 45000,
      taxAmount: 8100,
      discountAmount: 0,
      total: 53100,
      terms: "Payment within 30 days. Validity 15 days.",
      notes: "Includes installation support",
      validUntil: new Date(Date.now() + 15 * 86400000),
      createdById: admin.id,
      items: {
        create: [
          {
            productId: product.id,
            description: product.name,
            quantity: 1,
            unitPrice: 45000,
            taxPercent: 18,
            discount: 0,
            total: 53100,
          },
        ],
      },
      versions: {
        create: {
          version: 1,
          snapshot: { total: 53100 },
          createdById: admin.id,
        },
      },
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: "INV-2026-0001",
      customerId: customer.id,
      quotationId: quotation.id,
      status: InvoiceStatus.SENT,
      paymentStatus: PaymentStatus.PARTIAL,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      subtotal: 45000,
      taxAmount: 8100,
      total: 53100,
      amountPaid: 20000,
      createdById: admin.id,
      items: {
        create: [
          {
            productId: product.id,
            description: product.name,
            quantity: 1,
            unitPrice: 45000,
            taxPercent: 18,
            discount: 0,
            total: 53100,
          },
        ],
      },
      payments: {
        create: [
          {
            paymentNumber: "PAY-2026-0001",
            customerId: customer.id,
            amount: 20000,
            method: "NEFT",
            reference: "TXN12345",
            createdById: admin.id,
          },
        ],
      },
    },
  });

  await prisma.supportTicket.create({
    data: {
      ticketNumber: "TK-2026-0001",
      subject: "Sensor offline at plant 2",
      description: "Device VG-AQ-100 stopped reporting since yesterday.",
      priority: Priority.HIGH,
      department: "Support",
      status: TicketStatus.IN_PROGRESS,
      slaDueAt: new Date(Date.now() + 2 * 86400000),
      customerId: customer.id,
      assignedToId: support.id,
      createdById: admin.id,
      messages: {
        create: [
          {
            body: "We are investigating the gateway connectivity.",
            isInternal: true,
            authorId: support.id,
          },
          {
            body: "Thanks, please keep us updated.",
            isInternal: false,
            authorId: support.id,
          },
        ],
      },
    },
  });

  for (const user of [sales1, sales2]) {
    await prisma.salesTarget.create({
      data: {
        userId: user.id,
        period: "monthly",
        year: 2026,
        month: 8,
        targetAmount: 500000,
        achievedAmount: user.id === sales1.id ? 320000 : 210000,
      },
    });
    await prisma.attendance.create({
      data: {
        userId: user.id,
        date: new Date(),
        checkIn: new Date(new Date().setHours(9, 30, 0, 0)),
        status: "present",
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: sales1.id,
        type: "TASK_REMINDER",
        title: "Task due today",
        body: "Follow up with GreenForge Industries",
        link: "/tasks",
      },
      {
        userId: sales1.id,
        type: "DEAL_UPDATE",
        title: "Deal moved to Negotiation",
        body: "Deal 1 entered negotiation stage",
        link: "/pipeline",
      },
      {
        userId: admin.id,
        type: "SYSTEM",
        title: "Welcome to VayuGuard CRM",
        body: "Your workspace is ready.",
        link: "/dashboard",
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Login: admin@vayuguard.com / Password@123");
  console.log(`Invoice seeded: ${invoice.invoiceNumber}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
