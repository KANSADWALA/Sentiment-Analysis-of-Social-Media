// Import required modules for Electron
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const Chart = require('chart.js/auto');


// Flask server URL
// Ensure it's set to the correct Flask server address
//const SERVER_URL = 'http://localhost:5000';
//const SERVER_URL = 'http://127.0.0.1:5000';
const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:5000'; // Default to localhost if not set
// Check if SERVER_URL is correctly defined
console.log('Current SERVER_URL:', SERVER_URL);
console.log('Using SERVER_URL:', SERVER_URL);

// App state
const appState = {
    twitterConnected: false,
    instagramConnected: false,
    twitterData: [],
    instagramData: [],
    analysisResults: null,
    outputDirectory: null,
    logs: [],
    serverStatus: 'unknown',  // Add server status tracking
    serverChecked: false      // Flag to track if server was checked
};

// DOM Elements - Tabs
const tabs = document.querySelectorAll('.tab');
const tabPanes = document.querySelectorAll('.tab-pane');

// DOM Elements - Visualization Tabs
const vizTabs = document.querySelectorAll('.viz-tab');
const vizTabPanes = document.querySelectorAll('.viz-tab-pane');

// DOM Elements - Twitter
const twitterBearerToken = document.getElementById('twitter-bearer-token');
const twitterConnectBtn = document.getElementById('btn-twitter-connect');
console.log('Twitter connect button found:', !!twitterConnectBtn);

const twitterSearchType = document.getElementById('twitter-search-type');
const twitterSearchTerm = document.getElementById('twitter-search-term');
const twitterMaxTweets = document.getElementById('twitter-max-tweets');
const twitterFetchBtn = document.getElementById('btn-twitter-fetch');
const twitterStatusIndicator = document.getElementById('twitter-status-indicator') || createStatusIndicator('twitter');
console.log('Twitter status indicator found:', !!twitterStatusIndicator);


// DOM Elements - Instagram
const instagramSessionId = document.getElementById('instagram-session-id');
const instagramDsUserId = document.getElementById('instagram-ds-user-id');
const instagramCsrfToken = document.getElementById('instagram-csrf-token');
const instagramConnectBtn = document.getElementById('btn-instagram-connect');
const instagramSearchType = document.getElementById('instagram-search-type');
const instagramSearchTerm = document.getElementById('instagram-search-term');
const instagramMaxPosts = document.getElementById('instagram-max-posts');
const instagramFetchBtn = document.getElementById('btn-instagram-fetch');
const instagramStatusIndicator = document.getElementById('instagram-status-indicator') || createStatusIndicator('instagram');

// DOM Elements - Server Status
const serverStatusIndicator = document.getElementById('server-status-indicator') || createServerStatusIndicator();

// DOM Elements - Data Actions
const exportRawDataBtn = document.getElementById('btn-export-raw-data');
const importDataBtn = document.getElementById('btn-import-data');
const clearDataBtn = document.getElementById('btn-clear-data');
const twitterCountEl = document.getElementById('twitter-count');
const instagramCountEl = document.getElementById('instagram-count');
const totalCountEl = document.getElementById('total-count');

// DOM Elements - Analysis
const analysisMethodEl = document.getElementById('analysis-method');
const languageEl = document.getElementById('language');
const excludeRetweetsEl = document.getElementById('exclude-retweets');
const excludeRepliesEl = document.getElementById('exclude-replies');
const runAnalysisBtn = document.getElementById('btn-run-analysis');
const analysisSummaryEl = document.getElementById('analysis-summary');
const exportPdfBtn = document.getElementById('btn-export-pdf');
const exportHtmlBtn = document.getElementById('btn-export-html');
const exportExcelBtn = document.getElementById('btn-export-excel');

// DOM Elements - Visualization
const refreshVizBtn = document.getElementById('btn-refresh-viz');
const exportImagesBtn = document.getElementById('btn-export-images');
const generateReportBtn = document.getElementById('btn-generate-report');
const sentimentChartEl = document.getElementById('sentiment-chart');
const hashtagChartEl = document.getElementById('hashtag-chart');
const platformChartEl = document.getElementById('platform-chart');

// DOM Elements - Log
const logFilterEl = document.getElementById('log-filter');
const logSearchEl = document.getElementById('log-search');
const searchLogBtn = document.getElementById('btn-search-log');
const exportLogBtn = document.getElementById('btn-export-log');
const clearLogBtn = document.getElementById('btn-clear-log');
const logContentEl = document.getElementById('log-content');

// DOM Elements - Status Bar
const statusMessageEl = document.querySelector('.status-message');
const progressBarEl = document.getElementById('progress-bar');

// DOM Elements - Modal
const modal = document.getElementById('help-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');

// DOM Elements - Toast Container
const toastContainer = document.getElementById('toast-container');

// Chart instances
let sentimentChart = null;
let hashtagChart = null;
let platformChart = null;

// Helper function to create status indicators if they don't exist in the HTML
function createStatusIndicator(platform) {
    const container = document.querySelector(`.${platform}-container`) || document.body;
    const indicator = document.createElement('div');
    indicator.id = `${platform}-status-indicator`;
    indicator.className = 'status-indicator disconnected';
    indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Disconnected</span>';
    
    // Insert after connect button if possible
    const connectBtn = document.getElementById(`btn-${platform}-connect`);
    if (connectBtn && connectBtn.parentNode) {
        connectBtn.parentNode.insertBefore(indicator, connectBtn.nextSibling);
    } else {
        container.appendChild(indicator);
    }
    
    return indicator;
}

// Helper function to create server status indicator
function createServerStatusIndicator() {
    const statusBar = document.querySelector('.status-bar') || document.body;
    const indicator = document.createElement('div');
    indicator.id = 'server-status-indicator';
    indicator.className = 'server-status unknown';
    indicator.innerHTML = '<span class="status-dot"></span><span class="status-text">Server: Unknown</span>';
    
    statusBar.prepend(indicator);
    return indicator;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM fully loaded');
    console.log('Twitter connect button available:', !!document.getElementById('btn-twitter-connect'));
    console.log('Instagram connect button available:', !!document.getElementById('btn-instagram-connect'));
    console.log('Server status indicator available:', !!document.getElementById('server-status-indicator'));

    // Get output directory from main process
    appState.outputDirectory = await ipcRenderer.invoke('get-output-directory');
    
    // Initialize UI
    initTabs();
    initVizTabs();
    initHelpTooltips();
    initModalHandlers();
    
    // Add event listeners
    addEventListeners();
    
    // Check server status
    checkServerStatus();
    
    // Log app start
    logMessage('Application started', 'info');
    updateStatus('Ready');
});

// Check Flask server status
async function checkServerStatus() {
    console.log('Checking server status at:', SERVER_URL);
    updateServerStatus('checking');
    try {
        // Add logging for debugging
        console.log('Sending ping request to:', `${SERVER_URL}/ping`);
        const response = await fetch(`${SERVER_URL}/ping`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Server ping response:', response.status, response.statusText);

        if (response.ok) {
            updateServerStatus('connected');
            appState.serverStatus = 'connected';
            logMessage('Flask server is running and connected', 'info');
        } else {
            updateServerStatus('error');
            appState.serverStatus = 'error';
            logMessage('Flask server returned an error response', 'error');
        }
    } catch (error) {
        updateServerStatus('disconnected');
        appState.serverStatus = 'disconnected';
        logMessage(`Failed to connect to Flask server: ${error.message}`, 'error');
        showToast('Cannot connect to the backend server. Make sure the server is running.', 'error');
    }
    
    appState.serverChecked = true;
// Ensure the preceding block is properly closed
    }

// Update server status indicator
function updateServerStatus(status) {
    if (!serverStatusIndicator) return;
    
    // Remove all status classes
    serverStatusIndicator.classList.remove('unknown', 'checking', 'connected', 'disconnected', 'error');
    
    // Add the new status class
    serverStatusIndicator.classList.add(status);
    
    // Update the text
    const statusText = serverStatusIndicator.querySelector('.status-text');
    if (statusText) {
        switch (status) {
            case 'checking':
                statusText.textContent = 'Server: Checking...';
                break;
            case 'connected':
                statusText.textContent = 'Server: Connected';
                break;
            case 'disconnected':
                statusText.textContent = 'Server: Disconnected';
                break;
            case 'error':
                statusText.textContent = 'Server: Error';
                break;
            default:
                statusText.textContent = 'Server: Unknown';
        }
    }
}

// Update platform connection status indicator
function updateConnectionStatus(platform, status) {
    const indicator = document.getElementById(`${platform}-status-indicator`);
    if (!indicator) return;
    
    // Remove all status classes
    indicator.classList.remove('connected', 'disconnected', 'checking', 'error');
    
    // Add the new status class
    indicator.classList.add(status);
    
    // Update the text
    const statusText = indicator.querySelector('.status-text');
    if (statusText) {
        switch (status) {
            case 'checking':
                statusText.textContent = 'Checking...';
                break;
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
            case 'error':
                statusText.textContent = 'Error';
                break;
        }
    }
}

// Tab Initialization
function initTabs() {
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Deactivate all tabs and panes
            tabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Activate selected tab and pane
            tab.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Visualization Tab Initialization
function initVizTabs() {
    vizTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-viz-tab') + '-viz';
            
            // Deactivate all tabs and panes
            vizTabs.forEach(t => t.classList.remove('active'));
            vizTabPanes.forEach(p => p.classList.remove('active'));
            
            // Activate selected tab and pane
            tab.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Help tooltip initialization
function initHelpTooltips() {
    document.querySelectorAll('.help-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            const tooltip = icon.getAttribute('data-tooltip');
            
            // Show tooltip in modal
            showModal('Help', tooltip);
        });
    });
}

// Modal handlers
function initModalHandlers() {
    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Show modal with title and content
function showModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.classList.add('active');
}

// Add event listeners for UI interactions
// Define missing functions
function exportLog() {
    // Implement your export log functionality here
    console.log('Export log function called');
    showToast('Export log functionality not yet implemented', 'warning');
}

function clearLog() {
    if (logContentEl) {
        logContentEl.innerHTML = '';
        appState.logs = [];
        showToast('Log cleared', 'success');
    }
}

function addEventListeners() {
    // Helper function to safely add event listeners
    const safeAddListener = (element, event, handler) => {
        if (element && typeof handler === 'function') {
            element.addEventListener(event, handler);
        }
    };

    // Twitter
    safeAddListener(twitterConnectBtn, 'click', connectToTwitter);
    safeAddListener(twitterFetchBtn, 'click', fetchTwitterData);
    
    // Instagram
    safeAddListener(instagramConnectBtn, 'click', connectToInstagram);
    safeAddListener(instagramFetchBtn, 'click', fetchInstagramData);
    
    // Data actions
    safeAddListener(exportRawDataBtn, 'click', exportRawData);
    safeAddListener(importDataBtn, 'click', importData);
    safeAddListener(clearDataBtn, 'click', clearData);
    
    // Analysis
    safeAddListener(runAnalysisBtn, 'click', runAnalysis);
    safeAddListener(exportPdfBtn, 'click', exportAsPdf);
    safeAddListener(exportHtmlBtn, 'click', exportAsHtml);
    safeAddListener(exportExcelBtn, 'click', exportAsExcel);
    
    // Visualization
    safeAddListener(refreshVizBtn, 'click', refreshVisualizations);
    safeAddListener(exportImagesBtn, 'click', exportImages);
    safeAddListener(generateReportBtn, 'click', generateReport);
    
    // Logs
    safeAddListener(searchLogBtn, 'click', searchLogs);
    safeAddListener(exportLogBtn, 'click', exportLog);
    safeAddListener(clearLogBtn, 'click', clearLog);
    safeAddListener(logFilterEl, 'change', filterLogs);
    
    // Log search enter key
    if (logSearchEl) {
        logSearchEl.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') searchLogs();
        });
    }
}

// Define searchLogs function if missing
function searchLogs() {
    const searchTerm = logSearchEl ? logSearchEl.value.toLowerCase() : '';
    const logItems = logContentEl ? logContentEl.querySelectorAll('.log-item') : [];
    
    logItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}
// function addEventListeners() {
//     // Twitter connect button
//     twitterConnectBtn.addEventListener('click', connectToTwitter);
    
//     // Twitter fetch button
//     twitterFetchBtn.addEventListener('click', fetchTwitterData);
    
//     // Instagram connect button
//     instagramConnectBtn.addEventListener('click', connectToInstagram);
    
//     // Instagram fetch button
//     instagramFetchBtn.addEventListener('click', fetchInstagramData);
    
//     // Data action buttons
//     exportRawDataBtn.addEventListener('click', exportRawData);
//     importDataBtn.addEventListener('click', importData);
//     clearDataBtn.addEventListener('click', clearData);
    
//     // Analysis buttons
//     runAnalysisBtn.addEventListener('click', runAnalysis);
//     exportPdfBtn.addEventListener('click', exportAsPdf);
//     exportHtmlBtn.addEventListener('click', exportAsHtml);
//     exportExcelBtn.addEventListener('click', exportAsExcel);
    
//     // Visualization buttons
//     refreshVizBtn.addEventListener('click', refreshVisualizations);
//     exportImagesBtn.addEventListener('click', exportImages);
//     generateReportBtn.addEventListener('click', generateReport);
    
//     // Log buttons
//     searchLogBtn.addEventListener('click', searchLogs);
//     exportLogBtn.addEventListener('click', exportLog);
//     clearLogBtn.addEventListener('click', clearLog);
    
//     // Log filter change
//     logFilterEl.addEventListener('change', filterLogs);
    
//     // Log search enter key
//     logSearchEl.addEventListener('keyup', (e) => {
//         if (e.key === 'Enter') {
//             searchLogs();
//         }
//     });
    
//     // Add retry server connection button
//     const retryBtn = document.createElement('button');
//     retryBtn.id = 'btn-retry-server';
//     retryBtn.className = 'btn btn-sm';
//     retryBtn.textContent = 'Retry';
    
//     if (serverStatusIndicator) {
//         serverStatusIndicator.appendChild(retryBtn);
//         retryBtn.addEventListener('click', checkServerStatus);
//     }
// }

// Log message to application log
function logMessage(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        message,
        type
    };
    
    appState.logs.push(logEntry);
    
    // Update log UI if it exists
    if (logContentEl) {
        const logItem = document.createElement('div');
        logItem.className = `log-item ${type}`;
        logItem.innerHTML = `
            <span class="log-timestamp">${timestamp}</span>
            <span class="log-type">${type.toUpperCase()}</span>
            <span class="log-message">${message}</span>
        `;
        
        logContentEl.appendChild(logItem);
        
        // Scroll to bottom
        logContentEl.scrollTop = logContentEl.scrollHeight;
    }
    
    // Also log to console
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Update status message
function updateStatus(message) {
    if (statusMessageEl) {
        statusMessageEl.textContent = message;
    }
}

// Set progress bar value (0-100)
function setProgress(value) {
    if (progressBarEl) {
        progressBarEl.style.width = `${value}%`;
        
        // Hide progress bar when 0
        if (value === 0) {
            progressBarEl.parentElement.classList.add('hidden');
        } else {
            progressBarEl.parentElement.classList.remove('hidden');
        }
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="close-toast">&times;</button>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Add close button listener
    toast.querySelector('.close-toast').addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentNode) toast.remove();
            }, 300);
        }
    }, 5000);
}

// Update data counts
function updateDataCounts() {

    const twitterCount = appState.twitterData.length;
    const instagramCount = appState.instagramData.length;
    const totalCount = twitterCount + instagramCount;
    
    // Update UI
    if (twitterCountEl) twitterCountEl.textContent = twitterCount;
    if (instagramCountEl) instagramCountEl.textContent = instagramCount;
    if (totalCountEl) totalCountEl.textContent = totalCount;
    
    // Log counts
    console.log(`Data counts updated: Twitter (${twitterCount}), Instagram (${instagramCount}), Total (${totalCount})`);
    
    // Enable/disable buttons based on data availability
    const hasData = totalCount > 0;
    if (exportRawDataBtn) exportRawDataBtn.disabled = !hasData;
    if (clearDataBtn) clearDataBtn.disabled = !hasData;
    if (runAnalysisBtn) runAnalysisBtn.disabled = !hasData;

    // twitterCountEl.textContent = appState.twitterData.length;
    // instagramCountEl.textContent = appState.instagramData.length;
    // totalCountEl.textContent = appState.twitterData.length + appState.instagramData.length;
}

