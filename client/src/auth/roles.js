// Where each role lands after logging in (FR-02: "redirects to the role-specific dashboard").
// Maintenance staff work on complaints; the Owner dashboard (FR-10) is not built yet, so Owners go home.
const HOME_BY_ROLE = {
  admin: '/admin/flats',
  resident: '/complaints',
  maintenance: '/complaints',
  owner: '/',
};

export function homePathFor(role) {
  return HOME_BY_ROLE[role] || '/';
}
