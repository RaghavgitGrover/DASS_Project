import mongoose from 'mongoose';

const FormattedSlotsSchema = new mongoose.Schema({
  slots: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('FormattedSlots', FormattedSlotsSchema);
