import mongoose from 'mongoose';

// Cached so warm serverless invocations reuse the existing connection instead of reconnecting per-request.
let connectionPromise = null;

export function connectDB() {
  if (!connectionPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set in .env');
    mongoose.set('strictQuery', true);
    connectionPromise = mongoose.connect(uri).then((m) => {
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return m;
    });
  }
  return connectionPromise;
}
