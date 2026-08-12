-- Seed users for FMGE 2026 Jun exam
-- 10 users spread across major states where FMGE candidates are concentrated

INSERT INTO seeded_users (
  full_name, gender, exam_type,
  exam_centre_state, exam_centre_district, exam_center,
  state, district,
  travel_mode, stay_plan, bio
) VALUES
  ('Priya Krishnan',    'Female', 'FMGE', 'Tamil Nadu',       'Chennai',     'Chennai',     'Tamil Nadu',       'Chennai',     'By train',  'Need accommodation', 'FMGE June 2026 | Looking for travel buddies from Chennai centre'),
  ('Arjun Sharma',      'Male',   'FMGE', 'Delhi',            'New Delhi',   'New Delhi',   'Delhi',            'New Delhi',   'By metro',  'Have accommodation', 'FMGE aspirant | Happy to help with accommodation tips in Delhi'),
  ('Sneha Patel',       'Female', 'FMGE', 'Maharashtra',      'Mumbai',      'Mumbai',      'Maharashtra',      'Mumbai',      'By train',  'Need accommodation', 'FMGE 2026 | Looking for a roommate near the Mumbai exam centre'),
  ('Rahul Nair',        'Male',   'FMGE', 'Kerala',           'Ernakulam',   'Kochi',       'Kerala',           'Ernakulam',   'By bus',    'Have accommodation', 'FMGE June — writing from Kochi centre, can coordinate travel'),
  ('Ankita Singh',      'Female', 'FMGE', 'Uttar Pradesh',    'Lucknow',     'Lucknow',     'Uttar Pradesh',    'Lucknow',     'By train',  'Need accommodation', 'FMGE 2026 Jun | Need stay near Lucknow centre, open to sharing'),
  ('Kiran Reddy',       'Male',   'FMGE', 'Telangana',        'Hyderabad',   'Hyderabad',   'Telangana',        'Hyderabad',   'By train',  'Have accommodation', 'FMGE June 2026 | Writing in Hyderabad, can help with local stay'),
  ('Meera Joshi',       'Female', 'FMGE', 'Karnataka',        'Bengaluru',   'Bengaluru',   'Karnataka',        'Bengaluru',   'By bus',    'Need accommodation', 'FMGE aspirant | Bangalore centre, looking for accommodation sharing'),
  ('Suresh Gupta',      'Male',   'FMGE', 'Rajasthan',        'Jaipur',      'Jaipur',      'Rajasthan',        'Jaipur',      'By train',  'Need accommodation', 'FMGE June 2026 | Jaipur centre — need travel partner from station'),
  ('Divya Menon',       'Female', 'FMGE', 'West Bengal',      'Kolkata',     'Kolkata',     'West Bengal',      'Kolkata',     'By train',  'Have accommodation', 'FMGE 2026 | Writing in Kolkata, accommodation sorted, travel buddies welcome'),
  ('Amit Verma',        'Male',   'FMGE', 'Gujarat',          'Ahmedabad',   'Ahmedabad',   'Gujarat',          'Ahmedabad',   'By train',  'Need accommodation', 'FMGE June aspirant | Ahmedabad centre, looking for travel and stay coordination');
