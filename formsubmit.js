// Field list matching your Google Sheet columns
const fieldList = [
  'Institution Name', 'Institution ID', 'Program Name', 'Date of Requirement Gathering', 'Rotation Start Date',
  'Evaluation ETA', 'Contact Person', 'Program Type', 'Form Title', 'Actual Attachment Name', 'Purpose Of The Form',
  'Anonymous/Non Anonymous', 'Workflow', 'If Other, Please Mention (Workflow)', 'Involved Users', 
  'Frequency Of Form Completion', 'If Other, Please Mention (Frequency)', 'Scoring', 'Type of Scoring', 'Section Scoring',
  'Scoring View', 'Type of Notification', 'Who Will Receive Notification', "Please mention other Email Id's", 
  'Additional Comments for Notification', 'Type of Reports', 'Standout Features', 'Notes'
];

// Google Apps Script URL - Replace with your actual deployed Google Apps Script URL
const scriptURL = 'https://script.google.com/macros/s/AKfycbz7xas2gjKJX5TvWkCeCTnnn4GWbu2ld911eX1jj6JzM92BiGq5bPjHmA_yypCqVzlrEw/exec;'

// Initialize table on page load
document.addEventListener('DOMContentLoaded', function() {
  renderTableHeader();
  renderSubmissions();
});

// Handle workflow and frequency "Other" fields
document.getElementById('workflow').addEventListener('change', function() {
  document.getElementById('workflowOther').style.display = this.value === 'Other' ? 'block' : 'none';
});

document.getElementById('formFrequency').addEventListener('change', function() {
  document.getElementById('frequencyOther').style.display = this.value === 'Other' ? 'block' : 'none';
});

// Form submission handler
document.getElementById('requirementForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  // Validate required fields
  const requiredFields = ['institutionName', 'programName', 'programType', 'formTitle', 'formPurpose'];
  const missingFields = requiredFields.filter(field => !this[field].value.trim());
  
  if (missingFields.length > 0) {
    showMessage(`Please fill all required fields.`, true);
    return;
  }

  const submitButton = this.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> Saving...';

  // Prepare form data
  const entry = {};
  entry['Institution Name'] = this['institutionName'].value.trim();
  entry['Institution ID'] = this['institutionId'].value.trim();
  entry['Program Name'] = this['programName'].value.trim();
  entry['Date of Requirement Gathering'] = this['requirementDate'].value;
  entry['Rotation Start Date'] = this['rotationStartDate'].value;
  entry['Evaluation ETA'] = this['evaluationETA'].value;
  entry['Contact Person'] = this['contactPerson'].value;
  entry['Program Type'] = this['programType'].value;
  entry['Form Title'] = this['formTitle'].value.trim();
  entry['Actual Attachment Name'] = this['attachName'].value.trim();
  entry['Purpose Of The Form'] = this['formPurpose'].value.trim();
  entry['Anonymous/Non Anonymous'] = this['anonType'].value;
  entry['Workflow'] = this['workflow'].value;
  entry['If Other, Please Mention (Workflow)'] = this['workflowOther'].style.display !== "none" ? this['workflowOther'].value : '';
  entry['Involved Users'] = this['involvedUsers'].value;
  entry['Frequency Of Form Completion'] = this['formFrequency'].value;
  entry['If Other, Please Mention (Frequency)'] = this['frequencyOther'].style.display !== "none" ? this['frequencyOther'].value : '';
  entry['Scoring'] = this['scoring'].value;
  entry['Type of Scoring'] = this['scoringType'].value;
  entry['Section Scoring'] = this['sectionScoring'].value;
  entry['Scoring View'] = this['scoringView'].value;
  
  // Handle multi-select notifications
  const notificationOpts = Array.from(this['notificationTypes'].options)
    .filter(opt => opt.selected)
    .map(opt => opt.value);
  entry['Type of Notification'] = notificationOpts.join(', ');
  
  entry['Who Will Receive Notification'] = this['notificationRecipients'].value;
  entry["Please mention other Email Id's"] = this['emailIds'].value;
  entry['Additional Comments for Notification'] = this['notifComments'].value;
  entry['Type of Reports'] = this['reportTypes'].value;
  entry['Standout Features'] = this['standoutFeatures'].value;
  entry['Notes'] = this['notes'].value;

  try {
    // First save to localStorage to ensure data isn't lost
    let all = fetchSubmissions();
    all.push(entry);
    saveSubmissions(all);
    renderSubmissions();
    
    // Create Form Data to submit via form
    const formData = new FormData();
    for (const key in entry) {
      formData.append(key, entry[key]);
    }

    // CORS fix: Try submitting with alternative approach using fetch with JSONP proxy
    const response = await fetch(scriptURL, {
      method: 'POST',
      mode: 'no-cors', // This prevents CORS errors but makes response unreadable
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }).catch(error => {
      console.error('Fetch error:', error);
      // Handle the error - data is already saved locally
    });
    
    showMessage('Form saved successfully! Data is stored locally.', false);
    this.reset();
    document.getElementById('workflowOther').style.display = 'none';
    document.getElementById('frequencyOther').style.display = 'none';

  } catch (error) {
    console.error('Error:', error);
    showMessage(`Form saved locally. Will try sending to Google Sheets later.`, true);
    queueFailedSubmission(entry);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = '<span class="mr-2"><i class="fa-solid fa-save"></i></span> Save Entry';
  }
});

