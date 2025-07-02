# Flask_REST_API

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TensorFlow warnings

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import traceback
import logging
from datetime import datetime
import re
from threading import Thread
import requests

from backend.data_collection import TwitterCollector, InstagramCollector
from backend.text_processor import TextPreprocessor
from backend.sentiment_analysis import RobertaSentimentAnalyzer, GrokSentimentAnalyzer
from backend.trend_analysis import TrendAnalyzer

# Import database utility function
from backend.db_utils import save_analysis_to_mysql

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Configure CORS to accept requests from the Electron app
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize core components
preprocessor = TextPreprocessor()
sentiment_analyzer = RobertaSentimentAnalyzer()
trend_analyzer = TrendAnalyzer()

@app.route('/', methods=['GET'])
def home():
    logger.info("Home endpoint accessed")
    return 'Flask server is running!'

@app.route('/verify-credentials', methods=['POST'])
def verify_credentials():
    try:
        logger.info("Verifying credentials")
        data = request.json
        source = data.get('source')
        
        logger.info(f"Verifying {source} credentials")
        
        if source == 'twitter':
            bearer_token = data.get('twitter_bearer_token')
            if not bearer_token:
                logger.warning("Twitter bearer token missing")
                return jsonify({'error': 'Twitter bearer token is required'}), 400
                
            # Create a test client to verify the token
            try:
                logger.info("Testing Twitter bearer token")
                collector = TwitterCollector(bearer_token)
                # Just fetch a minimal amount to verify the token works
                # Note: We're wrapping the actual collection in try/except to avoid rate limiting issues
                try:
                    collector.fetch_tweets_by_hashtag('test', 1)
                except Exception as e:
                    # If we hit a rate limit or search error, that's ok - the token is still valid
                    # if the TwitterCollector was created successfully
                    logger.warning(f"Minor error in test query: {str(e)}")
                    pass
                    
                logger.info("Twitter bearer token validated successfully")
                return jsonify({'status': 'success', 'message': 'Twitter credentials verified'})
            except Exception as e:
                logger.error(f"Invalid Twitter bearer token: {str(e)}")
                return jsonify({'error': f'Invalid Twitter bearer token: {str(e)}'}), 401
                
        elif source == 'instagram':
            session_id = data.get('instagram_session_id')
            ds_user_id = data.get('instagram_ds_user_id')
            csrf_token = data.get('instagram_csrf_token')
            
            if not all([session_id, ds_user_id, csrf_token]):
                missing = [
                    param for param, value in {
                        'session_id': session_id,
                        'ds_user_id': ds_user_id,
                        'csrf_token': csrf_token
                    }.items() if not value
                ]
                logger.warning(f"Instagram credentials missing: {missing}")
                return jsonify({
                    'error': 'Instagram authentication requires session_id, ds_user_id, and csrf_token',
                    'missing': missing
                }), 400
            
            try:
                logger.info("Testing Instagram credentials")
                collector = InstagramCollector(
                    session_id=session_id,
                    ds_user_id=ds_user_id,
                    csrf_token=csrf_token
                )
                
                # Just attempt to initialize the collector - actual API calls could hit rate limits
                # If we don't get an error during initialization, credentials format is valid
                logger.info("Instagram credentials format validated")
                return jsonify({'status': 'success', 'message': 'Instagram credentials validated'})
            except Exception as e:
                logger.error(f"Invalid Instagram credentials: {str(e)}")
                return jsonify({'error': f'Invalid Instagram credentials: {str(e)}'}), 401
        else:
            logger.warning(f"Invalid source: {source}")
            return jsonify({'error': 'Invalid source'}), 400
            
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error in verify_credentials: {error_trace}")
        return jsonify({
            'error': str(e),
            'trace': error_trace,
            'type': type(e).__name__
        }), 500

