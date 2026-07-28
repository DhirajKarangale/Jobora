import { type Request, type Response } from "express";
import { getAnalyticsData } from "../cloud/db/index.ts";

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { dateRange, sourceName, companyName, status, page, limit } = req.query;

    const filters = {
      dateRange: (dateRange as string) || "all",
      sourceName: sourceName as string | undefined,
      companyName: companyName as string | undefined,
      status: status as string | undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    };

    const analyticsData = await getAnalyticsData(filters);

    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
}

export async function getFilterOptionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { sourceName, companyName } = req.query;
    const { getFilterOptions } = await import("../cloud/db/index.ts");
    const options = await getFilterOptions(sourceName as string | undefined, companyName as string | undefined);
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
}