// Fix the connectToTwitter function around line 468
async function connectToTwitter() {
    try {
        // Check if server is available first
        if (!appState.serverChecked) {
            await checkServerStatus();
        }
        
        if (appState.serverStatus !== 'connected') {
            showToast('Cannot connect to Twitter API: Backend server is not running', 'error');
            updateConnectionStatus('twitter', 'error');
            return;
        }
        
        updateStatus('Connecting to Twitter API...');
        updateConnectionStatus('twitter', 'checking');
        setProgress(30);
        
        // Validate inputs
        if (!twitterBearerToken.value) {
            showToast('Please enter Twitter bearer token', 'error');
            updateStatus('Twitter API connection failed');
            updateConnectionStatus('twitter', 'disconnected');
            setProgress(0);
            return;
        }
        
        logMessage('Verifying Twitter bearer token...', 'info');
        
        // Call the Flask API to verify the Twitter credentials
        const response = await fetch(`${SERVER_URL}/verify-credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'twitter',
                twitter_bearer_token: twitterBearerToken.value
            }),
        });
        
        setProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to verify Twitter credentials');
        }
        
        const result = await response.json();
        
        // Mark as connected
        appState.twitterConnected = true;
        twitterConnectBtn.classList.add('connected');
        twitterConnectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
        updateConnectionStatus('twitter', 'connected');
        
        showToast('Connected to Twitter API', 'success');
        logMessage('Twitter bearer token validated successfully', 'info');
        updateStatus('Connected to Twitter API');
        setProgress(100);
        
        // Enable fetch button
        twitterFetchBtn.disabled = false;
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        console.error('Twitter connection error:', error);  // Add this line for debugging
        showToast(`${error.message}`, 'error');
        logMessage(`Twitter API connection failed: ${error.message}`, 'error');
        updateStatus('Twitter API connection failed');
        updateConnectionStatus('twitter', 'error');
        setProgress(0);
        
        // Reset connection UI
        appState.twitterConnected = false;
        twitterConnectBtn.classList.remove('connected');
        twitterConnectBtn.innerHTML = 'Connect';
        twitterFetchBtn.disabled = true;
    }
}

// Instagram API connection (continued)
async function connectToInstagram() {
    try {
        // Check if server is available first
        if (!appState.serverChecked) {
            await checkServerStatus();
        }
        
        if (appState.serverStatus !== 'connected') {
            showToast('Cannot connect to Instagram API: Backend server is not running', 'error');
            updateConnectionStatus('instagram', 'error');
            return;
        }
        
        updateStatus('Connecting to Instagram API...');
        updateConnectionStatus('instagram', 'checking');
        setProgress(30);
        
        // Validate inputs
        if (!instagramSessionId.value || !instagramDsUserId.value || !instagramCsrfToken.value) {
            showToast('Please enter all Instagram credentials', 'error');
            updateStatus('Instagram API connection failed');
            updateConnectionStatus('instagram', 'disconnected');
            setProgress(0);
            return;
        }
        
        logMessage('Verifying Instagram credentials...', 'info');
        
        // Call the Flask API to verify the Instagram credentials
        const response = await fetch(`${SERVER_URL}/verify-credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'instagram',
                instagram_session_id: instagramSessionId.value,
                instagram_ds_user_id: instagramDsUserId.value,
                instagram_csrf_token: instagramCsrfToken.value
            }),
        });
        
        setProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to verify Instagram credentials');
        }
        
        const result = await response.json();
        
        // Mark as connected
        appState.instagramConnected = true;
        instagramConnectBtn.classList.add('connected');
        instagramConnectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
        updateConnectionStatus('instagram', 'connected');
        
        showToast('Connected to Instagram API', 'success');
        logMessage('Instagram credentials validated successfully', 'info');
        updateStatus('Connected to Instagram API');
        setProgress(100);
        
        // Enable fetch button
        instagramFetchBtn.disabled = false;
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        showToast(`${error.message}`, 'error');
        logMessage(`Instagram API connection failed: ${error.message}`, 'error');
        updateStatus('Instagram API connection failed');
        updateConnectionStatus('instagram', 'error');
        setProgress(0);
        
        // Reset connection UI
        appState.instagramConnected = false;
        instagramConnectBtn.classList.remove('connected');
        instagramConnectBtn.innerHTML = 'Connect';
        instagramFetchBtn.disabled = true;
    }
}

// Enhanced Analysis & Visualization Integration with Summary and Sample Results

// Enhanced Analysis Report with Styled Summary and Insightful Hashtag Trends

// Enhanced Analysis Report with Styled Summary and Insightful Hashtag Trends

// Enhanced Analysis Report with Styled Summary and Insightful Hashtag Trends

// Enhanced Analysis Report with User Details per Hashtag

// Enhanced Analysis Report with Styled Summary and Insightful Hashtag Trends

// Enhanced Analysis Report with Styled Summary and Insightful Hashtag Trends

