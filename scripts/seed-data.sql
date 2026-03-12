-- Seed default rooms
INSERT INTO rooms (name, description, icon, category, is_public) VALUES
  ('Curhat WNI', 'Tempat berbagi curahan hati dan keluh kesah', '😢', 'general', true),
  ('Ngoding', 'Diskusi tentang programming dan teknologi', '💻', 'tech', true),
  ('Olahraga', 'Membahas berbagai cabang olahraga', '⚽', 'sports', true),
  ('Gaming', 'Ruang gaming dan hiburan', '❤️', 'gaming', true),
  ('Relationship', 'Diskusi tentang hubungan dan cinta', '💬', 'general', true),
  ('Random Room', 'Ruang santai tanpa topik khusus', '✈️', 'general', true)
ON CONFLICT (name) DO NOTHING;

-- Create some test users for demo purposes
INSERT INTO users (nickname, avatar_color, status) VALUES
  ('Budi', '#3B82F6', 'online'),
  ('Rina', '#10B981', 'online'),
  ('Andi', '#8B5CF6', 'online'),
  ('Agus', '#3B82F6', 'online'),
  ('Dina', '#EC4899', 'online'),
  ('Kevin', '#8B5CF6', 'online'),
  ('Nia', '#14B8A6', 'online'),
  ('Doni', '#3B82F6', 'online'),
  ('Anae', '#3B82F6', 'online')
ON CONFLICT (nickname) DO NOTHING;

-- Add users to rooms
INSERT INTO room_members (room_id, user_id) 
SELECT r.id, u.id
FROM rooms r
CROSS JOIN users u
ON CONFLICT (room_id, user_id) DO NOTHING;
