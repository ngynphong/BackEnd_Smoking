const mongoose = require("mongoose");

const coachProofileSchema = new mongoose.Schema(
  {
    coach_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    specialization: { type: String },
    experience_years: { type: Number },
    rating_avg: { type: Number },
    total_sessions: { type: Number },
    bio: { type: String },
  },
  { timestamps: true }
);

const CoachProfile = mongoose.model("CoachProfile", coachProofileSchema);
module.exports = CoachProfile;