function renderAnalysisReport(data) {
    const container = document.getElementById('analysis-summary');
    if (!container) {
        console.error('Analysis summary container not found');
        return;
    }
    container.innerHTML = '';

    const summarySection = document.createElement('div');
    summarySection.className = 'analysis-summary';

    const total = data.length;
    const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    const platformCounts = {};
    const hashtags = {};
    const hashtagUsers = {};
    const userDetails = {};
    const timestamps = {};

    data.forEach(item => {
        const sentiment = item.sentiment;
        sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;

        const platform = item.platform || 'Unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;

        const username = item.username || item.ownerUsername || null;
        const location = item.user_location || item.locationName || null;

        (item.hashtags || []).forEach(tag => {
            const key = tag.toLowerCase();
            if (!hashtags[key]) {
                hashtags[key] = 0;
                hashtagUsers[key] = new Set();
                userDetails[key] = {};
                timestamps[key] = [];
            }
            hashtags[key]++;
            if (username && typeof username === 'string' && username.trim()) {
                hashtagUsers[key].add(username);
                if (!userDetails[key][username]) {
                    userDetails[key][username] = location || null;
                }
            }
            if (item.timestamp) timestamps[key].push(new Date(item.timestamp));
        });
    });

    const topHashtags = Object.entries(hashtags)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => {
            const users = Array.from(hashtagUsers[tag]);
            const userList = users.map(user => {
                const loc = userDetails[tag][user];
                return `<li><strong>${user}</strong>${loc ? ` <span class='user-location'>(📍 ${loc})</span>` : ''}</li>`;
            }).join('');

            const times = timestamps[tag].map(t => t.getTime());
            const min = Math.min(...times);
            const max = Math.max(...times);
            const days = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)));

            return `
                <div class="tag-card">
                    <div class="tag-name">#${tag}</div>
                    <div class="tag-stats">Used by <strong>${count}</strong> users</div>
                    <div class="tag-users">
                        <ul>${userList}</ul>
                    </div>
                </div>`;
        }).join('');

    summarySection.innerHTML = `
        <div class="card-section">
            <h2 class="section-title">🫠 Sentiment Distribution</h2>
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-value">${total}</span>
                    <span class="stat-label">Total Items</span>
                </div>
                <div class="stat positive">
                    <span class="stat-value">${sentimentCounts.Positive}</span>
                    <span class="stat-label">Positive</span>
                </div>
                <div class="stat neutral">
                    <span class="stat-value">${sentimentCounts.Neutral}</span>
                    <span class="stat-label">Neutral</span>
                </div>
                <div class="stat negative">
                    <span class="stat-value">${sentimentCounts.Negative}</span>
                    <span class="stat-label">Negative</span>
                </div>
            </div>
        </div>
        <div class="card-section">
            <h2 class="section-title">📱 Platform</h2>
            <div class="distribution-list">
                ${Object.entries(platformCounts).map(([platform, count]) => `
                    <div class="platform-card">
                        <strong>${platform}</strong><br>
                        <span class="count">${count} records</span>
                    </div>`).join('')}
            </div>
        </div>
        <div class="card-section">
            <h2 class="section-title">📈 Trending Hashtags</h2>
            <div class="tag-list">${topHashtags}</div>
        </div>
    `;

    container.appendChild(summarySection);

    const resultsSection = document.createElement('div');
    resultsSection.className = 'analysis-results';
    resultsSection.innerHTML = '<h2 class="section-title">🔍 Sample Results</h2>';

    const sampleSize = Math.min(5, data.length);
    const sampleResults = document.createElement('div');
    sampleResults.className = 'sample-results';

    for (let i = 0; i < sampleSize; i++) {
        const item = data[i];
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${item.sentiment.toLowerCase()}`;
        resultItem.innerHTML = `
            <p class="result-text">${item.cleaned_text || item.text || ''}</p>
            <div class="result-meta">
                <span class="sentiment ${item.sentiment.toLowerCase()}">${item.sentiment}</span>
                ${item.platform ? `<span class="platform">${item.platform}</span>` : ''}
            </div>
        `;
        sampleResults.appendChild(resultItem);
    }

    resultsSection.appendChild(sampleResults);
    container.appendChild(resultsSection);

    const style = document.createElement('style');
    style.textContent = `
        .analysis-summary {
            font-family: 'Segoe UI', sans-serif;
        }
        .card-section {
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        .section-title {
            font-size: 1.2em;
            color: #333;
            margin-bottom: 12px;
        }
        .summary-stats {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        .stat {
            flex: 1;
            text-align: center;
            padding: 15px;
            border-radius: 6px;
            background: #f8f9fa;
        }
        .stat-value {
            font-size: 1.8em;
            font-weight: 700;
            display: block;
            color: #343a40;
        }
        .stat-label {
            font-size: 0.95em;
            opacity: 0.75;
        }
        .positive .stat-value { color: #28a745; }
        .neutral .stat-value { color: #ffc107; }
        .negative .stat-value { color: #dc3545; }
        .distribution-list, .tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
        }
        .platform-card, .tag-card {
            background: #f1f3f5;
            padding: 10px 15px;
            border-radius: 6px;
            flex: 1 1 200px;
        }
        .platform-card .count {
            color: #555;
            font-size: 0.95em;
        }
        .tag-name {
            font-weight: bold;
            font-size: 1em;
            color: #007bff;
        }
        .tag-stats {
            font-size: 0.9em;
            color: #333;
            margin-top: 4px;
        }
        .tag-users ul {
            margin: 8px 0 0 0;
            padding: 0;
            list-style: none;
        }
        .tag-users li {
            font-size: 0.85em;
            color: #555;
        }
        .user-location {
            color: #888;
        }
        .analysis-results {
            margin-top: 30px;
        }
        .result-item {
            padding: 15px;
            margin: 10px 0;
            border-left: 5px solid #dee2e6;
            background: #fafafa;
            border-radius: 4px;
        }
        .result-item.positive { border-left-color: #28a745; }
        .result-item.neutral { border-left-color: #ffc107; }
        .result-item.negative { border-left-color: #dc3545; }
        .result-text {
            margin-bottom: 8px;
            font-size: 1em;
            color: #212529;
        }
        .result-meta {
            font-size: 0.9em;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .sentiment {
            padding: 3px 6px;
            border-radius: 3px;
            font-weight: 600;
            font-size: 0.85em;
        }
        .sentiment.positive { background: #d4edda; color: #155724; }
        .sentiment.neutral { background: #fff3cd; color: #856404; }
        .sentiment.negative { background: #f8d7da; color: #721c24; }
    `;
    container.appendChild(style);
}




// function renderAnalysisReport(data) {
//     const container = document.getElementById('analysis-summary');
    
//     if (!container) {
//         console.error('Analysis summary container not found');
//         return;
//     }
    
//     container.innerHTML = ''; // Clear old results

//     // Create summary section
//     const summarySection = document.createElement('div');
//     summarySection.className = 'analysis-summary';
    
//     // Calculate statistics
//     const total = data.length;
//     const positive = data.filter(d => d.sentiment === 'Positive').length;
//     const negative = data.filter(d => d.sentiment === 'Negative').length;
//     const neutral = total - positive - negative;
    
//     summarySection.innerHTML = `
//         <h2>Analysis Summary</h2>
//         <div class="summary-stats">
//             <div class="stat">
//                 <span class="stat-value">${total}</span>
//                 <span class="stat-label">Total Items</span>
//             </div>
//             <div class="stat positive">
//                 <span class="stat-value">${positive}</span>
//                 <span class="stat-label">Positive</span>
//             </div>
//             <div class="stat neutral">
//                 <span class="stat-value">${neutral}</span>
//                 <span class="stat-label">Neutral</span>
//             </div>
//             <div class="stat negative">
//                 <span class="stat-value">${negative}</span>
//                 <span class="stat-label">Negative</span>
//             </div>
//         </div>
//     `;
    
//     container.appendChild(summarySection);

//     // Create sample results section
//     const resultsSection = document.createElement('div');
//     resultsSection.className = 'analysis-results';
//     resultsSection.innerHTML = '<h2>Sample Results</h2>';
    
//     // Show first 5 results
//     const sampleSize = Math.min(5, data.length);
//     const sampleResults = document.createElement('div');
//     sampleResults.className = 'sample-results';
    
//     for (let i = 0; i < sampleSize; i++) {
//         const item = data[i];
//         const resultItem = document.createElement('div');
//         resultItem.className = `result-item ${item.sentiment.toLowerCase()}`;
//         resultItem.innerHTML = `
//             <p class="result-text">${item.cleaned_text || item.text || ''}</p>
//             <div class="result-meta">
//                 <span class="sentiment ${item.sentiment.toLowerCase()}">${item.sentiment}</span>
//                 ${item.platform ? `<span class="platform">${item.platform}</span>` : ''}
//             </div>
//         `;
//         sampleResults.appendChild(resultItem);
//     }
    
//     resultsSection.appendChild(sampleResults);
//     container.appendChild(resultsSection);
    
//     // Add some basic CSS
//     const style = document.createElement('style');
//     style.textContent = `
//         .analysis-summary {
//             background: #f5f5f5;
//             padding: 15px;
//             border-radius: 5px;
//             margin-bottom: 20px;
//         }
//         .summary-stats {
//             display: flex;
//             gap: 15px;
//             margin-top: 10px;
//         }
//         .stat {
//             flex: 1;
//             text-align: center;
//             padding: 10px;
//             border-radius: 5px;
//             background: #fff;
//         }
//         .stat-value {
//             font-size: 1.5em;
//             font-weight: bold;
//             display: block;
//         }
//         .stat-label {
//             font-size: 0.9em;
//             opacity: 0.8;
//         }
//         .positive { color: #4CAF50; }
//         .neutral { color: #FFC107; }
//         .negative { color: #F44336; }
//         .analysis-results {
//             margin-top: 20px;
//         }
//         .result-item {
//             padding: 10px;
//             margin: 10px 0;
//             border-left: 4px solid #ddd;
//             background: #fff;
//         }
//         .result-item.positive { border-left-color: #4CAF50; }
//         .result-item.neutral { border-left-color: #FFC107; }
//         .result-item.negative { border-left-color: #F44336; }
//         .result-meta {
//             margin-top: 5px;
//             font-size: 0.9em;
//             display: flex;
//             gap: 10px;
//         }
//         .sentiment {
//             padding: 2px 5px;
//             border-radius: 3px;
//             font-weight: bold;
//         }
//         .sentiment.positive { background: #E8F5E9; }
//         .sentiment.neutral { background: #FFF8E1; }
//         .sentiment.negative { background: #FFEBEE; }
//     `;
//     container.appendChild(style);
// }
  
// Fix the fetchTwitterData function around line 586

async function fetchTwitterData() {
    try {
        if (!appState.twitterConnected) {
            showToast('Please connect to Twitter API first', 'error');
            return;
        }
        
        // Validate inputs and sanitize data
        if (!twitterSearchTerm.value || twitterSearchTerm.value.trim() === '') {
            showToast('Please enter a search term', 'error');
            return;
        }
        
        // Sanitize search term to avoid path-related issues
        const searchTerm = twitterSearchTerm.value.trim();
        
        // Validate search type
        const validSearchTypes = ['hashtag', 'username'];
        if (!validSearchTypes.includes(twitterSearchType.value)) {
            showToast('Invalid search type selected', 'error');
            return;
        }
        
        updateStatus('Fetching Twitter data...');
        setProgress(10);
        logMessage(`Starting Twitter data fetch: ${twitterSearchType.value} - ${searchTerm}`, 'info');
        
        // Log request parameters for debugging
        console.log('Twitter fetch request parameters:', {
            source: 'twitter',
            twitter_bearer_token: twitterBearerToken.value ? '[REDACTED]' : 'MISSING',
            search_type: twitterSearchType.value,
            query: searchTerm,
            max_results: parseInt(twitterMaxTweets.value) || 100
        });
        
        // Call the Flask API to fetch Twitter data with sanitized inputs
        const response = await fetch(`${SERVER_URL}/collect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'twitter',
                twitter_bearer_token: twitterBearerToken.value,
                search_type: twitterSearchType.value,
                query: searchTerm,  // Using sanitized search term
                max_results: parseInt(twitterMaxTweets.value) || 100
            })
        });
        
        setProgress(50);
        
        // Handle response error
        if (!response.ok) {
            let errorMessage = 'Failed to fetch Twitter data';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
                
                // If we have a detailed error trace, log it
                if (errorData.trace) {
                    console.error('Error trace:', errorData.trace);
                }
            } catch (parseError) {
                console.error('Could not parse error response:', parseError);
            }
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('Twitter fetch result structure:', Object.keys(result)); // Debug log

        if (!result.data) {
            throw new Error('No data received from server');
        }
        
        if (Array.isArray(result.data)) {
            appState.twitterData = [...appState.twitterData, ...result.data];
            console.log('Updated Twitter data count:', appState.twitterData.length); // Debug log
            
            updateDataCounts();
            
            // Now run analysis on the collected data
            await runAnalysis();

            showToast(`Successfully fetched ${result.data.length} tweets`, 'success');
            logMessage(`Twitter data fetch completed: ${result.data.length} tweets retrieved`, 'info');
            updateStatus('Twitter data fetched and analyzed');
        } else {
            console.error('Twitter fetch error: Expected array but got', typeof result.data);
            throw new Error('Invalid data structure received from server');
        }

        setProgress(100);
        
        // Enable data actions
        exportRawDataBtn.disabled = false;
        clearDataBtn.disabled = false;
        runAnalysisBtn.disabled = false;

        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        console.error('Twitter fetch error:', error);
        showToast(`Twitter data fetch failed: ${error.message}`, 'error');
        logMessage(`Twitter data fetch failed: ${error.message}`, 'error');
        updateStatus('Twitter data fetch failed');
        setProgress(0);
    }
}
// async function fetchTwitterData() {
//     try {
//         if (!appState.twitterConnected) {
//             showToast('Please connect to Twitter API first', 'error');
//             return;
//         }
        
//         // Validate inputs
//         if (!twitterSearchTerm.value) {
//             showToast('Please enter a search term', 'error');
//             return;
//         }
        
//         updateStatus('Fetching Twitter data...');
//         setProgress(10);
//         logMessage(`Starting Twitter data fetch: ${twitterSearchType.value} - ${twitterSearchTerm.value}`, 'info');
        
//         // Call the Flask API to fetch Twitter data
//         const response = await fetch(`${SERVER_URL}/collect`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//                 source: 'twitter',
//                 twitter_bearer_token: twitterBearerToken.value,
//                 search_type: twitterSearchType.value,
//                 query: twitterSearchTerm.value,  // Changed from search_term to query
//                 max_results: parseInt(twitterMaxTweets.value) || 100
//             })
//         });
        
//         // setProgress(70);
        
//         if (!response.ok) {
//             const errorData = await response.json();
//             throw new Error(errorData.error || 'Failed to fetch Twitter data');
//         }
        
//         const result = await response.json();
//         console.log('Twitter fetch result:', result); // Debug log

//         if (Array.isArray(result.data)) {
//             appState.twitterData = [...appState.twitterData, ...result.data];
//             console.log('Updated Twitter data count:', appState.twitterData.length); // Debug log
            
//             updateDataCounts();
//             // Now run analysis on the collected data
//             await runAnalysis();

//             showToast(`Successfully fetched ${result.data.length} tweets`, 'success');
//             logMessage(`Twitter data fetch completed: ${result.data.length} tweets retrieved`, 'info');
//             updateStatus('Twitter data fetched and analyzed');
//         } else {
//             console.error('Twitter fetch error: Expected array but got', result.data);
//             throw new Error('Invalid data received from server.', 'error');
//         }

//         setProgress(100);
        
//         // updateDataCounts();
//         // showToast(`Successfully fetched ${result.data.length} tweets`, 'success');
//         // logMessage(`Twitter data fetch completed: ${result.data.length} tweets retrieved`, 'info');
//         // updateStatus('Twitter data fetched successfully');
//         // setProgress(100);
        
//         // Enable data actions
//         exportRawDataBtn.disabled = false;
//         clearDataBtn.disabled = false;
//         runAnalysisBtn.disabled = false;

//         // // Auto-navigate to Analysis tab --> added
//         // const analyzeTabButton = document.querySelector('[data-tab="analysis"]');
//         // if (analyzeTabButton) {
//         //     analyzeTabButton.click();
//         //     logMessage('Auto-navigated to analysis tab', 'info');
//         // } else {
//         //     console.error('Could not find analysis tab button');
//         // }
        
//         // // Auto-run analysis after a short delay --> added
//         // setTimeout(() => {
//         //     if (appState.twitterData.length > 0) {
//         //         logMessage('Auto-running analysis...', 'info');
//         //         runAnalysis();
//         //     } else {
//         //         logMessage('Cannot auto-run analysis: No data available', 'error');
//         //     }
//         // }, 1000);

//         setProgress(100);

//         // Reset progress after a delay
//         setTimeout(() => setProgress(0), 1000);
//     } catch (error) {
//         console.error('Twitter fetch error:', error);  // Add debugging
//         showToast(`Twitter data fetch failed: ${error.message}`, 'error');
//         logMessage(`Twitter data fetch failed: ${error.message}`, 'error');
//         updateStatus('Twitter data fetch failed');
//         setProgress(0);
//     }
// }

// Fetch Instagram data
async function fetchInstagramData() {
    try {
        if (!appState.instagramConnected) {
            showToast('Please connect to Instagram API first', 'error');
            return;
        }
        
        // Validate inputs
        if (!instagramSearchTerm.value) {
            showToast('Please enter a search term', 'error');
            return;
        }
        
        updateStatus('Fetching Instagram data...');
        setProgress(10);
        logMessage(`Starting Instagram data fetch: ${instagramSearchType.value} - ${instagramSearchTerm.value}`, 'info');
        
        // Call the Flask API to fetch Instagram data
        const response = await fetch(`${SERVER_URL}/collect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source: 'instagram',
                instagram_session_id: instagramSessionId.value,
                instagram_ds_user_id: instagramDsUserId.value,
                instagram_csrf_token: instagramCsrfToken.value,
                search_type: instagramSearchType.value,
                query: instagramSearchTerm.value,
                max_results: parseInt(instagramMaxPosts.value) || 50
            })
        });
        
        // setProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch Instagram data');
        }
                
        // Add data to state
        const result = await response.json();
        console.log('Instagram fetch result:', result); // Debug log

        if (Array.isArray(result.data)) {
            appState.instagramData = [...appState.instagramData, ...result.data];
            console.log('Updated Instagram data count:', appState.instagramData.length); // Debug log

            updateDataCounts();
            // Now run analysis on the collected data
            await runAnalysis();

            showToast(`Successfully fetched ${result.data.length} Instagram posts`, 'success');
            logMessage(`Instagram data fetch and analysiscompleted: ${result.data.length} posts retrieved`, 'info');
            updateStatus('Instagram data fetched and analyzed');
        } else {
            console.error('Instagram fetch error: Expected array but got', result.data);
            throw new Error('Invalid data received from server.', 'error');
        }

        updateStatus('Instagram data fetched successfully');
        setProgress(100);

        // updateDataCounts();
        // showToast(`Successfully fetched ${result.data.length} Instagram posts`, 'success');
        // logMessage(`Instagram data fetch completed: ${result.data.length} posts retrieved`, 'info');
        // updateStatus('Instagram data fetched successfully');
        // setProgress(100);
        
        // Enable data actions
        exportRawDataBtn.disabled = false;
        clearDataBtn.disabled = false;
        runAnalysisBtn.disabled = false;

        // // Auto-navigate to Analysis tab --> added
        // const analyzeTabButton = document.querySelector('[data-tab="analysis"]');
        // if (analyzeTabButton) {
        //     analyzeTabButton.click();
        //     logMessage('Auto-navigated to analysis tab', 'info');
        // } else {
        //     console.error('Could not find analysis tab button');
        // }

        // // Auto-run analysis after a short delay --> added
        // setTimeout(() => {
        //     if (appState.instagramData.length > 0) {
        //         logMessage('Auto-running analysis...', 'info');
        //         runAnalysis();
        //     } else {
        //         logMessage('Cannot auto-run analysis: No data available', 'error');
        //     }
        // }, 1000);

        setProgress(100);
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        console.error('Instagram fetch error:', error);
        showToast(`Instagram data fetch failed: ${error.message}`, 'error');
        logMessage(`Instagram data fetch failed: ${error.message}`, 'error');
        updateStatus('Instagram data fetch failed');
        setProgress(0);
    }
}

// Export raw data to JSON file
async function exportRawData() {
    try {
        if (appState.twitterData.length === 0 && appState.instagramData.length === 0) {
            showToast('No data to export', 'error');
            return;
        }
        
        updateStatus('Exporting raw data...');
        setProgress(30);
        
        const data = {
            twitter: appState.twitterData,
            instagram: appState.instagramData,
            exportDate: new Date().toISOString()
        };
        
        // Get save path from main process
        const savePath = await ipcRenderer.invoke('open-save-dialog', {
            title: 'Export Raw Data',
            defaultPath: path.join(appState.outputDirectory, 'social_data_export.json'),
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });
        
        if (!savePath) {
            updateStatus('Export cancelled');
            setProgress(0);
            return;
        }
        
        // Save file
        await ipcRenderer.invoke('save-file', {
            defaultPath: savePath,
            data: JSON.stringify(data, null, 2)
        });

        
        showToast('Data exported successfully', 'success');
        logMessage(`Raw data exported to ${savePath}`, 'info');
        updateStatus('Data exported successfully');
        setProgress(100);
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        showToast(`Export failed: ${error.message}`, 'error');
        logMessage(`Data export failed: ${error.message}`, 'error');
        updateStatus('Export failed');
        setProgress(0);
    }
}

function calculateStats(data) {
    // Calculate summary statistics
    const total = data.length;
    const positive = data.filter(d => d.sentiment === 'Positive').length;
    const negative = data.filter(d => d.sentiment === 'Negative').length;
    const neutral = total - positive - negative;
    
    return {
        total_analyzed: total,
        sentiment_distribution: {
            positive: (positive / total * 100).toFixed(1),
            negative: (negative / total * 100).toFixed(1),
            neutral: (neutral / total * 100).toFixed(1)
        },
        average_sentiment: calculateAverageScore(data)
    };
}

function calculateAverageScore(data) {
    const scores = data.map(d => {
        if (d.sentiment === 'Positive') return 1;
        if (d.sentiment === 'Negative') return -1;
        return 0;
    });
    return (scores.reduce((a,b) => a + b, 0) / scores.length).toFixed(2);
}

async function importData(clearBeforeImport = false) {
    try {
        updateStatus('Importing data...');
        setProgress(30);

        // If clearBeforeImport is true, clear existing data first
        if (clearBeforeImport) {
            // Clear all existing data
            appState.twitterData = [];
            appState.instagramData = [];
            updateDataCounts();
            logMessage('Cleared existing data before import', 'info');
            showToast('Existing data cleared successfully', 'success');
        }
        
        // Get file path from main process
        const filePath = await ipcRenderer.invoke('open-file-dialog', {
            title: 'Import Data',
            filters: [
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (!filePath) {
            updateStatus('Import cancelled');
            setProgress(0);
            return;
        }
        
        // Read file
        const fileContent = await ipcRenderer.invoke('read-file', filePath);
        console.log('File content length:', fileContent.length);
        
        // Debug the raw file content preview
        if (fileContent.length > 0) {
            console.log('File content preview:', fileContent.substring(0, 200) + '...');
        }
        
        // Function to repair common JSON syntax errors
        const repairJSON = (jsonString) => {
            let result = jsonString.trim();
            
            // Remove BOM character if present
            if (result.charCodeAt(0) === 0xFEFF) {
                result = result.slice(1);
            }
            
            // Handle specific syntax errors
            
            // 1. Fix missing commas between properties
            result = result.replace(/}(\s*){/g, '},{');
            result = result.replace(/](\s*){/g, '],{');
            result = result.replace(/}(\s*)\[/g, '},[');
            result = result.replace(/"(\s*){/g, '",{');
            result = result.replace(/}(\s*)"/g, '},"');
            
            // 2. Fix trailing commas before closing brackets
            result = result.replace(/,(\s*[\]}])/g, '$1');
            
            // 3. Fix property values followed by another property without comma
            result = result.replace(/"([^"]*)"(\s*)"([^"]*)"/g, '"$1","$3"');
            result = result.replace(/(\d+|true|false|null)(\s*)"([^"]*)"/g, '$1,"$3"');
            result = result.replace(/"([^"]*)"(\s*)(\d+|true|false|null)/g, '"$1",$3');
            
            // 4. Fix unquoted property names
            result = result.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3');
            
            // 5. Fix single quotes used instead of double quotes
            result = result.replace(/'([^']*)'/g, '"$1"');
            
            // 6. Fix trailing property with no value
            result = result.replace(/"([^"]*)"(\s*)(}|])/g, '"$1":null$3');
            
            // 7. Fix properties with equals instead of colon
            result = result.replace(/"([^"]*)"\s*=\s*/g, '"$1":');

            // 8. Extra safeguard for objects that start with a property but no opening brace
            if (!result.trimStart().startsWith('{') && !result.trimStart().startsWith('[')) {
                if (result.includes(':')) {
                    result = '{' + result;
                }
            }
            
            // 9. Make sure JSON is properly wrapped in { } or [ ]
            if (!result.trimEnd().endsWith('}') && !result.trimEnd().endsWith(']')) {
                if (result.trimStart().startsWith('{')) {
                    result = result + '}';
                } else if (result.trimStart().startsWith('[')) {
                    result = result + ']';
                }
            }
            
            return result;
        };
        
        // Try multiple approaches to parse the JSON
        let importedData;
        let parseSuccess = false;
        let parseError;
        
        // Approach 1: Basic parsing with minimal cleaning
        try {
            let cleanedContent = fileContent.trim();
            if (cleanedContent.charCodeAt(0) === 0xFEFF) { // Remove BOM
                cleanedContent = cleanedContent.slice(1);
            }
            importedData = JSON.parse(cleanedContent);
            parseSuccess = true;
            console.log('Basic JSON parsing successful');

            // 🔧 Wrap flat arrays if needed
            if (Array.isArray(importedData)) {
                console.log('Detected flat array structure. Wrapping based on content type.');
                let twitter = [];
                let instagram = [];

                importedData.forEach(item => {
                    if (item.tweet_text) {
                        twitter.push(item);
                    } else if (item.caption) {
                        instagram.push(item);
                    }
                });

                importedData = { twitter, instagram };
                console.log(`Wrapped into twitter (${twitter.length}), instagram (${instagram.length})`);
            }

        } catch (error) {
            console.log('Basic parsing failed:', error.message);
            parseError = error;
        }
        
        // Approach 2: Try with standard repair
        if (!parseSuccess) {
            try {
                const repairedJSON = repairJSON(fileContent);
                console.log('Repaired JSON preview:', repairedJSON.substring(0, 200) + '...');
                importedData = JSON.parse(repairedJSON);
                parseSuccess = true;
                console.log('Repaired JSON parsing successful');
            } catch (error) {
                console.log('Standard repair parsing failed:', error.message);
                parseError = error;
            }
        }
        
        // Approach 3: Try with JSON extraction
        if (!parseSuccess) {
            try {
                // Find anything that looks like a complete JSON object or array
                const jsonMatch = fileContent.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                if (jsonMatch) {
                    const extractedJSON = repairJSON(jsonMatch[0]);
                    console.log('Extracted JSON preview:', extractedJSON.substring(0, 200) + '...');
                    importedData = JSON.parse(extractedJSON);
                    parseSuccess = true;
                    console.log('Extracted JSON parsing successful');
                }
            } catch (error) {
                console.log('JSON extraction parsing failed:', error.message);
                parseError = error;
            }
        }
        
        // Approach 4: Line-by-line parsing for JSONL or multiple objects
        if (!parseSuccess) {
            try {
                const lines = fileContent.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    try {
                        if (lines[i].trim()) {
                            const lineData = JSON.parse(lines[i]);
                            if (lineData && typeof lineData === 'object') {
                                importedData = lineData;
                                parseSuccess = true;
                                console.log('Line-by-line parsing successful at line', i + 1);
                                break;
                            }
                        }
                    } catch (lineError) {
                        // Skip lines that don't parse
                    }
                }
            } catch (error) {
                console.log('Line-by-line parsing failed:', error.message);
            }
        }
        
        // Approach 5: Aggressive recovery - manually replace common error patterns
        if (!parseSuccess) {
            try {
                let aggressiveRepair = fileContent;
                
                // Target the specific positions mentioned in the error messages
                const errorPositions = [41, 146]; // From your error messages
                
                // For each error position, try to fix the surrounding content
                errorPositions.forEach(pos => {
                    if (pos < aggressiveRepair.length) {
                        // Look at characters around the error position
                        const startPos = Math.max(0, pos - 20);
                        const endPos = Math.min(aggressiveRepair.length, pos + 20);
                        const errorContext = aggressiveRepair.substring(startPos, endPos);
                        console.log(`Error context around position ${pos}:`, errorContext);
                        
                        // Insert a comma if it seems like one is missing
                        // This specifically addresses the "Expected ',' or '}'" errors
                        const beforeError = aggressiveRepair.substring(0, pos);
                        const afterError = aggressiveRepair.substring(pos);
                        
                        // Insert comma between value and next property
                        if (/["\d\w](\s*)["a-zA-Z]/.test(errorContext)) {
                            aggressiveRepair = beforeError + ',' + afterError;
                            console.log(`Inserted comma at position ${pos}`);
                        }
                    }
                });
                
                // Final repair pass
                aggressiveRepair = repairJSON(aggressiveRepair);
                console.log('Aggressively repaired JSON preview:', aggressiveRepair.substring(0, 200) + '...');
                importedData = JSON.parse(aggressiveRepair);
                parseSuccess = true;
                console.log('Aggressive repair parsing successful');
            } catch (error) {
                console.log('Aggressive repair parsing failed:', error.message);
                parseError = error;
            }
        }
        
        // Approach 6: Last resort - Try to manually extract just the data arrays
        if (!parseSuccess) {
            try {
                // Look for twitter or instagram arrays specifically
                const twitterMatch = fileContent.match(/"twitter"\s*:\s*(\[[\s\S]*?\])/);
                const instagramMatch = fileContent.match(/"instagram"\s*:\s*(\[[\s\S]*?\])/);
                
                let tempData = {};
                
                if (twitterMatch) {
                    try {
                        const twitterArray = JSON.parse(repairJSON(twitterMatch[1]));
                        if (Array.isArray(twitterArray)) {
                            tempData.twitter = twitterArray;
                            console.log('Successfully extracted Twitter array with', twitterArray.length, 'items');
                        }
                    } catch (e) {
                        console.log('Failed to parse Twitter array:', e.message);
                    }
                }
                
                if (instagramMatch) {
                    try {
                        const instagramArray = JSON.parse(repairJSON(instagramMatch[1]));
                        if (Array.isArray(instagramArray)) {
                            tempData.instagram = instagramArray;
                            console.log('Successfully extracted Instagram array with', instagramArray.length, 'items');
                        }
                    } catch (e) {
                        console.log('Failed to parse Instagram array:', e.message);
                    }
                }
                
                if (tempData.twitter || tempData.instagram) {
                    importedData = tempData;
                    parseSuccess = true;
                    console.log('Array extraction successful');
                }
            } catch (error) {
                console.log('Array extraction failed:', error.message);
                parseError = error;
            }
        }
        
        // If all parsing approaches fail
        if (!parseSuccess) {
            // Provide more detailed diagnosis
            let errorDetails = '';
            
            if (parseError && parseError.message.includes('position')) {
                const posMatch = parseError.message.match(/position (\d+)/);
                if (posMatch && posMatch[1]) {
                    const errorPos = parseInt(posMatch[1]);
                    const start = Math.max(0, errorPos - 30);
                    const end = Math.min(fileContent.length, errorPos + 30);
                    
                    errorDetails = `\nProblem area: "${fileContent.substring(start, errorPos)}` + 
                                  ` 👉 ${fileContent.substring(errorPos, errorPos + 1)} 👈 ` + 
                                  `${fileContent.substring(errorPos + 1, end)}"`;
                }
            }
            
            throw new Error(`Invalid JSON format: ${parseError.message}.${errorDetails} Please check the file format and try again.`);
        }
        
        // Validate data format
        if (!importedData || (typeof importedData !== 'object')) {
            throw new Error('Invalid file content - expected JSON object');
        }

        // *** KEY CHANGE #1: Handle direct array input by checking if importedData is an array ***
        let twitterData = [];
        let instagramData = [];
        
        if (Array.isArray(importedData)) {
            console.log('Detected direct array input - checking content type');
            
            // Sample several items to determine what kind of data this is
            const sampleSize = Math.min(5, importedData.length);
            const samples = importedData.slice(0, sampleSize);
            
            // Look for Twitter-specific fields in samples
            const twitterSignatures = ['tweet_text', 'tweet_like_count', 'tweet_retweet_count', 'followers_count'];
            const instagramSignatures = ['media_type', 'shortCode', 'ownerUsername', 'displayUrl', 'caption'];
            
            let twitterMatchCount = 0;
            let instagramMatchCount = 0;
            
            // Count how many signatures match in the samples
            samples.forEach(item => {
                if (!item || typeof item !== 'object') return;
                
                const itemKeys = Object.keys(item);
                
                twitterSignatures.forEach(sig => {
                    if (itemKeys.includes(sig)) twitterMatchCount++;
                });
                
                instagramSignatures.forEach(sig => {
                    if (itemKeys.includes(sig)) instagramMatchCount++;
                });
            });
            
            console.log(`Data signatures - Twitter: ${twitterMatchCount}, Instagram: ${instagramMatchCount}`);
            
            // Determine data type based on signature matches
            if (twitterMatchCount > instagramMatchCount) {
                console.log('Detected direct Twitter data array');
                twitterData = importedData;
            } else if (instagramMatchCount > 0) {
                console.log('Detected direct Instagram data array');
                instagramData = importedData;
            } else {
                // If no clear match, try one more detection method - look for username field
                // Twitter data usually has 'username' while Instagram has 'ownerUsername'
                const hasUsername = samples.some(item => item && item.username);
                if (hasUsername) {
                    console.log('Detected likely Twitter data based on username field');
                    twitterData = importedData;
                } else {
                    console.log('Unable to determine array type - will try generic import');
                }
            }
        } else {
            // Original logic for object with twitter/instagram keys
            twitterData = importedData.twitter || [];
            instagramData = importedData.instagram || [];
            
            // Deep search for twitter/instagram data
            const findDataArrays = (obj, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                // Check if this object has twitter/instagram arrays
                if (Array.isArray(obj.twitter) && obj.twitter.length > 0 && twitterData.length === 0) {
                    console.log(`Found Twitter data at path: ${path}.twitter`);
                    twitterData = obj.twitter;
                }
                
                if (Array.isArray(obj.instagram) && obj.instagram.length > 0 && instagramData.length === 0) {
                    console.log(`Found Instagram data at path: ${path}.instagram`);
                    instagramData = obj.instagram;
                }
                
                // If we found what we're looking for, no need to continue
                if (twitterData.length > 0 && instagramData.length > 0) return;
                
                // Recursively search other objects
                for (const key in obj) {
                    if (obj[key] && typeof obj[key] === 'object') {
                        findDataArrays(obj[key], `${path}.${key}`.replace(/^\./, ''));
                    }
                }
                
                // Also check if any arrays might contain our data items
                if (Array.isArray(obj) && obj.length > 0 && twitterData.length === 0 && instagramData.length === 0) {
                    // Sample the first few items to determine what kind of data this might be
                    const sampleItems = obj.slice(0, Math.min(5, obj.length));
                    
                    // Check for common Twitter fields
                    const hasTwitterFields = sampleItems.some(item => 
                        item && typeof item === 'object' && 
                        (item.tweet_id || item.text || item.in_reply_to_status_id || item.tweet_text)
                    );
                    
                    // Check for common Instagram fields
                    const hasInstagramFields = sampleItems.some(item => 
                        item && typeof item === 'object' && 
                        (item.media_type || item.caption || item.permalink || item.shortcode || item.ownerUsername)
                    );
                    
                    if (hasTwitterFields && !hasInstagramFields) {
                        console.log(`Found what appears to be Twitter data array at path: ${path}`);
                        twitterData = obj;
                    } else if (hasInstagramFields && !hasTwitterFields) {
                        console.log(`Found what appears to be Instagram data array at path: ${path}`);
                        instagramData = obj;
                    }
                }
            };
            
            // Start recursive search from root object
            findDataArrays(importedData);
        }
        
        // *** KEY CHANGE #2: Check for data before proceeding ***
        // If no data was found at all, handle this case
        if ((twitterData.length === 0 && instagramData.length === 0) || 
            (!Array.isArray(twitterData) && !Array.isArray(instagramData))) {
            showToast('No Twitter or Instagram data found in import file. Please check your file format.', 'warning');
            logMessage('Import completed but no data was found in the file.', 'warning');
            setProgress(0);
            updateStatus('No data found in import');
            return;
        }
        
        // Store data before merge to check if new data was added
        const prevTwitterCount = appState.twitterData.length;
        const prevInstagramCount = appState.instagramData.length;
        
        console.log('Current Twitter data count before merge:', prevTwitterCount);
        console.log('Current Instagram data count before merge:', prevInstagramCount);

        // Function to normalize data structure and ensure required fields
        const normalizeData = (items, dataType) => {
            return items.map(item => {
                if (!item) return null;
                
                // Create a new object with normalized structure
                const normalized = { ...item };
                
                // Ensure id field exists
                if (!normalized.id) {
                    if (dataType === 'twitter') {
                        normalized.id = item.tweet_id || 
                                       item.id_str || 
                                       (item.text && item.created_at ? 
                                        `tw_${item.text.substring(0, 20)}_${item.created_at}` : 
                                        `tw_${Math.random().toString(36).substring(2, 15)}`);
                    } else {
                        normalized.id = item.media_id || 
                                       item.shortcode || 
                                       (item.caption && item.timestamp ? 
                                        `ig_${item.caption.substring(0, 20)}_${item.timestamp}` : 
                                        `ig_${Math.random().toString(36).substring(2, 15)}`);
                    }
                }
                
                return normalized;
            }).filter(item => item !== null);
        };

        // Normalize and deduplicate data
        let newTwitterCount = 0;
        let newInstagramCount = 0;
        
        if (Array.isArray(twitterData) && twitterData.length > 0) {
            const normalizedTwitterData = normalizeData(twitterData, 'twitter');
            
            // Get existing IDs
            const existingIds = new Set(appState.twitterData.map(item => item.id));
            
            // Filter for new items
            const newTwitterData = normalizedTwitterData.filter(item => !existingIds.has(item.id));
            
            newTwitterCount = newTwitterData.length;
            console.log('New unique Twitter data count:', newTwitterCount);
            
            if (newTwitterCount > 0) {
                appState.twitterData = [...appState.twitterData, ...newTwitterData];
                console.log('Updated Twitter data after import:', appState.twitterData.length);
            }
        }
        
        if (Array.isArray(instagramData) && instagramData.length > 0) {
            const normalizedInstagramData = normalizeData(instagramData, 'instagram');
            
            // Get existing IDs
            const existingIds = new Set(appState.instagramData.map(item => item.id));
            
            // Filter for new items
            const newInstagramData = normalizedInstagramData.filter(item => !existingIds.has(item.id));
            
            newInstagramCount = newInstagramData.length;
            console.log('New unique Instagram data count:', newInstagramCount);
            
            if (newInstagramCount > 0) {
                appState.instagramData = [...appState.instagramData, ...newInstagramData];
                console.log('Updated Instagram data after import:', appState.instagramData.length);
            }
        }
        
        const newDataAdded = newTwitterCount > 0 || newInstagramCount > 0;

        // Modified behavior for clarity when no new data is found
        if (!newDataAdded) {
            if (clearBeforeImport) {
                // This should never happen after clearing, but just in case
                showToast('No data found in import file. Please check your file format.', 'warning');
                logMessage('Import completed but no data was found in the file.', 'warning');
            } else {
                // Show a more helpful message about duplicates
                showToast('No new data imported. Detected duplicate records - try "Clear & Import" instead.', 'warning');
                logMessage('Import found only duplicate records. Suggest using Clear & Import option.', 'warning');
                
                // Add a clear and import button to the UI
                showClearAndImportOption();
            }
            setProgress(0);
            updateStatus('No new data imported');
            return;
        }

        updateDataCounts();
        showToast(`Data imported successfully: ${newTwitterCount} Twitter, ${newInstagramCount} Instagram records added`, 'success');
        logMessage(`Data imported from ${filePath}: ${newTwitterCount} Twitter, ${newInstagramCount} Instagram records added`, 'info');
        updateStatus('Data imported successfully');
        setProgress(100);
        
        // Enable data actions
        exportRawDataBtn.disabled = false;
        clearDataBtn.disabled = false;
        runAnalysisBtn.disabled = false;

        // Switch to Analyze tab
        const analyzeTabButton = document.querySelector('[data-tab="analysis"]');
        if (analyzeTabButton) {
            analyzeTabButton.click();
            logMessage('Auto-navigated to analysis tab after import', 'info');
        } else {
            console.error('Could not find analysis tab button');
        }

        // Auto-run analysis after import
        // Auto-run analysis after confirming data counts are updated
        // In the importData function, replace the auto-analysis setTimeout with:
        setTimeout(() => {
            updateDataCounts();
            const total = appState.twitterData.length + appState.instagramData.length;
            
            if (total > 0) {
                showButtonLoading(runAnalysisBtn);
                updateStatus(`Analyzing ${total} records...`);
                
                const combinedData = [...appState.twitterData, ...appState.instagramData];
                const batchSize = total > 50000 ? 1000 : total;
            
                const analyzeBatch = async (batch) => {
                    try {
                        if (!Array.isArray(batch)) {
                            throw new Error("Invalid batch passed to analyzeBatch: not an array");
                        }
            
                        const response = await fetch(`${SERVER_URL}/analyze`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ data: batch })
                        });
            
                        if (!response.ok) {
                            const errorText = await response.text();
                            throw new Error(`Batch analysis failed: ${errorText}`);
                        }
            
                        return await response.json();
                    } catch (error) {
                        console.error("Batch analysis error:", error);
                        return { data: [], hashtag_analysis: {} };
                    }
                };
            
                (async () => {
                    let allResults = [];
            
                    for (let i = 0; i < total; i += batchSize) {
                        const batch = combinedData.slice(i, i + batchSize);      // ✅ FIXED HERE
                        const batchResults = await analyzeBatch(batch);          // ✅ FIXED HERE
                        allResults = [...allResults, ...(batchResults.data || [])];
            
                        updateStatus(`Analyzing... (${Math.min(i + batchSize, total)}/${total})`);
                        setProgress(((i + batchSize) / total) * 100);
                    }
            
                    appState.analysisResults = {
                        data: allResults,
                        stats: calculateStats(allResults)
                    };
            
                    displayAnalysisSummary(appState.analysisResults);
                    createVisualizations(appState.analysisResults);
                    hideButtonLoading(runAnalysisBtn);
                    showToast('Analysis completed!', 'success');
                })();
            }
        }, 500);

        // setTimeout(() => {
        //     if (appState.twitterData.length > 0 || appState.instagramData.length > 0) {
        //         logMessage('Auto-running analysis after import...', 'info');
        //         runAnalysis();
        //     } else {
        //         logMessage('Cannot auto-run analysis: No data available after import', 'error');
        //     }
        // }, 1000);

        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        console.error('Import error:', error);
        showToast(`Import failed: ${error.message}`, 'error');
        logMessage(`Data import failed: ${error.message}`, 'error');
        updateStatus('Import failed');
        setProgress(0);
        
        // Show more detailed error help with file repair options
        const errorHelpDiv = document.getElementById('error-help') || document.createElement('div');
        errorHelpDiv.id = 'error-help';
        errorHelpDiv.className = 'error-help mt-3 p-3 bg-red-50 text-red-800 rounded-md';
        errorHelpDiv.innerHTML = `
            <h4 class="font-bold">Import Troubleshooting:</h4>
            <ul class="list-disc pl-5 mt-2">
                <li>Ensure your file is valid JSON format</li>
                <li>Your JSON should be either an array of Twitter/Instagram items or an object with "twitter"/"instagram" arrays</li>
                <li>Each item should have appropriate fields (like username, tweet_text for Twitter or caption, shortCode for Instagram)</li>
                <li>Try opening the file in a text editor to check for formatting issues</li>
                <li>Consider validating your JSON using an online tool like JSONLint</li>
            </ul>
            <div class="mt-3">
                <button id="repair-json-btn" class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Repair JSON File
                </button>
                <p class="mt-2 text-sm">This will attempt to repair common JSON syntax errors and create a new file</p>
            </div>
        `;
        
        // Add to the import container
        const importContainer = document.querySelector('.import-container') || document.body;
        if (!document.getElementById('error-help')) {
            importContainer.appendChild(errorHelpDiv);
            
            // Add repair button functionality
            document.getElementById('repair-json-btn').addEventListener('click', async () => {
                try {
                    const inputFilePath = await ipcRenderer.invoke('open-file-dialog', {
                        title: 'Select JSON File to Repair',
                        filters: [
                            { name: 'JSON Files', extensions: ['json'] },
                            { name: 'All Files', extensions: ['*'] }
                        ],
                        properties: ['openFile']
                    });
                    
                    if (!inputFilePath) return;
                    
                    // Read the file content
                    const content = await ipcRenderer.invoke('read-file', inputFilePath);
                    
                    // Create a repaired version using our helper function
                    const repairJSON = (jsonString) => {
                        let result = jsonString.trim();
                        
                        // Remove BOM character if present
                        if (result.charCodeAt(0) === 0xFEFF) {
                            result = result.slice(1);
                        }
                        
                        // Fix missing commas between properties
                        result = result.replace(/}(\s*){/g, '},{');
                        result = result.replace(/](\s*){/g, '],{');
                        result = result.replace(/}(\s*)\[/g, '},['); 
                        result = result.replace(/"(\s*){/g, '",{');
                        result = result.replace(/}(\s*)"/g, '},"');
                        
                        // Fix trailing commas before closing brackets
                        result = result.replace(/,(\s*[\]}])/g, '$1');
                        
                        // Fix property values followed by another property without comma
                        result = result.replace(/"([^"]*)"(\s*)"([^"]*)"/g, '"$1","$3"');
                        result = result.replace(/(\d+|true|false|null)(\s*)"([^"]*)"/g, '$1,"$3"');
                        result = result.replace(/"([^"]*)"(\s*)(\d+|true|false|null)/g, '"$1",$3');
                        
                        // Fix unquoted property names
                        result = result.replace(/([{,]\s*)([a-zA-Z0-9_$]+)(\s*:)/g, '$1"$2"$3');
                        
                        // Fix single quotes used instead of double quotes
                        result = result.replace(/'([^']*)'/g, '"$1"');
                        
                        // Fix trailing property with no value
                        result = result.replace(/"([^"]*)"(\s*)(}|])/g, '"$1":null$3');
                        
                        // Fix properties with equals instead of colon
                        result = result.replace(/"([^"]*)"\s*=\s*/g, '"$1":');
                        
                        // Make sure JSON is properly wrapped
                        if (!result.trimStart().startsWith('{') && !result.trimStart().startsWith('[')) {
                            if (result.includes(':')) {
                                result = '{' + result;
                            }
                        }
                        
                        if (!result.trimEnd().endsWith('}') && !result.trimEnd().endsWith(']')) {
                            if (result.trimStart().startsWith('{')) {
                                result = result + '}';
                            } else if (result.trimStart().startsWith('[')) {
                                result = result + ']';
                            }
                        }
                        
                        return result;
                    };
                    
                    let repairedContent = repairJSON(content);
                    
                    // Test if the repair worked by trying to parse
                    try {
                        JSON.parse(repairedContent);
                        console.log('JSON repair successful - valid JSON created');
                    } catch (parseError) {
                        console.log('First repair attempt failed, trying more aggressive repair');
                        
                        // More aggressive repair for specific error cases
                        // Try to extract just valid parts
                        const jsonMatch = content.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                        if (jsonMatch) {
                            repairedContent = repairJSON(jsonMatch[0]);
                        }
                    }
                    
                    // Save the repaired file
                    const outputFilePath = await ipcRenderer.invoke('save-file-dialog', {
                        title: 'Save Repaired JSON',
                        defaultPath: inputFilePath.replace(/\.json$/, '_repaired.json'),
                        filters: [{ name: 'JSON Files', extensions: ['json'] }]
                    });
                    
                    if (outputFilePath) {
                        await ipcRenderer.invoke('write-file', outputFilePath, repairedContent);
                        showToast('JSON file repaired and saved successfully', 'success');
                        logMessage(`Repaired JSON file saved to: ${outputFilePath}`, 'info');
                    }
                } catch (error) {
                    console.error('JSON repair error:', error);
                    showToast(`JSON repair failed: ${error.message}`, 'error');
                    logMessage(`JSON repair failed: ${error.message}`, 'error');
                }
            });
        }
    }
}

