import type { ExportJob } from "../lib/types";
import { delay } from "../lib/utils";

export const exportsClient = {
  async start(format: ExportJob["format"]): Promise<ExportJob> {
    await delay(500);

    return {
      id: `exp_${Date.now()}`,
      status: "completed",
      format,
      downloadUrl: "#"
    };
  }
};
