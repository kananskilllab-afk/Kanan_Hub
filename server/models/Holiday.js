import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    type: { type: String, default: 'Public' }
  },
  { timestamps: true }
);

export default mongoose.model('Holiday', holidaySchema);
