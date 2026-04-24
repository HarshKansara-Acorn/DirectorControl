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
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;

const getPool = async () => {
  // Reuse existing healthy pool
  if (pool) {
    try {
      // Quick ping to verify connection is alive
      await pool.request().query('SELECT 1');
      return pool;
    } catch {
      pool = null;
    }
  }

  try {
    pool = await new sql.ConnectionPool(dbConfig).connect();
    console.log('✅ Connected to Azure MS SQL Server');
    pool.on('error', (err) => {
      console.error('Pool error:', err.message);
      pool = null;
    });
    return pool;
  } catch (err) {
    pool = null;
    console.error('❌ Database connection failed:', err.message);
    throw err;
  }
};

// Run a SELECT and return all rows
const query = async (queryStr, params = {}) => {
  const p = await getPool();
  const request = p.request();
  Object.entries(params).forEach(([key, { type, value }]) => {
    request.input(key, type, value);
  });
  const result = await request.query(queryStr);
  return result.recordset;
};

// Run a SELECT and return the first row (or null)
const queryOne = async (queryStr, params = {}) => {
  const rows = await query(queryStr, params);
  return rows[0] || null;
};

// Run INSERT / UPDATE / DELETE
const execute = async (queryStr, params = {}) => {
  const p = await getPool();
  const request = p.request();
  Object.entries(params).forEach(([key, { type, value }]) => {
    request.input(key, type, value);
  });
  return request.query(queryStr);
};

module.exports = { getPool, query, queryOne, execute, sql };
