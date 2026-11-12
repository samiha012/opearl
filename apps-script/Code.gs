/**
 * OPearl job application backend (Google Apps Script web app).
 *
 * Receives the JSON that application.html POSTs, validates it, saves the CV
 * to a private Drive folder and appends one row to the "Applications" tab of
 * the Google Sheet this script is bound to.
 *
 * Response contract (what application.html expects):
 *   success -> { ok: true,  refId: "OP-251111-7K3Q" }
 *   failure -> { ok: false, code: "PHONE" | "DUPLICATE" | ... }
 *
 * Setup: see apps-script/README.md.
 */

const SHEET_NAME = 'Applications';
const CV_FOLDER_NAME = 'OPearl Applications - CVs';
const MAX_CV_BYTES = 5 * 1024 * 1024;
const MIN_AGE = 18;
const MAX_AGE = 60;

const JOB_CATEGORIES = [
  'Japan - White Collar',
  'Japan - Caregiver',
  'Japan - Blue Collar',
  'Malaysia - White Collar',
  'Malaysia - Blue Collar',
  'Japan - University (Undergraduate & MBA)',
  'Japan - Language School',
  'Japan - Online University',
  'Malaysia - University (Undergraduate)',
];

// "Apply" = free application, "Appointment" = one-to-one appointment request
const REQUEST_TYPES = ['Apply', 'Appointment'];

const CV_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// [header, field in the submitted JSON (or a computed key)]
const COLUMNS = [
  ['Submitted At', '_submittedAt'],
  ['Reference ID', '_refId'],
  ['Status', '_status'],
  ['Job Category', 'jobCategory'],
  ['Full Name', 'fullName'],
  ['Phone', 'phone'],
  ['WhatsApp', 'whatsapp'],
  ['Email', 'email'],
  ['Date of Birth', 'dob'],
  ['Age', '_age'],
  ['Gender', 'gender'],
  ['District', 'district'],
  ['Address', 'address'],
  ['Education', 'education'],
  ['Subject', 'subject'],
  ['Passport', 'passport'],
  ['Japanese Level', 'japaneseLevel'],
  ['English Level', 'englishLevel'],
  ['Caregiving', 'caregiving'],
  ['Trade', 'trade'],
  ['Experience (Years)', 'experienceYears'],
  ['Experience Details', 'experience'],
  ['Heard About Us', 'source'],
  ['CV', '_cvUrl'],
  ['Form Language', 'lang'],
  ['Request Type', 'requestType'],
  ['Preferred Time', 'preferredTime'],
];

/* ------------------------------------------------------------------ */
/* Run once from the editor: creates the tab, headers and CV folder.  */
/* ------------------------------------------------------------------ */
function setup() {
  const sheet = getSheet_();
  const folder = getCvFolder_();
  Logger.log('Sheet tab ready: ' + sheet.getName());
  Logger.log('CV folder: ' + folder.getUrl());
}

