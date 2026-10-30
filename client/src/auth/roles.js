// Where each role lands after logging in (FR-02: "redirects to the role-specific dashboard").
// Maintenance staff work on complaints; Owners land on the financial summary (FR-10).
const HOME_BY_ROLE = {
  admin: '/admin/flats',
  resident: '/complaints',
  maintenance: '/complaints',
  owner: '/owner/summary',
};

export function homePathFor(role) {
  return HOME_BY_ROLE[role] || '/';
}
