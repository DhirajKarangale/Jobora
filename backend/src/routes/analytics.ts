import { type Request, type Response } from "express";
import { getAnalyticsData } from "../cloud/db/index.ts";

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { dateRange, sourceName, companyName } = req.query;

    const filters = {
      dateRange: (dateRange as string) || "all",
      sourceName: sourceName as string | undefined,
      companyName: companyName as string | undefined,
    };

    const analyticsData = await getAnalyticsData(filters);

    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
}

export async function getFilterOptionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { getFilterOptions } = await import("../cloud/db/index.ts");
    const options = await getFilterOptions();
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
}
