-- Event RSVP system: complete schema. Safe to re-run (CREATE IF NOT EXISTS).
CREATE DATABASE IF NOT EXISTS event_rsvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE event_rsvp;

CREATE TABLE IF NOT EXISTS admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  tagline VARCHAR(255),
  short_intro TEXT,
  description TEXT,
  purpose TEXT,
  objectives TEXT,
  organizer_info TEXT,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  tz_offset VARCHAR(6) NOT NULL DEFAULT '+08:00',
  venue_name VARCHAR(200),
  venue_address VARCHAR(300),
  map_embed_url VARCHAR(600),
  transport_info TEXT,
  landmarks TEXT,
  venue_notes TEXT,
  hero_image VARCHAR(600),
  venue_image VARCHAR(600),
  promo_video_url VARCHAR(600),
  live_stream_url VARCHAR(600),
  live_stream_note VARCHAR(255),
  contact_email VARCHAR(190),
  contact_phone VARCHAR(40),
  facebook_url VARCHAR(300),
  instagram_url VARCHAR(300),
  x_url VARCHAR(300),
  youtube_url VARCHAR(300),
  capacity INT UNSIGNED NULL,
  rsvp_open TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_event_dates CHECK (end_at >= start_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS attendees (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL,
  organization VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rsvps (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  attendee_id INT UNSIGNED NOT NULL,
  reference_no VARCHAR(20) NOT NULL UNIQUE,
  token CHAR(48) NOT NULL UNIQUE,
  guests TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('attending','not_attending','maybe','cancelled') NOT NULL,
  message TEXT NULL,
  reminder_sent TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_event_attendee (event_id, attendee_id),
  KEY idx_rsvp_status (status),
  CONSTRAINT fk_rsvp_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_rsvp_attendee FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE,
  CONSTRAINT chk_guests CHECK (guests <= 20)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS speakers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  role_title VARCHAR(160),
  type ENUM('speaker','organizer','performer','guest') NOT NULL DEFAULT 'speaker',
  bio TEXT,
  photo_url VARCHAR(600),
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_speaker_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS schedules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  day_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  speaker_id INT UNSIGNED NULL,
  is_highlight TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_sched_day (day_date, start_time),
  CONSTRAINT fk_sched_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_sched_speaker FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gallery (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  media_type ENUM('image','video') NOT NULL DEFAULT 'image',
  url VARCHAR(600) NOT NULL,
  caption VARCHAR(255),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gallery_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS announcements (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ann_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Extra table: messages sent through the contact form
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
-- (The sessions table is created automatically by express-mysql-session.)
