-- Fix user role and profile for braxsimmons01@gmail.com
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT id, email, role FROM profiles WHERE email = 'braxsimmons01@gmail.com';

-- Update the user to be an admin
UPDATE profiles
SET
    role = 'admin',
    first_name = 'Brax',
    last_name = 'Simmons',
    team = 'Management',
    hourly_rate = 25.00
WHERE email = 'braxsimmons01@gmail.com';

-- Verify the update
SELECT id, email, role, first_name, last_name, team FROM profiles WHERE email = 'braxsimmons01@gmail.com';
