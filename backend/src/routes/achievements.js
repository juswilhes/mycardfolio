import { Router } from "express";
import { getAchievements } from "../services/achievements.js";

const router = Router();

// GET /api/achievements -> alle 16 Orden mit Fortschritt + Status für den Ordenkoffer
router.get("/", (req, res) => {
  res.json(getAchievements(req.user.id));
});

export default router;
