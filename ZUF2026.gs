// ═══════════════════════════════════════════════════════════════
//  Zion Unity Fest 2026 — Apps Script Backend
//  Account: zccunityfest@gmail.com
//  Execute as: Me (zccunityfest@gmail.com) | Access: Anyone
// ═══════════════════════════════════════════════════════════════

const SHEET_ID     = '1JmUA5WzgHxuLnODD-96rtYtgH68dJvSaNaW5Vhp2pSI';
const EVENT_NAME   = 'Zion Unity Fest 2026';
const EVENT_DATE   = 'Saturday, October 4, 2026';
const REPLY_TO     = 'zccunityfest@gmail.com';
const NOTIFY_EMAIL = 'zccunityfest@gmail.com';
const PORTAL_URL   = 'https://atypicaltek.github.io/ZUF2026-2/ZUF2026_Portal.html';
const WEB_APP_URL  = 'https://script.google.com/macros/s/AKfycbwGvcmsrJ5lmd12dsyc5_heOMwztBhCEkwDxFUEl146beOPnm6tZf8_z7YAHVYv9CdcsQ/exec';

// ─── SHEET TAB NAMES ────────────────────────────────────────────
const TAB_MAP = {
  'food':        'Food Signups',
  'drinks':      'Drinks Signups',
  'games':       'Games Signups',
  'dj':          'DJ Signups',
  'karaoke':     'Karaoke Signups',
  'basketball':  'Basketball Signups',
  'kidgames':    'Kid Games Signups',
  'parking':     'Parking Signups',
  'setup':       'Site Setup Signups',
  'popcorn':     'Popcorn Signups',
  'pretzels':    'Pretzels Signups',
  'coordinator': 'Site Coordinators',
  'choir':       'Combined Choir',
  'tokens':        'Cancel Tokens',      // hidden — editors only
  'cancellations': 'Cancellations',
  'qrlinks':       'QR Form Links',      // hidden — editors only
  'leadership':    'Event Leadership',   // site coordinators + activity leads
};

// ─── COLUMN HEADERS PER ACTIVITY (no Token column — tokens live in Cancel Tokens tab) ──
const HEADERS = {
  food:        ['Timestamp','Site','Server Name','Phone Number','Email Address','Assigned Food Item','Availability','Allergy Notes','Status'],
  drinks:      ['Timestamp','Site','Volunteer Name','Phone Number','Email Address','Role','Time Availability','Status'],
  games:       ['Timestamp','Site','Volunteer Name','Phone Number','Email Address','Game Station','Setup Help','Status'],
  dj:          ['Timestamp','Site','Name','Email Address','Song Request','Shoutout Request','MC Volunteer','Status'],
  karaoke:     ['Timestamp','Site','Singer Name','Phone Number','Email Address','Song Choice','Backup Song','Status'],
  basketball:  ['Timestamp','Site','Team Name','Team Captain','Phone Number','Email Address','Player Names','Jersey Color','Status'],
  kidgames:    ['Timestamp','Site','Helper Name','Phone Number','Email Address','Age Group','CPR Certified','Status'],
  parking:     ['Timestamp','Site','Volunteer Name','Phone Number','Email Address','Shift Preference','Has Vest/Flashlight','Status'],
  setup:       ['Timestamp','Site','Volunteer Name','Phone Number','Email Address','Equipment','Equipment Quantity','Available For','Status'],
  popcorn:     ['Timestamp','Site','Volunteer Name','Phone Number','Email Address','Shift Preference','Prior Experience','Status'],
  pretzels:    ['Timestamp','Site','Volunteer Name','Phone Number','Email Address','Shift Preference','Prior Experience','Status'],
  coordinator: ['Timestamp','Site','Coordinator Name','Phone Number','Email Address','Role','Activity Chaired','T-Shirt Size','Dietary Restrictions','Notes','Status'],
  choir:       ['Timestamp','Site','Singer Name','Phone Number','Email Address','Voice Part','Willing to Lead','Rehearsal Available','Rehearsal Notes','Comments','Status'],
};

// ═══════════════════════════════════════════════════════════════
//  WEB APP ENTRY POINTS
// ═══════════════════════════════════════════════════════════════

function doGet(e) {
  const action   = (e.parameter.action   || '').toLowerCase();
  const token    = (e.parameter.token    || '').trim();
  const callback = (e.parameter.callback || '').trim(); // JSONP support

  if (action === 'cancel' && token) {
    const result = processCancelToken(token);
    if (callback) return jsonpOut(callback, result);
    return redirect(result.ok ? PORTAL_URL + '?msg=cancelled&who=' + encodeURIComponent(result.name||'')
                               : PORTAL_URL + '?msg=invalid');
  }
  if (action === 'update' && token) {
    const info = lookupToken(token);
    if (!info) {
      if (callback) return jsonpOut(callback, {ok:false, error:'Invalid or expired link'});
      return redirect(PORTAL_URL + '?msg=invalid');
    }
    const clink = encodeURIComponent(PORTAL_URL + '?cancel=' + token);
    if (callback) return jsonpOut(callback, {ok:true, action:'update', name:info.name, activity:info.activity, cancelUrl: PORTAL_URL + '?cancel=' + token});
    return redirect(PORTAL_URL + '?msg=update&who=' + encodeURIComponent(info.name||'') +
                    '&act=' + encodeURIComponent(info.activity||'') + '&clink=' + clink);
  }
  if (action === 'counts') {
    const data = getLiveSignupCounts();
    if (callback) return jsonpOut(callback, data);
    return jsonOut(data);
  }
  if (action === 'leadership') {
    const data = getLeadershipContacts();
    if (callback) return jsonpOut(callback, data);
    return jsonOut(data);
  }

  return redirect(PORTAL_URL);
}

