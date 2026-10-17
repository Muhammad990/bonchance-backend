import Product from '../models/Product.js';

const DEFAULT_PRODUCTS = [
  {
    pId: 1,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 5,
    picture: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=100&auto=format&fit=crop&q=60',
    name: 'Arctic TreeHouse Hotel',
    price: '8510.00',
    creationTime: '2024-01-04 16:42:24',
  },
  {
    pId: 6,
    picture: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=100&auto=format&fit=crop&q=60',
    name: 'Hotel Chalpan',
    price: '475.00',
    creationTime: '2024-01-04 16:45:37',
  },
  {
    pId: 7,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 8,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 9,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 10,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 11,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 12,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 13,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 14,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
  {
    pId: 15,
    picture: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&auto=format&fit=crop&q=60',
    name: 'Wilderness Hotel Inari',
    price: '315.00',
    creationTime: '2024-01-04 16:21:45',
  },
];

export async function seedProducts() {
  const count = await Product.countDocuments();
  if (count > 0) return;
  await Product.insertMany(DEFAULT_PRODUCTS);
  console.log(`Seeded ${DEFAULT_PRODUCTS.length} default products`);
}