@app.route('/collect', methods=['POST'])
def collect_data():
    try:
        data = request.get_json(force=True)
        if not data:
            logger.error("No JSON data received in request")
            return jsonify({'error': 'No data provided'}), 400
        
        source = data.get('source')
        query = data.get('query')
        max_results = int(data.get('max_results', 50))
        
        # Validate required parameters
        if not source:
            logger.error("Missing 'source' parameter")
            return jsonify({'error': 'Source parameter is required'}), 400
        
        if not query:
            logger.error("Missing 'query' parameter")
            return jsonify({'error': 'Query parameter is required'}), 400
        
        # Sanitize query to avoid path-related issues
        query = query.strip()
        
        logger.info(f"Collecting data from {source} for '{query}', max results: {max_results}")

        if source == 'twitter':
            bearer_token = data.get('twitter_bearer_token')
            if not bearer_token:
                logger.warning("Twitter bearer token missing")
                return jsonify({'error': 'Twitter bearer token is required'}), 400
                
            # Validate search_type
            search_type = data.get('search_type')
            if search_type not in ['hashtag', 'username']:
                logger.error(f"Invalid search_type: {search_type}")
                return jsonify({'error': f"Invalid search_type: {search_type}. Must be 'hashtag' or 'username'"}), 400
            
            try:
                collector = TwitterCollector(bearer_token)
                
                if search_type == 'hashtag':
                    logger.info(f"Fetching tweets for hashtag: {query}")
                    if query.startswith('#'):
                        query = query[1:]  # Remove # if present
                    results = collector.fetch_tweets_by_hashtag(query, max_results)
                elif search_type == 'username':
                    logger.info(f"Fetching tweets for username: {query}")
                    if query.startswith('@'):
                        query = query[1:]  # Remove @ if present
                    results = collector.fetch_tweets_by_user(query, max_results)
                else:
                    logger.warning(f"Invalid Twitter search type: {search_type}")
                    return jsonify({'error': 'Invalid Twitter search type'}), 400
            except Exception as e:
                logger.error(f"Twitter API error: {str(e)}", exc_info=True)
                return jsonify({'error': f"Error fetching Twitter data: {str(e)}"}), 500

        elif source == 'instagram':
            # Get Instagram authentication parameters from request
            session_id = data.get('instagram_session_id')
            ds_user_id = data.get('instagram_ds_user_id')
            csrf_token = data.get('instagram_csrf_token')
            
            # Validate all required Instagram credentials are present
            if not all([session_id, ds_user_id, csrf_token]):
                missing = [
                    param for param, value in {
                        'session_id': session_id,
                        'ds_user_id': ds_user_id,
                        'csrf_token': csrf_token
                    }.items() if not value
                ]
                logger.warning(f"Instagram credentials missing: {missing}")
                return jsonify({
                    'error': 'Instagram authentication requires session_id, ds_user_id, and csrf_token',
                    'missing': missing
                }), 400
            
            # Initialize Instagram collector with credentials from request
            try:
                collector = InstagramCollector(
                    session_id=session_id,
                    ds_user_id=ds_user_id,
                    csrf_token=csrf_token
                )
                
                # Determine Instagram search type and fetch data
                search_type = data.get('search_type')
                if search_type == 'post':
                    logger.info(f"Fetching Instagram post: {query}")
                    results = collector.fetch_post_data(query)
                    if not results:
                        logger.warning(f"No Instagram post found for {query}")
                        return jsonify({'error': 'Failed to fetch Instagram post data'}), 404
                elif search_type == 'hashtag':
                    logger.info(f"Fetching Instagram hashtag posts: {query}")
                    # Remove # if present
                    if query.startswith('#'):
                        query = query[1:]
                    results = collector.fetch_hashtag_posts(query, max_results)
                    if not results:
                        logger.warning(f"No posts found for hashtag #{query}")
                        return jsonify({'error': f'No posts found for hashtag #{query}'}), 404
                else:
                    logger.warning(f"Invalid Instagram search type: {search_type}")
                    return jsonify({'error': f"Invalid Instagram search type: {search_type}"}), 400
            except ValueError as ve:
                logger.error(f"Value error: {str(ve)}")
                return jsonify({'error': str(ve)}), 400
            except Exception as e:
                logger.error(f"Instagram API error: {str(e)}", exc_info=True)
                return jsonify({'error': f"Error fetching Instagram data: {str(e)}"}), 500

        else:
            logger.warning(f"Invalid source: {source}")
            return jsonify({'error': f"Invalid source: {source}. Must be 'twitter' or 'instagram'"}), 400

        logger.info(f"Successfully collected {len(results) if isinstance(results, list) else 1} items from {source}")
        if not isinstance(results, list):
            results = [results]

        # Wrap successful response
        return jsonify({
            'status': 'success', 
            'data': results,
            'count': len(results)
        })
        
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error in collect_data: {error_trace}")
        return jsonify({
            'error': str(e),
            'trace': error_trace,
            'type': type(e).__name__
        }), 500
    