function doPost(e) {
  try {
    const p        = e.parameter || {};
    const activity = (p.activity || '').toLowerCase().trim();
    if (!activity) return jsonOut({success:false, error:'Missing activity key.'});
    switch (activity) {
      case 'food':        return handleGenericPost(p, 'food');
      case 'drinks':      return handleGenericPost(p, 'drinks');
      case 'games':       return handleGenericPost(p, 'games');
      case 'dj':          return handleGenericPost(p, 'dj');
      case 'karaoke':     return handleGenericPost(p, 'karaoke');
      case 'basketball':  return handleGenericPost(p, 'basketball');
      case 'kidgames':    return handleGenericPost(p, 'kidgames');
      case 'parking':     return handleGenericPost(p, 'parking');
      case 'setup':       return handleGenericPost(p, 'setup');
      case 'popcorn':     return handleGenericPost(p, 'popcorn');
      case 'pretzels':    return handleGenericPost(p, 'pretzels');
      case 'coordinator':   return handleCoordinatorPost(p);
      case 'choir':         return handleChoirPost(p);
      case 'contactemail':  return handleContactEmail(p);
      default:              return jsonOut({success:false, error:'Unknown activity: ' + activity});
    }
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return jsonOut({success:false, error:err.toString()});
  }
}

// ═══════════════════════════════════════════════════════════════
//  GENERIC ACTIVITY HANDLER
// ═══════════════════════════════════════════════════════════════

function handleGenericPost(p, activity) {
  const headers = HEADERS[activity];
  const tabName = TAB_MAP[activity];
  const token   = generateToken();
  const email   = findVal(p, ['email address','email']);
  const name    = findVal(p, ['volunteer name','server name','singer name','helper name',
                               'team captain','name','full name']);
  const site    = findVal(p, ['site','which site are you from?']);

  // Build row (no Token column — token lives in Cancel Tokens tab only)
  const row = [new Date()];
  headers.slice(1, -1).forEach(function(h) {
    row.push(p[h] || findVal(p, [h.toLowerCase()]) || '');
  });
  row.push('Active'); // Status

  const sheet  = getOrCreateSheet(tabName, headers);
  sheet.appendRow(row);
  const rowNum = sheet.getLastRow(); // row number for cancel lookup

  storeToken(token, activity, tabName, name, email, site, rowNum);

  if (email) {
    const label = tabName.replace(' Signups','').replace('Combined ','');
    sendConfirmationEmail(email, name, site, label, p, token);
  }

  Logger.log('Signup recorded — activity:' + activity + ' email:' + email);
  return jsonOut({success:true, message:'Signup recorded!'});
}

// ═══════════════════════════════════════════════════════════════
//  SITE COORDINATOR HANDLER
// ═══════════════════════════════════════════════════════════════

function handleCoordinatorPost(p) {
  const token = generateToken();
  const email = findVal(p, ['email address','email']);
  const name  = findVal(p, ['coordinator name','your name','name','full name']);
  const site  = findVal(p, ['site']);
  const role  = findVal(p, ['role']);
  const activ = findVal(p, ['activity chaired']);

  const headers = HEADERS['coordinator'];
  const row = [
    new Date(), site, name,
    findVal(p, ['phone number','phone']),
    email, role, activ || '',
    findVal(p, ['t-shirt size','tshirt size']) || '',
    findVal(p, ['dietary restrictions']) || '',
    findVal(p, ['notes']) || '',
    'Active',
  ];

  const sheet  = getOrCreateSheet(TAB_MAP['coordinator'], headers);
  sheet.appendRow(row);
  const rowNum = sheet.getLastRow();

  storeToken(token, 'coordinator', TAB_MAP['coordinator'], name, email, site, rowNum);
  if (email) sendCoordinatorEmail(email, name, site, role, activ, p, token);

  Logger.log('Coordinator signup — name:' + name + ' site:' + site);
  return jsonOut({success:true, message:'Coordinator registration recorded!'});
}

// ═══════════════════════════════════════════════════════════════
//  COMBINED CHOIR HANDLER
// ═══════════════════════════════════════════════════════════════

