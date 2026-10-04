import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/localchat';
  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB successfully`);

    // Seed or ensure default Admin exists with credentials from .env
    const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const existingAdmin = await User.findOne({ username: adminUsername });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      await User.create({
        username: adminUsername,
        displayName: 'System Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      console.log(`Initial Admin account created: username="${adminUsername}", password="${adminPassword}"`);
    } else {
      const isMatch = await bcrypt.compare(adminPassword, existingAdmin.passwordHash);
      if (!isMatch || existingAdmin.role !== 'ADMIN' || existingAdmin.status !== 'ACTIVE') {
        existingAdmin.role = 'ADMIN';
        existingAdmin.status = 'ACTIVE';
        if (!isMatch) {
          existingAdmin.passwordHash = await bcrypt.hash(adminPassword, 10);
        }
        await existingAdmin.save();
      }
      console.log(`Admin account verified: username="${adminUsername}"`);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}
