# ResiTrack - Requirements Elicitation and Change Management



**Project:** ResiTrack - Apartment / Residencies Organizer  

**Course:** Software Engineering  

**Document:** Requirements Engineering (RE)  

**Version:** 1.0  

**Status:** Proposed process for the project team



## 1. Purpose



This document defines a lightweight process for gathering, clarifying, prioritizing, validating, and managing changes to ResiTrack's software requirements. It complements the Software Requirements Specification (SRS) by describing how requirements-related decisions should be handled throughout development.



## 2. Stakeholders and Requirements Sources



The requirements process considers the following stakeholders identified in the SRS:



| Stakeholder | Requirements and concerns |

|---|---|

| Administrator | Tenant registration, rent tracking, notices, flat inventory, maintenance oversight, document management, and receipts |

| Resident (Tenant) | Login, maintenance requests, complaints, visitor logging, notices, and rent receipts |

| Maintenance Staff | Access to assigned maintenance requests and status updates |

| Owner | Read-only financial summaries and occupancy information |

| Development and testing team | Technical constraints, implementation feasibility, verification, security, and maintainability |



The primary requirements source is the approved SRS. The team should use its functional requirements (FR-01 to FR-15), non-functional requirements (NFR-01 to NFR-10), and security requirements as the baseline for development.



## 3. Requirements Elicitation Process



The team should follow these steps when clarifying or proposing requirements:



1. **Identify the stakeholder:** Determine who needs the functionality or is affected by the proposed change.

2. **Record the need:** Describe the problem, expected outcome, and reason for the requirement.

3. **Clarify acceptance criteria:** Define observable conditions that demonstrate successful implementation.

4. **Check constraints:** Verify compatibility with the mandatory MERN stack, MVC architecture, project schedule, security requirements, and single-complex scope.

5. **Check for duplication:** Compare the proposal with existing SRS requirements and GitHub issues.

6. **Review with the team:** Discuss ambiguity, dependencies, feasibility, and implementation effort before accepting the proposal.



## 4. Requirement Prioritization



The team should consider the following factors when deciding implementation order:



- **SRS priority:** Preserve the High, Medium, or Low priority recorded in the SRS.

- **Security and correctness:** Give appropriate attention to authentication, role-based access control, data protection, and integrity.

- **Dependencies:** Implement prerequisites before functionality that depends on them.

- **User impact:** Consider how strongly the requirement affects the administrator, resident, maintenance staff, or owner.

- **Effort and feasibility:** Estimate work using story points in the GitHub backlog.

- **Sprint capacity:** Select work that the team can reasonably complete and verify during the sprint.



Story points estimate relative effort and complexity. They do not replace the priority assigned to a requirement in the SRS.



## 5. Requirement Validation



Before a requirement is accepted for implementation, the team should verify that it is:



- **Clear:** Its intended behaviour is understandable.

- **Consistent:** It does not contradict the SRS or another approved requirement.

- **Feasible:** It can reasonably be implemented within the project constraints.

- **Verifiable:** It has acceptance criteria that can be tested or inspected.

- **Traceable:** It references the relevant FR, NFR, or security requirement where applicable.



Existing SRS requirement IDs should be retained. New requirements should receive identifiers only after the team agrees to introduce them.



## 6. Requirements Change Management



A proposed change should follow this workflow:



1. **Submit:** Create or update a GitHub issue describing the requested change and its motivation.

2. **Trace:** Identify the affected SRS requirement IDs, use cases, tests, and related backlog items.

3. **Assess:** Evaluate scope, dependencies, security implications, effort, and schedule impact.

4. **Review:** Have the team discuss the proposal and record the decision.

5. **Approve or reject:** Only an agreed change should modify the accepted requirements baseline.

6. **Update artifacts:** Update the relevant SRS, test cases, architecture documentation, backlog, and traceability records where necessary.

7. **Verify:** Confirm that the implementation and associated tests satisfy the approved acceptance criteria.



A GitHub issue alone does not mean that a requirement change has been approved.



## 7. GitHub Backlog and Sprint Traceability



Each implementation issue should, where applicable, include:



- A concise title and description.

- Relevant SRS requirement ID or IDs.

- Acceptance criteria.

- Priority and story-point estimate.

- Assigned team member.

- Sprint or milestone.

- Dependencies and testing expectations.



Completed work should be linked to its pull request and relevant tests. Pull requests should be reviewed according to the team's repository workflow before changes are merged.



## 8. Requirement Statuses



The team may use the following statuses to communicate progress:



| Status | Meaning |

|---|---|

| Proposed | A requirement or change has been suggested |

| Under Review | The team is evaluating clarity, feasibility, and impact |

| Approved | The requirement is accepted for planning |

| In Progress | Implementation has started |

| In Verification | Implementation is awaiting required testing or review |

| Completed | Acceptance criteria have been satisfied |

| Rejected / Deferred | The proposal was declined or postponed, with a recorded reason |



These statuses describe the requirements workflow and do not replace GitHub's issue or pull-request state.



## 9. Records and Maintenance



GitHub issues, pull requests, the SRS, the Test Plan, and the Architecture Design should serve as the team's supporting records. The team should keep these artifacts consistent when an approved change affects more than one of them.



This document defines a proposed working process. It does not claim that stakeholder interviews, formal change approvals, or other activities have already occurred.

