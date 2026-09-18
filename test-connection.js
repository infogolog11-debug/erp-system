const { Pool } = require("pg");
require("dotenv").config({ path: ".env.production" });

const testConfigs = [
  {
    name: "1. Original URL (hostname - current)",
    config: { connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 }
  },
  {
    name: "2. IPv6 raw address + SSL rejectUnauthorized false",
    config: {
      user: "postgres",
      password: "U0kJOCYez4WnIoDw",
      host: "2a05:d014:415:501::c668",
      port: 5432,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    }
  },
  {
    name: "3. IPv6 in URL + sslmode=no-verify",
    config: {
      connectionString: "postgresql://postgres:U0kJOCYez4WnIoDw@[2a05:d014:415:501::c668]:5432/postgres?sslmode=require",
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false },
    }
  },
];

(async () => {
  for (const test of testConfigs) {
    console.log("\n" + test.name);
    console.log("   Connecting...");
    let pool;
    try {
      pool = new Pool(test.config);
      const client = await pool.connect();
      const res = await client.query("SELECT current_database(), version()");
      console.log("   SUCCESS! DB:", res.rows[0].current_database);
      console.log("   PG version:", res.rows[0].version.substring(0, 60) + "...");
      client.release();
    } catch (e) {
      console.log("   FAILED:", e.code || "", e.message.split("\n")[0]);
    } finally {
      if (pool) await pool.end().catch(() => {});
    }
  }
  console.log("\n=== Tests complete ===");
})();
