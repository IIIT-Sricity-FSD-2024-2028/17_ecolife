# Complete Normalization

## 1NF (First Normal Form)

Normalization to 1NF ensured all attributes are atomic and removed repeating groups across relations.

- Multiple resource types entered within a single monthly submission were separated into the **SUBMISSION_LINE_ITEM** relation instead of storing multiple fuel entries inside **MONTHLY_SUBMISSION**.
- Invoice files attached to a submission were separated into the **INVOICE** relation instead of storing multiple file references inside **MONTHLY_SUBMISSION**.
- Revision comments across multiple rounds were separated into the **REPORT_REVISION** relation instead of storing multiple comment entries inside **SUSTAINABILITY_REPORT**.
- Atomic attributes were ensured in relations such as **USER**, **ORGANIZATION**, and **DEPARTMENT** so fields like email, mobile, role, and dept_name contain single values only.
- This reduced data duplication within single rows and improved clarity of relations such as **MONTHLY_SUBMISSION**, **SUSTAINABILITY_REPORT**, and **ALERT**.

---

## 2NF (Second Normal Form)

Normalization to 2NF removed partial dependencies where non-key attributes depended on only part of a composite key.

Submission validation details were separated from core submission data:

MONTHLY_SUBMISSION(
submission_id,
dept_id,
submitted_by,
reporting_month,
reporting_year,
is_locked,
submission_date
)

SUBMISSION_STATUS(
submission_id,
validation_status,
processed_status,
status_color
)

Carbon emission details were separated from submission and resource data:

CARBON_EMISSION(
emission_id,
submission_id,
resource_type_id,
co2_kg,
calculated_by,
calculated_at
)

Report approval details were separated from report generation details:

SUSTAINABILITY_REPORT(
report_id,
generated_by,
report_content,
pdf_file_path,
from_month,
from_year,
to_month,
to_year,
status,
submitted_at
)

REPORT_APPROVAL(
report_id,
approved_by,
approved_at
)

This reduced duplicate storage of status, approval, and emission data across multiple records.

---

## 3NF (Third Normal Form)

Normalization to 3NF removed transitive dependencies where non-key attributes were determined by other non-key attributes.

Alert resolution details were separated from alert trigger details:

ALERT(
alert_id,
submission_id,
severity,
cause_type,
status,
explanation,
corrective_action,
triggered_at
)

ALERT_RESOLUTION(
alert_id,
resolved_at,
last_event_note
)

Escalation details were separated from alert data:

ESCALATION(
escalation_id,
alert_id,
escalated_by,
acknowledged_by,
escalation_message,
coo_response,
escalated_at,
responded_at
)

Notification details were separated from user and department data:

NOTIFICATION(
notification_id,
recipient_id,
type,
message,
is_read,
created_at
)

Consumption target and alert threshold details were separated from department records:

CONSUMPTION_TARGET(
target_id,
dept_id,
set_by,
monthly_target,
alert_threshold,
is_active,
created_at
)

User role information was kept in a single USER relation with a role attribute to avoid redundant role tables while maintaining clarity across COO, Manager, Analyst, and Admin roles.

This reduced indirect attribute dependencies and redundant storage of alert, escalation, and notification information.

---

## BCNF (Boyce–Codd Normal Form)

Normalization to BCNF ensured that every determinant in each relation is a candidate key, fully eliminating update, insertion, and deletion anomalies.

Each entity now has a clear primary key dependency:

USER → user_id  
ORGANIZATION → org_id  
DEPARTMENT → dept_id  
MONTHLY_SUBMISSION → submission_id  
ALERT → alert_id  
SUSTAINABILITY_REPORT → report_id  

The redundant dept_id was removed from ALERT and CARBON_EMISSION since it could be derived transitively through:

submission_id → MONTHLY_SUBMISSION.dept_id

The redundant org_id was removed from SUSTAINABILITY_REPORT since it could be derived through:

generated_by → USER.org_id

The redundant dept_id was removed from NOTIFICATION since it could be derived through:

recipient_id → USER → DEPARTMENT

REPORT_SUBMISSION_LINK was introduced as a junction table to resolve the Many-to-Many relationship between SUSTAINABILITY_REPORT and MONTHLY_SUBMISSION.

SUBMISSION_STATUS, ALERT_RESOLUTION, and REPORT_APPROVAL were decomposed as separate relations to ensure every non-key attribute depends solely on the primary key of its own relation.

This eliminated update, insertion, and deletion anomalies across the complete schema.
