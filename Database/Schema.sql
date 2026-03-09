CREATE DATABASE EcoLifeDB;
USE EcoLifeDB;

CREATE TABLE ORGANIZATION (
    org_id INT AUTO_INCREMENT PRIMARY KEY,
    org_name VARCHAR(255) NOT NULL,
    created_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE USER (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    org_id INT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    mobile VARCHAR(20),
    profile_photo VARCHAR(500),
    role VARCHAR(50) NOT NULL,
    is_activated BOOLEAN DEFAULT FALSE,
    credentials_sent_at DATETIME,
    credentials_resent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_org
        FOREIGN KEY (org_id)
        REFERENCES ORGANIZATION(org_id)
        ON DELETE CASCADE
);

ALTER TABLE ORGANIZATION
ADD CONSTRAINT fk_org_created_by
FOREIGN KEY (created_by)
REFERENCES USER(user_id);

CREATE TABLE DEPARTMENT (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(255) NOT NULL,
    org_id INT NOT NULL,
    manager_id INT,

    CONSTRAINT fk_dept_org
        FOREIGN KEY (org_id)
        REFERENCES ORGANIZATION(org_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_dept_manager
        FOREIGN KEY (manager_id)
        REFERENCES USER(user_id)
        ON DELETE SET NULL
);

CREATE TABLE CONSUMPTION_TARGET (
    target_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    set_by INT NOT NULL,
    resource_type_id INT NOT NULL,           
    monthly_target DECIMAL(15,2) NOT NULL CHECK (monthly_target >= 0),
    alert_threshold DECIMAL(15,2) NOT NULL CHECK (alert_threshold >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id) ON DELETE CASCADE,
    FOREIGN KEY (set_by) REFERENCES USER(user_id),
    FOREIGN KEY (resource_type_id) REFERENCES RESOURCE_TYPE(resource_type_id)  
);

CREATE TABLE RESOURCE_TYPE (
    resource_type_id INT AUTO_INCREMENT PRIMARY KEY,
    resource_name VARCHAR(255) NOT NULL,
    default_unit VARCHAR(50),
    dept_id INT NOT NULL,

    FOREIGN KEY (dept_id)
        REFERENCES DEPARTMENT(dept_id)
        ON DELETE CASCADE
);

CREATE TABLE MONTHLY_SUBMISSION (
    submission_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_id INT NOT NULL,
    submitted_by INT NOT NULL,
    reporting_month TINYINT NOT NULL CHECK (reporting_month BETWEEN 1 AND 12),
    reporting_year YEAR NOT NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id),
    FOREIGN KEY (submitted_by) REFERENCES USER(user_id)
);

CREATE TABLE SUBMISSION_STATUS (
    submission_id INT PRIMARY KEY,
    validation_status VARCHAR(50),
    processed_status VARCHAR(50),
    status_color VARCHAR(20),

    FOREIGN KEY (submission_id)
        REFERENCES MONTHLY_SUBMISSION(submission_id)
        ON DELETE CASCADE
);

CREATE TABLE SUBMISSION_LINE_ITEM (
    line_item_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    resource_type_id INT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL CHECK (quantity >= 0),

    FOREIGN KEY (submission_id)
        REFERENCES MONTHLY_SUBMISSION(submission_id)
        ON DELETE CASCADE,

    FOREIGN KEY (resource_type_id)
        REFERENCES RESOURCE_TYPE(resource_type_id)
);

CREATE TABLE INVOICE (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    file_path VARCHAR(500),
    invoice_total DECIMAL(15,2) CHECK (invoice_total >= 0),
    is_matched BOOLEAN DEFAULT FALSE,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES MONTHLY_SUBMISSION(submission_id)
);

CREATE TABLE ALERT (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    severity VARCHAR(50),
    cause_type VARCHAR(100),
    status VARCHAR(50),
    explanation TEXT,
    corrective_action TEXT,
    triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id)
        REFERENCES MONTHLY_SUBMISSION(submission_id)
);

