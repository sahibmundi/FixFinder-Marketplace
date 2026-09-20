import { Router, type IRouter } from "express";
import healthRouter from "./health";
import providersRouter from "./providers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(providersRouter);

export default router;
