import { Router, Response } from 'express';
import kitsu from 'node-kitsu';
import waifulist from 'public-waifulist';

const router = Router();

router.get('/', async (req, res: Response) => {
    try {
        const client = new waifulist();
        const anime = (await client.getRandom()).data.series.name;
        const result = await kitsu.searchAnime(anime, 0);
        const data = {
            name: result[0].attributes.titles.en,
            image: result[0].attributes.posterImage.large
        };
        res.json(data);
    } catch (err) {
        console.log(err);
        res.json({
            message: 'error',
            error: err
        });
    }
});

export default router;
