import loginRoutes from './loginRoutes';
import gameRoutes from './gameRoutes';
import textRoutes from './textRoutes';

export default (app) => {
    app.use('/login', loginRoutes);
    app.use('/game', gameRoutes);
    app.use('/api/get-text', textRoutes);
};
