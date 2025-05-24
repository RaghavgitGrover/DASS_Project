import mongoose from 'mongoose';

const FilteredStudentDataSchema = new mongoose.Schema({
  Applications: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('FilteredStudentData', FilteredStudentDataSchema);
