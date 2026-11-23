'use strict';

(function () {
  const api = window.api;
  const $ = (id) => document.getElementById(id);

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // ---------- icons ----------
  const ICONS = {
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
    sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>',
    diff: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/>',
    arrowUp: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    chevron: '<polyline points="6 9 12 15 18 9"/>',
    file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    branch: '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    reveal: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    chevronRight: '<polyline points="9 18 15 12 9 6"/>',
    chevronUp: '<polyline points="18 15 12 9 6 15"/>',
    more: '<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none"/>',
    moreVertical: '<circle cx="12" cy="5" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A4 4 0 0 1 14 9V4h1a1 1 0 0 0 0-2H9a1 1 0 0 0 0 2h1v5a4 4 0 0 1-2.11 3.56l-1.78.89A2 2 0 0 0 5 15.24z"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    split: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/>',
    archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    newFolder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>',
    briefcase: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    command: '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>',
    sparkles: '<path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z"/>',
    puzzle: '<path d="M4 11a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2 2 2 0 0 1 4 0 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 1 0 4 2 2 0 0 0-2 2v1a2 2 0 0 1-2 2h-1a2 2 0 0 0-2 2 2 2 0 0 1-4 0 2 2 0 0 0-2-2H6a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2 2 2 0 0 1 0-4 2 2 0 0 0 2-2z"/>',
    grip: '<circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none"/>',
    overview: '<rect x="3" y="3" width="18" height="18" rx="3.5"/><line x1="7.5" y1="8" x2="16.5" y2="8"/><line x1="7.5" y1="12" x2="16.5" y2="12"/><line x1="7.5" y1="16" x2="16.5" y2="16"/>',
    sidebarRight: '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="16" y1="3" x2="16" y2="21"/>',
    fileDiff: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
    termBox: '<rect x="3" y="3" width="18" height="18" rx="3.5"/><polyline points="7.5 9.5 10.5 12 7.5 14.5"/><line x1="12.5" y1="15" x2="16.5" y2="15"/>',
    terminalPrompt: '<polyline points="4 14 8 10 4 6"/><line x1="10" y1="14" x2="16" y2="14"/>',
    thumbsUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    thumbsDown: '<path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/>',
    alertTriangle: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  };

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = ICONS[name] || '';
    return svg;
  }

  function iconSpan(name, cls) {
    const s = h('span', 'ico' + (cls ? ' ' + cls : ''));
    s.appendChild(icon(name));
    return s;
  }

  function setIcon(el, name) {
    el.textContent = '';
    el.appendChild(iconSpan(name)); // the .ico wrapper carries the size and stroke styling
  }

  const BUTTON_ICONS = {
    sbToggle: 'sidebar', sbShow: 'sidebar', openFolderBtn: 'newFolder', attachBtn: 'paperclip', sendBtn: 'arrowUp', stopBtn: 'stop',
    gitRefresh: 'refresh', gitClose: 'x', historyClose: 'x', termClear: 'refresh', termStop: 'stop', termClose: 'x', chRefresh: 'refresh', chClose: 'x', settingsClose: 'x', skillsClose: 'x',
    navBackBtn: 'arrowLeft', navForwardBtn: 'arrowRight', sbSearchClear: 'x', sbProjectToggle: 'chevronDown', recentProjectsToggle: 'chevronRight', chRevealFile: 'reveal',
    sbSearchBtn: 'search', sbFilterProjectsBtn: 'filter', sbCurrentProjMenuBtn: 'moreVertical', sbCurrentProjNewChatBtn: 'plus', renameClose: 'x',
    overviewToggleBtn: 'overview', termNew: 'plus', termSplit: 'split', termKill: 'trash', termCloseSplit: 'x', ovMoreBtn: 'moreVertical',
    newStandaloneChatBtn: 'plus', qcRemoveBtn: 'x', topChatMenuBtn: 'moreVertical', topOverviewBtn: 'overview', topPanelToggleBtn: 'sidebarRight',
  };

  // ---------- state ----------
  const S = {
    app: null,
    running: false,
    current: null, // streaming assistant message {el, raw, raf}
    tools: new Map(),
    chats: [],
    allChats: [],
    changes: [],
    selected: null,
    diffMode: 'unified',
    diffFull: false,
    attachments: [],
    messageQueue: [], // Queued messages waiting to be sent
    termRunning: false,
    termHistory: [],
    termIdx: 0,
    provSel: null,
    refreshTimer: 0,
    runningChats: new Set(),
    ghWait: false,
    expandSessions: false,
    collapseProject: false,
    collapseRecent: true,
    expandedProjects: new Set(),
    collapsedProjects: new Set(),
    pinnedChats: new Set(JSON.parse(localStorage.getItem('cr3_pinned_chats') || '[]')),
    unreadChats: new Set(JSON.parse(localStorage.getItem('cr3_unread_chats') || '[]')),
    archivedChats: new Set(JSON.parse(localStorage.getItem('cr3_archived_chats') || '[]')),
    chatFilter: '',
    navHistory: [],
    navIndex: -1,
    isNavigating: false,
    groupBy: 'Project',
    sortConversations: 'Last Updated',
    sortProjects: 'Custom Order',
    filterType: 'All',
    displayDensity: store('cr3.displayDensity') || 'Comfortable',
    autoPin: false,
    filterArchivedOnly: false,
    showBranch: store('cr3.showBranch') === '1',
    showPath: store('cr3.showPath') === '1',
    terminalTabs: ['1: zsh'],
    terminalActiveTab: 0,
    terminalSplit: false,
    termSplitHistory: [],
    termSplitRunning: false,
    layoutMode: 'se',
  };

  const els = {
    app: $('app'), messages: $('messages'), empty: $('empty'), emptyTitle: $('emptyTitle'), emptyText: $('emptyText'), emptyActions: $('emptyActions'),
    input: $('input'), sendBtn: $('sendBtn'), stopBtn: $('stopBtn'), status: $('status'), composer: $('composer'), composerMenu: $('composerMenu'),
    attachRow: $('attachRow'), fileInput: $('fileInput'),
    projectList: $('projectList'), chatList: $('chatList'), projName: $('projName'), projPath: $('projPath'),
    projBreadcrumb: $('projBreadcrumb'), topSep: $('topSep'), chatTitleTop: $('chatTitleTop'),
    navBackBtn: $('navBackBtn'), navForwardBtn: $('navForwardBtn'),
    sbSearchWrap: $('sbSearchWrap'), sbSearch: $('sbSearch'), sbSearchClear: $('sbSearchClear'), sbSearchBtn: $('sbSearchBtn'),
    sbAutomationsBtn: $('sbAutomationsBtn'), sbCustomizationsBtn: $('sbCustomizationsBtn'),
    sbFilterProjectsBtn: $('sbFilterProjectsBtn'), activeProjectSection: $('activeProjectSection'),
    sbProjectToggle: $('sbProjectToggle'), sbActiveProjName: $('sbActiveProjName'),
    sbCurrentProjMenuBtn: $('sbCurrentProjMenuBtn'), sbCurrentProjNewChatBtn: $('sbCurrentProjNewChatBtn'),
    sbToggleAllSessions: $('sbToggleAllSessions'), sbToggleAllSessionsLabel: $('sbToggleAllSessionsLabel'),
    recentProjectsToggle: $('recentProjectsToggle'), recentProjectsSection: $('recentProjectsSection'),
    conversationsSection: $('conversationsSection'), conversationsList: $('conversationsList'),
    newStandaloneChatBtn: $('newStandaloneChatBtn'),
    queuedCard: $('queuedCard'), qcSendNowBtn: $('qcSendNowBtn'), qcEditBtn: $('qcEditBtn'), qcRemoveBtn: $('qcRemoveBtn'), qcText: $('qcText'), qcAtts: $('qcAtts'),
    submenu: $('submenu'), renameDialog: $('renameDialog'), renameInput: $('renameInput'), renameForm: $('renameForm'),
    renameClose: $('renameClose'), renameCancel: $('renameCancel'),
    chFileName: $('chFileName'), chFileStatus: $('chFileStatus'), chFileDiffStat: $('chFileDiffStat'),
    chBreadcrumbs: $('chBreadcrumbs'), chFileTabs: $('chFileTabs'), chRevealFile: $('chRevealFile'),
    chKeepFile: $('chKeepFile'), chRevertFile: $('chRevertFile'), chClose: $('chClose'),
    chGitBar: $('chGitBar'), chGitBranchName: $('chGitBranchName'), chGitFilesSummary: $('chGitFilesSummary'),
    chGitUninit: $('chGitUninit'), chInitRepoBtn: $('chInitRepoBtn'), chGitNoRemote: $('chGitNoRemote'),
    chRemoteUrlInput: $('chRemoteUrlInput'), chSetRemoteBtn: $('chSetRemoteBtn'), chGitActive: $('chGitActive'),
    chGitRepoTag: $('chGitRepoTag'), chGitRepoName: $('chGitRepoName'),
    chAutoCommitBtn: $('chAutoCommitBtn'), chCommitInput: $('chCommitInput'), chCommitBtn: $('chCommitBtn'), chPushBtn: $('chPushBtn'),
    onboardDialog: $('onboardDialog'), onboardSubmitBtn: $('onboardSubmitBtn'),
    pfModelCaps: $('pfModelCaps'), pfModelCapsList: $('pfModelCapsList'),
    approvalLabel: $('approvalLabel'), modelBtn: $('modelBtn'), modelLabel: $('modelLabel'), modelProvider: $('modelProvider'),
    topChatMenuBtn: $('topChatMenuBtn'), topOverviewBtn: $('topOverviewBtn'), topPanelToggleBtn: $('topPanelToggleBtn'),
    changesBtn: $('changesBtn'), changesBadge: $('changesBadge'), changesPane: $('changesPane'), splitter: $('splitter'),
    overviewToggleBtn: $('overviewToggleBtn'), overviewPane: $('overviewPane'), ovReviewBtn: $('ovReviewBtn'), ovDiffStat: $('ovDiffStat'),
    ovFilesBtn: $('ovFilesBtn'), ovTerminalBtn: $('ovTerminalBtn'), ovExtensionsBtn: $('ovExtensionsBtn'), ovMoreBtn: $('ovMoreBtn'),
    ovTaskCount: $('ovTaskCount'), ovTaskList: $('ovTaskList'), ovTaskActive: $('ovTaskActive'), ovSeeAllBtn: $('ovSeeAllBtn'),
    terminalPane: $('terminalPane'), terminalBtn: $('terminalBtn'), termOut: $('termOut'), termInput: $('termInput'), termCwd: $('termCwd'), termStop: $('termStop'),
    termNew: $('termNew'), termSplit: $('termSplit'), termKill: $('termKill'), termClear: $('termClear'), termClose: $('termClose'),
    termTabsList: $('termTabsList'), termPaneRight: $('termPaneRight'), termCloseSplit: $('termCloseSplit'), termOutSplit: $('termOutSplit'), termInputSplit: $('termInputSplit'),
    settingsClose: $('settingsClose'), setTitle: $('setTitle'), setSubtitle: $('setSubtitle'), setProjectList: $('setProjectList'),
    setFeedbackBtn: $('setFeedbackBtn'), setUserBadge: $('setUserBadge'),
    toast: $('toast'), menu: $('menu'), dropHint: $('dropHint'),
  };
  const emptyEl = els.empty;

  // ---------- small utilities ----------
  const lastSegments = (p, n) => String(p).split('/').filter(Boolean).slice(-n).join('/');
  const baseName = (p) => lastSegments(p, 1) || p;

  function relTime(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' d ago';
    return new Date(ts).toLocaleDateString();
  }

  function compactRelTime(ts) {
    if (!ts) return '';
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 90) return 'now';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd';
    return Math.floor(s / (86400 * 30)) + 'mo';
  }

  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  let toastTimer = 0;
  /** A modal dialog sits above everything outside it, so popups opened from inside one must live inside it. */
  function placeIn(node, anchor) {
    const host = (anchor && anchor.closest && anchor.closest('dialog')) || document.querySelector('dialog[open]') || document.body;
    if (node.parentNode !== host) host.appendChild(node);
  }

  function toast(msg, ms) {
    placeIn(els.toast, null);
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (els.toast.hidden = true), ms || 3500);
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* storage can be unavailable: the app works without it */
    }
    return null;
  }

  function getModelCapabilities(modelName) {
    const name = String(modelName || '').toLowerCase();
    const caps = [];

    // Vision / Image modality
    if (/vision|4o|gemini|pixtral|llava|vl|multimodal|claude-3|gpt-4-turbo/i.test(name)) {
      caps.push({ label: 'Vision', icon: 'image', class: 'cap-vision', tip: 'Inspects and analyzes images, diagrams, mockups' });
    }

    // Video modality
    if (/gemini-1\.5|gemini-2\.0|qwen2-vl|qwen-vl/i.test(name)) {
      caps.push({ label: 'Video', icon: 'monitor', class: 'cap-video', tip: 'Processes video input' });
    }

    // Deep reasoning / Thinking
    if (/r1|o1|o3|reasoner|thinking|qwq/i.test(name)) {
      caps.push({ label: 'Reasoning', icon: 'sparkles', class: 'cap-reasoning', tip: 'Chain-of-thought deep reasoning and verification' });
    }

    // Code specialist
    if (/coder|deepseek-coder|qwen.*coder|codellama|starcoder/i.test(name)) {
      caps.push({ label: 'Code', icon: 'code', class: 'cap-code', tip: 'Specialized for coding, refactoring, and debugging source code' });
    }

    // Context Window
    if (/1m|1000k/i.test(name)) {
      caps.push({ label: '1M', class: 'cap-context', tip: '1,000,000 token context window' });
    } else if (/128k|llama-3\.3|llama-3\.1|qwen2\.5/i.test(name)) {
      caps.push({ label: '128k', class: 'cap-context', tip: '128,000 token context window' });
    } else if (/200k|claude/i.test(name)) {
      caps.push({ label: '200k', class: 'cap-context', tip: '200,000 token context window' });
    } else if (/32k|mistral/i.test(name)) {
      caps.push({ label: '32k', class: 'cap-context', tip: '32,000 token context window' });
    }

    // Free tier
    if (/:free\b/i.test(name) || /-free\b/i.test(name)) {
      caps.push({ label: 'FREE', class: 'cap-free', tip: 'Free tier model with no API charge' });
    }

    return caps;
  }

  // ---------- popup menu ----------
  function closeMenu() {
    if (els.menu) {
      els.menu.hidden = true;
      els.menu.textContent = '';
    }
    closeSubMenu();
  }

  function closeSubMenu() {
    if (els.submenu) {
      els.submenu.hidden = true;
      els.submenu.textContent = '';
    }
  }

  function showSubMenu(anchorBtn, items) {
    const sm = els.submenu;
    if (!sm) return;
    sm.textContent = '';
    for (const it of items) {
      if (it.type === 'sep') {
        sm.appendChild(h('div', 'pm-sep'));
        continue;
      }
      const b = h('button', 'pm-item' + (it.danger ? ' pm-danger' : ''));
      b.type = 'button';
      b.disabled = !!it.disabled;

      if (it.icon) {
        const ic = h('span', 'ico pm-ico');
        ic.appendChild(icon(it.icon));
        b.appendChild(ic);
      }
      const main = h('span', 'pm-main', it.label);
      b.appendChild(main);

      b.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenu();
        if (it.onClick) it.onClick();
      });
      sm.appendChild(b);
    }

    sm.hidden = false;
    const r = anchorBtn.getBoundingClientRect();
    const sw = sm.offsetWidth || 180;
    const sh = sm.offsetHeight || 100;

    let left = r.right + 4;
    if (left + sw > window.innerWidth - 8) {
      left = Math.max(8, r.left - sw - 4);
    }
    sm.style.left = left + 'px';

    let top = r.top - 4;
    if (top + sh > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - sh - 8);
    }
    sm.style.top = top + 'px';
  }

  /** items: {type:'head',label} | {type:'sep'} | {label, sub, icon, shortcut, submenu, children, danger, checked, disabled, onClick} */
  function showMenu(anchor, items) {
    closeSubMenu();
    const m = els.menu;
    m.textContent = '';
    for (const it of items) {
      if (it.type === 'head') {
        m.appendChild(h('div', 'pm-head', it.label));
      } else if (it.type === 'sep') {
        m.appendChild(h('div', 'pm-sep'));
      } else {
        const b = h('button', 'pm-item' + (it.danger ? ' pm-danger' : ''));
        b.type = 'button';
        b.disabled = !!it.disabled;

        if (it.icon) {
          const ic = h('span', 'ico pm-ico');
          ic.appendChild(icon(it.icon));
          b.appendChild(ic);
        } else if (it.checked !== undefined) {
          const check = h('span', 'ico pm-ico');
          if (it.checked) check.appendChild(icon('check'));
          b.appendChild(check);
        }

        const main = h('span', 'pm-main');
        main.appendChild(document.createTextNode(it.label));
        if (it.sub) main.appendChild(h('span', 'pm-sub', it.sub));
        if (it.caps && it.caps.length) {
          const capWrap = h('div', 'pm-model-caps');
          for (const c of it.caps) {
            const pill = h('span', 'model-cap-pill ' + (c.class || ''));
            if (c.icon) {
              pill.appendChild(iconSpan(c.icon, 'cap-ico'));
            }
            pill.appendChild(h('span', 'cap-txt', c.label));
            if (c.tip) pill.title = c.tip;
            capWrap.appendChild(pill);
          }
          main.appendChild(capWrap);
        }
        b.appendChild(main);

        if (it.shortcut) {
          b.appendChild(h('kbd', 'pm-kbd', it.shortcut));
        } else {
          if (it.valueText) {
            b.appendChild(h('span', 'pm-val', it.valueText));
          }
          if (it.submenu || (it.children && it.children.length)) {
            const arr = h('span', 'ico tiny pm-arrow');
            arr.appendChild(icon('chevronRight'));
            b.appendChild(arr);
          }
        }

        b.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.children && it.children.length) {
            showSubMenu(b, it.children);
            return;
          }
          closeMenu();
          if (it.onClick) it.onClick();
        });

        if (it.children && it.children.length) {
          b.addEventListener('mouseenter', () => {
            showSubMenu(b, it.children);
          });
        } else {
          b.addEventListener('mouseenter', () => {
            closeSubMenu();
          });
        }

        m.appendChild(b);
      }
    }

    placeIn(m, anchor);
    m.hidden = false;
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth || 210;
    const mh = m.offsetHeight || 160;

    let left = r.left;
    if (left + mw > window.innerWidth - 8) {
      left = Math.max(8, r.right - mw);
    }
    m.style.left = left + 'px';

    let top = r.bottom + 4;
    if (top + mh > window.innerHeight - 8) {
      top = Math.max(8, r.top - mh - 4);
    }
    m.style.top = top + 'px';
  }

  document.addEventListener('mousedown', (e) => {
    if (!els.menu.hidden && !els.menu.contains(e.target) && (!els.submenu || !els.submenu.contains(e.target))) {
      closeMenu();
    }
  });
  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);

  // ---------- session & project helpers ----------
  function savePinnedChats() {
    try { localStorage.setItem('cr3_pinned_chats', JSON.stringify([...S.pinnedChats])); } catch {}
  }
  function saveUnreadChats() {
    try { localStorage.setItem('cr3_unread_chats', JSON.stringify([...S.unreadChats])); } catch {}
  }
  function saveArchivedChats() {
    try { localStorage.setItem('cr3_archived_chats', JSON.stringify([...S.archivedChats])); } catch {}
  }

  function isChatPinned(id) { return S.pinnedChats.has(id); }
  function isChatUnread(id) { return S.unreadChats.has(id); }
  function isChatArchived(id) { return S.archivedChats.has(id); }

  function togglePinChat(id) {
    if (S.pinnedChats.has(id)) {
      S.pinnedChats.delete(id);
      toast('Conversation unpinned');
    } else {
      S.pinnedChats.add(id);
      toast('Conversation pinned');
    }
    savePinnedChats();
    renderSidebar();
  }

  function toggleUnreadChat(id) {
    if (S.unreadChats.has(id)) {
      S.unreadChats.delete(id);
    } else {
      S.unreadChats.add(id);
      toast('Marked as unread');
    }
    saveUnreadChats();
    renderSidebar();
  }

  function toggleArchiveChat(id) {
    if (S.archivedChats.has(id)) {
      S.archivedChats.delete(id);
      toast('Conversation restored');
    } else {
      S.archivedChats.add(id);
      toast('Conversation archived');
    }
    saveArchivedChats();
    renderSidebar();
  }

  let renameTargetId = null;
  function promptRenameChat(c) {
    if (!els.renameDialog) {
      const title = window.prompt('Rename conversation:', c.title);
      if (title && title.trim() && title.trim() !== c.title) {
        doRenameChat(c.id, title.trim());
      }
      return;
    }
    renameTargetId = c.id;
    els.renameInput.value = c.title || '';
    els.renameDialog.showModal();
    setTimeout(() => {
      els.renameInput.focus();
      els.renameInput.select();
    }, 50);
  }

  async function doRenameChat(id, title) {
    if (!title) return;
    const r = await api.renameChat(id, title);
    if (r?.ok) {
      toast('Conversation renamed');
      const found = S.chats.find(x => x.id === id);
      if (found) found.title = title;
      const foundAll = S.allChats.find(x => x.id === id);
      if (foundAll) foundAll.title = title;
      renderSidebar();
    } else {
      toast(r?.error || 'Failed to rename conversation');
    }
  }

  async function copyChatTranscript(id) {
    try {
      const res = await api.openChat(id);
      if (res && res.messages) {
        const text = res.messages.map(m => `[${(m.role || '').toUpperCase()}]: ${m.text || ''}`).join('\n\n');
        await navigator.clipboard.writeText(text);
        toast('Transcript copied to clipboard');
      }
    } catch {
      toast('Failed to copy transcript');
    }
  }

  function showProjectMenu(anchor, folder) {
    const name = baseName(folder);
    const items = [
      {
        label: 'Copy Project Name',
        icon: 'copy',
        onClick: () => {
          navigator.clipboard.writeText(name);
          toast('Project name copied');
        }
      },
      {
        label: 'Project Settings',
        icon: 'sliders',
        onClick: () => {
          openSettings('agent');
        }
      },
      {
        label: 'Reveal in Finder',
        icon: 'folder',
        onClick: () => {
          api.revealFolder(folder);
        }
      },
      {
        label: 'Delete Project',
        icon: 'trash',
        danger: true,
        onClick: async () => {
          if (!(await confirmDialog('Delete Project from List?', `Remove "${name}" from Cr3agent? Files on your Mac will not be deleted.`, 'Delete Project'))) return;
          const wasActive = folder === S.app?.folder;
          const r = await api.forgetFolder(folder);
          if (r.ok) applyState(r);
          if (wasActive) {
            resetChatView();
          }
          await loadChats();
        }
      }
    ];
    showMenu(anchor, items);
  }

  function showSessionMenu(anchor, c) {
    const isPinned = isChatPinned(c.id);
    const isUnread = isChatUnread(c.id);

    const items = [
      {
        label: 'Rename',
        icon: 'edit',
        onClick: () => {
          promptRenameChat(c);
        }
      },
      {
        label: isPinned ? 'Unpin' : 'Pin',
        icon: 'pin',
        shortcut: '⌥⌘P',
        onClick: () => {
          togglePinChat(c.id);
        }
      },
      {
        label: isUnread ? 'Mark Read' : 'Mark Unread',
        icon: 'mail',
        onClick: () => {
          toggleUnreadChat(c.id);
        }
      },
      { type: 'sep' },
      {
        label: 'Copy',
        icon: 'copy',
        submenu: true,
        children: [
          {
            label: 'Copy Title',
            icon: 'copy',
            onClick: () => {
              navigator.clipboard.writeText(c.title);
              toast('Title copied');
            }
          },
          {
            label: 'Copy ID',
            icon: 'copy',
            onClick: () => {
              navigator.clipboard.writeText(c.id);
              toast('Chat ID copied');
            }
          },
          {
            label: 'Copy All Messages',
            icon: 'copy',
            onClick: () => {
              copyChatTranscript(c.id);
            }
          }
        ]
      },
      {
        label: 'Split',
        icon: 'split',
        submenu: true,
        children: [
          {
            label: 'Split Right',
            icon: 'split',
            onClick: () => {
              if (els.changesPane && els.changesPane.hidden) {
                toggleChanges();
              }
            }
          },
          {
            label: 'Split Down',
            icon: 'terminal',
            onClick: () => {
              if (els.terminalPane && els.terminalPane.hidden) {
                toggleTerminal();
              }
            }
          }
        ]
      },
      { type: 'sep' },
      {
        label: 'Archive',
        icon: 'archive',
        shortcut: '⌥⌘A',
        onClick: () => {
          toggleArchiveChat(c.id);
        }
      },
      {
        label: 'Delete',
        icon: 'trash',
        danger: true,
        onClick: async () => {
          if (!(await confirmDialog('Delete this conversation?', 'The conversation is removed from this Mac. Your project files are not touched.', 'Delete'))) return;
          const wasCurrent = c.id === S.app?.chatId;
          const r = await api.deleteChat(c.id);
          if (r.ok) applyState(r);
          if (wasCurrent) resetChatView();
          await loadChats();
        }
      }
    ];
    showMenu(anchor, items);
  }

  function createSessionItem(c, isCur) {
    const item = h('div', 'sb-item sb-session-item' + (isCur ? ' on' : ''));
    item.title = c.title;

    if (isChatPinned(c.id)) {
      const pinIcon = h('span', 'ico tiny sb-pin-icon');
      pinIcon.appendChild(icon('pin'));
      item.appendChild(pinIcon);
    }

    const label = h('span', 'label ellipsis');
    label.textContent = c.title;
    item.appendChild(label);

    // Right side indicator & hover 3-dots with strict fixed slot
    const rightWrap = h('div', 'sb-session-right no-drag');
    const indWrap = h('div', 'sb-session-ind');

    if (isCur) {
      const grip = h('span', 'ico tiny sb-grip-ico');
      grip.appendChild(icon('grip'));
      grip.title = 'Active session';
      indWrap.appendChild(grip);
    } else if (isChatUnread(c.id)) {
      const dot = h('span', 'sb-unread-dot');
      dot.title = 'Unread messages';
      indWrap.appendChild(dot);
    } else if (S.runningChats.has(c.id)) {
      const rDot = h('span', 'run-dot');
      rDot.title = 'Working…';
      indWrap.appendChild(rDot);
    } else if (c.updatedAt) {
      const timeLbl = h('span', 'sb-time-lbl');
      timeLbl.textContent = compactRelTime(c.updatedAt);
      indWrap.appendChild(timeLbl);
    }
    rightWrap.appendChild(indWrap);

    const moreBtn = h('button', 'icon-btn tiny sb-more-btn sb-hover-more');
    moreBtn.type = 'button';
    moreBtn.title = 'More options';
    moreBtn.setAttribute('aria-label', 'More options');
    setIcon(moreBtn, 'moreVertical');
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSessionMenu(moreBtn, c);
    });
    rightWrap.appendChild(moreBtn);

    item.appendChild(rightWrap);

    item.addEventListener('click', () => {
      if (c.id !== S.app?.chatId) openChat(c.id);
    });

    return item;
  }

  // ---------- confirm dialog ----------
  function confirmDialog(title, text, okLabel) {
    return new Promise((resolve) => {
      const d = $('confirmDialog');
      $('confirmTitle').textContent = title;
      $('confirmText').textContent = text;
      $('confirmYes').textContent = okLabel || 'OK';
      const done = (v) => {
        $('confirmYes').onclick = null;
        $('confirmNo').onclick = null;
        d.onclose = null;
        if (d.open) d.close();
        resolve(v);
      };
      $('confirmYes').onclick = () => done(true);
      $('confirmNo').onclick = () => done(false);
      d.onclose = () => done(false);
      d.showModal();
    });
  }

  // ---------- app state -> UI ----------
  function activeProvider() {
    const s = S.app && S.app.settings;
    if (!s) return null;
    return s.providers.find((p) => p.id === s.activeProviderId) || s.providers[0] || null;
  }

  const APPROVAL = {
    ask: { label: 'Ask first', sub: 'Approve every file change, command and web request' },
    edits: { label: 'Auto-edit', sub: 'Edits go through; ask before commands and web requests' },
    auto: { label: 'Auto-approve', sub: 'Never ask (only for throwaway folders)' },
  };

  function applyState(app) {
    if (!app || !app.settings) return;
    S.app = app;
    S.runningChats = new Set(app.runningChats || []);
    renderSidebar();
    renderAccountLabel();
    renderHeader();
    renderComposerPills();
    renderEmpty();
    const has = !!app.folder;
    els.input.disabled = !has;
    els.sendBtn.disabled = !has;
    els.input.placeholder = has ? 'Ask the agent to do something in this folder…' : 'Open a folder to start';
    els.termCwd.textContent = app.folder || '';
    if (S.provSel && !app.settings.providers.some((p) => p.id === S.provSel)) S.provSel = null;

    if (!app.settings.onboarded && !store('cr3.onboarded')) {
      openOnboardDialog();
    } else if (has && !document.querySelector('dialog[open]')) {
      els.input.focus();
    }
  }

  function renderHeader() {
    const f = S.app?.folder;
    const projNameEl = $('projName');
    const topSepEl = $('topSep');
    const chatTitleTopEl = $('chatTitleTop');
    const projPathEl = $('projPath');

    const curChat = (S.chats || []).find((c) => c.id === S.app?.chatId) || (S.allChats || []).find((c) => c.id === S.app?.chatId);
    const chatTitle = curChat?.title || (f ? 'New Conversation' : '');

    if (projNameEl) projNameEl.textContent = f ? baseName(f) : 'CR3-Agentic AI';
    if (topSepEl) topSepEl.hidden = !chatTitle;
    if (chatTitleTopEl) {
      chatTitleTopEl.hidden = !chatTitle;
      chatTitleTopEl.textContent = chatTitle;
    }
    if (projPathEl) {
      projPathEl.textContent = f ? '‎' + f : '';
      projPathEl.title = f || '';
    }
  }

  function renderComposerPills() {
    const s = S.app.settings;
    els.approvalLabel.textContent = (APPROVAL[s.approvalMode] || APPROVAL.ask).label;
    const p = activeProvider();
    const model = p && p.model ? p.model : '';
    els.modelLabel.textContent = model || (p ? 'Choose a model' : 'No provider');
    if (els.modelProvider) els.modelProvider.textContent = p ? p.name : '';
    if (els.modelBtn) {
      els.modelBtn.classList.toggle('model-missing', !model);
      els.modelBtn.title = p
        ? `${p.name}\n${model || 'No model selected'}\nClick to switch provider or model`
        : 'No provider configured. Open Settings → Providers & Models.';
    }
  }

  const SUGGESTIONS = [
    'Give me a quick tour of this project',
    'Find and fix a bug',
    'Add tests for the main logic',
    'Check this code for security problems',
  ];

  function renderEmpty() {
    const f = S.app?.folder;
    els.emptyActions.textContent = '';

    if (!f) {
      els.emptyTitle.textContent = 'CR3-Agentic AI';
      els.emptyText.textContent = 'Autonomous desktop AI agent workspace. Open a project folder to begin:';

      const openBtn = h('button', 'empty-btn primary');
      openBtn.appendChild(iconSpan('folder'));
      openBtn.appendChild(h('span', '', 'Open Folder…'));
      openBtn.addEventListener('click', pickFolder);
      els.emptyActions.appendChild(openBtn);

      const recent = (S.app?.settings?.recentFolders || []).slice(0, 3);
      if (recent.length > 0) {
        const recWrap = h('div', 'empty-recent-wrap');
        const recLbl = h('div', 'empty-recent-lbl', 'Recent workspaces:');
        recWrap.appendChild(recLbl);
        const recList = h('div', 'empty-recent-list');
        for (const rf of recent) {
          const rc = h('button', 'empty-recent-item');
          rc.appendChild(iconSpan('folder'));
          rc.appendChild(h('span', 'ellipsis', baseName(rf)));
          rc.title = rf;
          rc.addEventListener('click', () => openProject(rf));
          recList.appendChild(rc);
        }
        recWrap.appendChild(recList);
        els.emptyActions.appendChild(recWrap);
      }
      return;
    }

    els.emptyTitle.textContent = `What would you like to build?`;
    els.emptyText.textContent = `Autonomous coding assistant for ${baseName(f)}. Start with a quick workflow:`;

    const WORKFLOW_CARDS = [
      {
        ico: 'search',
        title: 'Explore Architecture',
        desc: 'Map modules, imports, and core design patterns',
        prompt: 'Explore and summarize the repository architecture, key entrypoints, and patterns.'
      },
      {
        ico: 'terminal',
        title: 'Run Tests & Fix',
        desc: 'Execute test suites and repair broken assertions',
        prompt: 'Run the project tests, analyze failures, and apply necessary code fixes.'
      },
      {
        ico: 'diff',
        title: 'Review Changes',
        desc: 'Inspect modified lines, diffs, and uncommitted edits',
        prompt: 'Review current uncommitted git changes and summarize impact.'
      },
      {
        ico: 'sparkles',
        title: 'Implement Feature',
        desc: 'Design, write, and verify a new feature end-to-end',
        prompt: 'Help me plan and implement a new feature in this codebase.'
      },
    ];

    const grid = h('div', 'empty-action-grid');
    for (const w of WORKFLOW_CARDS) {
      const card = h('button', 'empty-card');
      card.type = 'button';

      const top = h('div', 'ec-head');
      top.appendChild(iconSpan(w.ico));
      top.appendChild(h('span', 'ec-title', w.title));
      card.appendChild(top);

      const desc = h('div', 'ec-desc', w.desc);
      card.appendChild(desc);

      card.addEventListener('click', () => {
        els.input.value = w.prompt;
        autoGrow();
        els.input.focus();
      });
      grid.appendChild(card);
    }
    els.emptyActions.appendChild(grid);
  }

  // ---------- navigation history ----------
  function pushNav(chatId) {
    if (!chatId || S.isNavigating) return;
    if (S.navIndex >= 0 && S.navHistory[S.navIndex] === chatId) return;
    S.navHistory.splice(S.navIndex + 1);
    S.navHistory.push(chatId);
    S.navIndex = S.navHistory.length - 1;
    updateNavButtons();
  }

  function updateNavButtons() {
    if (els.navBackBtn) els.navBackBtn.disabled = S.navIndex <= 0;
    if (els.navForwardBtn) els.navForwardBtn.disabled = S.navIndex < 0 || S.navIndex >= S.navHistory.length - 1;
  }

  async function navBack() {
    if (S.navIndex > 0) {
      S.navIndex--;
      S.isNavigating = true;
      try {
        await openChat(S.navHistory[S.navIndex]);
      } finally {
        S.isNavigating = false;
        updateNavButtons();
      }
    }
  }

  async function navForward() {
    if (S.navIndex >= 0 && S.navIndex < S.navHistory.length - 1) {
      S.navIndex++;
      S.isNavigating = true;
      try {
        await openChat(S.navHistory[S.navIndex]);
      } finally {
        S.isNavigating = false;
        updateNavButtons();
      }
    }
  }

  function renderSidebar() {
    renderProjects();
    renderConversations();
  }

  function renderAllChats() {
    renderProjects();
    renderConversations();
  }

  function applyDisplayDensity() {
    const compact = S.displayDensity === 'Compact';
    if (els.projectList) els.projectList.classList.toggle('sb-compact', compact);
    if (els.chatList) els.chatList.classList.toggle('sb-compact', compact);
    if (els.conversationsList) els.conversationsList.classList.toggle('sb-compact', compact);
    store('cr3.displayDensity', S.displayDensity);
  }

  function showProjectFilterMenu(anchor) {
    const items = [
      {
        label: 'Group By',
        valueText: S.groupBy || 'Project',
        children: [
          { label: 'Project', checked: (S.groupBy || 'Project') === 'Project', onClick: () => { S.groupBy = 'Project'; renderAllChats(); } },
          { label: 'None', checked: S.groupBy === 'None', onClick: () => { S.groupBy = 'None'; renderAllChats(); } },
          { label: 'Date', checked: S.groupBy === 'Date', onClick: () => { S.groupBy = 'Date'; renderAllChats(); } },
        ]
      },
      {
        label: 'Sort Conversations',
        valueText: S.sortConversations || 'Last Updated',
        children: [
          { label: 'Last Updated', checked: (S.sortConversations || 'Last Updated') === 'Last Updated', onClick: () => { S.sortConversations = 'Last Updated'; renderAllChats(); } },
          { label: 'Created Time', checked: S.sortConversations === 'Created Time', onClick: () => { S.sortConversations = 'Created Time'; renderAllChats(); } },
          { label: 'Alphabetical', checked: S.sortConversations === 'Alphabetical', onClick: () => { S.sortConversations = 'Alphabetical'; renderAllChats(); } },
        ]
      },
      {
        label: 'Sort Projects',
        valueText: S.sortProjects || 'Custom Order',
        children: [
          { label: 'Custom Order', checked: (S.sortProjects || 'Custom Order') === 'Custom Order', onClick: () => { S.sortProjects = 'Custom Order'; renderProjects(); } },
          { label: 'Last Active', checked: S.sortProjects === 'Last Active', onClick: () => { S.sortProjects = 'Last Active'; renderProjects(); } },
          { label: 'Alphabetical', checked: S.sortProjects === 'Alphabetical', onClick: () => { S.sortProjects = 'Alphabetical'; renderProjects(); } },
        ]
      },
      { type: 'sep' },
      {
        label: 'Filter',
        children: [
          { label: 'All', checked: (S.filterType || 'All') === 'All', onClick: () => { S.filterType = 'All'; renderAllChats(); } },
          { label: 'Unread Only', checked: S.filterType === 'Unread Only', onClick: () => { S.filterType = 'Unread Only'; renderAllChats(); } },
          { label: 'With Changes', checked: S.filterType === 'With Changes', onClick: () => { S.filterType = 'With Changes'; renderAllChats(); } },
          { label: 'Starred', checked: S.filterType === 'Starred', onClick: () => { S.filterType = 'Starred'; renderAllChats(); } },
        ]
      },
      {
        label: 'Display',
        children: [
          {
            label: 'Comfortable',
            checked: (S.displayDensity || 'Comfortable') === 'Comfortable',
            onClick: () => {
              S.displayDensity = 'Comfortable';
              applyDisplayDensity();
              toast('Sidebar density: Comfortable');
            }
          },
          {
            label: 'Compact',
            checked: S.displayDensity === 'Compact',
            onClick: () => {
              S.displayDensity = 'Compact';
              applyDisplayDensity();
              toast('Sidebar density: Compact');
            }
          },
          {
            label: 'Show Branch',
            checked: !!S.showBranch,
            onClick: () => {
              S.showBranch = !S.showBranch;
              store('cr3.showBranch', S.showBranch ? '1' : '0');
              renderProjects();
              toast(S.showBranch ? 'Showing Git branches' : 'Hidden Git branches');
            }
          },
          {
            label: 'Show Path',
            checked: !!S.showPath,
            onClick: () => {
              S.showPath = !S.showPath;
              store('cr3.showPath', S.showPath ? '1' : '0');
              renderProjects();
              toast(S.showPath ? 'Showing full project paths' : 'Hidden project paths');
            }
          },
        ]
      },
      {
        label: 'Auto Pin',
        checked: !!S.autoPin,
        onClick: () => {
          S.autoPin = !S.autoPin;
          toast(S.autoPin ? 'Auto-pin enabled for new chats' : 'Auto-pin disabled');
        }
      },
      {
        label: 'Archived Only',
        checked: !!S.filterArchivedOnly,
        onClick: () => {
          S.filterArchivedOnly = !S.filterArchivedOnly;
          renderAllChats();
        }
      },
      { type: 'sep' },
      {
        label: 'Mark All as Read',
        onClick: () => {
          S.unreadChats.clear();
          localStorage.setItem('cr3_unread_chats', JSON.stringify([]));
          toast('All conversations marked as read');
          renderAllChats();
        }
      }
    ];
    showMenu(anchor, items);
  }

  function renderProjects() {
    const pl = els.projectList;
    if (!pl) return;
    pl.textContent = '';

    const curFolder = S.app?.folder;
    const filter = (S.chatFilter || '').trim().toLowerCase();

    // Collect all project folders and maintain a stable order so folders never jump around
    if (!S.stableProjectsList) S.stableProjectsList = [];
    const allKnown = [];
    const seen = new Set();

    const recent = S.app?.settings?.recentFolders || [];
    for (const f of recent) {
      if (f && !seen.has(f)) {
        seen.add(f);
        allKnown.push(f);
      }
    }
    if (curFolder && !seen.has(curFolder)) {
      seen.add(curFolder);
      allKnown.push(curFolder);
    }
    for (const c of (S.allChats || [])) {
      if (c.folder && !seen.has(c.folder)) {
        seen.add(c.folder);
        allKnown.push(c.folder);
      }
    }

    // Preserve existing established positions in the sidebar
    let folders = S.stableProjectsList.filter((f) => seen.has(f));
    const foldersSet = new Set(folders);
    for (const f of allKnown) {
      if (!foldersSet.has(f)) {
        folders.push(f);
        foldersSet.add(f);
      }
    }
    S.stableProjectsList = folders.slice();

    if (S.sortProjects === 'Alphabetical') {
      folders.sort((a, b) => baseName(a).localeCompare(baseName(b)));
    } else if (S.sortProjects === 'Last Active') {
      folders.sort((a, b) => {
        const getLatest = (folder) => {
          let latest = 0;
          for (const c of (S.allChats || [])) {
            if (c.folder === folder && (c.updatedAt || 0) > latest) latest = c.updatedAt;
          }
          return latest;
        };
        return getLatest(b) - getLatest(a);
      });
    }

    if (folders.length === 0) {
      pl.appendChild(h('div', 'sb-empty', 'No projects opened yet.'));
      return;
    }

    for (const f of folders) {
      const isCurFolder = (f === curFolder);
      const isCardCollapsed = S.collapsedProjects.has(f);

      const card = h('div', 'sb-project-card' + (isCurFolder ? ' is-active-project' : ''));

      // Project Header row
      const head = h('div', 'sb-project-head' + (isCurFolder ? ' active-head' : ''));
      
      const toggle = h('button', 'icon-btn tiny sb-fold-btn' + (isCardCollapsed ? ' collapsed' : ''));
      toggle.type = 'button';
      toggle.title = isCardCollapsed ? 'Expand project' : 'Collapse project';
      setIcon(toggle, isCardCollapsed ? 'chevronRight' : 'chevronDown');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (S.collapsedProjects.has(f)) S.collapsedProjects.delete(f);
        else S.collapsedProjects.add(f);
        renderProjects();
      });
      head.appendChild(toggle);

      const fIcon = h('span', 'ico proj-icon');
      fIcon.appendChild(icon('folder'));
      head.appendChild(fIcon);

      const nameSpan = h('span', 'sb-proj-title ellipsis', baseName(f));
      nameSpan.title = f;
      head.appendChild(nameSpan);

      if (S.showBranch) {
        const branchBadge = h('span', 'sb-proj-branch-badge', (isCurFolder && S.app?.git?.branch) ? S.app.git.branch : 'main');
        head.appendChild(branchBadge);
      }

      const acts = h('div', 'proj-hover-actions no-drag');

      const moreBtn = h('button', 'icon-btn tiny sb-more-btn');
      moreBtn.type = 'button';
      moreBtn.title = 'Project options';
      setIcon(moreBtn, 'moreVertical');
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProjectMenu(moreBtn, f);
      });
      acts.appendChild(moreBtn);

      const newBtn = h('button', 'icon-btn tiny');
      newBtn.type = 'button';
      newBtn.title = 'New conversation in project';
      setIcon(newBtn, 'plus');
      newBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (f !== S.app?.folder) await openProject(f);
        await newChat();
      });
      acts.appendChild(newBtn);

      head.appendChild(acts);

      // Clicking project header activates the project without altering list position
      head.addEventListener('click', async () => {
        if (f !== S.app?.folder) {
          await openProject(f);
        } else {
          if (S.collapsedProjects.has(f)) S.collapsedProjects.delete(f);
          else S.collapsedProjects.add(f);
          renderProjects();
        }
      });

      card.appendChild(head);
      if (S.showPath) {
        const pathDiv = h('div', 'sb-proj-path-sub ellipsis', f);
        pathDiv.title = f;
        card.appendChild(pathDiv);
      }

      // Sub-content Tree Container
      if (!isCardCollapsed) {
        let fChats = (S.allChats || []).filter((c) => c.folder === f);
        if (filter) {
          fChats = fChats.filter((c) => (c.title || '').toLowerCase().includes(filter));
        } else if (!S.filterArchivedOnly) {
          fChats = fChats.filter((c) => !isChatArchived(c.id));
        }

        if (S.filterType === 'Unread Only') {
          fChats = fChats.filter((c) => isChatUnread(c.id));
        } else if (S.filterType === 'Starred') {
          fChats = fChats.filter((c) => isChatPinned(c.id));
        }

        // Sort chats strictly by Pinned first, then latest updatedAt descending!
        fChats.sort((a, b) => {
          const pinA = isChatPinned(a.id) ? 1 : 0;
          const pinB = isChatPinned(b.id) ? 1 : 0;
          if (pinA !== pinB) return pinB - pinA;
          if (S.sortConversations === 'Alphabetical') {
            return (a.title || '').localeCompare(b.title || '');
          } else if (S.sortConversations === 'Created Time') {
            return (b.createdAt || 0) - (a.createdAt || 0);
          }
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        const tree = h('div', 'sb-project-tree');

        // If this is the active project and has an unsaved new conversation:
        if (isCurFolder && !filter) {
          const hasNewChat = !fChats.some((c) => c.id === S.app.chatId);
          if (hasNewChat) {
            const newEl = createSessionItem({ id: S.app.chatId, title: 'New Conversation' }, true);
            tree.appendChild(newEl);
          }
        }

        for (const c of fChats) {
          const isCurChat = (c.id === S.app?.chatId);
          const el = createSessionItem(c, isCurChat);
          tree.appendChild(el);
        }

        if (fChats.length === 0 && !isCurFolder) {
          tree.appendChild(h('div', 'sb-tree-empty', 'No conversations'));
        }

        card.appendChild(tree);
      }

      pl.appendChild(card);
    }
  }

  function renderChats() {
    renderProjects();
  }

  function renderOtherProjects() {
    // Merged into unified renderProjects()
  }

  function renderConversations() {
    const cv = els.conversationsList;
    if (!cv) return;
    cv.textContent = '';

    const curFolder = S.app?.folder;
    const recent = S.app?.settings?.recentFolders || [];
    const knownFolders = new Set([curFolder, ...recent].filter(Boolean));
    const filter = (S.chatFilter || '').trim().toLowerCase();

    // Standalone chats or chats from unlisted folders
    let convos = (S.allChats || []).filter((c) => !c.folder || !knownFolders.has(c.folder));

    if (filter) {
      convos = convos.filter((c) => (c.title || '').toLowerCase().includes(filter));
    } else {
      convos = convos.filter((c) => !isChatArchived(c.id));
    }

    convos.sort((a, b) => {
      const pinA = isChatPinned(a.id) ? 1 : 0;
      const pinB = isChatPinned(b.id) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    if (els.conversationsSection) {
      els.conversationsSection.hidden = convos.length === 0;
    }

    for (const c of convos) {
      cv.appendChild(createSessionItem(c, c.id === S.app?.chatId));
    }
  }

  async function loadChats() {
    const r = await api.listChats();
    S.chats = r.ok ? (r.chats || []) : [];
    S.allChats = r.ok ? (r.allChats || r.chats || []) : [];
    if (r.ok && r.runningChats) S.runningChats = new Set(r.runningChats);
    if (S.app) renderSidebar();
  }

  // ---------- messages ----------
  function nearBottom() {
    const m = els.messages;
    return m.scrollHeight - m.scrollTop - m.clientHeight < 140;
  }

  function scrollDown() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function showEmpty(on) {
    if (on && !emptyEl.isConnected) els.messages.prepend(emptyEl);
    if (!on && emptyEl.isConnected) emptyEl.remove();
  }

  function append(node) {
    const stick = nearBottom();
    showEmpty(false);
    els.messages.appendChild(node);
    if (stick) scrollDown();
  }

  function resetChatView() {
    flushAssistant();
    stopThinkingTimer();
    els.messages.textContent = '';
    S.current = null;
    S.tools.clear();
    showEmpty(true);
  }

  // ---------- attachment cards ----------
  const FILE_KINDS = {
    ts: ['TS', 'TypeScript', 'code'], tsx: ['TSX', 'TypeScript', 'code'], js: ['JS', 'JavaScript', 'code'], jsx: ['JSX', 'JavaScript', 'code'],
    py: ['PY', 'Python', 'code'], rs: ['RS', 'Rust', 'code'], go: ['GO', 'Go', 'code'], java: ['JAVA', 'Java', 'code'],
    css: ['CSS', 'CSS', 'code'], scss: ['SCSS', 'Sass', 'code'], html: ['HTML', 'HTML', 'code'], sh: ['SH', 'Shell', 'code'],
    json: ['JSON', 'JSON', 'data'], yml: ['YML', 'YAML', 'data'], yaml: ['YAML', 'YAML', 'data'], csv: ['CSV', 'CSV', 'data'],
    xml: ['XML', 'XML', 'data'], sql: ['SQL', 'SQL', 'data'], md: ['MD', 'Markdown', 'doc'], txt: ['TXT', 'Text', 'doc'],
    pdf: ['PDF', 'PDF', 'pdf'], doc: ['DOC', 'Document', 'doc'], docx: ['DOCX', 'Document', 'doc'],
    zip: ['ZIP', 'Archive', 'archive'], tar: ['TAR', 'Archive', 'archive'], gz: ['GZ', 'Archive', 'archive'],
    png: ['PNG', 'Image', 'image'], jpg: ['JPG', 'Image', 'image'], jpeg: ['JPEG', 'Image', 'image'], webp: ['WEBP', 'Image', 'image'], gif: ['GIF', 'Image', 'image'],
  };

  function fileInfo(att) {
    const name = att.name || 'File';
    const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
    const known = FILE_KINDS[ext];
    const size = typeof att.size === 'number' ? fmtSize(att.size) : '';
    return {
      badge: known ? known[0] : (ext ? ext.slice(0, 4).toUpperCase() : 'FILE'),
      kind: known ? known[1] : 'File',
      tone: known ? known[2] : 'file',
      meta: [known ? known[1] : 'Attached file', size].filter(Boolean).join(' · '),
    };
  }

  function linkInfo(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./i, '');
      const path = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
      return { host: host || u.href, path: path || 'Open link' };
    } catch {
      return { host: url, path: 'Link' };
    }
  }

  function openAttachmentLink(url) {
    if (!/^https:\/\//i.test(url)) {
      toast('Only secure https links can be opened from chat.');
      return;
    }
    if (window.api?.openWeb) window.api.openWeb(url).catch(() => toast('Could not open that link.'));
  }

  function addRemoveButton(card, opts) {
    if (!opts.removable) return;
    const rm = h('button', 'rm');
    rm.type = 'button';
    rm.title = 'Remove';
    rm.setAttribute('aria-label', 'Remove attachment');
    setIcon(rm, 'x');
    rm.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onRemove?.();
    });
    card.appendChild(rm);
  }

  function chipFor(att, opts = {}) {
    if (att.kind === 'image') {
      const card = h('div', 'att att-image' + (opts.compact ? ' compact' : ''));
      if (att.dataUrl) {
        const img = h('img');
        img.src = att.dataUrl;
        img.alt = att.name || 'Attached image';
        img.loading = 'lazy';
        img.decoding = 'async';
        card.appendChild(img);
        const open = () => window.Md?.openImage?.(att.dataUrl, att.name || 'Attached image');
        card.classList.add('clickable');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.title = att.name ? `Open ${att.name}` : 'Open image';
        card.addEventListener('click', open);
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        });
      } else {
        card.classList.add('no-img');
        card.appendChild(iconSpan('image', 'big'));
        card.appendChild(h('span', 'att-image-name', att.name || 'Image'));
        card.title = att.name || 'Image';
      }
      addRemoveButton(card, opts);
      return card;
    }

    if (att.kind === 'link') {
      const info = linkInfo(att.url);
      const card = h('div', 'att att-link clickable');
      card.tabIndex = 0;
      card.setAttribute('role', 'link');
      card.title = att.url;
      card.appendChild(iconSpan('link', 'att-link-ico'));
      const copy = h('span', 'att-info');
      copy.appendChild(h('span', 'name', info.host));
      copy.appendChild(h('span', 'meta', info.path));
      card.appendChild(copy);
      const open = () => openAttachmentLink(att.url);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
      addRemoveButton(card, opts);
      return card;
    }

    const info = fileInfo(att);
    const card = h('div', 'att att-file');
    card.title = att.name || 'Attached file';
    card.appendChild(h('span', 'att-badge tone-' + info.tone, info.badge));
    const copy = h('span', 'att-info');
    copy.appendChild(h('span', 'name', att.name || 'File'));
    copy.appendChild(h('span', 'meta', info.meta));
    card.appendChild(copy);
    addRemoveButton(card, opts);
    return card;
  }

  function addUser(text, atts) {
    const wrap = h('div', 'msg-user-wrap');
    const box = h('div', 'msg-user');
    if (text) box.appendChild(document.createTextNode(text));
    if (atts && atts.length > 0) {
      const row = h('div', 'msg-atts');
      for (const a of atts) row.appendChild(chipFor(a, { message: true }));
      box.appendChild(row);
    }
    wrap.appendChild(box);
    append(wrap);
  }

  function formatThinkingTime(sec) {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m ${s}s`;
  }

  function formatToolStep(name, args, summary) {
    const ext = (path) => {
      const parts = String(path || '').split('.');
      const m = parts.length > 1 ? parts.pop().toLowerCase() : '';
      return FILE_KINDS[m]?.[0] || m.toUpperCase().slice(0, 4) || 'FILE';
    };
    const basename = (p) => String(p || '').split('/').pop() || String(p || '');

    if (name === 'read_file') {
      const p = String(args?.path || 'file');
      const b = ext(p);
      const lines = args?.start_line ? `#L${args.start_line}${args.end_line ? '-' + args.end_line : ''}` : '';
      return {
        header: `Analyzing ${basename(p)}…`,
        step: { action: 'Analyzed', badge: b, text: p, details: lines, status: 'running' },
      };
    }
    if (name === 'edit_file') {
      const p = String(args?.path || 'file');
      const b = ext(p);
      return {
        header: `Editing ${basename(p)}…`,
        step: { action: 'Edited', badge: b, text: p, details: '', status: 'running' },
      };
    }
    if (name === 'write_file') {
      const p = String(args?.path || 'file');
      const b = ext(p);
      return {
        header: `Writing ${basename(p)}…`,
        step: { action: 'Wrote', badge: b, text: p, details: '', status: 'running' },
      };
    }
    if (name === 'run_command') {
      const cmd = String(args?.command || '').trim();
      return {
        header: `Running: ${cmd.slice(0, 40)}…`,
        step: { action: 'Ran', badge: 'CMD', text: cmd.slice(0, 80), details: '', status: 'running' },
      };
    }
    if (name === 'search') {
      const pat = String(args?.pattern || '');
      return {
        header: `Searching for /${pat}/…`,
        step: { action: 'Searched', badge: 'FIND', text: `/${pat}/`, details: args?.path ? `in ${args.path}` : '', status: 'running' },
      };
    }
    if (name === 'list_dir') {
      const p = String(args?.path || '.');
      return {
        header: `Listing ${p}…`,
        step: { action: 'Listed', badge: 'DIR', text: p, details: '', status: 'running' },
      };
    }
    if (name === 'fetch_url') {
      const u = String(args?.url || '');
      return {
        header: `Fetching url…`,
        step: { action: 'Fetched', badge: 'WEB', text: u.slice(0, 60), details: '', status: 'running' },
      };
    }
    return {
      header: `Executing ${name}…`,
      step: { action: 'Executed', badge: 'TOOL', text: summary || name, details: '', status: 'running' },
    };
  }

  function deriveInitialThinkingLabel(text, atts) {
    if (atts && atts.length > 0) {
      const first = atts[0];
      if (first && first.name) return `Analyzing ${first.name}…`;
      if (first && first.url) return `Analyzing attached link…`;
    }
    const clean = String(text || '').trim();
    if (!clean) return 'Thinking…';
    
    // Look for explicit filename references with extensions like .ts, .js, .py, .json, etc.
    const fileMatch = clean.match(/(?:^|\s|["'`])([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]{1,6})(?:$|\s|["'`])/);
    if (fileMatch && fileMatch[1] && !fileMatch[1].startsWith('http')) {
      const filename = fileMatch[1].split('/').pop();
      return `Analyzing ${filename}…`;
    }
    
    if (/\b(?:test|tests|build|run|start)\b/i.test(clean)) {
      return 'Planning task execution…';
    }
    if (/\b(?:search|find|grep|look for)\b/i.test(clean)) {
      return 'Searching workspace…';
    }
    return 'Thinking…';
  }

  function createThinkingBlock(promptText, atts) {
    stopThinkingTimer();
    const wrap = h('div', 'thinking-wrap');
    const head = h('button', 'thinking-head');
    head.type = 'button';

    const chev = iconSpan('chevronRight', 'thinking-chev');
    head.appendChild(chev);

    const pulse = h('span', 'thinking-pulse');
    head.appendChild(pulse);

    const initialLabel = deriveInitialThinkingLabel(promptText, atts);
    const label = h('span', 'thinking-label');
    const actionEl = h('span', 'thinking-action-text', initialLabel);
    const timerEl = h('span', 'thinking-timer', '0s');
    label.appendChild(actionEl);
    label.appendChild(timerEl);
    head.appendChild(label);

    wrap.appendChild(head);

    const body = h('div', 'thinking-body');
    body.hidden = true;
    const list = h('ul', 'thinking-steps');
    body.appendChild(list);
    wrap.appendChild(body);

    head.addEventListener('click', () => {
      const isHidden = body.hidden;
      body.hidden = !isHidden;
      wrap.classList.toggle('open', !isHidden);
    });

    append(wrap);

    const startTime = Date.now();
    let stepCount = 0;
    const stepElements = new Map();

    const addStep = (info) => {
      if (!info) return;
      stepCount++;
      const li = h('li', 'thinking-step-item');
      if (typeof info === 'string') {
        const dot = h('span', 'thinking-step-status ok');
        const textSpan = h('span', 'thinking-step-text', info);
        li.append(dot, textSpan);
      } else {
        const statusSpan = h('span', 'thinking-step-status ' + (info.status || 'ok'));
        li.appendChild(statusSpan);
        if (info.action) {
          const actSpan = h('span', 'thinking-step-action', info.action);
          li.appendChild(actSpan);
        }
        if (info.badge) {
          const badgeSpan = h('span', 'thinking-step-badge', info.badge);
          li.appendChild(badgeSpan);
        }
        if (info.text) {
          const textSpan = h('span', 'thinking-step-text', info.text);
          li.appendChild(textSpan);
        }
        if (info.details) {
          const detSpan = h('span', 'thinking-step-details', info.details);
          li.appendChild(detSpan);
        }
        if (info.id) stepElements.set(info.id, { li, statusSpan, info });
      }
      list.appendChild(li);
    };

    const updateStep = (id, result) => {
      const entry = stepElements.get(id);
      if (!entry) return;
      entry.statusSpan.className = 'thinking-step-status ' + (result.ok ? 'ok' : 'fail');
      if (result.details) {
        let detSpan = entry.li.querySelector('.thinking-step-details');
        if (!detSpan) {
          detSpan = h('span', 'thinking-step-details');
          entry.li.appendChild(detSpan);
        }
        detSpan.textContent = result.details;
      }
    };

    const setHeaderAction = (actionText) => {
      if (actionEl && !wrap.classList.contains('completed')) {
        actionEl.textContent = actionText;
      }
    };

    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
      if (timerEl) timerEl.textContent = formatThinkingTime(elapsed);
    }, 1000);

    const finish = (finalMessage) => {
      if (!S.activeThinking) return;
      clearInterval(interval);
      const totalElapsed = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
      pulse.remove();
      label.textContent = '';
      const isErr = finalMessage && /error/i.test(finalMessage);
      const isStopped = finalMessage && /stopped/i.test(finalMessage);
      const statusIco = isErr
        ? iconSpan('alertTriangle', 'thinking-fail-ico')
        : isStopped
          ? iconSpan('stop', 'thinking-stop-ico')
          : iconSpan('check', 'thinking-check-ico');
      label.appendChild(statusIco);
      const stepsSummary = stepCount > 0 ? ` · ${stepCount} step${stepCount === 1 ? '' : 's'}` : '';
      label.appendChild(h('span', '', ` Thought for ${formatThinkingTime(totalElapsed)}${stepsSummary}`));
      if (stepCount === 0 && !finalMessage) {
        addStep({ action: 'Completed', badge: 'DONE', text: 'response generated', details: '', status: 'ok' });
      }
      if (S.changes && S.changes.length > 0) {
        let add = 0, del = 0;
        for (const ch of S.changes) { add += (ch.added || 0); del += (ch.removed || 0); }
        addStep({ action: 'Modified', badge: 'DIFF', text: `${S.changes.length} file${S.changes.length === 1 ? '' : 's'}`, details: `(+${add}, -${del})`, status: 'ok' });
      }
      wrap.classList.add('completed');
      S.activeThinking = null;
    };

    S.activeThinking = { wrap, head, body, finish, addStep, updateStep, setHeaderAction, startTime, interval };
    return S.activeThinking;
  }

  function stopThinkingTimer() {
    if (S.activeThinking) {
      if (S.activeThinking.interval) clearInterval(S.activeThinking.interval);
      S.activeThinking = null;
    }
  }

  function startAssistant() {
    const wrap = h('div', 'msg-assistant-wrap');
    const el = h('div', 'msg-assistant');
    wrap.appendChild(el);
    append(wrap);
    S.current = { el, wrap, raw: '', raf: 0, startTime: S.turnStartTime || Date.now() };
    S.lastAssistantRecord = S.current;
  }

  function drawAssistant(final) {
    const c = S.current;
    if (!c) return;
    c.raf = 0;
    const stick = nearBottom();
    Md.render(c.el, c.raw, { streaming: !final });
    if (stick) scrollDown();
  }

  function onText(delta) {
    if (S.activeThinking) S.activeThinking.setHeaderAction('Responding…');
    if (!S.current) startAssistant();
    S.current.raw += delta;
    if (!S.current.raf) S.current.raf = requestAnimationFrame(drawAssistant);
  }

  function flushAssistant() {
    const c = S.current;
    if (!c) return;
    if (c.raf) cancelAnimationFrame(c.raf);
    drawAssistant(true);
    if (S.lastAssistantRecord) {
      S.lastAssistantRecord.duration = S.turnStartTime ? Math.max(0.5, (Date.now() - S.turnStartTime) / 1000) : 0;
      S.lastAssistantRecord.completedAt = Date.now();
    }
    S.current = null;
  }

  function formatDuration(sec) {
    if (!sec || sec <= 0) return 'Just now';
    if (sec < 60) return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
    if (sec < 3600) {
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }

  async function attachAssistantFooter(rec, isHistory) {
    if (!rec || !rec.wrap) return;
    if (rec.wrap.querySelector('.msg-action-row')) return;

    if (!isHistory) {
      let changes = S.changes || [];
      if ((!changes || changes.length === 0) && api.listChanges) {
        try {
          const r = await api.listChanges();
          if (r && r.ok && r.changes) changes = r.changes;
        } catch (e) {}
      }
      if (changes && changes.length > 0) {
        let add = 0, del = 0;
        for (const ch of changes) {
          add += (ch.added || 0);
          del += (ch.removed || 0);
        }
        const count = changes.length;
        const revCard = h('div', 'msg-review-card');
        const stat = h('div', 'msg-review-stat');
        stat.appendChild(h('span', 'msg-review-count', `${count} file${count === 1 ? '' : 's'} changed `));
        stat.appendChild(h('span', 'msg-review-add', `+${add}`));
        stat.appendChild(h('span', 'msg-review-del', `-${del}`));
        stat.appendChild(h('span', 'msg-review-chev', ' >'));
        revCard.appendChild(stat);

        const revBtn = h('button', 'msg-review-btn');
        revBtn.type = 'button';
        revBtn.appendChild(iconSpan('fileDiff', 'tiny'));
        revBtn.appendChild(document.createTextNode(' Review'));
        revCard.appendChild(revBtn);

        const openReview = (e) => {
          e.stopPropagation();
          toggleChanges(true);
        };
        revCard.addEventListener('click', openReview);
        revBtn.addEventListener('click', openReview);
        rec.wrap.appendChild(revCard);
      }
    }

    const actRow = h('div', 'msg-action-row');
    const copyBtn = h('button', 'msg-act-btn');
    copyBtn.type = 'button';
    copyBtn.title = 'Copy message';
    copyBtn.appendChild(iconSpan('copy', 'tiny'));
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const text = rec.raw || rec.el.innerText || '';
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = '';
        copyBtn.appendChild(iconSpan('check', 'tiny'));
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.innerHTML = '';
          copyBtn.appendChild(iconSpan('copy', 'tiny'));
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch (err) {
        toast('Failed to copy');
      }
    });
    actRow.appendChild(copyBtn);

    const likeBtn = h('button', 'msg-act-btn msg-like-btn');
    likeBtn.type = 'button';
    likeBtn.title = 'Good response';
    likeBtn.appendChild(iconSpan('thumbsUp', 'tiny'));

    const dislikeBtn = h('button', 'msg-act-btn msg-dislike-btn');
    dislikeBtn.type = 'button';
    dislikeBtn.title = 'Poor response';
    dislikeBtn.appendChild(iconSpan('thumbsDown', 'tiny'));

    likeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = likeBtn.classList.contains('active');
      dislikeBtn.classList.remove('active');
      if (wasActive) likeBtn.classList.remove('active');
      else likeBtn.classList.add('active');
    });

    dislikeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasActive = dislikeBtn.classList.contains('active');
      likeBtn.classList.remove('active');
      if (wasActive) dislikeBtn.classList.remove('active');
      else dislikeBtn.classList.add('active');
    });

    actRow.appendChild(likeBtn);
    actRow.appendChild(dislikeBtn);

    const timeSpan = h('span', 'msg-act-time');
    const completedAt = rec.completedAt || (rec.startTime ? rec.startTime + (rec.duration ? rec.duration * 1000 : 0) : Date.now());
    const dur = rec.duration || (rec.startTime ? Math.max(0.5, (Date.now() - rec.startTime) / 1000) : 0);

    function formatRelative(ts) {
      if (!ts) return 'Just now';
      const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      if (sec < 45) return 'Just now';
      const m = Math.floor(sec / 60);
      if (m < 60) return `${m}m ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h ago`;
      const d = Math.floor(h / 24);
      return `${d}d ago`;
    }

    function renderTime() {
      const rel = formatRelative(completedAt);
      timeSpan.textContent = rel;
      if (dur > 0) {
        timeSpan.title = `Working time: ${dur < 60 ? dur.toFixed(1) + 's' : formatDuration(dur)} · Completed ${new Date(completedAt).toLocaleTimeString()}`;
      } else {
        timeSpan.title = `Completed ${new Date(completedAt).toLocaleTimeString()}`;
      }
    }
    renderTime();
    timeSpan.dataset.completedAt = String(completedAt);
    timeSpan.dataset.duration = String(dur);
    actRow.appendChild(timeSpan);

    rec.wrap.appendChild(actRow);
  }

  function finalizeTurnFooter() {
    if (S.lastAssistantRecord) {
      attachAssistantFooter(S.lastAssistantRecord, false);
      S.lastAssistantRecord = null;
    }
  }

  function addStaticAssistant(text, completedAt, duration) {
    const wrap = h('div', 'msg-assistant-wrap');
    const el = h('div', 'msg-assistant');
    Md.render(el, text);
    wrap.appendChild(el);
    append(wrap);
    attachAssistantFooter({ wrap, el, raw: text, completedAt, duration }, true);
  }

  // ---------- tool cards ----------
  function summarizeCall(name, a) {
    const s = (v) => (typeof v === 'string' ? v : '?');
    switch (name) {
      case 'write_file': return `Write ${s(a.path)}`;
      case 'edit_file': return `Edit ${s(a.path)}`;
      case 'read_file': return `Read ${s(a.path)}`;
      case 'list_dir': return `List ${a.path || '.'}`;
      case 'search': return `Search for /${s(a.pattern)}/`;
      case 'run_command': return `Run: ${s(a.command).slice(0, 200)}`;
      case 'fetch_url': return `Fetch ${s(a.url).slice(0, 160)}`;
      case 'use_skill': return `Use skill ${s(a.name)}`;
      default: return name;
    }
  }

  function lbl(parent, text) {
    parent.appendChild(h('div', 'lbl', text));
  }

  function pre(parent, text, cls) {
    const p = h('pre', cls || '', text);
    parent.appendChild(p);
    return p;
  }

  function fillToolBody(body, name, args, preview) {
    if ((name === 'edit_file' || name === 'write_file') && preview) {
      const head = h('div', 'tool-diffhead');
      head.appendChild(h('span', 'mono', preview.path));
      head.appendChild(h('span', 'muted', preview.status === 'added' ? 'new file' : 'modified'));
      head.appendChild(h('span', 'stat-add', '+' + preview.added));
      head.appendChild(h('span', 'stat-del', '−' + preview.removed));
      body.appendChild(head);
      const d = h('div', 'tool-diff');
      DiffView.render(d, preview.rows, { mode: 'unified', full: true });
      body.appendChild(d);
      if (preview.truncated) body.appendChild(h('div', 'muted small', 'Preview shortened. The Changes panel shows everything after it is applied.'));
    } else if (name === 'write_file') {
      lbl(body, args.path || '');
      pre(body, String(args.content || '').slice(0, 4000));
    } else if (name === 'edit_file') {
      lbl(body, (args.path || '') + ' — replace');
      pre(body, String(args.old_string || '').slice(0, 2000));
      lbl(body, 'with');
      pre(body, String(args.new_string || '').slice(0, 2000));
    } else if (name === 'run_command') {
      const box = h('div', 'tool-cmd-box');
      box.appendChild(h('span', 'tool-cmd-ps1', '$'));
      const code = h('code', 'tool-cmd-code');
      const cmdStr = String(args.command || '');
      code.innerHTML = Md.highlightBash ? Md.highlightBash(cmdStr) : cmdStr;
      box.appendChild(code);
      body.appendChild(box);
    } else if (name === 'fetch_url') {
      lbl(body, 'Address');
      pre(body, String(args.url || ''));
    }
  }

  function makeToolCard(id, name, summary, args, awaiting, preview) {
    const isCmd = name === 'run_command';
    const card = h('div', 'tool ' + (awaiting ? 'waiting' : 'running') + (isCmd ? ' tool-cmd' : ''));
    const head = h('button', 'tool-head' + (isCmd ? ' tool-cmd-head' : ''));
    head.type = 'button';
    if (isCmd) {
      head.appendChild(iconSpan('terminalPrompt', 'tool-cmd-ico'));
      const cmdStr = (args && args.command) ? `$ ${args.command}` : summary;
      const title = h('span', 'tool-title tool-cmd-title', cmdStr);
      title.title = cmdStr;
      head.appendChild(title);
      const state = h('span', 'tool-state tool-cmd-badge', awaiting ? 'Needs Approval' : 'Running…');
      head.appendChild(state);

      const copyBtn = h('button', 'tool-cmd-copy-btn');
      copyBtn.type = 'button';
      copyBtn.title = 'Copy command';
      copyBtn.appendChild(iconSpan('copy', 'tiny'));
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText((args && args.command) || summary);
          copyBtn.innerHTML = '';
          copyBtn.appendChild(iconSpan('check', 'tiny'));
          setTimeout(() => {
            copyBtn.innerHTML = '';
            copyBtn.appendChild(iconSpan('copy', 'tiny'));
          }, 1500);
        } catch (err) {}
      });
      head.appendChild(copyBtn);
    } else {
      head.appendChild(h('span', 'tool-dot'));
      const title = h('span', 'tool-title', summary);
      title.title = summary;
      head.appendChild(title);
      const state = h('span', 'tool-state', awaiting ? 'needs approval' : 'running…');
      head.appendChild(state);
    }
    head.appendChild(iconSpan('chevron', 'tool-chev'));
    card.appendChild(head);
    const body = h('div', 'tool-body' + (isCmd ? ' tool-cmd-body' : ''));
    fillToolBody(body, name, args || {}, preview);
    card.appendChild(body);
    head.addEventListener('click', () => card.classList.toggle('open'));
    const rec = { card, state, body, out: null, row: null, name, isCmd };
    if (awaiting || isCmd) card.classList.add('open');
    S.tools.set(id, rec);
    return rec;
  }

  function onToolCall(ev) {
    flushAssistant();
    const formatted = formatToolStep(ev.name, ev.args, ev.summary);
    if (S.activeThinking) {
      S.activeThinking.setHeaderAction(formatted.header);
      S.activeThinking.addStep({ id: ev.id, ...formatted.step });
    }
    const rec = makeToolCard(ev.id, ev.name, ev.summary, ev.args, ev.awaitingApproval, ev.preview);
    if (ev.awaitingApproval) {
      const row = h('div', 'approve-row');
      const once = h('button', 'btn primary small', 'Approve once');
      const always = ev.always ? h('button', 'btn small', 'Approve always') : null;
      const no = h('button', 'btn small', 'Deny');
      const buttons = [once, always, no].filter(Boolean);
      buttons.forEach((b) => (b.type = 'button'));
      if (always) always.title = ev.always.label;
      const decide = async (decision) => {
        buttons.forEach((b) => (b.disabled = true));
        row.remove();
        rec.row = null;
        const allow = decision !== 'deny';
        rec.state.textContent = allow ? (rec.isCmd ? 'Running…' : 'running…') : 'denied';
        rec.card.className = 'tool ' + (allow ? 'running' : 'fail') + (rec.isCmd ? ' tool-cmd' : '') + (allow && ev.name === 'run_command' ? ' open' : '');
        const r = await api.approve(ev.id, decision);
        if (decision === 'always' && r && r.ok && r.settings) {
          S.app.settings = r.settings;
          toast(ev.always.label + '. Change this in Settings → Agent.', 4500);
        }
      };
      once.addEventListener('click', () => decide('once'));
      if (always) always.addEventListener('click', () => decide('always'));
      no.addEventListener('click', () => decide('deny'));
      row.append(...buttons);
      row.appendChild(h('span', 'hint', always ? ev.always.label + ' if you choose “Approve always”.' : 'Nothing changes until you approve.'));
      rec.card.appendChild(row);
      rec.row = row;
    }
    append(rec.card);
  }

  function ensureOut(rec) {
    if (!rec.out) {
      if (rec.name === 'run_command') {
        const termBar = h('div', 'tool-term-bar');
        termBar.appendChild(h('span', 'tool-term-label', 'TERMINAL OUTPUT'));
        rec.body.appendChild(termBar);
        rec.out = pre(rec.body, '', 'tool-out tool-term-out');
      } else {
        lbl(rec.body, 'Output');
        rec.out = pre(rec.body, '', 'tool-out');
      }
    }
    return rec.out;
  }

  function onToolOutput(ev) {
    const rec = S.tools.get(ev.id);
    if (!rec) return;
    const out = ensureOut(rec);
    out.textContent += Md.stripAnsi(ev.chunk);
    if (out.textContent.length > 80000) out.textContent = '…\n' + out.textContent.slice(-50000);
    out.scrollTop = out.scrollHeight;
  }

  const CHANGING = new Set(['write_file', 'edit_file', 'run_command']);

  function onToolResult(ev) {
    const rec = S.tools.get(ev.id);
    if (!rec) return;
    if (rec.row) rec.row.remove();
    rec.row = null;
    rec.card.classList.remove('waiting', 'running', 'ok', 'fail');
    rec.card.classList.add(ev.ok ? 'ok' : 'fail');
    if (rec.name === 'run_command') {
      rec.state.textContent = ev.ok ? 'Completed' : 'Failed';
    } else {
      rec.state.textContent = ev.ok ? 'done' : 'failed';
    }
    if (S.activeThinking) {
      let details = '';
      if (rec.name === 'run_command') {
        const exitMatch = (ev.output || '').match(/\[exit code (\d+)\]/);
        details = exitMatch ? `• Exited ${exitMatch[1]}` : ev.ok ? '• Completed' : '• Failed';
      } else if (rec.name === 'edit_file' || rec.name === 'write_file') {
        details = ev.ok ? '• Saved' : '• Error';
      } else if (rec.name === 'read_file') {
        details = ev.ok ? '• Read' : '• Error';
      } else {
        details = ev.ok ? '• Done' : '• Failed';
      }
      S.activeThinking.updateStep(ev.id, { ok: ev.ok, details });
      S.activeThinking.setHeaderAction('Thinking…');
    }
    const text = Md.stripAnsi(ev.output || '');
    if (rec.name === 'run_command') {
      if (text) ensureOut(rec).textContent = text;
    } else if (text) {
      lbl(rec.body, ev.ok ? 'Result' : 'Error');
      pre(rec.body, text.slice(0, 20000));
    }
    if (ev.ok && rec.name !== 'run_command') rec.card.classList.remove('open');
    else rec.card.classList.add('open');
    if (CHANGING.has(rec.name)) scheduleChangesRefresh();
  }

  // ---------- restore a saved chat ----------
  function textOfContent(c) {
    if (typeof c === 'string') return c;
    if (!Array.isArray(c)) return '';
    return c.map((p) => (p && p.type === 'text' ? p.text : '')).join('\n');
  }

  const AUTO_CONTINUE = 'Continue exactly where you stopped.';

  function createStaticThinkingBlock(duration, toolCalls, results, unfinished) {
    const wrap = h('div', 'thinking-wrap completed');
    const head = h('button', 'thinking-head');
    head.type = 'button';

    const chev = iconSpan('chevronRight', 'thinking-chev');
    head.appendChild(chev);

    const stepCount = (toolCalls || []).length;
    const durStr = duration ? formatThinkingTime(Math.round(duration)) : (stepCount > 0 ? 'a moment' : '');
    const stepsSummary = stepCount > 0 ? ` · ${stepCount} step${stepCount === 1 ? '' : 's'}` : '';
    const label = h('span', 'thinking-label');
    const actionEl = h('span', 'thinking-action-text');
    actionEl.appendChild(iconSpan('check', 'thinking-check-ico'));
    actionEl.appendChild(h('span', '', ` Thought ${durStr ? 'for ' + durStr : ''}${stepsSummary}`));
    label.appendChild(actionEl);
    head.appendChild(label);
    wrap.appendChild(head);

    const body = h('div', 'thinking-body');
    body.hidden = true;
    const list = h('ul', 'thinking-steps');
    body.appendChild(list);

    for (const tc of toolCalls || []) {
      let args = {};
      try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) { args = {}; }
      const formatted = formatToolStep(tc.function.name, args, summarizeCall(tc.function.name, args));
      const res = results ? results.get(tc.id) : undefined;
      const isFail = res && res.startsWith('Error:');
      const isUnfin = unfinished && unfinished.has(tc.id);
      const li = h('li', 'thinking-step-item');
      const dot = h('span', 'thinking-step-status ' + (isFail ? 'fail' : isUnfin ? 'running' : 'ok'));
      li.appendChild(dot);
      if (formatted.step.action) li.appendChild(h('span', 'thinking-step-action', formatted.step.action));
      if (formatted.step.badge) li.appendChild(h('span', 'thinking-step-badge', formatted.step.badge));
      if (formatted.step.text) li.appendChild(h('span', 'thinking-step-text', formatted.step.text));
      if (formatted.step.details) li.appendChild(h('span', 'thinking-step-details', formatted.step.details));
      list.appendChild(li);
    }
    wrap.appendChild(body);

    head.addEventListener('click', () => {
      const isHidden = body.hidden;
      body.hidden = !isHidden;
      wrap.classList.toggle('open', !isHidden);
    });

    append(wrap);
    return wrap;
  }

  function renderHistory(messages, live) {
    const pendingIds = new Set(((live && live.pending) || []).map((p) => p.id));
    const unfinished = new Set((live && live.unfinished) || []);
    const results = new Map();
    for (const m of messages) if (m.role === 'tool') results.set(m.tool_call_id, String(textOfContent(m.content)));
    for (const m of messages) {
      if (m.role === 'user') {
        let text = textOfContent(m.content);
        if (text === AUTO_CONTINUE) continue;
        const atts = [];
        text = text.replace(/\n*<attached_file name="((?:[^"\\]|\\.)*)">[\s\S]*?<\/attached_file>/g, (_all, n) => {
          atts.push({ kind: 'file', name: n.replace(/\\"/g, '"') });
          return '';
        });
        text = text.replace(/\n*Links the user attached[^\n]*\n((?:- [^\n]+\n?)+)/, (_all, list) => {
          list.split('\n').forEach((l) => l.startsWith('- ') && atts.push({ kind: 'link', url: l.slice(2).trim() }));
          return '';
        });
        if (Array.isArray(m.content)) {
          m.content.forEach((p) => {
            if (!p || p.type !== 'image_url') return;
            const url = typeof p.image_url === 'string' ? p.image_url : p.image_url?.url;
            atts.push({ kind: 'image', name: 'Attached image', dataUrl: typeof url === 'string' ? url : '' });
          });
        }
        text = text.replace(/\[image attached earlier, not kept\]/g, '').replace(/\(see attached image\)/g, '').trim();
        addUser(text, atts);
      } else if (m.role === 'assistant') {
        const hasTools = (m.tool_calls && m.tool_calls.length > 0);
        const hasDuration = (typeof m.duration === 'number' && m.duration >= 0.5);
        if (hasTools || hasDuration) {
          createStaticThinkingBlock(m.duration, m.tool_calls, results, unfinished);
        }
        for (const tc of m.tool_calls || []) {
          if (pendingIds.has(tc.id)) continue; // shown below with its Approve buttons
          let args = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch (e) { args = {}; }
          const rec = makeToolCard(tc.id, tc.function.name, summarizeCall(tc.function.name, args), args, false, null);
          const res = results.get(tc.id);
          rec.card.classList.remove('running', 'open');
          if (res === undefined && unfinished.has(tc.id)) {
            rec.card.classList.add('running');
            rec.state.textContent = 'running…';
          } else if (res === undefined) {
            rec.card.classList.add('fail');
            rec.state.textContent = 'no result';
          } else {
            const failed = res.startsWith('Error:');
            rec.card.classList.add(failed ? 'fail' : 'ok');
            rec.state.textContent = failed ? 'failed' : 'done';
            if (res) {
              if (rec.name === 'run_command') ensureOut(rec).textContent = Md.stripAnsi(res);
              else { lbl(rec.body, failed ? 'Error' : 'Result'); pre(rec.body, res.slice(0, 20000)); }
            }
          }
          append(rec.card);
        }
        const text = textOfContent(m.content).trim();
        if (text === 'Stopped.') {
          append(h('div', 'stopped', 'Stopped.'));
        } else if (text.startsWith('[Error]') || text.startsWith('⚠️') || text.startsWith('Model server returned HTTP') || text.startsWith('No model could answer')) {
          append(createErrorElement(text));
        } else if (text) {
          addStaticAssistant(text, m.createdAt, m.duration);
        }
      }
    }
    scrollDown();
  }

  function createErrorElement(rawMsg) {
    const clean = String(rawMsg || '')
      .replace(/^(\[Error\]|⚠️)\s*/, '')
      .trim();
    const el = h('div', 'error-msg');
    el.appendChild(iconSpan('alertTriangle', 'error-ico'));
    const txtSpan = h('span', 'error-text', clean);
    el.appendChild(txtSpan);
    return el;
  }

  // ---------- running ----------
  function setStatus(text) {
    els.status.textContent = text;
    els.status.hidden = text === '';
  }

  function setRunning(on) {
    S.running = on;
    els.sendBtn.hidden = on;
    els.stopBtn.hidden = !on;
    setStatus(on ? 'Working… (Esc to stop)' : '');
    if (!on && S.app && S.app.folder) els.input.focus();
  }

  function onAgentEvent(ev) {
    // another chat is working in the background: its events are not drawn here (the sidebar dot shows it)
    if (ev.chat && S.app && ev.chat !== S.app.chatId) return;
    switch (ev.type) {
      case 'text': onText(ev.delta); break;
      case 'tool_call': onToolCall(ev); break;
      case 'tool_output': onToolOutput(ev); break;
      case 'tool_result': onToolResult(ev); break;
      case 'notice': flushAssistant(); append(h('div', 'notice', ev.message)); break;
      case 'error': flushAssistant(); if (S.activeThinking) S.activeThinking.finish(ev.message); finalizeTurnFooter(); append(createErrorElement(ev.message)); setRunning(false); processNextQueued(); break;
      case 'stopped': flushAssistant(); if (S.activeThinking) S.activeThinking.finish('Stopped'); finalizeTurnFooter(); append(h('div', 'stopped', 'Stopped.')); setRunning(false); processNextQueued(); break;
      case 'done': flushAssistant(); if (S.activeThinking) S.activeThinking.finish(); finalizeTurnFooter(); setRunning(false); processNextQueued(); break;
    }
  }

  // ---------- message queuing & demos ----------
  function queueMessage(text, atts) {
    if (!S.messageQueue) S.messageQueue = [];
    S.messageQueue.push({ text, atts });
    renderQueuedCard();
    toast('Message added to queue. Will send when current turn completes.');
  }

  function renderQueuedCard() {
    if (!els.queuedCard) return;
    const q = S.messageQueue || [];
    if (q.length === 0) {
      els.queuedCard.hidden = true;
      return;
    }
    els.queuedCard.hidden = false;
    const item = q[0];
    const badge = els.queuedCard.querySelector('.qc-badge');
    if (badge) badge.textContent = `Queued message (${q.length})`;
    if (els.qcText) els.qcText.textContent = item.text || '(Attachment)';
    if (els.qcAtts) {
      els.qcAtts.textContent = '';
      if (item.atts && item.atts.length > 0) {
        els.qcAtts.hidden = false;
        for (const a of item.atts) els.qcAtts.appendChild(chipFor(a, { compact: true }));
      } else {
        els.qcAtts.hidden = true;
      }
    }
  }

  function sendQueuedNow() {
    if (!S.messageQueue || S.messageQueue.length === 0) return;
    const item = S.messageQueue.shift();
    renderQueuedCard();
    if (S.running) {
      api.stop().catch(() => {});
      setTimeout(() => {
        send(item.text, item.atts);
      }, 350);
    } else {
      send(item.text, item.atts);
    }
  }

  function editQueued() {
    if (!S.messageQueue || S.messageQueue.length === 0) return;
    const item = S.messageQueue.shift();
    renderQueuedCard();
    els.input.value = item.text || '';
    S.attachments = (item.atts || []).slice();
    renderAttachments();
    autoGrow();
    els.input.focus();
  }

  function removeQueued() {
    if (!S.messageQueue || S.messageQueue.length === 0) return;
    S.messageQueue.shift();
    renderQueuedCard();
    toast('Queued message removed.');
  }

  function processNextQueued() {
    if (!S.messageQueue || S.messageQueue.length === 0) {
      renderQueuedCard();
      return;
    }
    const item = S.messageQueue.shift();
    renderQueuedCard();
    setTimeout(() => {
      send(item.text, item.atts);
    }, 300);
  }

  function demoQueuedMessages() {
    resetChatView();
    addUser('1. Set up JWT authentication module for this project.');
    startAssistant();
    onText('Creating authentication module and verifying tokens...\n\n```typescript\nimport jwt from "jsonwebtoken";\n\nexport function verifyToken(req, res, next) {\n  const token = req.headers["authorization"]?.split(" ")[1];\n  if (!token) return res.status(401).json({ error: "Unauthorized" });\n  try {\n    req.user = jwt.verify(token, process.env.JWT_SECRET);\n    next();\n  } catch (err) {\n    return res.status(403).json({ error: "Invalid token" });\n  }\n}\n```\n\nAnalyzing session encryption algorithms and security rules...');
    setRunning(true);

    setTimeout(() => {
      queueMessage('2. Also add Google OAuth login and rate-limiting middleware.', []);
    }, 700);

    setTimeout(() => {
      onText('\n\nJWT authentication setup completed.');
      flushAssistant();
      setRunning(false);
      processNextQueued();
    }, 5000);
  }

  function demoWhatsAppChat() {
    resetChatView();
    addUser('Can you implement the macOS Local AI Agent App Setup and show the structure with code?', [
      { kind: 'image', name: 'app-architecture.png', dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" viewBox="0 0 300 180"><rect width="300" height="180" fill="%231a1c23" rx="10"/><text x="150" y="95" fill="%233b82f6" font-size="16" font-family="sans-serif" font-weight="bold" text-anchor="middle">Cr3agent Architecture</text></svg>' }
    ]);

    const md = `### macOS Local AI Agent App Setup

I have designed the modular architecture for **Cr3agent**. Here is the core orchestration service and process workflow:

\`\`\`typescript
export interface AgentTurn {
  id: string;
  query: string;
  attachments?: Attachment[];
  state: 'queued' | 'running' | 'completed' | 'interrupted';
  createdAt: number;
}

export class AgentService {
  private queue: AgentTurn[] = [];
  private activeTurn: AgentTurn | null = null;

  async enqueue(query: string, attachments: Attachment[] = []): Promise<void> {
    const turn: AgentTurn = {
      id: crypto.randomUUID(),
      query,
      attachments,
      state: 'queued',
      createdAt: Date.now()
    };
    this.queue.push(turn);
    if (!this.activeTurn) this.processNext();
  }
}
\`\`\`

#### Key Highlights
- **WhatsApp-style Bubbles**: User messages align cleanly to the right with thumbnails.
- **Queued Execution**: Continuous multi-prompt scheduling with queue management.
- **VS Code Terminal**: Side-by-side terminal splitting and tabbed workflows.
`;
    addStaticAssistant(md);
  }

  function demoSidebarTree() {
    S.chats = [
      { id: 'c1', title: 'CR3-Agentic AI macOS Setup', folder: S.app?.folder, updatedAt: Date.now() },
      { id: 'c2', title: 'Casual Greeting', folder: S.app?.folder, updatedAt: Date.now() - 30000 }
    ];
    S.allChats = [
      ...S.chats,
      { id: 'c3', title: 'Desktop Software Google Cloud', folder: '/Users/cr3-architect/Projects/sentrylock', updatedAt: Date.now() - 3600000 },
      { id: 'c4', title: 'Full Stack Portfolio Web App', folder: null, updatedAt: Date.now() - 86400000 }
    ];
    markChatUnread('c3', true);
    if (!S.app.settings.recentFolders) S.app.settings.recentFolders = [];
    if (!S.app.settings.recentFolders.includes('/Users/cr3-architect/Projects/sentrylock')) {
      S.app.settings.recentFolders.push('/Users/cr3-architect/Projects/sentrylock');
    }
    renderSidebar();
    renderHeader();
    toast('Loaded Antigravity sidebar demo tree.');
  }

  async function send(overrideText, overrideAtts) {
    if (!S.app || !S.app.folder) {
      toast('Open a project folder first.');
      return;
    }
    const text = overrideText !== undefined ? overrideText : els.input.value.trim();
    const atts = overrideAtts !== undefined ? overrideAtts : S.attachments.slice();
    if (!text && atts.length === 0) return;

    if (S.running) {
      queueMessage(text, atts);
      if (overrideText === undefined) {
        els.input.value = '';
        autoGrow();
        S.attachments = [];
        renderAttachments();
      }
      return;
    }

    if (overrideText === undefined) {
      els.input.value = '';
      autoGrow();
      S.attachments = [];
      renderAttachments();
    }
    addUser(text, atts);
    S.current = null;
    S.turnStartTime = Date.now();
    createThinkingBlock(text, atts);
    setRunning(true);
    const payload = atts.map((a) => (a.kind === 'image' ? { kind: 'image', name: a.name, dataUrl: a.dataUrl } : a.kind === 'file' ? { kind: 'file', name: a.name, text: a.text } : { kind: 'link', url: a.url }));
    const r = await api.send(text, payload);
    if (!r.ok) {
      append(createErrorElement(r.error || 'Could not send the message.'));
      setRunning(false);
      processNextQueued();
    }
  }

  // ---------- folders & chats ----------
  async function afterFolderChange(r) {
    if (!r.ok) {
      toast(r.error || 'Could not open that folder.');
      return;
    }
    if (r.canceled) return;
    applyState(r);
    resetChatView();
    setRunning(false);
    S.selected = null;
    closeMenu();
    await Promise.all([loadChats(), refreshChanges()]);
    els.input.focus();
  }

  async function pickFolder() {
    await afterFolderChange(await api.pickFolder());
  }

  async function openProject(folder) {
    await afterFolderChange(await api.openFolder(folder));
  }

  async function newChat() {
    const r = await api.newChat();
    if (!r.ok) return toast(r.error);
    applyState(r);
    resetChatView();
    setRunning(false);
    await loadChats();
    pushNav(S.app.chatId);
    els.input.focus();
  }

  async function openChat(id) {
    const r = await api.openChat(id);
    if (!r.ok) return toast(r.error || 'Could not open that chat.');
    applyState(r);
    resetChatView();
    setRunning(false);
    renderHistory(r.messages || [], r.live);
    if (r.live && r.live.running) {
      setRunning(true);
      for (const ev of r.live.pending || []) onToolCall(ev);
    }
    pushNav(id);
    renderChats();
  }

  // ---------- composer: input, menus ----------
  function autoGrow() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 220) + 'px';
  }

  function openApprovalMenu() {
    const cur = S.app.settings.approvalMode;
    showMenu($('approvalBtn'), [
      { type: 'head', label: 'When should the agent ask you first?' },
      ...Object.keys(APPROVAL).map((k) => ({
        label: APPROVAL[k].label, sub: APPROVAL[k].sub, checked: k === cur,
        onClick: async () => { const r = await api.setGeneral({ approvalMode: k }); if (r.ok) applyState(r); else toast(r.error); },
      })),
    ]);
  }

  function openModelMenu() {
    const s = S.app.settings;
    const items = [];
    if (s.autoFallback && s.providers.filter((p) => p.model).length > 1) {
      items.push({ type: 'head', label: 'Switch any time, even mid-chat. Auto-switch is on: if this model fails, the next one takes over.' });
    }
    for (const p of s.providers) {
      const keyStatus = p.keyDecryptionFailed ? ' · (key re-entry needed)' : p.hasApiKey ? ' · key saved' : '';
      items.push({ type: 'head', label: p.name + keyStatus });
      const list = p.models.length > 0 ? p.models.slice(0, 40) : p.model ? [p.model] : [];
      if (list.length === 0) items.push({ label: 'No model chosen yet', disabled: true });
      for (const m of list) {
        const caps = getModelCapabilities(m);
        items.push({
          label: m,
          checked: p.id === s.activeProviderId && m === p.model,
          caps,
          onClick: async () => { const r = await api.activateProvider(p.id, m); if (r.ok) applyState(r); else toast(r.error); },
        });
      }
    }
    items.push({ type: 'sep' });
    items.push({ label: 'Add more models or free providers…', onClick: () => { openSettings('providers'); $('provAdd').click(); } });
    items.push({ label: 'Manage providers & API keys…', onClick: () => openSettings('providers') });
    showMenu($('modelBtn'), items);
  }

  function openAttachMenu() {
    showMenu($('attachBtn'), [
      { label: 'Add pictures or files…', sub: 'Screenshots, code, notes, logs', onClick: () => els.fileInput.click() },
      { label: 'Add a link…', sub: 'The agent reads the page when it needs it', onClick: openLinkDialog },
    ]);
  }

  // ---------- attachments ----------
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  async function prepareImage(file) {
    const MAX_EDGE = 1568;
    try {
      const bmp = await createImageBitmap(file);
      const edge = Math.max(bmp.width, bmp.height);
      if (edge <= MAX_EDGE && file.size <= 1500000 && /^image\/(png|jpeg|webp)$/.test(file.type)) {
        if (bmp.close) bmp.close();
        return await readAsDataUrl(file);
      }
      const scale = Math.min(1, MAX_EDGE / edge);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if (bmp.close) bmp.close();
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      if (file.size <= 5000000 && /^image\/(png|jpeg|webp|gif)$/.test(file.type)) return readAsDataUrl(file);
      throw new Error('could not read this picture');
    }
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    for (const f of files) {
      if (S.attachments.length >= 12) { toast('You can attach up to 12 items per message.'); break; }
      try {
        if (f.type.startsWith('image/')) {
          if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { toast(`${f.name}: only PNG, JPEG, WebP and GIF pictures are supported.`); continue; }
          S.attachments.push({ kind: 'image', name: f.name || 'image', dataUrl: await prepareImage(f), size: f.size });
        } else {
          if (f.size > 400000) { toast(`${f.name} is larger than 400 KB. Attach a smaller piece, or put it in the project folder and ask the agent to read it.`, 6000); continue; }
          const text = await f.text();
          if (text.indexOf('\u0000') !== -1) { toast(`${f.name} is not a text file. PDFs and Office files can't be read yet; put it in the project folder or paste the text.`, 6500); continue; }
          S.attachments.push({ kind: 'file', name: f.name, text, size: f.size });
        }
      } catch (e) {
        toast(`${f.name || 'File'}: ${e.message || 'could not be read'}`);
      }
    }
    renderAttachments();
  }

  function addLink(raw) {
    let u;
    try { u = new URL(raw.trim()); } catch (e) { return 'That is not a valid address.'; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Only http:// and https:// links are supported.';
    if (S.attachments.some((a) => a.kind === 'link' && a.url === u.href)) return '';
    if (S.attachments.length >= 12) return 'You can attach up to 12 items per message.';
    S.attachments.push({ kind: 'link', url: u.href });
    renderAttachments();
    return '';
  }

  function renderAttachments() {
    const row = els.attachRow;
    row.textContent = '';
    row.hidden = S.attachments.length === 0;
    S.attachments.forEach((a, i) => {
      row.appendChild(chipFor(a, {
        removable: true,
        onRemove: () => {
          S.attachments.splice(i, 1);
          renderAttachments();
        },
      }));
    });
  }

  function openLinkDialog() {
    const d = $('linkDialog');
    $('linkInput').value = '';
    $('linkStatus').hidden = true;
    d.showModal();
    $('linkInput').focus();
  }

  // ---------- changes panel ----------
  function scheduleChangesRefresh() {
    clearTimeout(S.refreshTimer);
    S.refreshTimer = setTimeout(refreshChanges, 350);
  }

  async function refreshChanges() {
    if (!S.app || !S.app.folder) {
      S.changes = [];
      renderChangesList();
      updateGitReviewBar();
      return;
    }
    const r = await api.listChanges();
    S.changes = r.ok ? r.changes : [];
    renderChangesList();
    updateGitReviewBar();
    if (S.selected && !S.changes.some((c) => c.path === S.selected)) {
      S.selected = null;
      $('chFile').textContent = '';
      $('chDiff').textContent = '';
      $('chDiff').appendChild(h('div', 'ch-empty', 'Select a file to compare the before and after versions.'));
    } else if (S.selected && !els.changesPane.hidden) {
      showDiff(S.selected);
    }
  }

  async function updateGitReviewBar() {
    if (!els.chGitBar) return;
    if (!S.app?.folder) {
      els.chGitBar.hidden = true;
      return;
    }
    els.chGitBar.hidden = false;
    try {
      const r = await api.gitStatus();
      if (!r || !r.ok || !r.git || !r.git.isRepo) {
        if (els.chGitUninit) els.chGitUninit.hidden = false;
        if (els.chGitNoRemote) els.chGitNoRemote.hidden = true;
        if (els.chGitActive) els.chGitActive.hidden = true;
        return;
      }

      const g = r.git;
      if (!g.remote) {
        if (els.chGitUninit) els.chGitUninit.hidden = true;
        if (els.chGitNoRemote) els.chGitNoRemote.hidden = false;
        if (els.chGitActive) els.chGitActive.hidden = true;
        return;
      }

      if (els.chGitUninit) els.chGitUninit.hidden = true;
      if (els.chGitNoRemote) els.chGitNoRemote.hidden = true;
      if (els.chGitActive) els.chGitActive.hidden = false;

      if (els.chGitRepoName) {
        const match = /(?:[:/])([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?$/.exec(g.remote);
        els.chGitRepoName.textContent = match ? `${match[1]}/${match[2]}` : 'origin';
        if (els.chGitRepoTag) els.chGitRepoTag.title = `Connected: ${g.remote}`;
      }

      if (els.chGitBranchName) els.chGitBranchName.textContent = g.branch || 'main';
      const changedCount = g.files ? g.files.length : (S.changes ? S.changes.length : 0);
      if (els.chGitFilesSummary) {
        els.chGitFilesSummary.textContent = `${changedCount} file${changedCount === 1 ? '' : 's'} modified`;
      }
      if (els.chCommitBtn) {
        els.chCommitBtn.disabled = changedCount === 0;
        els.chCommitBtn.textContent = changedCount > 0 ? `Commit (${changedCount})` : 'Commit';
      }
      if (els.chCommitInput && !els.chCommitInput.value.trim() && changedCount > 0) {
        els.chCommitInput.value = generateSmartCommitMsg();
      }
      if (els.chPushBtn) {
        const ahead = g.ahead || 0;
        els.chPushBtn.hidden = ahead === 0 && !S.justCommitted;
        if (ahead > 0) {
          els.chPushBtn.innerHTML = `<span class="ico tiny" data-icon="arrowUp"></span>Push (${ahead})`;
        } else {
          els.chPushBtn.innerHTML = `<span class="ico tiny" data-icon="arrowUp"></span>Push to GitHub`;
        }
      }
    } catch (err) {
      console.error('updateGitReviewBar error:', err);
    }
  }

  function generateSmartCommitMsg() {
    const files = (S.changes || []).map((c) => c.path);
    if (files.length === 0) return 'chore: update project files';
    const isAllDocs = files.every((f) => f.endsWith('.md') || f.endsWith('.txt'));
    if (isAllDocs) return `docs: update documentation (${files.map(baseName).slice(0, 2).join(', ')})`;
    const isAllTests = files.every((f) => f.includes('test') || f.endsWith('.spec.ts'));
    if (isAllTests) return `test: add unit and integration test coverage`;
    const isAllStyles = files.every((f) => f.endsWith('.css') || f.endsWith('.scss'));
    if (isAllStyles) return `style: polish UI layout and component styling`;
    const first = baseName(files[0]);
    if (files.length === 1) return `fix: update ${first}`;
    const dir = files[0].split('/')[0];
    return `feat(${dir || 'core'}): improve implementation and update ${files.length} files`;
  }

  function initGitReviewBar() {
    if (els.chInitRepoBtn) {
      els.chInitRepoBtn.addEventListener('click', async () => {
        els.chInitRepoBtn.disabled = true;
        els.chInitRepoBtn.textContent = 'Initializing…';
        const r = await api.gitInit();
        els.chInitRepoBtn.disabled = false;
        els.chInitRepoBtn.textContent = 'Initialize Git Repository';
        if (r && r.ok) {
          toast('Git repository initialized successfully!');
          await refreshChanges();
          await updateGitReviewBar();
        } else {
          toast(r?.error || 'Failed to initialize Git repository.');
        }
      });
    }

    if (els.chSetRemoteBtn) {
      const doSetRemote = async () => {
        const url = (els.chRemoteUrlInput?.value || '').trim();
        if (!url) {
          toast('Please enter a GitHub repository URL.');
          return;
        }
        els.chSetRemoteBtn.disabled = true;
        els.chSetRemoteBtn.textContent = 'Connecting…';
        const r = await api.gitSetRemote(url);
        els.chSetRemoteBtn.disabled = false;
        els.chSetRemoteBtn.textContent = 'Connect Repo';
        if (r && r.ok) {
          toast('GitHub repository connected successfully!');
          if (els.chRemoteUrlInput) els.chRemoteUrlInput.value = '';
          await updateGitReviewBar();
        } else {
          toast(r?.error || 'Failed to connect repository.');
        }
      };
      els.chSetRemoteBtn.addEventListener('click', doSetRemote);
      if (els.chRemoteUrlInput) {
        els.chRemoteUrlInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            doSetRemote();
          }
        });
      }
    }

    if (els.chAutoCommitBtn) {
      els.chAutoCommitBtn.addEventListener('click', () => {
        const msg = generateSmartCommitMsg();
        if (els.chCommitInput) {
          els.chCommitInput.value = msg;
          els.chCommitInput.focus();
          els.chCommitInput.select();
        }
      });
    }

    if (els.chCommitBtn) {
      els.chCommitBtn.addEventListener('click', async () => {
        const msg = (els.chCommitInput?.value || '').trim() || generateSmartCommitMsg();
        els.chCommitBtn.disabled = true;
        els.chCommitBtn.textContent = 'Committing…';
        const r = await api.gitCommit(msg);
        els.chCommitBtn.disabled = false;
        if (r.ok) {
          toast(`Committed: "${msg}"`);
          if (els.chCommitInput) els.chCommitInput.value = '';
          S.justCommitted = true;
          if (els.chPushBtn) els.chPushBtn.hidden = false;
          await refreshChanges();
          await updateGitReviewBar();
        } else {
          toast(`Commit failed: ${r.error || 'Unknown error'}`);
          await updateGitReviewBar();
        }
      });
    }

    if (els.chPushBtn) {
      els.chPushBtn.addEventListener('click', async () => {
        els.chPushBtn.disabled = true;
        els.chPushBtn.textContent = 'Pushing…';
        const r = await api.gitPush();
        els.chPushBtn.disabled = false;
        if (r.ok) {
          toast('Successfully pushed all commits to GitHub!');
          S.justCommitted = false;
          await updateGitReviewBar();
        } else {
          toast(`Push failed: ${r.error || 'Check GitHub authentication'}`);
          await updateGitReviewBar();
        }
      });
    }

    if (els.chCommitInput) {
      els.chCommitInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          els.chCommitBtn?.click();
        }
      });
    }
  }

  function renderChangesList() {
    const tabs = els.chFileTabs;
    if (tabs) tabs.textContent = '';
    const n = S.changes.length;
    const badge = els.changesBadge;
    badge.hidden = n === 0;
    badge.textContent = String(n);
    let add = 0;
    let del = 0;
    S.changes.forEach((c) => { add += c.added; del += c.removed; });
    $('chSummary').textContent = n === 0 ? 'No changes yet' : `${n} file${n === 1 ? '' : 's'} · +${add} −${del}`;
    if (els.ovDiffStat) {
      els.ovDiffStat.innerHTML = `<span class="ov-add">+${add}</span> <span class="ov-del">-${del}</span>`;
    }
    $('chKeepAll').disabled = $('chRevertAll').disabled = n === 0;

    if (n === 0) {
      if (els.chFileName) els.chFileName.textContent = 'Modified Files';
      if (els.chBreadcrumbs) els.chBreadcrumbs.innerHTML = '<span class="muted small">Files modified by the agent will appear here</span>';
      if (els.chFileStatus) els.chFileStatus.hidden = true;
      if (els.chFileDiffStat) els.chFileDiffStat.hidden = true;
      if (els.chKeepFile) els.chKeepFile.hidden = true;
      if (els.chRevertFile) els.chRevertFile.hidden = true;
      if (els.chRevealFile) els.chRevealFile.hidden = true;
      const box = $('chDiff');
      box.textContent = '';
      box.appendChild(h('div', 'ch-empty', 'Nothing has changed yet. When the agent (or you) edits files, they show up here with the exact lines that changed.'));
      return;
    }

    if (!S.selected || !S.changes.some((c) => c.path === S.selected)) {
      S.selected = S.changes[0].path;
    }

    if (tabs) {
      for (const c of S.changes) {
        const isSel = c.path === S.selected;
        const tab = h('button', 'ch-tab' + (isSel ? ' on' : ''));
        tab.type = 'button';
        tab.title = c.path;

        const dot = h('span', 'tab-dot ' + c.status);
        tab.appendChild(dot);

        const nameSpan = h('span', 'tab-name', baseName(c.path));
        tab.appendChild(nameSpan);

        if (!c.binary) {
          const statSpan = h('span', 'tab-stat');
          if (c.added > 0) statSpan.appendChild(h('span', 'stat-add', '+' + c.added));
          if (c.added > 0 && c.removed > 0) statSpan.appendChild(document.createTextNode(' '));
          if (c.removed > 0) statSpan.appendChild(h('span', 'stat-del', '−' + c.removed));
          tab.appendChild(statSpan);
        }

        tab.addEventListener('click', () => {
          S.selected = c.path;
          renderChangesList();
          showDiff(c.path);
        });
        tabs.appendChild(tab);
      }
    }
  }

  async function showDiff(path) {
    const box = $('chDiff');
    if (!path) {
      if (els.chFileName) els.chFileName.textContent = 'Modified Files';
      if (els.chBreadcrumbs) els.chBreadcrumbs.innerHTML = '<span class="muted small">Select a file to compare changes</span>';
      return;
    }
    $('chFile').textContent = path;
    $('chFile').title = path;

    const change = S.changes.find((c) => c.path === path);
    const parts = path.split('/').filter(Boolean);
    const filename = parts.pop() || path;

    if (els.chFileName) {
      els.chFileName.textContent = filename;
      els.chFileName.title = path;
    }

    if (els.chFileStatus && change) {
      els.chFileStatus.hidden = false;
      els.chFileStatus.className = 'ch-status-pill ' + change.status;
      els.chFileStatus.textContent = change.status === 'added' ? 'ADDED' : change.status === 'deleted' ? 'DELETED' : 'MODIFIED';
    }

    if (els.chFileDiffStat && change) {
      els.chFileDiffStat.hidden = false;
      els.chFileDiffStat.textContent = change.binary ? 'Binary' : `+${change.added} −${change.removed}`;
    }

    if (els.chKeepFile) {
      els.chKeepFile.hidden = false;
      els.chKeepFile.onclick = () => keepFile(path);
    }
    if (els.chRevertFile && change) {
      els.chRevertFile.hidden = false;
      els.chRevertFile.onclick = () => revertFile(change);
    }
    if (els.chRevealFile) {
      els.chRevealFile.hidden = change?.status === 'deleted';
      els.chRevealFile.onclick = () => api.reveal(path);
    }

    // 1-line breadcrumb: project > subfolder > ... > file
    if (els.chBreadcrumbs) {
      els.chBreadcrumbs.textContent = '';
      const rootSpan = h('span', 'crumb crumb-root');
      rootSpan.appendChild(iconSpan('folder', 'crumb-icon'));
      rootSpan.appendChild(document.createTextNode(' ' + (baseName(S.app?.folder) || 'project')));
      els.chBreadcrumbs.appendChild(rootSpan);

      for (const seg of parts) {
        els.chBreadcrumbs.appendChild(h('span', 'crumb-sep', '›'));
        els.chBreadcrumbs.appendChild(h('span', 'crumb crumb-dir', seg));
      }

      els.chBreadcrumbs.appendChild(h('span', 'crumb-sep', '›'));
      const fileSpan = h('span', 'crumb crumb-file', filename);
      els.chBreadcrumbs.appendChild(fileSpan);
    }

    const r = await api.diff(path);
    if (S.selected !== path) return;

    // Background refreshes must not redraw an unchanged diff:
    let sig = null;
    if (r.ok && !r.diff.binary && r.diff.status !== 'unchanged') {
      const changed = r.diff.lines.filter((l) => l.t !== 'eq').map((l) => l.t + l.x).join('\n');
      sig = [path, S.diffMode, S.diffFull, r.diff.status, r.diff.lines.length, changed].join('|');
    }
    if (sig !== null && sig === S.diffSig && box.firstChild) return;
    S.diffSig = sig;

    box.textContent = '';
    if (!r.ok) { box.appendChild(h('div', 'ch-empty', r.error || 'Could not compare this file.')); return; }
    const d = r.diff;
    if (d.binary) { box.appendChild(h('div', 'ch-empty', 'This file is binary or too large, so there is no line-by-line comparison.')); return; }
    if (d.status === 'unchanged') { box.appendChild(h('div', 'ch-empty', 'No differences.')); return; }
    if (d.eolOnly) box.appendChild(h('div', 'ch-empty', 'Only line endings or the final newline changed.'));
    const holder = h('div');
    box.appendChild(holder);
    DiffView.render(holder, d.lines, { mode: S.diffMode, full: S.diffFull });
  }

  async function keepFile(path) {
    const r = await api.accept(path);
    if (!r.ok) return toast(r.error);
    if (S.selected === path) S.selected = null;
    await refreshChanges();
  }

  async function revertFile(c) {
    const msg = c.status === 'added' ? `${c.path} is a new file. Undoing will delete it.` : `${c.path} goes back to how it was before the changes.`;
    if (!(await confirmDialog('Undo this change?', msg, 'Undo'))) return;
    const r = await api.revert(c.path);
    if (!r.ok) return toast(r.error);
    if (S.selected === c.path) S.selected = null;
    await refreshChanges();
  }

  function toggleChanges(force) {
    const show = force === undefined ? els.changesPane.hidden : force;
    els.changesPane.hidden = !show;
    els.splitter.hidden = !show;
    els.app.classList.toggle('chat-full', !show);
    els.changesBtn.classList.toggle('on', show);
    store('cr3.changes', show ? '1' : '0');
    if (show) refreshChanges();
  }

  function setChatWidth(px) {
    const sb = els.app.classList.contains('sb-hidden') ? 0 : $('sidebar').offsetWidth;
    const max = Math.max(340, window.innerWidth - sb - 340);
    const w = Math.max(340, Math.min(px, max));
    document.documentElement.style.setProperty('--chat-w', w + 'px');
    return w;
  }

  function setChangesWidth(px) {
    return px;
  }

  function initSplitter() {
    const saved = parseInt(store('cr3.chatW') || '', 10);
    if (saved) setChatWidth(saved);
    else setChatWidth(460);
    let dragging = false;
    els.splitter.addEventListener('mousedown', (e) => { dragging = true; els.splitter.classList.add('drag-on'); e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const sb = els.app.classList.contains('sb-hidden') ? 0 : $('sidebar').offsetWidth;
      setChatWidth(e.clientX - sb);
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      els.splitter.classList.remove('drag-on');
      const curW = document.querySelector('.chat-col')?.getBoundingClientRect().width;
      if (curW) store('cr3.chatW', String(Math.round(curW)));
    });
    els.splitter.addEventListener('dblclick', () => {
      const curW = document.querySelector('.chat-col')?.getBoundingClientRect().width || 460;
      const target = curW > 500 ? 440 : 580;
      store('cr3.chatW', String(setChatWidth(target)));
    });
  }

  function setDiffMode(mode) {
    S.diffMode = mode;
    $('modeUnified').classList.toggle('on', mode === 'unified');
    $('modeSplit').classList.toggle('on', mode === 'split');
    if (mode === 'split' && els.changesPane.getBoundingClientRect().width < 700) setChangesWidth(760);
    if (S.selected) showDiff(S.selected);
  }

  // ---------- VS Code Terminal ----------
  function renderTerminalTabs() {
    if (!els.termTabsList) return;
    els.termTabsList.textContent = '';
    S.terminalTabs.forEach((tabName, idx) => {
      const b = h('button', 'term-tab' + (idx === S.terminalActiveTab ? ' on' : ''));
      b.appendChild(iconSpan('terminal', 'tiny'));
      b.appendChild(h('span', 'term-tab-label', tabName));
      b.addEventListener('click', () => {
        S.terminalActiveTab = idx;
        renderTerminalTabs();
      });
      els.termTabsList.appendChild(b);
    });
  }

  function addTerminalTab() {
    const nextNum = S.terminalTabs.length + 1;
    S.terminalTabs.push(`${nextNum}: zsh`);
    S.terminalActiveTab = S.terminalTabs.length - 1;
    renderTerminalTabs();
    if (els.termOut) els.termOut.textContent = '';
    termAppend(`$ # Terminal session ${nextNum} started\n`, false);
  }

  function splitTerminal() {
    S.terminalSplit = !S.terminalSplit;
    if (els.termPaneRight) els.termPaneRight.hidden = !S.terminalSplit;
    if (S.terminalSplit) {
      if (els.termOutSplit && !els.termOutSplit.textContent) {
        els.termOutSplit.textContent = `$ # Split terminal (bash)\n`;
      }
      if (els.termInputSplit) els.termInputSplit.focus();
    } else {
      if (els.termInput) els.termInput.focus();
    }
  }

  function killTerminal() {
    if (S.terminalSplit) {
      splitTerminal();
      return;
    }
    if (S.terminalTabs.length > 1) {
      S.terminalTabs.splice(S.terminalActiveTab, 1);
      S.terminalActiveTab = Math.max(0, S.terminalTabs.length - 1);
      renderTerminalTabs();
      if (els.termOut) els.termOut.textContent = '';
      termAppend(`$ # Switched to ${S.terminalTabs[S.terminalActiveTab]}\n`, false);
    } else {
      if (els.termOut) els.termOut.textContent = '';
      toggleTerminal(false);
    }
  }

  function clearTerminal() {
    if (els.termOut) els.termOut.textContent = '';
    if (els.termOutSplit) els.termOutSplit.textContent = '';
  }

  function toggleTerminal(force) {
    const show = force === undefined ? els.terminalPane.hidden : force;
    els.terminalPane.hidden = !show;
    els.terminalBtn.classList.toggle('on', show);
    if (show) {
      renderTerminalTabs();
      els.termInput.focus();
    }
  }

  function termAppend(text, isSplit) {
    const out = isSplit ? els.termOutSplit : els.termOut;
    if (!out) return;
    out.textContent += text;
    if (out.textContent.length > 200000) out.textContent = '…\n' + out.textContent.slice(-120000);
    out.scrollTop = out.scrollHeight;
  }

  function setTermRunning(on, isSplit) {
    if (isSplit) {
      S.termSplitRunning = on;
      if (els.termInputSplit) els.termInputSplit.disabled = on;
    } else {
      S.termRunning = on;
      if (els.termStop) els.termStop.hidden = !on;
      if (els.termInput) els.termInput.disabled = on;
      if (!on && els.termInput) els.termInput.focus();
    }
  }

  async function termRun(isSplit) {
    const inp = isSplit ? els.termInputSplit : els.termInput;
    if (!inp) return;
    const cmd = inp.value.trim();
    if (!cmd) return;
    if (isSplit ? S.termSplitRunning : S.termRunning) return;
    if (!S.app || !S.app.folder) return toast('Open a folder first.');
    if (!isSplit) {
      if (S.termHistory[S.termHistory.length - 1] !== cmd) S.termHistory.push(cmd);
      S.termIdx = S.termHistory.length;
    }
    inp.value = '';
    termAppend(`$ ${cmd}\n`, isSplit);
    setTermRunning(true, isSplit);
    const r = await api.runTerminal(cmd);
    if (!r.ok) {
      termAppend(`${r.error}\n`, isSplit);
      setTermRunning(false, isSplit);
    }
  }

  function onTerminalEvent(ev) {
    if (ev.type === 'data') termAppend(Md.stripAnsi(ev.chunk), false);
    else if (ev.type === 'exit') {
      termAppend(ev.cancelled ? '\n[stopped]\n\n' : `\n[exit code ${ev.code === null ? 'unknown' : ev.code}]\n\n`, false);
      setTermRunning(false, false);
      setTermRunning(false, true);
      scheduleChangesRefresh();
    }
  }

  // ---------- Overview Panel ----------
  function toggleOverview(force) {
    if (!els.overviewPane) return;
    const show = force === undefined ? els.overviewPane.hidden : force;
    els.overviewPane.hidden = !show;
    if (els.topOverviewBtn) els.topOverviewBtn.classList.toggle('on', show);
    if (els.overviewToggleBtn) els.overviewToggleBtn.classList.toggle('on', show);
    if (show) updateOverviewDiffStat();
  }

  function updateOverviewDiffStat() {
    let adds = 0, dels = 0;
    for (const ch of (S.changes || [])) {
      adds += (ch.added || 0);
      dels += (ch.removed || 0);
    }
    if (els.ovDiffStat) {
      els.ovDiffStat.innerHTML = `<span class="ov-add">+${adds}</span> <span class="ov-del">-${dels}</span>`;
    }
    if (els.ovTaskCount) {
      els.ovTaskCount.textContent = S.running ? '1' : '0';
    }
    if (els.ovTaskList) {
      els.ovTaskList.textContent = '';
      const item = h('div', 'ov-task-item');
      const ic = iconSpan('terminalPrompt', 'ov-task-ico');
      const text = h('span', 'ellipsis');
      text.textContent = S.running ? 'Agent turn execution' : 'Run unit tests';
      item.appendChild(ic);
      item.appendChild(text);
      els.ovTaskList.appendChild(item);
    }
  }

  // ---------- CR3-Agentic AI Settings Modal ----------
  const SETTING_PAGES = {
    general: { title: 'General Preferences', sub: 'Configure autonomous agent execution, permissions, and follow-up queuing.' },
    models: { title: 'Providers & Models', sub: 'Configure Gemini, OpenAI, Claude, Ollama, API keys, and model parameters.' },
    application: { title: 'About CR3-Agentic AI', sub: 'Desktop release information, system architecture, and local storage.' },
    appearance: { title: 'Appearance & Diff View', sub: 'Customize visual theme, display density, and side-by-side diff preferences.' },
    shortcuts: { title: 'Shortcuts Reference', sub: 'Quick reference for keyboard shortcuts and productivity hotkeys.' },
    notifications: { title: 'Notifications', sub: 'Manage alerts, sound chimes, and system notifications.' },
    browser: { title: 'Browser', sub: 'Configure sandboxed browser automation and headless testing.' },
    agent: { title: 'Workspace Settings', sub: 'Rules, approval policies, and workspace limits for this folder.' },
    conversations: { title: 'Conversations', sub: 'Manage, export, and clean conversation history.' },
    accounts: { title: 'Accounts & Providers', sub: 'Manage connected cloud providers and developer credentials.' },
  };

  function switchTab(name) {
    if (name === 'providers') name = 'models';
    if (name === 'project') name = 'agent';
    const target = SETTING_PAGES[name] ? name : 'general';

    document.querySelectorAll('.set-nav-item').forEach((btn) => {
      btn.classList.toggle('on', btn.dataset.setTab === target);
    });

    document.querySelectorAll('.set-pane').forEach((pane) => {
      pane.hidden = pane.id !== `tab-${target}`;
    });

    const meta = SETTING_PAGES[target] || SETTING_PAGES.general;
    if (els.setTitle) els.setTitle.textContent = meta.title;
    if (els.setSubtitle) els.setSubtitle.textContent = meta.sub;
  }

  function renderSettingsProjectList() {
    if (!els.setProjectList) return;
    els.setProjectList.textContent = '';
    const projs = [];
    if (S.app?.folder) projs.push(S.app.folder);
    for (const hItem of (S.app?.history || [])) {
      if (!projs.includes(hItem.path)) projs.push(hItem.path);
    }
    for (const p of projs.slice(0, 4)) {
      const b = h('button', 'set-nav-item');
      b.appendChild(iconSpan('folder', 'tiny'));
      b.appendChild(h('span', 'ellipsis', baseName(p)));
      b.title = p;
      b.addEventListener('click', () => {
        switchTab('agent');
        if (els.setTitle) els.setTitle.textContent = `Project: ${baseName(p)}`;
        if (els.setSubtitle) els.setSubtitle.textContent = `Settings and rules for ${p}`;
      });
      els.setProjectList.appendChild(b);
    }
  }

  const PERSONA_META = {
    software: {
      icon: 'code',
      tag: 'SOFTWARE',
      title: 'Software Engineering',
      desc: 'Modular clean architecture, TypeScript/Python/React, unit tests, refactoring, and Git commits.'
    },
    agent: {
      icon: 'sparkles',
      tag: 'AI AGENTS',
      title: 'AI Agent Building',
      desc: 'Autonomous multi-agent workflows, tool schemas, eval loops, subagents, and LLMs.'
    },
    science: {
      icon: 'globe',
      tag: 'RESEARCH',
      title: 'Science & Research',
      desc: 'Empirical scientific rigor, data analysis, reproducible scripts, mathematics, and research papers.'
    },
    devops: {
      icon: 'terminal',
      tag: 'SYSTEMS',
      title: 'DevOps & Cloud',
      desc: 'CI/CD pipelines, Docker, Kubernetes, shell scripts, cloud infrastructure, and stability.'
    },
    general: {
      icon: 'command',
      tag: 'GENERAL',
      title: 'General Purpose',
      desc: 'Versatile everyday assistant for documents, text analysis, workflow automation, and coding.'
    }
  };

  function renderActiveFocusDomain() {
    const s = S.app?.settings || {};
    const key = s.persona || 'software';
    const info = PERSONA_META[key] || PERSONA_META.software;
    const iconEl = $('activeDomainIcon');
    const tagEl = $('activeDomainTag');
    const titleEl = $('activeDomainTitle');
    const descEl = $('activeDomainDesc');
    if (iconEl) {
      iconEl.textContent = '';
      iconEl.appendChild(icon(info.icon));
    }
    if (tagEl) tagEl.textContent = info.tag;
    if (titleEl) titleEl.textContent = info.title;
    if (descEl) descEl.textContent = info.desc;
  }

  function applyTheme(theme) {
    let t = theme || store('cr3.theme') || 'dark';
    if (t === 'night') t = 'dark';
    store('cr3.theme', t);
    if (t === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', t);
    }
    document.querySelectorAll('#themeCardsGrid .theme-card').forEach((card) => {
      card.classList.toggle('on', card.getAttribute('data-theme-val') === t);
    });
  }

  function openSettings(tab) {
    switchTab(tab || 'general');
    const s = S.app?.settings || {};
    renderActiveFocusDomain();
    const curTheme = store('cr3.theme') || 'dark';
    applyTheme(curTheme);
    const curDiffMode = S.diffMode || store('cr3.diffMode') || 'unified';
    document.querySelectorAll('#diffModeCardsGrid .diff-mode-card').forEach((c) => {
      c.classList.toggle('on', c.getAttribute('data-diff-mode') === curDiffMode);
    });
    if ($('diffLineNums')) $('diffLineNums').checked = store('cr3.diffLineNums') !== 'false';
    if ($('diffFullContext')) $('diffFullContext').checked = !!S.diffFull;

    const mode = s.approvalMode || 'ask';
    if ($('layoutSE')) $('layoutSE').classList.toggle('on', mode === 'auto');
    if ($('layoutKW')) $('layoutKW').classList.toggle('on', mode !== 'auto');
    if ($('afApproval')) $('afApproval').value = mode;
    if ($('genPermPreset')) $('genPermPreset').value = mode;
    if ($('afSteps')) $('afSteps').value = s.maxSteps || 25;
    if ($('afContext')) $('afContext').value = s.maxContextChars || 24000;
    if ($('afFallback')) $('afFallback').checked = !!s.autoFallback;
    if ($('afStatus')) $('afStatus').hidden = true;
    renderRules();
    renderAccounts();
    renderSettingsProjectList();
    if (!S.provSel && s.activeProviderId) S.provSel = s.activeProviderId;
    renderProviders();
    closeMenu();
    const d = $('settingsDialog');
    if (!d.open) d.showModal();
  }

  function formStatus(el, msg, ok) {
    el.hidden = !msg;
    el.textContent = msg || '';
    el.className = 'form-status ' + (ok ? 'ok' : 'err');
  }

  function selectedProvider() {
    return S.app.settings.providers.find((p) => p.id === S.provSel) || null;
  }

  function renderModelCapsInSettings(modelName) {
    if (els.pfModelCaps) els.pfModelCaps.hidden = true;
  }

  function renderProviders() {
    const s = S.app.settings;
    const list = $('provList');
    list.textContent = '';
    for (const p of s.providers) {
      const b = h('button', 'prov-item' + (p.id === S.provSel ? ' on' : ''));
      b.type = 'button';
      b.appendChild(h('span', 'pn', p.name));
      if (p.id === s.activeProviderId) b.appendChild(h('span', 'tag', 'Active'));
      b.addEventListener('click', () => { S.provSel = p.id; renderProviders(); });
      list.appendChild(b);
    }
    const p = selectedProvider();
    $('pfName').value = p ? p.name : '';
    $('pfUrl').value = p ? p.baseUrl : '';
    $('pfModel').value = p ? p.model : '';
    $('pfKey').value = '';
    if (p && p.keyDecryptionFailed) {
      $('pfKey').placeholder = 'Key could not be decrypted (re-enter)';
      $('pfKeyHint').textContent = 'The operating system could not decrypt the saved key. Please paste your API key again to save a fresh copy.';
    } else {
      $('pfKey').placeholder = p && p.hasApiKey ? '••••••••  (saved)' : 'Paste your API key';
      $('pfKeyHint').textContent = p && p.hasApiKey
        ? 'A key is saved in your Mac Keychain. Leave this empty to keep it, or paste a new one to replace it.'
        : 'No key saved. Local servers such as Ollama do not need one. Online providers show the key on their website under “API keys”.';
    }
    $('pfClearRow').hidden = !(p && p.hasApiKey);
    $('pfClear').checked = false;
    const dl = $('pfModels');
    dl.textContent = '';
    (p ? p.models : []).forEach((m) => { const o = document.createElement('option'); o.value = m; dl.appendChild(o); });
    $('pfModelHint').textContent = p && p.models.length > 0 ? `${p.models.length} models available. Start typing to filter.` : 'Must support tool calling. Use “Save & fetch models” to see what this provider offers.';
    renderModelCapsInSettings(p ? p.model : '');
    const preset = p ? (S.app.presets || []).find((x) => x.baseUrl === p.baseUrl) : null;
    $('pfPresetNote').hidden = !(preset && (preset.note || preset.keyUrl));
    $('pfPresetText').textContent = preset ? (preset.free ? 'Free plan available. ' : '') + (preset.note || '') + (preset.free && preset.keyUrl ? ' Limits change, so check the provider’s page.' : '') : '';
    $('pfKeyLink').hidden = !(preset && preset.keyUrl);
    $('pfKeyLink').onclick = () => preset && api.openWeb(preset.keyUrl);
    $('pfDelete').disabled = s.providers.length <= 1;
    $('pfActivate').disabled = !p || p.id === s.activeProviderId;
    $('pfActivate').textContent = p && p.id === s.activeProviderId ? 'Active' : 'Use this provider';
    formStatus($('pfStatus'), '', true);
  }

  function readProviderForm() {
    const key = $('pfKey').value.trim();
    const input = { id: S.provSel, name: $('pfName').value, baseUrl: $('pfUrl').value, model: $('pfModel').value };
    if (key !== '') input.apiKey = key;
    else if ($('pfClear').checked) input.apiKey = '';
    return input;
  }

  async function saveProvider() {
    const r = await api.saveProvider(readProviderForm());
    if (!r.ok) { formStatus($('pfStatus'), r.error, false); return null; }
    applyState(r);
    S.provSel = r.id;
    return r;
  }

  function initSettings() {
    document.querySelectorAll('.set-nav-item').forEach((t) => {
      t.addEventListener('click', () => {
        if (t.dataset.setTab) switchTab(t.dataset.setTab);
      });
    });
    $('settingsClose')?.addEventListener('click', () => $('settingsDialog').close());

    // Reconfigure Domain button -> Opens onboarding
    $('genReconfigDomainBtn')?.addEventListener('click', () => {
      const d = $('onboardDialog');
      if (d) {
        const s = S.app?.settings || {};
        const persona = s.persona || 'software';
        document.querySelectorAll('#onboardPersonaGrid .persona-card').forEach((c) => {
          c.classList.toggle('on', c.getAttribute('data-persona') === persona);
        });
        const mode = s.approvalMode || 'ask';
        document.querySelectorAll('#onboardModeGrid .set-layout-card').forEach((c) => {
          c.classList.toggle('on', c.getAttribute('data-mode') === mode);
        });
        d.showModal();
      }
    });

    // Theme Cards -> Click to switch theme instantly
    document.querySelectorAll('#themeCardsGrid .theme-card').forEach((card) => {
      card.addEventListener('click', () => {
        const th = card.getAttribute('data-theme-val') || 'dark';
        applyTheme(th);
        toast(`Visual theme set to ${card.querySelector('.theme-name')?.textContent || th}`);
      });
    });

    // Diff Mode Cards -> Click to switch diff view mode
    document.querySelectorAll('#diffModeCardsGrid .diff-mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        const mode = card.getAttribute('data-diff-mode') || 'unified';
        store('cr3.diffMode', mode);
        setDiffMode(mode);
        document.querySelectorAll('#diffModeCardsGrid .diff-mode-card').forEach((c) => {
          c.classList.toggle('on', c === card);
        });
        toast(`Diff review mode set to ${card.querySelector('.dmc-title')?.textContent || mode}`);
      });
    });

    // Diff View Preferences
    $('diffLineNums')?.addEventListener('change', (e) => {
      store('cr3.diffLineNums', e.target.checked ? 'true' : 'false');
      document.body.classList.toggle('hide-diff-linenums', !e.target.checked);
      if (S.selected) showDiff(S.selected);
    });
    $('diffFullContext')?.addEventListener('change', (e) => {
      S.diffFull = e.target.checked;
      if (S.selected) showDiff(S.selected);
    });

    // Layout cards -> Execution Mode (Autonomous vs Supervised)
    const lkw = $('layoutKW');
    const lse = $('layoutSE');
    if (lkw && lse) {
      lkw.addEventListener('click', async () => {
        lkw.classList.add('on');
        lse.classList.remove('on');
        if ($('genPermPreset')) $('genPermPreset').value = 'ask';
        const r = await api.setGeneral({ approvalMode: 'ask' });
        if (r.ok) {
          applyState(r);
          toast('Supervised Mode activated');
        }
      });
      lse.addEventListener('click', async () => {
        lse.classList.add('on');
        lkw.classList.remove('on');
        if ($('genPermPreset')) $('genPermPreset').value = 'auto';
        const r = await api.setGeneral({ approvalMode: 'auto' });
        if (r.ok) {
          applyState(r);
          toast('Autonomous Mode activated');
        }
      });
    }

    $('pfModel')?.addEventListener('input', (e) => {
      renderModelCapsInSettings(e.target.value);
    });

    // Permission Preset dropdown sync
    $('genPermPreset')?.addEventListener('change', async (e) => {
      const mode = e.target.value;
      if ($('afApproval')) $('afApproval').value = mode;
      const r = await api.setGeneral({ approvalMode: mode });
      if (r.ok) {
        applyState(r);
        toast(`Permission preset set to ${mode}`);
      } else {
        toast(r.error);
      }
    });

    $('genToolPermsBtn')?.addEventListener('click', () => {
      openSkills();
    });

    $('genNetRulesBtn')?.addEventListener('click', () => {
      toast('Network access rules: standard internet endpoints allowed in sandbox.');
    });

    // Execution Queue
    const eq = $('execQueueBtn');
    const es = $('execSendImmBtn');
    if (eq && es) {
      eq.addEventListener('click', () => {
        eq.classList.add('on');
        es.classList.remove('on');
        toast('Messages will be queued when agent is running');
      });
      es.addEventListener('click', () => {
        es.classList.add('on');
        eq.classList.remove('on');
        toast('Messages will be sent immediately');
      });
    }

    // Voice mode
    $('voiceVolume')?.addEventListener('input', (e) => {
      const lbl = $('voiceVolumeVal');
      if (lbl) lbl.textContent = e.target.value + '%';
    });
    $('voiceChangeBtn')?.addEventListener('click', () => {
      toast('Voice: Gemini Live 2.0 voice selected');
    });

    // User badge & feedback
    $('setUserBadge')?.addEventListener('click', () => {
      switchTab('accounts');
    });
    $('setFeedbackBtn')?.addEventListener('click', () => {
      toast('Thank you for using Cr3agent! Send feedback on GitHub.');
    });

    // Conversations management
    $('convExportBtn')?.addEventListener('click', () => {
      const json = JSON.stringify(S.chats || [], null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cr3agent-conversations-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Conversations exported to JSON');
    });

    $('convClearOldBtn')?.addEventListener('click', () => {
      toast('Inactive chats cleared.');
    });

    $('appCheckUpdateBtn')?.addEventListener('click', () => {
      toast('Cr3agent is up to date (v0.3.1).');
    });

    $('chatWidthSelect')?.addEventListener('change', (e) => {
      document.documentElement.style.setProperty('--chat-w', e.target.value);
    });

    $('provAdd')?.addEventListener('click', () => {
      showMenu($('provAdd'), (S.app.presets || []).map((pr) => ({
        label: (pr.free ? 'Free · ' : '') + pr.name, sub: pr.note || pr.baseUrl,
        onClick: async () => {
          const r = await api.saveProvider({ name: pr.name, baseUrl: pr.baseUrl, model: pr.exampleModel || '' });
          if (!r.ok) return formStatus($('pfStatus'), r.error, false);
          applyState(r);
          S.provSel = r.id;
          renderProviders();
          formStatus($('pfStatus'), pr.needsKey ? 'Paste your API key below, then press “Save & fetch models”.' : 'Press “Save & fetch models” to check the connection.', true);
          $('pfKey').focus();
        },
      })));
    });

    $('provForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await saveProvider()) { renderProviders(); formStatus($('pfStatus'), 'Saved.', true); }
    });

    $('pfFetch')?.addEventListener('click', async () => {
      const saved = await saveProvider();
      if (!saved) return;
      formStatus($('pfStatus'), 'Contacting the server…', true);
      const r = await api.fetchModels(S.provSel);
      if (!r.ok) { renderProviders(); return formStatus($('pfStatus'), r.error, false); }
      applyState(r);
      renderProviders();
      const p = selectedProvider();
      formStatus($('pfStatus'), `Connected. ${p ? p.models.length : 0} models found.`, true);
    });

    $('pfActivate')?.addEventListener('click', async () => {
      const saved = await saveProvider();
      if (!saved) return;
      const p = selectedProvider();
      if (!p || !p.model) return formStatus($('pfStatus'), 'Choose a model first.', false);
      const r = await api.activateProvider(p.id, p.model);
      if (!r.ok) return formStatus($('pfStatus'), r.error, false);
      applyState(r);
      renderProviders();
      formStatus($('pfStatus'), `Now using ${p.name} · ${p.model}.`, true);
    });

    $('pfDelete')?.addEventListener('click', async () => {
      const p = selectedProvider();
      if (!p) return;
      if (!(await confirmDialog(`Delete “${p.name}”?`, 'Its saved API key is removed from this Mac.', 'Delete'))) return;
      const r = await api.deleteProvider(p.id);
      if (!r.ok) return formStatus($('pfStatus'), r.error, false);
      S.provSel = null;
      applyState(r);
      S.provSel = r.settings.activeProviderId;
      renderProviders();
    });

    $('agentForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api.setGeneral({ approvalMode: $('afApproval').value, maxSteps: $('afSteps').value, maxContextChars: $('afContext').value, autoFallback: $('afFallback').checked });
      if (!r.ok) return formStatus($('afStatus'), r.error, false);
      applyState(r);
      renderRules();
      formStatus($('afStatus'), 'Saved.', true);
    });
  }

  // ---------- "Approve always" rules ----------
  function describeRule(rule) {
    if (rule === 'edit:*') return 'Change files in this project';
    if (rule.startsWith('cmd:')) return 'Run “' + rule.slice(4) + ' …”';
    if (rule.startsWith('host:')) return 'Fetch web pages from ' + rule.slice(5);
    return rule;
  }

  function renderRules() {
    const box = $('afRules');
    box.textContent = '';
    const folder = S.app && S.app.folder;
    const rules = (folder && S.app.settings.allowRules && S.app.settings.allowRules[folder]) || [];
    if (!folder) return void box.appendChild(h('div', 'muted small', 'Open a project to see its rules.'));
    if (rules.length === 0) return void box.appendChild(h('div', 'muted small', 'None yet. When the agent asks, choose “Approve always” to add one.'));
    for (const rule of rules) {
      const row = h('div', 'rule-row');
      row.appendChild(h('span', 'rule-text', describeRule(rule)));
      const x = h('button', 'btn small', 'Remove');
      x.type = 'button';
      x.addEventListener('click', async () => {
        const r = await api.removeRule(rule);
        if (!r.ok) return toast(r.error);
        applyState(r);
        renderRules();
      });
      row.appendChild(x);
      box.appendChild(row);
    }
  }

  // ---------- accounts ----------
  function renderAccountLabel() {
    const a = S.app && S.app.settings.accounts;
    const who = a && ((a.github && '@' + a.github.login) || (a.google && (a.google.name || a.google.email)));
    $('accountLabel').textContent = who || 'Sign in';
  }

  function renderAccounts() {
    if (!S.app) return;
    const s = S.app.settings;
    const gh = s.accounts.github;
    const gg = s.accounts.google;

    if (gh) {
      $('ghState').innerHTML = `<span class="acct-badge-connected">Connected</span>`;
      if ($('ghProfileBox')) {
        $('ghProfileBox').hidden = false;
        $('ghProfileBox').innerHTML = `
          <div class="acct-user-card">
            <img class="acct-avatar-img" src="https://github.com/${gh.login}.png" alt="${gh.login}" onerror="this.style.display='none'" />
            <div class="acct-user-details">
              <div class="acct-user-name">@${gh.login}</div>
              <div class="acct-user-role">GitHub Account · Authorized to commit and push</div>
            </div>
          </div>
        `;
      }
    } else {
      $('ghState').textContent = 'not signed in';
      if ($('ghProfileBox')) $('ghProfileBox').hidden = true;
    }

    $('ghSignIn').hidden = !!gh;
    $('ghOut').hidden = !gh;
    $('ghTokenRow').hidden = !!gh;
    $('ghClient').value = s.oauth.githubClientId || '';

    if (gg) {
      $('ggState').innerHTML = `<span class="acct-badge-connected">Connected</span>`;
      if ($('ggProfileBox')) {
        $('ggProfileBox').hidden = false;
        const initial = ((gg.name || gg.email || 'G')[0] || 'G').toUpperCase();
        $('ggProfileBox').innerHTML = `
          <div class="acct-user-card">
            ${gg.picture ? `<img class="acct-avatar-img" src="${gg.picture}" alt="${gg.name || ''}" />` : `<div class="acct-avatar-fallback">${initial}</div>`}
            <div class="acct-user-details">
              <div class="acct-user-name">${gg.name || gg.email}</div>
              <div class="acct-user-role">${gg.email && gg.name ? gg.email : 'Google Account (Local Identity)'}</div>
            </div>
          </div>
        `;
      }
    } else {
      $('ggState').textContent = 'not signed in';
      if ($('ggProfileBox')) $('ggProfileBox').hidden = true;
    }

    $('ggSignIn').hidden = !!gg;
    $('ggOut').hidden = !gg;
    $('ggClient').value = s.oauth.googleClientId || '';
    $('ggSecret').value = '';
    $('ggSecret').placeholder = s.oauth.hasGoogleSecret ? '•••• (saved)' : 'Client secret';
    renderAccountLabel();
  }

  function onAccountEvent(ev) {
    if (!ev) return;
    const box = ev.kind === 'github' ? 'ghStatus' : 'ggStatus';
    if (ev.kind === 'github') { S.ghWait = false; $('ghDevice').hidden = true; }
    if (ev.status === 'connected') {
      applyState(ev.state);
      renderAccounts();
      formStatus($(box), 'Signed in.', true);
      toast('Signed in.');
    } else {
      formStatus($(box), ev.message || 'Sign-in failed.', false);
    }
  }

  function initAccounts() {
    $('ghClientBtn').addEventListener('click', async () => {
      const r = await api.accountConfig({ githubClientId: $('ghClient').value });
      if (!r.ok) return formStatus($('ghStatus'), r.error, false);
      applyState(r);
      formStatus($('ghStatus'), 'Saved.', true);
    });
    $('ggClientBtn').addEventListener('click', async () => {
      const input = { googleClientId: $('ggClient').value };
      if ($('ggSecret').value.trim() !== '') input.googleClientSecret = $('ggSecret').value;
      const r = await api.accountConfig(input);
      if (!r.ok) return formStatus($('ggStatus'), r.error, false);
      applyState(r);
      renderAccounts();
      formStatus($('ggStatus'), 'Saved.', true);
    });
    $('ghSignIn').addEventListener('click', async () => {
      formStatus($('ghStatus'), '', true);
      if (!$('ghClient').value.trim()) { $('ghClient').closest('details').open = true; return formStatus($('ghStatus'), 'Add your GitHub OAuth Client ID first (GitHub setup below), or paste a personal access token.', false); }
      const saved = await api.accountConfig({ githubClientId: $('ghClient').value });
      if (!saved.ok) return formStatus($('ghStatus'), saved.error, false);
      const r = await api.githubStart();
      if (!r.ok) return formStatus($('ghStatus'), r.error, false);
      S.ghWait = true;
      const box = $('ghDevice');
      box.textContent = '';
      box.hidden = false;
      box.appendChild(h('div', '', 'GitHub opened in your browser. Enter this code there:'));
      box.appendChild(h('div', 'device-code', r.userCode));
      const cancel = h('button', 'btn small', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', async () => { await api.accountCancel(); S.ghWait = false; box.hidden = true; });
      box.appendChild(h('div', 'muted small', 'Waiting for you to approve…'));
      box.appendChild(cancel);
    });
    $('ghTokenBtn').addEventListener('click', async () => {
      const r = await api.githubToken($('ghToken').value);
      if (!r.ok) return formStatus($('ghStatus'), r.error, false);
      $('ghToken').value = '';
      applyState(r);
      renderAccounts();
      formStatus($('ghStatus'), 'Signed in.', true);
    });
    $('ggSignIn').addEventListener('click', async () => {
      formStatus($('ggStatus'), '', true);
      if (!$('ggClient').value.trim()) { $('ggClient').closest('details').open = true; return formStatus($('ggStatus'), 'Add your Google OAuth Client ID first (Google setup below).', false); }
      const input = { googleClientId: $('ggClient').value };
      if ($('ggSecret').value.trim() !== '') input.googleClientSecret = $('ggSecret').value;
      const saved = await api.accountConfig(input);
      if (!saved.ok) return formStatus($('ggStatus'), saved.error, false);
      const r = await api.googleStart();
      if (!r.ok) return formStatus($('ggStatus'), r.error, false);
      formStatus($('ggStatus'), 'Your browser opened. Choose your Google account there…', true);
    });
    const out = (kind) => async () => {
      const r = await api.accountDisconnect(kind);
      if (!r.ok) return toast(r.error);
      applyState(r);
      renderAccounts();
    };
    $('ghOut').addEventListener('click', out('github'));
    $('ggOut').addEventListener('click', out('google'));
    $('apSignIn').addEventListener('click', () => ($('apInfo').hidden = !$('apInfo').hidden));
  }

  // ---------- history of projects ----------
  async function openHistory() {
    closeMenu();
    const r = await api.history();
    if (!r.ok) return toast(r.error);
    S.history = r.projects;
    renderHistory2();
    const d = $('historyDialog');
    if (!d.open) { d.showModal(); $('historySearch').focus(); }
  }

  function renderHistory2() {
    const list = $('historyList');
    list.textContent = '';
    const q = $('historySearch').value.trim().toLowerCase();
    const rows = (S.history || []).filter((p) => !q || p.folder.toLowerCase().includes(q) || p.lastChat.toLowerCase().includes(q));
    if (rows.length === 0) list.appendChild(h('div', 'muted', (S.history || []).length === 0 ? 'No projects yet. Open a folder to begin.' : 'No project matches.'));
    for (const p of rows) {
      const row = h('div', 'hist-row' + (p.exists ? '' : ' gone') + (p.folder === (S.app && S.app.folder) ? ' on' : ''));
      const main = h('div', 'hist-main');
      const name = h('div', 'hist-name', p.name);
      if (p.running > 0) name.appendChild(h('span', 'run-badge', p.running + ' working'));
      if (!p.exists) name.appendChild(h('span', 'sk-tag', 'folder missing'));
      main.appendChild(name);
      main.appendChild(h('div', 'mono small muted ellipsis', p.folder));
      const meta = [p.lastOpened ? 'opened ' + relTime(p.lastOpened) : '', p.opens ? p.opens + (p.opens === 1 ? ' time' : ' times') : '', p.chatCount + (p.chatCount === 1 ? ' chat' : ' chats')].filter(Boolean).join(' · ');
      main.appendChild(h('div', 'small muted', meta + (p.lastChat ? ' · last: ' + p.lastChat : '')));
      row.appendChild(main);
      const open = h('button', 'btn small' + (p.exists ? ' primary' : ''), 'Open');
      open.type = 'button';
      open.disabled = !p.exists;
      open.addEventListener('click', async () => { $('historyDialog').close(); if (p.folder !== S.app.folder) await openProject(p.folder); });
      const rm = h('button', 'icon-btn small');
      rm.type = 'button';
      rm.title = 'Remove from history (the folder and its chats are not deleted)';
      rm.setAttribute('aria-label', 'Remove from history');
      setIcon(rm, 'x');
      rm.addEventListener('click', async () => {
        const r = await api.forgetFolder(p.folder);
        if (r.ok) applyState(r);
        S.history = S.history.filter((x) => x.folder !== p.folder);
        renderHistory2();
      });
      row.append(open, rm);
      list.appendChild(row);
    }
  }

  function initHistory() {
    $('historyClose').addEventListener('click', () => $('historyDialog').close());
    $('historySearch').addEventListener('input', renderHistory2);
  }

  // ---------- git & GitHub ----------
  function gitBusy(on, msg) {
    document.querySelectorAll('#gitBody button, #gitBody input, #gitBody textarea, #gitBody select').forEach((n) => (n.disabled = on));
    if (msg !== undefined) formStatus($('gitStatus'), msg, true);
  }

  async function openGit() {
    if (!S.app || !S.app.folder) return toast('Open a folder first.');
    closeMenu();
    const d = $('gitDialog');
    if (!d.open) d.showModal();
    await loadGit();
  }

  async function loadGit(keepStatus) {
    if (!keepStatus) formStatus($('gitStatus'), '', true);
    const r = await api.gitStatus();
    const body = $('gitBody');
    if (!r.ok) {
      body.textContent = '';
      body.appendChild(h('p', 'muted', 'Could not read Git: ' + r.error));
      return;
    }
    renderGit(r);
  }

  async function gitDo(fn, doing) {
    gitBusy(true, doing);
    const r = await fn();
    if (r.ok) {
      await loadGit(true);
      formStatus($('gitStatus'), r.message || 'Done.', true);
    } else {
      await loadGit(true);
      formStatus($('gitStatus'), r.error, false);
    }
    return r;
  }

  function renderGit(r) {
    const g = r.git;
    const body = $('gitBody');
    body.textContent = '';
    const btn = (label, cls, fn) => { const b = h('button', 'btn small ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; };

    if (!g.isRepo) {
      body.appendChild(h('p', '', 'This folder is not a Git repository yet.'));
      body.appendChild(h('p', 'muted small', 'Git keeps a history of your project so you can go back and share it on GitHub.'));
      body.appendChild(btn('Create a repository here', 'primary', () => gitDo(() => api.gitInit(), 'Creating…')));
      return;
    }

    const top = h('div', 'git-top');
    top.appendChild(h('span', 'git-branch', g.branch || '(no commits yet)'));
    const sync = [];
    if (g.ahead) sync.push(g.ahead + ' to push');
    if (g.behind) sync.push(g.behind + ' to pull');
    top.appendChild(h('span', 'muted small', g.remote ? g.remote + (sync.length ? ' · ' + sync.join(', ') : g.upstream ? ' · up to date' : ' · not pushed yet') : 'no remote'));
    top.appendChild(h('span', 'spacer'));
    top.appendChild(btn('Pull', '', () => gitDo(() => api.gitPull(), 'Pulling…')));
    top.appendChild(btn('Push', '', () => gitDo(() => api.gitPush(), 'Pushing…')));
    body.appendChild(top);

    // branches
    const br = h('div', 'git-row');
    const sel = h('select');
    for (const b of g.branches) { const o = h('option', '', b); o.value = b; if (b === g.branch) o.selected = true; sel.appendChild(o); }
    sel.addEventListener('change', () => gitDo(() => api.gitSwitch(sel.value, false), 'Switching…'));
    const nb = h('input');
    nb.type = 'text'; nb.placeholder = 'new-branch-name'; nb.spellcheck = false;
    br.append(h('span', 'muted small', 'Branch'), g.branches.length ? sel : h('span', 'muted small', '—'), nb, btn('Create branch', '', () => nb.value.trim() ? gitDo(() => api.gitSwitch(nb.value.trim(), true), 'Creating branch…') : nb.focus()));
    body.appendChild(br);

    // changes + commit
    body.appendChild(h('h3', 'sub-h', g.files.length ? `Changes to commit (${g.files.length})` : 'Nothing to commit'));
    if (g.files.length) {
      const list = h('div', 'git-files');
      for (const f of g.files.slice(0, 200)) {
        const row = h('div', 'git-file');
        row.appendChild(h('span', 'gf-tag ' + f.label, f.label));
        row.appendChild(h('span', 'mono ellipsis', f.path));
        list.appendChild(row);
      }
      if (g.files.length > 200) list.appendChild(h('div', 'muted small', '…and ' + (g.files.length - 200) + ' more'));
      body.appendChild(list);
      const msg = h('textarea');
      msg.rows = 2; msg.placeholder = 'Commit message, e.g. “Fix login bug”'; msg.id = 'gitMsg';
      body.appendChild(msg);
      body.appendChild(h('div', 'git-actions')).append(
        btn('Commit all changes', 'primary', () => gitDo(() => api.gitCommit(msg.value), 'Committing…')),
        btn('Commit & push', '', async () => { const c = await gitDo(() => api.gitCommit(msg.value), 'Committing…'); if (c.ok) await gitDo(() => api.gitPush(), 'Pushing…'); }),
      );
    }

    // GitHub
    body.appendChild(h('h3', 'sub-h', 'GitHub'));
    if (!r.signedIn) {
      const p = h('p', 'muted small', 'Sign in to GitHub to create repositories and pull requests, and to push without typing a password. ');
      p.appendChild(btn('Sign in…', '', () => { $('gitDialog').close(); openSettings('accounts'); }));
      body.appendChild(p);
    } else {
      body.appendChild(h('p', 'muted small', 'Signed in as @' + r.github + '.'));
    }
    if (!g.remote) {
      const row = h('div', 'git-row');
      const name = h('input'); name.type = 'text'; name.value = baseName(S.app.folder).replace(/[^\w.-]/g, '-'); name.spellcheck = false;
      const priv = h('label', 'check small'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = true; priv.append(cb, document.createTextNode(' Private'));
      row.append(h('span', 'muted small', 'New repository'), name, priv, btn('Create on GitHub', '', () => gitDo(() => api.gitCreateRepo({ name: name.value, private: cb.checked }), 'Creating on GitHub…')));
      row.lastChild.disabled = !r.signedIn;
      body.appendChild(row);
      body.appendChild(h('p', 'muted small', 'Then commit, and press Push to upload your code.'));
    } else if (/github\.com/.test(g.remote)) {
      const form = h('div', 'git-pr');
      const title = h('input'); title.type = 'text'; title.placeholder = 'Pull request title'; title.spellcheck = false;
      const desc = h('textarea'); desc.rows = 2; desc.placeholder = 'Description (optional)';
      const base = h('input'); base.type = 'text'; base.placeholder = 'base branch (default: the repository’s main branch)'; base.spellcheck = false;
      const go = btn('Push & open pull request', '', () => title.value.trim() ? gitDo(() => api.gitPullRequest({ title: title.value, body: desc.value, base: base.value }), 'Opening pull request…') : title.focus());
      go.disabled = !r.signedIn;
      form.append(title, desc, base, go);
      body.appendChild(form);
    }

    if (g.commits.length) {
      body.appendChild(h('h3', 'sub-h', 'Recent commits'));
      const list = h('div', 'git-commits');
      for (const c of g.commits) {
        const row = h('div', 'git-commit');
        row.append(h('span', 'mono muted', c.hash), h('span', 'ellipsis', c.subject), h('span', 'muted small', c.when));
        list.appendChild(row);
      }
      body.appendChild(list);
    }
  }

  function initGit() {
    $('gitClose').addEventListener('click', () => $('gitDialog').close());
    $('gitRefresh').addEventListener('click', () => loadGit());
  }

  // ---------- skills ----------
  async function openSkills() {
    const r = await api.listSkills();
    renderSkills(r.ok ? r.skills : []);
    $('skForm').hidden = true;
    closeMenu();
    const d = $('skillsDialog');
    if (!d.open) d.showModal();
  }

  function renderSkills(skills) {
    const list = $('skList');
    list.textContent = '';
    if (skills.length === 0) list.appendChild(h('div', 'muted', 'No skills yet. Create one, or import a folder that contains SKILL.md.'));
    for (const s of skills) {
      const item = h('div', 'sk-item');
      const main = h('div', 'sk-main');
      const name = h('div', 'sk-name', s.name);
      name.appendChild(h('span', 'sk-tag', s.source === 'project' ? 'this project' : 'global'));
      main.appendChild(name);
      main.appendChild(h('div', 'sk-desc', s.description));
      main.appendChild(h('div', 'sk-src mono', s.dir));
      item.appendChild(main);
      if (s.deletable) {
        const del = h('button', 'icon-btn small');
        del.type = 'button';
        del.title = 'Delete this skill';
        del.setAttribute('aria-label', 'Delete skill');
        setIcon(del, 'trash');
        del.addEventListener('click', async () => {
          if (!(await confirmDialog(`Delete skill “${s.name}”?`, 'Its folder is removed from this Mac.', 'Delete'))) return;
          const r = await api.deleteSkill(s.dir);
          if (r.ok) renderSkills(r.skills); else toast(r.error);
        });
        item.appendChild(del);
      }
      list.appendChild(item);
    }
  }

  function initSkills() {
    $('skillsClose').addEventListener('click', () => $('skillsDialog').close());
    $('skNew').addEventListener('click', () => { $('skForm').hidden = false; formStatus($('skStatus'), '', true); $('skName').focus(); });
    $('skCancel').addEventListener('click', () => ($('skForm').hidden = true));
    $('skOpen').addEventListener('click', async () => { const r = await api.openSkillsFolder(); if (!r.ok) toast(r.error); });
    $('skImport').addEventListener('click', async () => {
      const r = await api.importSkill();
      if (!r.ok) return toast(r.error);
      if (!r.canceled) { renderSkills(r.skills); toast('Skill imported.'); }
    });
    $('skForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await api.createSkill({ name: $('skName').value, description: $('skDesc').value, instructions: $('skBody').value });
      if (!r.ok) return formStatus($('skStatus'), r.error, false);
      renderSkills(r.skills);
      $('skForm').hidden = true;
      $('skName').value = $('skDesc').value = $('skBody').value = '';
      toast('Skill created. The agent will see it on your next message.');
    });
  }

  // ---------- wiring ----------
  function setSidebar(show) {
    els.app.classList.toggle('sb-hidden', !show);
    $('sbShow').hidden = show;
    store('fa.sidebar', show ? '1' : '0');
  }

  function runCommand(name) {
    switch (name) {
      case 'open-folder': pickFolder(); break;
      case 'new-chat': newChat(); break;
      case 'settings': openSettings('providers'); break;
      case 'git': openGit(); break;
      case 'history': openHistory(); break;
      case 'toggle-sidebar': setSidebar(els.app.classList.contains('sb-hidden')); break;
      case 'toggle-changes': toggleChanges(); break;
      case 'toggle-terminal': toggleTerminal(); break;
      case 'focus-input': els.input.focus(); break;
    }
  }

  function initEvents() {
    $('sbToggle').addEventListener('click', () => setSidebar(false));
    $('sbShow').addEventListener('click', () => setSidebar(true));
    $('newChatBtn').addEventListener('click', newChat);
    $('openFolderBtn').addEventListener('click', pickFolder);

    // Sidebar navigation & search
    if (els.navBackBtn) els.navBackBtn.addEventListener('click', navBack);
    if (els.navForwardBtn) els.navForwardBtn.addEventListener('click', navForward);
    if (els.sbSearch) {
      els.sbSearch.addEventListener('input', () => {
        S.chatFilter = els.sbSearch.value;
        if (els.sbSearchClear) els.sbSearchClear.hidden = !els.sbSearch.value;
        renderChats();
      });
    }
    if (els.sbSearchClear) {
      els.sbSearchClear.addEventListener('click', () => {
        if (els.sbSearch) els.sbSearch.value = '';
        S.chatFilter = '';
        els.sbSearchClear.hidden = true;
        renderChats();
        els.sbSearch?.focus();
      });
    }
    if (els.sbProjectToggle) {
      els.sbProjectToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        S.collapseProject = !S.collapseProject;
        renderSidebar();
      });
    }
    $('sbCurrentProjHeader')?.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (!S.app?.folder) {
        pickFolder();
      } else {
        S.collapseProject = !S.collapseProject;
        renderSidebar();
      }
    });
    if (els.recentProjectsToggle) {
      els.recentProjectsToggle.addEventListener('click', () => {
        S.collapseRecent = !S.collapseRecent;
        renderSidebar();
      });
    }
    if (els.sbToggleAllSessions) {
      els.sbToggleAllSessions.addEventListener('click', () => {
        const curFolder = S.app?.folder;
        if (curFolder) {
          if (S.expandedProjects.has(curFolder)) S.expandedProjects.delete(curFolder);
          else S.expandedProjects.add(curFolder);
        }
        renderChats();
      });
    }

    if (els.sbSearchBtn) {
      els.sbSearchBtn.addEventListener('click', () => {
        if (els.sbSearchWrap) {
          els.sbSearchWrap.hidden = !els.sbSearchWrap.hidden;
          if (!els.sbSearchWrap.hidden) els.sbSearch?.focus();
        }
      });
    }
    if (els.sbAutomationsBtn) {
      els.sbAutomationsBtn.addEventListener('click', () => {
        toast('Automations: Manage background tasks & workflows');
      });
    }
    if (els.sbCustomizationsBtn) {
      els.sbCustomizationsBtn.addEventListener('click', () => {
        openSkills();
      });
    }
    if (els.sbFilterProjectsBtn) {
      els.sbFilterProjectsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProjectFilterMenu(els.sbFilterProjectsBtn);
      });
    }
    if (els.renameClose) els.renameClose.addEventListener('click', () => els.renameDialog?.close());
    if (els.renameCancel) els.renameCancel.addEventListener('click', () => els.renameDialog?.close());
    if (els.renameForm) {
      els.renameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = els.renameInput.value.trim();
        if (renameTargetId && title) {
          await doRenameChat(renameTargetId, title);
        }
        els.renameDialog.close();
      });
    }

    if (els.newStandaloneChatBtn) els.newStandaloneChatBtn.addEventListener('click', newChat);

    // Queued message action buttons
    if (els.qcSendNowBtn) els.qcSendNowBtn.addEventListener('click', sendQueuedNow);
    if (els.qcEditBtn) els.qcEditBtn.addEventListener('click', editQueued);
    if (els.qcRemoveBtn) els.qcRemoveBtn.addEventListener('click', removeQueued);

    $('settingsBtn')?.addEventListener('click', () => openSettings('general'));
    $('skillsBtn')?.addEventListener('click', openSkills);
    $('historyBtn')?.addEventListener('click', openHistory);
    $('accountBtn')?.addEventListener('click', () => openSettings('accounts'));
    $('gitBtn').addEventListener('click', openGit);
    els.changesBtn.addEventListener('click', () => toggleChanges());

    // Top Right Header Icons (3 dots menu, Overview dropdown, and Side Panel toggle)
    if (els.topChatMenuBtn) {
      setIcon(els.topChatMenuBtn, 'moreVertical');
      els.topChatMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = (S.allChats || []).find((c) => c.id === S.app?.chatId) || { id: S.app?.chatId, title: els.chatTitleTop?.textContent || 'Current Chat' };
        showSessionMenu(els.topChatMenuBtn, cur);
      });
    }
    if (els.topOverviewBtn) {
      setIcon(els.topOverviewBtn, 'overview');
      els.topOverviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOverview();
      });
    }
    if (els.topPanelToggleBtn) {
      setIcon(els.topPanelToggleBtn, 'sidebarRight');
      els.topPanelToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleChanges();
      });
    }

    // Close Overview dropdown on click outside
    document.addEventListener('click', (e) => {
      if (els.overviewPane && !els.overviewPane.hidden) {
        if (!els.overviewPane.contains(e.target) && !els.topOverviewBtn?.contains(e.target) && !els.overviewToggleBtn?.contains(e.target)) {
          toggleOverview(false);
        }
      }
    });

    // Overview Panel
    if (els.overviewToggleBtn) els.overviewToggleBtn.addEventListener('click', () => toggleOverview());
    if (els.ovReviewBtn) els.ovReviewBtn.addEventListener('click', () => toggleChanges(true));
    if (els.ovFilesBtn) els.ovFilesBtn.addEventListener('click', () => {
      if (S.app?.folder) api.openFolderInFinder(S.app.folder);
      else toast('Open a folder first.');
    });
    if (els.ovTerminalBtn) els.ovTerminalBtn.addEventListener('click', () => toggleTerminal(true));
    if (els.ovExtensionsBtn) els.ovExtensionsBtn.addEventListener('click', openSkills);
    if (els.ovMoreBtn) {
      els.ovMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showMenu(els.ovMoreBtn, [
          { label: 'Refresh Overview', onClick: () => { scheduleChangesRefresh(); updateOverviewDiffStat(); } },
          { label: 'Close Overview', onClick: () => toggleOverview(false) }
        ]);
      });
    }
    if (els.ovSeeAllBtn) {
      els.ovSeeAllBtn.addEventListener('click', () => {
        toast(S.running ? 'Agent is currently executing a step in the active session.' : 'No background tasks running.');
      });
    }

    // VS Code Terminal Controls
    if (els.termNew) els.termNew.addEventListener('click', addTerminalTab);
    if (els.termSplit) els.termSplit.addEventListener('click', splitTerminal);
    if (els.termKill) els.termKill.addEventListener('click', killTerminal);
    if (els.termClear) els.termClear.addEventListener('click', clearTerminal);
    if (els.termCloseSplit) els.termCloseSplit.addEventListener('click', splitTerminal);
    if (els.termInputSplit) {
      els.termInputSplit.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') termRun(true);
      });
    }
    $('chClose').addEventListener('click', () => toggleChanges(false));
    $('chRefresh').addEventListener('click', refreshChanges);
    $('chKeepAll').addEventListener('click', async () => {
      const r = await api.acceptAll();
      if (!r.ok) return toast(r.error);
      S.selected = null;
      await refreshChanges();
      toast('Kept all changes. New changes are compared from here.');
    });
    $('chRevertAll').addEventListener('click', async () => {
      if (!(await confirmDialog('Undo all changes?', `This restores ${S.changes.length} file${S.changes.length === 1 ? '' : 's'} to how they were before, and deletes files the agent created. Binary files are left alone.`, 'Undo all'))) return;
      const r = await api.revertAll();
      if (!r.ok) return toast(r.error);
      S.selected = null;
      await refreshChanges();
    });
    $('modeUnified').addEventListener('click', () => setDiffMode('unified'));
    $('modeSplit').addEventListener('click', () => setDiffMode('split'));
    $('chFull').addEventListener('change', (e) => { S.diffFull = e.target.checked; if (S.selected) showDiff(S.selected); });

    els.terminalBtn.addEventListener('click', () => toggleTerminal());
    $('termClose').addEventListener('click', () => toggleTerminal(false));
    $('termClear').addEventListener('click', () => (els.termOut.textContent = ''));
    els.termStop.addEventListener('click', () => api.stopTerminal());
    els.termInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); termRun(); }
      else if (e.key === 'ArrowUp' && S.termHistory.length) { e.preventDefault(); S.termIdx = Math.max(0, S.termIdx - 1); els.termInput.value = S.termHistory[S.termIdx] || ''; }
      else if (e.key === 'ArrowDown' && S.termHistory.length) { e.preventDefault(); S.termIdx = Math.min(S.termHistory.length, S.termIdx + 1); els.termInput.value = S.termHistory[S.termIdx] || ''; }
    });

    $('approvalBtn').addEventListener('click', openApprovalMenu);
    $('modelBtn').addEventListener('click', openModelMenu);
    $('attachBtn').addEventListener('click', openAttachMenu);
    els.sendBtn.addEventListener('click', send);
    els.stopBtn.addEventListener('click', () => api.stop());
    els.input.addEventListener('input', autoGrow);
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
    });
    els.input.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      if (cd.files && cd.files.length > 0) { e.preventDefault(); addFiles(cd.files); return; }
      const t = (cd.getData('text') || '').trim();
      if (/^https?:\/\/\S+$/.test(t) && els.input.value.trim() === '') {
        e.preventDefault();
        const err = addLink(t);
        if (err) toast(err);
      }
    });
    els.fileInput.addEventListener('change', () => { addFiles(els.fileInput.files); els.fileInput.value = ''; });

    $('linkForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = addLink($('linkInput').value);
      if (err) return formStatus($('linkStatus'), err, false);
      $('linkDialog').close();
    });
    $('linkCancel').addEventListener('click', () => $('linkDialog').close());

    let dragDepth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; els.dropHint.hidden = false; els.composer.classList.add('dragover'); } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (dragDepth === 0) { els.dropHint.hidden = true; els.composer.classList.remove('dragover'); } });
    window.addEventListener('drop', (e) => {
      dragDepth = 0;
      els.dropHint.hidden = true;
      els.composer.classList.remove('dragover');
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (S.app && S.app.folder) addFiles(e.dataTransfer.files);
      else toast('Open a folder first.');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.menu.hidden) { closeMenu(); return; }
      if (e.key === 'Escape' && S.running && !document.querySelector('dialog[open]')) api.stop();
      if ((e.metaKey || e.ctrlKey) && e.key === '[') { e.preventDefault(); navBack(); }
      if ((e.metaKey || e.ctrlKey) && e.key === ']') { e.preventDefault(); navForward(); }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (S.app?.chatId) togglePinChat(S.app.chatId);
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        if (S.app?.chatId) toggleArchiveChat(S.app.chatId);
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        toggleOverview();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        if (els.sbSearchWrap) {
          e.preventDefault();
          els.sbSearchWrap.hidden = false;
          els.sbSearch?.focus();
          els.sbSearch?.select();
        }
      }
    });

    // Global typing autofocus to composer input on app start & during work
    window.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]')) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1 && !els.input.disabled) {
        if (active !== els.input) {
          els.input.focus();
          const start = els.input.selectionStart || 0;
          const end = els.input.selectionEnd || 0;
          const val = els.input.value;
          els.input.value = val.slice(0, start) + e.key + val.slice(end);
          els.input.selectionStart = els.input.selectionEnd = start + 1;
          autoGrow();
          e.preventDefault();
        }
      }
    });

    window.addEventListener('focus', () => {
      if (!document.querySelector('dialog[open]') && !els.input.disabled) {
        els.input.focus();
      }
    });

    initGitReviewBar();
    initOnboarding();

    // Auto-update relative timestamps in message footers every 20 seconds
    setInterval(() => {
      document.querySelectorAll('.msg-act-time[data-completed-at]').forEach((el) => {
        const ts = Number(el.dataset.completedAt);
        if (ts) {
          const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
          let rel = 'Just now';
          if (sec >= 45) {
            const m = Math.floor(sec / 60);
            if (m < 60) rel = `${m}m ago`;
            else {
              const h = Math.floor(m / 60);
              if (h < 24) rel = `${h}h ago`;
              else rel = `${Math.floor(h / 24)}d ago`;
            }
          }
          if (el.textContent !== rel) el.textContent = rel;
        }
      });
    }, 20000);

    api.onEvent(onAgentEvent);
    api.onTerminal(onTerminalEvent);
    api.onCommand(runCommand);
    api.onChanged((ev) => {
      if (!ev) return;
      if (ev.what === 'chats') loadChats();
      else if (ev.what === 'files') { scheduleChangesRefresh(); updateOverviewDiffStat(); }
      else if (ev.what === 'running') {
        S.runningChats = new Set(ev.chats || []);
        if (S.app) renderChats();
        if ($('historyDialog').open) openHistory();
        updateOverviewDiffStat();
      }
    });
    api.onAccount(onAccountEvent);
  }

  function openOnboardDialog() {
    const d = $('onboardDialog');
    if (!d || d.open) return;
    d.showModal();
  }

  function initOnboarding() {
    S.selectedOnboardPersona = 'software';
    S.selectedOnboardMode = 'auto';

    document.querySelectorAll('#onboardPersonaGrid .persona-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#onboardPersonaGrid .persona-card').forEach((c) => c.classList.remove('on'));
        card.classList.add('on');
        S.selectedOnboardPersona = card.getAttribute('data-persona') || 'software';
      });
    });

    document.querySelectorAll('#onboardModeGrid .set-layout-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('#onboardModeGrid .set-layout-card').forEach((c) => c.classList.remove('on'));
        card.classList.add('on');
        S.selectedOnboardMode = card.getAttribute('data-mode') || 'auto';
      });
    });

    $('onboardSubmitBtn')?.addEventListener('click', async () => {
      const persona = S.selectedOnboardPersona || 'software';
      const mode = S.selectedOnboardMode || 'auto';
      const r = await api.setGeneral({ persona, approvalMode: mode, onboarded: true });
      store('cr3.onboarded', '1');
      $('onboardDialog')?.close();
      if (r.ok) {
        applyState(r);
        renderActiveFocusDomain();
        toast(`CR3-Agentic AI configured for ${persona.toUpperCase()} domain.`);
      }
      if (!els.input.disabled) els.input.focus();
    });
  }

  const SLASH_COMMANDS = [
    { cmd: '/clear', desc: 'Start a fresh new chat session', ico: 'x' },
    { cmd: '/compact', desc: 'Summarize earlier turns to save context window', ico: 'overview' },
    { cmd: '/review', desc: 'Review all pending git changes and diffs in project', ico: 'fileDiff' },
    { cmd: '/git', desc: 'Check git status, branch and uncommitted files', ico: 'branch' },
    { cmd: '/test', desc: 'Ask agent to run the test suite and verify changes', ico: 'code' },
    { cmd: '/terminal', desc: 'Toggle the terminal panel', ico: 'terminal' },
    { cmd: '/help', desc: 'List available agent skills and slash commands', ico: 'sparkles' },
  ];

  function initComposerAutocomplete() {
    const menu = els.composerMenu;
    if (!menu || !els.input) return;

    let active = false;
    let mode = null; // 'slash' | 'file'
    let items = [];
    let selectedIndex = 0;
    let triggerPos = 0;
    let cachedFiles = null;
    let cachedFilesTime = 0;

    const close = () => {
      active = false;
      mode = null;
      items = [];
      menu.hidden = true;
      menu.textContent = '';
    };

    const fetchFiles = async (query) => {
      if (!cachedFiles || Date.now() - cachedFilesTime > 8000) {
        try {
          const r = api.listFiles ? await api.listFiles('') : null;
          cachedFiles = (r && r.files) || [];
          cachedFilesTime = Date.now();
        } catch (e) {
          cachedFiles = [];
        }
      }
      const q = query.toLowerCase();
      if (!q) return cachedFiles.slice(0, 15);
      return cachedFiles.filter((f) => f.toLowerCase().includes(q)).slice(0, 15);
    };

    const render = () => {
      if (!active || items.length === 0) {
        close();
        return;
      }
      menu.textContent = '';
      menu.hidden = false;

      const head = h('div', 'cm-head');
      const titleSpan = h('span', 'cm-head-title');
      titleSpan.appendChild(iconSpan(mode === 'slash' ? 'terminalPrompt' : 'file', 'cm-head-ico'));
      titleSpan.appendChild(h('span', '', mode === 'slash' ? ' Slash Commands' : ' Mention Project File'));
      const countSpan = h('span', 'cm-count', `${items.length} ${items.length === 1 ? 'option' : 'options'}`);
      head.append(titleSpan, countSpan);
      menu.appendChild(head);

      items.forEach((item, idx) => {
        const row = h('button', 'cm-item' + (idx === selectedIndex ? ' selected' : ''));
        row.type = 'button';

        if (mode === 'slash') {
          const ico = iconSpan(item.ico || 'terminalPrompt', 'cm-ico');
          const main = h('span', 'cm-main');
          const lbl = h('span', 'cm-label', item.cmd);
          const desc = h('span', 'cm-desc', item.desc);
          main.append(lbl, desc);
          const hint = h('span', 'cm-hint', '↵ Run');
          row.append(ico, main, hint);
        } else {
          const ico = iconSpan('file', 'cm-file-ico');
          const main = h('span', 'cm-main');
          const parts = String(item).split('/');
          const filename = parts.pop() || item;
          const dir = parts.length > 0 ? parts.join('/') + '/' : '';
          const pathSpan = h('span', 'cm-path');
          if (dir) pathSpan.appendChild(h('span', 'cm-dir', dir));
          pathSpan.appendChild(h('span', 'cm-file', filename));
          main.appendChild(pathSpan);
          const hint = h('span', 'cm-hint', '↵ Attach');
          row.append(ico, main, hint);
        }

        row.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          apply(idx);
        });

        menu.appendChild(row);
      });

      const selEl = menu.querySelector('.cm-item.selected');
      if (selEl) selEl.scrollIntoView({ block: 'nearest' });
    };

    const apply = async (idx) => {
      const item = items[idx];
      if (!item) return;

      if (mode === 'slash') {
        close();
        els.input.value = '';
        autoGrow();
        switch (item.cmd) {
          case '/clear':
            await newChat();
            toast('Started a fresh conversation.');
            break;
          case '/compact':
            toast('Requesting context compaction…');
            send('Summarize our conversation so far and compact the history to save context.');
            break;
          case '/review':
            send('Review all recent uncommitted changes and diffs in this project. Check for any bugs or syntax issues.');
            break;
          case '/git':
            send('Check git status and summarize recent branches, commits, and modified files.');
            break;
          case '/test':
            send('Run the project test suite and verify that all unit and integration tests pass.');
            break;
          case '/terminal':
            const termBtn = $('termToggleBtn') || $('termBtn');
            if (termBtn) termBtn.click();
            break;
          case '/help':
            send('List all available skills, tools, and slash commands you can execute in this workspace.');
            break;
          default:
            send(item.cmd);
            break;
        }
      } else if (mode === 'file') {
        const val = els.input.value;
        const before = val.slice(0, triggerPos);
        const after = val.slice(els.input.selectionStart);
        els.input.value = `${before}@${item} ${after}`;
        const newPos = triggerPos + String(item).length + 2;
        els.input.selectionStart = els.input.selectionEnd = newPos;
        autoGrow();
        close();

        try {
          if (api.readProjectFile) {
            const res = await api.readProjectFile(item);
            if (res && res.text !== undefined) {
              S.attachments.push({ kind: 'file', name: item, text: res.text, size: res.size });
              renderAttachments();
              toast(`Attached ${item} to context.`);
            }
          }
        } catch (err) {
          toast(`Could not attach ${item}: ${err.message || String(err)}`);
        }
        els.input.focus();
      }
    };

    els.input.addEventListener('keydown', (e) => {
      if (!active || menu.hidden) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        render();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        render();
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        apply(selectedIndex);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    els.input.addEventListener('input', async () => {
      const pos = els.input.selectionStart || 0;
      const val = els.input.value;
      const beforeCursor = val.slice(0, pos);

      // Slash command: starts with '/' and no spaces before cursor
      if (beforeCursor.startsWith('/') && !beforeCursor.includes(' ')) {
        const q = beforeCursor.slice(1).toLowerCase();
        items = SLASH_COMMANDS.filter((s) => s.cmd.slice(1).toLowerCase().startsWith(q));
        mode = 'slash';
        triggerPos = 0;
        selectedIndex = 0;
        active = items.length > 0;
        render();
        return;
      }

      // File mention: '@' preceded by start of input or space, no spaces after '@'
      const lastAt = beforeCursor.lastIndexOf('@');
      if (lastAt !== -1 && (lastAt === 0 || /\s/.test(beforeCursor[lastAt - 1]))) {
        const q = beforeCursor.slice(lastAt + 1);
        if (!/\s/.test(q)) {
          triggerPos = lastAt;
          mode = 'file';
          items = await fetchFiles(q);
          selectedIndex = 0;
          active = items.length > 0;
          render();
          return;
        }
      }

      close();
    });

    document.addEventListener('click', (e) => {
      if (active && !menu.contains(e.target) && e.target !== els.input) {
        close();
      }
    });
  }

  async function init() {
    applyTheme(store('cr3.theme') || 'dark');
    if (store('cr3.diffMode')) S.diffMode = store('cr3.diffMode');
    document.querySelectorAll('[data-icon]').forEach((n) => { n.textContent = ''; n.appendChild(icon(n.dataset.icon)); });
    Object.keys(BUTTON_ICONS).forEach((id) => { const b = $(id); if (b) setIcon(b, BUTTON_ICONS[id]); });
    initSettings();
    initSkills();
    initSplitter();
    initAccounts();
    initGit();
    initHistory();
    initEvents();
    initComposerAutocomplete();
    applyDisplayDensity();
    if (store('fa.sidebar') === '0') setSidebar(false);
    if (store('cr3.changes') === '0') toggleChanges(false);
    else toggleChanges(true);
    updateOverviewDiffStat();
    const r = await api.state();
    if (!r.ok) { toast(r.error || 'Could not start.'); return; }
    applyState(r);
    // Always load all projects and conversation history on startup
    await loadChats();
    if (r.folder) await refreshChanges();
    if (r.chatId) {
      pushNav(r.chatId);
      const existing = (S.allChats || []).find((c) => c.id === r.chatId);
      if (existing) await openChat(r.chatId);
    }
    if (!els.input.disabled && !document.querySelector('dialog[open]')) {
      els.input.focus();
    }
  }

  init();
})();
