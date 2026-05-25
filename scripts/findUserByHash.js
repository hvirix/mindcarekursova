// Script to find user by password hash
require('dotenv').config();
const prisma = require('../shared/db');

const hash = '$2b$10$3dw81sPthTik66aMOzhaZ.ySCbsx3XO/wo866OjIc96LYcoX89XB6';

async function findUserByHash(passwordHash = hash) {
  try {
    console.log('Пошук користувача з хешем пароля...\n');
    console.log('Хеш:', passwordHash);
    console.log('\n');

    // Get all users
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        password: true,
      },
    });

    console.log(`Знайдено ${users.length} користувачів в базі даних\n`);

    // Check each user
    for (const user of users) {
      if (user.password === passwordHash) {
        console.log('✅ ЗНАЙДЕНО КОРИСТУВАЧА:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Ім'я: ${user.firstName} ${user.lastName}`);
        console.log(`   Роль: ${user.role}`);
        console.log(`   Хеш пароля: ${user.password}`);
        console.log('\nЩоб змінити пароль, виконайте:');
        console.log(
          `node scripts/resetPassword.js ${user.email} <новий_пароль>`
        );
        return user;
      }
    }

    console.log('❌ Користувач з таким хешем пароля не знайдено');
    console.log('\nМожливо:');
    console.log('1. Цей хеш не існує в базі даних');
    console.log('2. Хеш був змінений');
    console.log('3. Це тестовий хеш');
    return null;
  } catch (err) {
    console.error('Помилка:', err);
    throw err;
  } finally {
    if (require.main === module) {
      await prisma.$disconnect();
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  findUserByHash();
}

module.exports = { findUserByHash };
