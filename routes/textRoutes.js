import { Router } from 'express';
import { texts } from '../data';

const router = Router();

router.get('/:id', (req, res) => {
    return res.json(texts[+req.params.id]);
});

export default router;
