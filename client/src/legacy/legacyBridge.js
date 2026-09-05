// Bridges the inline onclick="..." handlers baked into the ported legacy HTML fragments
// (pageFragments.json) to React Router navigation and plain DOM tab-switching, so the
// original prototype's markup keeps working unmodified once rendered via dangerouslySetInnerHTML.

let routerNavigate = null;

export function bindLegacyNavigate(navigateFn) {
  routerNavigate = navigateFn;
}

function toPath(pageId) {
  return pageId === 'dashboard' ? '/' : '/' + pageId;
}

export function installLegacyGlobals() {
  window.navigate = (el, pageId) => {
    if (routerNavigate) routerNavigate(toPath(pageId));
  };

  window.switchKApplyTab = (btn, tabId) => {
    document.querySelectorAll('#page-kapply .page-tab, .page-tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    ['students', 'commission', 'company', 'escalation', 'kapply-reports'].forEach((id) => {
      const el = document.getElementById('kapply-' + id);
      if (el) el.style.display = id === tabId ? 'block' : 'none';
    });
  };

  window.switchEvtTab = (btn, tabId) => {
    btn.closest('.tab-strip')?.querySelectorAll('.tab-btn').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    const upcoming = document.getElementById('events-upcoming');
    const past = document.getElementById('events-past');
    if (upcoming) upcoming.style.display = tabId === 'upcoming' ? 'block' : 'none';
    if (past) past.style.display = tabId === 'past' ? 'block' : 'none';
  };
}
