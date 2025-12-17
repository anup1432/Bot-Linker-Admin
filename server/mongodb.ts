import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn('MONGODB_URI not set. Database features will not work.');
}

export async function connectMongoDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI must be set');
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export { mongoose };
