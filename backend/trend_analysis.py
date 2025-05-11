import logging
from typing import List, Dict, Any, Tuple, Optional, Callable
from datetime import datetime
from collections import Counter, defaultdict
import math
import json
import re
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
import numpy as np

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TrendAnalyzer:
    def __init__(self, batch_size: int = 1000):
        """Initialize with enhanced validation"""
        if not isinstance(batch_size, int) or batch_size <= 0:
            logger.error(f"Invalid batch_size: {batch_size}. Must be positive integer")
            raise ValueError("batch_size must be a positive integer")
        self.batch_size = batch_size
    
    def _validate_input_data(self, data: List[Dict[str, Any]]) -> bool:
        """Validate input data structure"""
        if not isinstance(data, list):
            logger.error("Input data must be a list")
            return False
        
        for i, item in enumerate(data):
            if not isinstance(item, dict):
                logger.error(f"Item at index {i} is not a dictionary")
                return False
                
            # Basic validation for required fields
            if not any(key in item for key in ['content', 'hashtags', 'comments']):
                logger.warning(f"Item at index {i} missing expected fields")
                
        return True
    
    def _parse_timestamp(self, timestamp: Any) -> Optional[datetime]:
        """Robust timestamp parsing with multiple format support"""
        if timestamp is None:
            return None
            
        try:
            # Handle string timestamps
            if isinstance(timestamp, str):
                # Remove timezone info if present
                timestamp = re.sub(r'[+-]\d{2}:?\d{2}$', '', timestamp).strip()
                
                # Try ISO format first
                try:
                    return datetime.fromisoformat(timestamp)
                except ValueError:
                    pass
                
                # Try common social media formats
                formats = [
                    '%Y-%m-%d %H:%M:%S',  # Twitter format
                    '%a %b %d %H:%M:%S %Y',  # Twitter created_at
                    '%Y-%m-%dT%H:%M:%S',  # ISO without timezone
                    '%Y-%m-%d',  # Date only
                    '%m/%d/%Y %H:%M:%S',  # Alternative format
                ]
                
                for fmt in formats:
                    try:
                        return datetime.strptime(timestamp, fmt)
                    except ValueError:
                        continue
                        
                logger.warning(f"Unrecognized timestamp format: {timestamp}")
                return None
                
            # Handle numeric timestamps (Unix time)
            elif isinstance(timestamp, (int, float)):
                if timestamp > 1e12:  # Possibly milliseconds
                    timestamp = timestamp / 1000
                return datetime.fromtimestamp(timestamp)
                
            # Handle datetime objects directly
            elif isinstance(timestamp, datetime):
                return timestamp
                
            else:
                logger.warning(f"Unsupported timestamp type: {type(timestamp)}")
                return None
                
        except Exception as e:
            logger.error(f"Error parsing timestamp {timestamp}: {str(e)}")
            return None
    
    def _process_in_batches(self, data: List[Dict[str, Any]], 
                          process_func: Callable, 
                          combine_func: Callable,
                          progress_callback: Optional[Callable] = None) -> Any:
        """Batch processing with enhanced validation"""
        if not self._validate_input_data(data):
            logger.error("Invalid input data structure")
            return combine_func([])  # Return empty result of appropriate type
            
        try:
            results = []
            total_items = len(data)
            num_batches = math.ceil(total_items / self.batch_size)
            
            logger.info(f"Processing {total_items} items in {num_batches} batches")
            
            for i in range(0, total_items, self.batch_size):
                try:
                    batch = data[i:i+self.batch_size]
                    if not batch:
                        continue
                        
                    batch_result = process_func(batch)
                    results.append(batch_result)
                    
                    if progress_callback:
                        progress = min(100, (i + len(batch)) / total_items * 100)
                        progress_callback(progress, i + len(batch))
                        
                except Exception as batch_error:
                    logger.error(f"Error processing batch {i//self.batch_size}: {str(batch_error)}")
                    continue
                    
            return combine_func(results)
            
        except Exception as e:
            logger.error(f"Batch processing failed: {str(e)}")
            return combine_func([])
    
    def _categorize_sentiment(self, score: float) -> str:
        """Categorize sentiment score into Positive, Neutral, or Negative"""
        if score > 0.2:
            return "Positive"
        elif score < -0.2:
            return "Negative"
        else:
            return "Neutral"
    
    def analyze_hashtags(self, data: List[Dict[str, Any]], top_n: int = 5, progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """Enhanced hashtag analysis with validation"""
        # Input validation
        if not isinstance(top_n, int) or top_n <= 0:
            logger.error(f"Invalid top_n value: {top_n}")
            top_n = 5
            
        if not self._validate_input_data(data):
            return {
                'top_hashtags': [],
                'total_hashtags': 0,
                'unique_hashtags': 0,
                'hashtag_durations': {},
                'error': 'Invalid input data'
            }
        
        try:
            hashtag_data = []
            hashtag_first_use = {}
            hashtag_last_use = {}
            
            def process_batch(batch):
                batch_hashtags = []
                
                for item in batch:
                    timestamp = self._parse_timestamp(item.get('timestamp') or item.get('created_at'))
                    sentiment_score = item.get('sentiment_score', 0)
                    likes = item.get('like_count', 0)
                    retweets = item.get('retweet_count', 0)
                    replies = item.get('reply_count', 0)
                    
                    # Process item hashtags
                    if 'hashtags' in item and isinstance(item['hashtags'], list):
                        for tag in item['hashtags']:
                            tag = tag.lower()
                            batch_hashtags.append({
                                'hashtag': tag,
                                'sentiment_score': sentiment_score,
                                'likes': likes,
                                'retweets': retweets,
                                'replies': replies,
                                'comments': 0,
                                'timestamp': timestamp
                            })
                            
                            # Track first/last use
                            if timestamp:
                                if tag not in hashtag_first_use or timestamp < hashtag_first_use[tag]:
                                    hashtag_first_use[tag] = timestamp
                                if tag not in hashtag_last_use or timestamp > hashtag_last_use[tag]:
                                    hashtag_last_use[tag] = timestamp
                    
                    # Process comments
                    if 'comments' in item and isinstance(item['comments'], list):
                        for comment in item['comments']:
                            comment_sentiment = comment.get('sentiment_score', 0)
                            comment_timestamp = self._parse_timestamp(comment.get('timestamp'))
                            
                            if 'hashtags' in comment and isinstance(comment['hashtags'], list):
                                for tag in comment['hashtags']:
                                    tag = tag.lower()
                                    batch_hashtags.append({
                                        'hashtag': tag,
                                        'sentiment_score': comment_sentiment,
                                        'likes': 0,
                                        'retweets': 0,
                                        'replies': 0,
                                        'comments': 1,
                                        'timestamp': comment_timestamp
                                    })
                                    
                                    # Track first/last use for comment hashtags
                                    if comment_timestamp:
                                        if tag not in hashtag_first_use or comment_timestamp < hashtag_first_use[tag]:
                                            hashtag_first_use[tag] = comment_timestamp
                                        if tag not in hashtag_last_use or comment_timestamp > hashtag_last_use[tag]:
                                            hashtag_last_use[tag] = comment_timestamp
                
                return batch_hashtags
            
            def combine_batches(batch_results):
                combined = []
                for batch in batch_results:
                    combined.extend(batch)
                return combined
            
            # Process all data in batches
            hashtag_data = self._process_in_batches(
                data, 
                process_batch, 
                combine_batches, 
                progress_callback
            )
            
            if not hashtag_data:
                return {
                    'top_hashtags': [],
                    'total_hashtags': 0,
                    'unique_hashtags': 0,
                    'hashtag_durations': {}
                }
            
            # Convert to DataFrame for efficient analysis
            df = pd.DataFrame(hashtag_data)
            
            # Get hashtag frequency
            hashtag_counts = df['hashtag'].value_counts()
            top_hashtags = hashtag_counts.head(top_n).to_dict()
            
            # Get sentiment and engagement metrics per hashtag
            hashtag_metrics = df.groupby('hashtag').agg({
                'sentiment_score': 'mean',
                'likes': 'sum',
                'retweets': 'sum',
                'replies': 'sum',
                'comments': 'sum'
            })
            
            # Calculate hashtag durations
            hashtag_durations = {}
            for tag, first_use in hashtag_first_use.items():
                last_use = hashtag_last_use.get(tag)
                if first_use and last_use:
                    duration = (last_use - first_use).days
                    hashtag_durations[tag] = duration
            
            # Prepare results for top hashtags
            trend_results = {
                'top_hashtags': [
                    {
                        'hashtag': hashtag,
                        'count': count,
                        'avg_sentiment': float(hashtag_metrics.loc[hashtag, 'sentiment_score']) if hashtag in hashtag_metrics.index else 0,
                        'sentiment_category': self._categorize_sentiment(
                            float(hashtag_metrics.loc[hashtag, 'sentiment_score']) if hashtag in hashtag_metrics.index else 0
                        ),
                        'engagement': {
                            'avg_likes': float(hashtag_metrics.loc[hashtag, 'likes'] / count) if hashtag in hashtag_metrics.index else 0,
                            'avg_retweets': float(hashtag_metrics.loc[hashtag, 'retweets'] / count) if hashtag in hashtag_metrics.index else 0,
                            'avg_replies': float(hashtag_metrics.loc[hashtag, 'replies'] / count) if hashtag in hashtag_metrics.index else 0,
                            'avg_comments': float(hashtag_metrics.loc[hashtag, 'comments'] / count) if hashtag in hashtag_metrics.index else 0,
                            'total_engagement': float(
                                hashtag_metrics.loc[hashtag, 'likes'] + 
                                hashtag_metrics.loc[hashtag, 'retweets'] + 
                                hashtag_metrics.loc[hashtag, 'replies'] + 
                                hashtag_metrics.loc[hashtag, 'comments']
                            ) if hashtag in hashtag_metrics.index else 0
                        }
                    }
                    for hashtag, count in top_hashtags.items()
                ],
                'total_hashtags': len(hashtag_data),
                'unique_hashtags': len(hashtag_counts),
                'hashtag_durations': hashtag_durations
            }
            
            return trend_results
            
        except Exception as e:
            logger.error(f"Hashtag analysis failed: {str(e)}", exc_info=True)
            return {
                'top_hashtags': [],
                'total_hashtags': 0,
                'unique_hashtags': 0,
                'hashtag_durations': {},
                'error': str(e)
            }
    
    def get_sentiment_distribution(self, data: List[Dict[str, Any]],
                                  progress_callback: Optional[Callable] = None) -> Dict[str, int]:
        """Get sentiment distribution with robust error handling"""
        if not self._validate_input_data(data):
            return {
                'Positive': 0,
                'Neutral': 0,
                'Negative': 0,
                'error': 'Invalid input data'
            }
            
        try:
            def process_batch(batch):
                batch_sentiments = []
                
                for item in batch:
                    if 'sentiment_category' in item:
                        batch_sentiments.append(item['sentiment_category'])
                    elif 'sentiment_score' in item:
                        batch_sentiments.append(self._categorize_sentiment(item['sentiment_score']))
                        
                    # Process comments
                    if 'comments' in item and isinstance(item['comments'], list):
                        for comment in item['comments']:
                            if 'sentiment_category' in comment:
                                batch_sentiments.append(comment['sentiment_category'])
                            elif 'sentiment_score' in comment:
                                batch_sentiments.append(self._categorize_sentiment(comment['sentiment_score']))
                
                return Counter(batch_sentiments)
            
            def combine_counters(counters):
                combined = Counter()
                for counter in counters:
                    combined.update(counter)
                return combined
            
            # Process all data in batches
            sentiment_counts = self._process_in_batches(
                data, 
                process_batch, 
                combine_counters, 
                progress_callback
            )
            
            # Ensure all categories are represented
            distribution = {
                'Positive': sentiment_counts.get('Positive', 0),
                'Neutral': sentiment_counts.get('Neutral', 0),
                'Negative': sentiment_counts.get('Negative', 0)
            }
            
            return distribution
            
        except Exception as e:
            logger.error(f"Sentiment distribution analysis failed: {str(e)}", exc_info=True)
            return {
                'Positive': 0,
                'Neutral': 0,
                'Negative': 0,
                'error': str(e)
            }
    
    def get_platform_distribution(self, data: List[Dict[str, Any]]) -> Dict[str, int]:
        """Get platform distribution with validation"""
        if not self._validate_input_data(data):
            return {
                'twitter': 0,
                'instagram': 0,
                'unknown': 0,
                'error': 'Invalid input data'
            }
            
        try:
            platforms = [item.get('platform', 'unknown') for item in data]
            platform_counts = Counter(platforms)
            
            # Ensure main platforms are represented
            distribution = {
                'twitter': platform_counts.get('twitter', 0),
                'instagram': platform_counts.get('instagram', 0),
                'unknown': platform_counts.get('unknown', 0)
            }
            
            # Add any other platforms that might be present
            for platform in platform_counts:
                if platform not in distribution:
                    distribution[platform] = platform_counts[platform]
            
            return distribution
            
        except Exception as e:
            logger.error(f"Platform distribution analysis failed: {str(e)}", exc_info=True)
            return {
                'twitter': 0,
                'instagram': 0,
                'unknown': 0,
                'error': str(e)
            }
    
    def _validate_engagement_item(self, item: Dict[str, Any]) -> bool:
        """Validate engagement metrics item structure"""
        required_fields = ['like_count', 'retweet_count', 'reply_count']
        return all(
            field in item and isinstance(item[field], (int, float))
            for field in required_fields
        )
    
    def get_engagement_metrics(self, data: List[Dict[str, Any]],
                             progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """Engagement metrics with robust validation"""
        if not self._validate_input_data(data):
            logger.error("Invalid data structure for engagement metrics")
            return self._get_empty_engagement_result("Invalid input data")
            
        try:
            # Filter out invalid items
            valid_data = [item for item in data if self._validate_engagement_item(item)]
            invalid_count = len(data) - len(valid_data)
            
            if invalid_count > 0:
                logger.warning(f"Skipped {invalid_count} invalid engagement items")
                
            def process_batch(batch):
                batch_metrics = {
                    'total_likes': 0,
                    'total_retweets': 0,
                    'total_replies': 0,
                    'total_comments': 0,
                    'platform_metrics': defaultdict(lambda: {
                        "items": 0,
                        "likes": 0,
                        "retweets": 0,
                        "replies": 0,
                        "comments": 0
                    }),
                    'sentiment_metrics': defaultdict(lambda: {
                        "items": 0,
                        "likes": 0,
                        "retweets": 0,
                        "replies": 0,
                        "comments": 0
                    }),
                    'item_count': len(batch)
                }
                
                for item in batch:
                    platform = item.get('platform', 'unknown')
                    sentiment = item.get('sentiment_category', 'unknown')
                    
                    # Twitter metrics
                    likes = item.get('like_count', 0)
                    retweets = item.get('retweet_count', 0)
                    replies = item.get('reply_count', 0)
                    
                    batch_metrics['total_likes'] += likes
                    batch_metrics['total_retweets'] += retweets
                    batch_metrics['total_replies'] += replies
                    
                    # Update platform metrics
                    batch_metrics['platform_metrics'][platform]["items"] += 1
                    batch_metrics['platform_metrics'][platform]["likes"] += likes
                    batch_metrics['platform_metrics'][platform]["retweets"] += retweets
                    batch_metrics['platform_metrics'][platform]["replies"] += replies
                    
                    # Update sentiment metrics
                    batch_metrics['sentiment_metrics'][sentiment]["items"] += 1
                    batch_metrics['sentiment_metrics'][sentiment]["likes"] += likes
                    batch_metrics['sentiment_metrics'][sentiment]["retweets"] += retweets
                    batch_metrics['sentiment_metrics'][sentiment]["replies"] += replies
                    
                    # Instagram metrics (comments are in a separate field)
                    comment_count = 0
                    if 'comments' in item and isinstance(item['comments'], list):
                        comment_count = len(item['comments'])
                        batch_metrics['total_comments'] += comment_count
                        batch_metrics['platform_metrics'][platform]["comments"] += comment_count
                        batch_metrics['sentiment_metrics'][sentiment]["comments"] += comment_count
                
                return batch_metrics
            
            def combine_metrics(batch_results):
                combined = {
                    'total_likes': 0,
                    'total_retweets': 0,
                    'total_replies': 0,
                    'total_comments': 0,
                    'platform_metrics': defaultdict(lambda: {
                        "items": 0,
                        "likes": 0,
                        "retweets": 0,
                        "replies": 0,
                        "comments": 0
                    }),
                    'sentiment_metrics': defaultdict(lambda: {
                        "items": 0,
                        "likes": 0,
                        "retweets": 0,
                        "replies": 0,
                        "comments": 0
                    }),
                    'item_count': 0
                }
                
                for result in batch_results:
                    combined['total_likes'] += result['total_likes']
                    combined['total_retweets'] += result['total_retweets']
                    combined['total_replies'] += result['total_replies']
                    combined['total_comments'] += result['total_comments']
                    combined['item_count'] += result['item_count']
                    
                    # Combine platform metrics
                    for platform, metrics in result['platform_metrics'].items():
                        for key, value in metrics.items():
                            combined['platform_metrics'][platform][key] += value
                    
                    # Combine sentiment metrics
                    for sentiment, metrics in result['sentiment_metrics'].items():
                        for key, value in metrics.items():
                            combined['sentiment_metrics'][sentiment][key] += value
                
                return combined
            
            # Process all data in batches
            combined_metrics = self._process_in_batches(
                valid_data, 
                process_batch, 
                combine_metrics, 
                progress_callback
            )
            
            # Calculate final metrics
            item_count = combined_metrics['item_count']
            total_likes = combined_metrics['total_likes']
            total_retweets = combined_metrics['total_retweets']
            total_replies = combined_metrics['total_replies']
            total_comments = combined_metrics['total_comments']
            
            # Calculate averages
            avg_likes = total_likes / item_count if item_count > 0 else 0
            avg_retweets = total_retweets / item_count if item_count > 0 else 0
            avg_replies = total_replies / item_count if item_count > 0 else 0
            avg_comments = total_comments / item_count if item_count > 0 else 0
            
            # Calculate engagement rate
            total_engagement = total_likes + total_retweets + total_replies + total_comments
            engagement_rate = (total_engagement / item_count) if item_count > 0 else 0
            
            # Calculate averages by platform
            platform_averages = {}
            for platform, metrics in combined_metrics['platform_metrics'].items():
                count = max(metrics["items"], 1)  # Avoid division by zero
                platform_averages[platform] = {
                    "avg_likes": metrics["likes"] / count,
                    "avg_retweets": metrics["retweets"] / count,
                    "avg_replies": metrics["replies"] / count,
                    "avg_comments": metrics["comments"] / count,
                    "engagement_rate": (metrics["likes"] + metrics["retweets"] + 
                                       metrics["replies"] + metrics["comments"]) / count
                }
            
            # Calculate averages by sentiment
            sentiment_averages = {}
            for sentiment, metrics in combined_metrics['sentiment_metrics'].items():
                count = max(metrics["items"], 1)  # Avoid division by zero
                sentiment_averages[sentiment] = {
                    "avg_likes": metrics["likes"] / count,
                    "avg_retweets": metrics["retweets"] / count,
                    "avg_replies": metrics["replies"] / count,
                    "avg_comments": metrics["comments"] / count,
                    "engagement_rate": (metrics["likes"] + metrics["retweets"] + 
                                       metrics["replies"] + metrics["comments"]) / count
                }
            
            # Compile final engagement metrics
            engagement_metrics = {
                'total_likes': total_likes,
                'total_retweets': total_retweets,
                'total_replies': total_replies,
                'total_comments': total_comments,
                'avg_likes': avg_likes,
                'avg_retweets': avg_retweets,
                'avg_replies': avg_replies,
                'avg_comments': avg_comments,
                'total_engagement': total_engagement,
                'engagement_rate': engagement_rate,
                'platform_metrics': dict(combined_metrics['platform_metrics']),
                'platform_averages': platform_averages,
                'sentiment_engagement': sentiment_averages
            }
            
            return engagement_metrics
            
        except Exception as e:
            logger.error(f"Engagement metrics calculation failed: {str(e)}", exc_info=True)
            return self._get_empty_engagement_result(str(e))
    
    def _get_empty_engagement_result(self, error_msg: str = "") -> Dict[str, Any]:
        """Return empty engagement result with error information"""
        result = {
            'total_likes': 0,
            'total_retweets': 0,
            'total_replies': 0,
            'total_comments': 0,
            'avg_likes': 0,
            'avg_retweets': 0,
            'avg_replies': 0,
            'avg_comments': 0,
            'total_engagement': 0,
            'engagement_rate': 0,
            'platform_metrics': {},
            'platform_averages': {},
            'sentiment_engagement': {}
        }
        
        if error_msg:
            result['error'] = error_msg
            
        return result
    
    def analyze_sentiment_by_time(self, data: List[Dict[str, Any]], 
                                 interval: str = 'day',
                                 progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        """Time-based sentiment analysis with validation"""
        valid_intervals = ['hour', 'day', 'week', 'month']
        if interval not in valid_intervals:
            logger.error(f"Invalid interval: {interval}. Must be one of {valid_intervals}")
            interval = 'day'
            
        if not self._validate_input_data(data):
            return {
                'interval': interval,
                'timeline': {},
                'error': 'Invalid input data'
            }
            
        try:
            # Format string for date parsing based on interval
            time_formats = {
                'hour': '%Y-%m-%d %H',
                'day': '%Y-%m-%d',
                'week': '%Y-%W',
                'month': '%Y-%m'
            }
            
            format_str = time_formats.get(interval, '%Y-%m-%d')
            
            def process_batch(batch):
                batch_time_sentiments = defaultdict(lambda: {
                    'Positive': 0, 
                    'Neutral': 0, 
                    'Negative': 0,
                    'avg_score': [],
                    'items': 0
                })
                
                for item in batch:
                    timestamp = self._parse_timestamp(item.get('timestamp') or item.get('created_at'))
                    if not timestamp:
                        continue
                        
                    time_key = timestamp.strftime(format_str)
                    
                    # Add sentiment to the appropriate time bucket
                    sentiment = item.get('sentiment_category')
                    if not sentiment and 'sentiment_score' in item:
                        sentiment = self._categorize_sentiment(item['sentiment_score'])
                    
                    if sentiment in ['Positive', 'Neutral', 'Negative']:
                        batch_time_sentiments[time_key][sentiment] += 1
                        batch_time_sentiments[time_key]['items'] += 1
                        
                        # Add sentiment score to calculate average later
                        score = item.get('sentiment_score', 0)
                        batch_time_sentiments[time_key]['avg_score'].append(score)
                
                return batch_time_sentiments
            
            def combine_time_sentiments(batch_results):
                combined = defaultdict(lambda: {
                    'Positive': 0, 
                    'Neutral': 0, 
                    'Negative': 0,
                    'avg_score': [],
                    'items': 0
                })
                
                for result in batch_results:
                    for time_key, metrics in result.items():
                        combined[time_key]['Positive'] += metrics['Positive']
                        combined[time_key]['Neutral'] += metrics['Neutral']
                        combined[time_key]['Negative'] += metrics['Negative']
                        combined[time_key]['avg_score'].extend(metrics['avg_score'])
                        combined[time_key]['items'] += metrics['items']
                
                return combined
            
            # Process all data in batches
            time_sentiments = self._process_in_batches(
                data, 
                process_batch, 
                combine_time_sentiments, 
                progress_callback
            )
            
            # Calculate averages and format results
            timeline_data = {}
            for time_key, metrics in time_sentiments.items():
                avg_score = sum(metrics['avg_score']) / len(metrics['avg_score']) if metrics['avg_score'] else 0
                
                timeline_data[time_key] = {
                    'Positive': metrics['Positive'],
                    'Neutral': metrics['Neutral'],
                    'Negative': metrics['Negative'],
                    'avg_sentiment_score': avg_score,
                    'total_items': metrics['items']
                }
                
            # Sort by time
            sorted_timeline = dict(sorted(timeline_data.items()))
            
            return {
                'interval': interval,
                'timeline': sorted_timeline
            }
            
        except Exception as e:
            logger.error(f"Time-based sentiment analysis failed: {str(e)}", exc_info=True)
            return {
                'interval': interval,
                'timeline': {},
                'error': str(e)
            }
    
    def analyze_trends(self, data: List[Dict[str, Any]], top_hashtags: int = 5,
                      progress_callback: Optional[Callable] = None) -> Dict[str, Any]:
        
        """Comprehensive trend analysis with better empty data handling"""
        if not data:
            logger.warning("Received empty dataset for analysis")
            return {
                'metadata': {
                    'analysis_timestamp': datetime.now().isoformat(),
                    'total_items_analyzed': 0,
                    'warning': 'Empty dataset received'
                },
                'empty_data': True
            }
        
        """Comprehensive trend analysis with error handling"""
        if not self._validate_input_data(data):
            logger.error("Invalid data structure for trend analysis")
            return {
                'error': 'Invalid input data',
                'metadata': {
                    'analysis_timestamp': datetime.now().isoformat(),
                    'total_items_analyzed': 0
                }
            }
            
        try:
            # For large datasets, use threads to run analyses in parallel
            with ThreadPoolExecutor(max_workers=4) as executor:
                # Start all analyses in parallel
                hashtag_future = executor.submit(
                    self.analyze_hashtags, data, top_hashtags, progress_callback
                )
                sentiment_future = executor.submit(
                    self.get_sentiment_distribution, data, progress_callback
                )
                platform_future = executor.submit(
                    self.get_platform_distribution, data
                )
                engagement_future = executor.submit(
                    self.get_engagement_metrics, data, progress_callback
                )
                time_future = executor.submit(
                    self.analyze_sentiment_by_time, data, 'day', progress_callback
                )
                
                # Wait for all results
                hashtag_analysis = hashtag_future.result()
                sentiment_distribution = sentiment_future.result()
                platform_distribution = platform_future.result()
                engagement_metrics = engagement_future.result()
                time_analysis = time_future.result()
            
            # Compile full trend report
            trend_report = {
                'hashtag_analysis': hashtag_analysis,
                'sentiment_distribution': sentiment_distribution,
                'platform_distribution': platform_distribution,
                'engagement_metrics': engagement_metrics,
                'time_analysis': time_analysis,
                'metadata': {
                    'analysis_timestamp': datetime.now().isoformat(),
                    'total_items_analyzed': len(data)
                }
            }
            
            return trend_report
            
        except Exception as e:
            logger.error(f"Comprehensive trend analysis failed: {str(e)}", exc_info=True)
            return {
                'error': str(e),
                'metadata': {
                    'analysis_timestamp': datetime.now().isoformat(),
                    'total_items_analyzed': len(data) if data else 0
                }
            }
    
    def get_insights(self, trend_report: Dict[str, Any]) -> List[str]:
        """Generate actionable insights from trend analysis"""
        insights = []
        
        try:
            # Get sentiment distribution insights
            sentiment_dist = trend_report.get('sentiment_distribution', {})
            total_sentiments = sum(sentiment_dist.values())
            
            if total_sentiments > 0:
                pos_pct = sentiment_dist.get('Positive', 0) / total_sentiments * 100
                neg_pct = sentiment_dist.get('Negative', 0) / total_sentiments * 100
                
                if pos_pct > 60:
                    insights.append(f"Overall sentiment is highly positive ({pos_pct:.1f}%), indicating strong positive reception.")
                elif pos_pct > 40:
                    insights.append(f"Overall sentiment is moderately positive ({pos_pct:.1f}%).")
                elif neg_pct > 60:
                    insights.append(f"Overall sentiment is highly negative ({neg_pct:.1f}%), suggesting significant issues.")
                elif neg_pct > 40:
                    insights.append(f"Overall sentiment is moderately negative ({neg_pct:.1f}%).")
                else:
                    insights.append(f"Overall sentiment is mixed or neutral (Positive: {pos_pct:.1f}%, Negative: {neg_pct:.1f}%).")
            
            # Get hashtag insights
            hashtag_analysis = trend_report.get('hashtag_analysis', {})
            top_hashtags = hashtag_analysis.get('top_hashtags', [])
            
            if top_hashtags:
                # Find most positive and negative hashtags
                most_positive = max(top_hashtags, key=lambda x: x.get('avg_sentiment', 0))
                most_negative = min(top_hashtags, key=lambda x: x.get('avg_sentiment', 0))
                
                # Highest engagement hashtag
                highest_engagement = max(top_hashtags, 
                                        key=lambda x: x.get('engagement', {}).get('total_engagement', 0))
                
                # Add insights
                insights.append(f"Most popular hashtag: #{top_hashtags[0]['hashtag']} with {top_hashtags[0]['count']} mentions.")
                
                if most_positive['avg_sentiment'] > 0.2:
                    insights.append(f"Most positive trending hashtag: #{most_positive['hashtag']} with sentiment score of {most_positive['avg_sentiment']:.2f}.")
                
                if most_negative['avg_sentiment'] < -0.2:
                    insights.append(f"Most negative trending hashtag: #{most_negative['hashtag']} with sentiment score of {most_negative['avg_sentiment']:.2f}.")
                
                insights.append(f"Hashtag with highest engagement: #{highest_engagement['hashtag']} with {highest_engagement['engagement']['total_engagement']:.0f} total engagements.")
            
            # Get engagement insights
            engagement = trend_report.get('engagement_metrics', {})
            if engagement:
                avg_rate = engagement.get('engagement_rate', 0)
                insights.append(f"Average engagement rate: {avg_rate:.2f} engagements per post.")
                
                # Platform comparison if multiple platforms
                platform_metrics = engagement.get('platform_averages', {})
                if len(platform_metrics) > 1:
                    # Find platform with highest engagement
                    best_platform = max(platform_metrics.items(), 
                                      key=lambda x: x[1].get('engagement_rate', 0))
                    
                    insights.append(f"{best_platform[0].capitalize()} shows the highest engagement rate at {best_platform[1]['engagement_rate']:.2f} per post.")
                
                # Sentiment engagement comparison
                sentiment_engagement = engagement.get('sentiment_engagement', {})
                if 'Positive' in sentiment_engagement and 'Negative' in sentiment_engagement:
                    pos_rate = sentiment_engagement['Positive'].get('engagement_rate', 0)
                    neg_rate = sentiment_engagement['Negative'].get('engagement_rate', 0)
                    
                    if pos_rate > neg_rate * 1.5:
                        insights.append(f"Positive content receives {pos_rate/neg_rate:.1f}x more engagement than negative content.")
                    elif neg_rate > pos_rate * 1.5:
                        insights.append(f"Negative content receives {neg_rate/pos_rate:.1f}x more engagement than positive content.")
            
            # Time-based insights
            time_analysis = trend_report.get('time_analysis', {})
            timeline = time_analysis.get('timeline', {})
            
            if timeline:
                # Find peak engagement times
                max_engagement_time = max(timeline.items(), key=lambda x: x[1].get('total_items', 0))
                
                interval = time_analysis.get('interval', 'day')
                insights.append(f"Peak activity occurred on {max_engagement_time[0]} with {max_engagement_time[1]['total_items']} posts.")
                
                # Look for sentiment shifts over time
                timeline_keys = sorted(timeline.keys())
                if len(timeline_keys) >= 3:  # Need at least 3 points to detect a trend
                    first_period = timeline[timeline_keys[0]]
                    last_period = timeline[timeline_keys[-1]]
                    
                    first_score = first_period.get('avg_sentiment_score', 0)
                    last_score = last_period.get('avg_sentiment_score', 0)
                    
                    if last_score > first_score + 0.2:
                        insights.append(f"Sentiment is trending positively over the time period (from {first_score:.2f} to {last_score:.2f}).")
                    elif first_score > last_score + 0.2:
                        insights.append(f"Sentiment is trending negatively over the time period (from {first_score:.2f} to {last_score:.2f}).")
            
        except Exception as e:
            insights.append(f"Error generating insights: {e}")
        
        return insights
    
    def export_analysis_to_json(self, trend_report: Dict[str, Any], filename: str) -> bool:
        """Enhanced JSON export with validation"""
        if not isinstance(trend_report, dict):
            logger.error("Invalid trend_report - must be dictionary")
            return False
            
        if not isinstance(filename, str) or not filename.endswith('.json'):
            logger.error(f"Invalid filename: {filename}")
            return False
            
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(trend_report, f, indent=2, ensure_ascii=False)
            logger.info(f"Successfully exported analysis to {filename}")
            return True
        except Exception as e:
            logger.error(f"Failed to export analysis: {str(e)}", exc_info=True)
            return False
    
    def get_analysis_summary(self, trend_report: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a comprehensive analysis summary for UI display"""
        summary = {
            'sentiment': {
                'positive': 0,
                'neutral': 0,
                'negative': 0
            },
            'platforms': {},
            'hashtags': {
                'total': 0,
                'unique': 0,
                'top_hashtags': []
            },
            'engagement': {
                'likes': 0,
                'retweets': 0,
                'replies': 0,
                'comments': 0
            },
            'time_analysis': {}
        }
        
        try:
            # Sentiment summary
            sentiment = trend_report.get('sentiment_distribution', {})
            summary['sentiment']['positive'] = sentiment.get('Positive', 0)
            summary['sentiment']['neutral'] = sentiment.get('Neutral', 0)
            summary['sentiment']['negative'] = sentiment.get('Negative', 0)
            
            # Platform summary
            platforms = trend_report.get('platform_distribution', {})
            summary['platforms'] = dict(platforms)
            
            # Hashtag summary
            hashtags = trend_report.get('hashtag_analysis', {})
            summary['hashtags']['total'] = hashtags.get('total_hashtags', 0)
            summary['hashtags']['unique'] = hashtags.get('unique_hashtags', 0)
            summary['hashtags']['top_hashtags'] = hashtags.get('top_hashtags', [])
            
            # Engagement summary
            engagement = trend_report.get('engagement_metrics', {})
            summary['engagement']['likes'] = engagement.get('total_likes', 0)
            summary['engagement']['retweets'] = engagement.get('total_retweets', 0)
            summary['engagement']['replies'] = engagement.get('total_replies', 0)
            summary['engagement']['comments'] = engagement.get('total_comments', 0)
            
            # Time analysis
            time_data = trend_report.get('time_analysis', {})
            summary['time_analysis']['interval'] = time_data.get('interval', 'day')
            
            # Find peak activity period
            timeline = time_data.get('timeline', {})
            if timeline:
                peak_activity = max(
                    timeline.items(),
                    key=lambda x: x[1].get('total_items', 0),
                    default=('', {'total_items': 0})
                )
                summary['time_analysis']['peak_activity'] = peak_activity
            else:
                summary['time_analysis']['peak_activity'] = ['N/A', {'total_items': 0}]
            
        except Exception as e:
            summary['error'] = str(e)
            
        return summary