/* ------------------------------------------------------------------ */
/* Web app entry points                                               */
/* ------------------------------------------------------------------ */
function doGet() {
  return json_({ ok: true, service: 'opearl-applications' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return fail_('SERVER');
  }

  // Honeypot: real users never fill the hidden "website" field.
  // Pretend success so bots don't retry.
  if (str_(data.website)) return json_({ ok: true, refId: makeRefId_() });

  const invalid = validate_(data);
  if (invalid) return fail_(invalid);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return fail_('BUSY');

  try {
    const sheet = getSheet_();

    if (isDuplicate_(sheet, data.phone, data.jobCategory, data.requestType)) return fail_('DUPLICATE');

    const refId = makeRefId_();
    let cvUrl = '';
    if (data.cv && data.cv.base64) {
      const cvResult = saveCv_(data.cv, refId, data.fullName);
      if (cvResult.error) return fail_(cvResult.error);
      cvUrl = cvResult.url;
    }

    const computed = {
      _submittedAt: Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd HH:mm:ss'),
      _refId: refId,
      _status: 'New',
      _age: String(ageFrom_(data.dob)),
      _cvUrl: cvUrl,
    };

    const row = COLUMNS.map(([, key]) =>
      safeCell_(key in computed ? computed[key] : str_(data[key])),
    );
    sheet.appendRow(row);

    return json_({ ok: true, refId: refId });
  } catch (err) {
    console.error(err);
    return fail_('SERVER');
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Validation (mirrors the checks in application.html)                */
/* ------------------------------------------------------------------ */
function validate_(d) {
  if (JOB_CATEGORIES.indexOf(str_(d.jobCategory)) === -1) return 'JOB';
  if (!str_(d.requestType)) d.requestType = 'Apply';
  if (REQUEST_TYPES.indexOf(str_(d.requestType)) === -1) return 'SERVER';
  if (d.requestType !== 'Appointment') d.preferredTime = '';
  if (str_(d.fullName).length < 2) return 'NAME';

  d.phone = normalizeBdPhone_(d.phone);
  if (!d.phone) return 'PHONE';
  if (str_(d.whatsapp)) {
    d.whatsapp = normalizeBdPhone_(d.whatsapp);
    if (!d.whatsapp) return 'PHONE';
  } else {
    d.whatsapp = d.phone; // blank means same as the phone number
  }

  const email = str_(d.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'EMAIL';

  const age = ageFrom_(d.dob);
  if (age === null) return 'DOB';
  if (age < MIN_AGE || age > MAX_AGE) return 'AGE';

  if (str_(d.consent) !== 'yes') return 'CONSENT';
  return null;
}

function normalizeBdPhone_(p) {
  let digits = str_(p).replace(/\D/g, '');
  if (digits.indexOf('880') === 0) digits = '0' + digits.slice(3);
  if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

function ageFrom_(dob) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str_(dob));
  if (!m) return null;
  const y = +m[1], mo = +m[2], da = +m[3];
  const birth = new Date(y, mo - 1, da);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== da) return null;
  const now = new Date();
  if (birth > now) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() < mo - 1 || (now.getMonth() === mo - 1 && now.getDate() < da)) age--;
  return age;
}

// Same phone + same category + same request type. Rows saved before the
// "Request Type" column existed are free applications.
function isDuplicate_(sheet, phone, jobCategory, requestType) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const phoneCol = colIndex_('phone');
  const jobCol = colIndex_('jobCategory');
  const typeCol = colIndex_('requestType');
  const values = sheet.getRange(2, 1, last - 1, COLUMNS.length).getValues();
  return values.some(r =>
    String(r[phoneCol]).replace(/^'/, '') === phone &&
    String(r[jobCol]) === jobCategory &&
    (String(r[typeCol]) || 'Apply') === requestType,
  );
}

/* ------------------------------------------------------------------ */
/* CV upload                                                          */
/* ------------------------------------------------------------------ */
function saveCv_(cv, refId, fullName) {
  const name = str_(cv.name);
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = CV_TYPES[ext];
  if (!mime) return { error: 'CV_TYPE' };

  let bytes;
  try {
    bytes = Utilities.base64Decode(cv.base64);
  } catch (err) {
    return { error: 'CV_TYPE' };
  }
  if (bytes.length > MAX_CV_BYTES) return { error: 'CV_SIZE' };

  const safeName = str_(fullName).replace(/[^\w\s.-]/g, '').trim().slice(0, 60) || 'applicant';
  const blob = Utilities.newBlob(bytes, mime, refId + ' - ' + safeName + '.' + ext);
  const file = getCvFolder_().createFile(blob);
  return { url: file.getUrl() };
}

function getCvFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CV_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (err) {
      // Folder was deleted; fall through and make a new one.
    }
  }
  const folder = DriveApp.createFolder(CV_FOLDER_NAME);
  props.setProperty('CV_FOLDER_ID', folder.getId());
  return folder;
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                      */
/* ------------------------------------------------------------------ */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('This script must be opened from the Google Sheet (Extensions > Apps Script).');
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    const headers = COLUMNS.map(c => c[0]);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Plain text everywhere so phone numbers keep their leading 0.
    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat('@');
  } else if (sheet.getLastColumn() < COLUMNS.length) {
    // An older sheet: add headers for columns added since it was created.
    const from = sheet.getLastColumn() + 1;
    const extra = COLUMNS.slice(from - 1).map(c => c[0]);
    sheet.getRange(1, from, 1, extra.length).setValues([extra]).setFontWeight('bold');
    sheet.getRange(1, from, sheet.getMaxRows(), extra.length).setNumberFormat('@');
  }
  return sheet;
}

function colIndex_(key) {
  return COLUMNS.findIndex(c => c[1] === key);
}

/* ------------------------------------------------------------------ */
/* Small utilities                                                    */
/* ------------------------------------------------------------------ */
function makeRefId_() {
  const date = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyMMdd');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tail = '';
  for (let i = 0; i < 4; i++) tail += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'OP-' + date + '-' + tail;
}

function str_(v) {
  return v === undefined || v === null ? '' : String(v).trim().slice(0, 2000);
}

// Stop applicant input from being run as a spreadsheet formula,
// and keep leading zeros on numbers such as phone numbers.
function safeCell_(v) {
  return /^[=+\-@]/.test(v) || /^0\d/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(code) {
  return json_({ ok: false, code: code });
}
