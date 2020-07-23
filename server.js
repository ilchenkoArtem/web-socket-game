import express from 'express';
import socketHandler from './socket';
import routes from './routes';
import { STATIC_PATH, PORT } from './config';

const app = express();

app.use(express.static(STATIC_PATH));
routes(app);

app.get('*', (req, res) => {
    res.redirect('/login');
});

const server = app.listen(PORT, () => {
    console.log(`Listen server on port ${PORT}`);
});

const io = require('socket.io')(server);
socketHandler(io);
