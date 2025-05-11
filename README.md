# Sentiment-Analysis-of-Social-Media

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Social Media Analysis Tool</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            border-bottom: 1px solid #eaecef;
            padding-bottom: 0.3em;
        }
        h2 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
            padding-bottom: 0.3em;
            border-bottom: 1px solid #eaecef;
        }
        h3 {
            margin-top: 24px;
            margin-bottom: 16px;
            font-weight: 600;
            line-height: 1.25;
        }
        code {
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace;
            background-color: rgba(27, 31, 35, 0.05);
            border-radius: 3px;
            font-size: 85%;
            padding: 0.2em 0.4em;
        }
        pre {
            background-color: #f6f8fa;
            border-radius: 3px;
            padding: 16px;
            overflow: auto;
            font-size: 85%;
        }
        pre code {
            background-color: transparent;
            padding: 0;
        }
        ul, ol {
            padding-left: 2em;
        }
        table {
            border-collapse: collapse;
            width: 100%;
        }
        table th, table td {
            padding: 6px 13px;
            border: 1px solid #dfe2e5;
        }
        table tr {
            background-color: #fff;
            border-top: 1px solid #c6cbd1;
        }
        table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
    </style>
</head>
<body>
    <h1>Social Media Analysis Tool</h1>
    
    <p>A comprehensive desktop application for collecting, analyzing, and visualizing social media data from X(Twitter) and Instagram platforms.</p>
    
    <h2>📋 Project Overview</h2>
    
    <p>This application helps users collect social media data, analyze sentiment, process text, detect trends, and create beautiful visualizations through Power BI integration. The tool provides valuable insights for marketers, researchers, and social media analysts.</p>
    
    <h2>🌟 Features</h2>
    
    <ul>
        <li><strong>Multi-platform Social Media Data Collection</strong>: Gather posts from X(Twitter) and Instagram using APIs</li>
        <li><strong>Advanced Sentiment Analysis</strong>: Using both RoBERTa transformer models and Grok API</li>
        <li><strong>Text Processing & Cleaning</strong>: Remove noise, extract hashtags, and normalize social media text</li>
        <li><strong>Trend Analysis</strong>: Track hashtag popularity, sentiment distribution, and engagement metrics</li>
        <li><strong>Dynamic Visualizations</strong>: Integration with Power BI for professional, interactive dashboards</li>
        <li><strong>Cross-platform Desktop Application</strong>: Works on Windows, Mac, and Linux</li>
    </ul>
    
    <h2>🛠️ Technology Stack</h2>
    
    <h3>Frontend</h3>
    <ul>
        <li>HTML/CSS</li>
        <li>JavaScript (with Chart.js)</li>
        <li>Electron.js</li>
    </ul>
    
    <h3>Backend</h3>
    <ul>
        <li>Python</li>
        <li>Flask</li>
        <li>Flask-CORS</li>
    </ul>
    
    <h3>Data Processing</h3>
    <ul>
        <li>Tweepy & X Internal API</li>
        <li>Instaloader & Instagram Internal API</li>
        <li>NLTK</li>
        <li>Hugging Face Transformers</li>
        <li>Pandas</li>
    </ul>
    
    <h3>Visualization</h3>
    <ul>
        <li>Power BI</li>
    </ul>
    
    <h3>Utilities</h3>
    <ul>
        <li>SQLAlchemy (MySQL)</li>
        <li>Electron-Store</li>
        <li>Node.js</li>
    </ul>
    
    <h2>📁 Project Structure</h2>
    
    <p>The project consists of several key Python modules:</p>
    
    <ol>
        <li>
            <strong>data_collection.py</strong>
            <ul>
                <li>Contains <code>TwitterCollector</code> and <code>InstagramCollector</code> classes</li>
                <li>Handles API connections and data fetching from social platforms</li>
                <li>Normalizes output to consistent dictionary formats</li>
            </ul>
        </li>
        <li>
            <strong>sentiment_analysis.py</strong>
            <ul>
                <li>Implements <code>RobertaSentimentAnalyzer</code> using Hugging Face transformers</li>
                <li>Implements <code>GrokSentimentAnalyzer</code> for cloud-based sentiment analysis</li>
                <li>Processes data in batches for efficiency</li>
            </ul>
        </li>
        <li>
            <strong>text_processor.py</strong>
            <ul>
                <li>Provides <code>TextPreprocessor</code> class for cleaning social media text</li>
                <li>Removes URLs, mentions, emojis, special characters, and stopwords</li>
                <li>Extracts hashtags for analysis</li>
            </ul>
        </li>
        <li>
            <strong>trend_analysis.py</strong>
            <ul>
                <li>Implements <code>TrendAnalyzer</code> for detecting patterns and trends</li>
                <li>Analyzes hashtag popularity, sentiment distribution, and engagement metrics</li>
                <li>Exports reports and generates actionable insights</li>
            </ul>
        </li>
        <li>
            <strong>visualization.py</strong>
            <ul>
                <li>Connects processed data to Power BI</li>
                <li>Manages database connections and data export</li>
                <li>Handles embedding of Power BI dashboards in the frontend</li>
            </ul>
        </li>
    </ol>
    
    <h2>🚀 Installation</h2>
    
    <h3>Prerequisites</h3>
    <ul>
        <li>Python 3.8+</li>
        <li>Node.js and npm</li>
        <li>MySQL Database</li>
        <li>Power BI Desktop & Power BI Service account</li>
    </ul>
    
    <h3>Setup</h3>
    
    <ol>
        <li>
            Clone the repository:
            <pre><code>git clone https://github.com/yourusername/social-media-analysis-tool.git
