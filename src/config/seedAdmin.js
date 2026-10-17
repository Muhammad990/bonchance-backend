import Admin from '../models/Admin.js';

const DEFAULT_ADMIN = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
};

export async function seedAdmin() {
  const existing = await Admin.findOne({ username: DEFAULT_ADMIN.username });
  if (existing) {
    console.log(`Admin "${existing.username}" already exists (password encrypted)`);
    return existing;
  }

  const admin = await Admin.create(DEFAULT_ADMIN);
  console.log(`Default admin "${admin.username}" created with encrypted password`);
  return admin;
}