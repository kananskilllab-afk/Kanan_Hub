import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    dueLabel: { type: String, default: '' },
    done: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('Task', taskSchema);
