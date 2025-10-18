READERS WORKFLOW.
1. The reader receives an Introductory email with a reader specific clickable PIN/ID number, which directs them to a secure QOLAE Portal for the readers workspace, once they click on this hyperlinked PIN. The workflow process is similar to the LawyersLoginPortal (the Bridge) 

2. Once they go through the 2FA authentication, username and creation of password in the Secure Login, they are redirected to the **HR Compliance Gate** (mandatory step before dashboard access).

---

## HR COMPLIANCE GATE (Initial Login Only)

**Purpose:** Collect CV and references for audit-ready compliance records before granting access to the Readers Dashboard.

**Location:** `readers.qolae.com/compliance` (this has been changed to hrcompliance.qolae.com)

**Database:** `qolae_hrcompliance` (separate secure HR database)

### Reader's Compliance Submission:

The reader must complete the following **once** at initial login:

**a) Upload CV (PDF)**
- Required field
- Stored securely in HR compliance database

**b) Provide 2 References:**

**Reference 1: Professional Reference**
- Name
- Title/Position
- Organisation
- Email
- Phone
- Relationship to reader (e.g., "Former supervisor at X Hospital")

**Reference 2: Character Reference**
- Name
- Relationship (e.g., "Colleague", "Academic supervisor")
- Email
- Phone
- How long they've known the reader

**Submission:**
- On submit, compliance data is saved to `qolae_hrcompliance` database
- Reader's `compliance_submitted` flag is set to `true` in `qolae_readers` database (is this db still necessary????)
- Case Manager (Liz) receives notification in her workspace
- Reader sees: "Thank you! Your compliance documents are being reviewed. You'll receive dashboard access shortly."

### Case Manager's Review Process:

**On Case Managers Dashboard:**
- Status badge appears: "Sarah Mitchell - Compliance Submitted" (pending status)
- Liz clicks "Review" → Modal opens showing CV + referee details
- Liz can download/view CV

**Reference Collection (Flexible Process):**

**Option A - Phone Reference (Preferred):**
1. Liz calls referee
2. Liz fills out `reference-form.ejs` with referee's answers during call
3. System emails pre-filled form to referee for review and digital signature
4. Referee reviews (already filled), signs digitally (30 seconds)
5. Signed reference saved to `qolae_hrcompliance` database

**Option B - Email Reference:**
1. Referee prefers not to have phone call
2. System emails blank `reference-form.ejs` to referee
3. Referee fills out form themselves and signs digitally
4. Signed reference saved to `qolae_hrcompliance` database

**Approval:**
- Once both references are signed and saved
- Liz clicks "Approve Compliance"
- Compliance record is locked in HR database
- Reader's account is fully activated
- Reader receives email: "Your compliance has been approved. You can now access your dashboard."

**Next Login:**
3. Reader logs in → automatically redirected to their customised Readers Dashboard (no compliance gate shown again)

---

4. The Readers Dashboard has a similar layout to the Lawyers Dashboard - though the colours are slightly different. Brand Colours and Logo are the same. There is a Welcome panel, Workflow Progress Panel and the Modal Workflow cards specific to the Readers Workflow.

5. The Modal Workflow Cards are:  

a) Non Disclosure Agreement (NDA is revealed and they can review and sign this form digitally) opens 
- with a "Review and Sign" clickable button (similar to the Terms Of Business tobModal workflow Card on the Lawyyers Dashboard). This opens up into a ndaModal with the following: 

Step 1 pulls up the saved customisedNDA.pdf and Reader can review the document. not sure whether to have an email notification preference in Step 1?

Step 2 takes the Reader to the Signature workflow which is (similar to Lawyers Dashboard) draw signature, add drawn signature to NDA and Liz’s signature is applied once the reader ticks the box to send and a copy will be made available to the reader in their workspace and also in Liz’s workspace as well as being saved to the qolae_readers db/central-repository/signedNDA.pdf - let's discuss this.

Step 3  - Preview Signed NDA and flatten on the way to step 4. 

Step 4 Completion: Download NDA.pdf and View NDA.pdf is here, copy of NDA is saved to qolae_readers db and to the Documents Library Modal on the Readers Dashboard. Communicate to Parent Dashboard that Workflow is completed. 

"Return to Dashboard" button takes Reader back to Readers Dashboard, "Review & Sign" has now turned into "View Summary" and on clicking this, it reveals completed workflow summary. Workflow Progress is ticked and db is updated, next gate opens only once the INA report is ready.Once the INA Report is ready, an email will be sent to the First reader and a redacted copy will be made available in the Readers Dashboard for review notification flags will share status on this Dashboard.

b) INA Report - (perhaps with a Read, Edit & Review clickable button)
This opens to a Modal with a copy of the INA report or a "Read" 

Step 1(that opens up the redacted INA report copy,  that has been allocated to the Readers Dashhboard workspace from the CaseManager's Workspace), then an 

"Edit" Step 2 allows the Reader to edit within the modal and "Save" changes, 

then a Preview Step 3, to review the changes that have been made and to go back and make more if needed.

Complete/Completion Step 4 which shows a "View" completed edit phase/stage 1, saves stage 1 to qolae_readers db  communicates to the Parent Dashboard that workflow is now complete. 

Return to Dashboard button - that returns user to Main Dashboard and the Button on the modal workflow card is now "View Summary" that highlights the completed workflow. Seals the workflow and celebrates the completion of this workflow Card.  

The next gate Receive Payment Workflow card opens, Workflow Progress is updated and qolae_readers db and to the Readers Documents Library or Readers Management Hub. I'm undecided whether to have the Documents Library inside the Readers Management Hub Workflow Card? 

c) Receive Payment - this workflow Modal card opens to a Banking details form to be completed. After sending off the corrected draft, it will be reviewed by Liz and then the Reader will be paid following the review of the corrected draft INA report draft stage 1 - so this status will have a "pending status." And payment will be made to Reader 1 once inaReportDraft1 has been reviewed by Liz in her Case Manager's Workspace, notification flags/bells will share the status updates. 


d) Readers Management Hub this keeps the Documents Library - which has the redacted inaReports1 that they have completed. 

**Note:** Reader's CV and compliance documentation (references) are stored separately in the secure `qolae_hrcompliance` database and are NOT accessible from the Readers Dashboard for security/privacy reasons. Only Case Managers have access to HR compliance records.

6. The second reader will go through the same motions as above except that they will have the reviewed second redacted draft - in the INA Report Modal and once they have completed correcting this draft and this has been reviewed by Liz/other CM, they will be paid.

7. Once their workflow has been completed, the redacted reports are sealed off in the Readers Management Hub.