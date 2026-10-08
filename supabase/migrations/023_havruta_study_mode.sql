-- 023: Study mode per discussion (pshat / deep / commentators)
ALTER TABLE havruta_sessions
  ADD COLUMN IF NOT EXISTS study_mode TEXT;