CREATE TABLE ALERT_RESOLUTION (
    alert_id INT PRIMARY KEY,
    resolved_at DATETIME,
    last_event_note TEXT,

    FOREIGN KEY (alert_id)
        REFERENCES ALERT(alert_id)
        ON DELETE CASCADE
);

CREATE TABLE ESCALATION (
    escalation_id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT NOT NULL,
    escalated_by INT NOT NULL,
    acknowledged_by INT,
    escalation_message TEXT,
    coo_response TEXT,
    escalated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,

    FOREIGN KEY (alert_id) REFERENCES ALERT(alert_id),
    FOREIGN KEY (escalated_by) REFERENCES USER(user_id),
    FOREIGN KEY (acknowledged_by) REFERENCES USER(user_id) ON DELETE SET NULL
);

CREATE TABLE CARBON_EMISSION (
    emission_id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    resource_type_id INT NOT NULL,
    co2_kg DECIMAL(15,4) NOT NULL CHECK (co2_kg >= 0),
    calculated_by INT NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (submission_id) REFERENCES MONTHLY_SUBMISSION(submission_id) ON DELETE CASCADE,
    FOREIGN KEY (resource_type_id) REFERENCES RESOURCE_TYPE(resource_type_id),
    FOREIGN KEY (calculated_by) REFERENCES USER(user_id)
);

CREATE TABLE SUSTAINABILITY_REPORT (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    generated_by INT NOT NULL,
    report_content TEXT,
    pdf_file_path VARCHAR(500),
    from_month TINYINT NOT NULL CHECK (from_month BETWEEN 1 AND 12),
    from_year YEAR NOT NULL,
    to_month TINYINT NOT NULL CHECK (to_month BETWEEN 1 AND 12),
    to_year YEAR NOT NULL,
    status VARCHAR(50),
    submitted_at DATETIME,

    FOREIGN KEY (generated_by) REFERENCES USER(user_id)
);

CREATE TABLE REPORT_SUBMISSION_COVERAGE (
    report_id INT NOT NULL,
    submission_id INT NOT NULL,
    PRIMARY KEY (report_id, submission_id),

    FOREIGN KEY (report_id)
        REFERENCES SUSTAINABILITY_REPORT(report_id)
        ON DELETE CASCADE,

    FOREIGN KEY (submission_id)
        REFERENCES MONTHLY_SUBMISSION(submission_id)
        ON DELETE CASCADE
);

CREATE TABLE REPORT_APPROVAL (
    report_id INT PRIMARY KEY,
    approved_by INT NOT NULL,
    approved_at DATETIME,

    FOREIGN KEY (report_id)
        REFERENCES SUSTAINABILITY_REPORT(report_id)
        ON DELETE CASCADE,

    FOREIGN KEY (approved_by)
        REFERENCES USER(user_id)
);

CREATE TABLE REPORT_REVISION (
    revision_id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    revised_by INT NOT NULL,
    reviewed_by INT,
    revision_comments TEXT,
    revision_round INT DEFAULT 1 CHECK (revision_round > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (report_id)
        REFERENCES SUSTAINABILITY_REPORT(report_id)
        ON DELETE CASCADE,

    FOREIGN KEY (revised_by) REFERENCES USER(user_id),
    FOREIGN KEY (reviewed_by) REFERENCES USER(user_id) ON DELETE SET NULL
);

CREATE TABLE NOTIFICATION (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    recipient_id INT NOT NULL,
    type VARCHAR(100),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (recipient_id)
        REFERENCES USER(user_id)
        ON DELETE CASCADE
);

CREATE TABLE ACTIVITY_LOG (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NOT NULL,                     
    role VARCHAR(50),                          
    action_description TEXT,                  
    dept_id INT,                           
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (actor_id)
        REFERENCES USER(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (dept_id)
        REFERENCES DEPARTMENT(dept_id)
        ON DELETE SET NULL
);
