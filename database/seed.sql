-- Sample content so the site is not empty on first run. Edit everything in the admin dashboard.
INSERT INTO events (title, tagline, short_intro, description, purpose, objectives, organizer_info,
  start_at, end_at, tz_offset, venue_name, venue_address, transport_info, landmarks, venue_notes,
  live_stream_note, contact_email, contact_phone, capacity)
VALUES (
  'Laguna Youth Innovation Summit 2027',
  'One day of talks, workshops and pitches for student builders.',
  'Students, teachers and young professionals meet to share ideas, learn practical skills and pitch projects to local mentors.',
  'The summit brings together speakers from universities, startups and local government for a full day of keynotes, a panel, a hands-on workshop and a pitch showcase. Lunch and an exhibit walk are included.',
  'To give young people in the region a place to learn from practitioners and to turn good ideas into real projects.',
  'Share practical skills in building and shipping technology.\nConnect students with mentors and employers.\nGive student teams a stage to pitch their projects.',
  'Organized by the Laguna Innovation Network together with partner schools and community groups.',
  '2027-03-20 08:00:00', '2027-03-20 17:00:00', '+08:00',
  'Laguna Innovation Hall', 'Calamba City, Laguna, Philippines',
  'By jeepney or bus, get off at the Calamba Crossing and take a tricycle to the venue. Parking is available on site.',
  'Near the Calamba City Hall area and public market.',
  'Doors open at 7:30 AM. Please bring a valid ID and your reference number.',
  'The live stream link will appear here before the event starts.',
  'hello@example.com', '+63 912 345 6789', 300
);

INSERT INTO speakers (event_id, name, role_title, type, bio, sort_order) VALUES
 (1, 'Dr. Maria Santos', 'Director, Center for Community Innovation', 'speaker', 'Researcher and educator who works with schools and local governments on practical technology projects.', 1),
 (1, 'Paolo Reyes', 'Co-founder, Sample Startup', 'speaker', 'Built his first company as a student and now mentors early-stage teams.', 2),
 (1, 'Ana Dizon', 'Senior Software Engineer', 'speaker', 'Leads hands-on workshops on turning an idea into a working prototype.', 3),
 (1, 'Kevin Cruz', 'Program Lead, Laguna Innovation Network', 'organizer', 'Coordinates the summit program and partner schools.', 4);

INSERT INTO schedules (event_id, day_date, start_time, end_time, title, description, location, speaker_id, is_highlight) VALUES
 (1, '2027-03-20', '08:00', '09:00', 'Registration and coffee', 'Check in with your reference number and collect your badge.', 'Main Lobby', NULL, 0),
 (1, '2027-03-20', '09:00', '09:30', 'Opening program', 'Welcome remarks and a short overview of the day.', 'Hall A', 4, 0),
 (1, '2027-03-20', '09:30', '10:30', 'Keynote: Building Technology for Our Communities', 'How small teams solve local problems with simple tools.', 'Hall A', 1, 1),
 (1, '2027-03-20', '10:45', '12:00', 'Panel: From Classroom to Startup', 'Founders discuss what they wish they had known as students.', 'Hall A', 2, 0),
 (1, '2027-03-20', '12:00', '13:30', 'Lunch and exhibit walk', 'Meet participating schools and community groups.', 'Atrium', NULL, 0),
 (1, '2027-03-20', '13:30', '15:00', 'Workshop: Prototyping in an afternoon', 'Bring a laptop. We will build a small working app together.', 'Room B', 3, 1),
 (1, '2027-03-20', '15:00', '16:30', 'Pitch showcase', 'Student teams pitch to a panel of mentors.', 'Hall A', NULL, 1),
 (1, '2027-03-20', '16:30', '17:00', 'Awards and closing', 'Winners announced and thank-yous.', 'Hall A', 4, 0);

INSERT INTO announcements (event_id, title, body, is_pinned) VALUES
 (1, 'Registration is open', 'Seats are limited. RSVP now and keep your confirmation email: you can update or cancel your RSVP from the link inside it.', 1);
