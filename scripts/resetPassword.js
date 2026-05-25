// Script to reset a user's password in the database
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../shared/db');

async function resetPassword(email, newPassword) {
  try {
    // Find user by email
    const user = await prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ Користувач з email "${email}" не знайдено`);
      return { success: false, error: 'User not found' };
    }

    console.log(
      `Знайдено користувача: ${user.firstName} ${user.lastName} (${user.email})`
    );
    console.log(`Поточний хеш пароля: ${user.password}`);

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.users.update({
      where: { email },
      data: {
        password: hashedPassword,
      },
    });

    console.log(`✅ Пароль успішно змінено!`);
    console.log(`Новий пароль: "${newPassword}"`);
    console.log(`Новий хеш: ${hashedPassword}`);
    return { success: true, hashedPassword };
  } catch (err) {
    console.error('Помилка при зміні пароля:', err);
    throw err;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  // Get arguments from command line
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(
      'Використання: node scripts/resetPassword.js <email> <newPassword>'
    );
    console.log(
      'Приклад: node scripts/resetPassword.js user@example.com newpassword123'
    );
    process.exit(1);
  }

  const email = args[0];
  const newPassword = args[1];

  resetPassword(email, newPassword)
    .catch(() => {
      process.exit(1);
    })
    .finally(() => {
      // Disconnect only when called from command line
      prisma.$disconnect();
    });
}

module.exports = { resetPassword };
