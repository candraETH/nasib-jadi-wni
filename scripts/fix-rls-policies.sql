-- Drop existing policies for users table
DROP POLICY IF EXISTS "Users can read all users" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert users" ON users;

-- Drop existing policies for rooms table
DROP POLICY IF EXISTS "Anyone can read rooms" ON rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON rooms;

-- Drop existing policies for room_members table
DROP POLICY IF EXISTS "Users can read room members" ON room_members;
DROP POLICY IF EXISTS "Users can join rooms" ON room_members;

-- Drop existing policies for messages table
DROP POLICY IF EXISTS "Users can read messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

-- Drop existing policies for private_messages table
DROP POLICY IF EXISTS "Users can read their own private messages" ON private_messages;
DROP POLICY IF EXISTS "Users can send private messages" ON private_messages;

-- Drop existing policies for blocked_users and muted_users
DROP POLICY IF EXISTS "Users can manage blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can view blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can manage muted users" ON muted_users;
DROP POLICY IF EXISTS "Users can view muted users" ON muted_users;

-- Drop existing policies for moderation_logs
DROP POLICY IF EXISTS "Users can read moderation logs" ON moderation_logs;
DROP POLICY IF EXISTS "Users can create moderation logs" ON moderation_logs;

-- NEW RLS POLICIES FOR ANONYMOUS USERS

-- Users table - allow anonymous to read all, insert new users
CREATE POLICY "Allow anyone to read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow anyone to insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (id::text = current_setting('app.user_id', true) OR current_setting('app.user_id', true) IS NULL);

-- Rooms table
CREATE POLICY "Allow anyone to read public rooms" ON rooms FOR SELECT USING (is_public = true);
CREATE POLICY "Allow anyone to create rooms" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to update rooms" ON rooms FOR UPDATE USING (true);

-- Room members table
CREATE POLICY "Allow anyone to read room members" ON room_members FOR SELECT USING (true);
CREATE POLICY "Allow anyone to join rooms" ON room_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to update room members" ON room_members FOR UPDATE USING (true);

-- Messages table
CREATE POLICY "Allow anyone to read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Allow anyone to send messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to update messages" ON messages FOR UPDATE USING (true);
CREATE POLICY "Allow anyone to delete messages" ON messages FOR DELETE USING (true);

-- Private messages table
CREATE POLICY "Allow anyone to read private messages" ON private_messages FOR SELECT USING (true);
CREATE POLICY "Allow anyone to send private messages" ON private_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to update private messages" ON private_messages FOR UPDATE USING (true);
CREATE POLICY "Allow anyone to delete private messages" ON private_messages FOR DELETE USING (true);

-- Blocked users table
CREATE POLICY "Allow anyone to read blocked users" ON blocked_users FOR SELECT USING (true);
CREATE POLICY "Allow anyone to manage blocked users" ON blocked_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to delete blocked users" ON blocked_users FOR DELETE USING (true);

-- Muted users table
CREATE POLICY "Allow anyone to read muted users" ON muted_users FOR SELECT USING (true);
CREATE POLICY "Allow anyone to manage muted users" ON muted_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anyone to update muted users" ON muted_users FOR UPDATE USING (true);
CREATE POLICY "Allow anyone to delete muted users" ON muted_users FOR DELETE USING (true);

-- Moderation logs table
CREATE POLICY "Allow anyone to read moderation logs" ON moderation_logs FOR SELECT USING (true);
CREATE POLICY "Allow anyone to create moderation logs" ON moderation_logs FOR INSERT WITH CHECK (true);
