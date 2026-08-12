-- Seed placeholder users for INICET, NEET MDS, and NEET SS exam types.
-- These populate the find-mates feed for users on newly activated exams.
-- 6 users per exam type, spread across major exam centre states.

INSERT INTO seeded_users (
  id, full_name, gender, phone, exam_type,
  state, district,
  exam_centre_state, exam_centre_district, exam_center,
  travel_mode, stay_plan, bio,
  profile_completed, is_profile_paused, account_status, created_at
) VALUES

-- ── INICET ──────────────────────────────────────────────────────────────────
(gen_random_uuid(), 'Priya Menon',    'Female', '9876500101', 'INICET',
 'Kerala',       'Thiruvananthapuram', 'Delhi',       'New Delhi',       NULL,
 'By flight',    'Need accommodation',
 'MBBS from Kerala. Appearing for INICET 2026 in Delhi. Looking for accommodation near AIIMS and fellow aspirants to travel with.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Arjun Singh',    'Male',   '9876500102', 'INICET',
 'Delhi',        'New Delhi',          'Delhi',       'New Delhi',       NULL,
 'Self-drive',   'Have accommodation',
 'Local Delhi candidate for INICET 2026. Happy to help others find their way around the city.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Kavya Reddy',    'Female', '9876500103', 'INICET',
 'Telangana',    'Hyderabad',          'Telangana',   'Hyderabad',       NULL,
 'By bus',       'Looking for room share',
 'Final-year MBBS, preparing for INICET 2026 in Hyderabad. Looking for a room-share near the exam centre.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Rohan Sharma',   'Male',   '9876500104', 'INICET',
 'Uttar Pradesh','Lucknow',            'Uttar Pradesh','Lucknow',        NULL,
 'By train',     'Need accommodation',
 'MBBS from KGMU Lucknow, writing INICET 2026. Looking to connect with other PG aspirants.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Anjali Nair',    'Female', '9876500105', 'INICET',
 'Tamil Nadu',   'Chennai',            'Tamil Nadu',  'Chennai',         NULL,
 'By train',     'Have accommodation',
 'MBBS from Madras Medical College. Preparing seriously for INICET 2026. Happy to form a study group.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Vikram Patel',   'Male',   '9876500106', 'INICET',
 'Gujarat',      'Ahmedabad',          'Maharashtra', 'Pune',            NULL,
 'By train',     'Need accommodation',
 'Gujarat-based MBBS graduate appearing for INICET in Pune. Looking for accommodation and travel companions.',
 true, false, 'active', NOW()),

-- ── NEET MDS ─────────────────────────────────────────────────────────────────
(gen_random_uuid(), 'Sneha Iyer',     'Female', '9876500201', 'NEET MDS',
 'Tamil Nadu',   'Chennai',            'Tamil Nadu',  'Chennai',         NULL,
 'By bus',       'Have accommodation',
 'BDS from Tamil Nadu. Preparing for NEET MDS 2026. Looking to connect with fellow dental PG aspirants in Chennai.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Rahul Gupta',    'Male',   '9876500202', 'NEET MDS',
 'Uttar Pradesh','Lucknow',            'Uttar Pradesh','Lucknow',        NULL,
 'By train',     'Need accommodation',
 'BDS graduate from UP, writing NEET MDS 2026. Looking for a good PG or hostel near the exam centre.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Divya Pillai',   'Female', '9876500203', 'NEET MDS',
 'Kerala',       'Ernakulam',          'Kerala',      'Thiruvananthapuram', NULL,
 'By train',     'Looking for room share',
 'BDS from Amrita, appearing for NEET MDS 2026 in Thiruvananthapuram. Would love to share accommodation.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Aditya Kumar',   'Male',   '9876500204', 'NEET MDS',
 'West Bengal',  'Kolkata',            'West Bengal', 'Kolkata',         NULL,
 'By bus',       'Have accommodation',
 'Local Kolkata candidate for NEET MDS 2026. Can help others with accommodation leads in the city.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Nisha Joshi',    'Female', '9876500205', 'NEET MDS',
 'Rajasthan',    'Jaipur',             'Rajasthan',   'Jaipur',          NULL,
 'Self-drive',   'Have accommodation',
 'BDS graduate from Rajasthan, writing NEET MDS 2026 in Jaipur. Preparing for Orthodontics/Oral Surgery.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Suresh Babu',    'Male',   '9876500206', 'NEET MDS',
 'Karnataka',    'Bengaluru Urban',    'Karnataka',   'Bengaluru Urban', NULL,
 'By bus',       'Looking for room share',
 'BDS from Bangalore. Targeting NEET MDS 2026. Looking for a study partner and shared accommodation.',
 true, false, 'active', NOW()),

-- ── NEET SS ──────────────────────────────────────────────────────────────────
(gen_random_uuid(), 'Deepika Rao',    'Female', '9876500301', 'NEET SS',
 'Maharashtra',  'Pune',               'Maharashtra', 'Pune',            NULL,
 'By train',     'Have accommodation',
 'MD (General Medicine), appearing for NEET SS 2026 in Pune. Targeting Cardiology DM. Happy to form a group.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Kiran Mehta',    'Male',   '9876500302', 'NEET SS',
 'Gujarat',      'Ahmedabad',          'Gujarat',     'Ahmedabad',       NULL,
 'Self-drive',   'Have accommodation',
 'MS (General Surgery), writing NEET SS 2026 for MCh Neurosurgery. Local Ahmedabad candidate.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Pooja Verma',    'Female', '9876500303', 'NEET SS',
 'Delhi',        'South Delhi',        'Delhi',       'New Delhi',       NULL,
 'By metro',     'Have accommodation',
 'MD Paediatrics from AIIMS, appearing for NEET SS 2026. Targeting Paediatric Cardiology.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Ajay Nair',      'Male',   '9876500304', 'NEET SS',
 'Kerala',       'Kozhikode',          'Kerala',      'Ernakulam',       NULL,
 'By train',     'Need accommodation',
 'MS Orthopaedics from Kozhikode. Writing NEET SS 2026 in Ernakulam. Looking for accommodation near exam centre.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Ritu Agarwal',   'Female', '9876500305', 'NEET SS',
 'Uttar Pradesh','Varanasi',           'Uttar Pradesh','Lucknow',        NULL,
 'By train',     'Need accommodation',
 'MD Radiology, writing NEET SS 2026 for Intervention Radiology DM. Looking for fellow aspirants in UP.',
 true, false, 'active', NOW()),

(gen_random_uuid(), 'Sanjay Krishnan','Male',   '9876500306', 'NEET SS',
 'Tamil Nadu',   'Chennai',            'Tamil Nadu',  'Chennai',         NULL,
 'By bus',       'Have accommodation',
 'MCh Urology from Madras. Writing NEET SS 2026. Happy to help newcomers find their way around Chennai.',
 true, false, 'active', NOW());
