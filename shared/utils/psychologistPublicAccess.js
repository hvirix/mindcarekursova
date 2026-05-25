/**
 * Public directory + booking only include approved psychologists who are not actively blocked.
 * Temporary blocks set blockedUntil in the future; when it passes, role + visibility are restored via expireTemporaryPsychologistBlocks.
 * Expiry runs as one transaction with updateMany (no per-row transactions) to keep hot paths cheap.
 */

function publicPsychologistWhere(now = new Date()) {
  return {
    status: 'approved',
    blockedPermanently: false,
    OR: [{ blockedUntil: null }, { blockedUntil: { lte: now } }],
  };
}

async function expireTemporaryPsychologistBlocks(prisma) {
  const now = new Date();
  const anyExpired = await prisma.psychologists.findFirst({
    where: {
      blockedPermanently: false,
      blockedUntil: { not: null, lte: now },
    },
    select: { id: true },
  });
  if (!anyExpired) return;

  await prisma.$transaction(async tx => {
    const withUsers = await tx.psychologists.findMany({
      where: {
        blockedPermanently: false,
        blockedUntil: { not: null, lte: now },
        userId: { not: null },
      },
      select: { userId: true },
    });
    const userIds = [...new Set(withUsers.map(p => p.userId))];

    await tx.psychologists.updateMany({
      where: {
        blockedPermanently: false,
        blockedUntil: { not: null, lte: now },
      },
      data: { blockedUntil: null },
    });

    if (userIds.length > 0) {
      await tx.users.updateMany({
        where: { id: { in: userIds } },
        data: { role: 'psychologist' },
      });
    }
  });
}

module.exports = { publicPsychologistWhere, expireTemporaryPsychologistBlocks };
