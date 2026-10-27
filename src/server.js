import 'dotenv/config';
import app from './app.js';
import { pool, testDatabaseConnection } from './config/database.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
    try {
        await testDatabaseConnection();

        console.log('PostgreSQL connected successfully');

        const server = app.listen(PORT, '127.0.0.1', () => {
            console.log(`TechStore API running on 127.0.0.1:${PORT}`);
        });

        function shutdown() {
            console.log('Shutting down TechStore API...');

            server.close(async () => {
                await pool.end();
                process.exit(0);
            });

            setTimeout(() => {
                process.exit(1);
            }, 10000).unref();
        }

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        console.error('Failed to start TechStore API:', error.message);
        await pool.end();
        process.exit(1);
    }
}

startServer();
