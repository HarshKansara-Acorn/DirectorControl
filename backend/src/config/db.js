const sql = require('mssql');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

const getPool = async () => {
  if (!pool) {
    try {
      pool = await sql.connect(dbConfig);
      console.log('Connected to MS SQL Server');
    } catch (err) {
      console.error('Database connection failed:', err.message);
      // Return null so app still runs without DB
      return null;
    }
  }
  return pool;
};

module.exports = { getPool, sql };
