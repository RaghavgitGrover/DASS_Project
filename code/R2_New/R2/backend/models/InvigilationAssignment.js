import mongoose from 'mongoose';

const InvigilationAssignmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // UUID for assignment
  name: { type: String, required: true }, // Assignment name/title
  seatingArrangementId: { type: String, required: true },
  invigilation: { type: mongoose.Schema.Types.Mixed, required: true }, // Full assignment object
  dutyCount: { type: mongoose.Schema.Types.Mixed }, // Optional: duty summary per invigilator
  warnings: { type: [String] }, // Any warnings
  dutySummary: { type: mongoose.Schema.Types.Mixed }, // Optional: summary
  createdAt: { type: String, required: true }
});

export default mongoose.model('InvigilationAssignment', InvigilationAssignmentSchema);
