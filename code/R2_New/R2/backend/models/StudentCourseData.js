import mongoose from 'mongoose';

const StudentCourseDataSchema = new mongoose.Schema({
  Applications: { type: mongoose.Schema.Types.Mixed, required: true }
});

export default mongoose.model('StudentCourseData', StudentCourseDataSchema);
