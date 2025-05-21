# 📱 Sentiment Analysis of Social Media

## 📋 Overview
A comprehensive desktop application for collecting, analyzing, and visualizing social media data from X(Twitter) and Instagram platforms. 

This application helps users collect social media data, analyze sentiment, process text, detect trends, and create beautiful visualizations. The tool provides valuable insights for marketers, researchers, and social media analysts.

## 📝 Report & Research paper

<ol>
<li><a href="https://drive.google.com/file/d/1bd0Dn47DzX5muSoovDZhfCBq1Unc7IUp/view?usp=sharing">Project_Report (Black Book)</a></li>

<li><a href="https://drive.google.com/file/d/11CeS6iAjR17O_SKafywrk13qGHYopw_3/view?usp=sharing">Research_Paper</a></li>
<ul>
<Li><strong>Authors:</strong> Shubham Kansadwala, Raj Solanki, Nairutya Taklikar, Romish Yadav, Prof. Swati Uparkar</Li>
<Li><strong>Publication:</strong> International Journal of Scientific Research & Engineering Development [IJSRED Volume-8  S.No.422]</Li>
</ul>
</ol>


## 🌟 Features

<ul>
  <li><strong>Multi-platform Social Media Data Collection: </strong>Gather posts from X(Twitter), Instagram using APIs and JSON data through Web-Scraping(APIFY).</li>
  <li><strong>Text Processing & Cleaning: </strong>Remove noise, extract hashtags, and normalize social media text.</li>
  <li><strong>Advanced Sentiment Analysis: </strong>Using RoBERTa transformer models.</li>
  <li><strong>Trend Analysis: </strong>Track hashtag popularity, sentiment distribution, and engagement metrics.</li>
  <li><strong>Dynamic Visualizations: </strong>Sentiment Charts & Hashtag Charts using Chart.js.
      <ul>
      <li>In Future: Integration with Power BI for professional, interactive dashboards.</li>
      </ul>
</li>
  <li><strong>Desktop Application: </strong>Works on Windows.</li>
</ul>

## 🛠️ Technology Stack

### 💻 Frontend (User Interface)

<ul>
<li><strong>HTML/CSS: </strong>For building the structure and styling of the application UI (tabs, panels, buttons).</li>

<li><strong>JavaScript (Vanilla JS + Chart.js): </strong>For interactivity, DOM manipulation, event handling, and drawing dynamic charts.</li>

<li><strong>Electron.js: </strong>To package everything into a Desktop Application (cross-platform: Windows, Mac, Linux).</li>
</ul>


### 🧠 Backend (Server & Processing)

<ul>

<li><strong>Python: </strong>For backend programming: handling API calls, data cleaning, sentiment analysis, and trend detection.</li>

<li><strong>Flask: </strong>Lightweight Python web framework to expose REST APIs for the frontend.</li>

<li><strong>Flask-CORS: </strong>To allow communication between the Electron frontend and Flask backend.</li>

</ul>

### 🔬 Data Collection & Analysis

<ul>

<li><strong>Tweepy + X Internal API: </strong>To collect Tweets from X(Twitter) based on username.</li>

<li><strong>Instaloader + Instagram Internal API: </strong>For collecting Instagram posts based on hashtags or post URLs.</li>

<li><strong>NLTK: </strong>For text preprocessing (stopwords removal, cleaning).</li>

<li><strong>Hugging Face Transformers: </strong>To use RoBERTa-based sentiment analysis models for text classification.</li>

<li><strong>Pandas: </strong>For easy handling of social media data in DataFrames.</li>

</ul>

### 📦 Other Utilities


<ul>

<li><strong>Electron-Store: </strong>To store small settings/configurations locally on the user's machine (like export folder path).</li>

<li><strong>Node.js (indirectly via Electron): </strong>For managing desktop app behaviors like opening file dialogs, starting the backend server.</li>

</ul>


