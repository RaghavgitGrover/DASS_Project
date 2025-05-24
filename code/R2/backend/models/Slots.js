import mongoose from 'mongoose';

const SlotsSchema = new mongoose.Schema({
  slots: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('Slots', SlotsSchema);
