import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __schemaReady: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!connectionString) {
    throw new Error(
      "Keine Datenbank konfiguriert. Setze DATABASE_URL (z. B. über Vercel → Storage → Neon).",
    );
  }
  if (!global.__pgPool) {
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    global.__pgPool = new Pool({
      connectionString,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return global.__pgPool;
}

export const hasDatabase = Boolean(connectionString);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT,
  end_date TEXT,
  color TEXT DEFAULT '#2e6553',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS flights (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  airline TEXT,
  flight_no TEXT,
  from_airport TEXT,
  to_airport TEXT,
  depart_at TEXT,
  arrive_at TEXT,
  booking_ref TEXT,
  price DOUBLE PRECISION,
  link TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS hotels (
  id SERIAL PRIMARY KEY,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  url TEXT,
  source TEXT,
  name TEXT,
  image TEXT,
  address TEXT,
  description TEXT,
  price_total DOUBLE PRECISION,
  price_per_night DOUBLE PRECISION,
  currency TEXT DEFAULT 'EUR',
  rating DOUBLE PRECISION,
  rating_scale DOUBLE PRECISION,
  review_count INTEGER,
  checkin TEXT,
  checkout TEXT,
  status TEXT DEFAULT 'shortlist',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS orig_price DOUBLE PRECISION;
ALTER TABLE hotels ADD COLUMN IF NOT EXISTS orig_currency TEXT;
CREATE TABLE IF NOT EXISTS flight_files (
  id SERIAL PRIMARY KEY,
  flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  company TEXT,
  car_type TEXT,
  pickup_place TEXT,
  pickup_at TEXT,
  dropoff_place TEXT,
  dropoff_at TEXT,
  booking_ref TEXT,
  price DOUBLE PRECISION,
  link TEXT,
  notes TEXT,
  booked BOOLEAN DEFAULT false
);
ALTER TABLE flight_files ALTER COLUMN flight_id DROP NOT NULL;
ALTER TABLE flight_files ADD COLUMN IF NOT EXISTS car_id INTEGER REFERENCES cars(id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  date TEXT,
  time TEXT,
  title TEXT NOT NULL,
  description TEXT,
  link TEXT,
  cost DOUBLE PRECISION,
  done BOOLEAN DEFAULT false
);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS rating_scale DOUBLE PRECISION;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS review_count INTEGER;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'activity';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS cuisine TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS price_level TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS reserved BOOLEAN DEFAULT false;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS booked BOOLEAN DEFAULT false;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS partner_name TEXT;
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id INTEGER,
  title TEXT,
  amount DOUBLE PRECISION,
  paid BOOLEAN DEFAULT false,
  cancel_until TEXT,
  partner_paid BOOLEAN DEFAULT false,
  shared BOOLEAN DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_item_idx ON payments (item_type, item_id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
`;

async function ensureSchema() {
  if (!global.__schemaReady) {
    global.__schemaReady = getPool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((e) => {
        global.__schemaReady = undefined;
        throw e;
      });
  }
  return global.__schemaReady;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query(text, params);
  return res.rows as T[];
}