// Queue failed submissions for retry
function queueFailedSubmission(entry) {
  const failedQueue = JSON.parse(localStorage.getItem('nsrcf_failed_queue') || '[]');
  failedQueue.push(entry);
  localStorage.setItem('nsrcf_failed_queue', JSON.stringify(failedQueue));
  updateRetryButtonVisibility();
}

// Retry sending failed submissions
function retryFailedSubmissions() {
  const failedQueue = JSON.parse(localStorage.getItem('nsrcf_failed_queue') || '[]');
  if (failedQueue.length === 0) return;
  
  const retryButton = document.getElementById('retryBtn');
  if (retryButton) {
    retryButton.disabled = true;
    retryButton.innerHTML = '<i class="fa fa-spinner fa-spin mr-2"></i> Retrying...';
  }
  
  let successCount = 0;
  let newQueue = [];
  
  // Process each failed submission
  Promise.all(failedQueue.map(async (entry) => {
    try {
      const formData = new FormData();
      for (const key in entry) {
        formData.append(key, entry[key]);
      }
      
      await fetch(scriptURL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      successCount++;
    } catch (error) {
      newQueue.push(entry);
    }
  })).then(() => {
    localStorage.setItem('nsrcf_failed_queue', JSON.stringify(newQueue));
    
    if (retryButton) {
      retryButton.disabled = false;
      retryButton.innerHTML = '<span class="mr-2"><i class="fa-solid fa-sync"></i></span> Retry Failed';
    }
    
    if (successCount > 0) {
      showMessage(`Attempted to send ${successCount} entries to Google Sheets. ${newQueue.length} entries remaining.`, false);
    } else if (newQueue.length > 0) {
      showMessage(`Failed to send entries to Google Sheets. Please try again later.`, true);
    }
    
    updateRetryButtonVisibility();
  });
}

// Update retry button visibility based on queue
function updateRetryButtonVisibility() {
  const failedQueue = JSON.parse(localStorage.getItem('nsrcf_failed_queue') || '[]');
  const retryBtn = document.getElementById('retryBtn');
  
  if (retryBtn) {
    retryBtn.style.display = failedQueue.length > 0 ? 'flex' : 'none';
    const counter = retryBtn.querySelector('.counter');
    if (counter) {
      counter.textContent = failedQueue.length;
    }
  }
}

// Local storage functions
function fetchSubmissions() {
  const json = localStorage.getItem('nsrcf_entries') || '[]';
  try { return JSON.parse(json) } catch { return [] }
}

function saveSubmissions(data) {
  localStorage.setItem('nsrcf_entries', JSON.stringify(data));
}

function renderSubmissions() {
  const entries = fetchSubmissions();
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';
  
  if (entries.length === 0) {
    // If no entries, show a message in the table
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = fieldList.length + 1;
    td.className = "text-center py-4 text-gray-500";
    td.textContent = "No entries found. Fill out the form to add submissions.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  
  entries.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = idx % 2 ? 'bg-gray-50' : '';
    
    for (const f of fieldList) {
      const td = document.createElement('td');
      td.className = "border px-2 py-1 text-xs";
      td.textContent = row[f] || '';
      tr.appendChild(td);
    }
    
    const actionTd = document.createElement('td');
    actionTd.className = "border px-2 py-1 text-xs text-center";
    actionTd.innerHTML = `<button type="button" aria-label="Delete Submission" title="Delete" class="text-red-500 hover:underline" onclick="removeSubmission(${idx})"><i class="fa fa-trash"></i></button>`;
    tr.appendChild(actionTd);
    
    tbody.appendChild(tr);
  });
  
  // Update retry button visibility
  updateRetryButtonVisibility();
}

