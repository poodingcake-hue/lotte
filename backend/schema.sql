-- LEGACY / UNUSED: superseded by inventory_history (SUM(qty) GROUP BY code,color,size
-- is computed on every read). Kept only so older deployments don't error on missing table;
-- the app never reads or writes it anymore.
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0
);

-- LEGACY / UNUSED: superseded by inventory_history rows of type RENT/RETURN (a RETURN row's
-- ref_id points back at the RENT row it closes out). Kept only so older deployments don't
-- error on missing table; the app never reads or writes it anymore.
CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    renter TEXT NOT NULL,
    color TEXT,
    size TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outfits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    host TEXT NOT NULL,
    size TEXT
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  code TEXT PRIMARY KEY,
  brand TEXT,
  name TEXT,
  category TEXT,
  image TEXT,
  date TEXT,
  isMaster INTEGER DEFAULT 0,
  colors TEXT,
  sizes TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assignee TEXT,
    status TEXT DEFAULT '대기',
    due_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Single source of truth for stock levels: current stock is always SUM(qty) GROUP BY
-- code,color,size over this table, never stored separately. type is one of
-- IN / ADJUST / RENT / RETURN. A RETURN row's ref_id references the id of the RENT row
-- it closes out, which is how "still outstanding" rentals are derived (no separate table).
CREATE TABLE IF NOT EXISTS inventory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    type TEXT NOT NULL,
    qty INTEGER NOT NULL,
    actor TEXT,
    date TEXT NOT NULL,
    note TEXT,
    ref_id INTEGER
);

CREATE TABLE IF NOT EXISTS custom_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
