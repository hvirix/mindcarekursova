// Script to get user details by ID
require('dotenv').config();
const prisma = require('../shared/db');

async function getUserDetails(userId) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        Psychologists: true,
      },
    });

    if (!user) {
      console.log(`❌ Користувач з ID ${userId} не знайдено`);
      return;
    }

    console.log('✅ Деталі користувача:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email || '(не вказано)'}`);
    console.log(
      `   Ім'я: ${user.firstName || '(не вказано)'} ${user.lastName || '(не вказано)'}`
    );
    console.log(`   Роль: ${user.role}`);
    console.log(`   Створено: ${user.createdAt}`);
    console.log(`   Оновлено: ${user.updatedAt}`);
    console.log(`   Фото: ${user.photoUrl || '(немає)'}`);
    console.log(`   Хеш пароля: ${user.password}`);

    if (user.Psychologists && user.Psychologists.length > 0) {
      const psych = user.Psychologists[0];
      console.log('\n📋 Профіль психолога:');
      console.log(
        `   Спеціалізація: ${psych.specialization || '(не вказано)'}`
      );
      console.log(`   Досвід: ${psych.experience || 0} років`);
      console.log(`   Ціна: ${psych.price || 0} грн`);
    }
    return user;
  } catch (err) {
    console.error('Помилка:', err);
    throw err;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  // Get user ID from command line or use 3 (found user)
  const userId = process.argv[2] ? Number.parseInt(process.argv[2], 10) : 3;
  getUserDetails(userId)
    .catch(() => {
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

module.exports = { getUserDetails };
