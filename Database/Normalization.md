# Complete Normalization

## 1NF (First Normal Form)

Normalization to **1NF** ensured that all attributes are atomic and repeating groups were removed.

* Multiple resource types in a submission were moved to **SUBMISSION_LINE_ITEM** instead of storing them in **MONTHLY_SUBMISSION**.
* Multiple invoice files were separated into the **INVOICE** table.
* Multiple revision comments were separated into the **REPORT_REVISION** table.
* User activity history was separated into **ACTIVITY_LOG** instead of storing it in **USER** or **DEPARTMENT**.
* Fields such as email, mobile, role, dept_name, and action_description contain only single atomic values.
* Activity logs were maintained in **ACTIVITY_LOG** with references to user and department.

---

## 2NF (Second Normal Form)

Normalization to **2NF** removed partial dependencies.

* Submission validation details were separated into **SUBMISSION_STATUS**.
* Carbon emission data was separated into **CARBON_EMISSION**.
* Report approval details were separated into **REPORT_APPROVAL**.
* Consumption targets were stored in **CONSUMPTION_TARGET** linked to both dept_id and resource_type_id.

---

## 3NF (Third Normal Form)

Normalization to **3NF** removed transitive dependencies.

* Alert resolution details were moved to **ALERT_RESOLUTION**.
* Escalation information was stored in **ESCALATION**.
* Notification information was stored in **NOTIFICATION**.
* Role snapshot was stored directly in **ACTIVITY_LOG** to preserve the role at the time of action.

---

## BCNF (Boyce–Codd Normal Form)

Normalization to **BCNF** ensured every determinant is a candidate key.

* Each entity has a primary key:

  * USER → user_id
  * ORGANIZATION → org_id
  * DEPARTMENT → dept_id
  * MONTHLY_SUBMISSION → submission_id
  * ALERT → alert_id
  * SUSTAINABILITY_REPORT → report_id
  * CONSUMPTION_TARGET → target_id
  * ACTIVITY_LOG → log_id

* Redundant attributes were removed:

  * dept_id removed from **ALERT** and **CARBON_EMISSION**
  * org_id removed from **SUSTAINABILITY_REPORT**
  * dept_id removed from **NOTIFICATION**

* Supporting relations like **SUBMISSION_STATUS**, **ALERT_RESOLUTION**, and **REPORT_APPROVAL** were separated to maintain BCNF.

---

## Result

The schema now eliminates redundancy, prevents update anomalies, and ensures all relations follow proper normalization rules up to **BCNF**.