// New function to show the Clear & Import option when duplicates are detected
function showClearAndImportOption() {
    // Check if the option already exists
    if (document.getElementById('clear-import-option')) {
        return;
    }
    
    const duplicateHelpDiv = document.createElement('div');
    duplicateHelpDiv.id = 'clear-import-option';
    duplicateHelpDiv.className = 'mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md';
    duplicateHelpDiv.innerHTML = `
        <h4 class="font-bold text-yellow-800">Duplicate Data Detected</h4>
        <p class="my-2">This file contains data that has already been imported. Would you like to:</p>
        <div class="flex space-x-3 mt-3">
            <button id="clear-import-btn" class="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                Clear & Re-Import Data
            </button>
            <button id="dismiss-duplicate-msg" class="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                Keep Existing Data
            </button>
        </div>
        <p class="text-sm mt-2 text-gray-600">
            "Clear & Re-Import" will remove all existing data and import this file from scratch.
        </p>
    `;
    
    // Add to the import container
    const importContainer = document.querySelector('.import-container') || document.querySelector('#import-tab') || document.body;
    importContainer.appendChild(duplicateHelpDiv);
    
    // Add functionality to the clear & import button
    document.getElementById('clear-import-btn').addEventListener('click', () => {
        // Call importData with clearBeforeImport = true
        importData(true);
        // Remove the duplicate help div
        duplicateHelpDiv.remove();
    });
    
    // Add functionality to dismiss the message
    document.getElementById('dismiss-duplicate-msg').addEventListener('click', () => {
        duplicateHelpDiv.remove();
    });
}

