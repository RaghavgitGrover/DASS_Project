import mongoose from 'mongoose';

const SeatingArrangementsSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seatingArrangement: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('SeatingArrangements', SeatingArrangementsSchema);
