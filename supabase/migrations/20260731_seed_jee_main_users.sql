-- Seed users for JEE Main 2026 exam
-- 10 users spread across major states where JEE Main candidates are concentrated

INSERT INTO seeded_users (
  full_name, gender, exam_type,
  exam_centre_state, exam_centre_district, exam_center,
  state, district,
  travel_mode, stay_plan, bio
) VALUES
  ('Aditya Rao',        'Male',   'JEE Main', 'Maharashtra',      'Pune',        'Pune',        'Maharashtra',      'Pune',        'By train',  'Need accommodation', 'JEE Main 2026 | Looking for travel buddies from Pune centre'),
  ('Ishita Bansal',     'Female', 'JEE Main', 'Delhi',            'New Delhi',   'New Delhi',   'Delhi',            'New Delhi',   'By metro',  'Have accommodation', 'JEE Main aspirant | Happy to help with accommodation tips in Delhi'),
  ('Rohan Kulkarni',    'Male',   'JEE Main', 'Maharashtra',      'Mumbai',      'Mumbai',      'Maharashtra',      'Mumbai',      'By train',  'Need accommodation', 'JEE Main 2026 | Looking for a roommate near the Mumbai exam centre'),
  ('Anjali Pillai',     'Female', 'JEE Main', 'Kerala',           'Ernakulam',   'Kochi',       'Kerala',           'Ernakulam',   'By bus',    'Have accommodation', 'JEE Main — writing from Kochi centre, can coordinate travel'),
  ('Vikram Yadav',      'Male',   'JEE Main', 'Uttar Pradesh',    'Lucknow',     'Lucknow',     'Uttar Pradesh',    'Lucknow',     'By train',  'Need accommodation', 'JEE Main 2026 | Need stay near Lucknow centre, open to sharing'),
  ('Sanjana Reddy',     'Female', 'JEE Main', 'Telangana',        'Hyderabad',   'Hyderabad',   'Telangana',        'Hyderabad',   'By train',  'Have accommodation', 'JEE Main 2026 | Writing in Hyderabad, can help with local stay'),
  ('Karthik Iyer',      'Male',   'JEE Main', 'Karnataka',        'Bengaluru',   'Bengaluru',   'Karnataka',        'Bengaluru',   'By bus',    'Need accommodation', 'JEE Main aspirant | Bangalore centre, looking for accommodation sharing'),
  ('Priyanka Sharma',   'Female', 'JEE Main', 'Rajasthan',        'Kota',        'Kota',        'Rajasthan',        'Kota',        'By train',  'Need accommodation', 'JEE Main 2026 | Kota centre — need travel partner from station'),
  ('Debashish Roy',     'Male',   'JEE Main', 'West Bengal',      'Kolkata',     'Kolkata',     'West Bengal',      'Kolkata',     'By train',  'Have accommodation', 'JEE Main 2026 | Writing in Kolkata, accommodation sorted, travel buddies welcome'),
  ('Nikita Desai',      'Female', 'JEE Main', 'Gujarat',          'Ahmedabad',   'Ahmedabad',   'Gujarat',          'Ahmedabad',   'By train',  'Need accommodation', 'JEE Main aspirant | Ahmedabad centre, looking for travel and stay coordination');
