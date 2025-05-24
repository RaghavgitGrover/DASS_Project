import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, required: true },
  createdAt: { type: String },
  lastLogin: { type: String }
});

export default mongoose.model('User', UserSchema);
