import { Hono } from "hono";
import type { TraceDatabase } from "../database.js";

export function createStatsRouter(db: TraceDatabase) {
    const statsRouter = new Hono();

    // 获取每小时统计数据
    statsRouter.get("/hourly", async (c) => {
        try {
            const { startTime, endTime, model_name, system } = c.req.query();
            if (!startTime || !endTime) {
                return c.json(
                    { error: "startTime and endTime are required" },
                    400
                );
            }
            const stats = await db.runStatsRepo.getStats(startTime, endTime, {
                model_name,
                system,
            });
            return c.json({ success: true, stats });
        } catch (error) {
            console.error("Error fetching hourly stats:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500
            );
        }
    });

    // 手动触发统计更新
    statsRouter.post("/update", async (c) => {
        try {
            const { hour } = await c.req.json();
            if (!hour) {
                return c.json({ error: "hour is required" }, 400);
            }
            await db.runStatsRepo.updateHourlyStats(hour);
            return c.json({
                success: true,
                message: `Successfully triggered update for hour: ${hour}`,
            });
        } catch (error) {
            console.error("Error triggering hourly stats update:", error);
            return c.json(
                {
                    error: "Internal server error",
                    message:
                        error instanceof Error ? error.message : String(error),
                },
                500
            );
        }
    });

    return statsRouter;
}
