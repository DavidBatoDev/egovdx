# API Catalog Reference Documentation

Based on the catalog overview (referenced from `image_d449c9.png`), here are the detailed endpoints and services available:

## eGOV PH
*   **Category:** Single sign-on
*   **Description:** Single Sign-On integration for eGov partners.
*   **API Usage Details:**
    *   `POST {{base_url}}/api/token` - Generate Access Token
    *   `POST {{base_url}}/api/partner/sso_authentication` - SSO Authentication
*   **Diagram/Picture:** *[To be added]*

---

## #NationalID | eVerify
*   **Category:** Identity verification
*   **Description:** Verify citizen identity against PhilSys in real time, with consent built into every check.
*   **API Usage Details:**
    *   `POST {{base_url}}/api/auth` - Authenticate (Generate Access Token)
    *   `POST {{base_url}}/api/query` - Verify Personal Information
    *   `POST {{base_url}}/api/query/qr/check` - QR Check
    *   `POST {{base_url}}/api/query/qr` - QR Verify
*   **Diagram/Picture:** *[To be added]*

---

## eMessage
*   **Category:** Notifications
*   **Description:** Deliver SMS, email and in-app notices to citizens through a single messaging API.
*   **API Usage Details:**
    *   `POST {{base_url}}/messaging/v1/sms/push` - Push SMS
*   **Diagram/Picture:** *[To be added]*

---

## eGov AI
*   **Category:** AI services
*   **Description:** Document intelligence, translation and conversational endpoints tuned for government workloads.
*   **API Usage Details:**
    *   **POST:** 
        *   Generate Access Token
        *   AI Assistant
        *   Speech Maker
        *   Tourism
        *   Laws & Regulations
        *   Translator
        *   Document Extractor
    *   **GET:** 
        *   Token Credits
*   **Diagram/Picture:** *[To be added]*

---

## eGOV PAY
*   **Category:** Digital payments
*   **Description:** Collect and reconcile government fees and charges through one gateway, with real-time settlement across accredited payment channels.
*   **API Usage Details:**
    *   `POST` - Generate Payment
    *   `GET` - Check Transaction Details
    *   `PUT` - Void Transaction
*   **Diagram/Picture:** *[To be added]*

---

## eGOV chain
*   **Category:** Blockchain
*   **Description:** Anchor records and run smart contracts on a zero-fee government blockchain (Hyperledger Besu) over JSON-RPC, for tamper-evident, verifiable state.
*   **API Usage Details:** *[To be added]*
*   **Diagram/Picture:** *[To be added]*

---

## eReport
*   **Category:** Citizen reports
*   **Description:** Let citizens file and track complaints and reports: submit a complaint, verify by OTP, then list and view report status by case number.
*   **API Usage Details:**
    *   **GET (Datasets & Reports):**
        *   Report Type List
        *   Region List
        *   Province List by Params
        *   Municipality List by Params
        *   Barangay List by Params
        *   Reports List
        *   View Report by Case Number
    *   **POST (Actions):**
        *   Generate Token
        *   Submit Complaint
        *   Verify - Request OTP
        *   Verify - Confirm OTP
*   **Diagram/Picture:** *[To be added]*

---

## FACE LIVENESS
*   **Category:** Liveness detection
*   **Description:** Confirm a live person is present during identity capture: create a liveness session, then fetch the verification result.
*   **API Usage Details:**
    *   `POST {{baseUrl}}/v1/liveness/session` - Create Session
    *   `GET {{baseUrl}}/v1/liveness/result/{{sessionToken}}` - Get Verification Result
*   **Diagram/Picture:** *[To be added]*

---

## DBM COMPASS
*   **Category:** Budget transparency
*   **Description:** Centralized Open Monitoring Platform for Appropriations and Spending Statistics: programmatic access to public DBM budget-execution data — SAAODB, NCA, SARO, and LGSF records and dashboard summaries.
*   **API Usage Details:**
    *   `GET` - SAAODB Records
    *   `GET` - SAAODB Dashboard Summary
    *   `GET` - SAAODB Hierarchical Entities
    *   `GET` - NCA Records
    *   `GET` - SARO Records
    *   `GET` - LGSF Records
    *   `GET` - LGSF Dashboard Sum_
*   **Diagram/Picture:** *[To be added]*