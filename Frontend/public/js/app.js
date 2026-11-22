/**
 * LEXASSIST — Shared Frontend Utilities  |  app.js
 * Loaded on every page
 */

// ── Auth ──────────────────────────────────────────────────────
const Auth = {
  token:   () => null,
  user:    () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch (_) { return {}; } },
  headers: () => ({ 'Content-Type': 'application/json' }),
  logout:  async () => {
    try { await fetch('/api/auth/logout', { method:'POST', headers:{ 'Content-Type':'application/json' }, credentials:'same-origin' }); } catch (_) {}
    localStorage.removeItem('user');
    window.location.href = '/login';
  },
  guard:   (roles = []) => {
    const u = Auth.user();
    if (!u.role) { window.location.href = '/login'; return false; }
    if (roles.length && !roles.includes(u.role)) {
      window.location.href = u.role === 'admin' ? '/dashboard/admin' : u.role === 'lawyer' ? '/dashboard/lawyer' : '/dashboard/citizen';
      return false;
    }
    fetch('/api/auth/me', { credentials:'same-origin' }).then(async response => {
      if (response.status===401 || response.status===403) { Auth.logout(); return null; }
      if (!response.ok) return null;
      return response.json();
    }).then(result => { if (result?.success) localStorage.setItem('user', JSON.stringify(result.data)); }).catch(() => {});
    return true;
  }
};

// ── API ───────────────────────────────────────────────────────
const API = {
  get:    async (url)       => (await fetch(url,              { headers: Auth.headers() })).json(),
  post:   async (url, body) => (await fetch(url, { method:'POST',   headers: Auth.headers(), body: JSON.stringify(body) })).json(),
  put:    async (url, body) => (await fetch(url, { method:'PUT',    headers: Auth.headers(), body: JSON.stringify(body) })).json(),
  delete: async (url)       => (await fetch(url, { method:'DELETE', headers: Auth.headers() })).json(),
};