function handleChoirPost(p) {
  const token = generateToken();
  const email = findVal(p, ['email address','email']);
  const name  = findVal(p, ['singer name','name','full name']);
  const site  = findVal(p, ['site']);

  const headers = HEADERS['choir'];
  const row = [
    new Date(), site, name,
    findVal(p, ['phone number','phone']),
    email,
    findVal(p, ['voice part']),
    findVal(p, ['willing to lead']),
    findVal(p, ['rehearsal available']),
    findVal(p, ['rehearsal notes']) || '',
    findVal(p, ['comments']) || '',
    'Active',
  ];

  const sheet  = getOrCreateSheet(TAB_MAP['choir'], headers);
  sheet.appendRow(row);
  const rowNum = sheet.getLastRow();

  storeToken(token, 'choir', TAB_MAP['choir'], name, email, site, rowNum);
  if (email) sendChoirEmail(email, name, site, p, token);

  Logger.log('Choir signup — name:' + name + ' site:' + site);
  return jsonOut({success:true, message:'Choir signup recorded!'});
}

// ═══════════════════════════════════════════════════════════════
//  CANCEL / UPDATE HANDLERS
// ═══════════════════════════════════════════════════════════════

function processCancelToken(token) {
  const info = lookupToken(token);
  if (!info) return {ok:false, error:'Invalid or expired link'};
  markRowStatus(info.tabName, info.rowNum, 'Cancelled');
  markTokenUsed(token, 'Cancelled');
  logCancellation(info.name, info.email, info.site, info.activity, token);
  if (info.email) sendCancellationEmail(info.email, info.name, info.site, info.activity, token);
  return {ok:true, name: info.name||'', activity: info.activity||'', site: info.site||''};
}

function handleCancelGet(token) {
  const result = processCancelToken(token);
  const name = encodeURIComponent(result.name || '');
  return redirect(result.ok ? PORTAL_URL + '?msg=cancelled&who=' + name : PORTAL_URL + '?msg=invalid');
}

