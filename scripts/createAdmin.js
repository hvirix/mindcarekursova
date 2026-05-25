// Script to create an admin account
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../shared/db');

async function createAdmin(email, password, firstName, lastName) {
  // If called from command line (no arguments provided), get args from process.argv
  const isCalledFromCLI = require.main === module && email === undefined;

  if (isCalledFromCLI) {
    const args = process.argv.slice(2);

    if (args.length < 3) {
      console.log(
        'Usage: node createAdmin.js <email> <password> <firstName> <lastName>'
      );
      console.log(
        'Example: node createAdmin.js admin@mindcare.com password123 "Іван" "Петренко"'
      );
      process.exit(1);
    }

    email = args[0];
    password = args[1];
    firstName = args[2];
    lastName = args[3];
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(
        `User with email ${email} already exists. Updating to admin...`
      );

      // Update existing user to admin
      const updatedUser = await prisma.users.update({
        where: { email },
        data: {
          role: 'admin',
          firstName: firstName || existingUser.firstName,
          lastName: lastName || existingUser.lastName,
        },
      });

      console.log('User updated to admin:', {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      });
      if (isCalledFromCLI) {
        process.exit(0);
      }
      return updatedUser;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        role: 'admin',
        firstName: firstName || '',
        lastName: lastName || '',
      },
    });

    console.log('Admin account created successfully:');
    console.log({
      id: admin.id,
      email: admin.email,
      role: admin.role,
      firstName: admin.firstName,
      lastName: admin.lastName,
    });
    return admin;
  } catch (error) {
    console.error('Error creating admin:', error);
    if (isCalledFromCLI) {
      process.exit(1);
    }
    throw error;
  } finally {
    if (isCalledFromCLI) {
      await prisma.$disconnect();
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  createAdmin();
}

module.exports = { createAdmin };