// Private document downloads use the signed, HttpOnly same-site session cookie.
const SecureFiles = {
  open: async (documentId, download = false) => {
    const previewWindow = download ? null : window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      const query = download ? '?download=1' : '';
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/file${query}`, {
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Could not access this document. Check your sign-in and sharing access.');
      const file = await response.blob();
      const fileUrl = URL.createObjectURL(file);
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = fileUrl;
        const disposition = response.headers.get('content-disposition') || '';
        const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1];
        anchor.download = fileName || 'legal-document';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } else if (previewWindow) {
        previewWindow.location.replace(fileUrl);
      } else {
        window.location.assign(fileUrl);
      }
      window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60000);
    } catch (error) {
      previewWindow?.close();
      Toast.show(error.message || 'Unable to open document.', 'danger');
    }
  }
};

// ── Toast ─────────────────────────────────────────────────────
const Toast = {
  show: (msg, type = 'success', ms = 4000) => {
    let c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; document.body.appendChild(c); }
    const colors = { success:'#16a34a', danger:'#dc2626', warning:'#d97706', info:'#0284c7' };
    const icons  = { success:'✅', danger:'❌', warning:'⚠️', info:'ℹ️' };
    const t = document.createElement('div');
    t.style.cssText = `background:white;border-left:4px solid ${colors[type]};border-radius:10px;padding:12px 16px;box-shadow:0 8px 24px rgba(0,0,0,0.14);display:flex;align-items:center;gap:9px;font-family:'DM Sans',sans-serif;font-size:0.875rem;font-weight:500;cursor:pointer;pointer-events:all;animation:slideIn 0.25s ease`;
    const icon=document.createElement('span'); icon.textContent=icons[type]||icons.info;
    const body=document.createElement('span'); body.style.cssText='flex:1;color:#1a1a2e'; body.textContent=String(msg??'');
    const close=document.createElement('button'); close.type='button'; close.setAttribute('aria-label','Dismiss notification'); close.textContent='×'; close.style.cssText='border:0;background:transparent;color:#64748b;font-size:1.1rem;cursor:pointer';
    close.addEventListener('click',event=>{event.stopPropagation();t.remove();}); t.append(icon,body,close);
    t.addEventListener('click', () => t.remove());
    if (!document.getElementById('toastKeyframes')) {
      const s = document.createElement('style');
      s.id = 'toastKeyframes';
      s.textContent = '@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}';
      document.head.appendChild(s);
    }
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); }, ms);
  }
};

// ── Notifications ─────────────────────────────────────────────
const Notifications = {
  load: async () => {
    try {
      const d = await API.get('/api/notifications');
      const unread = (d.data||[]).filter(n=>!n.isRead).length;
      const el = document.getElementById('notifCount');
      if (el) { el.textContent = unread; el.classList.toggle('show', unread > 0); }
    } catch(e) {}
  }
};

// ── Sidebar Init ──────────────────────────────────────────────
const initSidebar = () => {
  const user = Auth.user();
  const name = user.name || 'User';

  // Set user info
  const avatarEl = document.getElementById('sidebarAvatar');
  const nameEl   = document.getElementById('sidebarName');
  const roleEl   = document.getElementById('sidebarRole');
  const navNameEl= document.getElementById('navName');

  if (avatarEl) avatarEl.textContent = name[0].toUpperCase();
  if (nameEl)   nameEl.textContent   = name;
  if (roleEl)   roleEl.textContent   = (user.role || 'citizen').charAt(0).toUpperCase() + (user.role||'citizen').slice(1);
  if (navNameEl)navNameEl.textContent= name;

  // Mobile hamburger
  const burger  = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (burger && sidebar) {
    burger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }

  // Active link highlight
  document.querySelectorAll('.sidebar-link').forEach(link => {
    try {
      if (link.href && new URL(link.href).pathname === window.location.pathname) link.classList.add('active');
    } catch(e) {}
  });
};

// ── Modal Helpers ─────────────────────────────────────────────
const openModal  = (id) => document.getElementById(id)?.classList.add('open');
const closeModal = (id) => document.getElementById(id)?.classList.remove('open');

// ── Date Utilities ────────────────────────────────────────────
const DateUtils = {
  format:    (d)    => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }),
  daysUntil: (d)    => Math.ceil((new Date(d) - Date.now()) / 86400000),
  isOverdue: (d)    => new Date(d) < new Date(),
  timeAgo:   (d)    => {
    const m=Math.floor((Date.now()-new Date(d))/60000);
    if(m<1)return'Just now'; if(m<60)return`${m}m ago`;
    const h=Math.floor(m/60); if(h<24)return`${h}h ago`;
    return DateUtils.format(d);
  }
};

// ── Priority Helpers ──────────────────────────────────────────
const Priority = {
  color: p => ({High:'#dc2626',Medium:'#d97706',Low:'#16a34a'})[p]||'#64748b',
  emoji: p => ({High:'🔴',Medium:'🟠',Low:'🟢'})[p]||'⚪',
  badge: p => `<span class="badge badge-${(p||'').toLowerCase()}">${({High:'🔴',Medium:'🟠',Low:'🟢'})[p]||''} ${p}</span>`,
};

// ── Legal Term Tooltips ───────────────────────────────────────
const LEGAL_TERMS = {
  'bail':'Temporary release of accused person awaiting trial, in exchange for security bond.','fir':'First Information Report — written document by police on receiving info about a cognizable offence.','cognizable offence':'Serious crime where police can arrest without warrant. E.g. murder, robbery.','non-cognizable':'Minor crime where police need court permission to arrest. E.g. cheating, assault.','anticipatory bail':'Bail granted before arrest, to protect a person fearing arrest.','writ petition':'Formal order requesting court to take action. Filed in High Court or Supreme Court.','suo motu':'When court takes action on its own, without anyone filing a case.','ex-parte':'Court order where only one side is heard, the other being absent.','affidavit':'Written statement confirmed by oath, used as evidence in court.','injunction':'Court order telling someone to stop or start doing something.','contempt of court':'Disobedience or disrespect towards a court order.','jurisdiction':'Authority of a court to hear cases in a specific area or subject.','pil':'Public Interest Litigation — filed by any citizen for matters affecting the public.','habeas corpus':'Writ requiring an arrested person to be brought before court to check lawfulness of detention.','lok adalat':"People's Court — fast, free alternative dispute resolution forum.",'surety':'Person who takes responsibility for another\'s bail or legal obligations.','culpable homicide':'Causing someone\'s death, which may or may not amount to murder (IPC 299/300).','ipc':'Indian Penal Code — main criminal code of India defining offences and punishments.','crpc':'Code of Criminal Procedure — procedural law for investigation and trial of criminal cases.','dlsa':'District Legal Services Authority — provides free legal aid to eligible citizens.','nalsa':'National Legal Services Authority — apex body for free legal aid. Helpline: 15100.','plaintiff':'Person who brings a case against another in court.','defendant':'Person accused or sued in court.','petitioner':'Person who presents a formal request to a court.','respondent':'Person against whom a petition or appeal is filed.','acquittal':'Court finding the accused not guilty and releasing them.','conviction':'Court finding the accused guilty of the crime charged.','stay order':'Temporary court order stopping a legal proceeding or judgment enforcement.','charge sheet':'Formal police document listing charges against an accused person.',
};

const initTooltips = () => {
  const tip = document.createElement('div');
  tip.className = 'legal-tooltip';
  document.body.appendChild(tip);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const p = n.parentElement;
      if (!p || ['SCRIPT','STYLE','INPUT','TEXTAREA','SELECT'].includes(p.tagName)) return NodeFilter.FILTER_REJECT;
      if (p.classList.contains('legal-term')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  const pat = new RegExp(`\\b(${Object.keys(LEGAL_TERMS).map(k=>k.replace(/[()]/g,'\\$&')).join('|')})\\b`,'gi');
  nodes.forEach(node => {
    if (!pat.test(node.textContent)) return;
    pat.lastIndex = 0;
    const span = document.createElement('span');
    const content=node.textContent; let cursor=0, match;
    while ((match=pat.exec(content))) {
      span.append(document.createTextNode(content.slice(cursor,match.index)));
      const term=document.createElement('span'); term.className='legal-term'; term.dataset.term=match[0].toLowerCase(); term.textContent=match[0]; span.append(term);
      cursor=match.index+match[0].length;
    }
    span.append(document.createTextNode(content.slice(cursor)));
    node.parentNode.replaceChild(span, node);
  });

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('.legal-term');
    if (!el || !LEGAL_TERMS[el.dataset.term]) return;
    tip.innerHTML = `<strong>${el.dataset.term.toUpperCase()}</strong>${LEGAL_TERMS[el.dataset.term]}`;
    tip.classList.add('visible');
  });
  document.addEventListener('mousemove', e => {
    if (!tip.classList.contains('visible')) return;
    tip.style.left = Math.min(e.clientX+12, window.innerWidth-250)+'px';
    tip.style.top  = Math.min(e.clientY+12, window.innerHeight-90)+'px';
  });
  document.addEventListener('mouseout', e => { if (e.target.closest('.legal-term')) tip.classList.remove('visible'); });
};

// ── Modal overlay click to close ─────────────────────────────
const initModals = () => {
  document.querySelectorAll('.modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
  document.querySelectorAll('.emergency-panel').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
};

// ── DOMContentLoaded ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initModals();
  NotifPanel.init();
  initGlobalControls();
});

window.addEventListener('load', () => setTimeout(initTooltips, 400));

// Expose globally
window.Auth = Auth; window.API = API; window.Toast = Toast;
window.DateUtils = DateUtils; window.Priority = Priority;
window.openModal = openModal; window.closeModal = closeModal;

// ═══════════════════════════════════════════════════════════
// DARK / LIGHT MODE TOGGLE
// ═══════════════════════════════════════════════════════════
const ThemeManager = {
  init: () => {
    const saved = localStorage.getItem('lexassist_theme') || 'light';
    ThemeManager.apply(saved);
  },
  apply: (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lexassist_theme', theme);
    // Update all toggle buttons
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
  },
  toggle: () => {
    const current = localStorage.getItem('lexassist_theme') || 'light';
    ThemeManager.apply(current === 'dark' ? 'light' : 'dark');
  },
  isDark: () => localStorage.getItem('lexassist_theme') === 'dark',
};

// Apply theme immediately (before DOMContentLoaded to avoid flash)
ThemeManager.init();

// Re-init on DOMContentLoaded in case buttons were added
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  // Wire up any .theme-toggle buttons
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', ThemeManager.toggle);
  });
});

window.ThemeManager = ThemeManager;

// ── Real-time Notification Panel ─────────────────────────────
const NotifPanel = {
  open: false,
  
  toggle: () => {
    const panel = document.getElementById('notifDropdown');
    if (!panel) return;
    NotifPanel.open = !NotifPanel.open;
    panel.style.display = NotifPanel.open ? 'block' : 'none';
    if (NotifPanel.open) NotifPanel.loadList();
  },

  loadList: async () => {
    try {
      const d  = await API.get('/api/notifications');
      const el = document.getElementById('notifDropdownList');
      if (!el) return;
      const unread = d.unread || 0;
      const cnt = document.getElementById('notifCount');
      if (cnt) { cnt.textContent = unread; cnt.classList.toggle('show', unread > 0); }
      if (!d.data?.length) { const empty=document.createElement('p'); empty.textContent='No notifications'; empty.style.cssText='padding:16px;text-align:center;color:var(--muted);font-size:.84rem'; el.replaceChildren(empty); return; }
      el.replaceChildren();
      d.data.slice(0,8).forEach(n=>{
        const item=document.createElement('button'); item.type='button'; item.className='notification-item'; item.style.background=n.isRead?'transparent':'rgba(201,168,76,0.07)';
        const title=document.createElement('span'); title.className='notification-title'; title.textContent=n.title||'Notification';
        const message=document.createElement('span'); message.className='notification-message'; const body=String(n.message||''); message.textContent=body.slice(0,70)+(body.length>70?'…':'');
        const time=document.createElement('span'); time.className='notification-time'; time.textContent=DateUtils.timeAgo(n.createdAt);
        item.append(title,message,time); item.addEventListener('click',()=>NotifPanel.markRead(n._id,item)); el.append(item);
      });
    } catch(e){}
  },

  markRead: async (id, el) => {
    el.style.background='transparent';
    await API.put(`/api/notifications/${id}/read`,{}).catch(()=>{});
    NotifPanel.poll();
  },

  markAllRead: async () => {
    await API.put('/api/notifications/read-all',{}).catch(()=>{});
    NotifPanel.loadList();
  },

  poll: async () => {
    try {
      const d   = await API.get('/api/notifications?limit=1');
      const cnt = document.getElementById('notifCount');
      if (cnt && d.unread !== undefined) {
        cnt.textContent = d.unread;
        cnt.classList.toggle('show', d.unread > 0);
      }
    } catch(e){}
  },

  init: () => {
    const bell = document.getElementById('notifBell');
    if (bell) {
      bell.onclick = NotifPanel.toggle;
      NotifPanel.poll();
      setInterval(NotifPanel.poll, 20000); // Poll every 20 seconds
    }
    // Close on outside click
    document.addEventListener('click', e => {
      if (NotifPanel.open && !e.target.closest('#notifDropdown') && !e.target.closest('#notifBell')) {
        const panel = document.getElementById('notifDropdown');
        if (panel) panel.style.display = 'none';
        NotifPanel.open = false;
      }
    });
  }
};

window.NotifPanel = NotifPanel;

const Loaders = {
  show(target, {variant='document', message='Preparing your legal workspace…'}={}) {
    const host=typeof target==='string'?document.querySelector(target):target;
    if(!host)return null;
    const status=document.createElement('div'); status.className=`la-loader la-loader-${variant}`; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    const graphic=document.createElement('span'); graphic.className='la-loader-graphic'; graphic.setAttribute('aria-hidden','true');
    const label=document.createElement('span'); label.className='la-loader-message'; label.textContent=message;
    status.append(graphic,label); host.replaceChildren(status); return status;
  },
  hide(target) { const host=typeof target==='string'?document.querySelector(target):target; host?.querySelector('.la-loader')?.remove(); }
};
window.Loaders=Loaders;

const CommandMenu = {
  open() {
    let dialog=document.getElementById('commandMenu');
    if(!dialog){
      dialog=document.createElement('div'); dialog.id='commandMenu'; dialog.className='command-backdrop';
      dialog.innerHTML='<section class="command-dialog" role="dialog" aria-modal="true" aria-labelledby="commandTitle"><h2 id="commandTitle">Quick actions</h2><input class="form-control" id="commandSearch" type="search" placeholder="Search actions…" aria-label="Search quick actions"><div class="command-results" id="commandResults"></div><p class="command-hint">Use ↑ ↓ to move · Enter to open · Esc to close</p></section>';
      dialog.addEventListener('click',event=>{if(event.target===dialog)CommandMenu.close();}); dialog.addEventListener('keydown',CommandMenu.keys); document.body.append(dialog);
      dialog.querySelector('#commandSearch').addEventListener('input',CommandMenu.filter);
    }
    const actions={
      citizen:[['Ask Lexi','/chatbot'],['Find a lawyer','/lawyers'],['View cases','/cases'],['Book appointment','/lawyers'],['Open messages','/messages']],
      lawyer:[['View client cases','/cases'],['Manage appointments','/appointments'],['Open messages','/messages'],['Manage calendar','/calendar'],['Open documents','/lawyer/documents']],
      admin:[['Review lawyer verification','/dashboard/admin'],['Manage users','/dashboard/admin'],['Open knowledge base','/dashboard/admin'],['View reports','/dashboard/admin']],
    }[Auth.user().role]||[];
    const results=dialog.querySelector('#commandResults'); results.replaceChildren();
    actions.forEach(([label,href])=>{const button=document.createElement('a');button.className='command-option';button.href=href;button.textContent=label;results.append(button);});
    dialog.classList.add('is-open');const search=dialog.querySelector('#commandSearch');search.value='';search.focus();CommandMenu.filter();
  },
  close(){document.getElementById('commandMenu')?.classList.remove('is-open');document.querySelector('[data-command-open]')?.focus();},
  filter(){const query=document.getElementById('commandSearch')?.value.toLowerCase()||'';document.querySelectorAll('.command-option').forEach(item=>item.hidden=!item.textContent.toLowerCase().includes(query));},
  keys(event){const items=[...document.querySelectorAll('.command-option:not([hidden])')],current=items.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();CommandMenu.close();}else if(event.key==='ArrowDown'){event.preventDefault();items[(current+1+items.length)%items.length]?.focus();}else if(event.key==='ArrowUp'){event.preventDefault();items[(current-1+items.length)%items.length]?.focus();}}
};
window.CommandMenu=CommandMenu;
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();CommandMenu.open();}});

function initGlobalControls(){
  const actions=document.querySelector('.navbar-actions'); if(!actions)return;
  if(!actions.querySelector('.theme-toggle')){const theme=document.createElement('button');theme.type='button';theme.className='theme-toggle btn btn-outline btn-sm';theme.setAttribute('aria-label','Toggle light or dark theme');theme.textContent='◐';theme.addEventListener('click',ThemeManager.toggle);actions.prepend(theme);}
  if(!actions.querySelector('[data-command-open]')){const trigger=document.createElement('button');trigger.type='button';trigger.className='command-trigger btn btn-outline btn-sm';trigger.dataset.commandOpen='';trigger.setAttribute('aria-label','Open quick actions (Control K)');trigger.innerHTML='<span aria-hidden="true">⌕</span><span>Quick actions</span><kbd>Ctrl K</kbd>';trigger.addEventListener('click',()=>CommandMenu.open());actions.prepend(trigger);}
}
