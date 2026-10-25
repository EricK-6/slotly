-- Demo data. Safe to run more than once.

INSERT INTO users (name, email) VALUES
  ('Ada Lovelace',   'ada@uni.example'),
  ('Alan Turing',    'alan@uni.example'),
  ('Grace Hopper',   'grace@uni.example')
ON CONFLICT (email) DO NOTHING;

INSERT INTO resources (name, category, location, max_booking_minutes) VALUES
  ('Xilinx Basys 3 FPGA #1',          'fpga',         'EE Lab 2.14', 180),
  ('Xilinx Basys 3 FPGA #2',          'fpga',         'EE Lab 2.14', 180),
  ('Intel DE10-Lite FPGA',            'fpga',         'EE Lab 2.14', 180),
  ('Keysight DSOX1204G Oscilloscope', 'oscilloscope', 'EE Lab 2.10', 120),
  ('Rigol DS1054Z Oscilloscope',      'oscilloscope', 'EE Lab 2.10', 120),
  ('Raspberry Pi 5 (8GB) #1',         'raspberry_pi', 'Maker Space', 480),
  ('Raspberry Pi 5 (8GB) #2',         'raspberry_pi', 'Maker Space', 480),
  ('Raspberry Pi 4 Cluster Kit',      'raspberry_pi', 'Maker Space', 480)
ON CONFLICT (name) DO NOTHING;
