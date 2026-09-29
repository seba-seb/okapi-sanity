import { defineCliConfig } from "sanity/cli";

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET;

export default defineCliConfig({
  api: { projectId, dataset },
  autoUpdates: true,
});
