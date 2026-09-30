const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: '1205',
  host: 'localhost',
  port: 5432,
  database: 'FarmerIOT',
});

async function main() {
  const client = await pool.connect();
  console.log('[PostgreSQL] Connected to FarmerIOT!');

  await client.query(`
    CREATE TABLE IF NOT EXISTS sensor_telemetry (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      temperature NUMERIC(5, 2),
      air_humidity NUMERIC(5, 2),
      soil_moisture NUMERIC(5, 2),
      light NUMERIC(8, 2),
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sensor_telemetry_recorded_at 
    ON sensor_telemetry (recorded_at DESC);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS device_events (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      device_type TEXT NOT NULL,
      is_on BOOLEAN NOT NULL,
      toggled_by TEXT DEFAULT 'user',
      recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_device_events_recorded_at 
    ON device_events (recorded_at DESC);
  `);

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log('[PostgreSQL] Các bảng hiện có trong database FarmerIOT:');
  console.table(res.rows);

  client.release();
  await pool.end();
  console.log('[PostgreSQL] Hoàn tất thiết lập bảng thành công!');
}

main().catch((err) => {
  console.error('[PostgreSQL Error]:', err);
  process.exit(1);
});