function handleUpdateGet(token) {
  const info = lookupToken(token);
  if (!info) {
    return HtmlService.createHtmlOutput(pageWrap('Invalid or Expired Link',
      '<p>This update link is invalid or has already been used.</p>' +
      '<p><a href="' + PORTAL_URL + '">Return to signup portal</a></p>'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  var updatePage = HtmlService.createHtmlOutput(pageWrap('Update Your Signup',
    '<p>Hello <strong>' + escHtml(info.name) + '</strong>,</p>' +
    '<p>To update your <strong>' + escHtml(info.activity) + '</strong> signup, please:</p>' +
    '<ol>' +
    '<li>Click "Cancel" below to remove your current signup.</li>' +
    '<li>Return to the portal and submit a new signup with your updated information.</li>' +
    '</ol>' +
    '<p><a href="' + PORTAL_URL + '?cancel=' + token + '" ' +
    'style="display:inline-block;padding:12px 24px;background:#7B0000;color:#fff;' +
    'border-radius:8px;text-decoration:none;font-weight:bold;">Cancel Current Signup</a> &nbsp; ' +
    '<a href="' + PORTAL_URL + '" style="display:inline-block;padding:12px 24px;background:#2F5496;' +
    'color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">Go to Signup Portal</a></p>'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return updatePage;
}

// ═══════════════════════════════════════════════════════════════
//  EMAIL FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function sendConfirmationEmail(email, name, site, activityLabel, params, token) {
  const cancelUrl  = PORTAL_URL + '?cancel=' + token;
  const updateUrl  = PORTAL_URL + '?update=' + token + '&act=' + encodeURIComponent(activityLabel);
  let detailsHtml = '';
  const skip = ['activity','token','status'];
  Object.keys(params).forEach(function(k) {
    if (skip.indexOf(k.toLowerCase()) >= 0) return;
    if (!params[k]) return;
    detailsHtml += '<tr><td style="padding:6px 12px;font-weight:bold;color:#1F3864;white-space:nowrap">' +
                   escHtml(k) + '</td><td style="padding:6px 12px">' + escHtml(params[k]) + '</td></tr>';
  });
  const subject = EVENT_NAME + ' - ' + activityLabel + ' Signup Confirmed';
  const html = emailWrap(name,
    '<p>Your <strong>' + escHtml(activityLabel) + '</strong> volunteer signup for ' +
    '<strong>' + EVENT_NAME + '</strong> on <strong>' + EVENT_DATE + '</strong> has been recorded!</p>' +
    '<h3 style="color:#1F3864;margin:20px 0 8px">Your Signup Details</h3>' +
    '<table style="border-collapse:collapse;width:100%;background:#f8f9fd;border-radius:8px;overflow:hidden">' +
    detailsHtml + '</table>' +
    '<p style="margin-top:20px">Need to make a change? Use the links below:</p>' +
    btnRow(updateUrl, 'Update My Signup', '#2F5496') +
    btnRow(cancelUrl, 'Cancel My Signup', '#c0392b') +
    '<p style="font-size:.85rem;color:#888;margin-top:20px">To update your signup via email, simply reply to this message with your changes.</p>' +
    btnRow(PORTAL_URL, 'Return to Volunteer Signup Portal', '#1F3864')
  );
  GmailApp.sendEmail(email, subject, 'Your ' + activityLabel + ' signup for ' + EVENT_NAME + ' is confirmed.', {
    htmlBody: html, replyTo: REPLY_TO, name: EVENT_NAME + ' Volunteers', bcc: NOTIFY_EMAIL,
  });
}

function sendCoordinatorEmail(email, name, site, role, activityChaired, params, token) {
  const cancelUrl = PORTAL_URL + '?cancel=' + token;
  const updateUrl = PORTAL_URL + '?update=' + token + '&act=Site%20Coordinator';
  const roleDetail = activityChaired ? role + ' — Activity Chaired: ' + activityChaired : role;
  const subject = EVENT_NAME + ' - Site Coordinator Registration Confirmed';
  const html = emailWrap(name,
    '<p>Your <strong>Site Coordinator registration</strong> for <strong>' + EVENT_NAME + '</strong> ' +
    'on <strong>' + EVENT_DATE + '</strong> has been received!</p>' +
    '<table style="border-collapse:collapse;width:100%;background:#fff3f3;border-radius:8px;overflow:hidden">' +
    '<tr><td style="padding:6px 12px;font-weight:bold;color:#7B0000">Site</td><td style="padding:6px 12px">' + escHtml(site) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;font-weight:bold;color:#7B0000">Role</td><td style="padding:6px 12px">' + escHtml(roleDetail) + '</td></tr>' +
    '</table>' +
    '<p style="margin-top:16px">As a Site Coordinator you\'ll receive event updates and coordination materials directly.</p>' +
    btnRow(updateUrl, 'Update My Registration', '#2F5496') +
    btnRow(cancelUrl, 'Cancel My Registration', '#c0392b') +
    btnRow(PORTAL_URL, 'Return to Volunteer Signup Portal', '#1F3864')
  );
  GmailApp.sendEmail(email, subject, 'Your Site Coordinator registration for ' + EVENT_NAME + ' is confirmed.', {
    htmlBody: html, replyTo: REPLY_TO, name: EVENT_NAME + ' Volunteers', bcc: NOTIFY_EMAIL,
  });
}

function sendChoirEmail(email, name, site, params, token) {
  const cancelUrl = PORTAL_URL + '?cancel=' + token;
  const updateUrl = PORTAL_URL + '?update=' + token + '&act=Combined%20Choir';
  const subject = EVENT_NAME + ' - Combined Choir Signup Confirmed';
  const html = emailWrap(name,
    '<p>Welcome to the <strong>' + EVENT_NAME + ' Combined Choir!</strong> Your signup has been recorded.</p>' +
    '<table style="border-collapse:collapse;width:100%;background:#f3f0ff;border-radius:8px;overflow:hidden">' +
    '<tr><td style="padding:6px 12px;font-weight:bold;color:#8B0000">Site</td><td style="padding:6px 12px">' + escHtml(site) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;font-weight:bold;color:#8B0000">Voice Part</td><td style="padding:6px 12px">' + escHtml(findVal(params,['voice part'])) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;font-weight:bold;color:#8B0000">Willing to Lead</td><td style="padding:6px 12px">' + escHtml(findVal(params,['willing to lead'])) + '</td></tr>' +
    '<tr><td style="padding:6px 12px;font-weight:bold;color:#8B0000">Available for Rehearsal</td><td style="padding:6px 12px">' + escHtml(findVal(params,['rehearsal available'])) + '</td></tr>' +
    '</table>' +
    btnRow(updateUrl, 'Update My Choir Signup', '#8B0000') +
    btnRow(cancelUrl, 'Cancel My Choir Signup', '#c0392b') +
    btnRow(PORTAL_URL, 'Return to Volunteer Signup Portal', '#1F3864')
  );
  GmailApp.sendEmail(email, subject, 'Your Combined Choir signup for ' + EVENT_NAME + ' is confirmed.', {
    htmlBody: html, replyTo: REPLY_TO, name: EVENT_NAME + ' Choir', bcc: NOTIFY_EMAIL,
  });
}

function sendCancellationEmail(email, name, site, activity, token) {
  const subject = EVENT_NAME + ' - ' + activity + ' Signup Cancelled';
  const html = emailWrap(name,
    '<p>Your <strong>' + escHtml(activity) + '</strong> signup for <strong>' + EVENT_NAME + '</strong> ' +
    'on <strong>' + EVENT_DATE + '</strong> from <strong>' + escHtml(site) + '</strong> has been <strong>cancelled</strong>.</p>' +
    '<p style="color:#888">Changed your mind? You can sign up again at the portal below.</p>' +
    btnRow(PORTAL_URL, 'Sign Up Again at the Portal', '#2F5496')
  );
  GmailApp.sendEmail(email, subject, 'Your ' + activity + ' signup for ' + EVENT_NAME + ' has been cancelled.', {
    htmlBody: html, replyTo: REPLY_TO, name: EVENT_NAME + ' Volunteers', bcc: NOTIFY_EMAIL,
  });
}

// ═══════════════════════════════════════════════════════════════
//  TOKEN SYSTEM
//  Tokens tab columns: Token | Activity | Tab | Name | Email | Site | Row | Created | Status
// ═══════════════════════════════════════════════════════════════

function generateToken() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 24);
}

function storeToken(token, activity, tabName, name, email, site, rowNum) {
  const sheet = getOrCreateSheet(TAB_MAP['tokens'],
    ['Token','Activity','Tab','Name','Email','Site','Row','Created','Status']);
  sheet.appendRow([token, activity, tabName, name||'', email||'', site||'', rowNum||'', new Date(), 'Active']);
}

function lookupToken(token) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(TAB_MAP['tokens']);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  // Cols: 0=Token,1=Activity,2=Tab,3=Name,4=Email,5=Site,6=Row,7=Created,8=Status
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === token && data[i][8] === 'Active') {
      return {
        token:    token,
        activity: data[i][1],
        tabName:  data[i][2],
        name:     data[i][3],
        email:    data[i][4],
        site:     data[i][5],
        rowNum:   data[i][6],
      };
    }
  }
  return null;
}