cd social-media-analysis-tool</code></pre>
        </li>
        <li>
            Install Python dependencies:
            <pre><code>pip install -r requirements.txt</code></pre>
        </li>
        <li>
            Install Node.js dependencies:
            <pre><code>npm install</code></pre>
        </li>
        <li>
            Configure your database in <code>config.py</code>:
            <pre><code>DATABASE_URI = "mysql+pymysql://username:password@localhost/social_media_db"</code></pre>
        </li>
        <li>
            Set up your API credentials in <code>.env</code> file:
            <pre><code>TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

INSTAGRAM_USERNAME=your_username
INSTAGRAM_PASSWORD=your_password</code></pre>
        </li>
    </ol>
    
    <h2>📊 Usage</h2>
    
    <ol>
        <li>
            Start the application:
            <pre><code>npm start</code></pre>
        </li>
        <li>
            The application will open with the following tabs:
            <ul>
                <li><strong>Data Collection</strong>: Configure and start data collection from social platforms</li>
                <li><strong>Text Processing</strong>: Clean and preprocess collected data</li>
                <li><strong>Sentiment Analysis</strong>: Analyze sentiment of collected posts</li>
                <li><strong>Trend Analysis</strong>: Generate trends and insights</li>
                <li><strong>Visualization</strong>: View Power BI dashboards with analyzed data</li>
            </ul>
        </li>
        <li>
            For each step:
            <ul>
                <li>Configure the required parameters</li>
                <li>Run the process</li>
                <li>Wait for completion</li>
                <li>Move to the next tab or export results</li>
            </ul>
        </li>
    </ol>
    
    <h2>🔄 Data Flow</h2>
    
    <ol>
        <li>Social media data is collected using APIs</li>
        <li>Text is preprocessed and cleaned</li>
        <li>Sentiment analysis is performed on the cleaned text</li>
        <li>Trend analysis is executed on the enriched data</li>
        <li>Results are stored in a MySQL database</li>
        <li>Power BI connects to the database and creates visualizations</li>
        <li>Visualizations are embedded in the application interface</li>
    </ol>
    
    <h2>📝 License</h2>
    
    <p><a href="LICENSE">MIT License</a></p>
    
    <h2>👥 Contributors</h2>
    
    <ul>
        <li><a href="https://github.com/yourusername">Your Name</a></li>
    </ul>
    
    <h2>📞 Contact</h2>
    
    <p>For questions or feedback, please contact: your.email@example.com</p>
</body>
</html>
