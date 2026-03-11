const axios = require("axios");

async function classifyPose({ landmarks, saveSample, userLabel, meta, includeDebug = true }) {
  const baseUrl = process.env.DETECTION_URL;
  if (!baseUrl) {
    throw new Error(
      "DETECTION_URL is not set. Set it to the detection service URL (e.g. http://detection:8000 in Docker, http://localhost:8000 when API runs on host)."
    );
  }
  const url = `${baseUrl.replace(/\/$/, "")}/pose/classify`;
  const payload = {
    landmarks,
    save_sample: !!saveSample,
    user_label: userLabel || null,
    meta: meta || null,
    include_debug: !!includeDebug
  };
  try {
    const { data } = await axios.post(url, payload, { timeout: 15000 });
    return data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(
        "Classification endpoint not found (404). Ensure the detection service is running and DETECTION_URL points to it (not to the scoring service)."
      );
    }
    throw err;
  }
}

async function scoreTechnique({ figure, landmarks }) {
  const url = `${process.env.SCORING_URL}/score-technique`;
  const { data } = await axios.post(url, { figure, landmarks }, { timeout: 15000 });
  return data;
}

module.exports = { classifyPose, scoreTechnique };
