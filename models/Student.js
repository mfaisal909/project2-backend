import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true, unique: true },
    email: { type: String, required: true, trim: true, unique: true },
    semester: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);