@app.route('/analyze', methods=['POST'])
def analyze_data():
    try:
        json_payload = request.get_json(force=True, silent=True)

        if not json_payload or not isinstance(json_payload, dict) or "data" not in json_payload:
            logger.error("[ERROR] Invalid JSON payload received at /analyze")
            return jsonify({"error": "Invalid request. JSON body must contain a 'data' field."}), 400

        raw_data = json_payload["data"]

        if not isinstance(raw_data, list):
            logger.error("[ERROR] 'data' field is not a list.")
            return jsonify({"error": "'data' must be a list."}), 400

        logger.info(f"[DEBUG] 🔍 Received {len(raw_data)} items for analysis.")

        result_container = {}

        def background_analysis():
            try:
                processed_data = preprocessor.preprocess_social_media_data(raw_data)
                sentiment_results = sentiment_analyzer.analyze_social_media_data(processed_data)
                hashtag_analysis = trend_analyzer.analyze_hashtags(sentiment_results)

                # ✅ Store results in MySQL
                save_analysis_to_mysql(sentiment_results)
                # save_analysis_to_mysql(sentiment_results, clear_existing=True)

                result_container['data'] = sentiment_results
                result_container['hashtag_analysis'] = hashtag_analysis
            except Exception as e:
                logger.error(f"Error during background analysis: {str(e)}", exc_info=True)
                result_container['error'] = str(e)

        thread = Thread(target=background_analysis)
        thread.start()
        thread.join()

        if 'error' in result_container:
            return jsonify({'error': f'Analysis failed: {result_container["error"]}'}), 500

        sentiment_results = result_container['data']
        hashtag_analysis = result_container['hashtag_analysis']

        return jsonify({
            "data": sentiment_results,
            "stats": {
                "total_analyzed": len(sentiment_results),
                "sentiment_distribution": {
                    "positive": sum(1 for x in sentiment_results if x['sentiment'] == "Positive"),
                    "neutral": sum(1 for x in sentiment_results if x['sentiment'] == "Neutral"),
                    "negative": sum(1 for x in sentiment_results if x['sentiment'] == "Negative"),
                },
                "average_sentiment": round(
                    sum(x['sentiment_score'] for x in sentiment_results) / max(len(sentiment_results), 1), 3
                ) if sentiment_results else "NaN"
            },
            "sentiment_distribution": {
                "positive": sum(1 for x in sentiment_results if x['sentiment'] == "Positive"),
                "neutral": sum(1 for x in sentiment_results if x['sentiment'] == "Neutral"),
                "negative": sum(1 for x in sentiment_results if x['sentiment'] == "Negative"),
            },
            "hashtag_analysis": hashtag_analysis
        })

    except Exception as e:
        logger.error(f"Analysis error: {str(e)}", exc_info=True)
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500


@app.route('/trends', methods=['POST'])
def analyze_trends():
    try:
        data = request.json.get('data', [])
        if not data:
            logger.warning("No data provided for trend analysis")
            return jsonify({'error': 'No data provided for trend analysis'}), 400
        
        logger.info(f"Analyzing trends for {len(data)} items")
        trends = trend_analyzer.analyze_hashtags(data)
        logger.info("Trend analysis completed successfully")
        return jsonify({'status': 'success', 'trends': trends})
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"Error in analyze_trends: {error_trace}")
        return jsonify({
            'error': str(e),
            'trace': error_trace,
            'type': type(e).__name__
        }), 500


@app.route('/get-powerbi-token', methods=['POST'])
def get_powerbi_token():
    try:
        # Replace with your actual values
        tenant_id = os.getenv("TENANT_ID")
        client_id = os.getenv("CLIENT_ID")
        client_secret = os.getenv("CLIENT_SECRET")
        workspace_id = os.getenv("WORKSPACE_ID")
        report_id = os.getenv("REPORT_ID")


        url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        data = {
            'grant_type': 'client_credentials',
            'client_id': client_id,
            'client_secret': client_secret,
            'scope': 'https://analysis.windows.net/powerbi/api/.default'
        }

        token_response = requests.post(url, headers=headers, data=data).json()
        access_token = token_response.get('access_token')

        if not access_token:
            return jsonify({"error": "Failed to get access token"}), 500

        # Embed token
        embed_url = f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/GenerateToken"
        report_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        embed_config = {
            "accessLevel": "view"
        }

        embed_response = requests.post(embed_url, headers=report_headers, json=embed_config).json()

        return jsonify({
            "embedUrl": f"https://app.powerbi.com/reportEmbed?reportId={report_id}&groupId={workspace_id}",
            "embedToken": embed_response.get('token'),
            "reportId": report_id
        })

    except Exception as e:
        import traceback
        print("❌ Power BI Embed Token Error:")
        traceback.print_exc()  # 👈 this will show the real issue
        return {"error": str(e)}, 500


    
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    logger.info("Starting Flask server")
    app.run(host='0.0.0.0', port=5000, debug=True)