// Update the import button event listener to call the modified importData function
document.getElementById('import-btn').addEventListener('click', () => importData(false));

// Also add a new button in the UI for direct Clear & Import functionality
function addClearAndImportButton() {
    const importButtonContainer = document.getElementById('import-btn').parentNode;
    
    // Check if button already exists
    if (document.getElementById('clear-import-btn-main')) {
        return;
    }
    
    const clearImportBtn = document.createElement('button');
    clearImportBtn.id = 'clear-import-btn-main';
    clearImportBtn.className = 'ml-2 px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700';
    clearImportBtn.innerHTML = '<i class="fas fa-trash mr-1"></i> Clear & Import';
    clearImportBtn.title = 'Clear all existing data and import new data';
    
    importButtonContainer.appendChild(clearImportBtn);
    
    clearImportBtn.addEventListener('click', () => {
        if (confirm('This will delete all existing data. Continue?')) {
            importData(true);
        }
    });
}

// Call this function during initialization
addClearAndImportButton();


// Clear all data
function clearData() {
    const confirmClear = confirm('Are you sure you want to clear all data? This cannot be undone.');
    
    if (confirmClear) {
        appState.twitterData = [];
        appState.instagramData = [];
        appState.analysisResults = null;
        
        updateDataCounts();
        showToast('All data cleared', 'info');
        logMessage('All data cleared', 'info');
        updateStatus('All data cleared');
        
        // Disable data actions
        if (appState.twitterData.length === 0 && appState.instagramData.length === 0) {
            exportRawDataBtn.disabled = true;
            clearDataBtn.disabled = true;
            runAnalysisBtn.disabled = true;
            exportPdfBtn.disabled = true;
            exportHtmlBtn.disabled = true;
            exportExcelBtn.disabled = true;
            refreshVizBtn.disabled = true;
            exportImagesBtn.disabled = true;
            generateReportBtn.disabled = true;
        }
        
        // Clear visualizations
        clearVisualizations();
        
        // Clear analysis summary
        if (analysisSummaryEl) {
            analysisSummaryEl.innerHTML = '<p>No analysis results available</p>';
        }
    }
}

// Add this to your initialization code
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

async function robustFetch(url, options, retries = MAX_RETRIES) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return robustFetch(url, options, retries - 1);
        }
        throw error;
    }
}

