const axios = require("axios");

async function classifyPose({ landmarks, saveSample, userLabel, meta, includeDebug = true }) {
  const url = `${process.env.SCORING_URL}/pose/classify`;
  const payload = {
    landmarks,
    save_sample: !!saveSample,
    user_label: userLabel || null,
    meta: meta || null,
    include_debug: !!includeDebug
  };
  const { data } = await axios.post(url, payload, { timeout: 15000 });
  return data;
}

module.exports = { classifyPose };
