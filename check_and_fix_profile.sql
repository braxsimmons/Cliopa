-- First, check if your profile exists
SELECT id, email, role, first_name, last_name FROM profiles
WHERE id = '50b44e78-86c6-460e-a69c-8fe26b38d2ed';

-- If it doesn't exist or has wrong role, insert or update it
INSERT INTO profiles (id, email, role, first_name, last_name, team, hourly_rate)
VALUES (
    '50b44e78-86c6-460e-a69c-8fe26b38d2ed',
    'braxsimmons01@gmail.com',
    'admin',
    'Brax',
    'Simmons',
    'Management',
    25.00
)
ON CONFLICT (id)
DO UPDATE SET
    role = 'admin',
    first_name = 'Brax',
    last_name = 'Simmons',
    team = 'Management',
    hourly_rate = 25.00;

-- Verify it worked
SELECT id, email, role, first_name, last_name, team FROM profiles
WHERE id = '50b44e78-86c6-460e-a69c-8fe26b38d2ed';
