const express = require("express");
const { z } = require("zod");
const Analysis = require("../models/Analysis");
const { classifyPose } = require("../scoring");
const { putJson } = require("../s3");

const router = express.Router();

const LandmarkSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number().optional().default(0),
  visibility: z.number().min(0).max(1).optional().default(0)
});

const ClassifySchema = z.object({
  analysisId: z.string().min(1),
  userId: z.string().min(1),
  s3KeyImage: z.string().min(1),
  landmarks: z.array(LandmarkSchema).length(33),
  meta: z.record(z.string()).optional()
});

router.post("/classify", async (req, res) => {
  try {
    const { analysisId, userId, s3KeyImage, landmarks, meta } = ClassifySchema.parse(req.body);

    const scoring = await classifyPose({
      landmarks,
      saveSample: false,
      userLabel: null,
      meta: { ...meta, userId, analysisId, mode: "image" },
      includeDebug: true
    });

    const s3KeyResult = `users/${userId}/poses/${analysisId}/result.json`;

    const resultObj = {
      analysisId,
      userId,
      createdAt: new Date().toISOString(),
      s3KeyImage,
      predictedPose: scoring.pose,
      confidence: scoring.confidence,
      scores: scoring.scores || null,
      warnings: scoring.warnings || [],
      userLabel: ""
    };

    await putJson({ bucket: process.env.S3_BUCKET, key: s3KeyResult, obj: resultObj });

    await Analysis.updateOne(
      { analysisId },
      { $set: { analysisId, userId, s3KeyImage, s3KeyResult, predictedPose: scoring.pose, confidence: scoring.confidence, scores: scoring.scores || {}, landmarks } },
      { upsert: true }
    );

    res.json({
      analysisId,
      pose: scoring.pose,
      confidence: scoring.confidence,
      scores: scoring.scores || null,
      warnings: scoring.warnings || [],
      s3KeyImage,
      s3KeyResult
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Bad Request" });
  }
});

const ConfirmSchema = z.object({
  analysisId: z.string().min(1),
  userId: z.string().min(1),
  userLabel: z.string().min(1)
});

router.post("/confirm", async (req, res) => {
  try {
    const { analysisId, userId, userLabel } = ConfirmSchema.parse(req.body);

    const analysis = await Analysis.findOne({ analysisId, userId }).lean();
    if (!analysis) return res.status(404).json({ error: "Analysis not found" });
    if (!analysis.landmarks || analysis.landmarks.length !== 33) {
      return res.status(400).json({ error: "Missing landmarks for this analysis" });
    }

    const scoring = await classifyPose({
      landmarks: analysis.landmarks,
      saveSample: true,
      userLabel,
      meta: { userId, analysisId, mode: "image_confirm" },
      includeDebug: true
    });

    await Analysis.updateOne({ analysisId, userId }, { $set: { userLabel } });

    const updatedResultObj = {
      analysisId,
      userId,
      createdAt: analysis.createdAt ? new Date(analysis.createdAt).toISOString() : new Date().toISOString(),
      s3KeyImage: analysis.s3KeyImage,
      predictedPose: analysis.predictedPose,
      confidence: analysis.confidence,
      scores: analysis.scores || null,
      warnings: [],
      userLabel,
      datasetSampleId: scoring.sample_id || null
    };

    await putJson({ bucket: process.env.S3_BUCKET, key: analysis.s3KeyResult, obj: updatedResultObj });

    res.json({ analysisId, confirmedLabel: userLabel, datasetSampleId: scoring.sample_id || null });
  } catch (err) {
    res.status(400).json({ error: err.message || "Bad Request" });
  }
});

module.exports = router;