// Delete submission
window.removeSubmission = function(idx) {
  if (confirm("Are you sure you want to delete this entry? This cannot be undone.")) {
    let d = fetchSubmissions();
    d.splice(idx, 1);
    saveSubmissions(d);
    renderSubmissions();
    showMessage("Entry deleted successfully.", false);
  }
};

// Initialize table header
function renderTableHeader() {
  const tr = document.getElementById('tableHeadRow');
  tr.innerHTML = '';
  
  for (const fld of fieldList) {
    const th = document.createElement('th');
    th.className = "px-2 py-2 border text-xs font-semibold text-blue-900";
    th.textContent = fld;
    tr.appendChild(th);
  }
  
  const delth = document.createElement('th');
  delth.className = "px-2 py-2 border text-xs font-semibold text-blue-900";
  delth.textContent = 'Delete';
  tr.appendChild(delth);
}

// Show messages
function showMessage(msg, isErr) {
  const el = document.getElementById('formMessage');
  el.textContent = msg;
  el.className = 'mt-2 text-sm font-medium ' + (isErr ? 'text-red-600' : 'text-green-700');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none' }, 5000);
}

// Clear form
document.getElementById('clearBtn').addEventListener('click', function() {
  if (confirm("Are you sure you want to clear the form?")) {
    document.getElementById('requirementForm').reset();
    document.getElementById('workflowOther').style.display = 'none';
    document.getElementById('frequencyOther').style.display = 'none';
    showMessage('Form cleared.', false);
  }
});

// Export to Excel
document.getElementById('exportExcelBtn').addEventListener('click', function() {
  const data = fetchSubmissions();
  if (!data.length) {
    showMessage('No submissions to export.', true);
    return;
  }
  
  try {
    const ws = XLSX.utils.json_to_sheet(data, { header: fieldList });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Requirements");
    
    // Generate timestamp for filename
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    XLSX.writeFile(wb, `nursing_school_requirements_${timestamp}.xlsx`);
    showMessage("Successfully exported to Excel!", false);
  } catch (error) {
    console.error('Excel export error:', error);
    showMessage("Failed to export to Excel. Please try again.", true);
  }
});

// Add retry button to DOM if it doesn't exist
document.addEventListener('DOMContentLoaded', function() {
  if (!document.getElementById('retryBtn')) {
    const buttonsContainer = document.querySelector('.flex.flex-wrap.mt-6.gap-4');
    if (buttonsContainer) {
      const retryBtn = document.createElement('button');
      retryBtn.id = 'retryBtn';
      retryBtn.type = 'button';
      retryBtn.className = 'bg-yellow-500 text-white px-5 py-2 font-semibold rounded hover:bg-yellow-700 flex items-center';
      retryBtn.title = 'Retry sending failed submissions';
      retryBtn.innerHTML = '<span class="mr-2"><i class="fa-solid fa-sync"></i></span> Retry Failed <span class="ml-2 bg-yellow-700 px-2 py-0.5 rounded-full text-xs counter">0</span>';
      retryBtn.addEventListener('click', retryFailedSubmissions);
      retryBtn.style.display = 'none';
      buttonsContainer.appendChild(retryBtn);
    }
    
    // Initial check for failed submissions
    updateRetryButtonVisibility();
  }
});
