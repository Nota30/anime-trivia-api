import { Router } from 'express';

const router = Router();

router.get('/', function (req, res) {
    res.render('index', { title: 'Anime-Trivia-App' });
});

export default router;