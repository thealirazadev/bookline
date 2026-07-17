import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import { loadSeedEnv } from "../lib/env";
import { logger } from "../lib/logger";

const BCRYPT_ROUNDS = 10;

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

async function seed(): Promise<void> {
  const env = loadSeedEnv();

  if (!isValidTimeZone(env.SEED_HOST_TIMEZONE)) {
    throw new Error(
      `SEED_HOST_TIMEZONE is not a valid IANA timezone: ${env.SEED_HOST_TIMEZONE}`,
    );
  }

  const existing = await prisma.host.findUnique({
    where: { email: env.SEED_HOST_EMAIL },
  });
  if (existing) {
    logger.info({ event: "seed.skip", reason: "host already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(env.SEED_HOST_PASSWORD, BCRYPT_ROUNDS);
  const feedToken = randomBytes(32).toString("hex");

  const host = await prisma.host.create({
    data: {
      email: env.SEED_HOST_EMAIL,
      passwordHash,
      name: env.SEED_HOST_NAME,
      timezone: env.SEED_HOST_TIMEZONE,
      feedToken,
    },
  });

  await prisma.eventType.create({
    data: {
      hostId: host.id,
      name: "Intro call",
      slug: "intro-call",
      description: "30 minutes to meet and see if we're a fit.",
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 10,
      minNoticeMin: 240,
      maxDaysAhead: 30,
      reminderLeadMin: 60,
      active: true,
    },
  });

  // Weekday 0 = Monday .. 6 = Sunday. Seed Monday-Friday 09:00-17:00.
  await prisma.availabilityRule.createMany({
    data: [0, 1, 2, 3, 4].map((weekday) => ({
      hostId: host.id,
      weekday,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    })),
  });

  logger.info({ event: "seed.done", hostId: host.id });
}

seed()
  .catch((error: unknown) => {
    logger.error({
      event: "seed.error",
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
