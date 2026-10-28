# Models

Mongoose schemas live here, one file per collection (SAD §3.4):
`User.js`, `Tenant.js`, `Flat.js`, `Notice.js`, `MaintenanceRequest.js`,
`Payment.js`, `Visitor.js`, `Complaint.js`, `Document.js`, `AuditLog.js`.

Each is added by the backlog item that first needs it.

## Indexes (NFR-08, #23)

Every reference field and every list query has an index, so lists stay fast with 500+ tenants.

| Collection | Index | Used by |
|---|---|---|
| users | `email` (unique) | login |
| flats | `flatNumber` (unique), `block + flatNumber` | flat list (sorted) |
| tenants | `flat` (reference), `email` (unique for current tenants), `isActive + name` | tenant list, rent status |
| payments | `tenant + month` (unique, also serves tenant look-ups), `flat`, `month`, `paidOn + createdAt` | rent status, payment history |
| visitors | `createdAt`, `flatNumber + createdAt` | visitor log |
| complaints | `createdAt`, `flatNumber + createdAt` | complaint list |
| auditlogs | `timestamp`, `actorId + timestamp` | audit log |

`tests/scale.test.js` seeds 500 tenants and checks these indexes are used.
