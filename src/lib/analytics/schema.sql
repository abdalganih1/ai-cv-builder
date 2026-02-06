-- Analytics Database Schema for Cloudflare D1
-- قاعدة بيانات التحليلات

-- جدول الجلسات
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  current_step INTEGER DEFAULT 0,
  max_step_reached INTEGER DEFAULT 0,
  form_data JSON,
  payment_proof_url TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'uploaded', 'verified', 'rejected')),
  is_active BOOLEAN DEFAULT 1,
  total_page_views INTEGER DEFAULT 0,
  total_time_spent INTEGER DEFAULT 0
);

-- جدول الأحداث
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSON,
  step_index INTEGER,
  page_url TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- جدول إحصائيات يومية (للتقارير السريعة)
CREATE TABLE IF NOT EXISTS daily_stats (
  date DATE PRIMARY KEY,
  total_sessions INTEGER DEFAULT 0,
  completed_forms INTEGER DEFAULT 0,
  payment_uploads INTEGER DEFAULT 0,
  abandoned_sessions INTEGER DEFAULT 0,
  avg_time_spent INTEGER DEFAULT 0,
  step_0_views INTEGER DEFAULT 0,
  step_1_views INTEGER DEFAULT 0,
  step_2_views INTEGER DEFAULT 0,
  step_3_views INTEGER DEFAULT 0,
  step_4_views INTEGER DEFAULT 0
);

-- فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_payment_status ON sessions(payment_status);
CREATE INDEX IF NOT EXISTS idx_sessions_country ON sessions(country);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- جدول إعدادات الدفع
CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  qr_image_url TEXT DEFAULT '/sham-cash-qr.png',
  recipient_name TEXT DEFAULT 'عبد الغني أحمد الحمدي',
  recipient_code TEXT DEFAULT '0d4f56f704ded4f3148727e0edc03778',
  amount INTEGER DEFAULT 500,
  currency TEXT DEFAULT 'ل.س',
  payment_type TEXT DEFAULT 'mandatory' CHECK (payment_type IN ('mandatory', 'donation', 'disabled')),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- إدخال القيم الافتراضية
INSERT OR IGNORE INTO payment_settings (id) VALUES (1);
