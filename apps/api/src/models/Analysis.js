const mongoose = require("mongoose");

const LandmarkSchema = new mongoose.Schema(
  { x: Number, y: Number, z: Number, visibility: Number },
  { _id: false }
);

const AnalysisSchema = new mongoose.Schema(
  {
    analysisId: { type: String, unique: true, index: true },
    userId: { type: String, index: true },

    s3KeyImage: String,
    s3KeyResult: String,

    predictedPose: String,
    confidence: Number,
    scores: { type: Object },

    userLabel: { type: String, default: "" },
    landmarks: { type: [LandmarkSchema], default: [] },

    createdAt: { type: Date, default: Date.now }
  },
  { versionKey: false }
);

module.exports = mongoose.model("Analysis", AnalysisSchema);
