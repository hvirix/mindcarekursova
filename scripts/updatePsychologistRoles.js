// Script to update existing psychologists to have 'psychologist' role
require('dotenv').config();
const prisma = require('../shared/db');

async function updatePsychologistRoles() {
  try {
    console.log('Updating psychologist roles...');

    // Get all psychologists
    const psychologists = await prisma.psychologists.findMany({
      include: {
        Users: true,
      },
    });

    console.log(`Found ${psychologists.length} psychologists`);

    let updated = 0;
    let skipped = 0;

    for (const psychologist of psychologists) {
      if (psychologist.Users) {
        // Only update if role is not already 'psychologist'
        if (psychologist.Users.role !== 'psychologist') {
          await prisma.users.update({
            where: { id: psychologist.Users.id },
            data: { role: 'psychologist' },
          });
          console.log(
            `Updated user ${psychologist.Users.id} (${psychologist.Users.email}) to psychologist role`
          );
          updated++;
        } else {
          console.log(
            `User ${psychologist.Users.id} (${psychologist.Users.email}) already has psychologist role`
          );
          skipped++;
        }
      } else {
        console.log(`Psychologist ${psychologist.id} has no associated user`);
      }
    }

    console.log(`\nUpdate complete:`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Skipped: ${skipped}`);
    console.log(`- Total: ${psychologists.length}`);
    return { updated, skipped, total: psychologists.length };
  } catch (error) {
    console.error('Error updating psychologist roles:', error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  } finally {
    if (require.main === module) {
      await prisma.$disconnect();
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  updatePsychologistRoles();
}

module.exports = { updatePsychologistRoles };