// Run sentiment analysis
// Fix for the runAnalysis function to properly handle data
async function analyzeBatch(data) {
    try {
        console.log('Sending batch to analyze:', data.length, 'items');
        const response = await fetch(`${SERVER_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Batch analysis failed:', error);
        return {
            data: [],
            sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
            error: error.message
        };
    }
}

// ✅ Final working runAnalysis with progress and batch handling
async function runAnalysis() {
    try {
        const combinedData = [
            ...(Array.isArray(appState.twitterData) ? appState.twitterData : []),
            ...(Array.isArray(appState.instagramData) ? appState.instagramData : [])
          ];
          
          console.log("[DEBUG] combinedData type:", typeof combinedData);
          console.log("[DEBUG] Is combinedData array?", Array.isArray(combinedData));
          console.log("[DEBUG] combinedData length:", combinedData.length);
          
      if (!combinedData.length) {
        showToast("No data available for analysis", "warning");
        return;
      }
  
      const progressContainer = document.getElementById("analysis-progress-container");
      const progressText = document.getElementById("analysis-progress-text");
      const progressBar = document.getElementById("analysis-progress-bar");
  
      progressContainer.style.display = "block";
      progressBar.style.width = "0%";
      progressText.textContent = `Analyzing 0 of ${combinedData.length}`;
  
    const batchSize = 1000;
    const allResults = [];
    let hashtagSummary = {};

    for (let i = 0; i < combinedData.length; i += batchSize) {
    const batch = combinedData.slice(i, i + batchSize);

    // Final full-proof debug logs
    console.log("[DEBUG] i =", i);
    console.log("[DEBUG] batch.length =", batch.length);
    console.log("[DEBUG] batch isArray =", Array.isArray(batch));
    if (!Array.isArray(batch)) {
        throw new Error("🛑 Sliced batch is NOT an array! combinedData is corrupted.");
    }

    const result = await analyzeBatch(batch);

    if (Array.isArray(result.data)) {
        allResults.push(...result.data);
    }

    if (result.hashtag_analysis) {
        hashtagSummary = result.hashtag_analysis;
    }

    const completed = Math.min(i + batch.length, combinedData.length);
    const percent = (completed / combinedData.length) * 100;
    progressBar.style.width = `${percent.toFixed(1)}%`;
    progressText.textContent = `Analyzing... (${completed} / ${combinedData.length})`;
    }

  
      appState.analysisResults = allResults;
      appState.hashtagAnalysis = hashtagSummary;
  
      renderAnalysisReport(allResults);
      renderVisualizationGraphs(allResults, hashtagSummary);
  
      updateStatus("Analysis complete.");
      showToast("Analysis completed successfully", "success");
  
      progressText.textContent = "Analysis complete.";
      progressBar.style.width = "100%";
      setTimeout(() => {
        progressContainer.style.display = "none";
      }, 3000);
  
    } catch (error) {
      console.error("Analysis error:", error);
      updateStatus("Analysis failed.");
      showToast("Analysis failed: " + error.message, "error");
    }
  }



// async function runAnalysis() {
//     try {
//         const combinedData = [...appState.twitterData, ...appState.instagramData];

//         if (!combinedData.length) {
//             showToast("No data available for analysis", "warning");
//             return;
//         }

//         updateStatus("Running analysis...");
//         console.log("[DEBUG] Sending to /analyze:", combinedData);

//         const response = await fetch(`${SERVER_URL}/analyze`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ data: combinedData })
//         });

//         const result = await response.json();
//         if (!response.ok || !Array.isArray(result.data)) {
//             throw new Error(result.error || "Invalid response from analysis");
//         }
        

//         // ✅ Save results to app state
//         appState.analysisResults = result.data;
//         appState.hashtagAnalysis = result.hashtag_analysis;

//         // ✅ Render to UI
//         renderAnalysisReport(appState.analysisResults);
//         renderVisualizationGraphs(appState.analysisResults, appState.hashtagAnalysis);

//         updateStatus("Analysis complete.");
//         showToast("Analysis completed successfully", "success");
//     } catch (error) {
//         console.error("Analysis error:", error);
//         showToast("Analysis failed: " + error.message, "error");
//         updateStatus("Analysis failed.");
//     }
// }

// Enhanced Visualization Rendering with Chart Cleanup

// Enhanced Visualization Rendering with Chart Cleanup and Safe Canvas Use

// Enhanced Visualization Rendering with Chart Cleanup and Safe Canvas Use

// var sentimentChartInstance = null;
// var platformChartInstance = null;
// var hashtagChartInstance = null;
// var topHashtagChartInstance = null;

// function renderVisualizationGraphs(data, hashtagAnalysis) {
//     // Clear any existing charts properly before attempting to create new ones
//     destroyExistingCharts();

//     const sentimentCanvas = document.getElementById('sentiment-chart');
//     const platformCanvas = document.getElementById('platform-chart');
//     const hashtagCanvas = document.getElementById('hashtag-chart');
//     const topHashtagCanvas = document.getElementById('top-hashtag-chart'); // New canvas for top hashtags

//     if (!sentimentCanvas || !platformCanvas || !hashtagCanvas || !topHashtagCanvas) {
//         console.error("Canvas elements not found.");
//         return;
//     }

//     const sentimentCtx = sentimentCanvas.getContext('2d');
//     const platformCtx = platformCanvas.getContext('2d');
//     const hashtagCtx = hashtagCanvas.getContext('2d');
//     const topHashtagCtx = topHashtagCanvas.getContext('2d');

//     const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
//     const platformCounts = {};
//     const hashtagCounts = {};

//     data.forEach(item => {
//         if (item.sentiment) {
//             sentimentCounts[item.sentiment] = (sentimentCounts[item.sentiment] || 0) + 1;
//         }

//         const platform = item.platform || 'Unknown';
//         platformCounts[platform] = (platformCounts[platform] || 0) + 1;

//         (item.hashtags || []).forEach(tag => {
//             const key = tag.toLowerCase();
//             hashtagCounts[key] = (hashtagCounts[key] || 0) + 1;
//         });
//     });

//     const totalSentiments = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);

//     const createDoughnutChart = (ctx, labels, values, colors, title) => new Chart(ctx, {
//         type: 'doughnut',
//         data: {
//             labels: labels.map((l, i) => `${l} (${values[i]})`),
//             datasets: [{
//                 data: values,
//                 backgroundColor: colors,
//                 borderColor: '#fff',
//                 borderWidth: 2
//             }]
//         },
//         options: {
//             responsive: true,
//             plugins: {
//                 title: {
//                     display: true,
//                     text: title,
//                     font: { size: 18 }
//                 },
//                 tooltip: {
//                     callbacks: {
//                         label: function(context) {
//                             const percent = ((context.raw / totalSentiments) * 100).toFixed(1);
//                             return `${context.label}: ${context.raw} (${percent}%)`;
//                         }
//                     }
//                 },
//                 legend: { position: 'bottom' }
//             }
//         }
//     });

//     try {
//         sentimentChartInstance = createDoughnutChart(
//             sentimentCtx,
//             Object.keys(sentimentCounts),
//             Object.values(sentimentCounts),
//             ['#28a745', '#ffc107', '#dc3545'],
//             'Sentiment Distribution'
//         );

//         platformChartInstance = createDoughnutChart(
//             platformCtx,
//             Object.keys(platformCounts),
//             Object.values(platformCounts),
//             ['#007bff', '#6610f2', '#20c997', '#fd7e14'],
//             'Platform Distribution'
//         );

//         const topHashtags = Object.entries(hashtagCounts)
//             .sort((a, b) => b[1] - a[1])
//             .slice(0, 10);

//         hashtagChartInstance = new Chart(hashtagCtx, {
//             type: 'bar',
//             data: {
//                 labels: topHashtags.map(([tag]) => `#${tag}`),
//                 datasets: [{
//                     label: 'Hashtag Usage',
//                     data: topHashtags.map(([_, count]) => count),
//                     backgroundColor: '#17a2b8'
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 plugins: {
//                     title: {
//                         display: true,
//                         text: 'Top Trending Hashtags',
//                         font: { size: 18 }
//                     },
//                     legend: { display: false },
//                     tooltip: {
//                         callbacks: {
//                             label: function(context) {
//                                 return `${context.label}: ${context.raw} uses`;
//                             }
//                         }
//                     }
//                 },
//                 scales: {
//                     x: {
//                         ticks: {
//                             autoSkip: false,
//                             maxRotation: 60,
//                             minRotation: 30
//                         }
//                     },
//                     y: {
//                         beginAtZero: true
//                     }
//                 }
//             }
//         });

//         // New top hashtag pie chart
//         topHashtagChartInstance = new Chart(topHashtagCtx, {
//             type: 'pie',
//             data: {
//                 labels: topHashtags.map(([tag]) => `#${tag}`),
//                 datasets: [{
//                     data: topHashtags.map(([_, count]) => count),
//                     backgroundColor: [
//                         '#007bff', '#6610f2', '#20c997', '#fd7e14', '#6f42c1',
//                         '#e83e8c', '#dc3545', '#17a2b8', '#ffc107', '#28a745'
//                     ]
//                 }]
//             },
//             options: {
//                 responsive: true,
//                 plugins: {
//                     title: {
//                         display: true,
//                         text: 'Hashtag Distribution (Top 10)',
//                         font: { size: 18 }
//                     },
//                     legend: {
//                         position: 'bottom'
//                     }
//                 }
//             }
//         });

//     } catch (error) {
//         console.error("Error creating charts:", error);
//         destroyExistingCharts();
//     }
// }

// function destroyExistingCharts() {
//     function safeDestroyChart(chartInstance) {
//         if (chartInstance && typeof chartInstance.destroy === 'function') {
//             try {
//                 chartInstance.destroy();
//             } catch (error) {
//                 console.warn("Error while destroying chart:", error);
//             }
//         }
//     }

//     safeDestroyChart(sentimentChartInstance);
//     safeDestroyChart(platformChartInstance);
//     safeDestroyChart(hashtagChartInstance);
//     safeDestroyChart(topHashtagChartInstance);

//     sentimentChartInstance = null;
//     platformChartInstance = null;
//     hashtagChartInstance = null;
//     topHashtagChartInstance = null;
// }

function renderVisualizationGraphs(sentimentData, hashtagData) {
    const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
    sentimentData.forEach(item => {
        sentimentCounts[item.sentiment] = (sentimentCounts[item.sentiment] || 0) + 1;
    });

    const sentimentTotal = Object.values(sentimentCounts).reduce((a, b) => a + b, 0);
    const sentimentContainer = document.getElementById('sentiment-viz');
    sentimentContainer.querySelector(".placeholder-text").style.display = sentimentTotal ? "none" : "block";

    if (sentimentChart) sentimentChart.destroy();
    if (sentimentTotal > 0) {
        sentimentChart = new Chart(sentimentChartEl, {
            type: "doughnut",
            data: {
                labels: Object.keys(sentimentCounts).map(k => `${k} (${sentimentCounts[k]})`),
                datasets: [{
                    data: Object.values(sentimentCounts),
                    backgroundColor: ["#28a745", "#ffc107", "#dc3545"],
                    borderColor: "#fff",
                    borderWidth: 2,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: "Sentiment Distribution",
                        font: { size: 20, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const percent = ((context.raw / sentimentTotal) * 100).toFixed(1);
                                return `${context.label}: ${context.raw} (${percent}%)`;
                            }
                        }
                    },
                    legend: { position: 'bottom' }
                },
                animation: {
                    animateScale: true
                }
            }
        });
    }

    const topTags = (hashtagData && hashtagData.top_hashtags) ? hashtagData.top_hashtags.slice(0, 10) : [];
    const hashtagContainer = document.getElementById('hashtags-viz');
    hashtagContainer.querySelector(".placeholder-text").style.display = topTags.length ? "none" : "block";

    if (hashtagChart) hashtagChart.destroy();
    if (topTags.length > 0) {
        hashtagChart = new Chart(hashtagChartEl, {
            type: "bar",
            data: {
                labels: topTags.map(h => `#${h.hashtag}`),
                datasets: [
                    {
                        label: "Mentions",
                        data: topTags.map(h => h.count),
                        backgroundColor: "rgba(0, 123, 255, 0.8)",
                        borderColor: "#0056b3",
                        borderWidth: 1
                    },
                    {
                        label: "Avg Likes",
                        data: topTags.map(h => h.avg_likes || 0),
                        backgroundColor: "rgba(40, 167, 69, 0.8)",
                        borderColor: "#1c7430",
                        borderWidth: 1
                    },
                    {
                        label: "Avg Retweets",
                        data: topTags.map(h => h.avg_retweets || 0),
                        backgroundColor: "rgba(255, 193, 7, 0.8)",
                        borderColor: "#e0a800",
                        borderWidth: 1
                    },
                    {
                        label: "Avg Replies",
                        data: topTags.map(h => h.avg_replies || 0),
                        backgroundColor: "rgba(220, 53, 69, 0.8)",
                        borderColor: "#bd2130",
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Hashtags Engagement Overview',
                        font: { size: 20, weight: 'bold' }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { maxRotation: 45, minRotation: 30 },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        stacked: false,
                        grid: { color: "#ddd" }
                    }
                },
                animation: {
                    duration: 1200,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    const platformCounts = {};
    sentimentData.forEach(item => {
        const platform = item.platform || 'Unknown';
        platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    const platformContainer = document.getElementById('platforms-viz');
    platformContainer.querySelector(".placeholder-text").style.display = Object.keys(platformCounts).length ? "none" : "block";

    if (platformChart) platformChart.destroy();
    if (Object.keys(platformCounts).length > 0) {
        platformChart = new Chart(platformChartEl, {
            type: "polarArea",
            data: {
                labels: Object.keys(platformCounts).map(p => `${p} (${platformCounts[p]})`),
                datasets: [{
                    data: Object.values(platformCounts),
                    backgroundColor: ["#1da1f2", "#c13584", "#6f42c1", "#fd7e14"],
                    borderColor: "#fff",
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: "Platform Distribution",
                        font: { size: 20, weight: 'bold' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const total = Object.values(platformCounts).reduce((a, b) => a + b, 0);
                                const percent = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${context.raw} (${percent}%)`;
                            }
                        }
                    },
                    legend: {
                        position: 'bottom',
                        labels: { usePointStyle: true }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
            }
        });
    }
}




// function renderVisualizationGraphs(sentimentData, hashtagData) {
//     // === Sentiment Distribution ===
//     const sentimentCounts = { Positive: 0, Neutral: 0, Negative: 0 };
//     sentimentData.forEach(item => {
//         sentimentCounts[item.sentiment] = (sentimentCounts[item.sentiment] || 0) + 1;
//     });

//     if (sentimentChart) sentimentChart.destroy();
//     sentimentChart = new Chart(sentimentChartEl, {
//         type: "pie",
//         data: {
//             labels: Object.keys(sentimentCounts),
//             datasets: [{
//                 data: Object.values(sentimentCounts),
//                 backgroundColor: ["#28a745", "#ffc107", "#dc3545"]
//             }]
//         }
//     });

//     // ✅ Define topTags before using
//     const topTags = (hashtagData && hashtagData.top_hashtags) ? hashtagData.top_hashtags : [];

//     if (hashtagChart) hashtagChart.destroy();
//     hashtagChart = new Chart(hashtagChartEl, {
//         type: "bar",
//         data: {
//             labels: topTags.map(h => h.hashtag),
//             datasets: [{
//                 label: "Mentions",
//                 data: topTags.map(h => h.count),
//                 backgroundColor: "#007bff"
//             }]
//         }
//     });

//     // === Platform Distribution ===
//     const platformCounts = { twitter: 0, instagram: 0 };
//     sentimentData.forEach(item => {
//         platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
//     });

//     if (platformChart) platformChart.destroy();
//     platformChart = new Chart(platformChartEl, {
//         type: "doughnut",
//         data: {
//             labels: Object.keys(platformCounts),
//             datasets: [{
//                 data: Object.values(platformCounts),
//                 backgroundColor: ["#1da1f2", "#c13584"]
//             }]
//         }
//     });
// }




// async function runAnalysis() {
//     if (!await checkServerStatus()) return;
//     try {
//         // Verify we have data
//         const hasData = appState.twitterData?.length > 0 || appState.instagramData?.length > 0;
//         if (!hasData) {
//             showToast('No data available for analysis', 'error');
//             return;
//         }

//         // Prepare data
//         const analysisData = {
//             twitter_data: appState.twitterData || [],
//             instagram_data: appState.instagramData || [],
//             method: analysisMethodEl.value,
//             language: languageEl.value
//         };

//         console.log('Starting analysis with:', analysisData);
//         console.log('[DEBUG] Twitter data:', appState.twitterData?.length, 'items');
//         console.log('[DEBUG] Instagram data:', appState.instagramData?.length, 'items');
        
//         if ((!appState.twitterData || appState.twitterData.length === 0) && 
//             (!appState.instagramData || appState.instagramData.length === 0)) {
//             console.error('[ERROR] No data available for analysis');
//             throw new Error('No data available for analysis');
//         }

//         const payload = {
//             twitter_data: appState.twitterData || [],
//             instagram_data: appState.instagramData || [],
//             method: analysisMethodEl.value,
//             language: languageEl.value
//         };
        
//         console.log('[DEBUG] Sending payload to server:', {
//             twitter_count: payload.twitter_data.length,
//             instagram_count: payload.instagram_data.length,
//             method: payload.method
//         });

//         const response = await fetch(`${SERVER_URL}/analyze`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(payload)
//         });

//         console.log('[DEBUG] Server response status:', response.status);
        
//         if (!response.ok) {
//             const error = await response.json().catch(() => ({ error: 'Unknown error' }));
//             console.error('[ERROR] Server error:', error);
//             throw new Error(error.error || 'Analysis failed');
//         }

//         const result = await response.json();
//         console.log('[DEBUG] Analysis results:', {
//             data_count: result.data?.length,
//             sample_item: result.data?.[0],
//             sentiment_distribution: result.sentiment_distribution
//         });

//         appState.analysisResults = result;
//         displayAnalysisSummary(result);
//         createVisualizations(result);
        
//         showToast('Analysis completed!', 'success');
//     } catch (error) {
//         console.error('[ERROR] Analysis failed:', error);
//         showToast(`Analysis failed: ${error.message}`, 'error');
//     }
// }
// async function runAnalysis() {
//     try {
//         // Show loading state
//         showButtonLoading(runAnalysisBtn);
//         updateStatus('Analyzing data...');
//       // Additional debugging to verify data before analysis
//       console.log("Starting analysis process...");
  
//       // More detailed debugging of appState
//       console.log("Current appState details:");
//       console.log("- Twitter data:", appState.twitterData? `${appState.twitterData.length} records`: "undefined or empty");
//       console.log("- Instagram data:", appState.instagramData? `${appState.instagramData.length} records`: "undefined or empty");
//       console.log("- Server status:", appState.serverStatus);
  
//       // Ensure data arrays are properly initialized
//       if (!appState.twitterData) {
//         console.warn(
//           "Twitter data is not initialized, initializing as empty array"
//         );
//         appState.twitterData = [];
//       }
  
//       if (!appState.instagramData) {
//         console.warn(
//           "Instagram data is not initialized, initializing as empty array"
//         );
//         appState.instagramData = [];
//       }

//       // Validate data
//       if (!appState.twitterData && !appState.instagramData) {
//         throw new Error('No data available for analysis');
//     }
  
//       // Check if data is available
//       if (
//         appState.twitterData.length === 0 &&
//         appState.instagramData.length === 0
//       ) {
//         console.error("No data available for analysis");
//         showToast(
//           "No data available for analysis. Please import data first.",
//           "error"
//         );
//         logMessage("Analysis attempted but no data available", "error");
//         return;
//       }

//       const validTwitter = appState.twitterData.filter(
//         d => d.tweet_text && typeof d.tweet_text === 'string' && d.tweet_text.trim().length > 0
//       );
//       const validInstagram = appState.instagramData.filter(
//         d => d.caption && typeof d.caption === 'string' && d.caption.trim().length > 0
//       );
      
//       if (validTwitter.length === 0 && validInstagram.length === 0) {
//         showToast('No valid content available for analysis.', 'error');
//         logMessage('Analysis failed: No valid tweet_text or caption in data.', 'error');
//         return;
//       }

//       updateStatus('Preparing data for analysis...');
//       setProgress(10);

//       console.log("Sample Twitter Data:", JSON.stringify(appState.twitterData.slice(0, 1), null, 2));
//       console.log("Sample Instagram Data:", JSON.stringify(appState.instagramData.slice(0, 1), null, 2));
      
//       const dataToSend = {
//         twitter_data: appState.twitterData.map(item => ({...item, text: item.text || item.tweet_text || item.full_text || ''})),
//         instagram_data: appState.instagramData.map(item => ({...item, text: item.text || item.caption || ''})),
//         method: analysisMethodEl.value,
//         language: languageEl.value,
//         exclude_retweets: excludeRetweetsEl.checked,
//         exclude_replies: excludeRepliesEl.checked
//       };

//       setProgress(30);
//       logMessage('Sending data for analysis...', 'info');

      
//       // Log a sample of what we're sending
//       console.log("Sample of request data:", {
//         twitter_count: dataToSend.twitter_data.length,
//         twitter_sample:
//           dataToSend.twitter_data.length > 0 ? dataToSend.twitter_data[0] : null,
//         instagram_count: dataToSend.instagram_data.length,
//         method: dataToSend.method,
//         language: dataToSend.language
//       });
  
//       updateStatus("Checking server connection...");
//       setProgress(5);
  
//       // Check if server is available by making a ping request
//       let pingResponse;
//       try {
//         const controller = new AbortController();
//         const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds
  
//         pingResponse = await fetch(`${SERVER_URL}/ping`, {
//           method: "GET",
//           headers: { "Content-Type": "application/json" },
//           signal: controller.signal
//         });
//         clearTimeout(timeoutId);
//       } catch (err) {
//         if (err.name === "AbortError") {
//           throw new Error("Server ping timed out");
//         } else {
//           throw err;
//         }
//       }
  
//       if (!pingResponse.ok) {
//         throw new Error(`Server responded with status: ${pingResponse.status}`);
//       }
  
//       const pingData = await pingResponse.json();
//       if (!pingData.status || pingData.status !== "ok") {
//         throw new Error("Server ping returned invalid response");
//       }
  
//       // Update server status
//       appState.serverStatus = "connected";
//       console.log("Server connection confirmed");
  
//       updateStatus("Running analysis...");
//       setProgress(10);
//       logMessage(`Starting ${analysisMethodEl.value} analysis...`, "info");
  
//       // Debug logging before sending data
//       console.log("Sending analysis request with:");
//       console.log("- Twitter data count:", dataToSend.twitter_data.length);
//       console.log("- Instagram data count:", dataToSend.instagram_data.length);
//       console.log("- Method:", dataToSend.method);
  
//       // Call the Flask API to run analysis
//       const response = await fetch(`${SERVER_URL}/analyze`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify(dataToSend),
//         // Set a longer timeout for the actual analysis request
//         // signal: AbortSignal.timeout(300000) // 5 minute timeout
//       });
  
//       setProgress(70);
  
//       if (!response.ok) {
//         const errorText = await response.text();
//         let errorMessage = "Analysis failed";
  
//         try {
//           const errorData = JSON.parse(errorText);
//           errorMessage = errorData.error || errorMessage;
//         } catch (e) {
//           // If error text isn't valid JSON, use it directly if not too long
//           if (errorText && errorText.length < 100) {
//             errorMessage = errorText;
//           }
//         }
  
//         throw new Error(errorMessage);
//       }
  
//       const result = await response.json();
//       console.log("Analysis result received:", result);

//       if (!result.data || result.data.length === 0) {
//         throw new Error('Analysis completed but no results were returned');
//     }

//       // Prepare data
//       const analysisData = {
//         twitter_data: appState.twitterData || [],
//         instagram_data: appState.instagramData || [],
//         method: analysisMethodEl.value,
//         language: languageEl.value
//     };
      
//       // Call analysis with retry logic
//       const analysisResult = await robustFetch(`${SERVER_URL}/analyze`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(analysisData)
//     });

  
//       // Store analysis results
//       appState.analysisResults = result;
  
//       // Update analysis summary
//       displayAnalysisSummary(result);

//       showToast('Analysis completed successfully!', 'success');
//       console.log('Analysis completed successfully!');
//       setProgress(100);
  
//       // Update visualizations
//       createVisualizations(result);
  
//       showToast("Analysis completed successfully", "success");
//       logMessage("Analysis completed", "info");
//       updateStatus("Analysis completed");
//       setProgress(100);
  
//       // Enable export buttons
//       exportPdfBtn.disabled = false;
//       exportHtmlBtn.disabled = false;
//       exportExcelBtn.disabled = false;
//       refreshVizBtn.disabled = false;
//       exportImagesBtn.disabled = false;
//       generateReportBtn.disabled = false;

//       // Navigate to analysis tab
//       document.querySelector('[data-tab="analysis"]')?.click();
//       showToast('Analysis completed!', 'success');
//       console.log('Analysis completed!');
  
//       // Auto-navigate to Visualize tab
//       setTimeout(() => {
//         const visualizeTabButton = document.querySelector(
//           '[data-tab="visualization"]'
//         );
//         if (visualizeTabButton) {
//           visualizeTabButton.click();
//           logMessage("Auto-navigated to visualization tab", "info");
//         }
//       }, 1000);
  
//       // Auto-generate report after analysis completes
//       setTimeout(() => {
//         logMessage("Auto-generating analysis report...", "info");
//         generateReport();
//       }, 2000);
  
//       // Reset progress after a delay
//       setTimeout(() => setProgress(0), 1500);
//     } catch (error) {
//       console.error("Analysis error:", error);
//       showToast(`Analysis failed: ${error.message}`, "error");
//       logMessage(`Analysis failed: ${error.message}`, "error");
//       updateStatus("Analysis failed");
//       setProgress(0);
//     } finally {
//         setTimeout(() => setProgress(0), 1000);
//     }
//   }

// Function to handle data import and ensure analysis runs properly afterward
function handleDataImport(importedData) {
    try {
        appState.twitterData = [];
        appState.instagramData = [];

        let newTwitterCount = 0;
        let newInstagramCount = 0;

        // Normalize Twitter
        if (Array.isArray(importedData.twitter)) {
            importedData.twitter.forEach(item => {
                if (item.tweet_text && typeof item.tweet_text === "string") {
                    appState.twitterData.push({
                        id: item.id || crypto.randomUUID(),
                        original_text: item.tweet_text,
                        cleaned_text: item.tweet_text,
                        text: item.tweet_text,
                        timestamp: item.date_time || new Date().toISOString(),
                        username: item.username || "unknown",
                        hashtags: item.tweet_text.match(/#\w+/g) || [],
                        tweet_like_count: item.tweet_like_count || 0,
                        tweet_retweet_count: item.tweet_retweet_count || 0,
                        tweet_reply_count: item.tweet_reply_count || 0,
                        platform: "twitter"
                    });
                    newTwitterCount++;
                }
            });
        }

        // Normalize Instagram
        if (Array.isArray(importedData.instagram)) {
            importedData.instagram.forEach(item => {
                if (item.caption && typeof item.caption === "string") {
                    appState.instagramData.push({
                        id: item.id,
                        original_text: item.caption,
                        cleaned_text: item.caption,
                        caption: item.caption,
                        timestamp: item.timestamp || new Date().toISOString(),
                        username: item.ownerUsername || "unknown",
                        hashtags: item.hashtags || [],
                        platform: "instagram"
                    });
                    newInstagramCount++;
                }
            });
        }

        logMessage(`Data imported: ${newTwitterCount} Twitter, ${newInstagramCount} Instagram records added`, 'info');

        updateDataCounts();

        const analysisTab = document.querySelector('[data-tab="analysis"]');
        if (analysisTab) {
            analysisTab.click();
            logMessage("Auto-navigated to analysis tab after import", "info");
        }

        setTimeout(() => {
            if (appState.twitterData.length + appState.instagramData.length > 0) {
                logMessage("Auto-running analysis after import.", "info");
                runAnalysis();
            }
        }, 1000);

    } catch (error) {
        console.error('Data import error:', error);
        showToast(`Data import error: ${error.message}`, 'error');
        logMessage(`Data import failed: ${error.message}`, 'error');
    }
}



// Add this function to check the validity of imported data
function validateImportedData(data) {
    // Check if data is an object
    if (typeof data !== 'object' || data === null) {
        console.error('Invalid data format: not an object');
        return false;
    }
    
    // Check Twitter data
    if (data.twitter) {
        if (!Array.isArray(data.twitter)) {
            console.error('Invalid Twitter data: not an array');
            return false;
        }
        
        // Check a sample of Twitter data if available
        if (data.twitter.length > 0) {
            const sample = data.twitter[0];
            if (typeof sample !== 'object' || sample === null) {
                console.error('Invalid Twitter data item format');
                return false;
            }
        }
    }
    
    // Check Instagram data
    if (data.instagram) {
        if (!Array.isArray(data.instagram)) {
            console.error('Invalid Instagram data: not an array');
            return false;
        }
        
        // Check a sample of Instagram data if available
        if (data.instagram.length > 0) {
            const sample = data.instagram[0];
            if (typeof sample !== 'object' || sample === null) {
                console.error('Invalid Instagram data item format');
                return false;
            }
        }
    }
    
    return true;
}

// Import data function update - to ensure data is properly loaded
async function importDataFromFile(filePath) {
    try {
        const fileContent = await fs.promises.readFile(filePath, 'utf8');
        let importedData;
        
        try {
            importedData = JSON.parse(fileContent);
        } catch (parseError) {
            console.error('Error parsing JSON file:', parseError);
            showToast('Error parsing file. Make sure it contains valid JSON data.', 'error');
            logMessage(`Failed to parse file: ${filePath}`, 'error');
            return;
        }
        
        // Validate the imported data
        if (!validateImportedData(importedData)) {
            showToast('Invalid data format. Please check the file structure.', 'error');
            logMessage(`Invalid data format in file: ${filePath}`, 'error');
            return;
        }
        
        // Clear existing data
        logMessage('Cleared existing data before import', 'info');
        
        // Process the imported data
        handleDataImport(importedData);
        
        // Update import status
        updateStatus(`Imported data from ${path.basename(filePath)}`);
        showToast('Data imported successfully', 'success');
    } catch (error) {
        console.error('File import error:', error);
        showToast(`Failed to import file: ${error.message}`, 'error');
        logMessage(`File import failed: ${error.message}`, 'error');
    }
}

// Combined generateReport function that incorporates both approaches
async function generateReport() {
    try {
        if (!appState.analysisResults) {
            showToast('No analysis results available', 'error');
            logMessage('Report generation failed: No analysis results available', 'error');
            return;
        }
        
        updateStatus('Generating report...');
        setProgress(10);
        logMessage('Starting report generation...', 'info');
        
        // First try to get a save path from main process (from your original code)
        let savePath;
        let useBackendPath = false;
        
        try {
            savePath = await ipcRenderer.invoke('open-save-dialog', {
                title: 'Generate Report',
                defaultPath: path.join(appState.outputDirectory, 'comprehensive_report.pdf'),
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            });
            
            if (!savePath) {
                // If user cancels the save dialog, use backend path instead
                useBackendPath = true;
                logMessage('Save dialog cancelled, using backend path instead', 'info');
            }
        } catch (error) {
            // If we can't get a save path (e.g., if ipcRenderer isn't available),
            // fall back to letting the backend choose the path
            useBackendPath = true;
            logMessage('Could not access save dialog, using backend path instead', 'info');
        }
        
        // Determine which API endpoint and payload to use
        const apiEndpoint = useBackendPath ? '/generate_report' : '/generate-report';
        let requestBody;
        
        if (useBackendPath) {
            // Use the approach from the pasted code
            requestBody = {
                analysis_results: appState.analysisResults,
                report_type: 'comprehensive',
                include_visualizations: true
            };
        } else {
            // Use the approach from your original code
            requestBody = {
                analysis_results: appState.analysisResults,
                twitter_data: appState.twitterData,
                instagram_data: appState.instagramData,
                method: analysisMethodEl.value,
                language: languageEl.value,
                exclude_retweets: excludeRetweetsEl.checked,
                exclude_replies: excludeRepliesEl.checked,
                output_path: savePath
            };
        }
        
        // Call the Flask API to generate report
        const response = await fetch(`${SERVER_URL}${apiEndpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        
        setProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Report generation failed');
        }
        
        const result = await response.json();
        console.log('Report generation result:', result);
        
        if (useBackendPath) {
            // Store the generated report and display it (from pasted code)
            appState.generatedReport = result.report;
            displayReport(result.report);
            
            showToast('Report generated successfully', 'success');
            logMessage('Report generation completed', 'info');
        } else {
            // Original approach - open the file that was saved
            showToast('Report generated successfully', 'success');
            logMessage(`Comprehensive report generated at ${savePath}`, 'info');
            
            // Open the file
            ipcRenderer.send('open-file', savePath);
        }
        
        updateStatus('Report generated');
        setProgress(100);
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        console.error('Report generation error:', error);
        showToast(`Report generation failed: ${error.message}`, 'error');
        logMessage(`Report generation failed: ${error.message}`, 'error');
        updateStatus('Report generation failed');
        setProgress(0);
    }
}

// Function to display the generated report (from pasted code)
function displayReport(reportData) {
    // Find the report container element
    const reportContainer = document.getElementById('report-container') || 
                           document.querySelector('.report-container');
                           
    if (!reportContainer) {
        console.error('Report container not found');
        return;
    }
    
    // Navigate to the report tab if it exists
    const reportTabButton = document.querySelector('[data-tab="report"]') || 
                           document.querySelector('[data-tab="report-tab"]');
    
    if (reportTabButton) {
        reportTabButton.click();
        logMessage('Navigated to report tab', 'info');
    }
    
    // Populate the report container with the report content
    reportContainer.innerHTML = reportData.html || '';
    
    // If the report has sections that need to be shown/hidden with toggles
    const toggleButtons = reportContainer.querySelectorAll('.toggle-section');
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const isVisible = targetElement.style.display !== 'none';
                targetElement.style.display = isVisible ? 'none' : 'block';
                button.textContent = isVisible ? 'Show section' : 'Hide section';
            }
        });
    });
    
    // If there are downloadable versions, enable buttons
    if (reportData.pdf_path) {
        const downloadPdfButton = document.getElementById('download-pdf-btn');
        if (downloadPdfButton) {
            downloadPdfButton.disabled = false;
            downloadPdfButton.onclick = () => {
                ipcRenderer.invoke('open-external', reportData.pdf_path);
            };
        }
    }
    
    if (reportData.docx_path) {
        const downloadDocxButton = document.getElementById('download-docx-btn');
        if (downloadDocxButton) {
            downloadDocxButton.disabled = false;
            downloadDocxButton.onclick = () => {
                ipcRenderer.invoke('open-external', reportData.docx_path);
            };
        }
    }
}

// Add event listener for the generate report button
document.addEventListener('DOMContentLoaded', () => {
    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', generateReport);
    }
});

// Add this test function to your frontend
async function testServerConnection() {
    try {
      const response = await fetch('http://localhost:5000/', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      console.log("Server response:", await response.text());
    } catch (error) {
      console.error("Server connection test failed:", error);
    }
  }
  
  // Call it when your app starts
  testServerConnection();

  async function analyzeBatch(data) {
    try {
        const response = await fetch('http://localhost:5000/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ data }),
            timeout: 30000 // 30 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Analysis failed:', error);
        // Return a valid empty structure to prevent UI crashes
        return {
            sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
            platform_distribution: {},
            hashtag_analysis: { top_hashtags: [] },
            error: error.message
        };
    }
}

// Display analysis summary function (from your code)

function displayAnalysisSummary(results) {
    const container = document.getElementById('analysis-summary');
    if (!container) return;

    console.log('[DEBUG] Raw results for display:', results);

    if (!results || !results.data || results.data.length === 0) {
        container.innerHTML = '<div class="error">No analysis data available</div>';
        return;
    }

    // More robust sentiment counting
    const counts = { positive: 0, negative: 0, neutral: 0 };
    results.data.forEach(item => {
        const sentiment = String(item.sentiment || '').toLowerCase();
        if (sentiment.includes('positive')) counts.positive++;
        else if (sentiment.includes('negative')) counts.negative++;
        else counts.neutral++;
    });

    const total = results.data.length;
    console.log('[DEBUG] Calculated counts:', counts, 'Total:', total);

    container.innerHTML = `
        <div class="analysis-report">
            <h2>Analysis Report</h2>
            <p>Total posts analyzed: ${total}</p>
            
            <div class="sentiment-cards">
                <div class="card positive">
                    <h3>Positive</h3>
                    <div class="count">${counts.positive}</div>
                    <div class="percentage">${total > 0 ? ((counts.positive/total)*100).toFixed(1) : 0}%</div>
                </div>
                
                <div class="card neutral">
                    <h3>Neutral</h3>
                    <div class="count">${counts.neutral}</div>
                    <div class="percentage">${total > 0 ? ((counts.neutral/total)*100).toFixed(1) : 0}%</div>
                </div>
                
                <div class="card negative">
                    <h3>Negative</h3>
                    <div class="count">${counts.negative}</div>
                    <div class="percentage">${total > 0 ? ((counts.negative/total)*100).toFixed(1) : 0}%</div>
                </div>
            </div>
            
            ${total === 0 ? '<p class="warning">No valid posts were analyzed</p>' : ''}
        </div>
    `;
}
// function displayAnalysisSummary(results) {
//     const container = document.getElementById('analysis-summary');
//     if (!container) {
//         console.error('Analysis summary container not found');
//         return;
//     }

//     if (!results || !results.data || results.data.length === 0) {
//         container.innerHTML = '<div class="error">No analysis data available</div>';
//         return;
//     }

//     // More robust sentiment counting
//     const counts = { positive: 0, negative: 0, neutral: 0 };
//     results.data.forEach(item => {
//         const sentiment = String(item.sentiment || '').toLowerCase();
//         if (sentiment.includes('positive')) counts.positive++;
//         else if (sentiment.includes('negative')) counts.negative++;
//         else counts.neutral++;
//     });

//     const total = results.data.length;
//     console.log('[DEBUG] Calculated counts:', counts, 'Total:', total);

//     container.innerHTML = `
//         <div class="analysis-report">
//             <h2><i class="fas fa-chart-pie"></i> Sentiment Analysis Report</h2>
            
//             <div class="sentiment-summary">
//                 <div class="sentiment-card positive">
//                     <div class="sentiment-value">${positive}</div>
//                     <div class="sentiment-label">Positive</div>
//                     <div class="sentiment-percent">${total > 0 ? ((positive/total)*100).toFixed(1) : 0}%</div>
//                 </div>
                
//                 <div class="sentiment-card neutral">
//                     <div class="sentiment-value">${neutral}</div>
//                     <div class="sentiment-label">Neutral</div>
//                     <div class="sentiment-percent">${total > 0 ? ((neutral/total)*100).toFixed(1) : 0}%</div>
//                 </div>
                
//                 <div class="sentiment-card negative">
//                     <div class="sentiment-value">${negative}</div>
//                     <div class="sentiment-label">Negative</div>
//                     <div class="sentiment-percent">${total > 0 ? ((negative/total)*100).toFixed(1) : 0}%</div>
//                 </div>
//             </div>
            
//             <div class="additional-metrics">
//                 <div class="metric">
//                     <span class="metric-label">Total Posts Analyzed:</span>
//                     <span class="metric-value">${total}</span>
//                 </div>
//                 ${results.platform_distribution ? `
//                 <div class="metric">
//                     <span class="metric-label">Platform Distribution:</span>
//                     <span class="metric-value">
//                         ${Object.entries(results.platform_distribution).map(([platform, count]) => 
//                             `${platform}: ${count} (${((count/total)*100).toFixed(1)}%)`
//                         ).join(', ')}
//                     </span>
//                 </div>` : ''}
//             </div>
//         </div>
        
//         <style>
//             .analysis-report {
//                 background: white;
//                 padding: 20px;
//                 border-radius: 8px;
//                 box-shadow: 0 2px 10px rgba(0,0,0,0.1);
//             }
            
//             .sentiment-summary {
//                 display: flex;
//                 gap: 15px;
//                 margin: 20px 0;
//             }
            
//             .sentiment-card {
//                 flex: 1;
//                 padding: 15px;
//                 text-align: center;
//                 border-radius: 8px;
//                 box-shadow: 0 2px 5px rgba(0,0,0,0.1);
//             }
            
//             .sentiment-card.positive {
//                 border-top: 4px solid #4CAF50;
//                 background: rgba(76, 175, 80, 0.1);
//             }
            
//             .sentiment-card.neutral {
//                 border-top: 4px solid #FFC107;
//                 background: rgba(255, 193, 7, 0.1);
//             }
            
//             .sentiment-card.negative {
//                 border-top: 4px solid #F44336;
//                 background: rgba(244, 67, 54, 0.1);
//             }
            
//             .sentiment-value {
//                 font-size: 24px;
//                 font-weight: bold;
//                 margin-bottom: 5px;
//             }
            
//             .sentiment-percent {
//                 font-size: 14px;
//                 color: #666;
//             }
            
//             .additional-metrics {
//                 margin-top: 20px;
//             }
            
//             .metric {
//                 margin-bottom: 10px;
//             }
            
//             .metric-label {
//                 font-weight: bold;
//                 margin-right: 5px;
//             }
//         </style>
//     `;
// }

// Helper functions
function getTopHashtags(data) {
    const hashtagCounts = {};
    
    data.forEach(post => {
        const text = post.text || post.caption || '';
        const hashtags = text.match(/#\w+/g) || [];
        
        hashtags.forEach(tag => {
            const cleanTag = tag.toLowerCase();
            hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
        });
    });
    
    return Object.entries(hashtagCounts)
        .map(([tag, count]) => ({ tag: tag.replace('#', ''), count }))
        .sort((a, b) => b.count - a.count);
}

function getSamplePosts(data) {
    // Get 3 sample posts from each sentiment
    const samples = [];
    const sentiments = ['Positive', 'Neutral', 'Negative'];
    
    sentiments.forEach(sentiment => {
        const filtered = data.filter(d => d.sentiment === sentiment);
        samples.push(...filtered.slice(0, 3));
    });
    
    return samples.sort(() => Math.random() - 0.5).slice(0, 5);
}

// Helper functions that would be defined elsewhere in your JS code
function getAnalysisSummary(trendReport) {
    // Implementation would mirror the Python version
    // This is a placeholder - you would need to implement this
    return {
        sentiment: {
            positive: trendReport.sentiment_distribution?.Positive || 0,
            neutral: trendReport.sentiment_distribution?.Neutral || 0,
            negative: trendReport.sentiment_distribution?.Negative || 0
        },
        platforms: trendReport.platform_distribution || {},
        hashtags: {
            total: trendReport.hashtag_analysis?.total_hashtags || 0,
            unique: trendReport.hashtag_analysis?.unique_hashtags || 0,
            top_hashtags: trendReport.hashtag_analysis?.top_hashtags || []
        },
        engagement: {
            likes: trendReport.engagement_metrics?.total_likes || 0,
            retweets: trendReport.engagement_metrics?.total_retweets || 0,
            replies: trendReport.engagement_metrics?.total_replies || 0,
            comments: trendReport.engagement_metrics?.total_comments || 0
        },
        time_analysis: {
            interval: trendReport.time_analysis?.interval || 'day',
            peak_activity: ['N/A', {total_items: 0}]
        }
    };
}

function getInsights(trendReport) {
    // Implementation would mirror the Python version
    // This is a placeholder - you would need to implement this
    return [
        "Sample insight 1: Positive sentiment dominates the conversation",
        "Sample insight 2: Twitter has higher engagement than Instagram",
        "Sample insight 3: #TrendingTopic was the most popular hashtag"
    ];
}

function getSampleResults(data) {
    if (!data || data.length === 0) return '<p>No results to display</p>';
    
    const samples = data.slice(0, 3); // Show first 3 results
    return samples.map(item => `
        <div class="result-item">
            <p><strong>Text:</strong> ${item.cleaned_text || item.text || ''}</p>
            <p><strong>Sentiment:</strong> 
                <span class="sentiment-${item.sentiment?.toLowerCase() || 'neutral'}">
                    ${item.sentiment || 'Unknown'}
                </span>
            </p>
        </div>
    `).join('');
}

// Create data visualizations
function createVisualizations(results) {
    clearVisualizations();

    // Add validation at the start
    if (!results || !results.data) {
        console.error('Invalid analysis results:', results);
        showToast('No valid analysis data available', 'error');
        return;
    }

    const data = results.data; // Define data from results

    // Rest of your visualization code...
    const sentimentData = results.sentiment_distribution || {
        positive: data.filter(d => d.sentiment === 'Positive').length,
        neutral: data.filter(d => d.sentiment === 'Neutral').length,
        negative: data.filter(d => d.sentiment === 'Negative').length
    };

    const total = data.length;
    const positivePercent = ((sentimentData.positive / total) * 100).toFixed(1);
    const neutralPercent = ((sentimentData.neutral / total) * 100).toFixed(1);
    const negativePercent = ((sentimentData.negative / total) * 100).toFixed(1);

    // Calculate sentiment distribution if not provided
    if (!results.sentiment_distribution) {
        const data = results.data;
        results.sentiment_distribution = {
            positive: data.filter(d => d.sentiment === 'Positive').length,
            neutral: data.filter(d => d.sentiment === 'Neutral').length,
            negative: data.filter(d => d.sentiment === 'Negative').length
        };
    }
    
   // 1. Enhanced Sentiment Chart
   if (sentimentChartEl) {
    const ctx = sentimentChartEl.getContext('2d');
    sentimentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [
                `Positive (${positivePercent}%)`, 
                `Neutral (${neutralPercent}%)`, 
                `Negative (${negativePercent}%)`
            ],
            datasets: [{
                data: [sentimentData.positive, sentimentData.neutral, sentimentData.negative],
                backgroundColor: ['#4CAF50', '#FFC107', '#F44336'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Sentiment Distribution',
                    font: { size: 16 }
                },
                legend: {
                    position: 'right',
                    labels: {
                        font: { size: 12 },
                        padding: 20
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${context.raw} posts`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// 2. Time Series Chart (if date data exists)
const timeData = analyzePostingTimes(data);
if (timeData && document.getElementById('timeline-chart')) {
    const timeCtx = document.getElementById('timeline-chart').getContext('2d');
    new Chart(timeCtx, {
        type: 'line',
        data: {
            labels: timeData.labels,
            datasets: [{
                label: 'Posts Over Time',
                data: timeData.values,
                borderColor: '#4285F4',
                backgroundColor: 'rgba(66, 133, 244, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Posting Activity Timeline'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Date' }
                },
                y: {
                    title: { display: true, text: 'Number of Posts' },
                    beginAtZero: true
                }
            }
        }
    });
}

// 3. Platform Comparison Chart
if (platformChartEl) {
    const platformData = {
        twitter: data.filter(d => d.platform === 'twitter').length,
        instagram: data.filter(d => d.platform === 'instagram').length
    };
    
    const platformCtx = platformChartEl.getContext('2d');
    platformChart = new Chart(platformCtx, {
        type: 'bar',
        data: {
            labels: ['Twitter', 'Instagram'],
            datasets: [{
                label: 'Number of Posts',
                data: [platformData.twitter, platformData.instagram],
                backgroundColor: ['#1DA1F2', '#E1306C'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Platform Comparison'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}
}

function analyzePostingTimes(data) {
// Group posts by date (simplified example)
const dateCounts = {};
data.forEach(post => {
    if (post.created_at) {
        const date = post.created_at.split('T')[0]; // Extract date part
        dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
});

const sortedDates = Object.keys(dateCounts).sort();
return {
    labels: sortedDates,
    values: sortedDates.map(date => dateCounts[date])
};
}


// Clear visualizations
function clearVisualizations() {
    if (sentimentChart) {
        sentimentChart.destroy();
        sentimentChart = null;
    }
    
    if (hashtagChart) {
        hashtagChart.destroy();
        hashtagChart = null;
    }
    
    if (platformChart) {
        platformChart.destroy();
        platformChart = null;
    }
}

// Refresh visualizations
function refreshVisualizations() {
    if (appState.analysisResults) {
        createVisualizations(appState.analysisResults);
        showToast('Visualizations refreshed', 'info');
    } else {
        showToast('No analysis results available', 'error');
    }
}

// Export as PDF
async function exportAsPdf() {
    const container = document.getElementById('analysis-summary');
    if (!container) {
        showToast('Analysis summary not found', 'error');
        return;
    }
    try {
        updateStatus('Preparing PDF export...');
        setProgress(30);
        
        // Calculate A4 dimensions and margins
        // A4 is 210mm × 297mm
        // Using a consistent margin of 20mm on all sides
        const marginSize = 20; // in mm
        const pageWidth = 210; // A4 width in mm
        const contentWidth = pageWidth - (marginSize * 2); // Content width in mm
        const contentWidthPx = Math.floor(contentWidth * 3.78); // Convert to px (approx 3.78px per mm)
        
        // Clone and prepare content
        const clone = container.cloneNode(true);
        
        // Create a container with exact dimensions matching A4 page with margins
        const wrapper = document.createElement('div');
        wrapper.style.width = `${contentWidthPx}px`;
        wrapper.style.padding = '0';
        wrapper.style.margin = '0';
        wrapper.style.background = '#ffffff';
        wrapper.style.color = '#000000';
        wrapper.style.fontFamily = 'Arial, sans-serif';
        wrapper.style.boxSizing = 'border-box';
        
        // Add heading
        const heading = document.createElement('h1');
        heading.textContent = '📊 Sentiment Analysis Report';
        heading.style.textAlign = 'center';
        heading.style.marginBottom = '25px';
        heading.style.fontSize = '22px';
        heading.style.color = '#333';
        heading.style.width = '100%';
        wrapper.appendChild(heading);
        
        // Fix all elements to respect the wrapper width
        const allElements = clone.querySelectorAll('*');
        allElements.forEach(el => {
            el.style.maxWidth = '100%';
            el.style.boxSizing = 'border-box';
            
            // Handle tables specifically
            if (el.tagName === 'TABLE') {
                el.style.width = '100%';
                el.style.tableLayout = 'fixed';
                el.style.wordBreak = 'break-word';
            }
            
            // Remove specific margin settings that could interfere
            if (window.getComputedStyle(el).marginLeft !== window.getComputedStyle(el).marginRight) {
                el.style.marginLeft = 'auto';
                el.style.marginRight = 'auto';
            }
        });
        
        wrapper.appendChild(clone);
        
        // Add to invisible DOM for rendering
        const ghost = document.createElement('div');
        ghost.style.position = 'fixed';
        ghost.style.left = '-9999px';
        ghost.style.top = '0';
        ghost.appendChild(wrapper);
        document.body.appendChild(ghost);
        
        // Force layout calculations
        ghost.offsetHeight;
        
        setProgress(50);
        
        // Configure html2pdf with exact margin settings
        const options = {
            margin: marginSize, // Equal margin on all sides in mm
            filename: 'Analysis_Report.pdf',
            image: { type: 'jpeg', quality: 1 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                logging: false,
                letterRendering: true,
                width: contentWidthPx
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                precision: 16 // Higher precision for calculations
            },
            pagebreak: {
                mode: ['avoid-all', 'css', 'legacy'],
                before: '.page-break-before',
                after: '.page-break-after'
            }
        };
        
        setProgress(70);
        
        // Generate and save PDF with precisely controlled margins
        await html2pdf().set(options).from(wrapper).save();
        
        // Clean up
        document.body.removeChild(ghost);
        
        showToast('PDF exported successfully', 'success');
        updateStatus('PDF exported');
        setProgress(100);
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        console.error('PDF export error:', error);
        showToast('Failed to export PDF', 'error');
        updateStatus('Export failed');
        setProgress(0);
    }
}




// Export as HTML
async function exportAsHtml() {
    try {
        if (!appState.analysisResults) {
            showToast('No analysis results available', 'error');
            return;
        }
        
        updateStatus('Exporting as HTML...');
        setProgress(30);
        
        // Get save path from main process
        const savePath = await ipcRenderer.invoke('open-save-dialog', {
            title: 'Export as HTML',
            defaultPath: path.join(appState.outputDirectory, 'sentiment_analysis_report.html'),
            filters: [{ name: 'HTML Files', extensions: ['html'] }]
        });
        
        if (!savePath) {
            updateStatus('Export cancelled');
            setProgress(0);
            return;
        }
        
        // Call the Flask API to generate HTML
        const response = await fetch(`${SERVER_URL}/export-html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysis_results: appState.analysisResults,
                twitter_count: appState.twitterData.length,
                instagram_count: appState.instagramData.length,
                method: analysisMethodEl.value,
                output_path: savePath
            }),
        });
        
        setProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'HTML export failed');
        }
        
        showToast('HTML exported successfully', 'success');
        logMessage(`HTML exported to ${savePath}`, 'info');
        updateStatus('HTML exported successfully');
        setProgress(100);
        
        // Open the file
        ipcRenderer.send('open-file', savePath);
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        showToast(`HTML export failed: ${error.message}`, 'error');
        logMessage(`HTML export failed: ${error.message}`, 'error');
        updateStatus('HTML export failed');
        setProgress(0);
    }
}

// Export as Excel
async function exportAsExcel() {
    try {
        if (!appState.analysisResults) {
            showToast('No analysis results available', 'error');
            return;
        }
        
        updateStatus('Exporting as Excel...');
        setProgress(30);
        
        // Get save path from main process
        const savePath = await ipcRenderer.invoke('open-save-dialog', {
            title: 'Export as Excel',
            defaultPath: path.join(appState.outputDirectory, 'sentiment_analysis_report.xlsx'),
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        });
        
        if (!savePath) {
            updateStatus('Export cancelled');
            setProgress(0);
            return;
        }
        
        // Call the Flask API to generate Excel
        const response = await fetch(`${SERVER_URL}/export-excel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                analysis_results: appState.analysisResults,
                twitter_data: appState.twitterData,
                instagram_data: appState.instagramData,
                method: analysisMethodEl.value,
                output_path: savePath
            }),
        });
        
        setProgress(70);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Excel export failed');
        }
        
        showToast('Excel exported successfully', 'success');
        logMessage(`Excel exported to ${savePath}`, 'info');
        updateStatus('Excel exported successfully');
        setProgress(100);
        
        // Open the file
        ipcRenderer.send('open-file', savePath);
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        showToast(`Excel export failed: ${error.message}`, 'error');
        logMessage(`Excel export failed: ${error.message}`, 'error');
        updateStatus('Excel export failed');
        setProgress(0);
    }
}

// Export chart images
async function exportImages() {
    try {
        if (!sentimentChart && !hashtagChart && !platformChart) {
            showToast('No visualizations available', 'error');
            return;
        }
        
        updateStatus('Exporting chart images...');
        setProgress(30);
        
        // Get directory path from main process
        const result = await ipcRenderer.invoke('show-folder-dialog', {
            title: 'Select Export Directory',
            defaultPath: appState.outputDirectory
        });
        
        if (!result || result.canceled || !result.filePaths[0]) {
            updateStatus('Export cancelled');
            setProgress(0);
            return;
        }
        
        const dirPath = result.filePaths[0];
        
        // Export sentiment chart
        if (sentimentChart) {
            const sentimentDataUrl = sentimentChart.toBase64Image();
            await ipcRenderer.invoke('save-image', path.join(dirPath, 'sentiment_chart.png'), sentimentDataUrl);
        }
        
        // Export hashtag chart
        if (hashtagChart) {
            const hashtagDataUrl = hashtagChart.toBase64Image();
            await ipcRenderer.invoke('save-image', path.join(dirPath, 'hashtag_chart.png'), hashtagDataUrl);
        }
        
        // Export platform chart
        if (platformChart) {
            const platformDataUrl = platformChart.toBase64Image();
            await ipcRenderer.invoke('save-image', path.join(dirPath, 'platform_chart.png'), platformDataUrl);
        }
        
        showToast('Chart images exported successfully', 'success');
        logMessage(`Chart images exported to ${dirPath}`, 'info');
        updateStatus('Chart images exported successfully');
        setProgress(100);
        
        // Open the directory
        ipcRenderer.send('open-file', dirPath);
        
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000);
    } catch (error) {
        showToast(`Image export failed: ${error.message}`, 'error');
        logMessage(`Image export failed: ${error.message}`, 'error');
        updateStatus('Image export failed');
        setProgress(0);
    }
}

// ----------------------------------------------------------------------------------------------------------------------
// Completing and improving render.js

function filterLogs() {
    const filter = logFilterEl.value;
    const logItems = logContentEl.querySelectorAll('.log-item');

    logItems.forEach(item => {
        const itemType = item.classList.contains('info') ? 'info'
                      : item.classList.contains('error') ? 'error'
                      : item.classList.contains('warning') ? 'warning'
                      : 'info';

        if (filter === 'all' || filter === itemType) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Enhance setProgress with animation
function setProgress(value) {
    if (!progressBarEl) return;

    progressBarEl.style.transition = 'width 0.5s ease';
    progressBarEl.style.width = `${value}%`;

    if (value === 0) {
        progressBarEl.parentElement.classList.add('hidden');
    } else {
        progressBarEl.parentElement.classList.remove('hidden');
    }
}

// Add spinner to buttons
function showButtonLoading(button) {
    if (!button) return;
    button.disabled = true;
    button.classList.add('loading');
}

function hideButtonLoading(button) {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('loading');
}

// Blink connection status during checking
function blinkStatusIndicator(indicator) {
    if (!indicator) return;
    indicator.classList.add('blinking');
    setTimeout(() => indicator.classList.remove('blinking'), 3000);
}

// Retry server status if disconnected
function autoRetryServerStatus() {
    if (appState.serverStatus === 'disconnected' || appState.serverStatus === 'error') {
        setTimeout(async () => {
            await checkServerStatus();
            autoRetryServerStatus();
        }, 10000);
    }
}

// Overriding checkServerStatus to integrate auto-retry
// Add this near the top of your checkServerStatus function around line 194
async function checkServerStatus() {
    console.log('Checking server status at:', SERVER_URL);  // Add this log
    updateServerStatus('checking');
    try {
        const response = await fetch(`${SERVER_URL}/ping`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('Server response:', response.status, response.statusText);  // Add this log
        
        if (response.ok) {
            updateServerStatus('connected');
            appState.serverStatus = 'connected';
            logMessage('Flask server is running and connected', 'info');
        } else {
            updateServerStatus('error');
            appState.serverStatus = 'error';
            logMessage('Flask server returned an error response', 'error');
        }
    } catch (error) {
        console.error('Server connection error:', error);  // Add this log
        updateServerStatus('disconnected');
        appState.serverStatus = 'disconnected';
        logMessage(`Failed to connect to Flask server: ${error.message}`, 'error');
        showToast('Cannot connect to the backend server. Make sure the server is running.', 'error');
    }
    
    appState.serverChecked = true;
}

// Minor toast fade-in
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.opacity = 0;

    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="close-toast">&times;</button>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => { toast.style.opacity = 1; }, 10);

    toast.querySelector('.close-toast').addEventListener('click', () => {
        toast.style.opacity = 0;
        setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = 0;
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

// Extra: Insert CSS into document head dynamically
const style = document.createElement('style');
style.textContent = `
.blinking {
  animation: blinking 1s infinite;
}
@keyframes blinking {
  50% { opacity: 0; }
}
.loading {
  opacity: 0.6;
  cursor: wait;
  pointer-events: none;
}
`;
document.head.appendChild(style);
