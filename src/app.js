import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { pool } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import productsRoutes from './routes/products.routes.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.set('trust proxy', 1);

const PgSession = connectPgSimple(session);

app.use(session({
    name: 'techstore.sid',
    store: new PgSession({
        pool,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
    }
}));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', application: 'TechStore API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);

app.use((req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('Request error:', err.message);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
        error: err.status ? err.message : 'Internal server error'
    });
});

export default app;
