import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, default: 'Company' },
    color: { type: String, default: 'blue' }
  },
  { timestamps: true }
);

export default mongoose.model('Announcement', announcementSchema);
