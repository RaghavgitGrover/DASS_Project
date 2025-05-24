import mongoose from 'mongoose';

const SeatingArrangementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String },
  createdAt: { type: String },
  seatingArrangement: { type: mongoose.Schema.Types.Mixed, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  statistics: { type: mongoose.Schema.Types.Mixed }
});

export default mongoose.model('SeatingArrangement', SeatingArrangementSchema);
