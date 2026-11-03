-- Database Setup
CREATE DATABASE IF NOT EXISTS cihrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cihrm;

-- Table: Users (Students, Instructors, Administrators)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('Student', 'Instructor', 'Administrator') NOT NULL DEFAULT 'Student',
    department VARCHAR(120),
    year_level VARCHAR(40),
    status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: Guest Profiles
CREATE TABLE guest (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(190),
    phone VARCHAR(40),
    address VARCHAR(255),
    id_type VARCHAR(80),
    preferences TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: Hotel Rooms and Statuses
CREATE TABLE room (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    room_type VARCHAR(80) NOT NULL,
    floor INT NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    max_occupancy INT NOT NULL,
    housekeeping_status ENUM('Clean', 'Dirty', 'Maintenance') DEFAULT 'Clean',
    occupancy_status ENUM('Available', 'Reserved', 'Occupied', 'Maintenance') DEFAULT 'Available'
);

-- Table: Reservations
CREATE TABLE reservation (
    reservation_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT NOT NULL,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    booking_type ENUM('Walk-in', 'Advance') DEFAULT 'Advance',
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    number_of_nights INT NOT NULL,
    pax INT NOT NULL,
    reservation_status ENUM('Pending', 'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES guest(guest_id),
    FOREIGN KEY (room_id) REFERENCES room(room_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX (room_id, check_in_date, check_out_date)
);

-- Table: Folio / Billing Statement
CREATE TABLE folio (
    folio_id INT AUTO_INCREMENT PRIMARY KEY,
    reservation_id INT NOT NULL UNIQUE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_type VARCHAR(40),
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(10,2) DEFAULT 0,
    payment_status ENUM('Unpaid', 'Paid (Simulation)', 'Partially Paid (Simulation)') DEFAULT 'Unpaid',
    FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id) ON DELETE CASCADE
);

-- Table: Folio Line Items
CREATE TABLE folio_item (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    folio_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    category VARCHAR(80),
    amount DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (folio_id) REFERENCES folio(folio_id) ON DELETE CASCADE
);

-- Table: Activity Logs
CREATE TABLE activity_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Table: Learning Scenarios
CREATE TABLE scenario (
    scenario_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(180) NOT NULL,
    description TEXT,
    difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
    learning_objectives TEXT,
    instructions TEXT,
    target_points INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: Student Assessments & Progress Tracker
CREATE TABLE student_assessment (
    assessment_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    scenario_id INT NOT NULL,
    score DECIMAL(5,2),
    submission_status ENUM('Assigned', 'In Progress', 'Submitted', 'Reviewed') DEFAULT 'Assigned',
    student_notes TEXT,
    instructor_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (scenario_id) REFERENCES scenario(scenario_id)
);

-- ----------------------------------------------------
-- Demo Data Seed
-- ----------------------------------------------------

-- Demo accounts. Password for all three is password123 (change immediately in a real deployment).
INSERT INTO users (full_name, email, password, role, department, year_level) VALUES
('Demo Student', 'student@cihrm.test', '$2y$12$jKJwaOcN2X/lJE6QtWFLbu/Yrgz0tdWVH1uXEvIzsYI.4TdT0viAO', 'Student', 'Hospitality Management', '3rd Year'),
('Demo Instructor', 'instructor@cihrm.test', '$2y$12$jKJwaOcN2X/lJE6QtWFLbu/Yrgz0tdWVH1uXEvIzsYI.4TdT0viAO', 'Instructor', 'Hospitality Management', 'Faculty'),
('System Administrator', 'admin@cihrm.test', '$2y$12$jKJwaOcN2X/lJE6QtWFLbu/Yrgz0tdWVH1uXEvIzsYI.4TdT0viAO', 'Administrator', 'IT', '');

-- Sample Rooms
INSERT INTO room (room_number, room_type, floor, rate, max_occupancy) VALUES
('101', 'Standard', 1, 1800, 2),
('102', 'Standard', 1, 1800, 2),
('103', 'Standard', 1, 1800, 2),
('201', 'Deluxe', 2, 2500, 3),
('202', 'Deluxe', 2, 2500, 3),
('301', 'Suite', 3, 4800, 2);

-- Sample Scenarios
INSERT INTO scenario (title, description, difficulty, learning_objectives, instructions, target_points) VALUES
('Walk-in Guest Reservation', 'A guest arrives without a prior booking and requests an available room.', 'Beginner', 'Practice guest registration and room assignment.', 'Register the guest, check room availability, create a walk-in reservation, and explain the confirmation. ', 100),
('Guest Check-in Procedure', 'A confirmed guest arrives at the front desk.', 'Beginner', 'Verify reservation and update occupancy.', 'Find the reservation and complete check-in using the reservation actions.', 100),
('Billing and Folio Generation', 'Prepare a guest folio for a completed stay.', 'Intermediate', 'Calculate accommodation, discount, and tax.', 'Open Billing & Folio, apply sample discount and tax, and submit a brief explanation.', 100);