function markTokenUsed(token, status) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(TAB_MAP['tokens']);
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      sheet.getRange(i + 1, 9).setValue(status || 'Used'); // col 9 = Status
      return;
    }
  }
}

function logCancellation(name, email, site, activity, token) {
  const sheet = getOrCreateSheet(TAB_MAP['cancellations'],
    ['Cancelled At','Name','Email','Site','Activity','Token']);
  sheet.appendRow([new Date(), name||'', email||'', site||'', activity||'', token]);
}

// markRowStatus now uses stored row number directly (no Token column in activity sheets)
function markRowStatus(tabName, rowNum, status) {
  if (!rowNum) return;
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  const hdr   = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const sIdx  = hdr.indexOf('Status');
  if (sIdx < 0) return;
  sheet.getRange(rowNum, sIdx + 1).setValue(status);
  // Highlight cancelled rows pink, clear highlight if re-activated
  const rowRange = sheet.getRange(rowNum, 1, 1, lastCol);
  if (status === 'Cancelled') {
    rowRange.setBackground('#FFB6C1'); // light pink
  } else if (status === 'Active') {
    rowRange.setBackground(null); // clear highlight
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHEET HELPERS
// ═══════════════════════════════════════════════════════════════

function getSpreadsheet() {
  return SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
           .setFontWeight('bold').setBackground('#1F3864').setFontColor('#fff');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ═══════════════════════════════════════════════════════════════
//  QR FORM LINKS TAB — hidden, editor-only
// ═══════════════════════════════════════════════════════════════

function initQRLinksSheet() {
  const baseUrl = PORTAL_URL;
  const activities = [
    {id:'f1',  key:'food',        label:'Food Signup'},
    {id:'f2',  key:'drinks',      label:'Drinks Signup'},
    {id:'f3',  key:'games',       label:'Games Signup'},
    {id:'f4',  key:'dj',          label:'DJ / Music'},
    {id:'f5',  key:'karaoke',     label:'Karaoke Signup'},
    {id:'f6',  key:'basketball',  label:'Basketball Signup'},
    {id:'f7',  key:'kidgames',    label:'Kid Games Signup'},
    {id:'f8',  key:'parking',     label:'Parking Signup'},
    {id:'f9',  key:'setup',       label:'Site Setup Signup'},
    {id:'f10', key:'popcorn',     label:'Popcorn Machine Signup'},
    {id:'f11', key:'pretzels',    label:'Pretzels Signup'},
    {id:'f12', key:'coordinator', label:'Site Coordinator Signup'},
    {id:'f13', key:'choir',       label:'Combined Choir Signup'},
  ];

  const ss     = getSpreadsheet();
  let   sheet  = ss.getSheetByName(TAB_MAP['qrlinks']);
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet(TAB_MAP['qrlinks']);

  const headers = ['Activity','Form Link','Embed Code (iframe)'];
  sheet.getRange(1, 1, 1, 3).setValues([headers])
       .setFontWeight('bold').setBackground('#8B0000').setFontColor('#fff');
  sheet.setFrozenRows(1);

  const rows = activities.map(function(a) {
    const url        = baseUrl + '#' + a.id;
    const embedCode  = '<iframe src="' + url + '" width="100%" height="700" frameborder="0" allowfullscreen></iframe>';
    return [a.label, url, embedCode];
  });

  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 400);
  sheet.setColumnWidth(3, 500);
  sheet.hideSheet(); // hidden from viewers; editors: Format → Hidden sheets
  return sheet;
}

// ═══════════════════════════════════════════════════════════════
//  LIVE SIGNUP COUNTS (for dashboard)
// ═══════════════════════════════════════════════════════════════

function getLiveSignupCounts() {
  const ss       = getSpreadsheet();
  const result   = {};
  const bySite   = {};
  const skip     = ['tokens','cancellations','qrlinks'];
  const SITE_KEYS = ['cathedral','newbeg','newport','hampton','kecoughtan','ingleside','norfolk','franklin'];
  const SITE_NAMES = ['The Cathedral','New Beginnings','Newport News','Downtown Hampton',
                      'Kecoughtan Road','Ingleside Road','Port Norfolk','Downtown Franklin'];

  // Init bySite counts
  SITE_KEYS.forEach(function(k){ bySite[k] = 0; });

  Object.keys(TAB_MAP).forEach(function(key) {
    if (skip.indexOf(key) >= 0) return;
    const sheet = ss.getSheetByName(TAB_MAP[key]);
    if (!sheet || sheet.getLastRow() < 2) { result[key] = 0; return; }

    const data   = sheet.getDataRange().getValues();
    const hdr    = data[0];
    const siteIdx   = hdr.indexOf('Site');
    const statusIdx = hdr.indexOf('Status');
    var activeCount = 0;

    for (var i = 1; i < data.length; i++) {
      var status = statusIdx >= 0 ? (data[i][statusIdx] || '').toString().trim() : 'Active';
      if (status !== 'Active') continue;
      activeCount++;
      // Count by site
      if (siteIdx >= 0) {
        var siteName = (data[i][siteIdx] || '').toString().trim();
        var siteKeyIdx = SITE_NAMES.indexOf(siteName);
        if (siteKeyIdx >= 0) {
          bySite[SITE_KEYS[siteKeyIdx]]++;
        }
      }
    }
    result[key] = activeCount;
  });

  result.bySite = bySite;
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  EVENT LEADERSHIP CONTACTS
//  Sheet: "Event Leadership"
//  Columns: Type | Site | Activity | Name | Phone | Email | Notes
//  Type values:
//    "Site Coordinator"   — one per site (Site required, Activity blank)
//    "Site Activity Lead" — per site per activity (Site + Activity required)
//    "Project Lead"       — project-wide activity lead (Activity required, Site blank)
// ═══════════════════════════════════════════════════════════════

function initLeadershipSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(TAB_MAP['leadership']);
  if (!sheet) {
    sheet = ss.insertSheet(TAB_MAP['leadership']);
  } else {
    // Preserve existing data — just ensure header row is correct
    if (sheet.getLastRow() > 0) {
      var existing = sheet.getRange(1,1,1,7).getValues()[0];
      if (existing[0] === 'Type') return sheet; // already initialized
    }
    sheet.clearContents();
  }
  const headers = ['Type','Site','Activity','Name','Phone','Email','Notes'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight('bold').setBackground('#8B0000').setFontColor('#fff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 160); // Type
  sheet.setColumnWidth(2, 160); // Site
  sheet.setColumnWidth(3, 160); // Activity
  sheet.setColumnWidth(4, 160); // Name
  sheet.setColumnWidth(5, 130); // Phone
  sheet.setColumnWidth(6, 200); // Email
  sheet.setColumnWidth(7, 220); // Notes

  // Data validation for Type column
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Site Coordinator','Site Activity Lead','Project Lead'], true)
    .build();
  sheet.getRange(2, 1, 500, 1).setDataValidation(typeRule);

  // Data validation for Site column
  const siteList = ['The Cathedral','New Beginnings','Newport News','Downtown Hampton',
                    'Kecoughtan Road','Ingleside Road','Port Norfolk','Downtown Franklin'];
  const siteRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(siteList, true).build();
  sheet.getRange(2, 2, 500, 1).setDataValidation(siteRule);

  // Data validation for Activity column
  const actList = ['Food Station','Drinks','Games','DJ / Music','Karaoke',
                   'Basketball Tournament','Kid Games','Parking','Site Setup',
                   'Popcorn Machine','Pretzels','Combined Choir'];
  const actRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(actList, true).build();
  sheet.getRange(2, 3, 500, 1).setDataValidation(actRule);

  return sheet;
}

function getLeadershipContacts() {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(TAB_MAP['leadership']);
  const result = { siteCoordinators: [], siteActivityLeads: [], projectLeads: [] };
  if (!sheet || sheet.getLastRow() < 2) return result;

  const data = sheet.getDataRange().getValues();
  // Cols: 0=Type, 1=Site, 2=Activity, 3=Name, 4=Phone, 5=Email, 6=Notes
  // NOTE: email is intentionally NOT returned to the client — only cIdx is returned
  // so the frontend can request an email to be sent without ever seeing the address.
  for (var i = 1; i < data.length; i++) {
    const type = (data[i][0] || '').toString().trim();
    if (!type) continue;
    const name  = (data[i][3] || '').toString().trim();
    const email = (data[i][5] || '').toString().trim();
    if (!name) continue; // skip empty rows
    const row = {
      cIdx:     i,                                       // data-row index; used by handleContactEmail to look up email
      site:     (data[i][1] || '').toString().trim(),
      activity: (data[i][2] || '').toString().trim(),
      name:     name,
      phone:    (data[i][4] || '').toString().trim(),
      hasEmail: email.length > 0,                       // let frontend know if email button should show
      notes:    (data[i][6] || '').toString().trim(),
    };
    if (type === 'Site Coordinator')        result.siteCoordinators.push(row);
    else if (type === 'Site Activity Lead') result.siteActivityLeads.push(row);
    else if (type === 'Project Lead')       result.projectLeads.push(row);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  FIND VALUE HELPER
// ═══════════════════════════════════════════════════════════════

function findVal(params, keys) {
  for (var i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (params[k] !== undefined && params[k] !== '') return params[k];
    const kl = k.toLowerCase();
    for (var pk in params) {
      if (pk.toLowerCase() === kl && params[pk] !== '') return params[pk];
    }
  }
  for (var i = 0; i < keys.length; i++) {
    const kl = keys[i].toLowerCase();
    for (var pk in params) {
      if (pk.toLowerCase().indexOf(kl) >= 0 && params[pk] !== '') return params[pk];
    }
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════
//  CONTACT EMAIL HANDLER
//  Sends message to a contact via their sheet row index (cIdx).
//  The contact's email is NEVER exposed to the portal frontend.
//  All replies are directed to zccunityfest@gmail.com.
// ═══════════════════════════════════════════════════════════════

function handleContactEmail(p) {
  const cIdx       = parseInt(p.cIdx || '-1', 10);
  const senderName = (p.senderName || '').toString().trim();
  const subject    = (p.subject    || '').toString().trim();
  const message    = (p.message    || '').toString().trim();

  if (cIdx < 1 || !senderName || !subject || !message) {
    return jsonOut({ok: false, error: 'Missing required fields.'});
  }

  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(TAB_MAP['leadership']);
  if (!sheet || sheet.getLastRow() < cIdx + 1) {
    return jsonOut({ok: false, error: 'Contact not found.'});
  }

  // cIdx is the data-array index (1 = first data row = sheet row 2)
  const rowData     = sheet.getRange(cIdx + 1, 1, 1, 6).getValues()[0];
  const contactEmail = (rowData[5] || '').toString().trim();
  const contactName  = (rowData[3] || '').toString().trim();

  if (!contactEmail) {
    return jsonOut({ok: false, error: 'No email address on file for this contact.'});
  }

  const body =
    'You have received a message via the Zion Unity Fest 2026 volunteer portal.\n\n' +
    'From: ' + senderName + '\n' +
    'To: ' + contactName + '\n\n' +
    '─────────────────────────────────\n' +
    message + '\n' +
    '─────────────────────────────────\n\n' +
    'To reply, send email to: zccunityfest@gmail.com\n' +
    'This message was sent via the ZUF 2026 Portal.';

  MailApp.sendEmail({
    to:      contactEmail,
    cc:      'zccunityfest@gmail.com',
    replyTo: 'zccunityfest@gmail.com',
    subject: '[ZUF 2026] ' + subject,
    body:    body,
  });

  return jsonOut({ok: true});
}

// ═══════════════════════════════════════════════════════════════
//  QR CODE LINKS SHEET (printable stationery)
//  Creates / refreshes a visible "QR Code Links" sheet in the
//  master spreadsheet with activity names, URLs, and embedded
//  QR images (via Google Charts API) ready for printing.
// ═══════════════════════════════════════════════════════════════

function setupQRSheet() {
  const ss = getSpreadsheet();
  var sheet = ss.getSheetByName('QR Code Links');
  if (!sheet) sheet = ss.insertSheet('QR Code Links');
  sheet.clearContents();
  sheet.clearFormats();

  const baseUrl  = PORTAL_URL + '#';
  const TAB_KEYS = ['f1','f2','f3','f4','f5','f6','f7','f8','f9','f10','f11','f12','f13'];
  const LABELS   = [
    'Food Servers','Drinks','Games','DJ / Music','Karaoke',
    'Basketball (Teams)','Kid Games','Parking','Site Setup',
    'Popcorn Machine','Pretzels','Site Coordinator','Choir Sign-Up'
  ];

  // Header row
  sheet.getRange(1, 1, 1, 3).setValues([['Activity', 'Signup URL', 'QR Code (scan to open)']]);
  sheet.getRange(1, 1, 1, 3)
    .setFontWeight('bold')
    .setBackground('#8B0000')
    .setFontColor('#ffffff')
    .setFontSize(11);

  // Data rows
  for (var i = 0; i < LABELS.length; i++) {
    const url    = baseUrl + TAB_KEYS[i];
    const qrUrl  = 'https://chart.googleapis.com/chart?chs=160x160&cht=qr&chl=' + encodeURIComponent(url) + '&choe=UTF-8';
    const shRow  = i + 2;
    sheet.getRange(shRow, 1).setValue(LABELS[i]).setFontWeight('bold');
    sheet.getRange(shRow, 2).setValue(url).setFontColor('#1155CC').setWrap(true);
    sheet.getRange(shRow, 3).setFormula('=IMAGE("' + qrUrl + '",1)');
    sheet.setRowHeight(shRow, 170);
  }

  // Column widths
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 420);
  sheet.setColumnWidth(3, 175);
  sheet.setFrozenRows(1);

  SpreadsheetApp.flush();
  Logger.log('QR Code Links sheet updated with ' + LABELS.length + ' entries.');
}

// ═══════════════════════════════════════════════════════════════
//  INIT ALL SHEETS
// ═══════════════════════════════════════════════════════════════

function initAllSheets() {
  // Create all activity tabs (no Token column)
  Object.keys(HEADERS).forEach(function(key) {
    getOrCreateSheet(TAB_MAP[key], HEADERS[key]);
  });

  // Cancel Tokens tab — hidden
  const tokSheet = getOrCreateSheet(TAB_MAP['tokens'],
    ['Token','Activity','Tab','Name','Email','Site','Row','Created','Status']);
  tokSheet.hideSheet();

  // Cancellations tab
  getOrCreateSheet(TAB_MAP['cancellations'],
    ['Cancelled At','Name','Email','Site','Activity','Token']);

  // QR Form Links tab — hidden
  initQRLinksSheet();

  // Event Leadership tab — visible, manually filled
  initLeadershipSheet();

  // QR Code Links tab — printable stationery sheet
  setupQRSheet();

  try {
    SpreadsheetApp.getUi().alert(
      '✅ All sheets initialized!\n\n' +
      '• 13 activity tabs (no Token column)\n' +
      '• Cancel Tokens tab (hidden)\n' +
      '• Cancellations tab\n' +
      '• QR Form Links tab (hidden)\n' +
      '• Event Leadership tab (fill in coordinators here)\n' +
      '• QR Code Links tab (printable QR codes for stationery)\n\n' +
      'To view hidden tabs: Format → Hidden sheets'
    );
  } catch(e) {
    Logger.log('All sheets initialized.');
  }
}

// ═══════════════════════════════════════════════════════════════
//  HTML / EMAIL TEMPLATE HELPERS
// ═══════════════════════════════════════════════════════════════

function emailWrap(name, bodyHtml) {
  return '<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f5f6fa">' +
    '<div style="background:#8B0000;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center">' +
    '<h2 style="margin:0">⛪ ' + EVENT_NAME + '</h2>' +
    '<p style="margin:4px 0 0;opacity:.8">' + EVENT_DATE + '</p></div>' +
    '<div style="background:#fff;padding:24px;border-radius:0 0 10px 10px;box-shadow:0 2px 8px rgba(0,0,0,.1)">' +
    '<p>Hi <strong>' + escHtml(name || 'Volunteer') + '</strong>,</p>' +
    bodyHtml +
    '<hr style="margin:24px 0;border:none;border-top:1px solid #eee">' +

    '<p style="font-size:.8rem;color:#888">Questions? Reply to this email — ' +
    '<a href="mailto:' + REPLY_TO + '" style="color:#6D28D9">' + REPLY_TO + '</a></p>' +
    '</div></body></html>';
}

// ── REDIRECT HELPER ─────────────────────────────────────────────
function redirect(url) {
  const html = '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0;url=' + url + '">' +
    '</head><body><p>Redirecting... <a href="' + url + '">Click here</a> if not redirected.</p></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function pageWrap(title, bodyHtml) {
  return '<!DOCTYPE html><html><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escHtml(title) + '</title>' +
    '<style>' +
      'body{font-family:Arial,sans-serif;max-width:560px;margin:40px auto;padding:20px 24px;background:#f5f6fa;color:#222}' +
      'h2{color:#8B0000;margin-bottom:16px}' +
      'a{color:#6D28D9}' +
      'p{line-height:1.6;margin:0 0 14px}' +
    '</style>' +
    '</head>' +
    '<body>' +
    '<h2>' + escHtml(title) + '</h2>' +
    bodyHtml +
    '<p style="margin-top:28px"><a href="' + PORTAL_URL + '">Return to Signup Portal</a></p>' +
    '</body></html>';
}

function btnRow(url, label, bg) {
  return '<p><a href="' + url + '" style="display:inline-block;padding:12px 24px;background:' + bg +
         ';color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:.95rem">' +
         label + '</a></p>';
}

function escHtml(s) {
  return (s || '').toString()
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
         .setMimeType(ContentService.MimeType.JSON);
}

function jsonpOut(callback, obj) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
         .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ═══════════════════════════════════════════════════════════════
//  TEST FUNCTION
// ═══════════════════════════════════════════════════════════════

function testEmail() {
  GmailApp.sendEmail(
    NOTIFY_EMAIL,
    'ZUF2026 Script Connected',
    'The Zion Unity Fest 2026 Apps Script is connected and email is working.',
    {
      htmlBody: emailWrap('Test User',
        '<p>This is a test email confirming that the ZUF2026 Apps Script is properly connected and can send emails.</p>' +
        '<p>Web App URL: ' + WEB_APP_URL + '</p>'
      ),
      replyTo: REPLY_TO,
      name: EVENT_NAME,
    }
  );
  Logger.log('Test email sent to ' + NOTIFY_EMAIL);
  try { SpreadsheetApp.getUi().alert('✅ Test email sent to ' + NOTIFY_EMAIL); } catch(e) {}
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⛪ ZUF 2026')
      .addItem('Initialize All Sheets',     'initAllSheets')
      .addItem('Rebuild QR Links Tab',       'initQRLinksSheet')
      .addItem('Initialize Leadership Tab',  'initLeadershipSheet')
      .addItem('Send Test Email',            'testEmail')
      .addToUi();
  } catch(e) {}
}
