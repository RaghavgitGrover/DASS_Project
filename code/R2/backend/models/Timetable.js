import mongoose from 'mongoose';

const TimetableSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  createdAt: { type: String },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('Timetable', TimetableSchema);
